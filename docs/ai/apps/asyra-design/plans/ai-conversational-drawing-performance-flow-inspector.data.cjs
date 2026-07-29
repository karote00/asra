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
    {
      id: 'persistence-proof',
      title: 'Collaboration Policy and Proof',
      order: 5
    }
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
        'artifact:factory-batch-timing'
      ],
      conditions: [
        'Factory exposes FactoryMutationBatchArtifact, SharedDeliveryBatch, SharedPublication.batches, LocalSharedDataChannel.appendBatch, and LocalSharedDataChannel.observeBatch.',
        'The canonical handoff is deeply detached and frozen once; History, Render/UI, and Collaboration share the same immutable evidence.',
        'A successful mutating turn creates one intended Undo action, and Undo and Redo each restore the complete action.',
        'Retained Undo and Redo evidence preserves the source artifact order and returns to the canonical owner; only an explicitly applied owner result can ready the corresponding publication batch.',
        'Progressive publication boundaries create no new canonical writes and no additional history actions.',
        'Rollback of an already-published immediate slice uses compensation from the same artifact.',
        'An observer mutation attempt cannot pollute another consumer or the retained artifact.',
        'Single-delivery conveniences delegate to batch-of-one rather than a second canonical implementation.'
      ],
      bypasses: [
        'A no-change transaction emits no artifact, history action, or publication.',
        'A fatal transaction failure emits no committed history action.',
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
        'Preflight and apply creation, retained removal, and retained restore through one Props, relationship, instance, registration, hierarchy, and evidence boundary with no committed prefix on failure.',
      inputs: [
        'artifact:composition-batch-sequence',
        'artifact:factory-mutation-batch-artifact'
      ],
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
        'Single-item APIs are exactly equivalent batch-of-one conveniences.',
        'Public creation API choice follows data lifecycle rather than origin: ordinary descriptors use addNewElement or addNewElements, detached canonical snapshots use addNewElementsFromCanonicalData, and canonical data whose property owners are already active uses addNewElementsFromCanonicalDataUsingActiveProperties.',
        'No creation API is restricted by local or remote origin; an active transaction owner must instead atomically accept the canonical batch evidence.',
        'Ordinary removal owns complete property cleanup, while canonical removal with active properties uses removeElementUsingActiveProperties or removeElementsUsingActiveProperties when separate retained Props evidence owns property removal.',
        'A complete retained container hierarchy uses removeSubtreeUsingActiveProperties so the hierarchy is preflighted, mutated, and handed off once while its separate retained Props evidence remains active.',
        'The single removeElementUsingActiveProperties API is exactly the batch-of-one convenience for removeElementsUsingActiveProperties.',
        'Retained removal and restore preflight the complete Scene, Props, relationship, parent-index, ID, and tombstone evidence before apply so a later invalid item leaves no committed prefix.',
        'No removal API is restricted by local or remote origin; callers choose by property lifecycle and exact evidence ownership.'
      ],
      bypasses: [
        'A no-change descriptor never enters canonical mutation.',
        'Schema, ID, relationship, or ownership rejection fails before apply.',
        'A fatal apply error rolls back the complete outer transaction.'
      ],
      allowedContributors: [
        'artifact:composition-batch-sequence',
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
        'treating a semantic no-op as an applied replay result',
        'reordering retained Scene and Props evidence',
        'post-hoc full-composition geometry repair'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src',
        'packages/core/src/__tests__',
        'packages/props-manager/src',
        'packages/props-manager/src/__tests__',
        'packages/scene-tree/src',
        'packages/scene-tree/src/__tests__',
        'packages/preset/src/props/components',
        'packages/preset/src/__tests__',
        'docs/ai/framework/packages/scene-tree.md',
        'docs/ai/framework/API_SURFACES.md'
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
      id: 'stage-local-interactive-composition',
      order: 1,
      laneId: 'app-canonical',
      title: 'Stage one local interactive composition',
      ownerPackage: 'Asyra Design AI composition interaction',
      purpose:
        'Convert one validated descriptor into an exact-bounds runtime loading state committed by the App DOM and one ordered Group-plus-children composition batch sequence whose bounded work units return control to the browser without changing accepted topology, canonical identity ownership, transaction intent, or failure semantics.',
      inputs: [
        'validated AI composition descriptor',
        'resolved atomic or progressive delivery mode; Mock AI with missing aiDelivery resolves to progressive while explicit atomic remains opt-in',
        'Feature-owned AbortSignal',
        'App-owned runtime drawing-progress projection',
        'App-owned DOM compositor overlay',
        'App-owned document interaction lock policy'
      ],
      outputs: [
        'artifact:composition-batch-sequence',
        'artifact:local-drawing-progress-state',
        'artifact:local-document-interaction-lock-state',
        'artifact:app-bulk-timing'
      ],
      conditions: [
        'Mock AI with missing aiDelivery uses the progressive path by default so the ordinary local demo remains cooperative; explicit aiDelivery=atomic retains the one-batch atomic path for isolated measurement.',
        'After validated accepted descriptors determine exact bounds, the App publishes a runtime-only loading state, commits a connected App DOM overlay, and crosses a browser paint opportunity before the first canonical mutation.',
        'The App acquires one runtime-only document interaction lock before opening the outer App transaction; the lock allows ordinary viewport pan and zoom to repaint the live loading frame and Vector output while it blocks every other document interaction, document mutation, and canonical mutation.',
        'Viewport navigation while locked continues through ordinary Feature execution and may cross its existing transaction wrapper, but produces no canonical mutation or history and does not alter the AI action transaction evidence or accepted composition bounds; AI cancellation remains available.',
        'Atomic mode creates the Group and submits one all-children plural Core batch; progressive mode creates the Group and submits multiple deterministic plural Core batches.',
        'Progressive batch boundaries enforce both a point budget and an element-count budget capped at 32 per work unit; one indivisible element may exceed only the point soft target.',
        'Each successful canonical batch completes its ordinary Factory, Preset, Render, and UI projection, commits actual element progress, awaits one later browser task through the single serialized action loop, and rechecks the Feature-owned AbortSignal before another mutation.',
        'The exact-bounds overlay is App-owned transient DOM projection above the ordinary canvas; its CSS activity animates only transform and opacity on the compositor while every completed element continues through the ordinary editable Vector route.',
        'One outer App transaction contains the Group and every child batch and expresses one intended history action.',
        'The App clears drawing progress and releases the document interaction lock after success, failure, cancellation, or teardown; failure and cancellation preserve complete canonical rollback and visible compensation.'
      ],
      bypasses: [
        'Clarification and no-change turns create no loading state, Group, batch, or history action.',
        'Abort before mutation clears transient progress and emits no canonical or publication work.',
        'Recoverable item failures retain accepted siblings in one partial batch; a fatal error rolls back the complete turn.'
      ],
      allowedContributors: [
        'registered Asyra Design AI action schemas',
        'apps/asyra-design common APIs',
        '@asyra/core public plural creation facade',
        'App-owned runtime System Context state',
        'App-owned DOM overlay component and compositor-safe CSS animation',
        'App-owned document interaction lock and existing viewport pan and zoom input routes',
        'Agent conversation Cancel control as the only non-navigation DOM interaction exemption',
        'App-owned delivery mode and serialized cooperative main-thread scheduling policy'
      ],
      forbiddenContributors: [
        '7,000 single-item Core calls',
        'provider-selected canonical IDs',
        'reduced VTracer detail or bitmap replacement',
        'one App transaction per slice',
        'AI-only renderer or canonical loading placeholder',
        'Canvas or Render-owned loading overlay',
        'fabricated time-based or estimated element progress',
        'loading, progress, or slice-policy parameters in Core, Props Manager, or Scene Tree',
        'JavaScript per-frame loading animation',
        'a second reactive-events bus used as a scheduling or document-admission lock',
        'microtask-only progressive yield',
        'one timeout scheduled independently for every planned range'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/package.json',
        'apps/asyra-design/src/ai',
        'apps/asyra-design/src/ai/__tests__',
        'apps/asyra-design/src/common-apis/system-context.ts',
        'apps/asyra-design/src/constants',
        'apps/asyra-design/src/app/ai-conversation-panel.tsx',
        'apps/asyra-design/src/app/__tests__/ai-conversation-panel.test.tsx',
        'apps/asyra-design/src/render-app',
        'apps/asyra-design/src/render-layers',
        'apps/asyra-design/src/init/capabilities/init-ai-drawing-progress.ts',
        'apps/asyra-design/src/init/init-app.ts',
        'apps/asyra-design/src/init/__tests__',
        'docs/ai/apps/asyra-design/API_SURFACES.md'
      ],
      specRefs: [
        '#current-local-interactive-drawing-closure',
        '#exact-bounds-loading-frame',
        '#cooperative-progressive-composition',
        '#transaction-boundary',
        '#current-local-gates'
      ],
      failureOwnerStepId: 'stage-local-interactive-composition'
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
        'artifact:server-accepted-receipts',
        'artifact:source-frame-admitted-credit',
        'artifact:remote-publication-settlement'
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
        'Inbound ArrayBuffer data enters a bounded frame ingress with a 2 MiB byte window; one active oversized publication assembly is allowed without creating a payload ceiling.',
        'After header, order, and duplicate evidence are validated, the receiver worker accepts the frame and emits frame-consumed credit independently of later canonical apply.',
        'The worker-to-main publication is deeply frozen once without repeated provider or Collaboration clone boundaries.',
        'The receiver exposes one immutable decoded publication lease to the App before policy and canonical preflight; successful remote publication settlement releases the next decoded publication, while terminal failure clears the active and pending leases and releases no later publication.',
        'The provider keeps one outbound publication frame in flight, waits for exact source-frame-admitted credit, then sends the next frame.',
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
        'artifact:source-frame-admitted-credit',
        'artifact:remote-publication-settlement',
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
        'apps/asyra-design/src/init/__tests__/collaboration-websocket-provider.test.ts',
        'packages/collaboration/src/cloning.ts',
        'packages/collaboration/src/provider.ts',
        'packages/collaboration/src/index.ts',
        'packages/collaboration/src/process.ts',
        'packages/collaboration/src/__tests__/cloning.test.ts',
        'packages/collaboration/src/__tests__/process.test.ts'
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
        'artifact:source-frame-admitted-credit',
        'artifact:server-accepted-receipts',
        'artifact:relay-timing'
      ],
      conditions: [
        'After handshake the server parses only header, version, request, publication, chunk, and control metadata; the canonical payload remains opaque with byte parity, no decode, and no re-encode.',
        'Each peer queue has an exact 2 MiB unretired byte capacity; a frame is admitted only when its bytes fit the remaining capacity.',
        'One oversized frame is allowed only when the peer queue is otherwise empty.',
        'Already-admitted peer frames send in FIFO order through the 2 MiB byte window without waiting for the prior frame-consumed credit.',
        'Frame retirement and capacity release wait for both the exact socket.send callback and exact frame-consumed credit; only a contiguous completed queue prefix retires.',
        'Blocked admission resumes as soon as contiguous retirement leaves exact capacity for the next frame; there is no second hysteresis threshold.',
        'The server accepts one outbound publication frame per connection, returns exact source-frame-admitted credit, and accepts the next frame only after that credit.',
        'Source ingress retains one pending frame until exact source-frame-admitted credit permits the next frame; this source admission boundary is distinct from the peer egress byte window.',
        'After one source frame enters every request-start peer queue, the server returns exact source-frame-admitted credit; the provider sends no next publication frame before that credit.',
        'The JSON control fast path remains readable while publication admission is blocked; the server does not use socket-wide pause to bound source frames.',
        'server-accepted means current peer queues had bounded capacity and does not mean a peer decoded or applied the publication.',
        'peer-applied remains a separate receipt after main-thread canonical apply.',
        'Client and server explicitly configure perMessageDeflate: false.'
      ],
      bypasses: [
        'A disconnected or closed peer receives no later frame and reports the existing transport failure.',
        'A peer without exact 2 MiB unretired-byte capacity delays server acceptance rather than growing an unbounded queue.',
        'Awareness and other JSON controls retain their ordinary control path.'
      ],
      allowedContributors: [
        'artifact:encoded-publication-frames',
        'artifact:frame-consumed-credit',
        'artifact:peer-applied-receipts',
        'WebSocket header, version, request, publication, chunk, and control metadata',
        'socket.send completion callback',
        'source-frame-admitted credit',
        'receiver frame-consumed credit'
      ],
      forbiddenContributors: [
        'server canonical payload decode or re-encode',
        'server history or canonical splitting',
        'unbounded per-peer queue',
        'multiple source ingress publication frames before exact source-frame-admitted credit',
        'socket-wide pause that blocks JSON credit controls',
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
        'artifact:remote-publication-settlement',
        'artifact:remote-apply-timing'
      ],
      conditions: [
        'One source publication owns one remote Factory transaction; different publications are not merged.',
        'The decoded publication is already wire-normalized, while App policy and canonical preflight remain in the App/Core owner.',
        'Props, relationships, instances, Scene Tree, and Factory evidence apply through one batch boundary.',
        'The remote Factory transaction exposes a batch-capable owner so the same atomic Factory evidence handoff remains available without Undo, echo publication, or persistence.',
        'Reactive publication takes one observer-registry snapshot and invokes the batch observer once while preserving event order.',
        'Actor B produces no Undo, no echo publication, no persistence capture, no provider save, and no IndexedDB write.',
        'Remote publication settlement is a discriminated success or terminal failure outcome: success resolves the active decoded-publication lease and permits the next lease, while failure tears down the active and pending leases and releases none.',
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
        'packages/factory/src/factory.ts',
        'packages/factory/src/__tests__/factory.test.ts',
        'packages/reactive-events/src/event-bus.ts',
        'packages/reactive-events/src/__tests__/event-bus.test.ts',
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
      id: 'load-empty-demo-document',
      order: 1,
      laneId: 'persistence-proof',
      title: 'Load an empty demo document without client persistence',
      ownerPackage: 'Asyra Design RenderApp startup',
      purpose:
        'Load one canonical empty document for ordinary local and collaboration demo sessions without a client persistence provider so local actions and remote apply perform no persistence capture, provider save, IndexedDB read, or IndexedDB write.',
      inputs: [
        'ordinary local or collaboration demo session',
        'Asyra Design RenderApp startup policy'
      ],
      outputs: ['artifact:empty-memory-demo-document'],
      conditions: [
        'After Core starts, RenderApp loads exactly one canonical empty document through the ordinary Core load API; a collaboration session performs that load before Collaboration connects.',
        'Ordinary local and collaboration sessions start without creating, initializing, loading, or injecting a client persistence provider.',
        'Local actions, Undo, and Redo perform zero client persistence capture, provider save, IndexedDB read, and IndexedDB write.',
        'Actor B remote apply performs zero client persistence capture, provider save, IndexedDB read, and IndexedDB write.',
        'Local and collaboration sessions still preserve one outer action transaction, exact Undo and Redo, canonical IDs, complete detail, and ordered canonical publication.'
      ],
      bypasses: [
        'Formal server checkpoint policy and backend database durability remain outside this plan.',
        'Demo reload durability is not a correctness or performance gate while client persistence is disabled.'
      ],
      allowedContributors: [
        'ordinary local demo startup',
        'collaboration fileId',
        'Asyra Design RenderApp startup',
        'Core startup without a persistence provider',
        'cheap zero-side-effect runtime counters'
      ],
      forbiddenContributors: [
        'demo client persistence provider',
        'demo IndexedDB migration or persisted-document load',
        'demo persistence capture or save',
        'reload durability assertions',
        'changes to Factory history or transaction semantics'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/render-app/index.tsx',
        'apps/asyra-design/src/render-app/__tests__',
        'apps/asyra-design/e2e',
        'docs/ai/apps/asyra-design'
      ],
      specRefs: [
        '#demo-client-persistence-bypass',
        '#transaction-boundary',
        '#step-local-gates'
      ],
      failureOwnerStepId: 'load-empty-demo-document'
    },
    {
      id: 'evaluate-local-interactive-drawing',
      order: 1,
      laneId: 'persistence-proof',
      title: 'Evaluate one local interactive drawing',
      ownerPackage: 'Asyra Design single-Actor performance E2E',
      purpose:
        'Measure one production single-Actor 7,112-element progressive turn from accepted request through exact-bounds loading, first ordinary Vector, real batch milestones, canonical completion, and settled UI without collaboration or persistence noise.',
      inputs: [
        'artifact:local-drawing-progress-state',
        'artifact:local-document-interaction-lock-state',
        'artifact:app-bulk-timing',
        'artifact:visible-canonical-slices',
        'artifact:render-ui-timing'
      ],
      outputs: ['artifact:local-interactive-drawing-proof'],
      conditions: [
        'The gate uses one fresh single Actor, one empty canonical document, the ordinary Mock AI default progressive mode, and one 7,112-element balanced composition run.',
        'The report names accepted-to-connected DOM loading state, accepted-to-first compositor paint opportunity, accepted-to-first ordinary Vector visible, 25, 50, 75, and 100 percent visible-element milestones, longest canonical work unit, cooperative yield count, product settled time, Render time, UI time, and harness overhead.',
        'Milestones use O(1) runtime counters and one terminal exact canonical summary; the harness never polls a full canonical snapshot.',
        'Before the first canonical mutation, the connected DOM loading overlay has a non-zero exact transformed bounds rectangle; that loading state and the ordinary Vector output come from the same live measured App state and receive synchronized visual inspection.',
        'During a cooperative yield, ordinary viewport pan and zoom repaint the same live App state while every other document interaction produces no canonical mutation or history; terminal cleanup releases the App lock.',
        'The final state preserves all 7,112 canonical projections, exact bounds and detail, and one intended Undo action.'
      ],
      bypasses: [
        'Contents projection, collaboration, WebSocket transport, a second Actor, and CRDT convergence are excluded from this local gate.',
        'No IndexedDB provider, read, capture, save, write, state hash, reload, screenshot trace, video, or repeated measured run is part of this gate.',
        'This local proof does not close or waive any deferred collaboration, persistence-policy, Contents, or full-plan gate.'
      ],
      allowedContributors: [
        'production Asyra Design App',
        'artifact:local-drawing-progress-state',
        'ordinary Vector projection milestones',
        'detached monotonic production timing',
        'app-visual-review-sync live App screenshots'
      ],
      forbiddenContributors: [
        'dev-only mutable canonical globals as release evidence',
        'full canonical snapshot polling',
        'second browser actor or collaboration server',
        'IndexedDB timing or state assertions',
        'warm-up or repeated high-detail creation',
        'state-only loading visibility evidence',
        'Canvas or Render-owned loading screenshot',
        'microtask-only yield presented as browser task evidence'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/e2e',
        'apps/asyra-design/src/init/performance/ai-drawing-performance-profile.ts',
        'apps/asyra-design/src/init/__tests__'
      ],
      specRefs: [
        '#current-local-interactive-drawing-closure',
        '#current-local-performance-measurement',
        '#current-local-gates'
      ],
      failureOwnerStepId: 'evaluate-local-interactive-drawing'
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
        'artifact:empty-memory-demo-document'
      ],
      outputs: ['artifact:performance-equivalence-proof'],
      conditions: [
        'One warm-up precedes three measured runs and median and worst values are reported separately.',
        'Spans report product execution, artifact construction, encode, server queue/drain, worker decode, remote apply, Render, UI, and harness overhead separately.',
        'The production performance profile exposes detached canonical, history, Factory transaction-status, commit, and publication evidence without exposing a mutable runtime owner.',
        'Navigation, App readiness, collaboration readiness, Mock AI readiness, reference attachment, runtime evidence readiness, and history baselines are named E2E harness spans.',
        'Both collaboration actors expose cheap zero-side-effect evidence without reading or hashing IndexedDB state.',
        'The default 16-item CRDT case, one change-aware 7,112-element balanced correctness run, independent 7,076-element no-media CRDT and performance runs, and the 27,471-element 295,794-point gate pass.',
        'Canonical equivalence compares exact IDs, order, point counts, topology, hierarchy, bounds, transforms, roles, styles, visibility, and transaction evidence.',
        'Synchronized Actor A and Actor B screenshots come from the same measured live App state and are inspected for complete uncropped output, Styles, IDs, and hierarchy.',
        'Generated screenshots, recordings, traces, profiles, and thumbnails are ignored and never committed.'
      ],
      bypasses: [
        'A development build, stale document, missing owner span, or test-induced scheduling cannot satisfy a release budget.',
        'The dev-only window.__Core__ diagnostic or another mutable runtime owner cannot satisfy production release evidence.',
        'A visually similar result with canonical or history drift fails.',
        'The 7,076-element full two-window recording runs only after explicit user opt-in.'
      ],
      allowedContributors: [
        'declared owner timing artifacts',
        'production performance profile detached runtime evidence',
        'ordinary canonical, history, and collaboration queries',
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
        'apps/asyra-design/playwright.collaboration.config.ts',
        'apps/asyra-design/src/init/performance/ai-drawing-performance-profile.ts',
        'apps/asyra-design/src/init/__tests__',
        'packages/collaboration/src/__tests__',
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
      id: 'route-composition-batches-to-canonical',
      from: 'stage-local-interactive-composition',
      to: 'apply-canonical-property-scene-batch',
      kind: 'handoff',
      predicate: 'The validated descriptor contains an accepted mutation.',
      producedArtifacts: ['artifact:composition-batch-sequence']
    },
    {
      id: 'route-app-timing-to-proof',
      from: 'stage-local-interactive-composition',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate: 'App bulk preparation emitted a bounded timing sample.',
      producedArtifacts: ['artifact:app-bulk-timing']
    },
    {
      id: 'route-app-timing-to-local-proof',
      from: 'stage-local-interactive-composition',
      to: 'evaluate-local-interactive-drawing',
      kind: 'observation',
      predicate:
        'The single-Actor local run emitted bounded App bulk timing samples.',
      producedArtifacts: ['artifact:app-bulk-timing']
    },
    {
      id: 'route-local-drawing-progress-to-proof',
      from: 'stage-local-interactive-composition',
      to: 'evaluate-local-interactive-drawing',
      kind: 'observation',
      predicate:
        'One single-Actor run observed exact-bounds loading, first ordinary Vector, actual batch milestones, and terminal cleanup.',
      producedArtifacts: ['artifact:local-drawing-progress-state']
    },
    {
      id: 'route-local-interaction-lock-to-proof',
      from: 'stage-local-interactive-composition',
      to: 'evaluate-local-interactive-drawing',
      kind: 'observation',
      predicate:
        'One cooperative yield retained ordinary pan and zoom while other document interactions stayed outside canonical mutation and history.',
      producedArtifacts: ['artifact:local-document-interaction-lock-state']
    },
    {
      id: 'route-local-visible-slices-to-proof',
      from: 'project-visible-canonical-slices',
      to: 'evaluate-local-interactive-drawing',
      kind: 'observation',
      predicate:
        'One production single-Actor progressive turn emitted ordinary visible Vector milestones.',
      producedArtifacts: [
        'artifact:visible-canonical-slices',
        'artifact:render-ui-timing'
      ]
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
      id: 'route-history-artifact-to-canonical-replay',
      from: 'record-and-deliver-transaction-batch',
      to: 'apply-canonical-property-scene-batch',
      kind: 'history-replay',
      predicate:
        'Undo or Redo retains exact forward or inverse canonical evidence that requires lifecycle-aware removal or restore.',
      producedArtifacts: ['artifact:factory-mutation-batch-artifact']
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
      id: 'route-source-frame-admitted-to-codec-provider',
      from: 'relay-frames-with-backpressure',
      to: 'encode-publication-frames',
      kind: 'credit',
      predicate:
        'One source frame entered every request-start peer queue and the provider may send the next frame.',
      producedArtifacts: ['artifact:source-frame-admitted-credit']
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
        'The receiver exposed one validated, normalized, immutable decoded-publication lease.',
      producedArtifacts: ['artifact:decoded-publication-batches']
    },
    {
      id: 'route-remote-settlement-to-codec-lease',
      from: 'apply-remote-publication-batches',
      to: 'encode-publication-frames',
      kind: 'settlement',
      predicate:
        'Success resolves the active remote publication and releases the next decoded lease; terminal failure clears the active and pending leases and releases none.',
      producedArtifacts: ['artifact:remote-publication-settlement']
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
      id: 'route-empty-demo-document-to-full-proof',
      from: 'load-empty-demo-document',
      to: 'evaluate-performance-and-equivalence',
      kind: 'policy-proof',
      predicate:
        'Ordinary local and collaboration demo sessions started without a client persistence provider and retained zero client persistence side effects.',
      producedArtifacts: ['artifact:empty-memory-demo-document']
    },
    {
      id: 'route-local-interactive-drawing-proof',
      from: 'evaluate-local-interactive-drawing',
      kind: 'terminal',
      predicate:
        'The current local-only formal measurement and synchronized visual review ran once.',
      producedArtifacts: ['artifact:local-interactive-drawing-proof']
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
      id: 'artifact:composition-batch-sequence',
      ownerStepId: 'stage-local-interactive-composition',
      channel: 'Asyra Design common API',
      consumerStepIds: ['apply-canonical-property-scene-batch'],
      terminal: false
    },
    {
      id: 'artifact:local-drawing-progress-state',
      ownerStepId: 'stage-local-interactive-composition',
      channel:
        'runtime-only App System Context to committed DOM compositor overlay',
      consumerStepIds: ['evaluate-local-interactive-drawing'],
      terminal: false
    },
    {
      id: 'artifact:local-document-interaction-lock-state',
      ownerStepId: 'stage-local-interactive-composition',
      channel:
        'runtime-only App interaction policy and ordinary viewport input route',
      consumerStepIds: ['evaluate-local-interactive-drawing'],
      terminal: false
    },
    {
      id: 'artifact:app-bulk-timing',
      ownerStepId: 'stage-local-interactive-composition',
      channel: 'detached monotonic timing',
      consumerStepIds: [
        'evaluate-local-interactive-drawing',
        'evaluate-performance-and-equivalence'
      ],
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
        'apply-canonical-property-scene-batch',
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
      channel: 'single immutable worker-validated decoded-publication lease',
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
      id: 'artifact:source-frame-admitted-credit',
      ownerStepId: 'relay-frames-with-backpressure',
      channel: 'exact per-source-frame admission credit',
      consumerStepIds: ['encode-publication-frames'],
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
      id: 'artifact:remote-publication-settlement',
      ownerStepId: 'apply-remote-publication-batches',
      channel:
        'decoded-publication lease settlement outcome: success | terminal failure',
      consumerStepIds: ['encode-publication-frames'],
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
      consumerStepIds: [
        'evaluate-local-interactive-drawing',
        'evaluate-performance-and-equivalence'
      ],
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
      consumerStepIds: [
        'evaluate-local-interactive-drawing',
        'evaluate-performance-and-equivalence'
      ],
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
      id: 'artifact:empty-memory-demo-document',
      ownerStepId: 'load-empty-demo-document',
      channel: 'RenderApp empty memory-only demo startup policy',
      consumerStepIds: ['evaluate-performance-and-equivalence'],
      terminal: false
    },
    {
      id: 'artifact:local-interactive-drawing-proof',
      ownerStepId: 'evaluate-local-interactive-drawing',
      channel: 'terminal current-phase formal evidence',
      consumerStepIds: [],
      terminal: true
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
        'stage-local-interactive-composition',
        'apply-canonical-property-scene-batch',
        'record-and-deliver-transaction-batch',
        'encode-publication-frames',
        'relay-frames-with-backpressure',
        'apply-remote-publication-batches'
      ],
      artifactIds: [
        'artifact:composition-batch-sequence',
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
      id: 'demo-has-no-client-persistence-side-effects',
      statement:
        'Ordinary local actions and collaboration remote publications update canonical, Render, and UI state without any client persistence capture, provider save, IndexedDB read, or IndexedDB write; remote apply additionally creates no Undo or echo publication.',
      stepIds: [
        'load-empty-demo-document',
        'evaluate-local-interactive-drawing',
        'apply-remote-publication-batches',
        'project-visible-canonical-slices',
        'evaluate-performance-and-equivalence'
      ],
      artifactIds: [
        'artifact:empty-memory-demo-document',
        'artifact:remote-factory-mutation-batch',
        'artifact:visible-canonical-slices'
      ],
      specRefs: [
        '#remote-apply-contract',
        '#demo-client-persistence-bypass'
      ]
    }
  ]

  const acceptanceContracts = [
    {
      id: 'bulk-and-history-equivalence',
      title: 'Bulk canonical and history equivalence',
      assertions: [
        'One Group plus one atomic all-children batch or ordered progressive plural batches preserves exact IDs, order, topology, properties, relationships, and component ownership.',
        'A later invalid item leaves no prefix, and single-item APIs are equivalent batch-of-one conveniences.',
        'One immutable Factory artifact produces one intended Undo action and exact Undo, Redo, and rollback compensation.'
      ],
      stepIds: [
        'stage-local-interactive-composition',
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
        'Each peer queue remains within the exact 2 MiB unretired-byte capacity and separates server-accepted, frame-consumed, and peer-applied receipts.',
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
      id: 'local-interactive-drawing',
      title: 'Local progressive drawing is visibly active and complete',
      assertions: [
        'Exact validated bounds become visible as a connected runtime-only DOM compositor loading state before the first canonical mutation.',
        'Progressive plural Core work units make ordinary editable Vectors visible at real element milestones, return control through one serialized later-task loop, and retain one outer transaction with one intended Undo action.',
        'During cooperative yields, the App-owned document interaction lock keeps ordinary viewport pan and zoom responsive while every other document interaction stays outside canonical mutation and history, then releases at terminal cleanup.',
        'One single-Actor 7,112-element production run reports DOM loading, first compositor paint opportunity, first Vector, 25, 50, 75, 100 percent, longest work unit, cooperative yield count, settled, Render, UI, and harness timing without collaboration, Contents, or IndexedDB work.'
      ],
      stepIds: [
        'stage-local-interactive-composition',
        'project-visible-canonical-slices',
        'evaluate-local-interactive-drawing'
      ],
      specRefs: [
        '#exact-bounds-loading-frame',
        '#cooperative-progressive-composition',
        '#current-local-performance-measurement'
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
        'load-empty-demo-document',
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
        'One canonical composition batch, one immutable Factory artifact, visible ordinary Vector slices, binary backpressured collaboration, zero demo client persistence, and exact performance-equivalence proof.'
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
