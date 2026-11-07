import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const standalone = join(root, '.next', 'standalone')

if (!existsSync(standalone)) {
  throw new Error('Next.js standalone output is missing. Run `next build` first.')
}

for (const asset of ['.next/static', 'public']) {
  const source = join(root, asset)
  if (!existsSync(source)) {
    if (asset === 'public') continue
    throw new Error(`Required build asset directory is missing: ${asset}`)
  }

  const destination = asset === 'public'
    ? join(standalone, 'public')
    : join(standalone, '.next', 'static')

  mkdirSync(destination, { recursive: true })
  cpSync(source, destination, { recursive: true })
}
