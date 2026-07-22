const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('./network-collaboration-transport-flow-inspector.data.cjs')
const repoRoot = path.resolve(__dirname, '../../../..')

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

const anchorForHeading = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

const anchorsIn = (markdown) =>
  new Set(
    markdown
      .split('\n')
      .filter((line) => /^#{1,6}\s+/.test(line))
      .map((line) => anchorForHeading(line.replace(/^#{1,6}\s+/, '')))
  )

test('dedicated transport Inspector and product authorities resolve', () => {
  assert.equal(data.target.title, 'Network Collaboration Transport Inspector')
  assert.equal(
    data.authority.specPath,
    'docs/ai/framework/plans/network-collaboration-transport-plan.md'
  )
  assert.equal(
    data.authority.inspectorPath,
    'docs/ai/framework/plans/network-collaboration-transport-flow-inspector.data.cjs'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(
        __dirname,
        'network-collaboration-transport-flow-inspector.html'
      )
    )
  )
})

test('every step has exact execution fields and every route and artifact resolves', () => {
  const laneIds = new Set(data.lanes.map((item) => item.id))
  const stepIds = new Set(data.steps.map((item) => item.id))
  const artifactIds = new Set(data.artifacts.map((item) => item.id))
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

  assert.equal(laneIds.size, data.lanes.length, 'duplicate lane id')
  assert.equal(stepIds.size, data.steps.length, 'duplicate step id')
  assert.equal(artifactIds.size, data.artifacts.length, 'duplicate artifact id')
  assert.equal(
    new Set(data.routes.map((item) => item.id)).size,
    data.routes.length,
    'duplicate route id'
  )

  data.steps.forEach((item) => {
    requiredFields.forEach((field) =>
      assert.notEqual(item[field], undefined, `${item.id} missing ${field}`)
    )
    assert.ok(laneIds.has(item.laneId), `${item.id} lane`)
    assert.ok(stepIds.has(item.failureOwnerStepId), `${item.id} failure owner`)
    assert.deepEqual(item.cacheDimensions, [], `${item.id} unjustified cache`)
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
      assert.equal(artifact.ownerStepId, route.from, `${route.id} owner ${id}`)
      if (route.to) {
        assert.ok(
          artifact.consumerStepIds.includes(route.to),
          `${route.id} consumer ${id}`
        )
      }
    })
  })

  data.artifacts.forEach((artifact) => {
    assert.ok(step(artifact.ownerStepId).outputs.includes(artifact.id))
    artifact.consumerStepIds.forEach((consumerId) => {
      assert.ok(step(consumerId).inputs.includes(artifact.id))
    })
    if (!artifact.terminal) {
      assert.ok(artifact.consumerStepIds.length > 0, `${artifact.id} consumer`)
    }
  })

  data.invariants.forEach((invariant) => {
    invariant.stepIds.forEach((id) => assert.ok(stepIds.has(id), id))
    invariant.artifactIds.forEach((id) => assert.ok(artifactIds.has(id), id))
  })
  data.acceptanceContracts.forEach((contract) => {
    contract.stepIds.forEach((id) => assert.ok(stepIds.has(id), id))
  })
})

test('every implementation boundary resolves to an existing project target', () => {
  data.steps.forEach((item) => {
    item.implementationBoundary.forEach((boundary) => {
      const wildcardIndex = boundary.search(/[?*[{]/)
      const target = (
        wildcardIndex === -1 ? boundary : boundary.slice(0, wildcardIndex)
      ).replace(/\/$/, '')
      assert.ok(
        target && fs.existsSync(path.resolve(repoRoot, target)),
        `${item.id} missing implementation boundary ${boundary}`
      )
    })
  })
})

test('all local specification anchors resolve', () => {
  const markdown = fs.readFileSync(
    path.resolve(repoRoot, data.authority.specPath),
    'utf8'
  )
  const anchors = anchorsIn(markdown)
  ;[
    ...data.steps.flatMap((item) => item.specRefs),
    ...data.acceptanceContracts.flatMap((item) => item.specRefs)
  ].forEach((reference) => {
    assert.ok(reference.startsWith('#'), `external spec ref is not allowed: ${reference}`)
    assert.ok(anchors.has(reference.slice(1)), `missing anchor ${reference}`)
  })
})

test('framework transport has no semantic history or policy owner', () => {
  const handoff = contractText(step('handoff-local-publication'))
  const transport = contractText(step('transport-live-publication'))
  const inbound = contractText(step('deliver-inbound-publication'))

  assert.match(handoff, /retain no semantic history/i)
  assert.match(handoff, /Y\.Doc/i)
  assert.match(handoff, /dedupe.*permission.*conflict/i)
  assert.match(transport, /currently connected/i)
  assert.match(transport, /no later framework replay/i)
  assert.match(transport, /state vectors/i)
  assert.match(inbound, /once per inbound Provider publication/i)
  assert.match(inbound, /not split into per-delivery callbacks/i)
  assert.match(inbound, /framework dedupe, permission, ordering, or conflict/i)

  const forbiddenOwnerTerms = /operation registry|permission policy|conflict policy|Yjs/i
  ;[
    step('handoff-local-publication').ownerPackage,
    step('transport-live-publication').ownerPackage,
    step('deliver-inbound-publication').ownerPackage
  ].forEach((owner) => assert.doesNotMatch(owner, forbiddenOwnerTerms))
})

test('app owns semantic processing and one remote transaction', () => {
  const app = contractText(step('process-app-publication'))
  const canonical = contractText(step('apply-canonical-state-owner'))

  assert.match(app, /route, schema, payload, permission, conflict, and domain-order policy/i)
  assert.match(app, /all publication deliveries inside one app remote transaction/i)
  assert.match(app, /keeps remote work out of local undo.*echo/i)
  assert.match(canonical, /same canonical state owners as local changes/i)
  assert.match(canonical, /Factory remote origin suppresses local undo.*network echo/i)
})

test('reconnect is live-only and Awareness remains separate', () => {
  const lifecycle = contractText(step('own-collaboration-instance'))
  const awareness = contractText(step('own-awareness-state'))

  assert.match(lifecycle, /reconnect restores only the live Provider connection/i)
  assert.match(lifecycle, /does not request publication history/i)
  assert.match(awareness, /Disconnect, leave, and timeout clear remote presence/i)
  assert.match(awareness, /never authorizes or transports canonical document mutation/i)
  assert.match(awareness, /Factory SharedPublication/i)
})

test('acceptance contracts cover the bounded release-gate cases', () => {
  const text = data.acceptanceContracts
    .flatMap((contract) => [contract.title, ...contract.assertions])
    .join(' ')

  ;[
    /Disabled apps create no collaboration connection.*provider-less.*start, disconnect, reconnect/i,
    /one Provider send and one app callback.*delivery order.*undo, redo, and compensation/i,
    /no publication history, Y\.Doc, state vector, replay buffer, dedupe registry, permission registry, conflict registry, or TTL/i,
    /disconnected peer misses publications.*only future live publications.*no state-vector or history replay/i,
    /app owns route, payload, permission, domain ordering, and conflict decisions.*one remote transaction.*without local undo or echo/i,
    /Awareness update, leave, disconnect, timeout cleanup.*never transport canonical document changes/i
  ].forEach((pattern) => assert.match(text, pattern))
})
