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
        'production App Mock AI startup with progressive default and explicit atomic measurement opt-in',
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
        'The production Asyra Design entry exposes Mock AI without an ai query and uses the progressive path by default so the ordinary local demo remains cooperative; explicit aiDelivery=atomic retains the one-batch atomic path for isolated measurement.',
        'After validated accepted descriptors determine exact bounds, the App publishes a runtime-only loading state, commits a connected App DOM overlay, and crosses a browser paint opportunity before the first canonical mutation.',
        'The App acquires one runtime-only document interaction lock before opening the outer App transaction; the lock allows ordinary viewport pan and zoom to repaint the live loading frame and Vector output while it blocks every other document interaction, document mutation, and canonical mutation.',
        'Viewport navigation while locked continues through ordinary Feature execution and may cross its existing transaction wrapper, but produces no canonical mutation or history and does not alter the AI action transaction evidence or accepted composition bounds; AI cancellation remains available.',
        'Atomic mode creates the Group and submits one all-children plural Core batch; progressive mode creates the Group and submits multiple deterministic plural Core batches.',
        'Progressive batch boundaries enforce both a point budget and an element-count budget capped at 64 per work unit; one indivisible element may exceed only the point soft target.',
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
        'apps/asyra-design/src/index.tsx',
        'apps/asyra-design/e2e/conversational-ai-mock.spec.ts',
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
      title: 'Schedule and project visible canonical frames',
      ownerPackage:
        '@asyra/render and @asyra/render-engine-pixi frame ownership',
      purpose:
        'Schedule rendering only from explicit framework invalidation, prevent the concrete Pixi runtime from bypassing the dirty gate, and consume local and remote Factory batch artifacts through the ordinary Vector route.',
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
        'The Pixi Application ticker must not render outside the framework dirty gate; one scheduled frame performs at most one explicit engine flush.',
        'A settled zero-element App has no scheduled frame, no engine flush, and no unbounded performance evidence.',
        'Pan, zoom, canonical change, computed change, and system property change each schedule at most one frame; a future local animation schedules subsequent frames through its ordinary computed updates rather than a permanent idle loop.',
        'Performance instrumentation records bounded evidence only for demanded frame work and cannot create a second per-frame workload.',
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
        '@asyra/render-engine-pixi owned frame scheduler and explicit flush',
        'Asyra Design UI context projection'
      ],
      forbiddenContributors: [
        'AI-only renderer or bitmap replacement',
        'Render-owned canonical state',
        'final-only progressive peer output',
        'one full UI map rebuild per ADD_ELEMENT',
        'diagnostic or evidence geometry',
        'Pixi Application auto-render ticker',
        'permanent idle frame loop',
        'unbounded per-frame diagnostic arrays'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src/data-channel-observer.ts',
        'packages/core/src/core.ts',
        'packages/core/src/__tests__',
        'packages/core/src/__tests__/core-start-render.test.ts',
        'packages/preset/src',
        'packages/preset/src/__tests__',
        'packages/render/src',
        'packages/render/src/__tests__',
        'packages/render-engine/src',
        'packages/render-engine/src/__tests__',
        'packages/render-engine-pixi/src',
        'packages/render-engine-pixi/src/__tests__',
        'apps/asyra-design/src/contexts/data-change.tsx',
        'apps/asyra-design/src/providers/scene-tree.ts',
        'apps/asyra-design/src/providers/__tests__/scene-tree.test.tsx',
        'apps/asyra-design/src/init/init-app.ts',
        'apps/asyra-design/src/init/__tests__/init-app.test.ts',
        'apps/asyra-design/src/init/performance/ai-drawing-performance-profile.ts',
        'apps/asyra-design/src/init/__tests__/ai-drawing-performance-profile.test.ts'
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
        'artifact:relayed-publication-frames'
      ],
      outputs: [
        'artifact:encoded-publication-frames',
        'artifact:decoded-publication-candidates',
        'artifact:codec-timing'
      ],
      conditions: [
        'Hello, ack, failure, awareness, and credit control frames remain JSON.',
        'All shared publication data uses a versioned binary frame and is not pre-serialized as JSON.',
        'The existing codec runs in the Dedicated Worker without a new package.',
        'Outbound encoding performs one object-to-worker structured clone; the Worker encodes the publication and writes each frame directly to the Worker-owned WebSocket.',
        'Inbound decoding validates version, header, chunk order, duplicate identity, and payload schema exactly once in the worker.',
        'The Worker posts one decoded publication candidate through the sole worker-to-main structured-clone boundary without main-thread JSON pre-serialization, recursive clone, or recursive freeze.',
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
        '@asyra/collaboration public publication schema',
        'existing repository codec',
        'platform Web Worker and transferable buffers'
      ],
      forbiddenContributors: [
        'new codec dependency',
        'JSON stringify of publication data before binary encoding',
        'main-thread publication byte send',
        'main-thread publication compression',
        'element, point, payload, or composition ceiling',
        'worker-owned App policy'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/collaboration/compact-binary.ts',
        'apps/asyra-design/src/collaboration/compact-json.ts',
        'apps/asyra-design/src/collaboration/collaboration-transport-worker.ts',
        'apps/asyra-design/src/collaboration/protocol.ts',
        'apps/asyra-design/src/collaboration/publication-codec-worker.ts',
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
      id: 'admit-receiver-publication-frames',
      order: 2,
      laneId: 'wire-transport',
      title: 'Admit receiver publication frames',
      ownerPackage:
        'Asyra Design Dedicated Worker WebSocket receiver scheduler',
      purpose:
        'Admit validated inbound publication bytes independently from main-thread canonical apply, expose one decoded publication to one required async consumer, and keep wire credit, App settlement, and teardown distinct.',
      inputs: [
        'artifact:relayed-publication-frames',
        'artifact:decoded-publication-candidates',
        'artifact:server-accepted-receipts',
        'artifact:source-frame-admitted-credit',
        'artifact:remote-publication-settlement'
      ],
      outputs: [
        'artifact:decoded-publication-batches',
        'artifact:frame-consumed-credit',
        'artifact:receiver-handoff-timing'
      ],
      conditions: [
        'A Dedicated Worker owns the browser WebSocket data plane, receives publication bytes, performs wire admission, and sends frame-consumed directly on its socket without waiting for the main thread.',
        'The main-thread Provider never receives inbound publication bytes and never sends frame-consumed; it exchanges only bounded commands, normalized control evidence, one decoded publication handoff, and apply settlement with the Worker.',
        'Inbound ArrayBuffer data enters a bounded 2 MiB frame-ingress window; one active oversized publication assembly is allowed only without a second queued publication.',
        'After worker header, order, duplicate, and capacity validation, frame-consumed credit is emitted independently of later App policy or canonical apply.',
        'The worker-to-main structured clone is the only inbound object isolation boundary; validated publication evidence enters a single-consumer ownership contract without a Provider clone or recursive main-thread freeze.',
        'The receiver retains bounded decoded candidates while exposing exactly one read-only publication to exactly one required async Collaboration consumer until its Promise settlement.',
        'The Dedicated Worker keeps one outbound publication frame in flight and sends the next frame directly on its WebSocket only after exact source-frame-admitted credit.',
        'Successful remote publication settlement releases the next decoded publication; terminal apply failure clears active and pending publications and releases no fabricated progress.',
        'Slow App apply cannot prevent already-bounded later frames from entering the worker or returning wire credit.',
        'Disconnect, worker teardown, and invalid settlement reject pending work through ProviderFailure and close all receiver-owned capacity.'
      ],
      bypasses: [
        'Disconnected mode admits no frame.',
        'JSON control messages bypass publication ingress and remain readable while data admission is blocked.',
        'A terminal apply failure releases no later decoded publication.'
      ],
      allowedContributors: [
        'Dedicated Worker WebSocket ownership',
        'artifact:relayed-publication-frames',
        'artifact:decoded-publication-candidates',
        'artifact:server-accepted-receipts',
        'artifact:source-frame-admitted-credit',
        'artifact:remote-publication-settlement',
        'platform transferable ArrayBuffer ownership',
        '@asyra/collaboration required async publication consumer'
      ],
      forbiddenContributors: [
        'main-thread WebSocket publication receive or wire-credit send',
        'wire credit delayed until App canonical apply',
        'unbounded main-thread frame or publication queue',
        'overlapping decoded publication consumers',
        'main-thread recursive publication clone or freeze',
        'Provider-owned App policy or canonical mutation'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/collaboration/collaboration-transport-worker.ts',
        'apps/asyra-design/src/collaboration/publication-codec-worker.ts',
        'apps/asyra-design/src/collaboration/websocket-provider.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-websocket-provider.test.ts',
        'packages/collaboration/src/provider.ts',
        'packages/collaboration/src/process.ts',
        'packages/collaboration/src/__tests__/process.test.ts'
      ],
      specRefs: [
        '#binary-collaboration-transport',
        '#endpoint-ordered-refactor-closure',
        '#endpoint-proof-gates'
      ],
      failureOwnerStepId: 'admit-receiver-publication-frames'
    },
    {
      id: 'relay-frames-with-backpressure',
      order: 3,
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
      order: 4,
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
        'Remote publication settlement is a discriminated success or terminal failure outcome: success resolves the active decoded publication and permits the next publication, while failure tears down the active and pending publications and releases none.',
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
      id: 'evaluate-endpoint-performance',
      order: 2,
      laneId: 'persistence-proof',
      title: 'Evaluate one refactored endpoint safely',
      ownerPackage: 'Asyra Design guarded endpoint performance E2E',
      purpose:
        'Run exactly one production two-Actor 7,076-element creation proof immediately after each completed endpoint refactor, compare only its owned evidence with the preceding accepted baseline, and stop all owned work before host overload can continue.',
      inputs: [
        'artifact:app-bulk-timing',
        'artifact:canonical-batch-timing',
        'artifact:factory-batch-timing',
        'artifact:receiver-handoff-timing',
        'artifact:relay-timing',
        'artifact:codec-timing',
        'artifact:remote-apply-timing',
        'artifact:render-ui-timing',
        'artifact:accepted-endpoint-baseline'
      ],
      outputs: [
        'artifact:accepted-endpoint-baseline',
        'artifact:endpoint-performance-proof',
        'artifact:resource-guard-stop-proof'
      ],
      conditions: [
        'One collaboration endpoint proof uses exactly one production two-Actor 7,076-element progressive creation with no follow-up mutation, Undo or Redo execution, persistence, media, trace, CPU profile, warm-up, or repeat.',
        'A local-only endpoint may additionally use one single-Actor 7,112-element creation, but it cannot replace the two-Actor proof for a collaboration endpoint.',
        'The guard authenticates one ready heartbeat and confirms process ownership and CPU sampling before the 7,076-element request may start.',
        'A fixed tracked process registry contains only test-harness, client-browser, app-server, and websocket-server; aggregate CPU above 150 percent stops the proof while the bounded report keeps separate role CPU for product, local server, and harness attribution.',
        'A bounded heartbeat reports the current phase, Actor A and Actor B canonical element counts, publication progress, test-owned process-tree CPU, and latest owner timing without walking the full canonical graph.',
        'The production performance profile provides O(1) canonical, Render projection, Factory publication, and history scalar queries; Render projection counts remain uncapped so over-projection is reported as a correctness failure.',
        'The ordinary Playwright suite always excludes the guarded endpoint spec even if guard environment variables leak into that process.',
        'The 250-millisecond cadence is armed before the immediate first CPU sample, every sample has a 200-millisecond hard timeout, and guard SIGINT, SIGTERM, SIGHUP, exceptional exit, sampling failure, or benchmark failure terminates only the fixed registered process groups.',
        'A complete heartbeat is accepted only when both Actors remain exactly complete with canonical and uncapped Render projection element counts equal to total and one bounded endpoint report is valid; late over-projection cannot reuse an earlier success report.',
        'A single test-owned process-tree sample above 150 percent CPU stops the benchmark immediately and marks the active architecture attempt invalid; configuration cannot relax that limit.',
        'CPU above the fixed limit, a stale heartbeat above the ordinary 80 percent baseline, or stalled Actor A and Actor B progress above that baseline fails the active endpoint immediately.',
        'On resource failure the guard terminates tracked Playwright, headless browser, App server, and collaboration server processes before returning the last completed phase, Actor A and Actor B element counts, CPU samples, publication progress, and owner timing.',
        'If process ownership or heartbeat evidence cannot be established, the 7,000-plus benchmark refuses to start unguarded.',
        'Success preserves exact canonical IDs, order, detail, topology, hierarchy, styles, one Actor A Undo action, zero Actor B Undo, zero echo, and zero client persistence work.',
        'Effectiveness requires the owned failing budget to become green or the owned structural, span, or queue metric to improve by at least 15 percent without an adjacent critical owner regressing more than 15 percent.',
        'The first receiver endpoint uses the retained 940/7,076 elements and 11/35 publications at 30 seconds as its pre-refactor comparison and performs no additional 7,076-element seed run; every later endpoint consumes artifact:accepted-endpoint-baseline.',
        'One endpoint receives at most five materially revised architecture attempts; the same focused failure three times stops earlier.'
      ],
      bypasses: [
        'The creation-only endpoint proof never runs the complete two-window recording or full three-turn flow.',
        'The first receiver endpoint does not require artifact:accepted-endpoint-baseline because the retained pre-refactor evidence is its fixed seed.',
        'An owner proven below five percent of product time remains unchanged rather than receiving a speculative optimization.',
        'Contents and production persistence are outside this endpoint proof.'
      ],
      allowedContributors: [
        'production Asyra Design App and collaboration server',
        'authenticated guard-ready handshake',
        'detached O(1) runtime counters',
        'tracked test-owned process ids',
        'declared owner timing artifacts',
        'one terminal bounded canonical equivalence summary'
      ],
      forbiddenContributors: [
        'untracked process termination',
        'full canonical snapshot polling in the heartbeat',
        'video, screenshots, trace, or CPU profiling',
        'harness overhead attributed to a product owner',
        'continuing after a resource guard failure',
        'committing an ineffective endpoint attempt'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/e2e/crdt-endpoint-performance.spec.ts',
        'apps/asyra-design/e2e/performance-resource-guard.mjs',
        'apps/asyra-design/playwright.endpoint-performance.config.ts',
        'apps/asyra-design/__tests__/performance-resource-guard.test.mjs',
        'apps/asyra-design/__tests__/playwright-config.test.mjs',
        'apps/asyra-design/src/init/performance/ai-drawing-performance-profile.ts',
        'apps/asyra-design/src/init/__tests__/ai-drawing-performance-profile.test.ts',
        'apps/asyra-design/src/init/init-app.ts',
        'apps/asyra-design/src/init/__tests__/init-app.test.ts',
        'apps/asyra-design/playwright.config.ts',
        'packages/render/src/render.ts',
        'packages/render/src/layers/viewport/viewport-layer.ts',
        'packages/render/src/__tests__/render.test.ts',
        'packages/render/src/__tests__/viewport-layer.test.ts',
        'packages/factory/src/data-transact.ts',
        'packages/factory/src/factory.ts',
        'packages/factory/src/__tests__/history-depth.test.ts',
        'docs/ai/framework/API_SURFACES.md',
        'docs/ai/framework/packages/factory.md',
        'docs/ai/framework/packages/render.md',
        'apps/asyra-design/package.json'
      ],
      specRefs: [
        '#endpoint-ordered-refactor-closure',
        '#common-creation-only-benchmark',
        '#host-resource-guard',
        '#endpoint-iteration-and-effectiveness',
        '#endpoint-proof-gates'
      ],
      failureOwnerStepId: 'evaluate-endpoint-performance'
    },
    {
      id: 'evaluate-performance-and-equivalence',
      order: 3,
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
        'artifact:receiver-handoff-timing',
        'artifact:relay-timing',
        'artifact:remote-factory-mutation-batch',
        'artifact:peer-applied-receipts',
        'artifact:remote-apply-timing',
        'artifact:visible-canonical-slices',
        'artifact:ui-context-batch-projection',
        'artifact:render-ui-timing',
        'artifact:empty-memory-demo-document',
        'the accepted endpoint performance proofs'
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
      from: 'admit-receiver-publication-frames',
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
      from: 'admit-receiver-publication-frames',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate: 'Wire-consumption credit timing is available.',
      producedArtifacts: ['artifact:frame-consumed-credit']
    },
    {
      id: 'route-receiver-handoff-to-full-proof',
      from: 'admit-receiver-publication-frames',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate:
        'Receiver frame admission, active decoded publication, and App settlement timing is available.',
      producedArtifacts: ['artifact:receiver-handoff-timing']
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
      to: 'admit-receiver-publication-frames',
      kind: 'receipt',
      predicate:
        'Every current peer queue had bounded capacity for the accepted frame.',
      producedArtifacts: ['artifact:server-accepted-receipts']
    },
    {
      id: 'route-source-frame-admitted-to-codec-provider',
      from: 'relay-frames-with-backpressure',
      to: 'admit-receiver-publication-frames',
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
      id: 'route-decoded-candidate-to-receiver',
      from: 'encode-publication-frames',
      to: 'admit-receiver-publication-frames',
      kind: 'handoff',
      predicate:
        'The worker decoded and validated one transferable publication candidate.',
      producedArtifacts: ['artifact:decoded-publication-candidates']
    },
    {
      id: 'route-decoded-publication-to-remote',
      from: 'admit-receiver-publication-frames',
      to: 'apply-remote-publication-batches',
      kind: 'handoff',
      predicate:
        'The receiver exposed one validated, normalized, read-only decoded publication to the single async consumer.',
      producedArtifacts: ['artifact:decoded-publication-batches']
    },
    {
      id: 'route-remote-settlement-to-receiver',
      from: 'apply-remote-publication-batches',
      to: 'admit-receiver-publication-frames',
      kind: 'settlement',
      predicate:
        'Success resolves the active remote publication and releases the next decoded publication; terminal failure clears the active and pending publications and releases none.',
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
      id: 'route-app-timing-to-endpoint-proof',
      from: 'stage-local-interactive-composition',
      to: 'evaluate-endpoint-performance',
      kind: 'observation',
      predicate: 'The active endpoint proof includes local App bulk timing.',
      producedArtifacts: ['artifact:app-bulk-timing']
    },
    {
      id: 'route-canonical-timing-to-endpoint-proof',
      from: 'apply-canonical-property-scene-batch',
      to: 'evaluate-endpoint-performance',
      kind: 'observation',
      predicate:
        'The active endpoint proof includes canonical preflight and apply timing.',
      producedArtifacts: ['artifact:canonical-batch-timing']
    },
    {
      id: 'route-factory-timing-to-endpoint-proof',
      from: 'record-and-deliver-transaction-batch',
      to: 'evaluate-endpoint-performance',
      kind: 'observation',
      predicate:
        'The active endpoint proof includes Factory artifact and pub/sub timing.',
      producedArtifacts: ['artifact:factory-batch-timing']
    },
    {
      id: 'route-receiver-timing-to-endpoint-proof',
      from: 'admit-receiver-publication-frames',
      to: 'evaluate-endpoint-performance',
      kind: 'observation',
      predicate:
        'The active endpoint proof includes frame admission and active decoded-publication timing.',
      producedArtifacts: ['artifact:receiver-handoff-timing']
    },
    {
      id: 'route-relay-timing-to-endpoint-proof',
      from: 'relay-frames-with-backpressure',
      to: 'evaluate-endpoint-performance',
      kind: 'observation',
      predicate:
        'The active endpoint proof includes peer queue, socket drain, and receipt timing.',
      producedArtifacts: ['artifact:relay-timing']
    },
    {
      id: 'route-codec-timing-to-endpoint-proof',
      from: 'encode-publication-frames',
      to: 'evaluate-endpoint-performance',
      kind: 'observation',
      predicate:
        'The active endpoint proof includes worker encode and decode timing.',
      producedArtifacts: ['artifact:codec-timing']
    },
    {
      id: 'route-remote-timing-to-endpoint-proof',
      from: 'apply-remote-publication-batches',
      to: 'evaluate-endpoint-performance',
      kind: 'observation',
      predicate:
        'The active endpoint proof includes remote organization and canonical apply timing.',
      producedArtifacts: ['artifact:remote-apply-timing']
    },
    {
      id: 'route-projection-timing-to-endpoint-proof',
      from: 'project-visible-canonical-slices',
      to: 'evaluate-endpoint-performance',
      kind: 'observation',
      predicate:
        'The active endpoint proof includes ordinary Render and UI timing.',
      producedArtifacts: ['artifact:render-ui-timing']
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
      id: 'route-accepted-endpoint-baseline',
      from: 'evaluate-endpoint-performance',
      to: 'evaluate-endpoint-performance',
      kind: 'accepted-iteration-baseline',
      predicate:
        'An effective exact endpoint proof replaces the immediately preceding accepted baseline for the next endpoint.',
      producedArtifacts: ['artifact:accepted-endpoint-baseline']
    },
    {
      id: 'route-endpoint-performance-proof',
      from: 'evaluate-endpoint-performance',
      kind: 'terminal',
      predicate:
        'One effective endpoint produced exact guarded high-detail equivalence and owner-effectiveness evidence.',
      producedArtifacts: ['artifact:endpoint-performance-proof']
    },
    {
      id: 'route-resource-guard-stop-proof',
      from: 'evaluate-endpoint-performance',
      kind: 'terminal-failure',
      predicate:
        'The host resource guard crossed a CPU, heartbeat, or stalled-progress limit and stopped every tracked test process before reporting the last bounded evidence.',
      producedArtifacts: ['artifact:resource-guard-stop-proof']
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
        'evaluate-endpoint-performance',
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
      consumerStepIds: [
        'evaluate-endpoint-performance',
        'evaluate-performance-and-equivalence'
      ],
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
      consumerStepIds: [
        'evaluate-endpoint-performance',
        'evaluate-performance-and-equivalence'
      ],
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
      id: 'artifact:decoded-publication-candidates',
      ownerStepId: 'encode-publication-frames',
      channel: 'worker-validated transferable publication candidate',
      consumerStepIds: ['admit-receiver-publication-frames'],
      terminal: false
    },
    {
      id: 'artifact:decoded-publication-batches',
      ownerStepId: 'admit-receiver-publication-frames',
      channel: 'single read-only decoded-publication consumer handoff',
      consumerStepIds: ['apply-remote-publication-batches'],
      terminal: false
    },
    {
      id: 'artifact:frame-consumed-credit',
      ownerStepId: 'admit-receiver-publication-frames',
      channel: 'receiver worker wire-consumption credit',
      consumerStepIds: [
        'relay-frames-with-backpressure',
        'evaluate-endpoint-performance',
        'evaluate-performance-and-equivalence'
      ],
      terminal: false
    },
    {
      id: 'artifact:receiver-handoff-timing',
      ownerStepId: 'admit-receiver-publication-frames',
      channel: 'detached receiver admission and active-publication timing',
      consumerStepIds: [
        'evaluate-endpoint-performance',
        'evaluate-performance-and-equivalence'
      ],
      terminal: false
    },
    {
      id: 'artifact:codec-timing',
      ownerStepId: 'encode-publication-frames',
      channel: 'detached worker encode/decode timing',
      consumerStepIds: [
        'evaluate-endpoint-performance',
        'evaluate-performance-and-equivalence'
      ],
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
        'admit-receiver-publication-frames',
        'evaluate-performance-and-equivalence'
      ],
      terminal: false
    },
    {
      id: 'artifact:source-frame-admitted-credit',
      ownerStepId: 'relay-frames-with-backpressure',
      channel: 'exact per-source-frame admission credit',
      consumerStepIds: ['admit-receiver-publication-frames'],
      terminal: false
    },
    {
      id: 'artifact:relay-timing',
      ownerStepId: 'relay-frames-with-backpressure',
      channel: 'detached queue and drain timing',
      consumerStepIds: [
        'evaluate-endpoint-performance',
        'evaluate-performance-and-equivalence'
      ],
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
        'decoded-publication settlement outcome: success | terminal failure',
      consumerStepIds: ['admit-receiver-publication-frames'],
      terminal: false
    },
    {
      id: 'artifact:remote-apply-timing',
      ownerStepId: 'apply-remote-publication-batches',
      channel: 'detached remote apply timing',
      consumerStepIds: [
        'evaluate-endpoint-performance',
        'evaluate-performance-and-equivalence'
      ],
      terminal: false
    },
    {
      id: 'artifact:visible-canonical-slices',
      ownerStepId: 'project-visible-canonical-slices',
      channel: 'ordinary local and remote Vector projection',
      consumerStepIds: [
        'evaluate-local-interactive-drawing',
        'evaluate-endpoint-performance',
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
        'evaluate-endpoint-performance',
        'evaluate-performance-and-equivalence'
      ],
      terminal: false
    },
    {
      id: 'artifact:scrollable-contents-window',
      ownerStepId: 'project-scrollable-contents-window',
      channel: 'formal Contents tail-reachability evidence',
      consumerStepIds: [],
      terminal: true
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
      id: 'artifact:accepted-endpoint-baseline',
      ownerStepId: 'evaluate-endpoint-performance',
      channel:
        'exact accepted endpoint report used only by the immediately following endpoint comparison',
      consumerStepIds: ['evaluate-endpoint-performance'],
      terminal: false
    },
    {
      id: 'artifact:endpoint-performance-proof',
      ownerStepId: 'evaluate-endpoint-performance',
      channel:
        'terminal exact endpoint equivalence and effectiveness comparison',
      consumerStepIds: [],
      terminal: true
    },
    {
      id: 'artifact:resource-guard-stop-proof',
      ownerStepId: 'evaluate-endpoint-performance',
      channel:
        'terminal tracked-process stop with last phase, Actor A/B counts, CPU, publication, and owner timing evidence',
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
        'admit-receiver-publication-frames',
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
        'admit-receiver-publication-frames',
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
        'admit-receiver-publication-frames',
        'relay-frames-with-backpressure',
        'apply-remote-publication-batches'
      ],
      artifactIds: [
        'artifact:encoded-publication-frames',
        'artifact:relayed-publication-frames',
        'artifact:decoded-publication-candidates',
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
      specRefs: ['#remote-apply-contract', '#demo-client-persistence-bypass']
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
      id: 'visible-progressive-projection',
      title: 'Visible progressive projection',
      assertions: [
        'Atomic delivery flushes once and progressive delivery flushes every formal slice through the ordinary Vector route.',
        'All 7,076 editable elements remain complete and uncropped.'
      ],
      stepIds: ['project-visible-canonical-slices'],
      specRefs: ['#visible-atomic-and-progressive-projection', '#product-cases']
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
        'admit-receiver-publication-frames',
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
      id: 'endpoint-ordered-performance-closure',
      title: 'Each material endpoint proves effectiveness safely',
      assertions: [
        'Receiver admission, canonical source mutation, Factory pub/sub, remote apply, relay, codec, and material Render/UI owners advance in evidence-ranked order.',
        'Every completed owner receives one creation-only 7,076-element proof before another owner starts, with exact A/B completion and owner timing evidence.',
        'The process-tree guard terminates tracked test work on any sampled CPU above 150 percent, stale heartbeat, or stalled progress and reports the last phase plus Actor A/B element counts; a CPU-limit stop invalidates that architecture attempt.',
        'An ineffective endpoint returns to its first incorrect owner for at most five materially revised attempts; the same focused failure three times stops earlier.'
      ],
      stepIds: [
        'admit-receiver-publication-frames',
        'apply-canonical-property-scene-batch',
        'record-and-deliver-transaction-batch',
        'apply-remote-publication-batches',
        'relay-frames-with-backpressure',
        'encode-publication-frames',
        'project-visible-canonical-slices',
        'evaluate-endpoint-performance'
      ],
      specRefs: [
        '#endpoint-ordered-refactor-closure',
        '#host-resource-guard',
        '#endpoint-iteration-and-effectiveness',
        '#endpoint-proof-gates'
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
