const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../asyra-executable-examples-flow-inspector.data.cjs')

const expectedExampleIds = [
  'core-information-model',
  'preset-2d-minimal',
  'preset-selective-defaults',
  'custom-component-schema',
  'feature-session-undo',
  'app-versioned-load-migration',
  'custom-render-boundary',
  'collaboration-two-memory-actors',
  'ai-registered-action',
  'app-retrieval-action',
  'generated-design-app-extension'
]

const step = (id) => {
  const value = data.steps.find((item) => item.id === id)
  assert.ok(value, `Missing Inspector step: ${id}`)
  return value
}

test('product contract and dedicated Inspector remain resolvable authorities', () => {
  const repoRoot = path.resolve(__dirname, '../../../../..')
  const productLink = data.links.find((link) => link.id === 'product-contract')

  assert.equal(
    data.authority.specPath,
    'docs/ai/framework/plans/asyra-executable-examples-plan.md'
  )
  assert.equal(
    data.authority.inspectorPath,
    'docs/ai/framework/plans/asyra-executable-examples-flow-inspector.data.cjs'
  )
  assert.ok(productLink)
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(__dirname, '..', productLink.href)))
})

test('Inspector freezes the exact first maintained example suite', () => {
  const acceptance = data.acceptanceContracts.find(
    (contract) => contract.id === 'required-example-suite'
  )

  assert.deepEqual(data.exampleIds, expectedExampleIds)
  assert.equal(new Set(data.exampleIds).size, 11)
  assert.ok(acceptance)
  expectedExampleIds.forEach((id) => {
    assert.match(acceptance.assertions.join(' '), new RegExp(id))
  })
})

test('release inputs forbid example-owned versions and private resolution', () => {
  const releaseInputs = step('resolve-release-inputs')
  const contract = [
    ...releaseInputs.conditions,
    ...releaseInputs.allowedContributors,
    ...releaseInputs.forbiddenContributors
  ].join(' ')

  assert.equal(releaseInputs.ownerPackage, 'framework release inventory')
  assert.match(contract, /verified release inventory/i)
  assert.match(contract, /package roots/i)
  assert.match(contract, /workspace aliases/i)
  assert.match(contract, /package source paths/i)
  assert.match(contract, /example-owned version literals/i)
})

test('Framework examples own cases 1 through 10 without runtime or domain overclaiming', () => {
  const examples = step('author-framework-examples')
  const contract = [
    ...examples.conditions,
    ...examples.bypasses,
    ...examples.allowedContributors,
    ...examples.forbiddenContributors
  ].join(' ')

  assert.equal(examples.ownerPackage, 'docs/examples')
  assert.match(examples.purpose, /examples 1 through 10/i)
  assert.match(contract, /stable example id/i)
  assert.match(contract, /supported browser\/Core composition/i)
  assert.match(contract, /does not claim a public Headless Core runtime/i)
  assert.match(contract, /inert when omitted/i)
  assert.match(contract, /no partial canonical state/i)
  assert.match(contract, /domain behavior claimed as Framework behavior/i)
  assert.ok(examples.implementationBoundary.includes('docs/examples/**'))
})

test('generated app extension stays bounded and outside production bootstrap', () => {
  const extension = step('author-generated-app-extension')
  const contract = [
    ...extension.conditions,
    ...extension.bypasses,
    ...extension.allowedContributors,
    ...extension.forbiddenContributors
  ].join(' ')

  assert.equal(extension.ownerPackage, '@asyra/asyra-design')
  assert.match(contract, /does not change production behavior/i)
  assert.match(contract, /excluded from production bundles/i)
  assert.match(contract, /app-owned domain code/i)
  assert.match(contract, /manual template dist edits/i)
  assert.match(contract, /release generator/i)
  assert.match(contract, /production bootstrap changes/i)
  assert.ok(
    extension.implementationBoundary.includes('apps/asyra-design/examples/**')
  )
  assert.ok(
    extension.implementationBoundary.includes(
      'create-app/asyra-design/template/examples/**'
    )
  )
  assert.ok(
    extension.implementationBoundary.includes(
      'create-app/asyra-design/template/src/__tests__/*example*'
    )
  )
})

test('consumer validation requires local and registry-only public execution', () => {
  const validation = step('verify-public-consumers')
  const contract = [
    ...validation.conditions,
    ...validation.bypasses,
    ...validation.allowedContributors,
    ...validation.forbiddenContributors
  ].join(' ')

  assert.match(contract, /All 11 stable example ids/i)
  assert.match(contract, /Local artifact and final registry-only/i)
  assert.match(contract, /no partial canonical state/i)
  assert.match(contract, /approved packed or registry artifacts/i)
  assert.match(contract, /workspace symlinks/i)
  assert.match(contract, /manual-only expected output/i)
})

test('current examples keep Headless Core and Core Kernel in the future roadmap', () => {
  const suiteContract = data.acceptanceContracts.find(
    (contract) => contract.id === 'runtime-and-optional-boundaries'
  )
  const inspectorText = JSON.stringify(data)

  assert.ok(suiteContract)
  assert.match(inspectorText, /currently supported browser\/Core composition/i)
  assert.match(inspectorText, /future Headless\/Core Kernel/i)
  assert.doesNotMatch(inspectorText, /execute without Render, UI, or browser/i)
})

test('inventory is the deterministic tested handoff for docs and site', () => {
  const inventory = step('publish-example-inventory')
  const contract = [
    ...inventory.conditions,
    ...inventory.bypasses,
    ...inventory.allowedContributors,
    ...inventory.forbiddenContributors
  ].join(' ')
  const terminalRoute = data.routes.find(
    (route) => route.id === 'consume-public-example-inventory'
  )
  const terminalArtifact = data.artifacts.find(
    (artifact) => artifact.id === 'artifact:public-example-inventory'
  )

  assert.match(contract, /deterministic/i)
  assert.match(contract, /source file.*public packages.*environment/is)
  assert.match(contract, /byte-identical to tested source regions/i)
  assert.match(contract, /may not fork the tested source/i)
  assert.match(contract, /hand-copied website snippets/i)
  assert.equal(terminalRoute.kind, 'terminal')
  assert.equal(terminalArtifact.terminal, true)
  assert.deepEqual(terminalArtifact.consumerStepIds, [])
})

test('every route and artifact resolves to one declared owner', () => {
  const stepIds = new Set(data.steps.map((item) => item.id))
  const artifactIds = new Set(data.artifacts.map((item) => item.id))

  assert.equal(stepIds.size, data.steps.length)
  assert.equal(artifactIds.size, data.artifacts.length)

  data.routes.forEach((route) => {
    assert.ok(stepIds.has(route.from), `Unknown route source: ${route.id}`)
    if (route.to) {
      assert.ok(stepIds.has(route.to), `Unknown route target: ${route.id}`)
    }
    route.producedArtifacts.forEach((artifactId) => {
      assert.ok(
        artifactIds.has(artifactId),
        `Unknown route artifact: ${artifactId}`
      )
    })
  })

  data.artifacts.forEach((artifact) => {
    assert.ok(stepIds.has(artifact.ownerStepId))
    artifact.consumerStepIds.forEach((consumerId) => {
      assert.ok(
        stepIds.has(consumerId),
        `Unknown artifact consumer: ${consumerId}`
      )
    })
  })
})

test('all steps are cache-free and retain explicit failure ownership', () => {
  data.steps.forEach((item) => {
    assert.deepEqual(item.cacheDimensions, [], item.id)
    assert.equal(item.failureOwnerStepId, item.id)
    assert.ok(item.implementationBoundary.length > 0, item.id)
    assert.ok(item.specRefs.length > 0, item.id)
  })
})
