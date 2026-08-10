import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { FRAMEWORK_RELEASE_PACKAGE_NAMES } from '../../framework-release-packages.js'
import { readApprovedExamplePackageInputs } from '../example-package-inputs.mjs'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
)

test('example package inputs derive the complete public set from release owners', () => {
  const inputs = readApprovedExamplePackageInputs({ repositoryRoot })

  assert.equal(inputs.status, 'CANDIDATE')
  assert.equal(inputs.publicationAuthorized, false)
  assert.deepEqual(
    inputs.packages.map(({ name }) => name),
    FRAMEWORK_RELEASE_PACKAGE_NAMES
  )
  assert.equal(inputs.packages.length, 19)

  inputs.packages.forEach((record) => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(repositoryRoot, record.manifestPath), 'utf8')
    )
    assert.equal(record.version, manifest.version)
    assert.equal(record.artifactPackageName, manifest.name)
    assert.ok(record.publicEntries.includes('.'))
    assert.match(record.artifactPath, /^tmp\/framework-release-artifacts\//u)
    assert.doesNotMatch(JSON.stringify(record), /workspace:|\/src(?:\/|$)/u)
  })
})

test('example package inputs expose one manifest-derived release family', () => {
  const inputs = readApprovedExamplePackageInputs({ repositoryRoot })
  const families = new Set(
    inputs.packages.map(({ version }) =>
      version.split('.').slice(0, 2).join('.')
    )
  )

  assert.deepEqual([...families], [inputs.releaseFamily])
  assert.equal(inputs.runtime.node, '24.x')
  assert.equal(inputs.runtime.packageManager, 'yarn@4.3.1')
  assert.equal(inputs.supportContract, 'docs/ai/framework/RELEASE_SUPPORT.md')
})
