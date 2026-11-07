import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const nextCli = join(root, 'node_modules', 'next', 'dist', 'bin', 'next')
const prismaCli = join(root, 'node_modules', 'prisma', 'build', 'index.js')
const envLocal = join(root, '.env.local')

function run(command, args, env, input) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    input,
    stdio: input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
    windowsHide: true,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status ?? 'unknown'}`)
}

async function getFreePort() {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Could not allocate a local test port.')
  await new Promise((resolveClose, rejectClose) =>
    server.close((error) => error ? rejectClose(error) : resolveClose())
  )
  return address.port
}

async function waitForServer(server, url) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`Test server exited with status ${server.exitCode}.`)
    try {
      const response = await fetch(`${url}/api/bootstrap`, { signal: AbortSignal.timeout(3000) })
      if (response.ok) return
    } catch {
      await delay(1000)
    }
  }
  throw new Error('Test server did not become ready within 60 seconds.')
}

async function stopServer(server) {
  if (!server || server.exitCode !== null) return
  server.kill()
  await Promise.race([
    once(server, 'exit'),
    delay(5000).then(() => { throw new Error('Could not stop the temporary E2E server.') }),
  ])
}

async function main() {
  if (!existsSync(join(root, '.next', 'BUILD_ID'))) {
    throw new Error('Build the production app first with `bun run build`.')
  }
  if (!process.env.E2E_DATABASE_URL) {
    throw new Error('Set E2E_DATABASE_URL to a disposable PostgreSQL database before running the E2E test.')
  }
  if (!existsSync(envLocal) && !process.env.GEMINI_API_KEY) {
    throw new Error('Create .env.local with GEMINI_API_KEY before running the AI-backed E2E test.')
  }

  const testDatabaseUrl = new URL(process.env.E2E_DATABASE_URL)
  if (!['postgres:', 'postgresql:'].includes(testDatabaseUrl.protocol) || !testDatabaseUrl.hostname) {
    throw new Error('E2E_DATABASE_URL must be a PostgreSQL connection URL.')
  }

  const schemaName = `veriloom_e2e_${randomUUID().replaceAll('-', '')}`
  testDatabaseUrl.searchParams.set('schema', schemaName)
  const databaseUrl = testDatabaseUrl.toString()
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    NODE_ENV: 'production',
  }

  let server
  try {
    run(process.execPath, [prismaCli, 'db', 'push'], env)

    const port = await getFreePort()
    const url = `http://127.0.0.1:${port}`
    server = spawn(
      process.execPath,
      [
        ...(existsSync(join(root, '.env')) ? ['--env-file=.env'] : []),
        ...(existsSync(envLocal) ? ['--env-file=.env.local'] : []),
        nextCli,
        'start',
        '-p',
        String(port),
      ],
      {
        cwd: root,
        env: { ...env, HOSTNAME: '127.0.0.1' },
        stdio: 'inherit',
        windowsHide: true,
      }
    )

    await waitForServer(server, url)
    run('python', [join(root, 'scripts', 'e2e.py'), '--base-url', url], env)
  } finally {
    try {
      await stopServer(server)
    } finally {
      run(
        process.execPath,
        [prismaCli, 'db', 'execute', '--stdin'],
        { ...env, DIRECT_URL: databaseUrl },
        `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`
      )
    }
  }
}

main().catch((error) => {
  console.error(`Isolated E2E failed: ${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
})
