import { mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'
import process from 'node:process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const appRoot = fileURLToPath(new URL('../', import.meta.url))
const temporary = fileURLToPath(
  new URL('../.artifacts/browser-tmp/', import.meta.url)
)
mkdirSync(temporary, { recursive: true })
const child = spawn(
  process.execPath,
  [require.resolve('@playwright/test/cli'), 'test', ...process.argv.slice(2)],
  {
    cwd: appRoot,
    env: { ...process.env, TMPDIR: temporary, TMP: temporary, TEMP: temporary },
    stdio: 'inherit'
  }
)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => child.kill(signal))
child.on('error', (error) => {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0)
})
