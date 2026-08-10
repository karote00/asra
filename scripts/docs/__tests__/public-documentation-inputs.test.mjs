import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { FRAMEWORK_RELEASE_PACKAGE_NAMES } from '../../framework-release-packages.js'
import { readApprovedDocumentationInputs } from '../public-documentation-inputs.mjs'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
)

test('documentation inputs derive the exact public release package facts', async () => {
  const inputs = await readApprovedDocumentationInputs({ repositoryRoot })

  assert.equal(inputs.schemaVersion, 1)
  assert.equal(inputs.release.status, 'CANDIDATE')
  assert.equal(inputs.release.publicationAuthorized, false)
  assert.equal(inputs.packages.length, 19)
  assert.deepEqual(
    inputs.packages.map(({ name }) => name),
    FRAMEWORK_RELEASE_PACKAGE_NAMES
  )

  for (const packageRecord of inputs.packages) {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(repositoryRoot, packageRecord.manifestPath),
        'utf8'
      )
    )
    assert.equal(packageRecord.version, manifest.version)
    assert.equal(packageRecord.license, manifest.license)
    assert.ok(packageRecord.publicEntries.length > 0)
    assert.ok(
      fs.existsSync(path.join(repositoryRoot, packageRecord.contractPath))
    )
    assert.ok(Object.isFrozen(packageRecord))
  }
})

test('documentation inputs do not expose a repository example inventory', async () => {
  const inputs = await readApprovedDocumentationInputs({ repositoryRoot })
  assert.equal('examples' in inputs, false)
})

test('documentation authority rules are explicit, bounded, and public-safe', async () => {
  const inputs = await readApprovedDocumentationInputs({ repositoryRoot })
  const { authority } = inputs

  assert.deepEqual(authority.allowedRoots, [
    'apps/asyra-design/',
    'create-app/asyra-design/',
    'docs/ai/apps/asyra-design/',
    'docs/ai/framework/',
    'packages/'
  ])
  assert.deepEqual(authority.allowedRootFiles, [
    'LICENSE',
    'SECURITY.md',
    'package.json'
  ])
  assert.deepEqual(authority.allowedPlanFiles, [
    'docs/ai/framework/plans/headless-core-and-core-kernel-future-plan.md'
  ])
  assert.deepEqual(authority.allowedResearchFiles, [
    'docs/ai/framework/research/headless-core-and-core-kernel-architecture-research.md'
  ])
  assert.deepEqual(authority.forbiddenSegments, [
    '/audits/',
    '/decisions/',
    '/plans/completed/',
    '/task-breakdowns/'
  ])
  assert.deepEqual(authority.forbiddenTerms, [
    'credential',
    'private endpoint',
    'secret',
    'token'
  ])
  assert.ok(Object.isFrozen(inputs))
  assert.ok(Object.isFrozen(authority))
})
