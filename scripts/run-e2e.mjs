import { spawn, spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const databaseName = `.veriloom-e2e-${randomUUID()}.db`
const databasePath = join(root, 'db', databaseName)
const databaseUrl = `file:../db/${databaseName}`
const standaloneServer = join(root, '.next', 'standalone', 'server.js')
const prismaCli = join(root, 'node_modules', 'prisma', 'build', 'index.js')
const envLocal = join(root, '.env.local')

function run(command, args, env) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit', windowsHide: true })
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
  if (!existsSync(standaloneServer)) {
    throw new Error('Build the production app first with `bun run build`.')
  }
  if (!existsSync(envLocal)) {
    throw new Error('Create .env.local with GEMINI_API_KEY before running the AI-backed E2E test.')
  }

  const env = { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: 'production' }
  let server
  try {
    run(process.execPath, [prismaCli, 'db', 'push'], env)

    const port = await getFreePort()
    const url = `http://127.0.0.1:${port}`
    server = spawn(
      process.execPath,
      ['--env-file=.env', '--env-file=.env.local', standaloneServer],
      {
        cwd: root,
        env: { ...env, PORT: String(port), HOSTNAME: '127.0.0.1' },
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
      for (const suffix of ['', '-journal', '-shm', '-wal']) {
        rmSync(`${databasePath}${suffix}`, { force: true })
      }
    }
  }
}

main().catch((error) => {
  console.error(`Isolated E2E failed: ${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
})
