const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../asyra-public-readme-and-entrypoint-alignment-flow-inspector.data.cjs')

const repoRoot = path.resolve(__dirname, '../../../../..')
const step = (id) => {
  const value = data.steps.find((item) => item.id === id)
  assert.ok(value, `Missing README Inspector step: ${id}`)
  return value
}

test('README authority and exact public surface inventory are frozen', () => {
  assert.ok(fs.existsSync(path.join(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.join(repoRoot, data.authority.inspectorPath)))
  assert.equal(data.packageNames.length, 19)
  assert.equal(data.packageReadmePaths.length, 19)
  assert.equal(data.readmePaths.length, 23)
  assert.equal(new Set(data.readmePaths).size, 23)
  data.readmePaths.forEach((readmePath) => {
    assert.ok(fs.existsSync(path.join(repoRoot, readmePath)), readmePath)
  })
})

test('package README inventory matches the release owner exactly', async () => {
  const { FRAMEWORK_RELEASE_PACKAGE_NAMES } = await import(
    '../../../../../scripts/framework-release-packages.js'
  )
  assert.deepEqual(data.packageNames, FRAMEWORK_RELEASE_PACKAGE_NAMES)
  assert.deepEqual(
    data.packageReadmePaths,
    FRAMEWORK_RELEASE_PACKAGE_NAMES.map(
      (name) => `packages/${name.slice('@asyra/'.length)}/README.md`
    )
  )
})

test('input and content contract exclude handwritten facts and content forks', () => {
  const input = step('resolve-readme-inputs')
  const contract = step('freeze-readme-contract')
  const source = JSON.stringify([input, contract])
  assert.match(source, /manifests and declarations/i)
  assert.match(source, /accepted 41-page public documentation bundle/i)
  assert.doesNotMatch(source, /example inventory|docs\/examples/i)
  assert.match(source, /Exactly 23 README surfaces/i)
  assert.match(source, /manual generated-template edits/i)
  assert.match(source, /complete guide duplication/i)
})

test('surface owners preserve product, domain, runtime, and policy boundaries', () => {
  const source = JSON.stringify([
    step('author-root-readme'),
    step('author-package-readmes'),
    step('author-design-readme-sources'),
    step('author-cli-readme')
  ])
  assert.match(source, /Framework, Preset, App/i)
  assert.match(source, /future Headless\/Core Kernel/i)
  assert.match(source, /turnkey BIM, VR, simulation, or AI-domain/i)
  assert.match(source, /All 19 package READMEs/i)
  assert.match(source, /working-product beginner entrance/i)
  assert.match(source, /no external issues or contributions/i)
})

test('generated README route preserves canonical source ownership', () => {
  const generated = step('transform-generated-readme')
  assert.equal(
    data.authority.generatedReadmeSource,
    'apps/asyra-design/README.md'
  )
  assert.equal(
    data.authority.generatedReadmeOutput,
    'create-app/asyra-design/template/README.md'
  )
  assert.match(JSON.stringify(generated), /official release:app route/i)
  assert.match(JSON.stringify(generated), /link rewrite/i)
  assert.match(JSON.stringify(generated), /handwritten/i)
})

test('verification fails closed on links, APIs, generated drift, and policy conflicts', () => {
  const verify = step('verify-public-readmes')
  const source = JSON.stringify([verify, data.acceptanceContracts, data.invariants])
  assert.match(source, /Every link resolves/i)
  assert.match(source, /approved public entrypoint/i)
  assert.match(source, /stale generated output/i)
  assert.match(source, /source map deterministically acknowledges/i)
  assert.ok(
    verify.implementationBoundary.includes(
      'docs/public/generated/source-map.json'
    )
  )
  assert.match(source, /No public surface invites external issues or contributions/i)
  assert.match(source, /Current browser\/Core support/i)
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
    assert.ok(stepIds.has(route.from), route.id)
    assert.ok(stepIds.has(route.to), route.id)
    route.producedArtifacts.forEach((artifactId) => {
      assert.equal(artifactOwners.get(artifactId), route.from, route.id)
    })
  })
})
