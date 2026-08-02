const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../vector-local-geometry-transform-flow-inspector.data.cjs')
const repoRoot = path.resolve(__dirname, '../../../../../..')

const step = (id) => {
  const value = data.steps.find((item) => item.id === id)
  assert.ok(value, `Missing Inspector step: ${id}`)
  return value
}

const anchorForHeading = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

test('Vector Local Geometry Transform Inspector authorities resolve', () => {
  assert.equal(
    data.target.title,
    'Asyra Design Vector Local Geometry Transform Inspector'
  )
  assert.equal(
    data.authority.specPath,
    'docs/ai/apps/asyra-design/plans/vector-local-geometry-transform-plan.md'
  )
  assert.equal(
    data.authority.inspectorPath,
    'docs/ai/apps/asyra-design/plans/vector-local-geometry-transform-flow-inspector.data.cjs'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(
        __dirname,
        '../vector-local-geometry-transform-flow-inspector.html'
      )
    )
  )
  assert.ok(Object.isFrozen(data))
  assert.ok(data.steps.every(Object.isFrozen))
})

test('Inspector exposes the seven accepted owner steps', () => {
  const requiredFields = [
    'id',
    'order',
    'laneId',
    'title',
    'ownerPackage',
    'purpose',
    'inputs',
    'outputs',
    'conditions',
    'bypasses',
    'allowedContributors',
    'forbiddenContributors',
    'cacheDimensions',
    'implementationBoundary',
    'specRefs',
    'failureOwnerStepId'
  ]
  const requiredStepIds = [
    'migrate-workspace-points-to-local',
    'author-local-vector-geometry',
    'apply-vector-element-transform',
    'preserve-vector-hierarchy-transform',
    'project-local-vector-render',
    'project-vector-editing-interaction',
    'settle-vector-action'
  ]
  const laneIds = new Set(data.lanes.map((item) => item.id))
  const stepIds = new Set(requiredStepIds)

  assert.deepEqual(
    new Set(data.steps.map((item) => item.id)),
    new Set(requiredStepIds)
  )
  data.steps.forEach((item) => {
    assert.deepEqual(Object.keys(item), requiredFields)
    assert.ok(laneIds.has(item.laneId), `${item.id} lane`)
    assert.ok(stepIds.has(item.failureOwnerStepId), `${item.id} failure owner`)
    assert.deepEqual(item.cacheDimensions, [], `${item.id} unjustified cache`)
    ;[
      'inputs',
      'outputs',
      'conditions',
      'bypasses',
      'allowedContributors',
      'forbiddenContributors',
      'implementationBoundary',
      'specRefs'
    ].forEach((field) => {
      assert.ok(item[field].length > 0, `${item.id} empty ${field}`)
    })
  })
})

test('every route and artifact has one resolvable owner-consumer handoff', () => {
  const stepIds = new Set(data.steps.map((item) => item.id))
  const artifactIds = new Set(data.artifacts.map((item) => item.id))

  assert.equal(artifactIds.size, data.artifacts.length)
  assert.equal(
    new Set(data.routes.map((item) => item.id)).size,
    data.routes.length
  )

  data.steps.forEach((item) => {
    item.inputs
      .filter((input) => input.startsWith('artifact:'))
      .forEach((id) => assert.ok(artifactIds.has(id), `${item.id} input ${id}`))
    item.outputs.forEach((id) =>
      assert.ok(artifactIds.has(id), `${item.id} output ${id}`)
    )
  })

  data.routes.forEach((route) => {
    assert.ok(stepIds.has(route.from), `${route.id} from`)
    if (route.to) assert.ok(stepIds.has(route.to), `${route.id} to`)
    route.producedArtifacts.forEach((id) => {
      const artifact = data.artifacts.find((item) => item.id === id)
      assert.ok(artifact, `${route.id} artifact ${id}`)
      assert.equal(artifact.ownerStepId, route.from, `${route.id} owner`)
      if (route.to) {
        assert.ok(artifact.consumerStepIds.includes(route.to), route.id)
      }
    })
  })

  data.artifacts.forEach((artifact) => {
    assert.ok(stepIds.has(artifact.ownerStepId), artifact.id)
    assert.ok(step(artifact.ownerStepId).outputs.includes(artifact.id))
    assert.equal(artifact.terminal, artifact.consumerStepIds.length === 0)
    artifact.consumerStepIds.forEach((consumerId) => {
      assert.ok(stepIds.has(consumerId), `${artifact.id} ${consumerId}`)
      assert.ok(step(consumerId).inputs.includes(artifact.id))
      assert.ok(
        data.routes.some(
          (route) =>
            route.from === artifact.ownerStepId &&
            route.to === consumerId &&
            route.producedArtifacts.includes(artifact.id)
        ),
        `${artifact.id} missing route to ${consumerId}`
      )
    })
  })
})

test('implementation boundaries and specification anchors resolve', () => {
  data.steps.forEach((item) => {
    item.implementationBoundary.forEach((boundary) => {
      assert.ok(
        fs.existsSync(path.resolve(repoRoot, boundary)),
        `${item.id} missing boundary ${boundary}`
      )
    })
  })

  const markdown = fs.readFileSync(
    path.resolve(repoRoot, data.authority.specPath),
    'utf8'
  )
  const anchors = new Set(
    markdown
      .split('\n')
      .filter((line) => /^#{1,6}\s+/.test(line))
      .map((line) => anchorForHeading(line.replace(/^#{1,6}\s+/, '')))
  )

  ;[
    ...data.steps.flatMap((item) => item.specRefs),
    ...data.invariants.flatMap((item) => item.specRefs),
    ...data.acceptanceContracts.flatMap((item) => item.specRefs)
  ].forEach((reference) => {
    assert.match(reference, /^#[a-z0-9-]+$/)
    assert.ok(anchors.has(reference.slice(1)), `missing anchor ${reference}`)
  })
})

test('whole-element and hierarchy transform owners forbid point patches', () => {
  ;[
    'apply-vector-element-transform',
    'preserve-vector-hierarchy-transform',
    'settle-vector-action'
  ].forEach((stepId) => {
    const text = [
      step(stepId).purpose,
      ...step(stepId).conditions,
      ...step(stepId).forbiddenContributors
    ].join(' ')
    assert.match(text, /point|control/i)
    assert.match(text, /never|no |forbid|unchanged|contains no/i)
  })
})

test('Render projection is generic and geometry strategy is bypassed only for transform deltas', () => {
  const owner = step('project-local-vector-render')
  const text = [
    owner.purpose,
    ...owner.conditions,
    ...owner.allowedContributors,
    ...owner.forbiddenContributors
  ].join(' ')

  assert.match(text, /generic transform-only property capability/i)
  assert.match(text, /without executing Vector geometry strategy/i)
  assert.match(text, /Vector-specific delta classification/i)
  assert.match(text, /Pixi imports outside/i)
})

test('migration is app-owned, atomic, and leaves no workspace runtime fallback', () => {
  const owner = step('migrate-workspace-points-to-local')
  const text = [
    owner.ownerPackage,
    owner.purpose,
    ...owner.conditions,
    ...owner.forbiddenContributors
  ].join(' ')

  assert.match(text, /Asyra Design app migration/i)
  assert.match(text, /before package validation and canonical apply/i)
  assert.match(text, /applies no canonical prefix/i)
  assert.match(text, /workspace-coordinate runtime fallback/i)
})

test('dense transform acceptance binds point-free mutation and no strategy rebuild', () => {
  const contract = data.acceptanceContracts.find(
    (item) => item.id === 'dense-vector-transform-cost'
  )
  assert.ok(contract)
  const text = contract.assertions.join(' ')
  assert.match(text, /7,000\+ point Vector/i)
  assert.match(text, /zero point record patches/i)
  assert.match(text, /zero Vector geometry strategies/i)
})
