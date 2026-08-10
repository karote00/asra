const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../asyra-website-visual-reimagine-flow-inspector.data.cjs')

const repoRoot = path.resolve(__dirname, '../../../../..')
const step = (id) => {
  const value = data.steps.find((item) => item.id === id)
  assert.ok(value, `Missing Visual Reimagine Inspector step: ${id}`)
  return value
}

test('visual authority freezes three directions and the exact view-state set', () => {
  assert.ok(fs.existsSync(path.join(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.join(repoRoot, data.authority.inspectorPath)))
  assert.deepEqual(data.directionIds, [
    'topology-observatory',
    'material-blueprint',
    'signal-ledger'
  ])
  assert.equal(data.viewStateIds.length, 14)
  assert.equal(new Set(data.viewStateIds).size, 14)
  assert.equal(data.conceptPaths.length, 8)
  assert.equal(new Set(data.conceptPaths).size, 8)
})

test('visual brief preserves product, asset, and acceptance boundaries', () => {
  const source = JSON.stringify([step('freeze-visual-brief'), data.invariants])
  assert.match(
    source,
    /Current runtime, optional composition, app-owned domains, and future work/i
  )
  assert.match(source, /No external asset, font, dependency/i)
  assert.match(source, /generic documentation templates/i)
  assert.match(source, /final integrated-goal acceptance/i)
})

test('concept generation keeps images as inspected evidence', () => {
  const source = JSON.stringify(step('generate-concept-directions'))
  assert.match(source, /three coherent, original full-page directions/i)
  assert.match(source, /useful-scale PNG inspected/i)
  assert.match(source, /generated words as verified product copy/i)
  assert.match(source, /website source code or production assets/i)
})

test('selection owns responsive, Atlas, failure, and reduced-motion states', () => {
  const source = JSON.stringify([
    step('select-and-refine-direction'),
    data.acceptanceContracts
  ])
  assert.match(source, /All fourteen required view states/i)
  assert.match(
    source,
    /Long-form reading, focus visibility, touch targets, failure state/i
  )
  assert.match(source, /reduced-motion equivalence/i)
  assert.match(
    source,
    /Desktop, mobile, reading, navigation, active, failure, case, roadmap, and motion/i
  )
})

test('handoff owns semantic tokens without becoming website implementation', () => {
  const source = JSON.stringify(step('annotate-visual-handoff'))
  assert.match(source, /semantic tokens without authoring website components/i)
  assert.match(source, /Generated imagery remains evidence/i)
  assert.match(source, /component implementation/i)
  assert.match(source, /new product claims/i)
})

test('verification fails closed on incomplete or implementation-dependent evidence', () => {
  const source = JSON.stringify(step('verify-visual-handoff'))
  assert.match(source, /manifest, eight PNG boards, handoff, Inspector/i)
  assert.match(source, /Every image is inspected/i)
  assert.match(source, /thumbnail-only review/i)
  assert.match(source, /No site source, package behavior, or external asset/i)
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
