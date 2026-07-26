const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('../ai-conversational-drawing-performance-flow-inspector.data.cjs')
const repoRoot = path.resolve(__dirname, '../../../../../..')

const requiredStepFields = [
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
  'accept-profiled-ai-drawing-turn',
  'prepare-ordered-app-composition-batches',
  'apply-canonical-scene-batch',
  'record-history-and-shared-publication',
  'transport-and-apply-remote-batches',
  'project-visible-canonical-batches',
  'evaluate-performance-and-equivalence'
]

const anchorForHeading = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

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

test('performance Inspector authorities and queued-successor routing resolve', () => {
  assert.equal(
    data.target.title,
    'Asyra Design Conversational AI Drawing Performance Inspector'
  )
  assert.equal(
    data.authority.specPath,
    'docs/ai/apps/asyra-design/plans/ai-conversational-drawing-performance-plan.md'
  )
  assert.equal(
    data.authority.inspectorPath,
    'docs/ai/apps/asyra-design/plans/ai-conversational-drawing-performance-flow-inspector.data.cjs'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(
        __dirname,
        '../ai-conversational-drawing-performance-flow-inspector.html'
      )
    )
  )
  assert.ok(Object.isFrozen(data))
  assert.ok(data.steps.every(Object.isFrozen))

  const plansIndex = fs.readFileSync(
    path.resolve(repoRoot, 'docs/ai/apps/asyra-design/PLANS.md'),
    'utf8'
  )
  assert.match(
    plansIndex,
    /Current active plan:\s+`plans\/ai-conversational-drawing-plan\.md`/
  )
  assert.match(
    plansIndex,
    /Ordered proposed next implementation plans:\s*\n\s*1\.\s+`plans\/ai-conversational-drawing-performance-plan\.md`/
  )
})

test('performance Inspector exposes seven exact single-owner steps', () => {
  assert.deepEqual(
    new Set(data.steps.map((item) => item.id)),
    new Set(requiredStepIds)
  )

  const laneIds = new Set(data.lanes.map((item) => item.id))
  const stepIds = new Set(requiredStepIds)
  data.steps.forEach((item) => {
    assert.deepEqual(Object.keys(item), requiredStepFields)
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

test('performance Inspector paths and specification anchors resolve', () => {
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

  data.steps.forEach((item) => {
    item.implementationBoundary.forEach((boundary) => {
      assert.ok(
        fs.existsSync(path.resolve(repoRoot, boundary)),
        `${item.id} missing implementation root ${boundary}`
      )
    })
  })
})

test('routes and artifacts form one exact owner graph', () => {
  const stepIds = new Set(data.steps.map((item) => item.id))
  const artifactById = new Map(
    data.artifacts.map((artifact) => [artifact.id, artifact])
  )
  assert.equal(artifactById.size, data.artifacts.length)

  data.artifacts.forEach((artifact) => {
    assert.ok(stepIds.has(artifact.ownerStepId), artifact.id)
    const owner = step(artifact.ownerStepId)
    assert.ok(
      owner.outputs.includes(artifact.id),
      `${artifact.id} owner output`
    )
    artifact.consumerStepIds.forEach((consumerId) => {
      assert.ok(stepIds.has(consumerId), `${artifact.id} consumer`)
      assert.ok(
        step(consumerId).inputs.includes(artifact.id),
        `${artifact.id} consumer input`
      )
    })
  })

  data.routes.forEach((route) => {
    assert.ok(stepIds.has(route.from), `${route.id} from`)
    if (route.to) assert.ok(stepIds.has(route.to), `${route.id} to`)
    route.producedArtifacts.forEach((artifactId) => {
      const artifact = artifactById.get(artifactId)
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
})

test('measurement separates product owners from harness overhead', () => {
  const intake = contractText(step('accept-profiled-ai-drawing-turn'))
  const proof = contractText(step('evaluate-performance-and-equivalence'))

  assert.match(intake, /one unmeasured warm-up precedes three measured runs/i)
  assert.match(intake, /server build\/start.*never enter product spans/i)
  assert.match(intake, /observers cannot alter batching.*history.*canonical/i)
  assert.match(proof, /median and worst owner spans separately/i)
  assert.match(proof, /first over-budget product owner/i)
  assert.match(proof, /test harness time attributed to a product owner/i)
})

test('local, collaboration, and maximum budgets remain exact', () => {
  const plan = fs.readFileSync(
    path.resolve(repoRoot, data.authority.specPath),
    'utf8'
  )
  const collaboration = contractText(step('transport-and-apply-remote-batches'))

  assert.match(plan, /Atomic Actor A creation settled in 29 seconds/)
  assert.match(plan, /Progressive Actor A creation settled in 105 seconds/)
  assert.match(
    plan,
    /full progressive two-actor recording command took 13\.2 minutes/
  )
  assert.match(plan, /recording is 774\.96 seconds long/)
  assert.match(plan, /Balanced atomic creation:[\s\S]*at most 12 seconds/)
  assert.match(plan, /Balanced progressive creation:[\s\S]*at most 20 seconds/)
  assert.match(plan, /first visible canonical batch within 2 seconds/)
  assert.match(plan, /canonical convergence within 30 seconds/)
  assert.match(plan, /whole dedicated E2E command[\s\S]*at most 180\s+seconds/)
  assert.match(plan, /Maximum detail:[\s\S]*at most 60 seconds/)
  assert.match(
    collaboration,
    /more than one increasing non-final element count/i
  )
  assert.match(collaboration, /no local Undo action/i)
})

test('performance work cannot weaken canonical or history semantics', () => {
  const app = contractText(step('prepare-ordered-app-composition-batches'))
  const sceneTree = contractText(step('apply-canonical-scene-batch'))
  const factory = contractText(step('record-history-and-shared-publication'))
  const render = contractText(step('project-visible-canonical-batches'))
  const proof = contractText(step('evaluate-performance-and-equivalence'))

  assert.match(app, /preserves accepted item order, every path and point/i)
  assert.match(app, /no performance budget becomes an item.*point.*ceiling/i)
  assert.match(
    sceneTree,
    /exact ids, bounds, transforms, roles, fills, strokes/i
  )
  assert.match(
    sceneTree,
    /same ordered ADD_ELEMENT.*persistence.*Collaboration/i
  )
  assert.match(factory, /exactly one intended local history action/i)
  assert.match(factory, /Undo and Redo.*one local history action/i)
  assert.match(
    render,
    /does not collapse progressive mode into one final-only frame/i
  )
  assert.match(render, /AI-only renderer or bitmap replacement/i)
  assert.match(
    proof,
    /canonical equivalence compares ids.*point counts.*topology/i
  )
  assert.match(proof, /screenshots as canonical semantics authority/i)
})

test('cache stays profiling-gated and owner-specific', () => {
  const plan = fs.readFileSync(
    path.resolve(repoRoot, data.authority.specPath),
    'utf8'
  )
  assert.match(
    plan,
    /largest product-owned span determines the next\s+single Inspector owner step/i
  )
  assert.match(plan, /cache key dimensions/)
  assert.match(plan, /invalidation events/)
  assert.match(plan, /miss path/)
  assert.match(plan, /exact hit\/miss equivalence test/)
  assert.ok(data.steps.every((item) => item.cacheDimensions.length === 0))
})

test('performance BDD and local-artifact ignore contract are registered', () => {
  const featurePath = path.resolve(
    repoRoot,
    'docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature'
  )
  const feature = fs.readFileSync(featurePath, 'utf8')
  assert.match(
    feature,
    /Scenario: Profiling identifies the first product-owned bottleneck/
  )
  assert.match(
    feature,
    /Scenario: Balanced atomic creation meets the local budget/
  )
  assert.match(
    feature,
    /Scenario: Balanced progressive creation and peer convergence meet their budgets/
  )
  assert.match(
    feature,
    /Scenario: Maximum detail remains editable and meets its budget/
  )
  assert.match(
    feature,
    /generated screenshots, recordings, profiles, traces, and thumbnail media should remain ignored/i
  )

  const gitignore = fs.readFileSync(
    path.resolve(repoRoot, '.gitignore'),
    'utf8'
  )
  assert.match(
    gitignore,
    /apps\/asyra-design\/visual-review-records\/\*\*\/\*\.png/
  )
  assert.match(
    gitignore,
    /apps\/asyra-design\/visual-review-records\/\*\*\/\*\.webm/
  )
  assert.match(
    gitignore,
    /!apps\/asyra-design\/visual-review-records\/research\/research-02-original-tabby-source\.png/
  )
})
