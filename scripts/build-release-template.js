#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)
const args = process.argv.slice(2)
let appName
let frameworkPrebuilt = false

for (const arg of args) {
  if (arg.startsWith('--prod=')) appName = arg.split('=')[1]
  else if (arg === '--prebuilt') frameworkPrebuilt = true
  else {
    console.error(`Unknown argument: ${arg}`)
    process.exit(1)
  }
}

if (!appName || !/^[a-z0-9][a-z0-9-]*$/.test(appName)) {
  console.error('Must specify a valid --prod=<app-name>')
  process.exit(1)
}

const releaseConfigPath = path.join(
  repositoryRoot,
  'release-configs',
  `${appName}.json`
)
if (!existsSync(releaseConfigPath)) {
  console.error(`Release config not found: ${releaseConfigPath}`)
  process.exit(1)
}

const releaseConfig = JSON.parse(readFileSync(releaseConfigPath, 'utf8'))
const templateRoot = path.resolve(repositoryRoot, releaseConfig.dest)
const templateConfigPath = path.join(templateRoot, 'vite.config.ts')
const outputDirectory = path.join(
  repositoryRoot,
  'tmp',
  `release-template-build-${appName}-${process.pid}`
)

if (!existsSync(path.join(templateRoot, 'package.json'))) {
  console.error(`Generated template not found: ${templateRoot}`)
  process.exit(1)
}

const buildEnvironment = {
  ...process.env,
  ASYRA_DESIGN_APP_URL:
    process.env.ASYRA_DESIGN_APP_URL ?? 'http://127.0.0.1:4173',
  VITE_ASYRA_DESIGN_COLLABORATION_WS_URL:
    process.env.VITE_ASYRA_DESIGN_COLLABORATION_WS_URL ??
    'ws://127.0.0.1:4101/asyra-design-collaboration'
}

try {
  if (!frameworkPrebuilt) {
    execFileSync('yarn', ['react:build'], {
      cwd: repositoryRoot,
      env: buildEnvironment,
      stdio: 'inherit'
    })
  }

  execFileSync(
    'yarn',
    [
      'workspace',
      '@asyra/asyra-design',
      'vite',
      'build',
      templateRoot,
      '--config',
      templateConfigPath,
      '--outDir',
      outputDirectory,
      '--emptyOutDir'
    ],
    {
      cwd: repositoryRoot,
      env: buildEnvironment,
      stdio: 'inherit'
    }
  )
  console.log(`Generated template for "${appName}" builds successfully`)
} finally {
  rmSync(outputDirectory, { recursive: true, force: true })
}
