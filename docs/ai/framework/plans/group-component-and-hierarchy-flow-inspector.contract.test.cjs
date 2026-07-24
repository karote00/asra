const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('./group-component-and-hierarchy-flow-inspector.data.cjs')
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

test('Gate 3 Inspector and product authorities resolve', () => {
  assert.equal(data.target.title, 'Group Component and Hierarchy Inspector')
  assert.equal(
    data.authority.specPath,
    'docs/ai/framework/plans/completed/group-component-and-hierarchy-behaviors-plan.md'
  )
  assert.equal(
    data.authority.inspectorPath,
    'docs/ai/framework/plans/group-component-and-hierarchy-flow-inspector.data.cjs'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(
        __dirname,
        'group-component-and-hierarchy-flow-inspector.html'
      )
    )
  )
  assert.ok(Object.isFrozen(data))
  assert.ok(data.steps.every(Object.isFrozen))
})

test('every owner step has the complete readiness fields', () => {
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

  assert.equal(laneIds.size, data.lanes.length, 'duplicate lane id')
  assert.equal(stepIds.size, data.steps.length, 'duplicate step id')

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
    if (item.id === 'project-render-hierarchy') {
      assert.deepEqual(item.cacheDimensions, ['elementId'])
    } else {
      assert.deepEqual(item.cacheDimensions, [], `${item.id} unjustified cache`)
    }
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
    assert.ok(stepIds.has(artifact.ownerStepId), artifact.id)
    assert.ok(step(artifact.ownerStepId).outputs.includes(artifact.id))
    assert.equal(typeof artifact.channel, 'string', `${artifact.id} channel`)
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

test('Scene Tree is the sole hierarchy validation and mutation owner', () => {
  const scene = contractText(step('mutate-canonical-hierarchy'))

  assert.equal(step('mutate-canonical-hierarchy').ownerPackage, '@asyra/scene-tree')
  assert.match(scene, /validate the complete ID-based operation before the first write/i)
  assert.match(scene, /Self-parenting.*descendant cycles.*duplicate membership.*missing ids.*mixed parents.*workspace movement.*invalid targets.*invalid indexes/i)
  assert.match(scene, /retain their exact instances and ids/i)
  assert.match(scene, /no move is implemented as delete plus recreate/i)
  assert.match(scene, /Subtree removal is deterministic and descendant-first/i)
  assert.match(scene, /Preset or app hierarchy validation/i)
  assert.match(scene, /Render hierarchy state/i)
})

test('Preset owns one official Group adapter and translation-only geometry', () => {
  const prepare = contractText(step('prepare-preset-group-operation'))
  const geometry = contractText(step('normalize-preset-group-geometry'))

  assert.match(prepare, /one official GROUP component.*no second Group registration/i)
  assert.match(prepare, /canonical sibling order.*first selected sibling slot/i)
  assert.match(prepare, /direct parentId or children writes/i)
  assert.match(geometry, /subtracting the new Group origin/i)
  assert.match(geometry, /adding the removed Group origin/i)
  assert.match(geometry, /same Factory transaction/i)
  assert.match(geometry, /Render bounds as canonical input/i)
  assert.match(geometry, /auto-layout or descendant scaling/i)
})

test('Preset projects every committed canonical hierarchy lifecycle to app UI context', () => {
  const projection = contractText(
    step('project-preset-hierarchy-ui-context')
  )

  assert.equal(
    step('project-preset-hierarchy-ui-context').ownerPackage,
    '@asyra/preset'
  )
  assert.match(
    projection,
    /ADD_ELEMENT.*REMOVE_ELEMENT.*MOVE_ELEMENTS.*REMOVE_SUBTREE.*RESTORE_SUBTREE/i
  )
  assert.match(projection, /flattenedElementIds.*elementDataMap/i)
  assert.match(projection, /canonical Scene Tree/i)
  assert.match(projection, /second canonical hierarchy/i)
  assert.match(projection, /App or Render repair/i)
})

test('Factory owns atomic history/publication but no hierarchy or conflict policy', () => {
  const factory = contractText(step('settle-hierarchy-transaction'))

  assert.match(factory, /one intended hierarchy request as one undo entry/i)
  assert.match(factory, /roll back every recorded hierarchy\/property write/i)
  assert.match(factory, /Rollback restores exact identities, parent ids, indexes, child order, property state, and Group data/i)
  assert.match(factory, /Remote origin is rollbackable, non-undoable.*cannot echo/i)
  assert.match(factory, /Factory hierarchy validation/i)
  assert.match(factory, /Factory dedupe or conflict policy/i)
})

test('Gate 2 transport-only collaboration ownership remains unchanged', () => {
  const transport = contractText(step('transport-hierarchy-publication'))
  const remote = contractText(step('apply-app-remote-hierarchy-policy'))
  const product = fs.readFileSync(
    path.resolve(repoRoot, data.authority.specPath),
    'utf8'
  )

  assert.match(transport, /Repeated and equal publications remain repeated app intent/i)
  assert.match(transport, /one Provider send and one receiving app callback/i)
  assert.match(transport, /dedupe/i)
  assert.match(transport, /timestamp or last-write-wins ordering/i)
  assert.match(transport, /conflict resolution or convergence registry/i)
  assert.match(transport, /semantic history/i)
  assert.match(remote, /app or backend owns permission, domain ordering, duplicate handling, last-write-wins if any, and concurrent hierarchy conflict behavior/i)
  assert.doesNotMatch(product, /exact rollback, undo\/redo, save\/load, CRDT convergence/i)
  assert.match(
    product.replace(/\s+/g, ' '),
    /duplicate delivery and concurrent hierarchy convergence are app\/backend product cases, not Framework convergence guarantees/i
  )
})

test('save/load and Render handoffs preserve exact state and identity', () => {
  const load = contractText(step('validate-save-load-hierarchy'))
  const render = contractText(step('project-render-hierarchy'))

  assert.match(load, /one parent per non-workspace element.*exact child order.*nested Groups.*props references.*Group data/i)
  assert.match(load, /duplicate membership.*missing parents\/children.*cycles.*workspace roots before apply/i)
  assert.match(load, /instance-bound and replace-style apply/i)
  assert.match(
    render,
    /same element-to-engine ownership.*existing element identity and abstract engine handle/i
  )
  assert.match(render, /bookkeeping commits only after append or set-child-index succeeds/i)
  assert.match(render, /patch or fallback hierarchy/i)
  assert.match(render, /delete-and-recreate visual handoff/i)
})

test('acceptance contracts cover every bounded Gate 3 product family and DoD', () => {
  const text = data.acceptanceContracts
    .flatMap((contract) => [contract.title, ...contract.assertions])
    .join(' ')

  ;[
    /Contiguous and non-contiguous siblings group in canonical sibling order.*nested Groups/i,
    /Normal and empty Groups ungroup deterministically.*world positions/i,
    /Same-parent reorder and cross-parent reparent preserve identity.*final-target-index/i,
    /Missing ids, duplicate ids, mixed parents, invalid targets, invalid indexes, workspace movement, self-parenting, and descendant cycles reject before mutation/i,
    /complete subtree in deterministic descendant-first order/i,
    /Rollback, undo, and redo restore exact instances, ids, parent ids, indexes, child order, properties, and Group data/i,
    /Collaboration preserves duplicate delivery and FIFO order without dedupe, timestamp\/LWW, conflict resolution, convergence policy, or semantic history/i,
    /App\/backend policy accepts or rejects duplicate and concurrent hierarchy requests before one remote transaction/i,
    /Save\/load preserves one parent, exact child order, nested Groups, Group data, and props references/i,
    /Separate Scene Tree\/Core instances do not share hierarchy state/i,
    /same element identity and engine handle without duplicate visuals, stale parents, or fallback hierarchy/i
  ].forEach((pattern) => assert.match(text, pattern))
})
