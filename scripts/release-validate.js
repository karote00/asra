#!/usr/bin/env node

import { execSync } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createReleaseValidationWorkspace,
  removeReleaseValidationWorkspace
} from './release-validation-workspace.js'
import { createReleaseValidationEnvironment } from './release-validation-environment.js'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)
const validationParent = path.join(repositoryRoot, 'tmp')

const args = process.argv.slice(2)
let appName
let printPlan = false

for (const arg of args) {
  if (arg.startsWith('--prod=')) appName = arg.split('=')[1]
  else if (arg === '--plan') printPlan = true
  else {
    console.error(`Unknown argument: ${arg}`)
    process.exit(1)
  }
}

if (!appName) {
  console.error('Must specify --prod=<app-name>')
  process.exit(1)
}

if (!/^[a-z0-9][a-z0-9-]*$/.test(appName)) {
  console.error(`Invalid app name: ${appName}`)
  process.exit(1)
}

const commands = [
  'yarn install --immutable',
  'yarn gen:turbo:check',
  'yarn clean',
  'yarn react:build',
  'yarn lint:ci',
  'yarn test:ci',
  'yarn deps:validate',
  'yarn workspace @asyra/asyra-design test:e2e:collaboration',
  `yarn release:app:check --prod=${appName}`,
  `yarn release:app:build --prod=${appName} --prebuilt`
]

if (printPlan) {
  process.stdout.write(`${JSON.stringify(commands, null, 2)}\n`)
  process.exit(0)
}

const findAvailablePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Unable to allocate release validation port'))
        return
      }

      const { port } = address
      server.close((error) => {
        if (error) reject(error)
        else resolve(port)
      })
    })
  })

let validationRoot
const cleanup = () => {
  if (!validationRoot) return
  removeReleaseValidationWorkspace(validationRoot, validationParent)
  validationRoot = undefined
}

process.once('exit', cleanup)
for (const [signal, exitCode] of [
  ['SIGINT', 130],
  ['SIGTERM', 143]
]) {
  process.once(signal, () => {
    cleanup()
    process.exit(exitCode)
  })
}

try {
  validationRoot = createReleaseValidationWorkspace({
    sourceRoot: repositoryRoot,
    validationParent
  })
  const appPort = await findAvailablePort()
  const collaborationPort = await findAvailablePort()
  const validationEnvironment = createReleaseValidationEnvironment({
    appPort,
    collaborationPort
  })

  console.log(`Release validation workspace: ${validationRoot}`)
  for (const command of commands) {
    console.log(`\n> ${command}`)
    execSync(command, {
      cwd: validationRoot,
      env: validationEnvironment,
      stdio: 'inherit'
    })
  }

  console.log('\nRelease validation passed')
} finally {
  cleanup()
}
