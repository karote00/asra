const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../remote-subtree-restore-snapshot-flow-inspector.data.cjs')
const repoRoot = path.resolve(__dirname, '../../../../../..')

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

test('Remote Restore Inspector and product authorities resolve', () => {
  assert.equal(data.target.title, 'Remote Subtree Restore Snapshot Inspector')
  assert.equal(
    data.authority.specPath,
    'docs/ai/apps/asyra-design/plans/remote-subtree-restore-snapshot-plan.md'
  )
  assert.equal(
    data.authority.inspectorPath,
    'docs/ai/apps/asyra-design/plans/remote-subtree-restore-snapshot-flow-inspector.data.cjs'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(
        __dirname,
        '..',
        'remote-subtree-restore-snapshot-flow-inspector.html'
      )
    )
  )
  assert.ok(Object.isFrozen(data))
  assert.ok(data.steps.every(Object.isFrozen))
})

test('every owner step has exact readiness fields and a product-case/DoD contract', () => {
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
  const laneIds = new Set(data.lanes.map((item) => item.id))
  const stepIds = new Set(data.steps.map((item) => item.id))
  const acceptedStepIds = new Set(
    data.acceptanceContracts.flatMap((contract) => contract.stepIds)
  )

  assert.equal(laneIds.size, data.lanes.length, 'duplicate lane id')
  assert.equal(stepIds.size, data.steps.length, 'duplicate step id')
  data.steps.forEach((item) => {
    requiredFields.forEach((field) =>
      assert.notEqual(item[field], undefined, `${item.id} missing ${field}`)
    )
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
    assert.ok(acceptedStepIds.has(item.id), `${item.id} lacks product case/DoD`)
  })
})

test('every route, artifact, invariant, and acceptance contract resolves', () => {
  const stepIds = new Set(data.steps.map((item) => item.id))
  const artifactIds = new Set(data.artifacts.map((item) => item.id))

  assert.equal(artifactIds.size, data.artifacts.length, 'duplicate artifact id')
  assert.equal(
    new Set(data.routes.map((item) => item.id)).size,
    data.routes.length,
    'duplicate route id'
  )
  assert.equal(
    new Set(data.invariants.map((item) => item.id)).size,
    data.invariants.length,
    'duplicate invariant id'
  )
  assert.equal(
    new Set(data.acceptanceContracts.map((item) => item.id)).size,
    data.acceptanceContracts.length,
    'duplicate acceptance id'
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
    assert.equal(typeof artifact.channel, 'string', `${artifact.id} channel`)
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
})

test('every implementation boundary resolves to an existing project target', () => {
  data.steps.forEach((item) => {
    item.implementationBoundary.forEach((boundary) => {
      assert.ok(
        fs.existsSync(path.resolve(repoRoot, boundary)),
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
    assert.ok(reference.startsWith('#'), `external spec ref: ${reference}`)
    assert.ok(anchors.has(reference.slice(1)), `missing anchor ${reference}`)
  })
})

test('delete evidence and local undo preserve one detached owner-partitioned publication', () => {
  const scene = contractText(step('capture-scene-tree-delete-evidence'))
  const props = contractText(step('capture-props-delete-evidence'))
  const factory = contractText(step('publish-local-restore-snapshot'))

  assert.match(scene, /detached.*subtree/i)
  assert.match(
    scene,
    /stable ids.*parent.*root sibling index.*child order.*raw/i
  )
  assert.match(scene, /post-delete root-parent order evidence/i)
  assert.match(props, /exact property-component data.*owner relation/i)
  assert.match(props, /later caller or runtime mutation/i)
  assert.match(factory, /one intended transaction.*one SharedPublication/i)
  assert.match(
    factory,
    /Props ADD_PROPERTY.*Scene Tree CHANGE_SUBTREE.*RESTORE_SUBTREE/i
  )
  assert.match(factory, /does not reconstruct evidence at undo time/i)
})

test('Collaboration remains opaque transport-only and Core remains a narrow facade', () => {
  const transport = contractText(step('transport-restore-publication'))
  const core = contractText(step('expose-instance-safe-owner-facades'))

  assert.equal(
    step('transport-restore-publication').ownerPackage,
    '@asyra/collaboration'
  )
  assert.match(transport, /opaque completed SharedPublication/i)
  assert.match(transport, /unchanged.*order.*metadata.*repeated/i)
  assert.match(
    transport,
    /restore classifier.*tombstone.*semantic history.*dedupe.*LWW.*timestamp.*conflict.*convergence/i
  )
  assert.match(core, /instance-safe.*Scene Tree.*Props/i)
  assert.match(core, /no restore policy.*snapshot semantic/i)
  assert.match(core, /does not restrict core\.load/i)
})

test('App classifies the complete restore and owns strict accept/reject policy', () => {
  const app = contractText(step('classify-and-authorize-remote-restore'))

  assert.match(app, /exactly one typed.*CHANGE_SUBTREE.*RESTORE_SUBTREE/i)
  assert.match(app, /complete publication before the first canonical mutation/i)
  assert.match(app, /permission.*domain ordering.*duplicate.*stale.*conflict/i)
  assert.match(app, /mixed or malformed.*whole publication/i)
  assert.match(app, /does not repair, reorder, merge, or downgrade/i)
  assert.match(app, /ordinary non-restore publications.*existing route/i)
})

test('Scene Tree and Props preflight tombstone reuse or exact known-data materialization', () => {
  const scene = contractText(step('preflight-scene-tree-restore'))
  const props = contractText(step('preflight-props-restore'))
  const sceneApply = contractText(step('materialize-scene-tree-restore'))
  const propsApply = contractText(step('materialize-props-restore'))

  assert.match(
    scene,
    /active id.*duplicate id.*parent.*root index.*cycle.*child order/i
  )
  assert.match(scene, /compatible tombstone.*exact known-data materialization/i)
  assert.match(scene, /post-delete root-parent order evidence/i)
  assert.match(props, /registration.*relation.*duplicate.*missing owner data/i)
  assert.match(props, /compatible tombstone.*exact known-data materialization/i)
  assert.match(
    sceneApply,
    /stable id.*parent.*root index.*child order.*raw Group data/i
  )
  assert.match(propsApply, /component id.*data.*owner relation/i)
  assert.match(`${sceneApply} ${propsApply}`, /no defaults.*replacement ids/i)
})

test('Factory settles one rollbackable non-undoable no-echo remote transaction', () => {
  const settlement = contractText(step('settle-remote-restore-transaction'))

  assert.equal(
    step('settle-remote-restore-transaction').ownerPackage,
    '@asyra/factory'
  )
  assert.match(settlement, /one accepted publication.*one remote transaction/i)
  assert.match(settlement, /rollbackable.*non-undoable.*no-echo/i)
  assert.match(settlement, /Props.*before.*Scene Tree/i)
  assert.match(
    settlement,
    /failure.*exact pre-publication Scene Tree and Props state/i
  )
  assert.match(settlement, /does not interpret hierarchy or property meaning/i)
})

test('Preset, Render, and Layers consume only ordinary canonical projection', () => {
  const preset = contractText(step('project-preset-group-state'))
  const render = contractText(step('project-render-identities'))
  const layers = contractText(step('project-layers-ui'))

  assert.match(preset, /ordinary canonical updates.*Group bounds/i)
  assert.match(
    render,
    /same stable identities.*ordinary Scene Tree projection/i
  )
  assert.match(layers, /flattenedElementIds.*elementDataMap/i)
  ;[preset, render, layers].forEach((text) => {
    assert.match(text, /no restore-only.*fallback|no fallback.*restore-only/i)
  })
})

test('acceptance contracts cover the complete bounded restore product cases and DoD', () => {
  const text = data.acceptanceContracts
    .flatMap((contract) => [contract.title, ...contract.assertions])
    .join(' ')

  ;[
    /tombstone-present.*tombstone-absent.*equivalent.*ids.*data.*hierarchy.*properties.*save.*projections/i,
    /normal and empty Group.*parent.*root sibling index.*descendant child order.*raw Group data/i,
    /one local undo.*one grouped publication.*one accepted remote restore.*one remote transaction/i,
    /non-undoable.*no outbound echo.*remote redo.*same exact subtree/i,
    /id collision.*incompatible tombstone.*stale parent.*stale order.*duplicate ids.*missing owner data.*invalid registration.*malformed relation.*cycle.*inconsistent child order.*permission/i,
    /no partial Scene Tree or Props state/i,
    /detached from later caller and runtime mutation/i,
    /save after restore.*Render.*Layers.*stable identities/i,
    /two independent Core.*Scene Tree.*Props.*Factory.*instance-isolated/i,
    /Collaboration remains transport-only.*core\.load remains unrestricted.*Context Menu.*closeout/i
  ].forEach((pattern) => assert.match(text, pattern))
})
