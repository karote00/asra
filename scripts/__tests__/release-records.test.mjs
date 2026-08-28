import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { validateFrameworkReleaseRecords } from '../release-records.js'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)

const readManifest = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8'))

const versionFamilyOf = (version) => version.split('.').slice(0, 2).join('.')
const identityOf = ({ name, version }) => ({ name, version })
const compareVersions = (left, right) => {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)
  for (let index = 0; index < leftParts.length; index += 1) {
    const difference = leftParts[index] - rightParts[index]
    if (difference !== 0) return difference
  }
  return 0
}

test('release records derive Framework and excluded-owner versions from manifests', () => {
  const result = validateFrameworkReleaseRecords({ repositoryRoot })
  const pendingChangesets = fs
    .readdirSync(path.join(repositoryRoot, '.changeset'))
    .filter((entry) => entry.endsWith('.md') && entry !== 'README.md')
    .sort()

  assert.equal(result.status, 'PASS')
  assert.equal(result.packages.length, 19)
  assert.deepEqual(
    result.packageVersions,
    Object.fromEntries(
      result.packages.map((record) => [
        record.name,
        readManifest(
          `packages/${record.name.slice('@asyra/'.length)}/package.json`
        ).version
      ])
    )
  )
  assert.deepEqual(
    new Set(result.packages.map((record) => versionFamilyOf(record.version))),
    new Set([result.releaseFamily])
  )
  assert.deepEqual(
    result.releaseVersions,
    [...new Set(Object.values(result.packageVersions))].sort(compareVersions)
  )
  assert.deepEqual(result.excludedVersions, {
    root: identityOf(readManifest('package.json')),
    privateApp: identityOf(readManifest('apps/asyra-design/package.json')),
    createApp: identityOf(readManifest('create-app/asyra-design/package.json'))
  })
  assert.deepEqual(result.pendingChangesets, pendingChangesets)
  assert.equal(result.gate5ReadinessStatus, 'READY')
  assert.equal(result.releaseDecision, 'PENDING')
  assert.equal(result.publicationAuthorized, false)
})

test('public release docs link current support while release records derive manifest-owned candidates', () => {
  const read = (relativePath) =>
    fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
  const readme = read('README.md')
  const releaseNotes = read('RELEASE_NOTES.md')
  const support = read('docs/ai/framework/RELEASE_SUPPORT.md')

  assert.match(readme, /## Current support/i)
  assert.match(readme, /docs\/public\/reference\/support-release\.md/i)
  assert.match(releaseNotes, /Framework pre-publication candidate/i)
  assert.match(releaseNotes, /release decision remains `PENDING`/)
  assert.match(support, /current Framework package manifests/i)
  assert.match(support, /historical\s+release-readiness evidence/i)
  assert.match(support, /create-asyra-design-app.*excluded/is)
  assert.doesNotMatch(
    support.slice(support.indexOf('## Reproducible readiness commands')),
    /release:template/
  )
})
