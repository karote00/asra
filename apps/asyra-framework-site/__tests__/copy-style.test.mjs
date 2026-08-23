import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const siteRoot = path.resolve(import.meta.dirname, '..')
const repositoryRoot = path.resolve(siteRoot, '../..')
const emDash = String.fromCodePoint(0x2014)

const trackedFiles = execFileSync(
  'git',
  ['-C', repositoryRoot, 'ls-files', '-z'],
  { encoding: 'utf8' }
)
  .split('\0')
  .filter(Boolean)

const isReadme = (file) => /^readme(?:\.[^.]+)?$/i.test(path.basename(file))

const isWebsiteCopy = (file) =>
  file.startsWith('docs/public/') ||
  (/^apps\/asyra-framework-site\/(?:app|components)\//.test(file) &&
    /\.(?:ts|tsx|md)$/.test(file))

test('website copy and tracked READMEs use spaced ASCII hyphens', async () => {
  const candidateFiles = trackedFiles.filter(
    (file) => isReadme(file) || isWebsiteCopy(file)
  )
  const violations = []

  for (const file of candidateFiles) {
    const source = await readFile(path.join(repositoryRoot, file), 'utf8')
    if (!source.includes(emDash)) continue

    const lines = source.split('\n')
    lines.forEach((line, index) => {
      if (line.includes(emDash)) violations.push(`${file}:${index + 1}`)
    })
  }

  assert.deepEqual(
    violations,
    [],
    `Replace em dashes with a spaced ASCII hyphen in:\n${violations.join('\n')}`
  )
})
