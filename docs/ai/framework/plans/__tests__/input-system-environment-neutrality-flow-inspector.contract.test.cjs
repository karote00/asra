const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../input-system-environment-neutrality-flow-inspector.data.cjs')
const repoRoot = path.resolve(__dirname, '../../../../..')
const spec = fs.readFileSync(path.resolve(repoRoot, data.authority.specPath), 'utf8')
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
    'docs/ai/framework/plans/completed/input-system-environment-neutrality-plan.md'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(
        repoRoot,
        'docs/ai/framework/plans/input-system-environment-neutrality-flow-inspector.html'
      )
    )
  )
  data.links.forEach((link) =>
    assert.ok(fs.existsSync(path.resolve(__dirname, '..', link.href)))
  )
})

test('construction is DOM-neutral and browser activation is explicit', () => {
  const construction = contractText(step('construct-input-system'))
  const attachment = contractText(step('attach-browser-host'))
  assert.match(construction, /without reading browser globals/i)
  assert.match(construction, /window and document do not exist/i)
  assert.match(construction, /zero keyboard, pointer, or wheel listeners/i)
  assert.match(construction, /DOM shim, swallowed ReferenceError/i)
  assert.match(attachment, /keyboard ownership to one Window/i)
  assert.match(attachment, /pointer\/wheel ownership to one selected target/i)
  assert.match(attachment, /idempotent/i)
  assert.match(attachment, /removes exact old listeners/i)
  assert.match(attachment, /detachBrowserHost and dispose/i)
  assert.match(attachment, /reset preserves the active attachment/i)
})

test('visual compatibility preserves the event boundary and excludes Headless Core', () => {
  const integration = contractText(step('preserve-visual-integration'))
  assert.match(integration, /typed watched-element event route/i)
  assert.match(integration, /default Input System activates against the rendered canvas/i)
  assert.match(integration, /keyboard, pointer, wheel, canvas, and Feature paths remain/i)
  assert.match(integration, /direct cross-package Core-to-Input owner call/i)
  assert.match(integration, /No public Headless Core or Core Kernel behavior/i)
  assert.match(spec, /does not add a Headless Core runtime/i)
})

test('release acceptance requires truthful future references and continuous authorized execution', () => {
  const acceptance = contractText(step('accept-input-release-child'))
  assert.match(acceptance, /Node-safe import from future Headless\/Core Kernel support/i)
  assert.match(acceptance, /future plan cites the retained architecture research report/i)
  assert.match(acceptance, /all required automated and PR checks pass for the current head/i)
  assert.match(acceptance, /no intermediate product-owner checkpoint/i)
  assert.match(acceptance, /No failed or pending required check may be bypassed/i)
  assert.match(acceptance, /pausing for intermediate manual approval/i)
})

test('Inspector enumerates bounded product cases and definition of done', () => {
  const caseIds = new Set(data.productCases.map((item) => item.id))
  const dodIds = new Set(data.definitionOfDone.map((item) => item.id))
  ;[
    'node-imports',
    'inert-construction',
    'exact-attachment',
    'switch-cleanup',
    'visual-compatibility'
  ].forEach((id) => assert.ok(caseIds.has(id), `Missing product case: ${id}`))
  ;[
    'dom-safe-imports',
    'exact-lifecycle',
    'truthful-contracts',
    'continuous-acceptance'
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
    ].forEach((field) => assert.ok(item[field].length > 0, `Missing ${field}: ${item.id}`))
    assert.ok(stepIds.has(item.failureOwnerStepId), `Unknown failure owner: ${item.id}`)
    assert.ok(stepIds.has(item.cleanupOwnerStepId), `Unknown cleanup owner: ${item.id}`)
  })
  data.routes.forEach((item) => {
    assert.ok(stepIds.has(item.from), `Unknown route source: ${item.id}`)
    assert.ok(stepIds.has(item.to), `Unknown route destination: ${item.id}`)
    item.producedArtifacts.forEach((artifactId) =>
      assert.ok(artifactIds.has(artifactId), `Unknown route artifact: ${artifactId}`)
    )
  })
  data.artifacts.forEach((item) => {
    assert.ok(stepIds.has(item.ownerStepId), `Unknown artifact owner: ${item.id}`)
    item.consumerStepIds.forEach((consumerId) =>
      assert.ok(stepIds.has(consumerId), `Unknown artifact consumer: ${item.id} -> ${consumerId}`)
    )
  })
  assert.ok(Object.isFrozen(data))
  assert.ok(Object.isFrozen(data.steps))
  assert.ok(Object.isFrozen(data.steps[0]))
})
