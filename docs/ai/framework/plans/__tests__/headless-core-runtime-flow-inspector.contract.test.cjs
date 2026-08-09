const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../headless-core-runtime-flow-inspector.data.cjs')
const repoRoot = path.resolve(__dirname, '../../../../..')
const spec = fs.readFileSync(
  path.resolve(repoRoot, data.authority.specPath),
  'utf8'
)
const step = (id) => {
  const value = data.steps.find((item) => item.id === id)
  assert.ok(value, `Missing Inspector step: ${id}`)
  return value
}
const contractText = (owner) =>
  [
    owner.purpose,
    ...owner.inputs,
    ...owner.outputs,
    ...owner.conditions,
    ...owner.bypasses,
    ...owner.allowedContributors,
    ...owner.forbiddenContributors,
    ...owner.implementationBoundary
  ].join(' ')

test('plan and direct-open Inspector are resolvable authorities', () => {
  assert.equal(
    data.authority.specPath,
    'docs/ai/framework/plans/headless-core-runtime-plan.md'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(
        repoRoot,
        'docs/ai/framework/plans/headless-core-runtime-flow-inspector.html'
      )
    )
  )
  data.links.forEach((link) =>
    assert.ok(fs.existsSync(path.resolve(__dirname, '..', link.href)))
  )
})

test('Input construction is environment-neutral and browser activation is explicit', () => {
  const construction = contractText(step('construct-input-system'))
  const attachment = contractText(step('attach-browser-host'))
  assert.match(
    construction,
    /without reading browser globals or attaching listeners/i
  )
  assert.match(construction, /window and document do not exist/i)
  assert.match(construction, /constructor addEventListener/i)
  assert.match(construction, /DOM shim, jsdom fallback/i)
  assert.match(attachment, /keyboard ownership to one Window/i)
  assert.match(attachment, /pointer\/wheel ownership to one selected target/i)
  assert.match(attachment, /idempotent/i)
  assert.match(attachment, /removes exact old listeners/i)
  assert.match(attachment, /detachBrowserHost and dispose/i)
  assert.match(attachment, /reset preserves the active browser attachment/i)
})

test('headless factory owns fresh composition without overstating isolation', () => {
  const contract = contractText(step('compose-headless-core'))
  assert.match(contract, /public subpath imports in Node/i)
  assert.match(
    contract,
    /fresh Factory, Props, Scene Tree, Selection, System Context, Input, Render, and observer owners/i
  )
  assert.match(
    contract,
    /System property APIs use the composed System Context owner/i
  )
  assert.match(
    contract,
    /installs no Preset, app domain, provider, or UI default/i
  )
  assert.match(
    contract,
    /Process-wide definition registries are not represented as multi-tenant isolation/i
  )
  assert.match(
    spec,
    /does not claim that `@asyra\/core`'s npm dependency graph excludes/i
  )
})

test('explicit headless startup bypasses visual activation but keeps runtime phases', () => {
  const contract = contractText(step('start-headless-core'))
  assert.match(contract, /startHeadless accepts no DOM or render options/i)
  assert.match(
    contract,
    /Composition closes permanently before runtime effects/i
  )
  assert.match(
    contract,
    /provider or advanced renderer fails as a startup-mode conflict/i
  )
  assert.match(
    contract,
    /Renderer init, canvas append, and browser input attachment are bypassed/i
  )
  assert.match(
    contract,
    /Observers, load, Feature System without input binding, collaboration activation, and readiness/i
  )
  assert.match(contract, /Repeated or cross-mode startup fails/i)
  assert.match(contract, /provider-error fallback or environment shim/i)
})

test('visual startup preserves the composed input owner and strict errors', () => {
  const contract = contractText(step('start-visual-core'))
  assert.match(contract, /activates the exact composed InputSystem/i)
  assert.match(contract, /missing-provider normalization remains compatible/i)
  assert.match(
    contract,
    /provider, engine, capability, and advanced renderer failures remain strict/i
  )
  assert.match(
    contract,
    /default InputSystem singleton when a custom instance is composed/i
  )
  assert.match(contract, /Preset or Design System semantic changes/i)
})

test('release contract requires truthful docs and direct owner acceptance', () => {
  const docs = contractText(step('publish-headless-contract'))
  const acceptance = contractText(step('accept-headless-runtime'))
  assert.match(
    docs,
    /distinguish no activation from no npm package dependency/i
  )
  assert.match(
    docs,
    /scoped patch Changesets include every changed public Framework package/i
  )
  assert.match(
    docs,
    /website umbrella makes this child a foundation prerequisite/i
  )
  assert.match(acceptance, /personally exercises the architecture/i)
  assert.match(acceptance, /explicitly approves merge/i)
  assert.match(acceptance, /There is no automated or agent-owned bypass/i)
  assert.match(acceptance, /automatic merge after CI/i)
})

test('Inspector enumerates all product cases and definition-of-done owners', () => {
  const caseIds = new Set(data.productCases.map((item) => item.id))
  const dodIds = new Set(data.definitionOfDone.map((item) => item.id))
  ;[
    'node-imports',
    'inert-input-construction',
    'explicit-browser-attachment',
    'browser-switch-cleanup',
    'fresh-headless-composition',
    'headless-information-model',
    'startup-conflicts',
    'visual-compatibility'
  ].forEach((id) => assert.ok(caseIds.has(id), `Missing product case: ${id}`))
  ;[
    'dom-safe-public-imports',
    'exact-input-lifecycle',
    'explicit-headless-runtime',
    'visual-compatibility',
    'truthful-contracts',
    'owner-acceptance'
  ].forEach((id) => assert.ok(dodIds.has(id), `Missing DoD item: ${id}`))
})

test('every owner, route, and artifact resolves and the contract is frozen', () => {
  const laneIds = new Set(data.lanes.map((item) => item.id))
  const stepIds = new Set(data.steps.map((item) => item.id))
  const artifactIds = new Set(data.artifacts.map((item) => item.id))
  data.steps.forEach((item) => {
    assert.ok(laneIds.has(item.laneId), `Unknown lane: ${item.id}`)
    assert.ok(item.ownerPackage, `Missing owner: ${item.id}`)
    ;[
      'inputs',
      'outputs',
      'conditions',
      'bypasses',
      'allowedContributors',
      'forbiddenContributors',
      'implementationBoundary',
      'specRefs'
    ].forEach((field) =>
      assert.ok(item[field].length > 0, `Missing ${field}: ${item.id}`)
    )
    assert.ok(
      stepIds.has(item.failureOwnerStepId),
      `Unknown failure owner: ${item.id}`
    )
    assert.ok(
      stepIds.has(item.cleanupOwnerStepId),
      `Unknown cleanup owner: ${item.id}`
    )
  })
  data.routes.forEach((item) => {
    assert.ok(stepIds.has(item.from), `Unknown route source: ${item.id}`)
    assert.ok(stepIds.has(item.to), `Unknown route destination: ${item.id}`)
    item.producedArtifacts.forEach((artifactId) =>
      assert.ok(
        artifactIds.has(artifactId),
        `Unknown route artifact: ${artifactId}`
      )
    )
  })
  data.artifacts.forEach((item) => {
    assert.ok(
      stepIds.has(item.ownerStepId),
      `Unknown artifact owner: ${item.id}`
    )
    item.consumerStepIds.forEach((consumerId) =>
      assert.ok(
        stepIds.has(consumerId),
        `Unknown artifact consumer: ${item.id} -> ${consumerId}`
      )
    )
  })
  assert.ok(Object.isFrozen(data))
  assert.ok(Object.isFrozen(data.steps))
  assert.ok(Object.isFrozen(data.steps[0]))
})
