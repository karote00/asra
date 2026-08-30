const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../socket-authoritative-document-persistence-flow-inspector.data.cjs')
const repoRoot = path.resolve(__dirname, '../../../..')

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

test('socket-authoritative Inspector authorities resolve and stay immutable', () => {
  assert.equal(
    data.target.id,
    'asyra-design-socket-authoritative-document-persistence'
  )
  assert.equal(
    data.authority.specPath,
    'docs/ai/apps/asyra-design/specs/socket-authoritative-document-session.md'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(Object.isFrozen(data))
  assert.ok(data.steps.every(Object.isFrozen))
})

test('every owner step, route, and artifact resolves exactly', () => {
  const laneIds = new Set(data.lanes.map(({ id }) => id))
  const stepIds = new Set(data.steps.map(({ id }) => id))
  const artifacts = new Map(
    data.artifacts.map((artifact) => [artifact.id, artifact])
  )
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

  assert.equal(laneIds.size, data.lanes.length)
  assert.equal(stepIds.size, data.steps.length)
  assert.equal(artifacts.size, data.artifacts.length)
  assert.equal(
    new Set(data.routes.map(({ id }) => id)).size,
    data.routes.length
  )

  data.steps.forEach((owner) => {
    requiredFields.forEach((field) =>
      assert.notEqual(owner[field], undefined, `${owner.id} missing ${field}`)
    )
    assert.ok(laneIds.has(owner.laneId), `${owner.id} lane`)
    assert.ok(
      stepIds.has(owner.failureOwnerStepId),
      `${owner.id} failure owner`
    )
    assert.deepEqual(owner.cacheDimensions, [], `${owner.id} cache`)
    owner.inputs
      .filter((input) => input.startsWith('artifact:'))
      .forEach((artifactId) =>
        assert.ok(artifacts.has(artifactId), `${owner.id} input ${artifactId}`)
      )
    owner.outputs.forEach((artifactId) =>
      assert.ok(artifacts.has(artifactId), `${owner.id} output ${artifactId}`)
    )
  })

  data.routes.forEach((route) => {
    assert.ok(stepIds.has(route.from), `${route.id} source`)
    if (route.to) assert.ok(stepIds.has(route.to), `${route.id} target`)
    route.producedArtifacts.forEach((artifactId) => {
      const artifact = artifacts.get(artifactId)
      assert.ok(artifact, `${route.id} artifact ${artifactId}`)
      assert.equal(artifact.ownerStepId, route.from, `${route.id} owner`)
      if (route.to) {
        assert.ok(
          artifact.consumerStepIds.includes(route.to),
          `${route.id} consumer`
        )
      }
    })
  })

  data.artifacts.forEach((artifact) => {
    assert.ok(step(artifact.ownerStepId).outputs.includes(artifact.id))
    assert.equal(
      artifact.terminal,
      artifact.consumerStepIds.length === 0,
      `${artifact.id} terminal classification`
    )
    artifact.consumerStepIds.forEach((consumerId) =>
      assert.ok(step(consumerId).inputs.includes(artifact.id))
    )
  })
})

test('implementation boundaries and product-spec anchors resolve', () => {
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

  data.steps.forEach((owner) => {
    owner.implementationBoundary.forEach((boundary) => {
      const wildcardIndex = boundary.search(/[?*[{]/)
      const target = (
        wildcardIndex === -1 ? boundary : boundary.slice(0, wildcardIndex)
      ).replace(/\/$/, '')
      assert.ok(
        target && fs.existsSync(path.resolve(repoRoot, target)),
        `${owner.id} missing boundary ${boundary}`
      )
    })
  })
  ;[
    ...data.steps.flatMap((owner) => owner.specRefs),
    ...data.invariants.flatMap((invariant) => invariant.specRefs),
    ...data.acceptanceContracts.flatMap((contract) => contract.specRefs)
  ].forEach((reference) => {
    assert.ok(reference.startsWith('#'), `External spec ref: ${reference}`)
    assert.ok(anchors.has(reference.slice(1)), `Missing anchor ${reference}`)
  })
})

test('the exact persistence owner chain remains explicit', () => {
  assert.equal(step('hydrate-core-checkpoint').ownerPackage, '@asyra/core')
  assert.equal(step('settle-local-publication').ownerPackage, '@asyra/factory')
  assert.equal(
    step('recover-pending-publications').ownerPackage,
    'Asyra Design collaboration lifecycle and outbox'
  )
  assert.equal(
    step('sequence-live-publication').ownerPackage,
    'Asyra Design socket server'
  )
  assert.equal(
    step('flush-persistence-window').ownerPackage,
    'Asyra Design socket server'
  )
  assert.equal(
    step('reset-document-session').ownerPackage,
    'Asyra Design socket server'
  )
  assert.equal(
    step('materialize-backend-document').ownerPackage,
    'Asyra Design App backend'
  )
  assert.ok(
    step('open-document-session').outputs.includes(
      'artifact:bootstrap-document-generation'
    )
  )
  assert.ok(
    step('recover-pending-publications').inputs.includes(
      'artifact:bootstrap-document-generation'
    )
  )
  assert.ok(
    data.routes.some(
      (route) =>
        route.from === 'open-document-session' &&
        route.to === 'recover-pending-publications' &&
        route.producedArtifacts.includes(
          'artifact:bootstrap-document-generation'
        )
    )
  )
  assert.ok(
    !step('apply-bootstrap-tail').outputs.includes(
      'artifact:bootstrap-document-generation'
    )
  )
})

test('toolbar Reset stays one socket-owned document barrier', () => {
  const reset = step('reset-document-session')
  const contract = data.acceptanceContracts.find(
    ({ id }) => id === 'document-reset-barrier-contract'
  )

  assert.ok(contract)
  assert.ok(reset.outputs.includes('artifact:reset-document-checkpoint'))
  assert.ok(reset.outputs.includes('artifact:reset-document-generation'))
  assert.ok(reset.outputs.includes('artifact:document-reset-failure'))
  assert.ok(
    reset.forbiddenContributors.includes(
      'browser direct document-backend request'
    )
  )
  assert.deepEqual(contract.stepIds, [
    'reset-document-session',
    'open-document-session'
  ])
})
