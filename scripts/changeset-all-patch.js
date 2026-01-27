#!/usr/bin/env node
// scripts/changeset-all-patch.js

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

// __dirname replacement for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Read root package.json
const rootPkgPath = path.resolve(__dirname, '../package.json')
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'))

// Get all workspace packages (yarn v2+ outputs one JSON per line)
const workspaceRaw = execSync('yarn workspaces list --json', {
  encoding: 'utf-8'
})

// Parse each line as JSON and collect into array
const workspacesList = workspaceRaw
  .split('\n')
  .filter((line) => line.trim()) // remove empty lines
  .map((line) => JSON.parse(line))

// Filter out root package and private packages
const filtered = workspacesList.filter(({ name, location }) => {
  if (name === rootPkg.name) return false

  try {
    const pkgJsonPath = path.resolve(__dirname, '..', location, 'package.json')
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))
    return !pkgJson.private
  } catch {
    return true
  }
})

// Generate "<package-name>: patch" list with quotes for YAML
const packageLines = filtered.map((p) => `"${p.name}": patch`).join('\n')

// Build the changeset content
const changesetContent = `---
${packageLines}
---
Auto-patch all packages.
`

// Ensure .changeset directory exists
fs.mkdirSync(path.resolve(__dirname, '../.changeset'), { recursive: true })

// Write the changeset file
fs.writeFileSync(
  path.resolve(__dirname, '../.changeset/auto-patch.md'),
  changesetContent
)

console.log('✅ .changeset/auto-patch.md generated successfully.')
