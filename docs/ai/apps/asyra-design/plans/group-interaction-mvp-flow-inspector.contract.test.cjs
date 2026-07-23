const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('./group-interaction-mvp-flow-inspector.data.cjs')
const repoRoot = path.resolve(__dirname, '../../../../..')

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

test('Group Interaction Inspector authorities resolve', () => {
  assert.equal(
    data.target.title,
    'Asyra Design Group Interaction MVP Inspector'
  )
  assert.equal(
    data.authority.specPath,
    'docs/ai/apps/asyra-design/plans/group-interaction-mvp-plan.md'
  )
  assert.equal(
    data.authority.inspectorPath,
    'docs/ai/apps/asyra-design/plans/group-interaction-mvp-flow-inspector.data.cjs'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(__dirname, 'group-interaction-mvp-flow-inspector.html')
    )
  )
  assert.ok(Object.isFrozen(data))
  assert.ok(data.steps.every(Object.isFrozen))
})

test('all six required owner steps expose exact readiness fields', () => {
  const requiredStepIds = [
    'derive-group-command-intent',
    'execute-group-command-transaction',
    'route-group-command-input',
    'project-layers-hierarchy',
    'settle-history-publication-and-remote-apply',
    'verify-group-persistence-and-render'
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

  assert.deepEqual(
    new Set(data.steps.map((item) => item.id)),
    new Set(requiredStepIds)
  )

  const laneIds = new Set(data.lanes.map((item) => item.id))
  const stepIds = new Set(requiredStepIds)
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

test('app eligibility is guidance and Scene Tree remains final validator', () => {
  const text = contractText(step('derive-group-command-intent'))

  assert.match(
    text,
    /non-empty unique projected selection.*non-workspace siblings.*one common parent/i
  )
  assert.match(text, /exactly one projected official Preset Group/i)
  assert.match(text, /caller selection order never defines child order/i)
  assert.match(
    text,
    /Scene Tree remains the final complete hierarchy validator/i
  )
  assert.match(text, /Render objects or hit-test hierarchy/i)
  assert.match(text, /second mutable parent or children map/i)
})

test('feature transaction owns one-shot execution and atomic post-selection', () => {
  const text = contractText(step('execute-group-command-transaction'))

  assert.match(text, /priority 100.*exclusive one-shot execution/i)
  assert.match(text, /hierarchyApis\.groupElements/i)
  assert.match(text, /hierarchyApis\.ungroupElement/i)
  assert.match(text, /selects only the newly created Group/i)
  assert.match(text, /former direct children in canonical order/i)
  assert.match(text, /one intended Factory transaction and one undo commit/i)
  assert.match(
    text,
    /Factory rollback.*restores hierarchy.*selection completely/i
  )
  assert.match(text, /direct Scene Tree instance access/i)
})

test('input routing has visible controls, standard shortcuts, and editable bypass', () => {
  const text = contractText(step('route-group-command-input'))

  assert.match(text, /stable accessible Group and Ungroup controls/i)
  assert.match(text, /stable data-testid/i)
  assert.match(text, /Meta\+G or Ctrl\+G.*Shift variant/i)
  assert.match(text, /editable text, number, and color inputs/i)
  assert.match(
    text,
    /direct hierarchy or selection mutation in React handlers/i
  )
  assert.match(text, /window\.__AsyraE2E__/i)
})

test('Layers projection derives nested visible rows without second hierarchy state', () => {
  const text = contractText(step('project-layers-hierarchy'))

  assert.match(text, /canonical flattened order.*depth.*parentId chains/i)
  assert.match(text, /default to expanded/i)
  assert.match(text, /hidden-descendant selections remain unchanged/i)
  assert.match(
    text,
    /Shift-range selection uses the currently visible row order/i
  )
  assert.match(text, /UI-local presentation state only/i)
  assert.match(text, /independent mutable parent or children tree/i)
  assert.match(text, /Render display-object ancestry/i)
})

test('Factory/app remote step retains Gate 3 collaboration ownership', () => {
  const text = contractText(step('settle-history-publication-and-remote-apply'))

  assert.match(text, /one Factory undo entry and one grouped publication/i)
  assert.match(text, /exact identity, parent, sibling index, child order/i)
  assert.match(text, /one remote non-undoable Factory transaction/i)
  assert.match(text, /selection and collapsed state remain local/i)
  assert.match(
    text,
    /does not dedupe, order by timestamp\/LWW, resolve hierarchy conflicts, create semantic history, or own convergence policy/i
  )
  assert.match(text, /remote selection takeover/i)
})

test('save/load and Render verify exact identity without fallback', () => {
  const text = contractText(step('verify-group-persistence-and-render'))

  assert.match(
    text,
    /exact Group data, parent, index, child order, nested hierarchy, coordinates\/bounds, props references, and entity identity/i
  )
  assert.match(text, /same element identity and engine handle/i)
  assert.match(
    text,
    /no duplicate visual, stale parent, or visible coordinate jump/i
  )
  assert.match(
    text,
    /duplicate membership, missing reference, cycle, or invalid workspace root rejects before document apply/i
  )
  assert.match(
    text,
    /patch hierarchy, fallback rows, delete-and-recreate handoff/i
  )
})

test('acceptance contracts cover every product family and Definition of Done', () => {
  const acceptedStepIds = new Set(
    data.acceptanceContracts.flatMap((contract) => contract.stepIds)
  )
  data.steps.forEach((item) =>
    assert.ok(acceptedStepIds.has(item.id), `${item.id} lacks acceptance`)
  )

  const text = data.acceptanceContracts
    .flatMap((contract) => [contract.title, ...contract.assertions])
    .join(' ')

  ;[
    /Group one, contiguous, non-contiguous, and nested sibling selections in canonical sibling order/i,
    /Ungroup a normal official Group.*empty official Group/i,
    /Visible Layers controls and Meta\/Ctrl\+G.*Shift variant/i,
    /Shift-range uses visible row order.*hidden-descendant selection/i,
    /One command is one undo entry and one grouped publication/i,
    /Accepted remote Group changes.*without selection takeover/i,
    /Save\/load preserves exact nested Group document state/i,
    /Separate app\/Core instances remain isolated/i,
    /synchronized visual gates pass before manual review/i,
    /user review precedes closeout/i
  ].forEach((pattern) => assert.match(text, pattern))
})
