;(function () {
  'use strict'

  const specPath =
    'docs/ai/apps/asyra-design/plans/ai-conversational-drawing-performance-plan.md'
  const inspectorPath =
    'docs/ai/apps/asyra-design/plans/ai-conversational-drawing-performance-flow-inspector.data.cjs'

  const lanes = [
    { id: 'profile-intake', title: 'Profile Intake', order: 1 },
    { id: 'canonical-creation', title: 'Canonical Creation', order: 2 },
    { id: 'shared-delivery', title: 'Shared Delivery', order: 3 },
    { id: 'projection-proof', title: 'Projection and Proof', order: 4 }
  ]

  const steps = [
    {
      id: 'accept-profiled-ai-drawing-turn',
      order: 1,
      laneId: 'profile-intake',
      title: 'Accept one profiled drawing turn',
      ownerPackage: 'Asyra Design performance harness',
      purpose:
        'Start one production-build reference turn with detached monotonic timing and count observers while separating product spans from server, browser, assertion, screenshot, and recording overhead.',
      inputs: [
        'committed tabby reference fixture',
        'exact ai=mock and aiDelivery URL values',
        'fresh canonical and collaboration document identity',
        'production App build',
        'reference host and warm-run protocol',
        'deterministic 16-item Mock AI CRDT fixture'
      ],
      outputs: ['artifact:profiled-ai-drawing-turn'],
      conditions: [
        'One unmeasured warm-up precedes three measured runs on the same reference host, fixture, build, browser configuration, and fresh-document lifecycle.',
        'The profiled turn records atomic or progressive mode exactly as resolved by the App and retains the accepted item, point, and semantic-role inputs unchanged.',
        'Product monotonic marks and harness wall time use separate channels; server build/start, browser launch, full-snapshot assertions, screenshots, recording, and teardown never enter product spans.',
        'Detached observers cannot alter batching, shared delivery, transaction, history, canonical state, Render scheduling, retry, cancellation, or settlement.',
        'One matched attribution-only run compares the Contents panel present and diagnostically omitted while preserving exact canonical and history results; neither variant is release budget evidence.'
      ],
      bypasses: [
        'A development build, stale document, reused server, missing fixture, or incomplete timing channel produces no release-budget evidence.',
        'An aborted or failed warm-up is reported and never counted as one of the three measured runs.'
      ],
      allowedContributors: [
        'Asyra Design E2E-owned App and collaboration servers',
        'browser performance and monotonic clock APIs',
        'read-only owner timing observers',
        'committed deterministic provider and drawing fixtures',
        'exact profiling-only Contents-panel attribution mode'
      ],
      forbiddenContributors: [
        'Date-based cross-process duration reconstruction',
        'diagnostics that mutate product scheduling or state',
        'test-only canonical or Render shortcuts',
        'generated screenshot or recording data as semantic authority',
        'using the diagnostically omitted Contents panel as release budget evidence'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/e2e',
        'apps/asyra-design/src/app',
        'apps/asyra-design/src/ai',
        'apps/asyra-design/src/init',
        'apps/asyra-design/__tests__',
        'apps/asyra-design/src/app/__tests__',
        'docs/ai/apps/asyra-design/bdd-features'
      ],
      specRefs: [
        '#measured-baseline',
        '#performance-measurement-contract',
        '#product-cases'
      ],
      failureOwnerStepId: 'accept-profiled-ai-drawing-turn'
    },
    {
      id: 'prepare-ordered-app-composition-batches',
      order: 1,
      laneId: 'canonical-creation',
      title: 'Prepare ordered App composition batches',
      ownerPackage: 'Asyra Design AI actions and common APIs',
      purpose:
        'Turn one validated composition descriptor into ordered atomic or progressive common-API batch requests without changing accepted topology, delivery mode, transaction ownership, or history intent.',
      inputs: [
        'artifact:profiled-ai-drawing-turn',
        'validated composition descriptor',
        'exact App-owned atomic or progressive delivery mode',
        'Feature-owned AbortSignal'
      ],
      outputs: [
        'artifact:ordered-app-composition-batches',
        'artifact:app-batch-timing-sample'
      ],
      conditions: [
        'The App preserves accepted item order, every path and point, canonical-id generation ownership, and the existing 256-item transient maximum.',
        'Atomic mode retains transaction-end shared delivery; progressive mode retains immediate shared delivery and host yield after each point-aware batch.',
        'One intact over-target element remains one accepted batch, and no performance budget becomes an item, path, point, payload, or composition ceiling.',
        'The App emits one outer transaction intent and one intended history action for the complete mutating user turn.'
      ],
      bypasses: [
        'Clarification and no-change turns create no composition batches or history action.',
        'Abort before mutation emits no later batch.',
        'Invalid finite topology fails through the existing schema owner rather than entering a faster path.'
      ],
      allowedContributors: [
        'artifact:profiled-ai-drawing-turn',
        'registered Asyra Design AI action schemas',
        'apps/asyra-design/src/common-apis public boundaries',
        'App-owned delivery mode and host-yield policy'
      ],
      forbiddenContributors: [
        'reduced VTracer detail or bitmap replacement',
        'provider-selected canonical ids',
        'AI-only canonical or Render mutation',
        'one App transaction or history action per network batch'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/ai',
        'apps/asyra-design/src/common-apis',
        'apps/asyra-design/src/ai/__tests__',
        'apps/asyra-design/src/common-apis/__tests__',
        'apps/asyra-design/e2e'
      ],
      specRefs: [
        '#non-negotiable-equivalence',
        '#profiling-first-owner-decisions',
        '#product-cases'
      ],
      failureOwnerStepId: 'prepare-ordered-app-composition-batches'
    },
    {
      id: 'apply-canonical-scene-batch',
      order: 2,
      laneId: 'canonical-creation',
      title: 'Apply one canonical Scene Tree batch',
      ownerPackage: '@asyra/scene-tree',
      purpose:
        'Apply each ordered App batch to the ordinary canonical Scene Tree with identical elements, hierarchy, properties, and ADD_ELEMENT evidence.',
      inputs: ['artifact:ordered-app-composition-batches'],
      outputs: [
        'artifact:canonical-scene-batches',
        'artifact:scene-tree-timing-sample'
      ],
      conditions: [
        'One canonical Group exists before ordered children and each child retains its original workspace topology under the ordinary group-local projection contract.',
        'Batch hierarchy application preserves exact ids, bounds, transforms, roles, fills, strokes, visibility, path order, and point order.',
        'Property component instance creation, child relationship binding, and owner registration may use a canonical batch path instead of repeating single-item delivery work.',
        'A batched property path preserves final canonical component ids and order, invalid-write rejection, history boundaries, replay evidence, persistence, and Collaboration exactly.',
        'The canonical owner emits the same ordered ADD_ELEMENT and property evidence consumed by transaction, replay, persistence, Render, and Collaboration.',
        'Any reduced traversal or allocation path is exactly equivalent to the ordinary valid-write and invalid-rejection semantics.'
      ],
      bypasses: [
        'A non-mutating turn never enters Scene Tree apply.',
        'A fatal canonical consistency failure rejects the existing transaction route and cannot commit an optimized prefix.'
      ],
      allowedContributors: [
        'artifact:ordered-app-composition-batches',
        '@asyra/core public Scene Tree facade',
        '@asyra/scene-tree canonical component and hierarchy owners',
        '@asyra/props-manager canonical property component owner'
      ],
      forbiddenContributors: [
        'direct package-private store mutation from the App',
        'discarded canonical change evidence',
        'batching that skips component construction, relationship binding, owner registration, or observable component changes',
        'post-hoc full-composition move or geometry rewrite',
        'fixture-specific Scene Tree behavior'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/scene-tree/src',
        'packages/core/src',
        'packages/props-manager/src',
        'packages/scene-tree/src/__tests__',
        'packages/core/src/__tests__',
        'packages/props-manager/src/__tests__'
      ],
      specRefs: [
        '#non-negotiable-equivalence',
        '#profiling-first-owner-decisions',
        '#product-cases'
      ],
      failureOwnerStepId: 'apply-canonical-scene-batch'
    },
    {
      id: 'record-history-and-shared-publication',
      order: 1,
      laneId: 'shared-delivery',
      title: 'Record history and shared publication',
      ownerPackage: '@asyra/factory',
      purpose:
        'Record canonical deliveries, preserve one turn-level Undo/Redo action, and construct atomic or progressive shared publications without replay or compensation drift.',
      inputs: ['artifact:canonical-scene-batches'],
      outputs: [
        'artifact:factory-history-commit',
        'artifact:shared-publications',
        'artifact:factory-timing-sample'
      ],
      conditions: [
        'Factory retains every canonical delivery and the source shared-delivery mode while committing exactly one intended local history action for the user turn.',
        'Atomic delivery publishes once after commit; progressive delivery publishes ordered canonical batches before turn settlement.',
        'Undo and Redo retain source batch boundaries and remain one local history action in each direction.',
        'Immediate publication rollback uses linked Factory compensation and never leaves a remotely visible failed prefix.'
      ],
      bypasses: [
        'A zero-mutation result creates no publication or history record.',
        'A fatal transaction failure produces no committed history action.',
        'A transaction-end atomic delivery does not publish before commit.'
      ],
      allowedContributors: [
        'artifact:canonical-scene-batches',
        'Factory transaction owner',
        'ordinary canonical delivery records',
        'existing shared-publication and replay contracts'
      ],
      forbiddenContributors: [
        'one history commit per progressive publication',
        'AI-specific replay or compensation',
        'dropped canonical deliveries',
        'early success before Factory commit'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/factory/src',
        'packages/factory/src/__tests__'
      ],
      specRefs: [
        '#performance-budgets',
        '#non-negotiable-equivalence',
        '#profiling-first-owner-decisions'
      ],
      failureOwnerStepId: 'record-history-and-shared-publication'
    },
    {
      id: 'transport-and-apply-remote-batches',
      order: 2,
      laneId: 'shared-delivery',
      title: 'Transport and apply remote batches',
      ownerPackage: 'Asyra Design Collaboration adapter',
      purpose:
        'Encode, send, receive, decode, and apply ordinary shared publications so a peer observes progressive canonical growth and converges without a server semantic owner.',
      inputs: ['artifact:shared-publications'],
      outputs: [
        'artifact:remote-canonical-batches',
        'artifact:collaboration-timing-sample'
      ],
      conditions: [
        'The local reference transport accepts every finite publication without an artificial message-size ceiling and preserves publication order.',
        'Actor B receives ordinary canonical deliveries, observes more than one increasing non-final element count before Actor A settles, and creates no local Undo action.',
        'Remote apply preserves exact canonical ids, topology, hierarchy, properties, and source delivery boundaries.',
        'Transport timing distinguishes encode, send, receive, decode, and remote canonical apply.'
      ],
      bypasses: [
        'Disconnected mode performs no send or remote apply while retaining the local canonical transaction semantics.',
        'Closed transport reports the existing send failure and never fabricates remote convergence.',
        'Cancellation before publication emits no later network work.'
      ],
      allowedContributors: [
        'artifact:shared-publications',
        '@asyra/collaboration public protocol',
        'Asyra Design collaboration lifecycle and WebSocket adapter',
        'Asyra Design memory-only reference server transport composition without a semantic owner',
        'ordinary remote Factory apply'
      ],
      forbiddenContributors: [
        'AI-specific transport protocol',
        'server-side canonical splitting or history decisions',
        'whole-document regeneration on the peer',
        'unbounded diagnostic payload copied into publications'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src',
        'apps/asyra-design/src/collaboration',
        'apps/asyra-design/collaboration-server.ts',
        'apps/asyra-design/__tests__/collaboration-server.test.mjs',
        'apps/asyra-design/src/init',
        'apps/asyra-design/src/features',
        'apps/asyra-design/src/init/__tests__',
        'apps/asyra-design/e2e'
      ],
      specRefs: [
        '#performance-budgets',
        '#non-negotiable-equivalence',
        '#product-cases'
      ],
      failureOwnerStepId: 'transport-and-apply-remote-batches'
    },
    {
      id: 'persist-committed-canonical-snapshots',
      order: 3,
      laneId: 'shared-delivery',
      title: 'Persist eligible local committed snapshots',
      ownerPackage: '@asyra/core and @asyra/persistence',
      purpose:
        'Capture and persist exact local action, undo, and redo snapshots while preserving FIFO durability evidence, separate committed and persisted statuses, and remote Collaboration ownership.',
      inputs: ['artifact:factory-history-commit'],
      outputs: [
        'artifact:committed-persistence-snapshots',
        'artifact:persistence-timing-sample'
      ],
      conditions: [
        'Every eligible local committed action, undo, and redo captures one deeply detached exact snapshot at that committed state and queues it for provider save in FIFO order.',
        'Snapshot capture preserves Scene Tree, Props, system context, registered save-hook output, version, and transaction-specific evidence without retaining live mutable references.',
        'Provider acknowledgement reports persisted separately from committed; FIFO processing preserves every snapshot, one failure reports persistence-failed, and a later committed snapshot still reaches the provider.',
        'Core persistence timing distinguishes canonical snapshot capture, save-hook isolation, provider save, and browser persistence work without changing product scheduling.'
      ],
      bypasses: [
        'A committed transaction with remote origin does not capture a snapshot or call the client persistence provider; its live canonical state remains owned by Collaboration apply and Render projection.',
        'No configured provider reports persistence-skipped without capturing or queuing a snapshot.',
        'Rollback, validation rejection, and snapshot-capture failure save no snapshot and retain the existing transaction status.',
        'Load reads the provider-authoritative snapshot through ordinary Core validation and migration before product state is exposed.'
      ],
      allowedContributors: [
        'artifact:factory-history-commit',
        'Core transaction status subscriber and public Scene Tree, Props, and system-context save facades',
        '@asyra/persistence public provider contract',
        'registered Core save hooks'
      ],
      forbiddenContributors: [
        'a coalesced or dropped committed snapshot',
        'live mutable canonical references in queued or provider-owned data',
        'AI-specific or fixture-specific persistence paths',
        'remote-origin client persistence',
        'transaction, history, Undo, Redo, or publication boundary changes',
        'diagnostic code that changes persistence scheduling'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src',
        'packages/core/src/__tests__',
        'packages/persistence/src',
        'packages/persistence/src/providers/__tests__'
      ],
      specRefs: [
        '#performance-measurement-contract',
        '#non-negotiable-equivalence',
        '#profiling-first-owner-decisions',
        '#product-cases'
      ],
      failureOwnerStepId: 'persist-committed-canonical-snapshots'
    },
    {
      id: 'project-visible-canonical-batches',
      order: 1,
      laneId: 'projection-proof',
      title: 'Project visible canonical batches',
      ownerPackage: '@asyra/render scene layer',
      purpose:
        'Project local and remote canonical batches through the ordinary Preset Vector route with bounded invalidation while retaining visible progressive steps and final pixels.',
      inputs: [
        'artifact:canonical-scene-batches',
        'artifact:remote-canonical-batches'
      ],
      outputs: [
        'artifact:visible-local-projection',
        'artifact:visible-remote-projection',
        'artifact:render-timing-sample'
      ],
      conditions: [
        'A local canonical batch produces the ordinary local scene projection; a remote canonical batch produces the same ordinary peer projection without waiting for the complete portrait.',
        'Any invalidation coalescing is bounded to one accepted canonical batch and does not collapse progressive mode into one final-only frame.',
        'Preset Vector rendering preserves exact ancestor transforms, topology, fills, strokes, hierarchy order, and complete uncropped output.',
        'Render timing distinguishes invalidation, strategy projection, resource update, and visible frame presentation.'
      ],
      bypasses: [
        'A canonical no-change produces no Render update.',
        'An invisible or removed element follows the ordinary Render strategy behavior rather than a performance fallback.',
        'Evidence-only timing and counters never enter visible rendering.'
      ],
      allowedContributors: [
        'artifact:canonical-scene-batches',
        'artifact:remote-canonical-batches',
        '@asyra/render scene-layer scheduling',
        '@asyra/preset ordinary Vector strategy'
      ],
      forbiddenContributors: [
        'AI-only renderer or bitmap replacement',
        'diagnostic or evidence geometry',
        'final-only peer projection in progressive mode',
        'Render-owned canonical state'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/render/src',
        'packages/preset/src',
        'packages/render/src/__tests__',
        'packages/preset/src/__tests__'
      ],
      specRefs: [
        '#performance-budgets',
        '#non-negotiable-equivalence',
        '#profiling-first-owner-decisions'
      ],
      failureOwnerStepId: 'project-visible-canonical-batches'
    },
    {
      id: 'evaluate-performance-and-equivalence',
      order: 2,
      laneId: 'projection-proof',
      title: 'Evaluate performance and equivalence',
      ownerPackage: 'Asyra Design performance E2E',
      purpose:
        'Evaluate three-run owner spans, product budgets, exact canonical equivalence, history boundaries, and synchronized live visual evidence without committing generated artifacts.',
      inputs: [
        'artifact:app-batch-timing-sample',
        'artifact:scene-tree-timing-sample',
        'artifact:factory-history-commit',
        'artifact:factory-timing-sample',
        'artifact:collaboration-timing-sample',
        'artifact:committed-persistence-snapshots',
        'artifact:persistence-timing-sample',
        'artifact:visible-local-projection',
        'artifact:visible-remote-projection',
        'artifact:render-timing-sample'
      ],
      outputs: ['artifact:performance-equivalence-proof'],
      conditions: [
        'The evaluator reports median and worst owner spans separately from harness overhead and names the first over-budget product owner.',
        'Balanced atomic, balanced progressive, peer-first-visible, peer-convergence, follow-up, full-flow, and maximum-detail budgets use the exact plan thresholds.',
        'Canonical equivalence compares ids, element and point counts, topology, hierarchy, bounds, transforms, roles, styles, visibility, background size, and transaction evidence before visual review.',
        'The default 16-item Mock AI CRDT correctness case proves ordinary two-actor convergence; the 7,112-element balanced gate remains change-aware and high-detail performance and CRDT gates remain independent opt-ins.',
        'Actor A gains exactly one Undo action per mutating turn, Actor B gains none, and Undo/Redo retain one action in each direction.',
        'Synchronized screenshots inspect the same measured live state with complete uncropped output, while generated screenshots, recordings, traces, profiles, and thumbnails remain ignored local artifacts.'
      ],
      bypasses: [
        'A run with missing owner spans, stale state, development build, or test-induced product scheduling is invalid and cannot satisfy a budget.',
        'A visually similar result with canonical drift fails equivalence.',
        'A faster final-only peer result fails progressive visibility.'
      ],
      allowedContributors: [
        'owner timing artifacts declared by this Inspector',
        'ordinary canonical and history queries',
        'bounded final exact snapshots',
        'synchronized live App screenshots'
      ],
      forbiddenContributors: [
        'screenshots as canonical semantics authority',
        'averages that hide a worst-run regression',
        'test harness time attributed to a product owner',
        'committed generated media or profile artifacts'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/e2e',
        'apps/asyra-design/src/ai/__tests__',
        'apps/asyra-design/src/init/__tests__',
        'docs/ai/apps/asyra-design/bdd-features',
        'docs/ai/apps/asyra-design/plans/__tests__'
      ],
      specRefs: [
        '#performance-measurement-contract',
        '#performance-budgets',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'evaluate-performance-and-equivalence'
    }
  ]

  const routes = [
    {
      id: 'route-profiled-turn-to-app',
      from: 'accept-profiled-ai-drawing-turn',
      to: 'prepare-ordered-app-composition-batches',
      kind: 'handoff',
      predicate: 'The reference turn and detached timing contract are valid.',
      producedArtifacts: ['artifact:profiled-ai-drawing-turn']
    },
    {
      id: 'route-app-batches-to-scene-tree',
      from: 'prepare-ordered-app-composition-batches',
      to: 'apply-canonical-scene-batch',
      kind: 'handoff',
      predicate: 'The validated mutating descriptor produced ordered batches.',
      producedArtifacts: ['artifact:ordered-app-composition-batches']
    },
    {
      id: 'route-app-timing-to-proof',
      from: 'prepare-ordered-app-composition-batches',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate:
        'App batch preparation completed or failed with a bounded span.',
      producedArtifacts: ['artifact:app-batch-timing-sample']
    },
    {
      id: 'route-canonical-batches-to-factory',
      from: 'apply-canonical-scene-batch',
      to: 'record-history-and-shared-publication',
      kind: 'handoff',
      predicate:
        'Canonical Scene Tree apply emitted ordinary ordered evidence.',
      producedArtifacts: ['artifact:canonical-scene-batches']
    },
    {
      id: 'route-local-canonical-batches-to-render',
      from: 'apply-canonical-scene-batch',
      to: 'project-visible-canonical-batches',
      kind: 'projection',
      predicate:
        'A local canonical batch is ready for ordinary Render projection.',
      producedArtifacts: ['artifact:canonical-scene-batches']
    },
    {
      id: 'route-scene-timing-to-proof',
      from: 'apply-canonical-scene-batch',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate: 'Scene Tree apply completed or failed with a bounded span.',
      producedArtifacts: ['artifact:scene-tree-timing-sample']
    },
    {
      id: 'route-shared-publications-to-collaboration',
      from: 'record-history-and-shared-publication',
      to: 'transport-and-apply-remote-batches',
      kind: 'publication',
      predicate: 'Collaboration is connected and a shared publication exists.',
      producedArtifacts: ['artifact:shared-publications']
    },
    {
      id: 'route-factory-evidence-to-proof',
      from: 'record-history-and-shared-publication',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate: 'Factory produced terminal transaction evidence.',
      producedArtifacts: [
        'artifact:factory-history-commit',
        'artifact:factory-timing-sample'
      ]
    },
    {
      id: 'route-local-commit-to-persistence',
      from: 'record-history-and-shared-publication',
      to: 'persist-committed-canonical-snapshots',
      kind: 'persistence',
      predicate:
        'A local Factory transaction committed with canonical history evidence.',
      producedArtifacts: ['artifact:factory-history-commit']
    },
    {
      id: 'route-remote-batches-to-render',
      from: 'transport-and-apply-remote-batches',
      to: 'project-visible-canonical-batches',
      kind: 'projection',
      predicate:
        'A remote canonical batch is ready for ordinary peer projection.',
      producedArtifacts: ['artifact:remote-canonical-batches']
    },
    {
      id: 'route-collaboration-timing-to-proof',
      from: 'transport-and-apply-remote-batches',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate:
        'Collaboration transport and remote apply emitted bounded spans.',
      producedArtifacts: ['artifact:collaboration-timing-sample']
    },
    {
      id: 'route-persistence-evidence-to-proof',
      from: 'persist-committed-canonical-snapshots',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate:
        'Committed snapshot and provider persistence evidence reached a terminal status.',
      producedArtifacts: [
        'artifact:committed-persistence-snapshots',
        'artifact:persistence-timing-sample'
      ]
    },
    {
      id: 'route-visible-projections-to-proof',
      from: 'project-visible-canonical-batches',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate:
        'The required local and remote visible milestones are available.',
      producedArtifacts: [
        'artifact:visible-local-projection',
        'artifact:visible-remote-projection',
        'artifact:render-timing-sample'
      ]
    },
    {
      id: 'route-performance-proof',
      from: 'evaluate-performance-and-equivalence',
      kind: 'terminal',
      predicate:
        'Every required budget and exact equivalence oracle was evaluated.',
      producedArtifacts: ['artifact:performance-equivalence-proof']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:profiled-ai-drawing-turn',
      ownerStepId: 'accept-profiled-ai-drawing-turn',
      channel: 'detached profiled turn request',
      consumerStepIds: ['prepare-ordered-app-composition-batches'],
      terminal: false
    },
    {
      id: 'artifact:ordered-app-composition-batches',
      ownerStepId: 'prepare-ordered-app-composition-batches',
      channel: 'App common-API requests',
      consumerStepIds: ['apply-canonical-scene-batch'],
      terminal: false
    },
    {
      id: 'artifact:app-batch-timing-sample',
      ownerStepId: 'prepare-ordered-app-composition-batches',
      channel: 'detached monotonic timing',
      consumerStepIds: ['evaluate-performance-and-equivalence'],
      terminal: false
    },
    {
      id: 'artifact:canonical-scene-batches',
      ownerStepId: 'apply-canonical-scene-batch',
      channel: 'ordinary canonical deliveries',
      consumerStepIds: [
        'record-history-and-shared-publication',
        'project-visible-canonical-batches'
      ],
      terminal: false
    },
    {
      id: 'artifact:scene-tree-timing-sample',
      ownerStepId: 'apply-canonical-scene-batch',
      channel: 'detached monotonic timing',
      consumerStepIds: ['evaluate-performance-and-equivalence'],
      terminal: false
    },
    {
      id: 'artifact:factory-history-commit',
      ownerStepId: 'record-history-and-shared-publication',
      channel: 'Factory history evidence',
      consumerStepIds: [
        'persist-committed-canonical-snapshots',
        'evaluate-performance-and-equivalence'
      ],
      terminal: false
    },
    {
      id: 'artifact:shared-publications',
      ownerStepId: 'record-history-and-shared-publication',
      channel: 'ordinary shared-publication channel',
      consumerStepIds: ['transport-and-apply-remote-batches'],
      terminal: false
    },
    {
      id: 'artifact:factory-timing-sample',
      ownerStepId: 'record-history-and-shared-publication',
      channel: 'detached monotonic timing',
      consumerStepIds: ['evaluate-performance-and-equivalence'],
      terminal: false
    },
    {
      id: 'artifact:remote-canonical-batches',
      ownerStepId: 'transport-and-apply-remote-batches',
      channel: 'ordinary remote canonical apply',
      consumerStepIds: ['project-visible-canonical-batches'],
      terminal: false
    },
    {
      id: 'artifact:collaboration-timing-sample',
      ownerStepId: 'transport-and-apply-remote-batches',
      channel: 'detached monotonic timing',
      consumerStepIds: ['evaluate-performance-and-equivalence'],
      terminal: false
    },
    {
      id: 'artifact:committed-persistence-snapshots',
      ownerStepId: 'persist-committed-canonical-snapshots',
      channel: 'exact committed snapshot and durability evidence',
      consumerStepIds: ['evaluate-performance-and-equivalence'],
      terminal: false
    },
    {
      id: 'artifact:persistence-timing-sample',
      ownerStepId: 'persist-committed-canonical-snapshots',
      channel: 'detached monotonic persistence timing',
      consumerStepIds: ['evaluate-performance-and-equivalence'],
      terminal: false
    },
    {
      id: 'artifact:visible-local-projection',
      ownerStepId: 'project-visible-canonical-batches',
      channel: 'ordinary local Render projection',
      consumerStepIds: ['evaluate-performance-and-equivalence'],
      terminal: false
    },
    {
      id: 'artifact:visible-remote-projection',
      ownerStepId: 'project-visible-canonical-batches',
      channel: 'ordinary remote Render projection',
      consumerStepIds: ['evaluate-performance-and-equivalence'],
      terminal: false
    },
    {
      id: 'artifact:render-timing-sample',
      ownerStepId: 'project-visible-canonical-batches',
      channel: 'detached visible-frame timing',
      consumerStepIds: ['evaluate-performance-and-equivalence'],
      terminal: false
    },
    {
      id: 'artifact:performance-equivalence-proof',
      ownerStepId: 'evaluate-performance-and-equivalence',
      channel: 'terminal formal evidence',
      consumerStepIds: [],
      terminal: true
    }
  ]

  const invariants = [
    {
      id: 'measurement-is-observational',
      statement:
        'Performance marks and counters are detached observations and cannot alter product scheduling, canonical state, delivery, history, retry, cancellation, or terminal results.',
      stepIds: [
        'accept-profiled-ai-drawing-turn',
        'prepare-ordered-app-composition-batches',
        'apply-canonical-scene-batch',
        'record-history-and-shared-publication',
        'transport-and-apply-remote-batches',
        'persist-committed-canonical-snapshots',
        'project-visible-canonical-batches',
        'evaluate-performance-and-equivalence'
      ],
      artifactIds: [
        'artifact:app-batch-timing-sample',
        'artifact:scene-tree-timing-sample',
        'artifact:factory-timing-sample',
        'artifact:collaboration-timing-sample',
        'artifact:persistence-timing-sample',
        'artifact:render-timing-sample'
      ],
      specRefs: ['#performance-measurement-contract']
    },
    {
      id: 'detail-identity-and-history-are-equivalent',
      statement:
        'Every optimized route preserves accepted detail, canonical identity, topology, hierarchy, properties, one outer transaction, and one intended history action per mutating turn.',
      stepIds: [
        'prepare-ordered-app-composition-batches',
        'apply-canonical-scene-batch',
        'record-history-and-shared-publication',
        'transport-and-apply-remote-batches',
        'persist-committed-canonical-snapshots',
        'project-visible-canonical-batches',
        'evaluate-performance-and-equivalence'
      ],
      artifactIds: [
        'artifact:ordered-app-composition-batches',
        'artifact:canonical-scene-batches',
        'artifact:factory-history-commit',
        'artifact:remote-canonical-batches',
        'artifact:committed-persistence-snapshots',
        'artifact:performance-equivalence-proof'
      ],
      specRefs: ['#non-negotiable-equivalence']
    },
    {
      id: 'profiling-selects-one-owner',
      statement:
        'Three-run owner spans select only the largest over-budget product owner; no cache or adjacent optimization is authorized without new profiling and Inspector evidence.',
      stepIds: [
        'accept-profiled-ai-drawing-turn',
        'evaluate-performance-and-equivalence'
      ],
      artifactIds: [
        'artifact:profiled-ai-drawing-turn',
        'artifact:performance-equivalence-proof'
      ],
      specRefs: ['#profiling-first-owner-decisions']
    },
    {
      id: 'progressive-remains-progressive',
      statement:
        'Progressive mode exposes multiple ordered peer-visible canonical batches before Actor A settles and never converts network batches into history actions.',
      stepIds: [
        'prepare-ordered-app-composition-batches',
        'record-history-and-shared-publication',
        'transport-and-apply-remote-batches',
        'project-visible-canonical-batches',
        'evaluate-performance-and-equivalence'
      ],
      artifactIds: [
        'artifact:shared-publications',
        'artifact:remote-canonical-batches',
        'artifact:visible-remote-projection',
        'artifact:factory-history-commit'
      ],
      specRefs: ['#performance-budgets', '#non-negotiable-equivalence']
    }
  ]

  const acceptanceContracts = [
    {
      id: 'local-creation-budgets',
      title: 'Balanced and maximum local creation budgets',
      assertions: [
        'Balanced atomic creation is at most 12 seconds median and 20 seconds worst without changing 7,076-element canonical output or one-turn history.',
        'Balanced progressive creation is at most 20 seconds median and 30 seconds worst without changing progressive delivery.',
        'Maximum detail retains 27,471 ordinary editable Vectors and 295,794 canonical points and is at most 60 seconds median and 90 seconds worst.'
      ],
      stepIds: [
        'accept-profiled-ai-drawing-turn',
        'prepare-ordered-app-composition-batches',
        'apply-canonical-scene-batch',
        'record-history-and-shared-publication',
        'persist-committed-canonical-snapshots',
        'project-visible-canonical-batches',
        'evaluate-performance-and-equivalence'
      ],
      specRefs: ['#performance-budgets', '#product-cases']
    },
    {
      id: 'progressive-collaboration-budgets',
      title: 'Peer-first-visible and convergence budgets',
      assertions: [
        'Actor B shows the first visible canonical batch within 2 seconds of the first publication and converges within 30 seconds of Actor A canonical commit.',
        'Whisker and pupil follow-ups converge within 5 seconds of Actor A settlement and retain exact ids and point counts.',
        'The full three-turn product flow is at most 90 seconds median and 120 seconds worst, while the whole E2E command is at most 180 seconds.'
      ],
      stepIds: [
        'record-history-and-shared-publication',
        'transport-and-apply-remote-batches',
        'persist-committed-canonical-snapshots',
        'project-visible-canonical-batches',
        'evaluate-performance-and-equivalence'
      ],
      specRefs: ['#performance-budgets', '#product-cases']
    },
    {
      id: 'semantic-equivalence-and-failure',
      title: 'Canonical, history, cancellation, and failure equivalence',
      assertions: [
        'Exact ids, topology, hierarchy, bounds, transforms, roles, styles, visibility, background size, transaction evidence, partial commit, and fatal rollback remain unchanged.',
        'Actor A gains one Undo action per mutating turn, Actor B gains none, and Undo/Redo each remain one local action.',
        'Cancellation, transport failure, and teardown release profiling state and never fabricate success.'
      ],
      stepIds: [
        'prepare-ordered-app-composition-batches',
        'apply-canonical-scene-batch',
        'record-history-and-shared-publication',
        'transport-and-apply-remote-batches',
        'persist-committed-canonical-snapshots',
        'project-visible-canonical-batches',
        'evaluate-performance-and-equivalence'
      ],
      specRefs: ['#non-negotiable-equivalence', '#product-cases']
    },
    {
      id: 'bounded-completion-gates',
      title: 'Profiling, formal, visual, and artifact completion',
      assertions: [
        'Three-run profiling separates every product owner span from harness overhead and names the first over-budget owner.',
        'The default 16-item Mock AI CRDT correctness gate passes while balanced correctness, high-detail performance, and high-detail CRDT retain their declared change-aware or opt-in isolation.',
        'Formal package, App, collaboration, E2E, lint, build, Inspector, BDD, and synchronized live visual gates pass.',
        'Generated screenshots, recordings, traces, profiles, and thumbnail media remain ignored local artifacts and are never committed.'
      ],
      stepIds: [
        'accept-profiled-ai-drawing-turn',
        'evaluate-performance-and-equivalence'
      ],
      specRefs: ['#definition-of-done', '#stop-conditions']
    }
  ]

  const flowInspectorData = {
    schema: { id: 'asyra.flow-inspector', version: 2 },
    target: {
      id: 'asyra-design-ai-conversational-drawing-performance',
      kind: 'feature',
      title: 'Asyra Design Conversational AI Drawing Performance Inspector',
      subtitle:
        'Profiling-first local creation, canonical Scene Tree apply, Factory history and publication, Collaboration convergence, committed persistence, ordinary Render projection, and exact performance-equivalence proof.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'Asyra Design Conversational AI Drawing Performance Plan',
      inspectorOwner:
        'Asyra Design Conversational AI drawing performance owner flow'
    },
    links: [
      {
        id: 'performance-plan',
        kind: 'authority',
        label: 'Performance product contract',
        href: './ai-conversational-drawing-performance-plan.md'
      },
      {
        id: 'drawing-inspector',
        kind: 'prerequisite',
        label: 'Active drawing behavior authority',
        href: './ai-conversational-drawing-flow-inspector.html'
      }
    ],
    lanes,
    steps,
    routes,
    artifacts,
    invariants,
    acceptanceContracts
  }

  const deepFreeze = (value) => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
      return value
    }
    Object.values(value).forEach(deepFreeze)
    return Object.freeze(value)
  }

  deepFreeze(flowInspectorData)
  globalThis.FLOW_INSPECTOR_DATA = flowInspectorData

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = flowInspectorData
  }
})()
