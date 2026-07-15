const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('./render-engine-boundary-flow-inspector.data.cjs')

const step = (id) => {
  const value = data.steps.find((item) => item.id === id)
  assert.ok(value, `Missing Inspector step: ${id}`)
  return value
}

const route = (id) => {
  const value = data.routes.find((item) => item.id === id)
  assert.ok(value, `Missing Inspector route: ${id}`)
  return value
}

test('active render-engine plan remains the resolvable product authority', () => {
  const repoRoot = path.resolve(__dirname, '../../../..')

  assert.equal(
    data.authority.specPath,
    'docs/ai/framework/plans/render-engine-boundary-plan.md'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
})

test('preset selects the default engine without becoming its runtime owner', () => {
  const selection = step('select-render-engine')
  const contract = [...selection.conditions, ...selection.bypasses].join(' ')

  assert.equal(selection.ownerPackage, '@asyra/preset')
  assert.match(contract, /Pixi/i)
  assert.match(contract, /custom engine factory/i)
  assert.match(contract, /does not own the engine runtime/i)
})

test('render consumes only the abstract engine contract', () => {
  const adapter = step('orchestrate-render-adapter')
  const contract = [
    ...adapter.conditions,
    ...adapter.forbiddenContributors,
    ...adapter.implementationBoundary
  ].join(' ')

  assert.equal(adapter.ownerPackage, '@asyra/render')
  assert.match(contract, /@asyra\/render-engine/)
  assert.match(contract, /Pixi/i)
  assert.equal(adapter.cacheDimensions.length, 0)
})

test('the abstract contract has its own package owner and shared artifact', () => {
  const contractOwner = step('define-render-engine-contract')
  const contractArtifact = data.artifacts.find(
    (item) => item.id === 'artifact:render-engine-contract'
  )

  assert.equal(contractOwner.ownerPackage, '@asyra/render-engine')
  assert.deepEqual(contractOwner.cacheDimensions, [])
  assert.ok(contractOwner.implementationBoundary.includes('yarn.lock'))
  assert.ok(contractOwner.implementationBoundary.includes('turbo.json'))
  assert.ok(contractArtifact)
  assert.equal(contractArtifact.ownerStepId, contractOwner.id)
  assert.deepEqual(contractArtifact.consumerStepIds, [
    'orchestrate-render-adapter',
    'execute-render-engine',
    'execute-custom-render-engine'
  ])
})

test('concrete execution owns Pixi resources without importing render', () => {
  const engine = step('execute-render-engine')
  const contract = [...engine.conditions, ...engine.forbiddenContributors].join(
    ' '
  )

  assert.equal(engine.ownerPackage, '@asyra/render-engine-pixi')
  assert.match(contract, /opaque handles/i)
  assert.match(contract, /must not import @asyra\/render/i)
})

test('custom engines use the same command and interaction routes', () => {
  const customSelection = route('use-custom-engine')
  const stateRoute = route('project-state-to-engine')
  const interactionRoute = route('return-normalized-interaction')

  assert.equal(customSelection.to, 'orchestrate-render-adapter')
  assert.equal(stateRoute.to, 'execute-render-engine')
  assert.equal(interactionRoute.to, 'bridge-render-interaction')
})

test('ready publication is owned by core and cannot bypass engine success', () => {
  const ready = step('publish-render-ready')
  const contract = [...ready.conditions, ...ready.bypasses].join(' ')

  assert.equal(ready.ownerPackage, '@asyra/core')
  assert.match(contract, /successful engine initialization/i)
  assert.match(contract, /failure/i)
  assert.match(contract, /does not publish/i)
})

test('interaction returns through render before feature execution', () => {
  const bridge = step('bridge-render-interaction')
  const contract = [...bridge.conditions, ...bridge.forbiddenContributors].join(
    ' '
  )

  assert.equal(bridge.ownerPackage, '@asyra/render')
  assert.match(contract, /opaque engine handle/i)
  assert.match(contract, /framework interaction target/i)
  assert.match(contract, /must not execute product features/i)
})

test('cleanup is deterministic and owned resources cannot survive destroy', () => {
  const cleanup = step('destroy-render-runtime')
  const contract = [...cleanup.conditions, ...cleanup.bypasses].join(' ')

  assert.match(contract, /owned resources/i)
  assert.match(contract, /interaction subscriptions/i)
  assert.match(contract, /partial initialization/i)
})

test('the contract does not expose production 3D or hybrid behavior', () => {
  const source = fs.readFileSync(__filename, 'utf8')
  const publicIdentifiers = [
    ...data.steps.flatMap((item) => [item.id, ...item.outputs]),
    ...data.routes.map((item) => item.id),
    ...data.artifacts.map((item) => item.id)
  ].join(' ')

  assert.doesNotMatch(publicIdentifiers, /3d|hybrid|render-mode/i)
  assert.match(source, /does not expose production 3D or hybrid behavior/)
})
