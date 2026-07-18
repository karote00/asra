const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const data = require('./render-delta-update-flow-inspector.data.cjs')

const repoRoot = path.resolve(__dirname, '../../../..')
const step = (id) => {
  const value = data.steps.find((item) => item.id === id)
  assert.ok(value, `Missing Inspector step: ${id}`)
  return value
}

const route = (id) => {
  const value = data.routes.find((item) => item.id === id)
  assert.ok(value, `Missing Inspector route: ${id}`)
  return value
}

const acceptance = (id) => {
  const value = data.acceptanceContracts.find((item) => item.id === id)
  assert.ok(value, `Missing Inspector acceptance contract: ${id}`)
  return value
}

const contractText = (value) =>
  [
    value.purpose,
    ...value.inputs,
    ...value.outputs,
    ...value.conditions,
    ...value.bypasses,
    ...value.allowedContributors,
    ...value.forbiddenContributors
  ].join(' ')

test('authority resolves to the active product contract and dedicated viewer', () => {
  assert.deepEqual(data.schema, { id: 'asyra.flow-inspector', version: 2 })
  assert.equal(
    data.authority.specPath,
    'docs/ai/framework/plans/render-delta-update-plan.md'
  )
  assert.equal(
    data.authority.inspectorPath,
    'docs/ai/framework/plans/render-delta-update-flow-inspector.data.cjs'
  )
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.specPath)))
  assert.ok(fs.existsSync(path.resolve(repoRoot, data.authority.inspectorPath)))
  assert.ok(
    fs.existsSync(
      path.resolve(__dirname, 'render-delta-update-flow-inspector.html')
    )
  )
  data.links.forEach((link) => {
    assert.ok(
      fs.existsSync(path.resolve(__dirname, link.href)),
      `Inspector link does not resolve: ${link.id}`
    )
  })
})

test('every step exposes the exact Inspector execution contract', () => {
  const requiredArrayFields = [
    'inputs',
    'outputs',
    'conditions',
    'bypasses',
    'allowedContributors',
    'forbiddenContributors',
    'cacheDimensions',
    'implementationBoundary',
    'specRefs'
  ]

  data.steps.forEach((item) => {
    assert.equal(typeof item.id, 'string')
    assert.equal(typeof item.ownerPackage, 'string')
    assert.equal(typeof item.failureOwnerStepId, 'string')
    assert.ok(
      data.steps.some((candidate) => candidate.id === item.failureOwnerStepId)
    )
    requiredArrayFields.forEach((field) => {
      assert.ok(
        Array.isArray(item[field]),
        `${item.id}.${field} must be an array`
      )
    })
    assert.ok(item.implementationBoundary.length > 0)
    assert.ok(item.specRefs.length > 0)
  })
})

test('every route and artifact resolves to one declared owner graph', () => {
  const stepIds = new Set(data.steps.map((item) => item.id))
  const artifactById = new Map(data.artifacts.map((item) => [item.id, item]))

  data.routes.forEach((item) => {
    assert.ok(stepIds.has(item.from), `Unknown route source: ${item.id}`)
    if (item.kind !== 'terminal') {
      assert.ok(stepIds.has(item.to), `Unknown route target: ${item.id}`)
    }
    item.producedArtifacts.forEach((artifactId) => {
      assert.ok(
        artifactById.has(artifactId),
        `Unknown route artifact: ${artifactId}`
      )
    })
  })

  data.artifacts.forEach((item) => {
    assert.ok(
      stepIds.has(item.ownerStepId),
      `Unknown artifact owner: ${item.id}`
    )
    item.consumerStepIds.forEach((consumerStepId) => {
      assert.ok(
        stepIds.has(consumerStepId),
        `Unknown artifact consumer: ${item.id}`
      )
    })
  })
})

test('Scene Tree is canonical and Factory transports ordered changes only', () => {
  const commit = step('commit-scene-tree-delta')
  const delivery = step('deliver-ordered-delta')

  assert.equal(commit.ownerPackage, '@asyra/scene-tree')
  assert.match(contractText(commit), /sole canonical owner/i)
  assert.match(contractText(commit), /scalar.*before.*after/i)
  assert.match(contractText(commit), /raw.*computed.*owner provenance/i)
  assert.match(
    contractText(commit),
    /replay.*consume.*owner.*never.*infer/i
  )
  assert.match(contractText(commit), /record patches/i)
  assert.match(
    contractText(commit),
    /top-level value patch base.*already exist.*computed snapshot/i
  )
  assert.match(contractText(commit), /record base.*already.*record/i)
  assert.match(contractText(commit), /record id.*either.*set.*remove/i)
  ;[
    'packages/reactive-events/src/scene-tree/events.ts',
    'packages/reactive-events/src/scene-tree/publish.ts',
    'packages/reactive-events/src/__tests__/**',
    'docs/ai/framework/packages/reactive-events.md',
    'packages/scene-tree/src/components/element-change-handler.ts',
    'packages/scene-tree/src/components/element.ts',
    'packages/scene-tree/src/components/computed.ts'
  ].forEach((file) => assert.ok(commit.implementationBoundary.includes(file)))
  assert.equal(delivery.ownerPackage, '@asyra/factory')
  assert.match(contractText(delivery), /exactly once/i)
  assert.match(contractText(delivery), /journal order/i)
  assert.match(contractText(delivery), /does not own element state/i)
  assert.match(contractText(delivery), /no independent Render revision/i)
  assert.match(
    contractText(delivery),
    /batch replay.*preserves.*owner/i
  )
})

test('Preset routes complete envelopes without creating another snapshot owner', () => {
  const observer = step('route-render-delta')
  const contract = contractText(observer)

  assert.equal(observer.ownerPackage, '@asyra/preset')
  assert.match(contract, /complete before\/after envelope/i)
  assert.match(contract, /raw.*computed.*owner provenance/i)
  assert.match(
    contract,
    /does not assemble or retain|without assembling state/i
  )
  assert.match(contract, /applied, resynced, removed, or failed/i)
  assert.match(contract, /teardown invokes Render projection cleanup/i)
})

test('initial snapshots are explicit complete Scene Tree projections', () => {
  const seed = step('seed-render-snapshot')
  const contract = contractText(seed)

  assert.equal(seed.ownerPackage, '@asyra/render')
  assert.deepEqual(seed.cacheDimensions, ['elementId'])
  assert.match(contract, /element\.save\(\).*element\.getAllComputedData\(\)/i)
  assert.match(contract, /first use and update may not seed implicitly/i)
  assert.match(contract, /Workspace elements are not cached or rendered/i)
  assert.match(contract, /Load clears every entry and pending update/i)
})

test('scalar, batch, and record patches validate and install atomically', () => {
  const apply = step('apply-render-delta')
  const contract = contractText(apply)

  assert.match(contract, /complete elementId base is required/i)
  assert.match(contract, /Scalar before deep-equals/i)
  assert.match(contract, /declared raw or computed owner/i)
  assert.match(contract, /batch precondition validates before any batch value/i)
  assert.match(contract, /Record additions require absence/i)
  assert.match(contract, /top-level record base must be a record/i)
  assert.match(
    contract,
    /candidate merged snapshot.*requested id.*non-empty type.*non-workspace.*before install/i
  )
  assert.match(contract, /new top-level snapshot/i)
  assert.match(contract, /empty-object record fallback/i)
  assert.match(contract, /partial batch publication/i)
})

test('mismatch performs one explicit resync or removes stale output', () => {
  const resync = step('resync-render-snapshot')
  const contract = contractText(resync)

  assert.match(contract, /invalidated before the authoritative read/i)
  assert.match(contract, /One successful full composition/i)
  assert.match(contract, /missing element removes the visual/i)
  assert.match(contract, /clears the visual and returns failed/i)
  assert.match(
    contract,
    /No resync outcome renders the rejected partial delta/i
  )
  assert.match(contract, /stale visual retention after failed resync/i)
  assert.equal(route('mismatch-to-resync').kind, 'failure')
  assert.equal(route('resync-to-cleanup').kind, 'failure')
})

test('frame coalescing passes complete snapshots and retains direct updates', () => {
  const flush = step('flush-render-snapshot')
  const contract = contractText(flush)

  assert.match(contract, /Commit order/i)
  assert.match(contract, /complete final RenderElementData snapshot/i)
  assert.match(contract, /mixed direct\/computed batch/i)
  assert.match(contract, /Direct property-only updates preserve/i)
  assert.match(contract, /partial delta objects/i)
})

test('strategy ownership is complete-data, engine-neutral, and non-vector compatible', () => {
  const strategy = step('execute-render-strategy')
  const handoff = step('handoff-engine-commands')
  const strategyContract = contractText(strategy)
  const handoffContract = contractText(handoff)

  assert.deepEqual(strategy.cacheDimensions, [])
  assert.match(strategyContract, /complete RenderElementData/i)
  assert.match(
    strategyContract,
    /Non-vector and vector strategies retain the same public input signature/i
  )
  assert.match(
    strategyContract,
    /No new dependency graph or vector geometry cache/i
  )
  assert.match(strategyContract, /Scene Tree reads/i)
  assert.match(strategyContract, /Pixi types or methods/i)
  assert.match(handoffContract, /existing @asyra\/render-engine commands/i)
  assert.match(handoffContract, /@asyra\/render-engine-pixi changes/i)
  assert.equal(
    handoff.implementationBoundary.some((entry) =>
      entry.startsWith('packages/render-engine')
    ),
    false
  )
})

test('all non-empty cache dimensions have profiling and lifecycle evidence', () => {
  const cacheSteps = data.steps.filter(
    (item) => item.cacheDimensions.length > 0
  )
  assert.deepEqual(
    cacheSteps.map((item) => item.id),
    [
      'seed-render-snapshot',
      'apply-render-delta',
      'resync-render-snapshot',
      'flush-render-snapshot',
      'cleanup-render-projection'
    ]
  )

  cacheSteps.forEach((item) => {
    assert.deepEqual(item.cacheDimensions, ['elementId'])
    assert.ok(item.cacheEvidence)
    ;[
      'measuredPhase',
      'baseline',
      'decision',
      'invalidation',
      'equivalenceOracle',
      'cleanup',
      'memoryBound'
    ].forEach((field) =>
      assert.equal(typeof item.cacheEvidence[field], 'string')
    )
    assert.match(item.cacheEvidence.decision, /add no cache dimension/i)
    assert.match(
      item.cacheEvidence.memoryBound,
      /one entry per live non-workspace/i
    )
  })
})

test('cleanup bounds snapshots and pending work across every lifecycle path', () => {
  const cleanup = step('cleanup-render-projection')
  const contract = contractText(cleanup)

  assert.match(contract, /before visual removal/i)
  assert.match(contract, /Load clears every entry/i)
  assert.match(
    contract,
    /teardown clear entries, pending flags, and scheduled work/i
  )
  assert.match(contract, /never exceeds live non-workspace/i)
  assert.match(contract, /cannot retain orphaned snapshots/i)
  assert.ok(
    cleanup.implementationBoundary.includes('packages/render/src/render.ts')
  )
  assert.match(cleanup.inputs.join(' '), /Render teardown/i)
  assert.doesNotMatch(
    route('remove-load-or-observer-cleanup').predicate,
    /Render teardown/i
  )
})

test('the product contract and formal oracle lock count and timing budgets', () => {
  const plan = fs.readFileSync(
    path.resolve(repoRoot, data.authority.specPath),
    'utf8'
  )
  const oraclePath = path.resolve(
    repoRoot,
    'apps/asyra-design/e2e/render-delta-performance.spec.ts'
  )
  const oracle = fs.readFileSync(oraclePath, 'utf8')

  assert.match(plan, /56 points/i)
  assert.match(plan, /Render full rehydrate count must be 0/i)
  assert.match(plan, /combined phase p95 budget is 12 ms/i)
  assert.match(
    plan,
    /does not permit a new or expanded\s+vector geometry cache/i
  )
  assert.match(oracle, /DENSE_POINT_COUNT = 56/)
  assert.match(oracle, /fullRehydrateCallsDuringDelta\)\.toBe\(0\)/)
  assert.match(oracle, /renderSnapshotDeltaApplies\)\.toBe\(SAMPLE_FRAMES\)/)
  assert.match(oracle, /CRITICAL_PATH_P95_BUDGET_MS = 12/)
  assert.match(oracle, /totalMs: 24, p95Ms: 4, maxMs: 6/)
})

test('acceptance covers equivalence, failure, lifecycle, compatibility, and budget', () => {
  assert.deepEqual(
    data.acceptanceContracts.map((item) => item.id),
    [
      'delta-equivalence',
      'failure-and-resync',
      'lifecycle-parity',
      'non-vector-compatibility',
      'dense-vector-budget'
    ]
  )
  assert.match(
    acceptance('lifecycle-parity').assertions.join(' '),
    /action.*undo replay.*redo replay.*core\.load/i
  )
  assert.match(
    acceptance('lifecycle-parity').assertions.join(' '),
    /same-name raw.*computed.*owner/i
  )
  assert.match(
    acceptance('failure-and-resync').assertions.join(' '),
    /incomplete candidate.*resync.*failed/i
  )
})
