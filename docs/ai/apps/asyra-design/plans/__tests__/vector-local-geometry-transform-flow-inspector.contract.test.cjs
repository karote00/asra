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

test('Vector Render Geometry Cache Inspector authorities resolve', () => {
  assert.equal(
    data.target.title,
    'Asyra Design Vector Render Geometry Cache Inspector'
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

test('Inspector exposes the four accepted owner steps', () => {
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
    'apply-vector-element-transform',
    'retain-vector-render-geometry',
    'project-vector-interaction',
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

  assert.ok(step('retain-vector-render-geometry').cacheDimensions.length > 0)
  data.steps
    .filter((item) => item.id !== 'retain-vector-render-geometry')
    .forEach((item) =>
      assert.deepEqual(item.cacheDimensions, [], `${item.id} cache owner`)
    )
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

test('persisted values remain unchanged and migration is forbidden', () => {
  const allText = JSON.stringify(data)

  assert.doesNotMatch(allText, /migrate-workspace-points-to-local/)
  assert.doesNotMatch(allText, /artifact:migrated-local-vector-document/)
  assert.match(allText, /adds no document migration/i)
  assert.match(allText, /does not require a new canonical local marker/i)
  assert.match(allText, /never stores Render cache state/i)
})

test('whole-element transform owner forbids point and handle patches', () => {
  const owner = step('apply-vector-element-transform')
  const text = [
    owner.purpose,
    ...owner.conditions,
    ...owner.forbiddenContributors
  ].join(' ')

  assert.match(text, /no point or handle record mutation/i)
  assert.match(text, /No point or handle record is set, replaced, removed/i)
  assert.match(text, /independent of Vector point count/i)
})

test('canvas drag settlement stages one complete Undo action', () => {
  const owner = step('settle-vector-action')
  const text = [
    owner.ownerPackage,
    owner.purpose,
    ...owner.conditions,
    ...owner.allowedContributors,
    ...owner.forbiddenContributors
  ].join(' ')

  assert.match(text, /exactly one Undo commit/i)
  assert.match(text, /first complete owner-issued before bundle/i)
  assert.match(text, /latest complete owner-issued after bundle/i)
  assert.match(text, /replaces only the latest staged History bundle reference/i)
  assert.match(text, /ordinary mutations.*append-only History/i)
  assert.match(text, /local-only/i)
  assert.match(text, /Final Group normalization.*same outer Undo commit/i)
  assert.match(text, /per-element pending-History merge/i)
})

test('Render owns one profiling-justified retained geometry projection', () => {
  const owner = step('retain-vector-render-geometry')
  const text = [
    owner.purpose,
    ...owner.conditions,
    ...owner.bypasses,
    ...owner.allowedContributors,
    ...owner.forbiddenContributors,
    ...owner.cacheDimensions
  ].join(' ')

  assert.match(text, /without executing the Vector geometry strategy/i)
  assert.match(text, /geometry.style miss derives engine-local draw geometry/i)
  assert.match(text, /complete-snapshot strategy once/i)
  assert.match(text, /Vector-specific delta classification/i)
  assert.match(text, /renderer instance lifecycle/i)
})

test('dense transform acceptance binds unchanged data and no strategy rebuild', () => {
  const contract = data.acceptanceContracts.find(
    (item) => item.id === 'dense-vector-transform-cost'
  )
  assert.ok(contract)
  const text = contract.assertions.join(' ')
  assert.match(text, /7,001-point Vector/i)
  assert.match(text, /complete checked-in crdt-7076 fixture/i)
  assert.match(text, /densest Vector/i)
  assert.match(text, /loads unchanged/i)
  assert.match(text, /zero Vector geometry strategies/i)
})
