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

const artifact = (id) => {
  const value = data.artifacts.find((item) => item.id === id)
  assert.ok(value, `Missing Inspector artifact: ${id}`)
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
  const stepById = new Map(data.steps.map((item) => [item.id, item]))
  const artifactById = new Map(data.artifacts.map((item) => [item.id, item]))

  data.routes.forEach((item) => {
    assert.ok(stepIds.has(item.from), `Unknown route source: ${item.id}`)
    const source = stepById.get(item.from)
    if (item.kind !== 'terminal') {
      assert.ok(stepIds.has(item.to), `Unknown route target: ${item.id}`)
    }
    item.producedArtifacts.forEach((artifactId) => {
      assert.ok(
        artifactById.has(artifactId),
        `Unknown route artifact: ${artifactId}`
      )
      assert.ok(
        source.outputs.includes(artifactId),
        `${item.id} artifact ${artifactId} is not declared by source ${item.from}`
      )
      if (item.kind !== 'terminal') {
        assert.ok(
          stepById.get(item.to).inputs.includes(artifactId),
          `${item.id} artifact ${artifactId} is not consumed by target ${item.to}`
        )
      }
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
    /existing record value of undefined.*carries a before property.*absent record id.*addition/i
  )
  assert.match(
    contractText(commit),
    /shared patch type permits explicit undefined.*record-child before or after.*top-level scalar.*DataTypes/i
  )
  assert.match(
    contractText(commit),
    /top-level value patch base.*already exist.*computed snapshot/i
  )
  assert.match(contractText(commit), /record base.*already.*record/i)
  assert.match(contractText(commit), /record id.*either.*set.*remove/i)
  assert.match(
    contractText(commit),
    /multi-element computed patch deduplicates target ids.*reads each existing target snapshot once.*prevalidates every target before the first mutation.*invalid target.*no canonical prefix.*valid target applies once/i
  )
  assert.match(
    contractText(commit),
    /special property names.*own enumerable data properties.*canonical apply and replay/i
  )
  ;[
    'docs/ai/framework/packages/utils.md',
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
  assert.match(
    contractText(delivery),
    /set entry with a before property whose value is undefined.*inverts to a set.*without a before property.*remove/i
  )
  assert.match(
    contractText(delivery),
    /top-level key and record id.*own enumerable data property.*special property names/i
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
  assert.match(
    contract,
    /Initial registration.*re-registration.*observer.*authoritative Render rebuild/i
  )
  assert.match(
    contract,
    /rebuild failure.*registration fails.*cleanup rollback/i
  )
  assert.match(
    contract,
    /file-load.*synchronous.*failure.*lifecycle caller/i
  )
  assert.ok(observer.inputs.includes('file-load lifecycle event'))
  assert.match(
    observer.bypasses.join(' '),
    /Selection.*UI-context.*vector-editing.*separate consumers/i
  )
  assert.match(contract, /teardown invokes Render projection cleanup/i)
  assert.match(
    route('registration-or-reregistration-seed').predicate,
    /initial registration or re-registration/i
  )
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
  assert.match(
    contract,
    /load.*canonical parent children order.*Map insertion order.*exact sibling index/i
  )
  assert.match(
    contract,
    /any element.*rebuild failure.*whole reload.*partial projection.*throws/i
  )
  assert.match(
    contract,
    /unsuccessful visual add.*strategy failure.*add, reload, or resync.*rebuild failure/i
  )
  assert.match(
    contract,
    /missing add.*pending update.*stale visual.*removed/i
  )
  assert.match(
    contract,
    /add envelope.*parentId.*sibling index.*parent children mirror.*explicit parent resync/i
  )
  ;[
    'packages/render/src/render.ts',
    'packages/render/src/layers/viewport/viewport-layer.ts',
    'packages/render/src/layers/scene/render-layer.ts',
    'packages/render/src/__tests__/render.test.ts',
    'packages/render/src/__tests__/viewport-layer.test.ts'
  ].forEach((file) => assert.ok(seed.implementationBoundary.includes(file)))
})

test('scalar, batch, and record patches validate and install atomically', () => {
  const apply = step('apply-render-delta')
  const contract = contractText(apply)

  assert.match(contract, /complete elementId base is required/i)
  assert.match(contract, /Scalar before deep-equals/i)
  assert.match(contract, /declared raw or computed owner/i)
  assert.match(contract, /batch precondition validates before any batch value/i)
  assert.match(contract, /Record additions require absence/i)
  assert.match(
    contract,
    /comparison is cycle-safe for distinct cyclic records and arrays.*exact sparse-array semantics/i
  )
  assert.match(
    contract,
    /array hole.*own undefined slot.*not equivalent/i
  )
  assert.match(contract, /top-level record base must be a record/i)
  assert.match(
    contract,
    /scalar, batch, and patch top-level base.*own property.*before equality/i
  )
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
  assert.match(
    contract,
    /authoritative visual rebuild succeeds.*returns resynced/i
  )
  assert.match(
    contract,
    /strategy rebuild failure.*returns failed/i
  )
  assert.match(contract, /missing element removes the visual/i)
  assert.match(contract, /clears the visual and returns failed/i)
  assert.match(
    contract,
    /No resync outcome renders the rejected partial delta/i
  )
  assert.match(contract, /stale visual retention after failed resync/i)
  assert.match(
    route('mismatch-to-resync').predicate,
    /incomplete candidate/i
  )
  assert.equal(route('mismatch-to-resync').kind, 'failure')
  assert.equal(route('resync-to-strategy').to, 'execute-render-strategy')
  assert.match(
    route('resync-to-strategy').predicate,
    /synchronous visual rebuild/i
  )
  assert.equal(
    data.routes.some((item) => item.id === 'resync-to-frame'),
    false
  )
  assert.equal(route('resync-to-cleanup').kind, 'failure')
})

test('seed and resync routes carry complete requests before strategy outcomes', () => {
  assert.equal(route('seed-to-strategy').to, 'execute-render-strategy')
  assert.deepEqual(route('seed-to-strategy').producedArtifacts, [
    'artifact:complete-render-snapshot'
  ])
  assert.equal(
    data.routes.some((item) => item.id === 'seed-to-frame'),
    false
  )
  assert.deepEqual(route('resync-to-strategy').producedArtifacts, [
    'artifact:authoritative-resync-request'
  ])
  assert.ok(
    step('execute-render-strategy').inputs.includes(
      'artifact:authoritative-resync-request'
    )
  )
  assert.equal(
    step('execute-render-strategy').inputs.includes(
      'artifact:render-resync-outcome'
    ),
    false
  )
  assert.deepEqual(
    artifact('artifact:complete-render-snapshot').consumerStepIds,
    ['apply-render-delta', 'execute-render-strategy']
  )
  assert.deepEqual(
    artifact('artifact:authoritative-resync-request').consumerStepIds,
    ['execute-render-strategy']
  )
  assert.deepEqual(artifact('artifact:render-resync-outcome').consumerStepIds, [
    'cleanup-render-projection'
  ])
  assert.ok(
    step('execute-render-strategy').outputs.includes(
      'artifact:strategy-rebuild-result'
    )
  )
  assert.deepEqual(route('strategy-result-to-seed').producedArtifacts, [
    'artifact:strategy-rebuild-result'
  ])
  assert.deepEqual(route('strategy-result-to-resync').producedArtifacts, [
    'artifact:strategy-rebuild-result'
  ])
  assert.deepEqual(artifact('artifact:strategy-rebuild-result').consumerStepIds, [
    'seed-render-snapshot',
    'resync-render-snapshot'
  ])
})

test('frame coalescing passes complete snapshots and retains direct updates', () => {
  const flush = step('flush-render-snapshot')
  const contract = contractText(flush)

  assert.match(contract, /Commit order/i)
  assert.match(contract, /complete final RenderElementData snapshot/i)
  assert.match(contract, /mixed direct\/computed batch/i)
  assert.match(contract, /Direct property-only updates preserve/i)
  assert.match(contract, /partial delta objects/i)
  assert.match(
    contract,
    /complete snapshot.*parentId and children.*stable sibling order/i
  )
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
  assert.ok(
    strategy.implementationBoundary.includes('docs/ai/framework/PLANS.md')
  )
  assert.match(handoffContract, /existing @asyra\/render-engine commands/i)
  assert.match(
    handoffContract,
    /Local hierarchy parent and sibling-order bookkeeping commits only after.*engine append and set-child-index.*succeeds.*failed handoff retains the pre-command local state.*same complete snapshot.*retry/i
  )
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
      /one entry.*one live Scene Tree-projected Render node per live non-workspace/i
    )
  })
})

test('cleanup bounds snapshots and pending work across every lifecycle path', () => {
  const cleanup = step('cleanup-render-projection')
  const contract = contractText(cleanup)

  assert.match(contract, /pending id before visual release/i)
  assert.match(contract, /Load clears every entry/i)
  assert.match(
    contract,
    /teardown clear pending flags and scheduled work.*release every Scene Tree-projected visual node.*discard each successfully released entry/i
  )
  assert.match(
    contract,
    /Scene Tree-projected Render-node count never exceed.*live non-workspace/i
  )
  assert.match(contract, /custom and overlay nodes are not part/i)
  assert.match(
    contract,
    /projected parent.*detaches.*live projected children.*destroys only.*parent/i
  )
  assert.match(contract, /cannot retain orphaned snapshots/i)
  assert.match(contract, /destroys the detached Render node/i)
  assert.match(
    contract,
    /remove envelope.*parentId.*sibling index.*parent mirror.*complete snapshot.*explicit parent resync/i
  )
  assert.match(contract, /prior-engine handles/i)
  assert.match(
    contract,
    /handle-to-node lookup remains available until.*engine destroy command succeeds.*failed destroy retains.*lookup.*retry owner/i
  )
  assert.match(contract, /workspace label and transform to neutral values/i)
  assert.match(
    contract,
    /release failure.*retain.*ownership.*other projected nodes.*subsequent cleanup retries/i
  )
  assert.match(contract, /valid mirror.*retained.*release failure/i)
  assert.match(
    contract,
    /invalidated resync mirror.*remains absent.*projected.*retry/i
  )
  assert.match(
    contract,
    /mirror ownership.*projected visual ownership.*tracked separately/i
  )
  assert.match(
    contract,
    /visual release succeeds.*projected ownership.*matching valid mirror.*discarded/i
  )
  assert.ok(
    cleanup.implementationBoundary.includes('packages/render/src/render.ts')
  )
  assert.ok(
    cleanup.implementationBoundary.includes(
      'packages/render/src/layers/scene/render-layer.ts'
    )
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
  const planIndex = fs.readFileSync(
    path.resolve(repoRoot, 'docs/ai/framework/PLANS.md'),
    'utf8'
  )
  const oraclePath = path.resolve(
    repoRoot,
    'apps/asyra-design/e2e/render-delta-performance.spec.ts'
  )
  const oracle = fs.readFileSync(oraclePath, 'utf8')
  const renderPackageContract = fs.readFileSync(
    path.resolve(repoRoot, 'docs/ai/framework/packages/render.md'),
    'utf8'
  )

  assert.match(plan, /56 points/i)
  assert.match(plan, /Render full rehydrate count must be 0/i)
  assert.match(plan, /combined phase p95 budget is 12 ms/i)
  assert.match(
    plan,
    /does not permit a new or expanded\s+vector geometry cache/i
  )
  assert.match(planIndex, /elementId.*complete Render snapshot/i)
  assert.doesNotMatch(planIndex, /key-based invalidation/i)
  assert.match(oracle, /DENSE_POINT_COUNT = 56/)
  assert.match(oracle, /fullRehydrateCallsDuringDelta\)\.toBe\(0\)/)
  assert.match(oracle, /renderSnapshotDeltaApplies\)\.toBe\(SAMPLE_FRAMES\)/)
  assert.match(oracle, /CRITICAL_PATH_P95_BUDGET_MS = 12/)
  assert.match(oracle, /totalMs: 24, p95Ms: 4, maxMs: 6/)
  ;[plan, renderPackageContract].forEach((contract) => {
    const normalizedContract = contract.replace(/\s+/g, ' ')
    assert.match(normalizedContract, /valid mirror.*release failure/i)
    assert.match(
      normalizedContract,
      /invalidated resync mirror.*remains absent.*projected.*retry/i
    )
  })
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
    acceptance('lifecycle-parity').assertions.join(' '),
    /re-registration.*current Scene Tree.*remove destroys.*redo creates/i
  )
  assert.match(
    acceptance('failure-and-resync').assertions.join(' '),
    /incomplete candidate.*resync.*failed/i
  )
  assert.match(
    acceptance('failure-and-resync').assertions.join(' '),
    /strategy rebuild succeeds.*strategy rebuild failure.*returns failed/i
  )
  assert.match(
    acceptance('lifecycle-parity').assertions.join(' '),
    /release succeeds.*failed release.*retry ownership/i
  )
})
