#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const dependencyFields = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies'
]
const packagesDirectory = path.resolve('packages')
const violations = []

for (const entry of fs.readdirSync(packagesDirectory, {
  withFileTypes: true
})) {
  if (!entry.isDirectory()) continue
  const manifestPath = path.join(packagesDirectory, entry.name, 'package.json')
  if (!fs.existsSync(manifestPath)) continue
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (manifest.private) continue

  for (const field of dependencyFields) {
    for (const [dependencyName, range] of Object.entries(
      manifest[field] ?? {}
    )) {
      if (String(range).startsWith('workspace:')) {
        violations.push(`${manifest.name} ${field}.${dependencyName}=${range}`)
      }
    }
  }
}

if (violations.length > 0) {
  throw new Error(
    `Publishable package manifests contain workspace ranges:\n${violations.join('\n')}`
  )
}

process.stdout.write('Publishable workspace range check PASS\n')
