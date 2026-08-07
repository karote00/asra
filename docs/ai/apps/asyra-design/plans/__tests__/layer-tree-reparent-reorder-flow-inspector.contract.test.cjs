const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../layer-tree-reparent-reorder-flow-inspector.data.cjs')
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

test('Layer Tree move Inspector authorities resolve', () => {
  assert.equal(
    data.target.title,
    'Design App Layer Tree Reparent and Reorder Inspector'
  )
  assert.equal(
    data.authority.specPath,
    'docs/ai/apps/asyra-design/plans/completed/layer-tree-reparent-reorder-plan.md'
  )
  assert.equal(
    data.authority.inspectorPath,
    'docs/ai/apps/asyra-design/plans/layer-tree-reparent-reorder-flow-inspector.data.cjs'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(
        __dirname,
        '..',
        'layer-tree-reparent-reorder-flow-inspector.html'
      )
    )
  )
  assert.ok(Object.isFrozen(data))
  assert.ok(data.steps.every(Object.isFrozen))
})

test('all seven required owner steps expose exact readiness fields', () => {
  const requiredStepIds = [
    'normalize-layers-pointer-session',
    'derive-layer-move-source',
    'project-layer-drop-candidate',
    'execute-layer-move-session',
    'settle-canonical-layer-move',
    'project-layer-move-result',
    'apply-app-remote-layer-move-policy'
  ]
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

  assert.deepEqual([...stepIds], requiredStepIds)
  assert.equal(stepIds.size, data.steps.length)
  data.steps.forEach((item) => {
    requiredFields.forEach((field) =>
      assert.notEqual(item[field], undefined, `${item.id} missing ${field}`)
    )
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
    assert.deepEqual(item.cacheDimensions, [], `${item.id} unjustified cache`)
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
    assert.ok(stepIds.has(artifact.ownerStepId), artifact.id)
    assert.ok(step(artifact.ownerStepId).outputs.includes(artifact.id))
    artifact.consumerStepIds.forEach((consumerId) => {
      assert.ok(stepIds.has(consumerId), `${artifact.id} ${consumerId}`)
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
  const acceptedStepIds = new Set(
    data.acceptanceContracts.flatMap((contract) => contract.stepIds)
  )
  data.steps.forEach((item) =>
    assert.ok(acceptedStepIds.has(item.id), `${item.id} lacks product case/DoD`)
  )
})

test('implementation boundaries and specification anchors resolve', () => {
  data.steps.forEach((item) => {
    item.implementationBoundary.forEach((boundary) => {
      assert.ok(
        fs.existsSync(path.resolve(repoRoot, boundary)),
        `${item.id} missing ${boundary}`
      )
    })
  })
  const markdown = fs.readFileSync(
    path.resolve(repoRoot, data.authority.specPath),
    'utf8'
  )
  const anchors = anchorsIn(markdown)
  ;[
    ...data.steps.flatMap((item) => item.specRefs),
    ...data.acceptanceContracts.flatMap((item) => item.specRefs)
  ].forEach((reference) => {
    assert.ok(reference.startsWith('#'), `external spec ref ${reference}`)
    assert.ok(anchors.has(reference.slice(1)), `missing anchor ${reference}`)
  })
})

test('pointer normalization owns threshold and every deterministic cleanup route', () => {
  const pointer = contractText(step('normalize-layers-pointer-session'))

  assert.match(pointer, /pointer-down.*pointer movement.*pointer-up/i)
  assert.match(pointer, /movement threshold/i)
  assert.match(pointer, /Escape.*pointer cancel.*lost capture.*unmount/i)
  assert.match(pointer, /editable.*row action.*disclosure/i)
  assert.match(pointer, /UI-only preview/i)
  assert.match(pointer, /canonical hierarchy mutation/i)
})

test('source intent preserves full selected siblings or rejects the complete source', () => {
  const source = contractText(step('derive-layer-move-source'))

  assert.match(source, /unselected.*replaces.*selection/i)
  assert.match(source, /selected row.*current selected ids/i)
  assert.match(source, /unique.*existing.*non-workspace siblings.*common parent/i)
  assert.match(source, /locked source/i)
  assert.match(source, /mixed-parent.*stale.*no subset/i)
  assert.match(source, /Scene Tree.*canonicalizes.*moved-id order/i)
})

test('drop projection owns zones and final-target-list index semantics only', () => {
  const drop = contractText(step('project-layer-drop-candidate'))

  assert.match(drop, /before.*after.*inside/i)
  assert.match(drop, /final target child list.*moved ids.*removed/i)
  assert.match(drop, /empty Layers area.*workspace/i)
  assert.match(drop, /collapsed Group.*expand/i)
  assert.match(drop, /self.*descendant.*locked.*unsupported container/i)
  assert.match(drop, /advisory/i)
  assert.match(drop, /direct Scene Tree mutation/i)
})

test('feature session owns one request, commit-current cancel, and post-selection', () => {
  const feature = contractText(step('execute-layer-move-session'))

  assert.match(feature, /priority 110.*exclusive/i)
  assert.match(feature, /cancelPolicy.*commit-current/i)
  assert.match(feature, /exactly one.*hierarchyApis\.moveElements/i)
  assert.match(feature, /successful drop.*canonical moved order/i)
  assert.match(feature, /below-threshold.*ordinary Layers row selection/i)
  assert.match(feature, /handler error or timeout.*rollback/i)
})

test('canonical handoff retains Gate 3 Scene Tree, Preset, and Factory owners', () => {
  const handoff = contractText(step('settle-canonical-layer-move'))

  assert.match(handoff, /Scene Tree.*sole.*validation.*mutation owner/i)
  assert.match(handoff, /Preset.*world-space.*Group bounds/i)
  assert.match(handoff, /Factory.*one transaction.*undo.*publication/i)
  assert.match(handoff, /same-parent no-op.*no history.*publication/i)
  assert.match(handoff, /app reinterpretation.*subset.*parent.*index/i)
  assert.match(handoff, /delete.*recreate/i)
})

test('Layers and Render project committed identity without preview hierarchy', () => {
  const projection = contractText(step('project-layer-move-result'))

  assert.match(projection, /commit.*undo.*redo.*load.*remote/i)
  assert.match(projection, /clear.*insertion.*invalid.*preview/i)
  assert.match(projection, /same entity.*engine handle/i)
  assert.match(projection, /second hierarchy/i)
  assert.match(projection, /Render-only/i)
  assert.match(projection, /visible canvas jump/i)
})

test('remote move policy stays app-owned and Collaboration stays transport-only', () => {
  const remote = contractText(step('apply-app-remote-layer-move-policy'))

  assert.match(remote, /permission.*domain ordering.*duplicate.*conflict/i)
  assert.match(remote, /one remote.*Factory transaction/i)
  assert.match(remote, /receiving-app selection.*local/i)
  assert.match(remote, /Collaboration.*dedupe.*LWW.*timestamp.*conflict resolution.*semantic history/i)
})

test('acceptance contracts cover every plan product family and Definition of Done', () => {
  const text = data.acceptanceContracts
    .flatMap((contract) => [contract.title, ...contract.assertions])
    .join(' ')

  ;[
    /Reorder one and several canonical siblings earlier and later/i,
    /expanded and collapsed official Groups/i,
    /nested Group.*identity/i,
    /below-threshold.*Escape.*pointer cancel.*lost capture.*unmount.*outside/i,
    /mixed-parent.*locked.*missing.*workspace.*self.*descendant.*duplicate.*unsupported.*invalid index/i,
    /one intended transaction.*undo.*publication/i,
    /Save\/load.*accepted remote apply.*separate instances/i,
    /no canvas jump.*duplicate.*stale/i,
    /user manual review.*closeout/i
  ].forEach((pattern) => assert.match(text, pattern))
})
