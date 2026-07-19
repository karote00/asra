;(function () {
  'use strict'

  const specPath = 'docs/ai/framework/plans/render-delta-update-plan.md'
  const inspectorPath =
    'docs/ai/framework/plans/render-delta-update-flow-inspector.data.cjs'

  const lanes = [
    { id: 'canonical', title: 'Canonical State', order: 1 },
    { id: 'transport', title: 'Committed Delivery', order: 2 },
    { id: 'projection', title: 'Render Projection', order: 3 },
    { id: 'render', title: 'Strategy and Handoff', order: 4 },
    { id: 'lifecycle', title: 'Lifecycle', order: 5 }
  ]

  const snapshotCacheEvidence = {
    measuredPhase: 'fullRehydrateReference',
    baseline:
      '56-point self-intersecting solid vector, 12 frames: fresh full snapshot p95 0.1 ms; accepted delta route performs 0 Render full rehydrates.',
    decision:
      'Retain the existing elementId-only derived projection as the semantic delta target; add no cache dimension and no vector geometry cache.',
    invalidation:
      'Remove, load reset, failed projection, failed resync, observer teardown, and Render teardown clear pending work immediately; matching mirror and projected-visual ownership are discarded only after visual release succeeds, while release failure retains exact elementId retry ownership.',
    equivalenceOracle:
      'At the same committed boundary, strategy data deep-equals {...element.save(), ...element.getAllComputedData()} and produces the same engine-neutral command trace.',
    cleanup:
      'Remove destroys its Render node before discarding matching mirror and projected-visual ownership; load and teardown release every tracked Scene Tree-projected node, retain failed elementId cleanup ownership, and discard each matching entry only after release succeeds.',
    memoryBound:
      'At stable boundaries there is at most one entry and one live Scene Tree-projected Render node per live non-workspace Scene Tree element, with no retained removed-node map; custom and overlay layer nodes stay under their own lifecycle owners.'
  }

  const steps = [
    {
      id: 'commit-scene-tree-delta',
      order: 1,
      laneId: 'canonical',
      title: 'Commit canonical element change',
      ownerPackage: '@asyra/scene-tree',
      purpose:
        'Apply one canonical mutation and emit an exact committed scalar, batch, record-patch, add, or remove change with before/after evidence.',
      inputs: [
        'validated element mutation request',
        'current authoritative raw and computed element state',
        'transaction mutation options'
      ],
      outputs: ['artifact:committed-scene-tree-delta'],
      conditions: [
        'Scene Tree remains the sole canonical owner of element raw and computed state.',
        'Scalar changes carry one key, before, after, and raw or computed owner provenance; transient scalar changes may be grouped into one option-preserving ordered batch that preserves each entry owner.',
        'Record patches describe top-level value changes and record set/remove changes with exact before evidence; every top-level value patch base must already exist in the computed snapshot and every top-level record base must already be a record.',
        'Record replacement and removal preserve own-property existence: an existing record value of undefined still carries a before property, while only an absent record id is encoded as an addition.',
        'Special property names are materialized as own enumerable data properties during canonical apply and replay.',
        'The canonical shared patch type permits explicit undefined in a record-child before or after envelope while top-level scalar values retain the DataTypes contract.',
        'A top-level key belongs to either the value-change map or the record-patch map; overlapping keys are rejected before canonical mutation.',
        'Within one top-level record, a record id belongs to either set or remove; overlap is rejected before canonical mutation.',
        'Equal writes are omitted and a record patch is collapsed into one committed change.',
        'Undo, redo, and persistence replay consume the carried owner provenance, never infer it from the key or current state, re-enter this same owner, and emit ordinary committed changes.',
        'A scalar replay without valid raw or computed owner provenance is rejected before mutation.'
      ],
      bypasses: [
        'A mutation that produces no semantic difference emits no Render delta.',
        'Load establishes state through the explicit load/rebuild route rather than synthesizing update deltas.'
      ],
      allowedContributors: [
        '@asyra/scene-tree element and computed components',
        '@asyra/props-manager committed projection',
        '@asyra/reactive-events transaction request'
      ],
      forbiddenContributors: [
        '@asyra/render snapshot state',
        'data-channel canonical state',
        'strategy or engine output',
        'app-specific invalidator keys'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/utils/src/types/scene-tree.ts',
        'docs/ai/framework/packages/utils.md',
        'packages/reactive-events/src/scene-tree/events.ts',
        'packages/reactive-events/src/scene-tree/publish.ts',
        'packages/reactive-events/src/__tests__/**',
        'docs/ai/framework/packages/reactive-events.md',
        'packages/scene-tree/src/sceneTree.ts',
        'packages/scene-tree/src/subscribes.ts',
        'packages/scene-tree/src/components/element-change-handler.ts',
        'packages/scene-tree/src/components/element.ts',
        'packages/scene-tree/src/components/computed.ts',
        'packages/scene-tree/src/__tests__/**',
        'docs/ai/framework/packages/scene-tree.md',
        'docs/ai/framework/plans/render-delta-update-plan.md'
      ],
      specRefs: [
        '#committed-delta-semantics',
        '#ordering-duplicates-and-missing-delivery',
        '#load-undo-redo-replay-remove-and-cleanup'
      ],
      failureOwnerStepId: 'commit-scene-tree-delta'
    },
    {
      id: 'deliver-ordered-delta',
      order: 1,
      laneId: 'transport',
      title: 'Deliver committed change in order',
      ownerPackage: '@asyra/factory',
      purpose:
        'Deliver each committed transaction journal entry exactly once and in journal order through the registered Scene Tree shared channel.',
      inputs: ['artifact:committed-scene-tree-delta'],
      outputs: ['artifact:ordered-shared-delta'],
      conditions: [
        'The channel transports an immutable transaction snapshot and does not own element state.',
        'Transaction-end delivery preserves journal order and each registered observer receives one delivery per committed entry.',
        'Undo, redo, and replay delivery use the same shared channel and ordering contract.',
        'Factory batch replay expansion preserves the raw or computed owner carried by every scalar entry.',
        'Factory patch inversion preserves record own-property provenance: a set entry with a before property whose value is undefined inverts to a set, while only an entry without a before property inverts to remove.',
        'Patch inversion materializes every top-level key and record id as an own enumerable data property, including special property names.',
        'Transport tests own duplicate and out-of-order prevention because the change schema has no independent Render revision.'
      ],
      bypasses: [
        'Rolled-back, discarded, or uncommitted journal entries are not delivered.',
        'A mutation with no shared Scene Tree channel option bypasses this projection route.'
      ],
      allowedContributors: [
        '@asyra/factory transaction journal',
        'registered Scene Tree Yjs shared channel',
        'shared-channel observer registry'
      ],
      forbiddenContributors: [
        'canonical element snapshots',
        'Render cache or strategy state',
        'a new data-channel revision authority',
        'observer-specific payload mutation'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/factory/src/data-transact.ts',
        'packages/factory/src/shared-data-channel.ts',
        'packages/factory/src/__tests__/**',
        'docs/ai/framework/packages/factory.md',
        'docs/ai/framework/plans/render-delta-update-plan.md'
      ],
      specRefs: [
        '#ordering-duplicates-and-missing-delivery',
        '#load-undo-redo-replay-remove-and-cleanup'
      ],
      failureOwnerStepId: 'deliver-ordered-delta'
    },
    {
      id: 'route-render-delta',
      order: 2,
      laneId: 'transport',
      title: 'Route the Render projection request',
      ownerPackage: '@asyra/preset',
      purpose:
        'Map each committed Scene Tree action and observer registration lifecycle to the matching public Render scene-tree store operation without assembling state.',
      inputs: [
        'artifact:ordered-shared-delta',
        'Render observer registration lifecycle'
      ],
      outputs: ['artifact:render-projection-request'],
      conditions: [
        'Add routes by element id, remove routes the removed id and parent, and scalar, batch, and patch changes retain their complete before/after envelope plus raw or computed owner provenance.',
        'The observer receives applied, resynced, removed, or failed projection evidence and never treats swallowed exceptions as correctness control flow.',
        'Initial registration and every re-registration install the observer before invoking the explicit authoritative Render rebuild route.',
        'A rebuild failure means registration fails and its cleanup rollback unregisters the observer and clears the Render projection.',
        'File-load completion invokes the explicit Render rebuild route.',
        'Observer teardown invokes Render projection cleanup.'
      ],
      bypasses: [
        'Selection and UI-context observers remain separate consumers.',
        'Disabled render-scene defaults do not register this observer.'
      ],
      allowedContributors: [
        '@asyra/preset data-channel registration',
        '@asyra/render public scene-tree store API',
        'file-load lifecycle events'
      ],
      forbiddenContributors: [
        'snapshot composition in Preset',
        'Scene Tree deep imports',
        'vector-specific change classification',
        'fallback visual output'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/preset/src/subscriptions/data-channel.ts',
        'packages/preset/src/__tests__/**',
        'docs/ai/framework/packages/preset.md',
        'docs/ai/framework/plans/render-delta-update-plan.md'
      ],
      specRefs: [
        '#snapshot-ownership-and-initial-source',
        '#explicit-resync-and-failure',
        '#load-undo-redo-replay-remove-and-cleanup'
      ],
      failureOwnerStepId: 'route-render-delta'
    },
    {
      id: 'seed-render-snapshot',
      order: 1,
      laneId: 'projection',
      title: 'Seed an explicit complete snapshot',
      ownerPackage: '@asyra/render',
      purpose:
        'Compose and install one complete derived snapshot for add or load by explicitly reading the authoritative Scene Tree owner.',
      inputs: [
        'artifact:render-projection-request',
        'public Scene Tree element reader',
        'add or load reason'
      ],
      outputs: ['artifact:complete-render-snapshot'],
      conditions: [
        'The snapshot is {...element.save(), ...element.getAllComputedData()} and Render owns only the derived copy.',
        'Add and load are the only ordinary seed reasons; first use and update may not seed implicitly.',
        'Workspace elements are not cached or rendered.',
        'Load clears every entry and pending update before rebuilding live elements.',
        'Any element rebuild failure fails the whole reload, clears its partial projection, and throws to the lifecycle caller.',
        'An unsuccessful visual add, including a strategy failure, is an add, reload, or resync rebuild failure rather than a successful hidden projection.',
        'The installed snapshot passes requested-id and non-empty-type completeness validation.',
        'An existing add target that throws or fails completeness validation clears stale output and returns failed.'
      ],
      bypasses: [
        'A missing add target clears its pending update and stale visual, then returns removed without emitting new output.',
        'Ordinary valid deltas use atomic projection instead of full seed.'
      ],
      allowedContributors: [
        '@asyra/scene-tree public element API',
        'Render scene-tree store',
        'RenderElementData contract'
      ],
      forbiddenContributors: [
        'strategy-owned Scene Tree reads',
        'empty or partial snapshots',
        'first-use cache-miss reseed',
        'app-specific snapshot fields'
      ],
      cacheDimensions: ['elementId'],
      cacheEvidence: snapshotCacheEvidence,
      implementationBoundary: [
        'packages/render/src/stores/scene-tree.ts',
        'packages/render/src/types.ts',
        'packages/render/src/__tests__/scene-tree-store.test.ts',
        'docs/ai/framework/packages/render.md',
        'docs/ai/framework/plans/render-delta-update-plan.md'
      ],
      specRefs: [
        '#snapshot-ownership-and-initial-source',
        '#profiling-and-cache-decision',
        '#equivalence-and-stale-output-oracle'
      ],
      failureOwnerStepId: 'seed-render-snapshot'
    },
    {
      id: 'apply-render-delta',
      order: 2,
      laneId: 'projection',
      title: 'Validate and apply delta atomically',
      ownerPackage: '@asyra/render',
      purpose:
        'Validate a complete base and every before image, then atomically install the scalar, batch, or record-patch result.',
      inputs: [
        'artifact:render-projection-request',
        'artifact:complete-render-snapshot'
      ],
      outputs: [
        'artifact:accepted-render-snapshot',
        'artifact:projection-mismatch'
      ],
      conditions: [
        'A complete elementId base is required and no update path seeds implicitly.',
        'Scalar before deep-equals the cached value in its declared raw or computed owner before after is installed.',
        'Every scalar and batch entry validates and updates only its declared raw or computed owner; Render never infers ownership from key presence or a hard-coded property list.',
        'Every scalar, batch, and patch top-level base must be an own property and pass before equality; inherited or absent bases route to resync.',
        'A raw value shadowed by a same-name computed value updates the raw slice without publishing the shadowed raw value through the direct visual route.',
        'Every batch precondition validates before any batch value is installed.',
        'Record additions require absence; replacements and removals require exact before values; the top-level record base must be a record.',
        'Deep before and effective-value comparison is cycle-safe for distinct cyclic records and arrays and retains exact sparse-array semantics: an array hole and an own undefined slot are not equivalent.',
        'The candidate merged snapshot retains the requested id, non-empty type, and non-workspace type before install; an incomplete candidate is a projection mismatch.',
        'Accepted changes install a new top-level snapshot and clone every changed record.',
        'Multiple accepted changes for one element preserve commit order and may coalesce to one frame.'
      ],
      bypasses: [
        'Missing base or any precondition mismatch bypasses all partial mutation and routes to explicit resync.',
        'A valid direct x, y, rotation, or visible change may use the direct visual property route after snapshot installation.'
      ],
      allowedContributors: [
        'Render-owned derived snapshot',
        'committed scalar, batch, or record patch',
        'deep equality and immutable record copy helpers'
      ],
      forbiddenContributors: [
        'empty-object record fallback',
        'silent cache-miss reseed',
        'partial batch publication',
        'strategy Scene Tree reads',
        'hard-coded vector invalidator keys'
      ],
      cacheDimensions: ['elementId'],
      cacheEvidence: snapshotCacheEvidence,
      implementationBoundary: [
        'packages/render/src/stores/scene-tree.ts',
        'packages/render/src/__tests__/scene-tree-store.test.ts',
        'docs/ai/framework/packages/render.md',
        'docs/ai/framework/plans/render-delta-update-plan.md'
      ],
      specRefs: [
        '#committed-delta-semantics',
        '#ordering-duplicates-and-missing-delivery',
        '#frame-ordering-and-strategy-input',
        '#equivalence-and-stale-output-oracle'
      ],
      failureOwnerStepId: 'apply-render-delta'
    },
    {
      id: 'resync-render-snapshot',
      order: 3,
      laneId: 'projection',
      title: 'Resync or fail closed',
      ownerPackage: '@asyra/render',
      purpose:
        'Recover a detected projection mismatch from one explicit authoritative snapshot or remove stale output when recovery is impossible.',
      inputs: [
        'artifact:projection-mismatch',
        'public Scene Tree element reader'
      ],
      outputs: ['artifact:render-resync-outcome'],
      conditions: [
        'The mismatched entry and pending update are invalidated before the authoritative read.',
        'One successful full composition replaces the entire entry, then uses the existing Render add-or-update route for one synchronous authoritative visual rebuild.',
        'When the authoritative visual rebuild succeeds, the step returns resynced; a strategy rebuild failure clears the visual and returns failed.',
        'A canonically missing element removes the visual and returns removed.',
        'An invalid or unavailable authoritative snapshot clears the visual and returns failed.',
        'Every mismatch, resync, removal, and failure emits bounded owner evidence.'
      ],
      bypasses: [
        'A valid delta never performs this full read.',
        'No resync outcome renders the rejected partial delta.'
      ],
      allowedContributors: [
        '@asyra/scene-tree public element API',
        'Render scene-tree store',
        'existing Render add-or-update strategy route',
        'structured projection outcome diagnostics'
      ],
      forbiddenContributors: [
        'silent fallback snapshot',
        'strategy-level Scene Tree reads',
        'deferred success before the strategy rebuild outcome',
        'retry loops',
        'stale visual retention after failed resync'
      ],
      cacheDimensions: ['elementId'],
      cacheEvidence: snapshotCacheEvidence,
      implementationBoundary: [
        'packages/render/src/stores/scene-tree.ts',
        'packages/render/src/layers/scene/render-layer.ts',
        'packages/render/src/__tests__/scene-tree-store.test.ts',
        'docs/ai/framework/packages/render.md',
        'docs/ai/framework/plans/render-delta-update-plan.md'
      ],
      specRefs: [
        '#explicit-resync-and-failure',
        '#equivalence-and-stale-output-oracle'
      ],
      failureOwnerStepId: 'resync-render-snapshot'
    },
    {
      id: 'flush-render-snapshot',
      order: 4,
      laneId: 'projection',
      title: 'Flush one complete frame snapshot',
      ownerPackage: '@asyra/render',
      purpose:
        'Coalesce accepted updates per element and hand the final complete snapshot to the normal Render layer update route once per frame.',
      inputs: [
        'artifact:accepted-render-snapshot'
      ],
      outputs: ['artifact:complete-strategy-request'],
      conditions: [
        'Commit order is reflected in the final derived snapshot before pending ids are cleared.',
        'A computed update invokes the strategy with the complete final RenderElementData snapshot.',
        'A mixed direct/computed batch uses the complete strategy route.',
        'The complete snapshot synchronizes generic parentId and children hierarchy while preserving stable sibling order when ownership is unchanged.',
        'Direct property-only updates preserve the existing direct route after successful snapshot projection.',
        'A rejected or failed projection cannot reach this step.'
      ],
      bypasses: [
        'No pending accepted update means no strategy request.',
        'A removed element is absent from pending work.'
      ],
      allowedContributors: [
        'Render scene-tree pending update set',
        'Render frame layer registration',
        'complete RenderElementData snapshot'
      ],
      forbiddenContributors: [
        'partial delta objects',
        'fresh Scene Tree reads on the valid path',
        'vector-specific invalidation maps',
        'fallback output'
      ],
      cacheDimensions: ['elementId'],
      cacheEvidence: snapshotCacheEvidence,
      implementationBoundary: [
        'packages/render/src/stores/scene-tree.ts',
        'packages/render/src/render.ts',
        'packages/render/src/__tests__/scene-tree-store.test.ts',
        'packages/render/src/__tests__/**',
        'docs/ai/framework/packages/render.md',
        'docs/ai/framework/plans/render-delta-update-plan.md'
      ],
      specRefs: [
        '#frame-ordering-and-strategy-input',
        '#equivalence-and-stale-output-oracle'
      ],
      failureOwnerStepId: 'flush-render-snapshot'
    },
    {
      id: 'execute-render-strategy',
      order: 1,
      laneId: 'render',
      title: 'Execute strategy from complete data',
      ownerPackage: '@asyra/render',
      purpose:
        'Resolve the registered engine-neutral strategy and rebuild visual commands from one complete derived snapshot.',
      inputs: [
        'artifact:complete-strategy-request',
        'artifact:render-resync-outcome'
      ],
      outputs: ['artifact:engine-neutral-draw-commands'],
      conditions: [
        'Every computed render update reruns the selected strategy from complete RenderElementData.',
        'Non-vector and vector strategies retain the same public input signature.',
        'The produced command trace equals the trace from a fresh authoritative snapshot.',
        'No new dependency graph or vector geometry cache is introduced because profiling did not justify it.'
      ],
      bypasses: [
        'A direct property-only update bypasses full strategy execution.',
        'A failed projection or resync produces no strategy execution.'
      ],
      allowedContributors: [
        '@asyra/render strategy registry',
        'Preset-registered engine-neutral strategies',
        'RenderGraphics engine-neutral draw operations'
      ],
      forbiddenContributors: [
        'Scene Tree reads',
        'partial delta input',
        'Render-store hard-coded vector keys',
        'Pixi types or methods',
        'fallback geometry'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/render/src/layers/scene/render-layer.ts',
        'packages/render/src/types.ts',
        'packages/render/src/__tests__/**',
        'packages/preset/src/__tests__/**',
        'apps/asyra-design/e2e/render-delta-performance.spec.ts',
        'docs/ai/framework/packages/render.md',
        'docs/ai/framework/PLANS.md',
        'docs/ai/framework/plans/render-delta-update-plan.md'
      ],
      specRefs: [
        '#frame-ordering-and-strategy-input',
        '#profiling-and-cache-decision',
        '#equivalence-and-stale-output-oracle'
      ],
      failureOwnerStepId: 'execute-render-strategy'
    },
    {
      id: 'handoff-engine-commands',
      order: 2,
      laneId: 'render',
      title: 'Handoff engine-neutral commands',
      ownerPackage: '@asyra/render',
      purpose:
        'Execute and flush the existing engine-neutral command stream without changing the RenderEngine or Pixi boundary.',
      inputs: ['artifact:engine-neutral-draw-commands'],
      outputs: ['artifact:render-frame-result'],
      conditions: [
        'Render issues only existing @asyra/render-engine commands and opaque handles.',
        'The frame handoff preserves command ordering and uses the normal layer/update/flush route.',
        'The dense-vector fixture meets count, total, p95, max, and combined p95 budgets.'
      ],
      bypasses: [
        'A non-dirty frame emits no surface flush.',
        'A failed projection emits no partial command stream.'
      ],
      allowedContributors: [
        '@asyra/render runtime and engine-neutral command buffer',
        '@asyra/render-engine public contract',
        'formal profiling sink'
      ],
      forbiddenContributors: [
        '@asyra/render-engine-pixi changes',
        'Pixi imports in Render',
        'semantic performance-budget loosening',
        'fallback surface output'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/render/src/render.ts',
        'packages/render/src/types/render-object.ts',
        'packages/render/src/__tests__/**',
        'apps/asyra-design/e2e/render-delta-performance.spec.ts',
        'docs/ai/framework/packages/render.md',
        'docs/ai/framework/plans/render-delta-update-plan.md'
      ],
      specRefs: [
        '#profiling-and-cache-decision',
        '#equivalence-and-stale-output-oracle',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'handoff-engine-commands'
    },
    {
      id: 'cleanup-render-projection',
      order: 1,
      laneId: 'lifecycle',
      title: 'Clear derived projection state',
      ownerPackage: '@asyra/render',
      purpose:
        'Remove entries, pending work, Scene Tree-projected Render nodes, and stale workspace identity deterministically on element removal, load reset, observer teardown, and Render teardown.',
      inputs: [
        'remove projection request',
        'load reset request',
        'Preset observer teardown',
        'Render teardown'
      ],
      outputs: ['artifact:render-projection-cleanup'],
      conditions: [
        'Remove clears the matching pending id before visual release, then destroys the detached Render node and releases its abstract engine handle and resources.',
        'Mirror ownership and projected visual ownership are tracked separately; only after visual release succeeds are the matching mirror and projected id discarded.',
        'Removing a projected parent detaches its live projected children and destroys only the removed parent; children that remain canonical keep their own nodes and engine handles.',
        'Load clears every entry and pending update before explicit rebuild.',
        'A load with no current workspace clears retained workspace metadata and resets the Render workspace label and transform to neutral values.',
        'Observer and Render teardown clear pending flags and scheduled work, then idempotently release every Scene Tree-projected visual node and discard each successfully released entry and projected id.',
        'On a release failure, the mirror and Render layer retain exact retry ownership, cleanup continues across other projected nodes, and subsequent cleanup retries the failed node.',
        'Stable entry count and Scene Tree-projected Render-node count never exceed live non-workspace Scene Tree element count; custom and overlay nodes are not part of this projection bound.',
        'Repeated add, remove, load, resync, and teardown cannot retain orphaned snapshots, projected nodes, removed-node restore entries, or prior-engine handles.',
        'Undo and redo re-add from a complete authoritative snapshot and do not require Render node identity preservation.'
      ],
      bypasses: [
        'Cleanup is idempotent when no matching entry or pending update exists.'
      ],
      allowedContributors: [
        'Render scene-tree store lifecycle API',
        'Render scene layer node destruction',
        'Preset data-channel observer cleanup',
        'Render lifecycle cleanup'
      ],
      forbiddenContributors: [
        'orphaned element snapshots',
        'orphaned pending updates',
        'removed-node restore caches',
        'prior-engine object handles',
        'new RenderEngine or Pixi cleanup semantics',
        'app-specific teardown branches'
      ],
      cacheDimensions: ['elementId'],
      cacheEvidence: snapshotCacheEvidence,
      implementationBoundary: [
        'packages/render/src/render.ts',
        'packages/render/src/stores/scene-tree.ts',
        'packages/render/src/layers/scene/render-layer.ts',
        'packages/render/src/__tests__/render.test.ts',
        'packages/render/src/__tests__/render-engine-adapter.test.ts',
        'packages/render/src/__tests__/scene-tree-store.test.ts',
        'packages/preset/src/subscriptions/data-channel.ts',
        'packages/preset/src/__tests__/**',
        'docs/ai/framework/packages/render.md',
        'docs/ai/framework/packages/preset.md',
        'docs/ai/framework/plans/render-delta-update-plan.md'
      ],
      specRefs: [
        '#load-undo-redo-replay-remove-and-cleanup',
        '#profiling-and-cache-decision',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'cleanup-render-projection'
    }
  ]

  const routes = [
    {
      id: 'commit-to-shared-delivery',
      from: 'commit-scene-tree-delta',
      to: 'deliver-ordered-delta',
      kind: 'normal',
      predicate: 'the Scene Tree transaction commits a shared change',
      producedArtifacts: ['artifact:committed-scene-tree-delta']
    },
    {
      id: 'deliver-to-render-observer',
      from: 'deliver-ordered-delta',
      to: 'route-render-delta',
      kind: 'normal',
      predicate: 'the Render Scene Tree observer is registered',
      producedArtifacts: ['artifact:ordered-shared-delta']
    },
    {
      id: 'registration-or-reregistration-seed',
      from: 'route-render-delta',
      to: 'seed-render-snapshot',
      kind: 'conditional',
      predicate:
        'the Render observer has just been installed for an initial registration or re-registration',
      producedArtifacts: ['artifact:render-projection-request']
    },
    {
      id: 'add-or-load-seed',
      from: 'route-render-delta',
      to: 'seed-render-snapshot',
      kind: 'conditional',
      predicate: 'the request is add or file-load rebuild',
      producedArtifacts: ['artifact:render-projection-request']
    },
    {
      id: 'update-existing-snapshot',
      from: 'route-render-delta',
      to: 'apply-render-delta',
      kind: 'conditional',
      predicate: 'the request is scalar, batch, or record patch',
      producedArtifacts: ['artifact:render-projection-request']
    },
    {
      id: 'remove-load-or-observer-cleanup',
      from: 'route-render-delta',
      to: 'cleanup-render-projection',
      kind: 'conditional',
      predicate:
        'the request is remove, load reset, or Preset observer teardown',
      producedArtifacts: ['artifact:render-projection-request']
    },
    {
      id: 'seed-to-frame',
      from: 'seed-render-snapshot',
      to: 'flush-render-snapshot',
      kind: 'normal',
      predicate: 'a complete add or load snapshot is installed',
      producedArtifacts: ['artifact:complete-render-snapshot']
    },
    {
      id: 'accepted-delta-to-frame',
      from: 'apply-render-delta',
      to: 'flush-render-snapshot',
      kind: 'normal',
      predicate:
        'every delta precondition and candidate completeness check validates',
      producedArtifacts: ['artifact:accepted-render-snapshot']
    },
    {
      id: 'mismatch-to-resync',
      from: 'apply-render-delta',
      to: 'resync-render-snapshot',
      kind: 'failure',
      predicate:
        'the base is missing, any before/record precondition fails, or an incomplete candidate is produced',
      producedArtifacts: ['artifact:projection-mismatch']
    },
    {
      id: 'resync-to-strategy',
      from: 'resync-render-snapshot',
      to: 'execute-render-strategy',
      kind: 'conditional',
      predicate:
        'one complete authoritative snapshot is composed for the synchronous visual rebuild',
      producedArtifacts: ['artifact:render-resync-outcome']
    },
    {
      id: 'resync-to-cleanup',
      from: 'resync-render-snapshot',
      to: 'cleanup-render-projection',
      kind: 'failure',
      predicate:
        'the canonical element is missing, full snapshot composition fails, or the strategy rebuild fails',
      producedArtifacts: ['artifact:render-resync-outcome']
    },
    {
      id: 'snapshot-to-strategy',
      from: 'flush-render-snapshot',
      to: 'execute-render-strategy',
      kind: 'normal',
      predicate: 'a complete computed snapshot is pending for the frame',
      producedArtifacts: ['artifact:complete-strategy-request']
    },
    {
      id: 'strategy-to-engine',
      from: 'execute-render-strategy',
      to: 'handoff-engine-commands',
      kind: 'normal',
      predicate: 'the strategy emits an engine-neutral command trace',
      producedArtifacts: ['artifact:engine-neutral-draw-commands']
    },
    {
      id: 'render-frame-terminal',
      from: 'handoff-engine-commands',
      kind: 'terminal',
      predicate: 'the existing RenderEngine handoff completes the frame',
      producedArtifacts: ['artifact:render-frame-result']
    },
    {
      id: 'cleanup-terminal',
      from: 'cleanup-render-projection',
      kind: 'terminal',
      predicate:
        'derived entries, pending work, and Scene Tree-projected visual nodes are cleared',
      producedArtifacts: ['artifact:render-projection-cleanup']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:committed-scene-tree-delta',
      ownerStepId: 'commit-scene-tree-delta',
      consumerStepIds: ['deliver-ordered-delta'],
      channel: '@asyra/reactive-events transaction journal',
      terminal: false
    },
    {
      id: 'artifact:ordered-shared-delta',
      ownerStepId: 'deliver-ordered-delta',
      consumerStepIds: ['route-render-delta'],
      channel: 'Scene Tree shared data channel',
      terminal: false
    },
    {
      id: 'artifact:render-projection-request',
      ownerStepId: 'route-render-delta',
      consumerStepIds: [
        'seed-render-snapshot',
        'apply-render-delta',
        'cleanup-render-projection'
      ],
      channel: '@asyra/render public store API',
      terminal: false
    },
    {
      id: 'artifact:complete-render-snapshot',
      ownerStepId: 'seed-render-snapshot',
      consumerStepIds: ['apply-render-delta', 'flush-render-snapshot'],
      channel: 'Render scene-tree store',
      terminal: false
    },
    {
      id: 'artifact:accepted-render-snapshot',
      ownerStepId: 'apply-render-delta',
      consumerStepIds: ['flush-render-snapshot'],
      channel: 'Render scene-tree store',
      terminal: false
    },
    {
      id: 'artifact:projection-mismatch',
      ownerStepId: 'apply-render-delta',
      consumerStepIds: ['resync-render-snapshot'],
      channel: 'Render projection outcome',
      terminal: false
    },
    {
      id: 'artifact:render-resync-outcome',
      ownerStepId: 'resync-render-snapshot',
      consumerStepIds: [
        'execute-render-strategy',
        'cleanup-render-projection'
      ],
      channel: 'Render projection outcome',
      terminal: false
    },
    {
      id: 'artifact:complete-strategy-request',
      ownerStepId: 'flush-render-snapshot',
      consumerStepIds: ['execute-render-strategy'],
      channel: 'Render layer update',
      terminal: false
    },
    {
      id: 'artifact:engine-neutral-draw-commands',
      ownerStepId: 'execute-render-strategy',
      consumerStepIds: ['handoff-engine-commands'],
      channel: '@asyra/render-engine command contract',
      terminal: false
    },
    {
      id: 'artifact:render-frame-result',
      ownerStepId: 'handoff-engine-commands',
      consumerStepIds: [],
      channel: 'render frame lifecycle',
      terminal: true
    },
    {
      id: 'artifact:render-projection-cleanup',
      ownerStepId: 'cleanup-render-projection',
      consumerStepIds: [],
      channel: 'Render projection lifecycle',
      terminal: true
    }
  ]

  const allStepIds = steps.map((step) => step.id)
  const invariants = [
    {
      id: 'scene-tree-remains-canonical',
      statement:
        'Scene Tree owns canonical element data; Factory transports changes and Render owns only a disposable derived snapshot.',
      stepIds: [
        'commit-scene-tree-delta',
        'deliver-ordered-delta',
        'route-render-delta',
        'seed-render-snapshot'
      ],
      artifactIds: [
        'artifact:committed-scene-tree-delta',
        'artifact:complete-render-snapshot'
      ],
      specRefs: [
        '#authority-and-baseline',
        '#snapshot-ownership-and-initial-source'
      ]
    },
    {
      id: 'projection-is-atomic-and-exact',
      statement:
        'A delta validates every precondition before installation, and accepted or resynced strategy data equals a fresh authoritative snapshot.',
      stepIds: [
        'apply-render-delta',
        'resync-render-snapshot',
        'flush-render-snapshot',
        'execute-render-strategy'
      ],
      artifactIds: [
        'artifact:accepted-render-snapshot',
        'artifact:render-resync-outcome',
        'artifact:complete-strategy-request'
      ],
      specRefs: [
        '#committed-delta-semantics',
        '#equivalence-and-stale-output-oracle'
      ]
    },
    {
      id: 'projection-fails-closed',
      statement:
        'Missing or mismatched base data never produces partial or fallback output; one explicit resync succeeds or stale output is removed.',
      stepIds: [
        'apply-render-delta',
        'resync-render-snapshot',
        'cleanup-render-projection'
      ],
      artifactIds: [
        'artifact:projection-mismatch',
        'artifact:render-resync-outcome',
        'artifact:render-projection-cleanup'
      ],
      specRefs: ['#explicit-resync-and-failure']
    },
    {
      id: 'cache-dimension-stays-bounded',
      statement:
        'The existing derived projection is keyed only by elementId, live Render nodes are bounded by live non-workspace elements with no removed-node restore map, and no vector geometry cache is added.',
      stepIds: [
        'seed-render-snapshot',
        'apply-render-delta',
        'resync-render-snapshot',
        'flush-render-snapshot',
        'cleanup-render-projection'
      ],
      artifactIds: [
        'artifact:complete-render-snapshot',
        'artifact:render-projection-cleanup'
      ],
      specRefs: ['#profiling-and-cache-decision']
    },
    {
      id: 'engine-boundary-is-unchanged',
      statement:
        'Strategies and Render continue emitting engine-neutral commands; neither RenderEngine nor Pixi semantics change.',
      stepIds: ['execute-render-strategy', 'handoff-engine-commands'],
      artifactIds: ['artifact:engine-neutral-draw-commands'],
      specRefs: ['#scope', '#definition-of-done']
    }
  ]

  const acceptanceContracts = [
    {
      id: 'delta-equivalence',
      title: 'Scalar, batch, patch, and coalescing equivalence',
      stepIds: allStepIds,
      specRefs: [
        '#committed-delta-semantics',
        '#equivalence-and-stale-output-oracle'
      ],
      assertions: [
        'accepted scalar, atomic batch, record set/remove patch, direct property, mixed raw/computed same-name ownership, mixed batch, and coalesced frame output deep-equals fresh authoritative snapshot output'
      ]
    },
    {
      id: 'failure-and-resync',
      title: 'Missing, duplicate, out-of-order, and invalid-base behavior',
      stepIds: [
        'deliver-ordered-delta',
        'apply-render-delta',
        'resync-render-snapshot',
        'cleanup-render-projection'
      ],
      specRefs: [
        '#ordering-duplicates-and-missing-delivery',
        '#explicit-resync-and-failure'
      ],
      assertions: [
        'Factory prevents duplicate/out-of-order delivery; detectable mismatch performs one explicit resync; missing or invalid canonical state removes stale output',
        'an incomplete candidate enters explicit resync and returns failed when the authoritative snapshot remains incomplete',
        'resync returns resynced only after its synchronous authoritative strategy rebuild succeeds; a strategy rebuild failure clears stale output and returns failed'
      ]
    },
    {
      id: 'lifecycle-parity',
      title: 'Load, undo, redo, replay, remove, and teardown parity',
      stepIds: allStepIds,
      specRefs: ['#load-undo-redo-replay-remove-and-cleanup'],
      assertions: [
        'all state transitions use the canonical committed route or explicit registration/load rebuild and leave no orphaned snapshot, pending update, removed Render node, or prior-engine handle',
        'the formal app oracle deep-compares fresh and strategy snapshots after action, Factory undo replay, Factory redo replay, and core.load rebuild',
        'same-name raw and computed fields preserve their carried owner through rollback, undo, redo, and replay',
        'observer re-registration immediately rebuilds from current Scene Tree state, remove destroys the detached node, and redo creates a fresh equivalent node',
        'mirror and projected-visual ownership are discarded only after release succeeds; a failed release retains elementId retry ownership while cleanup continues across other projected ids'
      ]
    },
    {
      id: 'non-vector-compatibility',
      title: 'Non-vector and public strategy compatibility',
      stepIds: [
        'apply-render-delta',
        'flush-render-snapshot',
        'execute-render-strategy'
      ],
      specRefs: ['#frame-ordering-and-strategy-input'],
      assertions: [
        'non-vector strategies receive the unchanged complete RenderElementData signature and rerun without a dependency migration'
      ]
    },
    {
      id: 'dense-vector-budget',
      title: 'Dense-vector formal performance budget',
      stepIds: [
        'commit-scene-tree-delta',
        'apply-render-delta',
        'execute-render-strategy',
        'handoff-engine-commands'
      ],
      specRefs: ['#profiling-and-cache-decision'],
      assertions: [
        '12 delta applies, 0 Render full rehydrates, every phase count is 12, per-phase total/p95/max budgets pass, and combined p95 is at most 12 ms'
      ]
    }
  ]

  const data = {
    schema: { id: 'asyra.flow-inspector', version: 2 },
    target: {
      id: 'render-delta-update',
      kind: 'system',
      title: 'Render Delta Update Pipeline Inspector',
      subtitle:
        'Owner and failure map from canonical Scene Tree commit through ordered delivery, exact Render projection, strategy execution, engine handoff, and cleanup.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'render-delta-update-plan.md',
      inspectorOwner: 'render-delta-update-flow-inspector.data.cjs'
    },
    links: [
      {
        id: 'product-contract',
        label: 'Render Delta Update Plan',
        href: './render-delta-update-plan.md',
        kind: 'authority'
      },
      {
        id: 'inspector-data',
        label: 'Inspector Data',
        href: './render-delta-update-flow-inspector.data.cjs',
        kind: 'source'
      },
      {
        id: 'performance-oracle',
        label: 'Dense Vector Performance Oracle',
        href: '../../../../apps/asyra-design/e2e/render-delta-performance.spec.ts',
        kind: 'test'
      },
      {
        id: 'inspector-readiness-rule',
        label: 'Inspector Contract Readiness',
        href: '../rules/inspector-contract-readiness.md',
        kind: 'framework'
      },
      {
        id: 'inspector-execution-rule',
        label: 'Inspector Step Execution',
        href: '../rules/inspector-step-execution.md',
        kind: 'framework'
      },
      {
        id: 'flow-inspector-contract',
        label: 'Flow Inspector Contract',
        href: './flow-inspector-dashboard-plan.md',
        kind: 'framework'
      }
    ],
    lanes,
    steps,
    routes,
    artifacts,
    invariants,
    acceptanceContracts
  }

  const freeze = (value) => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
      return value
    }
    Object.freeze(value)
    Object.values(value).forEach(freeze)
    return value
  }

  freeze(data)

  if (typeof globalThis !== 'undefined') {
    globalThis.FLOW_INSPECTOR_DATA = data
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = data
  }
})()
