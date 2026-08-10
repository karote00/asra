const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../asyra-public-package-documentation-flow-inspector.data.cjs')

const repoRoot = path.resolve(__dirname, '../../../../..')
const step = (id) => {
  const value = data.steps.find((item) => item.id === id)
  assert.ok(value, `Missing documentation Inspector step: ${id}`)
  return value
}

test('documentation authority and exact page inventory are frozen', () => {
  assert.equal(
    data.authority.specPath,
    'docs/ai/framework/plans/asyra-public-package-documentation-plan.md'
  )
  assert.ok(fs.existsSync(path.join(repoRoot, data.authority.specPath)))
  assert.equal(data.pageIds.length, 41)
  assert.equal(new Set(data.pageIds).size, 41)
  assert.equal(data.packageGuideIds.length, 19)
  assert.deepEqual(
    data.pageIds.filter((id) => id.startsWith('reference/packages/')),
    data.packageGuideIds
  )
})

test('package guide inventory matches the release owner exactly', async () => {
  const { FRAMEWORK_RELEASE_PACKAGE_NAMES } = await import(
    '../../../../../scripts/framework-release-packages.js'
  )
  assert.deepEqual(data.packageNames, FRAMEWORK_RELEASE_PACKAGE_NAMES)
  assert.deepEqual(
    data.packageGuideIds,
    FRAMEWORK_RELEASE_PACKAGE_NAMES.map(
      (name) => `reference/packages/${name.slice('@asyra/'.length)}`
    )
  )
})

test('input resolution forbids private, historical, secret, and handwritten facts', () => {
  const input = step('resolve-documentation-inputs')
  const contract = [
    ...input.conditions,
    ...input.bypasses,
    ...input.allowedContributors,
    ...input.forbiddenContributors
  ].join(' ')
  assert.match(contract, /manifests and declarations/i)
  assert.match(contract, /verified examples/i)
  assert.match(contract, /handwritten package versions/i)
  assert.match(contract, /package-private source imports/i)
  assert.match(contract, /historical plans/i)
  assert.match(contract, /secrets or private endpoints/i)
})

test('content contract owns schema, stable ids, mappings, and exclusions', () => {
  const content = step('freeze-content-contract')
  const contract = [
    ...content.conditions,
    ...content.bypasses,
    ...content.allowedContributors,
    ...content.forbiddenContributors
  ].join(' ')
  assert.match(contract, /Exactly 41 stable page ids/i)
  assert.match(contract, /Markdown path.*sources.*packages.*example ids/is)
  assert.match(contract, /secrets.*obsolete contracts.*historical audits/is)
  assert.match(contract, /website-owned page ids/i)
  assert.match(contract, /README content/i)
})

test('authoring steps preserve current support, future roadmap, and domain ownership', () => {
  const authoring = [
    step('author-start-and-learn'),
    step('author-build-guides'),
    step('author-package-reference'),
    step('author-design-case-study')
  ]
  const contract = JSON.stringify(authoring)
  assert.match(contract, /create-asyra-design-app/i)
  assert.match(contract, /current browser\/Core support/i)
  assert.match(contract, /future Headless\/Core Kernel/i)
  assert.match(contract, /private imports/i)
  assert.match(contract, /App behavior claimed as Framework default/i)
  assert.match(contract, /All 19 release packages/i)
})

test('generated handoff is deterministic, public-only, and site-neutral', () => {
  const publish = step('publish-documentation-indexes')
  const verify = step('verify-public-documentation')
  const contract = JSON.stringify([publish, verify, data.acceptanceContracts])
  assert.match(contract, /deterministic/i)
  assert.match(contract, /source-mapped/i)
  assert.match(contract, /Plain-text discovery/i)
  assert.match(contract, /site-owned content copies/i)
  assert.match(contract, /manual spot-check as sole evidence/i)
  assert.match(
    contract,
    /website receives one deterministic source-mapped bundle/i
  )
})

test('routes, artifacts, failure owners, and cache boundaries resolve', () => {
  const stepIds = new Set(data.steps.map(({ id }) => id))
  const artifactOwners = new Map(
    data.artifacts.map(({ id, ownerStepId }) => [id, ownerStepId])
  )
  assert.equal(stepIds.size, data.steps.length)
  assert.equal(artifactOwners.size, data.artifacts.length)

  data.steps.forEach((item) => {
    assert.deepEqual(item.cacheDimensions, [], item.id)
    assert.equal(item.failureOwnerStepId, item.id)
    assert.ok(item.implementationBoundary.length > 0)
    assert.ok(item.specRefs.length > 0)
  })
  data.routes.forEach((route) => {
    assert.ok(stepIds.has(route.from))
    assert.ok(stepIds.has(route.to))
    route.producedArtifacts.forEach((artifactId) => {
      assert.equal(artifactOwners.get(artifactId), route.from)
    })
  })
})
