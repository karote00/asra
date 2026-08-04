import assert from 'node:assert/strict'
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
  assert.equal(result.packages.length, 19)
  assert.deepEqual(
    new Set(result.packages.map((record) => record.version)),
    new Set([FRAMEWORK_RELEASE_CANDIDATE_VERSION])
  )
  assert.deepEqual(result.pendingChangesets, [])
  assert.equal(result.releaseSnapshot, null)
  assert.equal(result.readinessStatus, 'READY')
  assert.equal(result.publicationAuthorized, false)
})
