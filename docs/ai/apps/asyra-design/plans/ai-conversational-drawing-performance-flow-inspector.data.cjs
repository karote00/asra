;(function () {
  'use strict'

  const specPath =
    'docs/ai/apps/asyra-design/plans/ai-conversational-drawing-performance-plan.md'
  const inspectorPath =
    'docs/ai/apps/asyra-design/plans/ai-conversational-drawing-performance-flow-inspector.data.cjs'

  const lanes = [
    { id: 'app-canonical', title: 'App and Canonical Batch', order: 1 },
    {
      id: 'transaction-delivery',
      title: 'Shared Delivery',
      order: 2
    },
    { id: 'projection-ui', title: 'Projection and Contents', order: 3 },
    { id: 'wire-transport', title: 'Binary Wire Transport', order: 4 },
    { id: 'persistence-proof', title: 'Persistence and Proof', order: 5 }
  ]

  const steps = [
    {
      id: 'project-scrollable-contents-window',
      order: 2,
      laneId: 'projection-ui',
      title: 'Project a scrollable Contents window',
      ownerPackage: 'Asyra Design Contents',
      purpose:
        'Bind the real Contents virtualizer to the actual inner scroll element so every canonical hierarchy row is reachable while mounted DOM rows remain bounded.',
      inputs: [
        'artifact:ui-context-batch-projection',
        'canonical hierarchy order',
        'viewport and overscan configuration'
      ],
      outputs: ['artifact:scrollable-contents-window'],
      conditions: [
        'The virtualizer observes the actual inner scroll element that receives scrollTop changes.',
        'The DOM retains only viewport plus overscan rows while scroll range represents every canonical entry.',
        'A real 100+ row unit and integration case can scroll to and interact with the last canonical element.',
        'Collapse, expansion, selection, and hierarchy order retain ordinary Contents behavior.'
      ],
      bypasses: [
        'An empty hierarchy renders the ordinary empty Contents state without a virtual row.',
        'A collapsed subtree contributes no visible descendants but does not remove their canonical state.'
      ],
      allowedContributors: [
        'artifact:ui-context-batch-projection',
        'Asyra Design Contents hierarchy projection',
        'the existing virtualizer dependency',
        'ordinary selection and disclosure state'
      ],
      forbiddenContributors: [
        'rendering every canonical row into the DOM',
        'diagnostically omitting the Contents panel as a product fix',
        'a fixture-specific scroll offset',
        'a second scroll owner'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/contents',
        'apps/asyra-design/src/contents/__tests__'
      ],
      specRefs: [
        '#projection-and-contents-contract',
        '#scrollable-contents-window',
        '#step-local-gates'
      ],
      failureOwnerStepId: 'project-scrollable-contents-window'
    },
    {
      id: 'record-and-deliver-transaction-batch',
      order: 1,
      laneId: 'transaction-delivery',
      title: 'Record and deliver one transaction batch',
      ownerPackage: '@asyra/factory',
      purpose:
        'Create one immutable Factory-owned mutation artifact that carries canonical changes, inverses, history intent, shared-delivery mode, and publication slices to every downstream consumer.',
      inputs: [
        'artifact:canonical-element-batch-result',
        'one outer App transaction identity',
        'resolved atomic or progressive delivery mode'
      ],
      outputs: [
        'artifact:factory-mutation-batch-artifact',
        'artifact:shared-publication-batches',
        'artifact:local-commit-snapshot-trigger',
        'artifact:factory-batch-timing'
      ],
      conditions: [
        'Factory exposes FactoryMutationBatchArtifact, SharedDeliveryBatch, SharedPublication.batches, LocalSharedDataChannel.appendBatch, and LocalSharedDataChannel.observeBatch.',
        'The canonical handoff is deeply detached and frozen once; History, Render/UI, and Collaboration share the same immutable evidence.',
        'A successful mutating turn creates one intended Undo action, and Undo and Redo each restore the complete action.',
        'Progressive publication boundaries create no new canonical writes and no additional history actions.',
        'Rollback of an already-published immediate slice uses compensation from the same artifact.',
        'An observer mutation attempt cannot pollute another consumer or the retained artifact.',
        'Single-delivery conveniences delegate to batch-of-one rather than a second canonical implementation.'
      ],
      bypasses: [
        'A no-change transaction emits no artifact, history action, publication, or persistence trigger.',
        'A fatal transaction failure emits no committed history action or local persistence trigger.',
        'A transaction-end atomic publication is unavailable before canonical commit.'
      ],
      allowedContributors: [
        'artifact:canonical-element-batch-result',
        'Factory transaction and journal owners',
        'Factory shared-data channel',
        'ordinary ordered canonical delivery evidence'
      ],
      forbiddenContributors: [
        'one history action per progressive slice',
        'downstream .save() reconstruction of canonical evidence',
        'per-observer independent delivery cloning',
        'AI-specific history or compensation',
        'dropped or reordered canonical changes'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/factory/src',
        'packages/factory/src/__tests__'
      ],
      specRefs: [
        '#factory-mutation-batch-artifact',
        '#transaction-boundary',
        '#one-immutable-transaction-artifact',
        '#step-local-gates'
      ],
      failureOwnerStepId: 'record-and-deliver-transaction-batch'
    },
    {
      id: 'apply-canonical-property-scene-batch',
      order: 2,
      laneId: 'app-canonical',
      title: 'Apply one canonical property and Scene Tree batch',
      ownerPackage: '@asyra/core canonical batch facade',
      purpose:
        'Preflight and apply every accepted child through one Props, relationship, instance, registration, hierarchy, and evidence boundary with no committed prefix on failure.',
      inputs: ['artifact:composition-bulk-request'],
      outputs: [
        'artifact:canonical-element-batch-result',
        'artifact:canonical-batch-timing'
      ],
      conditions: [
        'Props Manager performs one whole-batch schema, ID, and relationship preflight before instance materialization, relationship rebind, and registerMany.',
        'A later invalid item leaves no committed prefix in Props, relationships, instance registries, Scene Tree maps, parent children, or Factory evidence.',
        'Scene Tree performs one map registration phase, one parent children replacement, and one ordered batch evidence handoff that preserves every canonical entry.',
        'Required instance construction, local relationship wiring, local observer binding, and ordered Scene evidence entries may iterate N inside their canonical owner without creating N Core requests, Props registration phases, Scene map or parent replacement phases, Factory batch handoffs, or App transactions.',
        'Step 11 profiling must identify an owner-local iteration as a material bottleneck before deeper micro-batching becomes a release blocker.',
        'CanonicalElementBatchResult preserves ordered element IDs and a Factory-owned delivery handle.',
        'Single-item APIs are exactly equivalent batch-of-one conveniences.'
      ],
      bypasses: [
        'A no-change descriptor never enters canonical mutation.',
        'Schema, ID, relationship, or ownership rejection fails before apply.',
        'A fatal apply error rolls back the complete outer transaction.'
      ],
      allowedContributors: [
        'artifact:composition-bulk-request',
        '@asyra/core public facade',
        '@asyra/props-manager canonical components and registries',
        '@asyra/scene-tree hierarchy and map owners',
        '@asyra/factory delivery handle'
      ],
      forbiddenContributors: [
        'App access to package-private stores',
        'prefix commit after later-item rejection',
        'skipped instance, relationship, registration, or observable evidence',
        'fixture-specific canonical handling',
        'post-hoc full-composition geometry repair'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src',
        'packages/core/src/__tests__',
        'packages/props-manager/src',
        'packages/props-manager/src/__tests__',
        'packages/scene-tree/src',
        'packages/scene-tree/src/__tests__'
      ],
      specRefs: [
        '#bulk-mutation-contract',
        '#one-composition-bulk-mutation',
        '#non-negotiable-equivalence',
        '#step-local-gates'
      ],
      failureOwnerStepId: 'apply-canonical-property-scene-batch'
    },
    {
      id: 'prepare-one-composition-bulk-request',
      order: 1,
      laneId: 'app-canonical',
      title: 'Prepare one composition bulk request',
      ownerPackage: 'Asyra Design AI actions and common APIs',
      purpose:
        'Convert one validated descriptor into one Group plus one all-children Core bulk request without changing accepted topology, canonical identity ownership, transaction intent, or failure semantics.',
      inputs: [
        'validated AI composition descriptor',
        'resolved atomic or progressive delivery mode',
        'Feature-owned AbortSignal'
      ],
      outputs: [
        'artifact:composition-bulk-request',
        'artifact:app-bulk-timing'
      ],
      conditions: [
        'The App creates the Group and submits one all-children Core bulk request through Core.createElementsInParentBatch.',
        'Core.createElementsInParentBatch returns CanonicalElementBatchResult with ordered IDs and a Factory-owned delivery handle.',
        'Every single-item create API delegates to the batch-of-one path.',
        'Point-aware progressive slices begin at 2,048 points and grow to 8,192 points; one indivisible element may exceed the soft target.',
        'A publication slice affects projection and delivery only and does not repeat or split the canonical mutation.',
        'One outer App transaction contains Group and children and expresses one intended history action.'
      ],
      bypasses: [
        'Clarification and no-change turns create no Group, request, or history action.',
        'Abort before mutation emits no canonical or publication work.',
        'Recoverable item failures retain accepted siblings in one partial batch; a fatal error rolls back the complete turn.'
      ],
      allowedContributors: [
        'registered Asyra Design AI action schemas',
        'apps/asyra-design common APIs',
        '@asyra/core public bulk facade',
        'App-owned delivery mode and host-yield policy'
      ],
      forbiddenContributors: [
        'fixed 256-item Core call loop',
        'provider-selected canonical IDs',
        'reduced VTracer detail or bitmap replacement',
        'one App transaction per slice',
        'AI-only canonical or Render mutation'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/ai',
        'apps/asyra-design/src/ai/__tests__',
        'apps/asyra-design/src/common-apis',
        'apps/asyra-design/src/common-apis/__tests__'
      ],
      specRefs: [
        '#bulk-mutation-contract',
        '#transaction-boundary',
        '#one-composition-bulk-mutation',
        '#step-local-gates'
      ],
      failureOwnerStepId: 'prepare-one-composition-bulk-request'
    },
    {
      id: 'project-visible-canonical-slices',
      order: 1,
      laneId: 'projection-ui',
      title: 'Project visible canonical slices',
      ownerPackage: '@asyra/preset projection composition',
      purpose:
        'Consume local and remote Factory batch artifacts through the ordinary Vector route, update only affected UI entries, and retain every progressive visible slice.',
      inputs: [
        'artifact:factory-mutation-batch-artifact',
        'artifact:remote-factory-mutation-batch'
      ],
      outputs: [
        'artifact:visible-canonical-slices',
        'artifact:ui-context-batch-projection',
        'artifact:render-ui-timing'
      ],
      conditions: [
        'Core preserves each injected Factory batch through one batch observer callback so Preset consumes the exact boundary without importing the default Factory instance.',
        'Atomic delivery performs one batch projection and one visible flush.',
        'Progressive delivery performs one projection for each formal slice and never collapses to a final-only peer frame.',
        'One invalidation and one frame flush occur at most once per slice.',
        'The ordinary Vector strategy preserves all 7,076 editable elements, topology, transforms, hierarchy, fills, strokes, and visibility.',
        'UI context updates affected entries and hierarchy order without rebuilding the complete map for every ADD_ELEMENT.',
        'No Render-engine bulk command is added; batch composition remains above the existing strategy surface.'
      ],
      bypasses: [
        'A canonical no-change produces no projection or UI update.',
        'Invisible and removed elements follow ordinary Vector strategy behavior.',
        'Detached timing and evidence never enter visible rendering.'
      ],
      allowedContributors: [
        'artifact:factory-mutation-batch-artifact',
        'artifact:remote-factory-mutation-batch',
        '@asyra/core injected-instance batch observer facade',
        '@asyra/preset ordinary Vector strategy',
        '@asyra/render scene scheduling',
        'Asyra Design UI context projection'
      ],
      forbiddenContributors: [
        'AI-only renderer or bitmap replacement',
        'Render-owned canonical state',
        'final-only progressive peer output',
        'one full UI map rebuild per ADD_ELEMENT',
        'diagnostic or evidence geometry'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src/data-channel-observer.ts',
        'packages/core/src/__tests__/core-start-render.test.ts',
        'packages/preset/src',
        'packages/preset/src/__tests__',
        'packages/render/src',
        'packages/render/src/__tests__',
        'apps/asyra-design/src/contexts/data-change.tsx',
        'apps/asyra-design/src/providers/scene-tree.ts',
        'apps/asyra-design/src/providers/__tests__/scene-tree.test.tsx',
        'apps/asyra-design/src/init/init-app.ts',
        'apps/asyra-design/src/init/__tests__/init-app.test.ts'
      ],
      specRefs: [
        '#projection-and-contents-contract',
        '#visible-atomic-and-progressive-projection',
        '#non-negotiable-equivalence',
        '#step-local-gates'
      ],
      failureOwnerStepId: 'project-visible-canonical-slices'
    },
    {
      id: 'encode-publication-frames',
      order: 1,
      laneId: 'wire-transport',
      title: 'Encode publication frames',
      ownerPackage: 'Asyra Design Collaboration codec worker',
      purpose:
        'Encode outbound shared publication batches and decode inbound opaque frames as versioned binary data in a worker while retaining JSON control frames and existing ProviderFailure semantics.',
      inputs: [
        'artifact:shared-publication-batches',
        'artifact:relayed-publication-frames',
        'artifact:server-accepted-receipts'
      ],
      outputs: [
        'artifact:encoded-publication-frames',
        'artifact:decoded-publication-batches',
        'artifact:frame-consumed-credit',
        'artifact:codec-timing'
      ],
      conditions: [
        'Hello, ack, failure, awareness, and credit control frames remain JSON.',
        'All shared publication data uses a versioned binary frame and is not pre-serialized as JSON.',
        'The existing codec runs in a Web Worker without a new package.',
        'Outbound encoding performs one object-to-worker structured clone and returns a transferable ArrayBuffer.',
        'Inbound ArrayBuffer data transfers to the receiver worker, which releases one decoded publication at a time to the App before policy and canonical preflight.',
        'The receiver worker emits frame-consumed credit after it accepts the transferable frame, independently of later canonical apply.',
        'The 1 MiB frame target is soft; one indivisible canonical record may exceed it without a product ceiling.',
        'Invalid, unsupported-version, and truncated frames reject through ProviderFailure.'
      ],
      bypasses: [
        'Disconnected mode performs no encode or send.',
        'A control-only message never enters publication payload encoding.',
        'Worker teardown rejects pending work and never fabricates delivery.'
      ],
      allowedContributors: [
        'artifact:shared-publication-batches',
        'artifact:relayed-publication-frames',
        'artifact:server-accepted-receipts',
        '@asyra/collaboration public publication schema',
        'existing repository codec',
        'platform Web Worker and transferable buffers'
      ],
      forbiddenContributors: [
        'new codec dependency',
        'JSON stringify of publication data before binary encoding',
        'main-thread publication compression',
        'element, point, payload, or composition ceiling',
        'worker-owned App policy'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/collaboration/compact-binary.ts',
        'apps/asyra-design/src/collaboration/compact-json.ts',
        'apps/asyra-design/src/collaboration/protocol.ts',
        'apps/asyra-design/src/collaboration/publication-codec-worker.ts',
        'apps/asyra-design/src/collaboration/websocket-provider.ts',
        'apps/asyra-design/src/collaboration/wire-values.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-protocol.test.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-websocket-provider.test.ts'
      ],
      specRefs: [
        '#binary-collaboration-transport',
        '#binary-backpressured-collaboration',
        '#step-local-gates'
      ],
      failureOwnerStepId: 'encode-publication-frames'
    },
    {
      id: 'relay-frames-with-backpressure',
      order: 2,
      laneId: 'wire-transport',
      title: 'Relay frames with byte backpressure',
      ownerPackage: 'Asyra Design reference WebSocket server',
      purpose:
        'Relay canonical publication payloads opaquely and enforce bounded per-peer byte queues with distinct acceptance, wire-consumption, and peer-apply receipts.',
      inputs: [
        'artifact:encoded-publication-frames',
        'artifact:frame-consumed-credit',
        'artifact:peer-applied-receipts'
      ],
      outputs: [
        'artifact:relayed-publication-frames',
        'artifact:server-accepted-receipts',
        'artifact:relay-timing'
      ],
      conditions: [
        'After handshake the server parses only header, version, request, publication, chunk, and control metadata; the canonical payload remains opaque with byte parity, no decode, and no re-encode.',
        'Each peer queue has a 2 MiB high watermark and a 512 KiB low watermark.',
        'One oversized frame is allowed only when the peer queue is otherwise empty.',
        'Queue progress waits for the socket.send callback and frame-consumed credit.',
        'server-accepted means current peer queues had bounded capacity and does not mean a peer decoded or applied the publication.',
        'peer-applied remains a separate receipt after main-thread canonical apply.',
        'Client and server explicitly configure perMessageDeflate: false.'
      ],
      bypasses: [
        'A disconnected or closed peer receives no later frame and reports the existing transport failure.',
        'A peer without high-watermark capacity delays server acceptance rather than growing an unbounded queue.',
        'Awareness and other JSON controls retain their ordinary control path.'
      ],
      allowedContributors: [
        'artifact:encoded-publication-frames',
        'artifact:frame-consumed-credit',
        'artifact:peer-applied-receipts',
        'WebSocket header, version, request, publication, chunk, and control metadata',
        'socket.send completion callback',
        'receiver frame-consumed credit'
      ],
      forbiddenContributors: [
        'server canonical payload decode or re-encode',
        'server history or canonical splitting',
        'unbounded per-peer queue',
        'per-message compression',
        'server-accepted treated as peer-applied'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/collaboration-server.ts',
        'apps/asyra-design/__tests__/collaboration-server.test.mjs'
      ],
      specRefs: [
        '#opaque-relay-and-backpressure',
        '#binary-backpressured-collaboration',
        '#step-local-gates'
      ],
      failureOwnerStepId: 'relay-frames-with-backpressure'
    },
    {
      id: 'apply-remote-publication-batches',
      order: 3,
      laneId: 'wire-transport',
      title: 'Apply remote publication batches',
      ownerPackage: 'Asyra Design Collaboration adapter',
      purpose:
        'Apply each decoded source publication through one remote Factory transaction and one canonical batch observer delivery without creating local-only side effects.',
      inputs: ['artifact:decoded-publication-batches'],
      outputs: [
        'artifact:remote-factory-mutation-batch',
        'artifact:peer-applied-receipts',
        'artifact:remote-apply-timing'
      ],
      conditions: [
        'One source publication owns one remote Factory transaction; different publications are not merged.',
        'The decoded publication is already wire-normalized, while App policy and canonical preflight remain in the App/Core owner.',
        'Props, relationships, instances, Scene Tree, and Factory evidence apply through one batch boundary.',
        'Reactive publication takes one observer-registry snapshot and invokes the batch observer once while preserving event order.',
        'Actor B produces no Undo, no echo publication, no persistence capture, no provider save, and no IndexedDB write.',
        'The remote owner emits peer-applied only after canonical apply completes; it remains distinct from frame-consumed credit.'
      ],
      bypasses: [
        'Disconnected or closed transport performs no remote transaction.',
        'Invalid App policy or canonical input fails before mutation.',
        'An upstream worker teardown yields no decoded publication and preserves ProviderFailure.'
      ],
      allowedContributors: [
        'artifact:decoded-publication-batches',
        '@asyra/collaboration public process contract',
        'Asyra Design App policy',
        '@asyra/core and @asyra/factory public batch boundaries'
      ],
      forbiddenContributors: [
        'one remote transaction per canonical event',
        'merging different source publications',
        'remote Undo or echo publication',
        'remote client persistence',
        'whole-document peer regeneration'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/collaboration/src/process.ts',
        'packages/collaboration/src/__tests__/process.test.ts',
        'apps/asyra-design/src/collaboration/factory-adapter.ts',
        'apps/asyra-design/src/collaboration/lifecycle.ts',
        'apps/asyra-design/src/collaboration/operations.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-factory.test.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-lifecycle.test.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-operations.test.ts'
      ],
      specRefs: [
        '#remote-apply-contract',
        '#remote-batch-apply',
        '#non-negotiable-equivalence',
        '#step-local-gates'
      ],
      failureOwnerStepId: 'apply-remote-publication-batches'
    },
    {
      id: 'persist-local-commit-snapshots',
      order: 1,
      laneId: 'persistence-proof',
      title: 'Persist eligible local commit snapshots',
      ownerPackage: '@asyra/core persistence coordinator',
      purpose:
        'Capture one exact detached snapshot for each eligible local action, Undo, and Redo commit while bypassing every remote-origin commit.',
      inputs: ['artifact:local-commit-snapshot-trigger'],
      outputs: [
        'artifact:committed-persistence-snapshots',
        'artifact:persistence-timing'
      ],
      conditions: [
        'Local action, undo, and redo commits each capture one deeply detached complete snapshot at that committed state.',
        'Snapshots and provider acknowledgements retain FIFO order.',
        'One provider failure does not coalesce, drop, or prevent a later eligible snapshot.',
        'Capture remains isolated before reentrant public observers without changing the committed runtime result.'
      ],
      bypasses: [
        'Remote origin has zero client persistence capture, save-hook work, provider save, and IndexedDB update.',
        'No configured provider reports persistence-skipped without snapshot capture.',
        'Rollback and validation rejection save no snapshot.'
      ],
      allowedContributors: [
        'artifact:local-commit-snapshot-trigger',
        '@asyra/factory isolated commit handoff',
        '@asyra/core public save facades and hooks',
        '@asyra/persistence provider contract'
      ],
      forbiddenContributors: [
        'remote client persistence',
        'coalesced or dropped local committed snapshots',
        'live mutable references in provider-owned data',
        'AI-specific persistence path',
        'history or publication boundary changes'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src',
        'packages/core/src/__tests__',
        'packages/persistence/src',
        'packages/persistence/src/providers/__tests__'
      ],
      specRefs: [
        '#persistence-contract',
        '#local-snapshot-durability',
        '#transaction-boundary',
        '#step-local-gates'
      ],
      failureOwnerStepId: 'persist-local-commit-snapshots'
    },
    {
      id: 'evaluate-performance-and-equivalence',
      order: 2,
      laneId: 'persistence-proof',
      title: 'Evaluate performance and equivalence',
      ownerPackage: 'Asyra Design performance E2E',
      purpose:
        'Run the complete formal closure once, report separated product-owner and harness spans, prove canonical and history equivalence, and inspect synchronized live App output.',
      inputs: [
        'artifact:app-bulk-timing',
        'artifact:canonical-batch-timing',
        'artifact:factory-mutation-batch-artifact',
        'artifact:factory-batch-timing',
        'artifact:codec-timing',
        'artifact:server-accepted-receipts',
        'artifact:frame-consumed-credit',
        'artifact:relay-timing',
        'artifact:remote-factory-mutation-batch',
        'artifact:peer-applied-receipts',
        'artifact:remote-apply-timing',
        'artifact:visible-canonical-slices',
        'artifact:ui-context-batch-projection',
        'artifact:render-ui-timing',
        'artifact:scrollable-contents-window',
        'artifact:committed-persistence-snapshots',
        'artifact:persistence-timing'
      ],
      outputs: ['artifact:performance-equivalence-proof'],
      conditions: [
        'One warm-up precedes three measured runs and median and worst values are reported separately.',
        'Spans report product execution, artifact construction, encode, server queue/drain, worker decode, remote apply, Render, UI, and harness overhead separately.',
        'The default 16-item CRDT case, one change-aware 7,112-element balanced correctness run, independent 7,076-element no-media CRDT and performance runs, and the 27,471-element 295,794-point gate pass.',
        'Canonical equivalence compares exact IDs, order, point counts, topology, hierarchy, bounds, transforms, roles, styles, visibility, transaction evidence, and persistence ownership.',
        'Synchronized Actor A and Actor B screenshots come from the same measured live App state and are inspected for complete uncropped output, Styles, IDs, and hierarchy.',
        'Generated screenshots, recordings, traces, profiles, and thumbnails are ignored and never committed.'
      ],
      bypasses: [
        'A development build, stale document, missing owner span, or test-induced scheduling cannot satisfy a release budget.',
        'A visually similar result with canonical, history, or persistence drift fails.',
        'The 7,076-element full two-window recording runs only after explicit user opt-in.'
      ],
      allowedContributors: [
        'declared owner timing artifacts',
        'ordinary canonical, history, collaboration, and persistence queries',
        'bounded final exact snapshots',
        'app-visual-review-sync live App screenshots'
      ],
      forbiddenContributors: [
        'screenshots as canonical semantics authority',
        'averages that hide worst-run regression',
        'harness overhead attributed to a product owner',
        'final-only peer output',
        'committed generated media or profiles'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/e2e',
        'apps/asyra-design/src/init/__tests__',
        'docs/ai/apps/asyra-design/bdd-features',
        'docs/ai/apps/asyra-design/plans/__tests__'
      ],
      specRefs: [
        '#performance-measurement-contract',
        '#performance-budgets',
        '#final-gates',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'evaluate-performance-and-equivalence'
    }
  ]

  const routes = [
    {
      id: 'route-composition-request-to-canonical',
      from: 'prepare-one-composition-bulk-request',
      to: 'apply-canonical-property-scene-batch',
      kind: 'handoff',
      predicate: 'The validated descriptor contains an accepted mutation.',
      producedArtifacts: ['artifact:composition-bulk-request']
    },
    {
      id: 'route-app-timing-to-proof',
      from: 'prepare-one-composition-bulk-request',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate: 'App bulk preparation emitted a bounded timing sample.',
      producedArtifacts: ['artifact:app-bulk-timing']
    },
    {
      id: 'route-canonical-result-to-factory',
      from: 'apply-canonical-property-scene-batch',
      to: 'record-and-deliver-transaction-batch',
      kind: 'handoff',
      predicate:
        'The complete canonical batch applied without a prefix failure.',
      producedArtifacts: ['artifact:canonical-element-batch-result']
    },
    {
      id: 'route-canonical-timing-to-proof',
      from: 'apply-canonical-property-scene-batch',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate:
        'Canonical preflight and apply emitted a bounded timing sample.',
      producedArtifacts: ['artifact:canonical-batch-timing']
    },
    {
      id: 'route-local-artifact-to-projection',
      from: 'record-and-deliver-transaction-batch',
      to: 'project-visible-canonical-slices',
      kind: 'projection',
      predicate: 'A local Factory mutation artifact is available.',
      producedArtifacts: ['artifact:factory-mutation-batch-artifact']
    },
    {
      id: 'route-publications-to-codec',
      from: 'record-and-deliver-transaction-batch',
      to: 'encode-publication-frames',
      kind: 'publication',
      predicate: 'Collaboration is connected and a publication batch exists.',
      producedArtifacts: ['artifact:shared-publication-batches']
    },
    {
      id: 'route-local-commit-to-persistence',
      from: 'record-and-deliver-transaction-batch',
      to: 'persist-local-commit-snapshots',
      kind: 'persistence',
      predicate: 'An eligible local action, Undo, or Redo commit completed.',
      producedArtifacts: ['artifact:local-commit-snapshot-trigger']
    },
    {
      id: 'route-factory-evidence-to-proof',
      from: 'record-and-deliver-transaction-batch',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate: 'Factory emitted terminal artifact and timing evidence.',
      producedArtifacts: [
        'artifact:factory-mutation-batch-artifact',
        'artifact:factory-batch-timing'
      ]
    },
    {
      id: 'route-encoded-frames-to-relay',
      from: 'encode-publication-frames',
      to: 'relay-frames-with-backpressure',
      kind: 'transport',
      predicate: 'A valid encoded publication frame is ready.',
      producedArtifacts: ['artifact:encoded-publication-frames']
    },
    {
      id: 'route-frame-consumed-credit-to-relay',
      from: 'encode-publication-frames',
      to: 'relay-frames-with-backpressure',
      kind: 'credit',
      predicate: 'The receiver worker accepted an inbound transferable frame.',
      producedArtifacts: ['artifact:frame-consumed-credit']
    },
    {
      id: 'route-codec-timing-to-proof',
      from: 'encode-publication-frames',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate: 'Worker encode and decode emitted bounded timing.',
      producedArtifacts: ['artifact:codec-timing']
    },
    {
      id: 'route-frame-consumed-credit-to-proof',
      from: 'encode-publication-frames',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate: 'Wire-consumption credit timing is available.',
      producedArtifacts: ['artifact:frame-consumed-credit']
    },
    {
      id: 'route-relayed-frames-to-codec',
      from: 'relay-frames-with-backpressure',
      to: 'encode-publication-frames',
      kind: 'transport',
      predicate: 'The peer worker received an ordered opaque frame.',
      producedArtifacts: ['artifact:relayed-publication-frames']
    },
    {
      id: 'route-server-accepted-to-codec-provider',
      from: 'relay-frames-with-backpressure',
      to: 'encode-publication-frames',
      kind: 'receipt',
      predicate:
        'Every current peer queue had bounded capacity for the accepted frame.',
      producedArtifacts: ['artifact:server-accepted-receipts']
    },
    {
      id: 'route-relay-evidence-to-proof',
      from: 'relay-frames-with-backpressure',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate: 'Relay queue, drain, and receipt evidence is available.',
      producedArtifacts: [
        'artifact:server-accepted-receipts',
        'artifact:relay-timing'
      ]
    },
    {
      id: 'route-decoded-publication-to-remote',
      from: 'encode-publication-frames',
      to: 'apply-remote-publication-batches',
      kind: 'handoff',
      predicate:
        'The receiver worker released one validated and normalized publication.',
      producedArtifacts: ['artifact:decoded-publication-batches']
    },
    {
      id: 'route-remote-artifact-to-projection',
      from: 'apply-remote-publication-batches',
      to: 'project-visible-canonical-slices',
      kind: 'projection',
      predicate: 'One remote publication transaction completed.',
      producedArtifacts: ['artifact:remote-factory-mutation-batch']
    },
    {
      id: 'route-peer-applied-to-relay',
      from: 'apply-remote-publication-batches',
      to: 'relay-frames-with-backpressure',
      kind: 'receipt',
      predicate: 'Main-thread canonical apply completed for the publication.',
      producedArtifacts: ['artifact:peer-applied-receipts']
    },
    {
      id: 'route-remote-evidence-to-proof',
      from: 'apply-remote-publication-batches',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate: 'Remote apply emitted artifact and timing evidence.',
      producedArtifacts: [
        'artifact:remote-factory-mutation-batch',
        'artifact:peer-applied-receipts',
        'artifact:remote-apply-timing'
      ]
    },
    {
      id: 'route-ui-projection-to-contents',
      from: 'project-visible-canonical-slices',
      to: 'project-scrollable-contents-window',
      kind: 'projection',
      predicate: 'Affected UI entries and hierarchy order are available.',
      producedArtifacts: ['artifact:ui-context-batch-projection']
    },
    {
      id: 'route-projection-evidence-to-proof',
      from: 'project-visible-canonical-slices',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate: 'Local and remote visible projection evidence is available.',
      producedArtifacts: [
        'artifact:visible-canonical-slices',
        'artifact:ui-context-batch-projection',
        'artifact:render-ui-timing'
      ]
    },
    {
      id: 'route-contents-window-to-proof',
      from: 'project-scrollable-contents-window',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate: 'The final canonical row is reachable with bounded DOM rows.',
      producedArtifacts: ['artifact:scrollable-contents-window']
    },
    {
      id: 'route-persistence-evidence-to-proof',
      from: 'persist-local-commit-snapshots',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate:
        'Local FIFO and remote bypass evidence reached terminal status.',
      producedArtifacts: [
        'artifact:committed-persistence-snapshots',
        'artifact:persistence-timing'
      ]
    },
    {
      id: 'route-performance-proof',
      from: 'evaluate-performance-and-equivalence',
      kind: 'terminal',
      predicate: 'All formal, performance, equivalence, and visual gates ran.',
      producedArtifacts: ['artifact:performance-equivalence-proof']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:composition-bulk-request',
      ownerStepId: 'prepare-one-composition-bulk-request',
      channel: 'Asyra Design common API',
      consumerStepIds: ['apply-canonical-property-scene-batch'],
      terminal: false
    },
    {
      id: 'artifact:app-bulk-timing',
      ownerStepId: 'prepare-one-composition-bulk-request',
      channel: 'detached monotonic timing',
      consumerStepIds: ['evaluate-performance-and-equivalence'],
      terminal: false
    },
    {
      id: 'artifact:canonical-element-batch-result',
      ownerStepId: 'apply-canonical-property-scene-batch',
      channel: '@asyra/core canonical batch result',
      consumerStepIds: ['record-and-deliver-transaction-batch'],
      terminal: false
    },
    {
      id: 'artifact:canonical-batch-timing',
      ownerStepId: 'apply-canonical-property-scene-batch',
      channel: 'detached monotonic timing',
      consumerStepIds: ['evaluate-performance-and-equivalence'],
      terminal: false
    },
    {
      id: 'artifact:factory-mutation-batch-artifact',
      ownerStepId: 'record-and-deliver-transaction-batch',
      channel: 'immutable Factory batch evidence',
      consumerStepIds: [
        'project-visible-canonical-slices',
        'evaluate-performance-and-equivalence'
      ],
      terminal: false
    },
    {
      id: 'artifact:shared-publication-batches',
      ownerStepId: 'record-and-deliver-transaction-batch',
      channel: 'Factory shared-data channel',
      consumerStepIds: ['encode-publication-frames'],
      terminal: false
    },
    {
      id: 'artifact:local-commit-snapshot-trigger',
      ownerStepId: 'record-and-deliver-transaction-batch',
      channel: 'isolated pre-observer local commit handoff',
      consumerStepIds: ['persist-local-commit-snapshots'],
      terminal: false
    },
    {
      id: 'artifact:factory-batch-timing',
      ownerStepId: 'record-and-deliver-transaction-batch',
      channel: 'detached monotonic timing',
      consumerStepIds: ['evaluate-performance-and-equivalence'],
      terminal: false
    },
    {
      id: 'artifact:encoded-publication-frames',
      ownerStepId: 'encode-publication-frames',
      channel: 'transferable versioned binary frames',
      consumerStepIds: ['relay-frames-with-backpressure'],
      terminal: false
    },
    {
      id: 'artifact:decoded-publication-batches',
      ownerStepId: 'encode-publication-frames',
      channel: 'worker-validated and normalized publication batches',
      consumerStepIds: ['apply-remote-publication-batches'],
      terminal: false
    },
    {
      id: 'artifact:frame-consumed-credit',
      ownerStepId: 'encode-publication-frames',
      channel: 'receiver worker wire-consumption credit',
      consumerStepIds: [
        'relay-frames-with-backpressure',
        'evaluate-performance-and-equivalence'
      ],
      terminal: false
    },
    {
      id: 'artifact:codec-timing',
      ownerStepId: 'encode-publication-frames',
      channel: 'detached worker encode/decode timing',
      consumerStepIds: ['evaluate-performance-and-equivalence'],
      terminal: false
    },
    {
      id: 'artifact:relayed-publication-frames',
      ownerStepId: 'relay-frames-with-backpressure',
      channel: 'opaque ordered WebSocket frames',
      consumerStepIds: ['encode-publication-frames'],
      terminal: false
    },
    {
      id: 'artifact:server-accepted-receipts',
      ownerStepId: 'relay-frames-with-backpressure',
      channel: 'bounded per-peer queue acceptance receipts',
      consumerStepIds: [
        'encode-publication-frames',
        'evaluate-performance-and-equivalence'
      ],
      terminal: false
    },
    {
      id: 'artifact:relay-timing',
      ownerStepId: 'relay-frames-with-backpressure',
      channel: 'detached queue and drain timing',
      consumerStepIds: ['evaluate-performance-and-equivalence'],
      terminal: false
    },
    {
      id: 'artifact:remote-factory-mutation-batch',
      ownerStepId: 'apply-remote-publication-batches',
      channel: 'remote Factory transaction evidence',
      consumerStepIds: [
        'project-visible-canonical-slices',
        'evaluate-performance-and-equivalence'
      ],
      terminal: false
    },
    {
      id: 'artifact:peer-applied-receipts',
      ownerStepId: 'apply-remote-publication-batches',
      channel: 'post-canonical-apply peer receipts',
      consumerStepIds: [
        'relay-frames-with-backpressure',
        'evaluate-performance-and-equivalence'
      ],
      terminal: false
    },
    {
      id: 'artifact:remote-apply-timing',
      ownerStepId: 'apply-remote-publication-batches',
      channel: 'detached remote apply timing',
      consumerStepIds: ['evaluate-performance-and-equivalence'],
      terminal: false
    },
    {
      id: 'artifact:visible-canonical-slices',
      ownerStepId: 'project-visible-canonical-slices',
      channel: 'ordinary local and remote Vector projection',
      consumerStepIds: ['evaluate-performance-and-equivalence'],
      terminal: false
    },
    {
      id: 'artifact:ui-context-batch-projection',
      ownerStepId: 'project-visible-canonical-slices',
      channel: 'affected UI entries and hierarchy order',
      consumerStepIds: [
        'project-scrollable-contents-window',
        'evaluate-performance-and-equivalence'
      ],
      terminal: false
    },
    {
      id: 'artifact:render-ui-timing',
      ownerStepId: 'project-visible-canonical-slices',
      channel: 'detached Render and UI timing',
      consumerStepIds: ['evaluate-performance-and-equivalence'],
      terminal: false
    },
    {
      id: 'artifact:scrollable-contents-window',
      ownerStepId: 'project-scrollable-contents-window',
      channel: 'formal Contents tail-reachability evidence',
      consumerStepIds: ['evaluate-performance-and-equivalence'],
      terminal: false
    },
    {
      id: 'artifact:committed-persistence-snapshots',
      ownerStepId: 'persist-local-commit-snapshots',
      channel: 'exact local FIFO durability evidence',
      consumerStepIds: ['evaluate-performance-and-equivalence'],
      terminal: false
    },
    {
      id: 'artifact:persistence-timing',
      ownerStepId: 'persist-local-commit-snapshots',
      channel: 'detached capture and provider timing',
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
      id: 'one-action-one-artifact-one-history-boundary',
      statement:
        'One mutating user turn owns one outer transaction, one immutable FactoryMutationBatchArtifact, and one intended history action regardless of publication slice or wire-frame count.',
      stepIds: [
        'prepare-one-composition-bulk-request',
        'apply-canonical-property-scene-batch',
        'record-and-deliver-transaction-batch',
        'encode-publication-frames',
        'relay-frames-with-backpressure',
        'apply-remote-publication-batches'
      ],
      artifactIds: [
        'artifact:composition-bulk-request',
        'artifact:canonical-element-batch-result',
        'artifact:factory-mutation-batch-artifact',
        'artifact:shared-publication-batches'
      ],
      specRefs: ['#transaction-boundary', '#non-negotiable-equivalence']
    },
    {
      id: 'publication-slices-are-not-canonical-writes',
      statement:
        'Atomic and progressive slices project and publish existing immutable evidence; they never repeat canonical mutation, split history, or collapse progressive peer visibility.',
      stepIds: [
        'record-and-deliver-transaction-batch',
        'project-visible-canonical-slices',
        'encode-publication-frames',
        'relay-frames-with-backpressure',
        'apply-remote-publication-batches'
      ],
      artifactIds: [
        'artifact:factory-mutation-batch-artifact',
        'artifact:visible-canonical-slices',
        'artifact:encoded-publication-frames',
        'artifact:remote-factory-mutation-batch'
      ],
      specRefs: [
        '#factory-mutation-batch-artifact',
        '#projection-and-contents-contract'
      ]
    },
    {
      id: 'transport-is-bounded-and-not-a-semantic-owner',
      statement:
        'Worker and server transport preserve ordered canonical bytes and bounded peer queues without owning App policy, canonical splitting, history, persistence, or convergence claims.',
      stepIds: [
        'encode-publication-frames',
        'relay-frames-with-backpressure',
        'apply-remote-publication-batches'
      ],
      artifactIds: [
        'artifact:encoded-publication-frames',
        'artifact:relayed-publication-frames',
        'artifact:decoded-publication-batches',
        'artifact:server-accepted-receipts',
        'artifact:frame-consumed-credit',
        'artifact:peer-applied-receipts'
      ],
      specRefs: [
        '#binary-collaboration-transport',
        '#opaque-relay-and-backpressure'
      ]
    },
    {
      id: 'remote-origin-has-no-local-only-side-effects',
      statement:
        'A remote source publication updates canonical, Render, and UI state but creates no Undo, echo publication, persistence capture, provider save, or IndexedDB write.',
      stepIds: [
        'apply-remote-publication-batches',
        'project-visible-canonical-slices',
        'persist-local-commit-snapshots',
        'evaluate-performance-and-equivalence'
      ],
      artifactIds: [
        'artifact:remote-factory-mutation-batch',
        'artifact:visible-canonical-slices',
        'artifact:committed-persistence-snapshots'
      ],
      specRefs: ['#remote-apply-contract', '#persistence-contract']
    }
  ]

  const acceptanceContracts = [
    {
      id: 'bulk-and-history-equivalence',
      title: 'Bulk canonical and history equivalence',
      assertions: [
        'One Group plus one all-children Core request preserves exact IDs, order, topology, properties, relationships, and component ownership.',
        'A later invalid item leaves no prefix, and single-item APIs are equivalent batch-of-one conveniences.',
        'One immutable Factory artifact produces one intended Undo action and exact Undo, Redo, and rollback compensation.'
      ],
      stepIds: [
        'prepare-one-composition-bulk-request',
        'apply-canonical-property-scene-batch',
        'record-and-deliver-transaction-batch'
      ],
      specRefs: [
        '#bulk-mutation-contract',
        '#factory-mutation-batch-artifact',
        '#non-negotiable-equivalence'
      ]
    },
    {
      id: 'visible-and-scrollable-projection',
      title: 'Visible progressive and scrollable UI projection',
      assertions: [
        'Atomic delivery flushes once and progressive delivery flushes every formal slice through the ordinary Vector route.',
        'All 7,076 editable elements remain complete and uncropped.',
        'Contents reaches the final canonical element with viewport-plus-overscan DOM rows and correct collapse and selection.'
      ],
      stepIds: [
        'project-visible-canonical-slices',
        'project-scrollable-contents-window'
      ],
      specRefs: ['#projection-and-contents-contract', '#product-cases']
    },
    {
      id: 'binary-backpressure-and-remote-apply',
      title: 'Binary relay, backpressure, and remote apply',
      assertions: [
        'Versioned binary publication data round-trips through workers and an opaque relay without byte drift.',
        'Each peer queue remains within the declared watermarks and separates server-accepted, frame-consumed, and peer-applied receipts.',
        'One remote transaction and one batch observer delivery apply each source publication without Undo, echo, or client persistence.'
      ],
      stepIds: [
        'encode-publication-frames',
        'relay-frames-with-backpressure',
        'apply-remote-publication-batches'
      ],
      specRefs: [
        '#binary-collaboration-transport',
        '#opaque-relay-and-backpressure',
        '#remote-apply-contract'
      ]
    },
    {
      id: 'formal-performance-and-visual-closure',
      title: 'Formal, performance, and visual closure',
      assertions: [
        'The default 16-item CRDT gate, one change-aware 7,112-element correctness gate, independent high-detail CRDT and performance gates, and maximum-detail gate pass.',
        'Existing atomic, progressive, first-visible, convergence, follow-up, full-flow, and maximum-detail budgets pass with separated owner and harness spans.',
        'Synchronized live Actor A and Actor B output is complete, uncropped, and semantically equivalent; generated artifacts are never committed.'
      ],
      stepIds: [
        'persist-local-commit-snapshots',
        'evaluate-performance-and-equivalence'
      ],
      specRefs: ['#performance-budgets', '#final-gates', '#definition-of-done']
    }
  ]

  const flowInspectorData = {
    schema: { id: 'asyra.flow-inspector', version: 2 },
    target: {
      id: 'asyra-design-ai-conversational-drawing-performance',
      kind: 'feature',
      title: 'Asyra Design Conversational AI Drawing Performance Inspector',
      subtitle:
        'One canonical composition batch, one immutable Factory artifact, visible ordinary Vector slices, binary backpressured collaboration, remote side-effect isolation, local FIFO durability, and exact performance-equivalence proof.'
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
        label: 'Completed drawing behavior authority',
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
