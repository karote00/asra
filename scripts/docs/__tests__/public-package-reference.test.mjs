import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  checkPublicPackageReference,
  createPublicPackageReference
} from '../public-package-reference.mjs'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
)

test('package reference derives all release facts and guide relationships', async () => {
  const reference = await createPublicPackageReference({ repositoryRoot })

  assert.equal(reference.schemaVersion, 1)
  assert.equal(reference.packages.length, 19)
  assert.equal(reference.release.packageCount, 19)
  assert.equal(reference.release.publicationAuthorized, false)

  for (const packageRecord of reference.packages) {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(repositoryRoot, packageRecord.manifestPath),
        'utf8'
      )
    )
    assert.equal(packageRecord.version, manifest.version)
    assert.equal(packageRecord.license, manifest.license)
    assert.ok(packageRecord.publicEntries.length > 0)
    assert.ok(packageRecord.guideId.endsWith(packageRecord.directory))
    assert.ok(fs.existsSync(path.join(repositoryRoot, packageRecord.guidePath)))
    assert.match(packageRecord.sourceDigests.manifest, /^[a-f0-9]{64}$/)
    assert.match(packageRecord.sourceDigests.contract, /^[a-f0-9]{64}$/)
    assert.match(packageRecord.sourceDigests.guide, /^[a-f0-9]{64}$/)
  }
})

test('checked package reference is deterministic and current', async () => {
  const reference = await checkPublicPackageReference({ repositoryRoot })
  assert.equal(reference.packages.length, 19)
})
