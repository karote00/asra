import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  FRAMEWORK_RELEASE_CANDIDATE_VERSION,
  validateFrameworkReleaseRecords
} from '../release-records.js'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)

test('release records freeze the candidate version, public docs, and publication boundary', () => {
  const result = validateFrameworkReleaseRecords({ repositoryRoot })

  assert.equal(result.status, 'PASS')
  assert.equal(result.candidateVersion, FRAMEWORK_RELEASE_CANDIDATE_VERSION)
  assert.equal(result.candidateVersion, '0.5.0')
  assert.equal(result.packages.length, 19)
  assert.deepEqual(
    new Set(result.packages.map((record) => record.version)),
    new Set([FRAMEWORK_RELEASE_CANDIDATE_VERSION])
  )
  assert.deepEqual(result.excludedVersions, {
    root: { name: 'asyra', version: '0.2.5' },
    privateApp: { name: '@asyra/asyra-design', version: '0.2.5' },
    createApp: { name: 'create-asyra-design-app', version: '0.1.0' }
  })
  assert.deepEqual(result.pendingChangesets, [])
  assert.equal(result.releaseSnapshot, null)
  assert.equal(result.gate5ReadinessStatus, 'READY')
  assert.equal(result.releaseDecision, 'PENDING')
  assert.equal(result.publicationAuthorized, false)
})

test('public release docs distinguish the 0.5.0 candidate from historical 0.2.5 readiness', () => {
  const read = (relativePath) =>
    fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
  const readme = read('README.md')
  const releaseNotes = read('RELEASE_NOTES.md')
  const support = read('docs/ai/framework/RELEASE_SUPPORT.md')

  assert.match(readme, /Framework `0\.5\.0` is the current release candidate/)
  assert.match(releaseNotes, /Framework 0\.5\.0 pre-publication candidate/)
  assert.match(releaseNotes, /release decision remains `PENDING`/)
  assert.match(
    support,
    /Framework `0\.5\.0` release candidate[\s\S]*historical `0\.2\.5`/
  )
  assert.match(support, /create-asyra-design-app.*excluded/is)
  assert.doesNotMatch(
    support.slice(support.indexOf('## Reproducible readiness commands')),
    /release:template/
  )
})
