import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceExtensions = new Set([
  '.cjs',
  '.js',
  '.json',
  '.mjs',
  '.ts',
  '.tsx'
])
const ignoredDirectories = new Set([
  '.turbo',
  '.vercel',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results'
])
const redundantNamePattern = /\basyra_?design[A-Za-z0-9_]*\b/gi

const collectSourceFiles = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirectories.has(entry.name)) {
      return []
    }
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      return collectSourceFiles(entryPath)
    }
    return sourceExtensions.has(path.extname(entry.name)) ? [entryPath] : []
  })

test('App-local code identifiers do not repeat the containing product name', () => {
  const violations = collectSourceFiles(appRoot).flatMap((filePath) => {
    if (filePath.endsWith('app-local-naming.test.mjs')) return []
    const source = fs.readFileSync(filePath, 'utf8')
    const matches = source.match(redundantNamePattern) ?? []
    return matches.map((identifier) => ({
      file: path.relative(appRoot, filePath),
      identifier
    }))
  })

  assert.deepEqual(violations, [])
})
