#!/usr/bin/env node
/* global console, process */

import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(import.meta.dirname, '../../..')

const exactBuildInputs = new Set([
  '.yarnrc.yml',
  'package.json',
  'turbo.json',
  'yarn.lock'
])

const buildInputPrefixes = [
  '.yarn/releases/',
  'apps/asyra-framework-site/',
  'docs/public/',
  'packages/'
]

export const isFrameworkSiteBuildInput = (file) =>
  exactBuildInputs.has(file) ||
  buildInputPrefixes.some((prefix) => file.startsWith(prefix))

export const shouldBuildFrameworkSite = (files) =>
  files.some(isFrameworkSiteBuildInput)

const readChangedFiles = () =>
  execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=ACDMRTUXB', 'HEAD^', 'HEAD', '--'],
    { cwd: repositoryRoot, encoding: 'utf8' }
  )
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean)

const run = () => {
  let changedFiles

  try {
    changedFiles = readChangedFiles()
  } catch {
    console.log(
      'Unable to resolve the previous commit; build the Framework site'
    )
    process.exit(1)
  }

  const buildInputs = changedFiles.filter(isFrameworkSiteBuildInput)
  if (buildInputs.length === 0) {
    console.log('No Framework site build inputs changed; ignore this build')
    process.exit(0)
  }

  console.log('Framework site build inputs changed:')
  for (const file of buildInputs) console.log(`- ${file}`)
  process.exit(1)
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  run()
}
