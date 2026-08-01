;(function () {
  'use strict'

  const specPath =
    'docs/ai/apps/asyra-design/plans/completed/ai-conversational-drawing-performance-plan.md'
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
      id: 'preload-file-scoped-server-response',
      order: 1,
      laneId: 'app-canonical',
      title: 'Preload one file-scoped server response',
      ownerPackage: 'Asyra Design server response inbox',
      purpose:
        'Read one versioned server-prepared AiActionBatch containing a PreparedDrawingArtifact from the response inbox adapter by required fileId before App and Agent readiness, then hand it through the single formal provider requestActionBatch() contract without request-time model preparation.',
      inputs: [
        'artifact:precanonical-owner-attribution',
        'required fileId',
        'versioned server response record prepared by the test or manual harness before App navigation'
      ],
      outputs: [
        'artifact:server-prepared-action-batch',
        'artifact:response-inbox-bootstrap-timing',
        'artifact:provider-response-handoff-timing'
      ],
      conditions: [
        'This step is selected because guarded evidence identified request-time fixture import, full-source parsing, and materialization before the requested prefix as test-harness contamination at the server response boundary.',
        'Deterministic preparation, seed data, and fixtures belong only to the test or manual harness and are never imported into the production bundle. The harness prepares one exact versioned server response before product App navigation.',
        'The harness generates each compressed server response preview overlay after the production build and before the runtime guard; Playwright receives no prepared response payload and never serializes that payload across its process boundary.',
        'A same-origin blank seed page fetches the exact compressed response, uses the browser decompressor to decode it, and writes it to the response-inbox IndexedDB store while reporting bounded fetch, decompress, parse, and write timing.',
        'The generated response overlay is ignored test output layered over an attested production build. Canonical production dist contains no response fixture and the overlay is never a production deployment artifact.',
        'The required fileId selects exactly one prepared 16-, 320-, 1,280-, or 7,075-child response, and selecting a smaller response never reads or constructs a larger response.',
        'The response inbox adapter read completes before App and Agent readiness and before the stable performance baseline. IndexedDB is only an implementation detail of that response inbox adapter and is never presented as an App product mode.',
        'The response inbox is separate from canonical document persistence; the canonical document still loads empty and local or remote document actions perform zero persistence-provider or document-IndexedDB read and write.',
        'requestActionBatch() is the only public provider request. It returns one server-prepared AiActionBatch with one batchId and never selects another provider, payload, or execution path.',
        'Request-time provider acquisition performs zero response inbox access, dynamic import, fetch, JSON parse, SVG parse, path tokenize, geometry transform, fixture materialization, full-source slicing, or provider deep-freeze.',
        'Production provider execution has no artificial delay, phrase fixture fallback, failure simulation, deterministic seed branch, or fixture-selection branch.',
        'Actor B never executes the preloaded response and receives drawing state only through Actor A canonical publications and the ordinary CRDT route.',
        'Full-detail output preserves every item, point, role, order, bounds, transform, and style.',
        'The server-prepared AiActionBatch remains local, noncanonical, and nonshared; it is never passed to Core.load or treated as collaboration state.',
        'PreparedDrawingArtifact preserves every canonical descriptor, stable ID, relationship, item, path, point, role, order, bound, transform, and style while avoiding a resident duplicate point-object graph.'
      ],
      bypasses: [
        'Live server transport and the response inbox adapter deliver the same server response into the same requestActionBatch() provider contract without selecting different App behavior.',
        'A test request without its exact harness-prepared response fails explicitly and never falls back to lazy source loading, phrase selection, or materialization.',
        'An Actor context with no prepared response performs only the bounded empty response inbox lookup during bootstrap.'
      ],
      allowedContributors: [
        'artifact:precanonical-owner-attribution',
        'server-prepared versioned response records',
        'response inbox adapter',
        'required fileId App bootstrap identity',
        'single formal server action-batch provider contract',
        'test or manual harness preparation outside the production bundle'
      ],
      forbiddenContributors: [
        'canonical document persistence provider or document IndexedDB store',
        'product App writes to the response inbox',
        'request-time response inbox access, fixture import, fetch, parse, tokenization, transform, materialization, or deep-freeze',
        'reading or decoding a complete larger response before slicing a smaller response',
        'selecting fixture size from the prompt instead of required fileId',
        'fixture-specific geometry simplification',
        'production paths or APIs named Mock, fake, simulate, or local-compat',
        'artificial provider delay, phrase fixture fallback, or failure simulation',
        'deterministic preparation, seed data, or fixture modules in the production bundle',
        'planId, plan API aliases, or compatibility aliases',
        'front-end item, path, point, style, bounds, role, or model semantic validation',
        'front-end model normalization or drawing-artifact encoding',
        'front-end replacement IDs for server-issued stable descriptor IDs',
        'Runtime, Core, Render, or Collaboration behavior flags'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/package.json',
        'apps/asyra-design/src/index.tsx',
        'apps/asyra-design/src/init/index.ts',
        'apps/asyra-design/src/init/init-app.ts',
        'apps/asyra-design/src/init/__tests__/init-app.test.ts',
        'apps/asyra-design/src/ai/startup.ts',
        'apps/asyra-design/src/ai/server-action-batch-provider.ts',
        'apps/asyra-design/src/ai/server-response-inbox.ts',
        'apps/asyra-design/src/ai/app-prompt.ts',
        'apps/asyra-design/src/ai/context.ts',
        'apps/asyra-design/src/ai/__tests__',
        'apps/asyra-design/src/startup.ts',
        'apps/asyra-design/src/toolbar/index.tsx',
        'apps/asyra-design/src/toolbar/__tests__/ai-control.test.tsx',
        'apps/asyra-design/src/app/ai-conversation-panel.tsx',
        'apps/asyra-design/src/app/__tests__/ai-conversation-panel.test.tsx',
        'apps/asyra-design/test-data/ai-drawing',
        'apps/asyra-design/e2e/prepared-server-response-artifacts.mjs',
        'apps/asyra-design/e2e/prepare-server-response-preview.mjs',
        'apps/asyra-design/e2e/server-response-inbox.ts',
        'apps/asyra-design/__tests__/prepared-server-response-artifacts.test.mjs',
        'apps/asyra-design/e2e/test-utils.ts',
        'apps/asyra-design/e2e/conversational-ai.spec.ts',
        'apps/asyra-design/e2e/ai-drawing-performance.spec.ts',
        'apps/asyra-design/e2e/collaboration.spec.ts',
        'apps/asyra-design/e2e/crdt-endpoint-performance.spec.ts'
      ],
      specRefs: [
        '#pre-canonical-owner-attribution',
        '#file-scoped-server-response-contract',
        '#server-prepared-ai-action-batch-contract',
        '#non-negotiable-equivalence',
        '#step-local-gates'
      ],
      failureOwnerStepId: 'preload-file-scoped-server-response'
    },
    {
      id: 'resolve-server-prepared-action-batch',
      order: 2,
      laneId: 'app-canonical',
      title: 'Resolve one server-prepared AiActionBatch',
      ownerPackage: '@asyra/ai-agent-runtime action resolution',
      purpose:
        'Resolve one server-prepared AiActionBatch through resolveAiActionBatch(), then hand permission one PermissionReadyAiActionBatch, execution the same prepared action argument identities, and confirmation one AiActionBatchPreview without client-side model validation, normalization, cloning, or freezing.',
      inputs: [
        'artifact:precanonical-owner-attribution',
        'artifact:server-prepared-action-batch',
        'server-prepared AiActionBatch',
        'registered action definitions and backend-facing input schemas',
        'runtime redaction policy'
      ],
      outputs: [
        'artifact:resolved-ai-action-batch',
        'artifact:bounded-ai-action-batch-preview',
        'artifact:ai-action-batch-ingestion-timing'
      ],
      conditions: [
        'This step is selected because corrected attribution found front-end action-schema geometry preparation before Group creation, while the product contract now assigns model preparation to the backend.',
        'requestActionBatch() is the only public provider request and resolveAiActionBatch() is the only Runtime resolution entry. There is no public or internal plan API, alias, compatibility wrapper, alternate payload mode, or client preparation mode.',
        'Live server transport and the response inbox adapter hand the same AiActionBatch contract to Runtime; neither source selects another execution or canonical mutation path.',
        'AiActionBatch carries one batchId, explanation, ordered actions, and bounded summaries. Runtime preflights only that small control envelope, including the empty-batch rule, duplicate action ids, and unknown actions; it does not traverse item, path, point, style, bounds, or geometry arguments.',
        'Each action definition exposes one backend-facing inputSchema for server action-batch construction and one executor; it has no client action schema, parse, prepare, validation mode, or payload-size flag.',
        'The server-prepared action arguments are not recursively cloned or frozen by Runtime. Permission and execution receive the exact same arguments identity.',
        'resolveAiActionBatch() returns one ResolvedAiActionBatch. Permission produces one PermissionReadyAiActionBatch, and confirmation and terminal state retain one AiActionBatchPreview; every stage preserves batchId.',
        'Each server-prepared action carries one bounded redaction-ready summary. AiActionBatchPreview retains and redacts only that summary, never complete item, path, point, coordinate, or geometry arguments.',
        'The server validates and normalizes every item, path, point, role, style, bound, stable ID, and relationship and builds one PreparedDrawingArtifact containing one prepared Group descriptor and ordered child descriptor slices with complete source creation data before App readiness; the front end performs none of that model work.',
        'The front-end composition executor shows the server-prepared loading bounds first and submits those descriptor slices through the existing Core.createElementsInParent(...) route without materializing a second point-object or geometry relationship graph.',
        'The production App constructs one required server-backed Agent runtime during startup; that runtime is never nullable or optional after App initialization.',
        'Create-app template output parity is deferred to a separate follow-up and is not an implementation boundary or completion claim of this CRDT closure.',
        'The server issues stable descriptor IDs and relationships, while the ordinary App common API and plural Core route remain the only canonical commit owners; the PreparedDrawingArtifact never writes canonical, shared-data, Render, history, or CRDT state directly.',
        'ResolvedAiActionBatch and PermissionReadyAiActionBatch remain local, noncanonical, and nonshared; shared props, components, elements, Factory evidence, and CRDT data remain in their existing owners.'
      ],
      bypasses: [
        'An invalid control envelope fails before permission, transaction, or executor work.',
        'A no-confirmation permission result still creates only the bounded terminal preview and never a full-argument preview.'
      ],
      allowedContributors: [
        '@asyra/ai-agent-runtime AiActionBatch and action-registry owners',
        'server-prepared action arguments and bounded summaries',
        'registered Asyra Design action definitions and inputSchema descriptions',
        'runtime redaction of bounded summaries',
        'artifact:precanonical-owner-attribution'
      ],
      forbiddenContributors: [
        'Runtime recursive argument cloning or freezing',
        'client-side action schema validation, normalization, parse, or prepare',
        'front-end item, path, point, style, bounds, role, or geometry semantic validation',
        'front-end drawing-artifact encoding',
        'front-end regeneration of stable descriptor IDs or relationships',
        'template full-item compatibility input, itemPointCounts, or per-element mixed-type creation fallback',
        'complete geometry in confirmation or terminal preview',
        'production paths or APIs named Mock, fake, simulate, or local-compat',
        'planId, plan API aliases, compatibility wrappers, or alternate payload modes',
        'runtime or provider activation flags and optional Agent runtime branches',
        'artificial provider delay, phrase fixture fallback, or failure simulation',
        'large-payload, validation, delivery, progressive, loading, or collaboration flags on action definitions',
        'AI-owned shared props, shared components, shared elements, Factory publications, or CRDT state',
        'fixture-specific item, point, payload, or composition ceilings'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/ai-agent-runtime/src',
        'packages/ai-agent-runtime/src/__tests__',
        'apps/asyra-design/package.json',
        'apps/asyra-design/src/index.tsx',
        'apps/asyra-design/src/startup.ts',
        'apps/asyra-design/src/features/ai-agent/index.ts',
        'apps/asyra-design/src/features/ai-agent/__tests__/index.test.ts',
        'apps/asyra-design/src/init/init-app.ts',
        'apps/asyra-design/src/init/__tests__/init-app.test.ts',
        'apps/asyra-design/src/init/foundation/init-features.ts',
        'apps/asyra-design/src/init/foundation/__tests__/init-features.test.ts',
        'apps/asyra-design/src/ai/actions.ts',
        'apps/asyra-design/src/ai/runtime-input.ts',
        'apps/asyra-design/src/ai/startup.ts',
        'apps/asyra-design/src/ai/conversation.ts',
        'apps/asyra-design/src/ai/presentation.ts',
        'apps/asyra-design/src/ai/confirmation.ts',
        'apps/asyra-design/src/ai/__tests__',
        'apps/asyra-design/src/app/index.tsx',
        'apps/asyra-design/src/app/__tests__',
        'apps/asyra-design/src/toolbar/index.tsx',
        'apps/asyra-design/src/toolbar/__tests__/ai-control.test.tsx',
        'apps/asyra-design/src/app/__tests__/ai-conversation-panel.test.tsx',
        'docs/ai/framework/API_SURFACES.md',
        'docs/ai/framework/packages/ai-agent-runtime.md',
        'docs/ai/framework/golden-paths/compose-ai-agent-runtime.md',
        'docs/examples/ai-agent-runtime.mjs',
        'docs/ai/apps/asyra-design/API_SURFACES.md'
      ],
      specRefs: [
        '#pre-canonical-owner-attribution',
        '#server-prepared-ai-action-batch-contract',
        '#bulk-mutation-contract',
        '#non-negotiable-equivalence',
        '#step-local-gates'
      ],
      failureOwnerStepId: 'resolve-server-prepared-action-batch'
    },
    {
      id: 'yield-ai-loading-paint',
      order: 2,
      laneId: 'projection-ui',
      title: 'Yield one bounded AI loading paint',
      ownerPackage: 'Asyra Design AI progress presentation',
      purpose:
        'Show the confirmed drawing bounds and progress state without an unbounded loading animation while keeping pan and zoom responsive before canonical slices begin.',
      inputs: [
        'artifact:precanonical-owner-attribution',
        'artifact:resolved-ai-action-batch',
        'confirmed drawing bounds and item count'
      ],
      outputs: [
        'artifact:visible-loading-boundary',
        'artifact:loading-paint-timing'
      ],
      conditions: [
        'This step is selected only when an equivalent reduced-motion control materially lowers CPU-time attribution at the loading compositor boundary.',
        'One bounded paint makes the confirmed frame or background and progress state visible before canonical mutation begins.',
        'Pan and zoom remain available through the dedicated viewport interaction path while every mutating document action remains locked.',
        'The loading affordance has no permanent animation, ticker, or invalidation loop.'
      ],
      bypasses: [
        'When attribution selects another owner, existing loading behavior receives no production edit.',
        'Failure or cancellation clears progress through the existing transaction and interaction-lock boundary.'
      ],
      allowedContributors: [
        'artifact:precanonical-owner-attribution',
        'artifact:resolved-ai-action-batch',
        'Asyra Design drawing progress state',
        'dedicated pan and zoom interaction bus'
      ],
      forbiddenContributors: [
        'a second document mutation bus',
        'canonical mutation before the loading boundary is visible',
        'unbounded CSS or JavaScript animation work',
        'disabling pan or zoom while waiting',
        'enabling any other document action'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/ai/actions.ts',
        'apps/asyra-design/src/init/ai-drawing-progress.ts',
        'apps/asyra-design/src/render-app',
        'apps/asyra-design/src/ai/__tests__',
        'apps/asyra-design/src/render-app/__tests__'
      ],
      specRefs: [
        '#pre-canonical-owner-attribution',
        '#current-local-interactive-drawing-closure',
        '#step-local-gates'
      ],
      failureOwnerStepId: 'yield-ai-loading-paint'
    },
    {
      id: 'project-scrollable-contents-window',
      order: 3,
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
        'Collapse, expansion, selection, and hierarchy order retain ordinary Contents behavior.',
        'The production App mounts the ordinary Contents projection once in the left sidebar without a performance-profile or URL-selected bypass.'
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
        'apps/asyra-design/src/app/index.tsx',
        'apps/asyra-design/src/app/__tests__/App.test.tsx',
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
      title: 'Reuse action history and deliver one transaction batch',
      ownerPackage: '@asyra/factory',
      purpose:
        'Reuse the existing Factory transaction journal and Undo stack for the complete bulk action, then derive one minimal transport wire artifact without creating a parallel AI/bulk history model.',
      inputs: [
        'ordinary ordered reversible Props and Scene owner change batches recorded through the active Factory transaction',
        'one outer App transaction identity',
        'fixed immediate shared-delivery intent for the composition action'
      ],
      outputs: [
        'artifact:transport-publication-batch',
        'artifact:factory-batch-timing'
      ],
      conditions: [
        'The registered bulk action runs inside the existing App transaction; the Factory journal and Undo stack remain the only local action-history owners.',
        'The Factory transaction owner records ordinary ordered reversible Props and Scene owner changes directly once; Core does not return a delivery or evidence handoff.',
        'Each owner event supplies the before/after or add/remove evidence already required by its ordinary inverter contract, and the outer transaction groups those journal entries into one existing Undo action.',
        'Factory creates no AI/bulk-specific forward/inverse artifact, parallel applied-result mirror, action-completion snapshot, or second history representation.',
        'Render/UI consumes artifact:local-canonical-owner-batch from the canonical owner step and never consumes History or rollback evidence; Collaboration receives only the transport wire artifact.',
        'The shared-data boundary derives one separate SharedPublication exactly once. Its only hierarchy is publicationId, artifactId, transactionId, origin, mode, optional actual compensatesPublicationId, ordered slices, channel batches, and remote-apply deliveries.',
        'SharedPublication artifactId is an opaque transport correlation identity and never references a local History artifact.',
        'Each publication slice contains only sliceId, orderedIds, and ordered batches; each batch contains only batchId, channel, and deliveries; each delivery contains only deliveryId, eventName, orderedIds, payload, and an optional actual compensatesDeliveryId.',
        'SharedPublication contains one remote-apply payload reference per delivery and no inverseEvents, History evidence, rollback evidence, reserved future compensation IDs, top-level delivery aliases, batch records or changes aliases, or nested record wrapper.',
        'The SharedPublication public contract changes atomically across Factory and every direct Collaboration, codec, and remote-apply consumer. Production never contains parallel old and new publication shapes, compatibility conversion, optional legacy aliases, or a decode-time reconstruction of removed fields.',
        'Undo, Redo, and failed-action rollback reuse the existing Factory journal and inverter contracts; there is no bulk-specific compensation record.',
        'Shared-delivery bookkeeping records only the existing journal entry delivery outcome and never mirrors canonical payloads into another applied-result object.',
        'The production fast path performs no post-action save, isEqual, finalize-save, full-document comparison, evidence clone, or recursive immutable-tree scan; required mutation-time detachment is not repeated after owner apply.',
        'The canonical owner issues its newly combined frozen Props-then-Scene outer container through the Reactive Events detached-owner contract: that contract checks only frozen transaction structural roots, records the exact outer identity, and never traverses nested geometry; unissued external shallow-frozen batches remain isolated at the Factory boundary.',
        'Local observers receive one ordinary canonical owner batch, while Collaboration receives only the one transport wire artifact; transport framing does not split local projection into single-entry changes.',
        'A successful mutating turn creates one intended Undo action, and Undo and Redo each restore the complete action.',
        'Existing Undo and Redo journal replay preserves owner event order and returns to the canonical owner; only an actually delivered shared change is eligible for the corresponding replay publication.',
        'Progressive publication boundaries create no new canonical writes and no additional history actions.',
        'Rollback of an already-published immediate slice uses compensation from the inverse already retained by the existing journal.',
        'An observer mutation attempt cannot pollute another consumer or the retained journal entry.',
        'Single-delivery conveniences delegate to batch-of-one rather than a second canonical implementation.'
      ],
      bypasses: [
        'A no-change transaction emits no journal entry, history action, or publication.',
        'A fatal transaction failure emits no committed history action.',
        'A transaction-end atomic publication is unavailable before canonical commit.'
      ],
      allowedContributors: [
        'Factory transaction and journal owners with their ordered canonical evidence',
        'Factory shared-data channel',
        'Reactive Events batch transaction contract that forwards and observes the ordered canonical batch without a scalar owner path',
        'ordinary ordered canonical delivery evidence'
      ],
      forbiddenContributors: [
        'one history action per progressive slice',
        'downstream .save() reconstruction of canonical evidence',
        'post-action isEqual, finalize-save, full-document comparison, or evidence clone',
        'AI/bulk-specific forward/inverse artifact or parallel applied-result mirror',
        'per-observer independent delivery cloning',
        'recursive deep-freeze or immutable-tree scans after the canonical owner handoff',
        'splitting one local canonical batch into one local observer change per element',
        'inverseEvents, History evidence, rollback evidence, or synonymous payload aliases in the transport wire artifact',
        'parallel old and new SharedPublication types, compatibility conversion, or optional legacy aliases',
        'AI-specific history or compensation',
        'dropped or reordered canonical changes'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/factory/src',
        'packages/factory/src/__tests__',
        'packages/factory/src/mutation-batch.ts',
        'packages/factory/src/shared-delivery.ts',
        'packages/factory/src/shared-data-channel.ts',
        'packages/reactive-events/src/app/events.ts',
        'packages/reactive-events/src/app/publish.ts',
        'packages/reactive-events/src/scene-tree/events.ts',
        'packages/reactive-events/src/scene-tree/publish.ts',
        'packages/reactive-events/src/scene-tree/subscribes.ts',
        'packages/reactive-events/src/transaction-owner.ts',
        'packages/reactive-events/src/types.ts',
        'packages/reactive-events/src/__tests__/scene-tree-publish.test.ts',
        'packages/reactive-events/src/__tests__/transaction-batch.test.ts',
        'packages/reactive-events/src/__tests__/transaction-boundary.test.ts',
        'packages/scene-tree/src/sceneTree.ts',
        'packages/scene-tree/src/__tests__/sceneTree.test.ts',
        'packages/collaboration/src/provider.ts',
        'packages/collaboration/src/composition.ts',
        'packages/collaboration/src/process.ts',
        'packages/collaboration/src/cloning.ts',
        'packages/collaboration/src/providers/memory/hub.ts',
        'packages/collaboration/src/providers/memory/provider.ts',
        'packages/collaboration/src/__tests__/shared-publication-fixture.ts',
        'packages/collaboration/src/__tests__',
        'packages/core/src/__tests__/hierarchy-transaction.test.ts',
        'apps/asyra-design/src/collaboration/factory-adapter.ts',
        'apps/asyra-design/src/collaboration/protocol.ts',
        'apps/asyra-design/src/collaboration/operations.ts',
        'apps/asyra-design/src/collaboration/publication-codec-worker.ts',
        'apps/asyra-design/src/collaboration/collaboration-transport-worker.ts',
        'apps/asyra-design/src/collaboration/websocket-provider.ts',
        'apps/asyra-design/src/collaboration/lifecycle.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-factory.test.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-protocol.test.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-operations.test.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-lifecycle.test.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-websocket-provider.test.ts',
        'apps/asyra-design/e2e/collaboration.spec.ts',
        'apps/asyra-design/e2e/collaboration-ai-agent-video.spec.ts',
        'create-app/asyra-design/template/src/collaboration',
        'create-app/asyra-design/template/src/init/__tests__',
        'docs/ai/framework/packages/factory.md',
        'docs/ai/framework/packages/reactive-events.md',
        'docs/ai/framework/packages/collaboration.md',
        'docs/ai/apps/asyra-design/API_SURFACES.md'
      ],
      specRefs: [
        '#factory-existing-history-and-transport-wire-contract',
        '#transaction-boundary',
        '#step-local-gates'
      ],
      failureOwnerStepId: 'record-and-deliver-transaction-batch'
    },
    {
      id: 'apply-canonical-property-scene-batch',
      order: 4,
      laneId: 'app-canonical',
      title: 'Apply one canonical property and Scene Tree batch',
      ownerPackage: '@asyra/core canonical batch facade',
      purpose:
        'Preflight and apply creation, retained removal, and retained restore through one Props, relationship, instance, registration, hierarchy, and evidence boundary with no committed prefix on failure.',
      inputs: [
        'artifact:composition-batch-sequence',
        'ordinary Factory journal replay event when Undo, Redo, or rollback invokes the canonical owner lifecycle'
      ],
      outputs: [
        'ordered canonical element IDs',
        'artifact:local-canonical-owner-batch',
        'artifact:canonical-batch-timing'
      ],
      conditions: [
        'Props Manager performs one whole-batch schema, ID, and relationship preflight before instance materialization, relationship rebind, and registerMany.',
        'Every canonical item retains individually addressable property records, stable IDs, shared props, and shared components; performance work may not flatten, omit, or hide those framework records.',
        'The canonical Props and Scene Tree owners construct each ownerId-to-relations index once before element creation; Core delegates the complete batch without rescanning or reconstructing relation evidence.',
        'Props Manager performs one owner-indexed relationship traversal that establishes child-first order, forward and reverse relation indexes, and owner ranges for the complete batch.',
        'Props batch materialization uses one type-group schema contract and validated action owner data through one direct shallow field handoff, with no geometry-data clone, no per-record structured clone, save, or isEqual reconstruction loop.',
        'The manager-owned relationship index publishes one affected-owner batch and uses no per-edge subscriptions or one closure per child relationship.',
        'Scene Tree local Computed projection consumes the same owner-issued geometry data, does not rebuild complete Render topology from repeated property-instance reads, and is never shared or included in CRDT publications.',
        'A later invalid item leaves no committed prefix in Props, relationships, instance registries, Scene Tree maps, parent children, or Factory evidence.',
        'Scene Tree performs one map registration phase, one parent children replacement, and one ordered batch evidence handoff that preserves every canonical entry.',
        'One local creation request hands its complete ordered Props-then-Scene evidence to Factory through one updateTransactionBatch call; applying the prepared Props and Scene owners through separate Factory handoffs is forbidden.',
        'Required property and element instances remain one per canonical ID, but construction uses fixed batch materializers and creates no per-record API, transaction, relationship-graph, observer-registry, clone, save, or equality boundary.',
        'Core.createElementsInParent returns only ordered canonical element IDs; Factory records canonical owner evidence independently through its active transaction.',
        'The Core workspace id query is a constant-time identity read and never calls save, serializes the complete Scene Tree, or reconstructs document state.',
        'Single-item APIs are exactly equivalent batch-of-one conveniences.',
        'One origin-neutral canonical lifecycle selects prepared evidence by data lifecycle: ordinary descriptors provide source creation data, detached canonical data provides exact identity and relations, and retained property evidence keeps its separate Props cleanup or restore batch.',
        'Scene Tree always produces one PreparedElementMutation for the selected lifecycle; Core coordinates any separate Props cleanup or restore evidence without introducing caller-origin policy.',
        'Ordinary creation and removal own their complete Scene and Props lifecycle, while detached canonical data and retained property evidence preserve exact IDs, ordering, relations, and source evidence without applying either owner twice.',
        'A complete retained container hierarchy is prepared and applied once through the same plural Scene mutation owner while its separate retained Props evidence remains active.',
        'Every single-item convenience delegates to the same batch-of-one prepared mutation.',
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
        '@asyra/factory active transaction boundary'
      ],
      forbiddenContributors: [
        'App access to package-private stores',
        'prefix commit after later-item rejection',
        'skipped instance, relationship, registration, or observable evidence',
        'fixture-specific canonical handling',
        'treating a semantic no-op as an applied replay result',
        'reordering retained Scene and Props evidence',
        'post-hoc full-composition geometry repair',
        'per-edge relationship subscriptions or closure fan-out',
        'shared UPDATE_COMPUTED_DATA publications for locally derived Render projection',
        'UsingActiveProperties API families or local/remote mutation modes'
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
      order: 3,
      laneId: 'app-canonical',
      title: 'Stage one local interactive composition',
      ownerPackage: 'Asyra Design AI composition interaction',
      purpose:
        'Commit one server-prepared PreparedDrawingArtifact containing one Group descriptor and ordered child descriptor slices through an exact-bounds runtime loading state and one ordered Group-plus-children composition batch sequence whose bounded work units return control to the browser without changing accepted geometry data, stable descriptor IDs, transaction intent, or failure semantics.',
      inputs: [
        'artifact:resolved-ai-action-batch',
        'server-prepared Group descriptor and ordered child descriptor slices in one PreparedDrawingArtifact',
        'artifact:bounded-ai-action-batch-preview',
        'artifact:visible-loading-boundary',
        'single production Conversational AI runtime with fixed cooperative progressive delivery',
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
        'The production Asyra Design entry always exposes one formal server-backed Conversational AI provider without an ai or delivery query; ordinary startup and measurement use the same cooperative progressive route.',
        'Contents is fixed as mounted in the production App; an opt-in detached performance profile may observe evidence but never configures the App, provider, Runtime, composition route, or Contents projection.',
        'Server-prepared Group and child descriptors provide exact bounds, stable IDs, relationships, complete source creation data, geometry data, point counts, roles, and slice boundaries; the App builds no intermediate point-object graph and performs no repeated vector validation, bounds, or normalization.',
        'After those prepared descriptors provide exact bounds, the App publishes a runtime-only loading state, commits a connected App DOM overlay, and crosses a browser paint opportunity before the first canonical mutation.',
        'The App acquires one runtime-only document interaction lock before opening the outer App transaction; the lock allows ordinary viewport pan and zoom to repaint the live loading frame and Vector output while it blocks every other document interaction, document mutation, and canonical mutation.',
        'Viewport navigation while locked continues through ordinary Feature execution and may cross its existing transaction wrapper, but produces no canonical mutation or history and does not alter the AI action transaction evidence or accepted composition bounds; AI cancellation remains available.',
        'The single composition route uses the existing Core.createElementsInParent(...) plural route to create one Group, crosses one browser paint opportunity after that Group and before the first child batch, and only then submits multiple deterministic progressive plural Core child batches through the same route.',
        'Progressive batch boundaries use one fixed 2,048-point budget and an element-count budget capped at 32 elements per work unit; one indivisible element may exceed only the point budget.',
        'Every successful canonical slice completes its ordinary Factory, Preset, Render, and UI projection, commits actual element progress, awaits one browser paint opportunity, and then continues through the single serialized action loop with a fixed point budget of 2,048 and at most 32 elements after rechecking the Feature-owned AbortSignal.',
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
        'App-owned serialized cooperative main-thread scheduling policy'
      ],
      forbiddenContributors: [
        '7,000 single-item Core calls',
        'front-end replacement of server-issued stable descriptor IDs',
        'front-end point-object or geometry-data rematerialization',
        'front-end vector validation, bounds calculation, or normalization',
        'reduced VTracer detail or bitmap replacement',
        'one App transaction per slice',
        'AI-only renderer or canonical loading placeholder',
        'Canvas or Render-owned loading overlay',
        'fabricated time-based or estimated element progress',
        'loading, progress, or slice-policy parameters in Core, Props Manager, or Scene Tree',
        'JavaScript per-frame loading animation',
        'a second reactive-events bus used as a scheduling or document-admission lock',
        'product delivery-mode switches or delivery URL parameters',
        'performanceContentsMode or another profile-selected product projection',
        'microtask-only progressive yield',
        'one timeout scheduled independently for every prepared range'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/package.json',
        'apps/asyra-design/src/index.tsx',
        'apps/asyra-design/e2e/conversational-ai.spec.ts',
        'apps/asyra-design/src/ai',
        'apps/asyra-design/src/ai/__tests__',
        'apps/asyra-design/src/common-apis/system-context.ts',
        'apps/asyra-design/src/constants',
        'apps/asyra-design/src/app/index.tsx',
        'apps/asyra-design/src/app/__tests__',
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
        'Schedule rendering only from explicit framework invalidation, prevent the concrete Pixi runtime from bypassing the dirty gate, and consume ordinary local and remote canonical owner batches through the Vector route without History evidence.',
      inputs: [
        'artifact:local-canonical-owner-batch',
        'artifact:remote-factory-mutation-batch'
      ],
      outputs: [
        'artifact:visible-canonical-slices',
        'artifact:ui-context-batch-projection',
        'artifact:render-ui-timing'
      ],
      conditions: [
        'Core preserves each injected Factory batch through one batch observer callback so Preset consumes the exact boundary without importing the default Factory instance.',
        'Preset and UI consume one local canonical batch directly; transport may expose ordered record ranges, but Factory does not split local projection into single-entry changes.',
        'Each formal local or remote canonical batch performs one batch projection and at most one visible flush.',
        'The fixed progressive composition route performs one projection for each formal slice and never collapses to a final-only peer frame.',
        'One invalidation and one frame flush occur at most once per slice.',
        'The ordinary Vector strategy preserves all 7,076 editable elements, complete Render topology, transforms, hierarchy, fills, strokes, and visibility.',
        'UI context updates affected entries and hierarchy order without rebuilding the complete map for every ADD_ELEMENT.',
        'With every Group expanded, Contents virtualizes the canonical id order before deriving row metadata, so only mounted rows resolve their bounded ancestor path; an explicit collapsed Group uses the complete visibility projection.',
        'The Pixi Application ticker must not render outside the framework dirty gate; one scheduled frame performs at most one explicit engine flush.',
        'A settled zero-element App has no scheduled frame, no engine flush, and no unbounded performance evidence.',
        'Pan, zoom, canonical change, computed change, and render-affecting system property change each schedule at most one Canvas frame; a nonvisual system property such as AI progress or interaction-lock state causes no Canvas invalidation.',
        'Performance instrumentation records bounded evidence only for demanded frame work and cannot create a second per-frame workload.',
        'No Render-engine bulk command is added; batch composition remains above the existing strategy surface.'
      ],
      bypasses: [
        'A canonical no-change produces no projection or UI update.',
        'Invisible and removed elements follow ordinary Vector strategy behavior.',
        'Detached timing and evidence never enter visible rendering.'
      ],
      allowedContributors: [
        'artifact:local-canonical-owner-batch',
        'artifact:remote-factory-mutation-batch',
        '@asyra/core injected-instance batch observer facade',
        '@asyra/preset ordinary Vector strategy',
        '@asyra/render scene scheduling',
        '@asyra/render-engine-pixi owned frame scheduler and explicit flush',
        'Asyra Design UI context and Contents/Layers hierarchy projection'
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
        'apps/asyra-design/src/contents/layer-hierarchy.ts',
        'apps/asyra-design/src/contents/__tests__/layer-hierarchy.test.ts',
        'apps/asyra-design/src/contents/contents-panel.tsx',
        'apps/asyra-design/src/contents/__tests__/contents-panel.test.tsx',
        'create-app/asyra-design/template/src/contents/layer-hierarchy.ts',
        'create-app/asyra-design/template/src/contents/__tests__/layer-hierarchy.test.ts',
        'create-app/asyra-design/template/src/contents/contents-panel.tsx',
        'create-app/asyra-design/template/src/contents/__tests__/contents-panel.test.tsx',
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
        '#visible-progressive-projection',
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
        'artifact:transport-publication-batch',
        'artifact:relayed-publication-frames'
      ],
      outputs: [
        'artifact:encoded-publication-frames',
        'artifact:decoded-publication-candidates',
        'artifact:codec-timing'
      ],
      conditions: [
        'The outbound input is exactly one transport wire artifact containing one remote-apply payload, ordered IDs, and publication metadata; it contains no inverseEvents, History evidence, rollback evidence, or synonymous payload aliases.',
        'Hello, ack, failure, awareness, and credit control frames remain JSON.',
        'All shared publication data uses a versioned binary frame and is not pre-serialized as JSON.',
        'The existing codec runs in the Dedicated Worker without a new package.',
        'Outbound encoding performs one object-to-worker structured clone; the Worker encodes the publication and writes each frame directly to the Worker-owned WebSocket.',
        'Prepared compact-binary metadata and delivery segments write directly into each final frame allocation without an intermediate full-publication payload copy.',
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
        'artifact:transport-publication-batch',
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
        'After worker header, order, duplicate, and capacity validation, frame-consumed credit is emitted only when that publication leaves the retained byte window for the one App handoff, independently of whether later App policy or canonical apply succeeds.',
        'The worker-to-main structured clone is the only inbound object isolation boundary; validated publication evidence enters a single-consumer ownership contract without a Provider clone or recursive main-thread freeze.',
        'The receiver retains bounded decoded candidates while exposing exactly one read-only publication to exactly one required async Collaboration consumer until its Promise settlement.',
        'Receiver-handoff timing starts only after one decoded candidate is ready and closes after the sole main-bound publication-delivery post returns; it excludes codec decode and retained-queue time so owner phases do not overlap.',
        'The Dedicated Worker keeps one outbound publication frame in flight and sends the next frame directly on its WebSocket only after exact source-frame-admitted credit.',
        'Successful remote publication settlement releases the next decoded publication; terminal apply failure clears active and pending publications and releases no fabricated progress.',
        'Slow App apply may fill but cannot overrun the exact retained byte window; queued publications return no fabricated wire credit, and each ordered handoff releases its exact frame credits before that App apply begins.',
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
      order: 4,
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
        'The App organizes source slices, batches, delivery order, and batch-to-slice membership in one linear pass per accepted publication; later classification consumes that organization without rescanning slices or merging publications.',
        'Props, relationships, instances, Scene Tree, and Factory evidence apply through one batch boundary.',
        'The remote Factory transaction exposes a batch-capable owner so the same atomic Factory evidence handoff remains available without Undo, echo publication, or persistence.',
        'Reactive publication takes one observer-registry snapshot and invokes the batch observer once while preserving event order.',
        'Actor B produces no Undo, no echo publication, no persistence capture, no provider save, and no document IndexedDB write.',
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
        'Require fileId to select the App-owned demo document session, load its canonical empty document, always start Collaboration after that load, and omit a client persistence provider so local actions and remote apply perform no persistence capture, provider save, document IndexedDB read, or document IndexedDB write.',
      inputs: ['required fileId URL', 'Asyra Design RenderApp startup policy'],
      outputs: ['artifact:empty-memory-demo-document'],
      conditions: [
        'A missing or empty fileId does not open a document session.',
        'After Core starts, RenderApp loads exactly one canonical empty document selected by fileId through the ordinary Core load API before Collaboration connects.',
        'The required fileId URL supplies the document session identity and always starts Collaboration after load; fileId selects which document opens and is never a Collaboration toggle.',
        'Root dev:all starts only workspace package watchers and the App dev server. The explicit collaboration:server command or collaboration Playwright startup separately owns the reference WebSocket server and makes it ready before the App document connection begins.',
        'With one connected Actor the session is classified as single-Actor; when a second Actor joins the same document session it is classified as two-Actor CRDT processing.',
        'Every demo document session starts without creating, initializing, loading, or injecting a client persistence provider.',
        'The same fileId may independently select a pre-ready server response through the response inbox adapter, but that response never enters Core.load and creates no canonical prefix.',
        'Local actions, Undo, and Redo perform zero client persistence capture, provider save, document IndexedDB read, and document IndexedDB write.',
        'Actor B remote apply performs zero client persistence capture, provider save, document IndexedDB read, and document IndexedDB write.',
        'resetData loads one fresh App-owned empty document through Core.load and performs zero IndexedDB, localStorage, URL parsing, or reload work.',
        'RenderApp startup and resetData obtain independent fresh values from the same zero-argument App-owned empty-document factory; no shared mutable empty-document singleton exists.',
        'Core.load is the sole FILE_LOAD_COMPLETE publisher for startup and reset. DataContexts observes that completed load for zoom-fit and never synthesizes file readiness from Render readiness.',
        'Reset Data is a local demo-document reset. It creates no Factory action or collaboration publication and makes no claim that another Actor is cleared.',
        'Single-Actor and two-Actor sessions still preserve one outer action transaction, exact Undo and Redo, canonical IDs, complete detail, and ordered canonical publication.'
      ],
      bypasses: [
        'Formal server checkpoint policy and backend database durability remain outside this plan.',
        'Demo reload durability is not a correctness or performance gate while client persistence is disabled.'
      ],
      allowedContributors: [
        'required fileId App startup',
        'fileId-selected App document session identity',
        'Asyra Design RenderApp startup',
        'Core startup without a persistence provider',
        'App-owned fresh empty-document factory',
        'local reset through the ordinary Core load API',
        'cheap zero-side-effect runtime counters'
      ],
      forbiddenContributors: [
        'demo client persistence provider',
        'demo IndexedDB migration or persisted-document load',
        'demo persistence capture or save',
        'client document-persistence module or compatibility facade',
        'commented legacy client-persistence or browser-storage example path',
        'synthetic FILE_LOAD_COMPLETE publication from Render readiness',
        'reset-time IndexedDB, localStorage, URL parsing, or page reload',
        'treating local Reset Data as a CRDT clear action',
        'a URL route that opens a document without fileId',
        'treating fileId as a Collaboration activation or deactivation toggle',
        'a separate non-Collaboration document startup path',
        'reload durability assertions',
        'changes to Factory history or transaction semantics'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/package.json',
        'apps/asyra-design/src/config/empty-document.ts',
        'apps/asyra-design/src/controllers/app.ts',
        'apps/asyra-design/src/controllers/__tests__/app.test.ts',
        'apps/asyra-design/src/contexts/data-change.tsx',
        'apps/asyra-design/src/contexts/__tests__/data-change.test.tsx',
        'apps/asyra-design/src/document-persistence.ts',
        'apps/asyra-design/src/render-app/index.tsx',
        'apps/asyra-design/src/render-app/collaboration-mode.ts',
        'apps/asyra-design/src/collaboration/lifecycle.ts',
        'apps/asyra-design/src/render-app/__tests__',
        'apps/asyra-design/src/render-app/__tests__/collaboration-mode.test.ts',
        'apps/asyra-design/src/render-app/__tests__/document-persistence.test.ts',
        'apps/asyra-design/src/render-app/__tests__/render-app-strict-mode.test.tsx',
        'apps/asyra-design/playwright.config.ts',
        'apps/asyra-design/__tests__/playwright-config.test.mjs',
        'apps/asyra-design/e2e',
        'create-app/asyra-design/template/package.json',
        'create-app/asyra-design/template/src/config/empty-document.ts',
        'create-app/asyra-design/template/src/controllers/app.ts',
        'create-app/asyra-design/template/src/controllers/__tests__/app.test.ts',
        'create-app/asyra-design/template/src/contexts/data-change.tsx',
        'create-app/asyra-design/template/src/contexts/__tests__/data-change.test.tsx',
        'create-app/asyra-design/template/src/document-persistence.ts',
        'create-app/asyra-design/template/src/render-app/index.tsx',
        'create-app/asyra-design/template/src/render-app/__tests__/document-persistence.test.ts',
        'create-app/asyra-design/template/src/render-app/__tests__/render-app-strict-mode.test.tsx',
        'scripts/dev-all-plan.js',
        'scripts/dev-all.js',
        'scripts/__tests__/workspace-automation.test.mjs',
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
      id: 'evaluate-endpoint-performance',
      order: 2,
      laneId: 'persistence-proof',
      title: 'Evaluate one refactored endpoint safely',
      ownerPackage: 'Asyra Design guarded endpoint performance E2E',
      purpose:
        'Run one guarded 16-item safety proof after each completed endpoint refactor, permit exactly one production two-Actor 7,076-element creation proof only at the named local-source, relay, and final checkpoints, compare only owned evidence with the preceding accepted baseline, and stop all owned work before raw system CPU overload can continue.',
      inputs: [
        'artifact:response-inbox-bootstrap-timing',
        'artifact:provider-response-handoff-timing',
        'artifact:ai-action-batch-ingestion-timing',
        'artifact:loading-paint-timing',
        'artifact:local-drawing-progress-state',
        'artifact:local-document-interaction-lock-state',
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
        'artifact:local-interactive-drawing-proof',
        'artifact:precanonical-owner-attribution',
        'artifact:resource-guard-stop-proof'
      ],
      conditions: [
        'The current exact 16-item source contains 12,919 vector points in eight prepared slices. Runtime pre-execute resolution is less than 1 millisecond, so Runtime control-envelope work is non-material and cannot own the current renderer CPU spike.',
        'After an owner refactor, its guarded 16-item case must pass with both independently launched Actor browser process groups at or below the 250-percent raw same-snapshot per-Actor frontend limit and the 400-percent raw same-snapshot aggregate frontend/backend/harness safety limit with exact canonical, Render, transaction, and history evidence before any named guarded 7,076-element checkpoint is permitted.',
        'The complete local source pipeline—PreparedDrawingArtifact submission, Core indexing, Props and Scene batch application, Factory artifact delivery, and local projection—receives one guarded 7,076-element proof after all of those internal owners are complete, not after each internal owner.',
        'The exact guarded 7,076-element creation-only endpoint is a high-performance test with a 500-percent raw same-snapshot limit for each independently launched complete Actor browser process group and a 500-percent raw same-snapshot aggregate frontend, backend, and harness limit; guarded 16-item and 1,280-item safety or attribution cases retain the 250-percent per-Actor frontend limit and the 400-percent aggregate limit.',
        'One collaboration endpoint proof uses exactly one production two-Actor 7,076-element progressive creation with no follow-up mutation, Undo or Redo execution, persistence, media, trace, CPU profile, warm-up, or repeat.',
        'At each explicitly approved local-source, relay, or final checkpoint, that guarded two-Actor creation is the only high-detail invocation for the checkpoint: Actor A proves connected exact-bounds loading, ordinary Vector milestones, responsive viewport pan and zoom during a cooperative yield, blocked document mutation and history while locked, terminal lock release, one intended Undo action, and one terminal exact canonical summary; no warm-up, repeat, or additional single-Actor 7,000-plus run is started.',
        'The performance profile emits detached evidence with no configuration payload; the sole aiPerformance=profile diagnostic opt-in never selects or changes a product route.',
        'Progress uses O(1) canonical, Render, publication, and history counters. Actor A and Actor B each produce one exact canonical summary only after completion; no Undo or Redo execution polls the full graph.',
        'When bounded retained counter evidence crosses its retained counter ring rollover, exact loading-frame correctness reads the exact accumulated loading-frame total instead of requiring the earliest sample to remain in the ring.',
        'The exact canonical work-unit phase count comes from the performance profile O(1) phase-count query and equals the exact Actor A local-sent publication count; bounded retained phase and counter sample lengths remain timing and milestone evidence, never exact totals or equality operands.',
        'Required provider, Runtime, execution, Group, and plural-batch phase presence comes from the same O(1) per-name phase-count query so it remains exact after retained phase-ring rollover; the bounded phase timeline remains timing evidence and can never serve as permanent occurrence evidence.',
        'The report names Actor A connected loading, first compositor paint opportunity, first ordinary Vector, real visible-element milestones, longest canonical work unit, cooperative yield count, settled time, Actor B first visible and complete, convergence, Render, UI, harness, Actor A frontend CPU peak, Actor B frontend CPU peak, aggregate CPU peak, and separately attributed WebSocket-server CPU.',
        'The guard authenticates one ready heartbeat and confirms process ownership and CPU sampling before the 7,076-element request may start.',
        'Actor A and Actor B use independently launched Chromium process groups. Actor A creates its context, completes navigation and Collaboration readiness, and reaches two fresh raw samples below the ordinary idle baseline before Actor B is launched; Actor B then creates its context, completes navigation and Collaboration readiness, and both Actors reach two fresh settled samples before the guard-ready heartbeat. Every staged harness bootstrap phase stays outside product timing.',
        'Bootstrap settled status is a read-only authenticated guard view of the latest raw operating-system sample. It requires every requested Actor browser role, a sample no older than the observation-gap ceiling, each Actor frontend at or below the ordinary 80-percent idle baseline, and the real overall value at or below that same baseline; it never excludes startup CPU from the safety limits or substitutes a fixed sleep.',
        'Production build commands are a separate setup outside the runtime guard and product timing; artifact attestation must succeed before Playwright starts, runtime safety begins with the production App processes, and operation timing begins only at Actor A request submission.',
        'Production artifact attestation is separate from response overlay attestation and both complete before Playwright starts; the guard rejects either stale or mismatched artifact.',
        'The preview overlay copies the attested production dist and adds only generated compressed server response artifacts and their manifest; canonical production dist contains no server response and the preview overlay can never be used for production deployment.',
        'A fixed two-Actor tracked process registry contains only test-harness, client-a-browser, client-b-browser, app-server, and websocket-server; single-Actor attribution omits only client-b-browser; exactly one production preview and one WebSocket server are test-owned, HMR is absent, and no pre-existing listener participates.',
        'One bounded operating-system ps snapshot supplies exact tracked PID, PPID, PGID, cumulative CPU-time, and command identity without supplying formal CPU percentages. Darwin top filters on those exact PIDs plus one long-lived unreported guard-process anchor and produces two bounded pid,cpu tables; the initialization table is ignored, the second current percent-CPU table is intersected with the exact still-live test-owned identities, and the anchor plus untracked system PIDs are ignored. Polling nominally every 1,000 milliseconds only requests another current raw value; cadence is not a measurement window and never participates in a CPU-percentage formula.',
        'Periodic and phase-boundary sampling share one serialized OS sample and state-consumption queue, so no overlapping ps/top command or out-of-order state update can combine current CPU values from different top tables.',
        'A fixed 7,000-millisecond gap between successfully completed raw observations permits two adjacent serialized requests to consume their existing 3,000-millisecond command deadlines plus bounded scheduling and HTTP handoff; anything larger fails closed because the guard may have missed a raw current system peak, and the gap never constructs a longer interval average or changes a raw percent-CPU value.',
        'The proof-class raw same-snapshot limit for each complete Actor browser process group—500 percent for the exact 7,076-element endpoint and 250 percent for 16-item or 1,280-item safety or attribution—plus the proof-class aggregate limit—500 percent for the exact 7,076-element endpoint and 400 percent for 16-item or 1,280-item safety or attribution—applies before and after guard readiness; Actor A and Actor B are never added for the per-Actor frontend decision, while bootstrap overload is reported as bootstrap rather than attributed to a product request.',
        'Each Actor browser role reports its root-browser, GPU, utility, other browser subprocesses, and each renderer PID separately while retaining every raw same-snapshot system percent in that Actor frontend total and the aggregate safety total. Actor A and Actor B retain separate highest complete raw frontend snapshots; backend and harness CPU enter neither Actor peak, although both Actor browser values plus backend and harness remain inside aggregate stop evaluation and the proof-class violation report. Page-target CDP reports TaskDuration, ScriptDuration, LayoutDuration, and RecalcStyleDuration, CDP-visible worker targets are listed as visible worker target evidence, and any renderer CPU not explained by those signals remains explicitly residual renderer evidence rather than being guessed as page or worker ownership.',
        'A single-Actor attribution invocation starts a fresh client-a-browser process group and App preview, navigates one required fileId URL, establishes its Collaboration session through the required WebSocket server, creates no Actor B or client-b-browser process group, and requires the fixed test-harness, client-a-browser, app-server, and websocket-server roles.',
        'Each single-Actor invocation measures exactly one 16-item, reduced-motion 16-item, or 1,280-item case so a preceding Chrome startup or navigation decay cannot contaminate a later case.',
        'Each attribution invocation may retain request-wide cumulative OS process CPU-time milliseconds as non-percentage diagnostic evidence; it never converts those deltas into CPU percent. Ordered browser-monotonic Runtime, provider, App, and loading spans provide inner owner attribution, while raw system percent-CPU snapshots never become nested phase timers.',
        'Every phase-boundary sample passes through the same active proof-class raw same-snapshot frontend evaluation—500 percent for the exact 7,076-element endpoint or 250 percent for 16-item and 1,280-item safety or attribution—and the proof-class aggregate safety evaluation—500 percent for the exact 7,076-element endpoint or 400 percent for 16-item and 1,280-item safety or attribution—as the periodic sampler and requires exact PID set equality; any observed process identity change before an accepted terminal heartbeat makes attribution invalid, and raw OS CPU can never be the sole owner-attribution signal.',
        'After one valid terminal complete heartbeat is accepted, the product proof window is closed: later Chrome teardown process-identity changes cannot create a resource stop or invalidate the accepted proof, while exact tracked process-group termination must still be confirmed.',
        'Response inbox seed, read, structured clone, and handoff are external backend and transport-adapter timing: they are recorded separately but excluded from frontend product execution, Runtime, Render, and CRDT effectiveness. Bootstrap before ready remains safety-only and legal pre-ready process registration or identity churn resets the candidate baseline without attribution.',
        'After the response inbox, App, Collaboration, and Agent readiness settle, the harness resolves the prompt field and submit control, performs prompt fill, locator resolution, and actionability outside the product boundary, then establishes one complete raw system snapshot for the process identity. App-owned request acceptance or dispatch starts local-request and retains the maximum raw frontend system value observed during the product window; no Playwright locator, visibility, count, text, or attribute polling may execute in that window. One App-owned O(1) scalar completion signal ends product timing, and UI correctness assertions run only after that boundary.',
        'In-page interaction evidence uses event-driven observation plus a fixed bounded frame handoff for each requested assertion; it never runs a recursive requestAnimationFrame polling loop or creates a second per-frame workload during the product window.',
        'Playwright progress observation performs at most one O(1) scalar sample in each Actor every five seconds during the product window; the independent 1,000-millisecond current raw operating-system sampler, ten-second heartbeat deadline, and twenty-second progress deadline remain unchanged.',
        'One pre-stall owner snapshot runs only after Actor A is complete and two consecutive five-second samples show no Actor B canonical, Render, or applied-publication progress; it retains bounded scalars and the top 24 phase totals in the guard emergency report before termination, never repeats during the run, and does not change the progress-stale limit.',
        'After the accepted request-ready heartbeat, one zero-state creation-start heartbeat marks the active creation phase with no dual-page sample before dispatch; the first dual-Actor scalar sample is the ordinary five-second heartbeat after product work has started.',
        'The initial history baseline is captured before request-ready. After loading at zero is proven, an event-first observer waits for the first visible canonical element and one bounded frame handoff before the real pan and zoom plus blocked input sequence; loading remains connected and the turn remains active throughout that interaction evidence.',
        'Independent loading-time interaction proofs are distributed through the same active turn: pan after first visible, zoom after 25-percent canonical progress, rectangle shortcut and button lock after 50 percent, and Delete plus Undo lock after 75 percent; each progress wait is mutation-driven with one bounded frame confirmation and no fixed delay.',
        'A bounded heartbeat reports the latest completed phase, any currently active started phase, its capture time, Actor A and Actor B canonical element counts, publication progress, and latest completed owner timing without walking the full canonical graph; the guard records a separate safety-signal sample time and heartbeat age rather than presenting the values as co-temporal.',
        'The production performance profile provides O(1) canonical, Render projection, Factory publication, and history scalar queries; Render projection counts remain uncapped so over-projection is reported as a correctness failure.',
        'The ordinary Playwright suite always excludes the guarded endpoint spec even if guard environment variables leak into that process.',
        'The 1,000-millisecond polling cadence is armed before the first current raw system snapshot; each bounded ps identity snapshot has a 200-millisecond hard timeout and each two-table Darwin top request has a 3,000-millisecond hard timeout. Guard SIGINT, SIGTERM, SIGHUP, exceptional exit, sampling failure, or benchmark failure terminates only the fixed registered process groups.',
        'Only the authenticated phase-boundary HTTP handoff has a 7,000-millisecond client deadline so it can wait behind one serialized 3,000-millisecond current-CPU sample and complete its own 3,000-millisecond sample; ordinary heartbeat and resource-status requests retain 3,000 milliseconds, and the boundary deadline never extends product execution or the 300-second CRDT flow.',
        'An endpoint complete heartbeat is accepted only when both Actors remain exactly complete with canonical and uncapped Render projection element counts equal to total and one bounded endpoint report is valid; a local-attribution complete heartbeat validates Actor A only, carries no Actor B report, and never invents a completed peer; a collaboration-attribution complete heartbeat validates both small-case Actors but never creates an accepted endpoint baseline.',
        'The pipeline fixes one required proof kind for the entire guarded invocation; no later heartbeat can switch among endpoint, local-attribution, or collaboration-attribution.',
        'A single raw operating-system snapshot whose complete Actor A or complete Actor B browser sum is above the active per-Actor proof-class limit—500 percent for the exact 7,076-element endpoint or 250 percent for 16-item and 1,280-item safety or attribution—or whose aggregate both-Actor frontend/backend/harness sum is above the active aggregate proof-class limit—500 percent for the exact 7,076-element endpoint or 400 percent for 16-item and 1,280-item safety or attribution—stops the benchmark immediately and marks the active architecture attempt invalid; configuration cannot relax either proof-class limit.',
        'CPU above the fixed limit, a stale heartbeat above the ordinary 80 percent baseline, or stalled Actor A and Actor B progress above that baseline fails the active endpoint immediately.',
        'On resource failure the guard terminates tracked Playwright, headless browser, App server, and collaboration server processes before returning the last completed phase, Actor A and Actor B element counts, CPU samples, publication progress, and owner timing.',
        'A valid raw-system resource stop whose last captured heartbeat precedes the first completed canonical Group pauses the 7,076-element proof but does not claim which owner was active; bounded browser-monotonic evidence permits one guarded single-Actor 16-item cat-prefix attribution case.',
        'Relay profiling emits one bounded diagnostic record once per eight same-type records; each record carries sampleCount so the guard preserves exact counts and maxima without changing raw CPU safety.',
        'The 16-item cat-prefix contains 12,919 vector points, so its Group plus four early high-detail children are material canonical and Render work rather than a negligible placeholder.',
        'One two-Actor 16-item operation-versus-idle diagnostic excludes production build commands and all pre-ready App, Collaboration, and Agent bootstrap, measures operation from Actor A request submission until Actor B canonical and Render are complete, then performs no product action during an exact 10-second idle window. It uses the collaboration-attribution proof kind, never creates an accepted endpoint baseline, and keeps the 250-percent frontend and 400-percent aggregate guards active throughout runtime.',
        'Each Actor page-target CDP Performance domain uses threadTicks and cumulative TaskDuration, ScriptDuration, LayoutDuration, and RecalcStyleDuration deltas to report main-thread task occupancy for operation and idle separately; this is not complete Actor CPU because worker, GPU, network, server, and harness work remain only in the separate OS guard evidence.',
        'If the corrected 16-item raw complete Actor A or Actor B browser snapshot crosses the 250-percent per-Actor limit or the raw same-snapshot aggregate both-Actor frontend/backend/harness CPU crosses 400 percent, the guard stops first; only the resulting bounded replan may authorize exactly one equivalent reduced-motion 16-item control to separate loading-compositor work from other browser work.',
        'If the 16-item attribution case remains at or below the 250-percent frontend and 400-percent aggregate limits, one guarded single-Actor 1,280-item cat-prefix case separates the resident provider delay and handoff, Runtime control-envelope resolution, bounded preview, loading paint, Group, and first plural children-batch timing.',
        'A two-Actor 1,280-item attribution case is allowed only when the fresh single-Actor result cannot separate Actor A and client-to-server work from peer relay or Actor B remote apply.',
        'If that two-Actor 1,280-item attribution ends in a resource stop before it can produce a complete Actor A and Actor B page-target operation window, one two-Actor 320-item fallback may run under the same 250-percent frontend and 400-percent aggregate guards. It reuses the exact collaboration-attribution flow, publication and Undo evidence, per-Actor page-target operation window, and ten-second idle control; it cannot create an accepted endpoint baseline or replace a 7,076-element proof.',
        'The completed attribution artifact selects exactly one next owner route: response inbox or provider request-boundary contamination, Runtime action-batch resolution, App loading paint, local canonical composition, or receiver frame admission.',
        'Attribution cases retain the fixed 250-percent frontend and 400-percent aggregate guards and exact process termination, but never create an accepted endpoint baseline, never count as a 7,076 architecture attempt, and cannot establish product equivalence.',
        'The maximum-detail 27,471-element 295,794-point gate allows at most 300 seconds from accepted turn to Actor A settled while retaining the ordinary 250-percent single-Actor frontend and 400-percent aggregate current-CPU limits.',
        'The hard CRDT product-flow deadline from Actor A request submission through Actor B convergence is 300 seconds; the guarded Playwright ceiling is 360 seconds so bounded bootstrap, final assertions, and teardown cannot preempt that product deadline.',
        'Crossing either raw CPU limit, the 300-second product-flow deadline, or the 360-second guarded Playwright ceiling terminates the current benchmark action and its exact tracked processes but never terminates the implementation task. The same owner immediately captures the first blocker, performs bounded root-cause analysis, re-reads this Inspector contract, revises only its owner plan and formal oracle, and executes the resulting new iteration before any downstream owner may advance.',
        'A failed or timed-out endpoint captures the existing bounded final diagnostics for Actor A and Actor B, retains only their top 24 phases and bounded scalar evidence in the guard failure report, and uses that direct browser-monotonic evidence to select the next owner without creating an accepted endpoint baseline.',
        'The 2026-07-31 7,076-element attempt terminated by converted 397.203-percent frontend and 401.175-percent aggregate CPU-time interval values is invalid evidence: its raw same-snapshot frontend and aggregate values were 199.4 and 209.2 percent, it crossed neither user-defined limit, it creates no accepted baseline or architecture-attempt count, and it cannot select a CRDT owner.',
        'After the raw CPU contract and guard implementation pass focused formal tests and bounded review, one corrected guarded 16-item proof must pass; any replacement 7,076-element invocation requires explicit product-owner approval because the invalid attempt already consumed the available high-detail test budget.',
        'If process ownership or heartbeat evidence cannot be established, the 7,000-plus benchmark refuses to start unguarded.',
        'Success preserves exact canonical IDs, order, geometry data, complete Render topology, hierarchy, styles, one Actor A Undo action, zero Actor B Undo, zero echo, and zero client persistence work.',
        'Effectiveness requires the owned failing budget to become green or the owned structural, span, or queue metric to improve by at least 15 percent without an adjacent critical owner regressing more than 15 percent.',
        'The raw 251.7-percent frontend and 259.0-percent aggregate local-source observation was below both limits then active for that checkpoint, so it is not an accepted stop or endpoint proof; after focused threshold gates, the local-source guarded 7,076-element proof ran once before remote apply advanced.',
        'The first receiver endpoint uses the retained 940/7,076 elements and 11/35 publications at 30 seconds as its pre-refactor comparison and performs no additional 7,076-element seed run; every later endpoint consumes artifact:accepted-endpoint-baseline.',
        'One design hypothesis receives at most five materially revised architecture attempts. The same focused failure three times, a resource stop, or a time ceiling terminates the current attempt and forces bounded root-cause analysis and a new owner iteration; it does not stop the overall task.'
      ],
      bypasses: [
        'The creation-only endpoint proof never runs the complete two-window recording, a follow-up turn, or an additional high-detail local run.',
        'The invalid converted-interval 7,076-element stop is discarded without retry; contract review and focused guard correction precede any product-owner decision about a replacement high-detail run.',
        'A guarded 16-item resource stop blocks the 7,076-element proof and returns to the selected owner without consuming a high-detail architecture attempt.',
        'The first receiver endpoint does not require artifact:accepted-endpoint-baseline because the retained pre-refactor evidence is its fixed seed.',
        'The bounded 16-item and 1,280-item attribution cases locate the first chronological owner after a pre-canonical resource stop; they do not replace the exact 7,076-element endpoint proof.',
        'The two-Actor 16-item operation-versus-idle diagnostic compares active and settled work only; it does not replace or create artifact:accepted-endpoint-baseline.',
        'An owner proven below five percent of product time remains unchanged rather than receiving a speculative optimization.',
        'Contents and production persistence are outside this endpoint proof.'
      ],
      allowedContributors: [
        'production Asyra Design App and collaboration server',
        'authenticated guard-ready handshake',
        'detached O(1) runtime counters',
        'detached Actor-target task and script timing',
        'Chromium page-target CDP Performance threadTicks metrics',
        'Actor A connected DOM loading and ordinary viewport interaction evidence',
        'tracked test-owned process ids',
        'declared owner timing artifacts',
        'one terminal bounded canonical equivalence summary'
      ],
      forbiddenContributors: [
        'untracked process termination',
        'full canonical snapshot polling in the heartbeat',
        'video, screenshots, trace, or CPU profiling',
        'CDP Profiler or Tracing capture',
        'harness overhead attributed to a product owner',
        'Playwright locator, visibility, count, text, or attribute polling inside the product window',
        'treating a stale heartbeat as co-temporal with a later CPU sample',
        'subtracting cumulative process CPU time, dividing by wall time, normalizing to polling cadence, averaging snapshots, or using any converted percentage as the formal CPU peak or a stop decision',
        'combining raw process percent-CPU values from different operating-system snapshots',
        'using raw system percent-CPU snapshots or phaseCpuMaximums as phase-owner attribution',
        'starting a second App preview, a second WebSocket server, or any HMR process',
        'running production build commands inside the runtime performance guard or product timing',
        'an ordinary Playwright, Vite development, HMR, unguarded, repeated, or retrying 7,000-plus run',
        'snapshot contentsMode or deliveryMode configuration',
        'aiDelivery, aiPerformanceContents, ai=mock, or another product-mode query',
        'excluding any Chromium renderer PID, GPU, utility, or other subprocess from the browser CPU total',
        'claiming page main-thread or Web Worker ownership for residual renderer CPU without direct evidence',
        'reusing one browser process across single-Actor attribution cases',
        'disabling Collaboration or omitting the WebSocket server for a single-Actor attribution case',
        'using a small attribution case as an endpoint acceptance proof',
        'continuing after a resource guard failure',
        'committing an ineffective endpoint attempt'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/e2e/ai-drawing-performance.spec.ts',
        'apps/asyra-design/e2e/crdt-endpoint-performance.spec.ts',
        'apps/asyra-design/e2e/prepared-server-response-artifacts.mjs',
        'apps/asyra-design/e2e/prepare-server-response-preview.mjs',
        'apps/asyra-design/src/index.tsx',
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
        'apps/asyra-design/collaboration-server.ts',
        'apps/asyra-design/__tests__/collaboration-server.test.mjs',
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
        'artifact:response-inbox-bootstrap-timing',
        'artifact:provider-response-handoff-timing',
        'artifact:ai-action-batch-ingestion-timing',
        'artifact:loading-paint-timing',
        'artifact:app-bulk-timing',
        'artifact:canonical-batch-timing',
        'artifact:local-canonical-owner-batch',
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
        'artifact:endpoint-performance-proof'
      ],
      outputs: ['artifact:performance-equivalence-proof'],
      conditions: [
        'After the final architecture owner, one final invocation of the same guarded two-Actor 7,076-element endpoint proof reports the accepted observed result against the retained pre-refactor and preceding endpoint baselines; it does not add a warm-up, repeat, or parallel high-detail suite.',
        'Spans report product execution, artifact construction, encode, server queue/drain, worker decode, remote apply, Render, UI, and harness overhead separately.',
        'The production performance profile exposes detached canonical, history, Factory transaction-status, commit, and publication evidence without exposing a mutable runtime owner.',
        'Response inbox seeding, the fileId-selected response preload, navigation, App readiness, collaboration readiness, Conversational AI readiness, reference attachment, runtime evidence readiness, and history baselines are named E2E harness spans outside product execution.',
        'Both collaboration actors expose cheap zero-document-persistence evidence without reading or hashing canonical document IndexedDB state; the source Actor may complete its one dedicated response inbox read only before App readiness.',
        'The default 16-item CRDT case, one change-aware 7,112-element balanced correctness run, the final accepted guarded 7,076-element endpoint proof, and the 27,471-element 295,794-point gate pass.',
        'The maximum-detail 27,471-element 295,794-point gate allows at most 300 seconds from accepted turn to Actor A settled while retaining the ordinary 250-percent single-Actor frontend and 400-percent aggregate current-CPU limits.',
        'Local performance and maximum-detail gates launch background headless Chrome for Testing so automation never steals the product owner desktop focus; they apply no CPU quota, process-count limit, worker-count limit, memory ceiling, software-rendering requirement, or Playwright retry, while workers: 1 limits concurrent test cases only and never limits one browser process group.',
        'A maximum-detail-only rotating DevTools diagnostic may retain one fixed-capacity cross-slice heavy-hitter summary with source locations and explicit approximation error; it stores no profile artifact, does not enter raw CPU percentage or stop decisions, and cannot satisfy the maximum-detail acceptance gate.',
        'Canonical equivalence compares exact IDs, order, point counts, geometry data, complete Render topology, hierarchy, bounds, transforms, roles, styles, visibility, and transaction evidence.',
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
        'an additional 7,076-element warm-up, repeat, or unguarded run',
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
      id: 'route-server-prepared-action-batch-to-runtime',
      from: 'preload-file-scoped-server-response',
      to: 'resolve-server-prepared-action-batch',
      kind: 'handoff',
      predicate:
        'Actor A handed the fileId-selected resident server-prepared AiActionBatch to resolveAiActionBatch() with zero request-time response inbox access, fixture import, fetch, parse, tokenization, transform, validation, normalization, or materialization.',
      producedArtifacts: ['artifact:server-prepared-action-batch']
    },
    {
      id: 'route-resolved-ai-action-batch-to-composition',
      from: 'resolve-server-prepared-action-batch',
      to: 'yield-ai-loading-paint',
      kind: 'handoff',
      predicate:
        'The server-prepared AiActionBatch resolved to registered actions without client model validation while preserving batchId.',
      producedArtifacts: [
        'artifact:resolved-ai-action-batch',
        'artifact:bounded-ai-action-batch-preview'
      ]
    },
    {
      id: 'route-loading-boundary-to-composition',
      from: 'yield-ai-loading-paint',
      to: 'stage-local-interactive-composition',
      kind: 'paint-boundary',
      predicate:
        'The confirmed bounds and bounded progress state reached one browser paint opportunity.',
      producedArtifacts: ['artifact:visible-loading-boundary']
    },
    {
      id: 'route-response-inbox-bootstrap-timing-to-endpoint-proof',
      from: 'preload-file-scoped-server-response',
      to: 'evaluate-endpoint-performance',
      kind: 'observation',
      predicate:
        'The exact fileId-selected response inbox read completed before App and Agent readiness and remained outside product operation timing.',
      producedArtifacts: ['artifact:response-inbox-bootstrap-timing']
    },
    {
      id: 'route-response-inbox-bootstrap-timing-to-final-proof',
      from: 'preload-file-scoped-server-response',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate:
        'The accepted architecture reported the fileId-selected response inbox preload as a detached pre-ready harness span.',
      producedArtifacts: ['artifact:response-inbox-bootstrap-timing']
    },
    {
      id: 'route-provider-response-handoff-timing-to-endpoint-proof',
      from: 'preload-file-scoped-server-response',
      to: 'evaluate-endpoint-performance',
      kind: 'observation',
      predicate:
        'The request-time requestActionBatch() span contained only resident response contract verification and AiActionBatch handoff.',
      producedArtifacts: ['artifact:provider-response-handoff-timing']
    },
    {
      id: 'route-provider-response-handoff-timing-to-final-proof',
      from: 'preload-file-scoped-server-response',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate:
        'The accepted request-time provider span retained zero fixture acquisition or materialization.',
      producedArtifacts: ['artifact:provider-response-handoff-timing']
    },
    {
      id: 'route-loading-paint-timing-to-endpoint-proof',
      from: 'yield-ai-loading-paint',
      to: 'evaluate-endpoint-performance',
      kind: 'observation',
      predicate: 'The loading boundary emitted bounded paint timing.',
      producedArtifacts: ['artifact:loading-paint-timing']
    },
    {
      id: 'route-loading-paint-timing-to-final-proof',
      from: 'yield-ai-loading-paint',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate:
        'The accepted loading boundary emitted bounded final paint timing.',
      producedArtifacts: ['artifact:loading-paint-timing']
    },
    {
      id: 'route-ai-action-batch-ingestion-timing-to-endpoint-proof',
      from: 'resolve-server-prepared-action-batch',
      to: 'evaluate-endpoint-performance',
      kind: 'observation',
      predicate:
        'Server-prepared AiActionBatch handoff and Runtime control-envelope resolution emitted bounded timing.',
      producedArtifacts: ['artifact:ai-action-batch-ingestion-timing']
    },
    {
      id: 'route-ai-action-batch-ingestion-timing-to-final-proof',
      from: 'resolve-server-prepared-action-batch',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate:
        'The accepted server-prepared AiActionBatch architecture emitted bounded final timing.',
      producedArtifacts: ['artifact:ai-action-batch-ingestion-timing']
    },
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
      to: 'evaluate-endpoint-performance',
      kind: 'observation',
      predicate:
        'Actor A in the guarded endpoint run emitted bounded App bulk timing samples.',
      producedArtifacts: ['artifact:app-bulk-timing']
    },
    {
      id: 'route-local-drawing-progress-to-proof',
      from: 'stage-local-interactive-composition',
      to: 'evaluate-endpoint-performance',
      kind: 'observation',
      predicate:
        'Actor A in the guarded endpoint run observed exact-bounds loading, first ordinary Vector, actual batch milestones, and terminal cleanup.',
      producedArtifacts: ['artifact:local-drawing-progress-state']
    },
    {
      id: 'route-local-interaction-lock-to-proof',
      from: 'stage-local-interactive-composition',
      to: 'evaluate-endpoint-performance',
      kind: 'observation',
      predicate:
        'One cooperative yield retained ordinary pan and zoom while other document interactions stayed outside canonical mutation and history.',
      producedArtifacts: ['artifact:local-document-interaction-lock-state']
    },
    {
      id: 'route-local-visible-slices-to-proof',
      from: 'project-visible-canonical-slices',
      to: 'evaluate-endpoint-performance',
      kind: 'observation',
      predicate:
        'Actor A in the guarded endpoint run emitted ordinary visible Vector milestones.',
      producedArtifacts: [
        'artifact:visible-canonical-slices',
        'artifact:render-ui-timing'
      ]
    },
    {
      id: 'route-existing-history-replay-to-canonical-owner',
      from: 'record-and-deliver-transaction-batch',
      to: 'apply-canonical-property-scene-batch',
      kind: 'history-replay',
      predicate:
        'Undo, Redo, or rollback replays the ordinary reversible owner event already retained by the existing Factory journal.',
      producedArtifacts: []
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
      id: 'route-local-owner-batch-to-projection',
      from: 'apply-canonical-property-scene-batch',
      to: 'project-visible-canonical-slices',
      kind: 'projection',
      predicate: 'An ordinary applied canonical owner batch is available.',
      producedArtifacts: ['artifact:local-canonical-owner-batch']
    },
    {
      id: 'route-local-owner-batch-to-proof',
      from: 'apply-canonical-property-scene-batch',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate:
        'The ordinary canonical owner batch emitted bounded equivalence evidence.',
      producedArtifacts: ['artifact:local-canonical-owner-batch']
    },
    {
      id: 'route-publications-to-codec',
      from: 'record-and-deliver-transaction-batch',
      to: 'encode-publication-frames',
      kind: 'publication',
      predicate: 'Collaboration is connected and a publication batch exists.',
      producedArtifacts: ['artifact:transport-publication-batch']
    },
    {
      id: 'route-factory-evidence-to-proof',
      from: 'record-and-deliver-transaction-batch',
      to: 'evaluate-performance-and-equivalence',
      kind: 'observation',
      predicate:
        'Factory emitted bounded timing and existing journal/Undo scalar evidence.',
      producedArtifacts: ['artifact:factory-batch-timing']
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
        'Single-Actor and two-Actor demo sessions always started Collaboration from the App-owned document session without a client persistence provider and retained zero client persistence side effects.',
      producedArtifacts: ['artifact:empty-memory-demo-document']
    },
    {
      id: 'route-local-interactive-drawing-proof',
      from: 'evaluate-endpoint-performance',
      kind: 'terminal',
      predicate:
        'The guarded two-Actor creation produced Actor A local interactivity evidence without starting another high-detail run; synchronized visual review remains a later explicit closure.',
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
      to: 'evaluate-performance-and-equivalence',
      kind: 'proof-handoff',
      predicate:
        'Every effective endpoint produced exact guarded high-detail equivalence and owner-effectiveness evidence required by final closure.',
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
      id: 'route-attribution-to-server-response-boundary',
      from: 'evaluate-endpoint-performance',
      to: 'preload-file-scoped-server-response',
      kind: 'bounded-attribution',
      predicate:
        'Fresh single-Actor CPU-time evidence identifies a missing pre-ready response preload or any request-time response inbox access, fixture import, fetch, parse, tokenization, transform, or materialization as the first incorrect boundary.',
      producedArtifacts: ['artifact:precanonical-owner-attribution']
    },
    {
      id: 'route-attribution-to-runtime-resolution',
      from: 'evaluate-endpoint-performance',
      to: 'resolve-server-prepared-action-batch',
      kind: 'bounded-attribution',
      predicate:
        'Fresh single-Actor request-wide CPU-time evidence plus ordered browser-monotonic spans identifies Runtime control-envelope resolution or bounded preview projection as the first material owner.',
      producedArtifacts: ['artifact:precanonical-owner-attribution']
    },
    {
      id: 'route-attribution-to-loading-paint',
      from: 'evaluate-endpoint-performance',
      to: 'yield-ai-loading-paint',
      kind: 'bounded-attribution',
      predicate:
        'An equivalent fresh reduced-motion control materially lowers loading-boundary CPU-time while preserving the same AiActionBatch and canonical result.',
      producedArtifacts: ['artifact:precanonical-owner-attribution']
    },
    {
      id: 'route-attribution-to-local-composition',
      from: 'evaluate-endpoint-performance',
      to: 'stage-local-interactive-composition',
      kind: 'bounded-attribution',
      predicate:
        'Fresh single-Actor request-wide CPU-time evidence plus ordered browser-monotonic spans identifies Group, topology, plural Core request, or cooperative local projection as the first material owner.',
      producedArtifacts: ['artifact:precanonical-owner-attribution']
    },
    {
      id: 'route-attribution-to-receiver-admission',
      from: 'evaluate-endpoint-performance',
      to: 'admit-receiver-publication-frames',
      kind: 'bounded-attribution',
      predicate:
        'Only the separately invoked two-Actor control introduces the first material CPU-time owner at receiver or collaboration admission.',
      producedArtifacts: ['artifact:precanonical-owner-attribution']
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
      id: 'artifact:server-prepared-action-batch',
      ownerStepId: 'preload-file-scoped-server-response',
      channel:
        'fileId-selected startup-resident server-prepared AiActionBatch returned by requestActionBatch()',
      consumerStepIds: ['resolve-server-prepared-action-batch'],
      terminal: false
    },
    {
      id: 'artifact:response-inbox-bootstrap-timing',
      ownerStepId: 'preload-file-scoped-server-response',
      channel: 'detached pre-ready response inbox adapter read timing',
      consumerStepIds: [
        'evaluate-endpoint-performance',
        'evaluate-performance-and-equivalence'
      ],
      terminal: false
    },
    {
      id: 'artifact:provider-response-handoff-timing',
      ownerStepId: 'preload-file-scoped-server-response',
      channel:
        'detached request-time requestActionBatch() contract verification and resident AiActionBatch handoff timing',
      consumerStepIds: [
        'evaluate-endpoint-performance',
        'evaluate-performance-and-equivalence'
      ],
      terminal: false
    },
    {
      id: 'artifact:resolved-ai-action-batch',
      ownerStepId: 'resolve-server-prepared-action-batch',
      channel:
        '@asyra/ai-agent-runtime ResolvedAiActionBatch and PermissionReadyAiActionBatch handoff preserving batchId and action argument identity',
      consumerStepIds: [
        'yield-ai-loading-paint',
        'stage-local-interactive-composition'
      ],
      terminal: false
    },
    {
      id: 'artifact:visible-loading-boundary',
      ownerStepId: 'yield-ai-loading-paint',
      channel: 'one bounded App DOM paint before canonical mutation',
      consumerStepIds: ['stage-local-interactive-composition'],
      terminal: false
    },
    {
      id: 'artifact:loading-paint-timing',
      ownerStepId: 'yield-ai-loading-paint',
      channel: 'detached loading paint and compositor timing',
      consumerStepIds: [
        'evaluate-endpoint-performance',
        'evaluate-performance-and-equivalence'
      ],
      terminal: false
    },
    {
      id: 'artifact:bounded-ai-action-batch-preview',
      ownerStepId: 'resolve-server-prepared-action-batch',
      channel:
        '@asyra/ai-agent-runtime bounded redaction-ready AiActionBatchPreview',
      consumerStepIds: [
        'yield-ai-loading-paint',
        'stage-local-interactive-composition'
      ],
      terminal: false
    },
    {
      id: 'artifact:ai-action-batch-ingestion-timing',
      ownerStepId: 'resolve-server-prepared-action-batch',
      channel: 'detached monotonic pre-canonical owner timing',
      consumerStepIds: [
        'evaluate-endpoint-performance',
        'evaluate-performance-and-equivalence'
      ],
      terminal: false
    },
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
      consumerStepIds: ['evaluate-endpoint-performance'],
      terminal: false
    },
    {
      id: 'artifact:local-document-interaction-lock-state',
      ownerStepId: 'stage-local-interactive-composition',
      channel:
        'runtime-only App interaction policy and ordinary viewport input route',
      consumerStepIds: ['evaluate-endpoint-performance'],
      terminal: false
    },
    {
      id: 'artifact:app-bulk-timing',
      ownerStepId: 'stage-local-interactive-composition',
      channel: 'detached monotonic timing',
      consumerStepIds: [
        'evaluate-endpoint-performance',
        'evaluate-performance-and-equivalence'
      ],
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
      id: 'artifact:local-canonical-owner-batch',
      ownerStepId: 'apply-canonical-property-scene-batch',
      channel: 'ordinary applied canonical owner batch',
      consumerStepIds: [
        'project-visible-canonical-slices',
        'evaluate-performance-and-equivalence'
      ],
      terminal: false
    },
    {
      id: 'artifact:transport-publication-batch',
      ownerStepId: 'record-and-deliver-transaction-batch',
      channel: 'minimal transport wire artifact',
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
      ownerStepId: 'evaluate-endpoint-performance',
      channel: 'guarded endpoint Actor A local-interactivity evidence',
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
        'exact endpoint equivalence and effectiveness comparisons consumed by final closure',
      consumerStepIds: ['evaluate-performance-and-equivalence'],
      terminal: false
    },
    {
      id: 'artifact:precanonical-owner-attribution',
      ownerStepId: 'evaluate-endpoint-performance',
      channel:
        'fresh-process request-wide CPU-time and ordered browser-monotonic attribution that selects exactly one response inbox/provider, Runtime action-batch, loading, canonical, or collaboration owner without endpoint acceptance',
      consumerStepIds: [
        'preload-file-scoped-server-response',
        'resolve-server-prepared-action-batch',
        'yield-ai-loading-paint',
        'stage-local-interactive-composition',
        'admit-receiver-publication-frames'
      ],
      terminal: false
    },
    {
      id: 'artifact:resource-guard-stop-proof',
      ownerStepId: 'evaluate-endpoint-performance',
      channel:
        'terminal tracked-process stop with last phase, Actor A/B counts, per-Actor frontend and aggregate CPU, publication, and owner timing evidence',
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
      id: 'server-response-is-not-document-state',
      statement:
        'The same required fileId may select both the App document session and one test-prepared server response, but the startup-resident response remains noncanonical and nonshared, never enters Core.load, and creates no canonical or CRDT state before Actor A sends the ordinary conversation request.',
      stepIds: [
        'preload-file-scoped-server-response',
        'load-empty-demo-document',
        'resolve-server-prepared-action-batch'
      ],
      artifactIds: [
        'artifact:server-prepared-action-batch',
        'artifact:empty-memory-demo-document'
      ],
      specRefs: [
        '#file-scoped-server-response-contract',
        '#demo-client-persistence-bypass'
      ]
    },
    {
      id: 'one-action-one-existing-history-boundary',
      statement:
        'One mutating user turn owns one outer transaction and one existing Factory Undo entry, produces no parallel AI/bulk forward-inverse history artifact, projects the ordinary canonical owner batch locally, and derives one separate minimal transport wire artifact regardless of publication slice or wire-frame count.',
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
        'artifact:local-canonical-owner-batch',
        'artifact:transport-publication-batch'
      ],
      specRefs: ['#transaction-boundary', '#non-negotiable-equivalence']
    },
    {
      id: 'publication-slices-are-not-canonical-writes',
      statement:
        'Formal publication slices project and publish existing immutable evidence; they never repeat canonical mutation, split history, or collapse progressive peer visibility.',
      stepIds: [
        'record-and-deliver-transaction-batch',
        'project-visible-canonical-slices',
        'encode-publication-frames',
        'admit-receiver-publication-frames',
        'relay-frames-with-backpressure',
        'apply-remote-publication-batches'
      ],
      artifactIds: [
        'artifact:local-canonical-owner-batch',
        'artifact:visible-canonical-slices',
        'artifact:encoded-publication-frames',
        'artifact:remote-factory-mutation-batch'
      ],
      specRefs: [
        '#factory-existing-history-and-transport-wire-contract',
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
        'artifact:transport-publication-batch',
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
        'Ordinary local actions and collaboration remote publications update canonical, Render, and UI state without any client document persistence capture, provider save, document IndexedDB read, or document IndexedDB write; the separate pre-ready response inbox read is not document persistence, and remote apply additionally creates no Undo or echo publication.',
      stepIds: [
        'load-empty-demo-document',
        'evaluate-endpoint-performance',
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
      id: 'file-scoped-server-response',
      title: 'File-scoped server response is ready before product work',
      assertions: [
        'The test or manual harness prepares and seeds one exact versioned response in the response inbox adapter before App navigation, required fileId selects only that response, and deterministic preparation, seed data, and fixtures never enter the production bundle.',
        'App and Agent readiness wait for the bounded read, while the canonical document remains empty and nonshared until Actor A sends the ordinary conversation request.',
        'requestActionBatch() returns exactly one server-prepared AiActionBatch with one batchId. Production has one provider path, no artificial delay, phrase fixture fallback, failure simulation, fixture I/O, model validation, normalization, parse, materialization, deep-freeze, or lazy fallback.',
        'resolveAiActionBatch() produces one ResolvedAiActionBatch, permission receives one PermissionReadyAiActionBatch, and confirmation receives one AiActionBatchPreview without a plan API alias or compatibility wrapper.',
        'The 16-, 320-, 1,280-, and 7,075-child responses preserve exact full detail as prepared Group and ordered child descriptors, while Actor B obtains the resulting drawing only through canonical CRDT publications.'
      ],
      stepIds: [
        'preload-file-scoped-server-response',
        'load-empty-demo-document',
        'resolve-server-prepared-action-batch'
      ],
      specRefs: [
        '#file-scoped-server-response-contract',
        '#non-negotiable-equivalence'
      ]
    },
    {
      id: 'bulk-and-history-equivalence',
      title: 'Bulk canonical and history equivalence',
      assertions: [
        'One Group plus ordered progressive plural batches preserves exact IDs, order, geometry data, complete Render topology, properties, relationships, and component ownership.',
        'A later invalid item leaves no prefix, and single-item APIs are equivalent batch-of-one conveniences.',
        'The existing Factory journal and Undo stack record the ordinary owner events once, group the complete bulk action into one intended Undo entry, and provide exact Undo, Redo, and rollback compensation without a parallel AI/bulk history artifact.',
        'The production fast path performs no post-action save, equality comparison, finalize-save, evidence clone, or full-document snapshot pass.',
        'One separate transport wire artifact carries one remote-apply payload, ordered IDs, and publication metadata without inverseEvents, History evidence, rollback evidence, or payload aliases.'
      ],
      stepIds: [
        'stage-local-interactive-composition',
        'apply-canonical-property-scene-batch',
        'record-and-deliver-transaction-batch'
      ],
      specRefs: [
        '#bulk-mutation-contract',
        '#factory-existing-history-and-transport-wire-contract',
        '#non-negotiable-equivalence'
      ]
    },
    {
      id: 'visible-progressive-projection',
      title: 'Visible progressive projection',
      assertions: [
        'The single progressive delivery route flushes every formal slice through the ordinary Vector route.',
        'All 7,076 editable elements remain complete and uncropped.'
      ],
      stepIds: ['project-visible-canonical-slices'],
      specRefs: ['#visible-progressive-projection', '#product-cases']
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
        'The one guarded two-Actor 7,076-element production run reports Actor A DOM loading, first compositor paint opportunity, first Vector, real milestones, longest work unit, cooperative yield count, settled, Render, UI, harness, Actor B completion and convergence, and separately attributed WebSocket-server timing with no Contents, request-time response inbox read, or document IndexedDB work.'
      ],
      stepIds: [
        'stage-local-interactive-composition',
        'project-visible-canonical-slices',
        'evaluate-endpoint-performance'
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
        'Codec encode, receiver admission, remote apply, relay, and material Render/UI owners advance in the fixed evidence-ranked order.',
        'Every completed owner first passes one guarded 16-item safety proof; one creation-only 7,076-element proof runs only at the named local-source, relay, and final checkpoints with exact A/B completion and owner timing evidence.',
        'The process-tree guard terminates tracked test work when either independently launched Actor browser process group exceeds the raw same-snapshot per-Actor proof-class limit—500 percent for the exact 7,076-element endpoint or 250 percent for 16-item and 1,280-item safety or attribution—or the raw same-snapshot aggregate both-Actor frontend/backend/harness system value exceeds its proof-class limit—500 percent for the exact 7,076-element endpoint or 400 percent for 16-item and 1,280-item safety or attribution—the heartbeat becomes stale, or progress stalls; it reports both per-Actor frontend peaks, the aggregate peak, the last phase, and Actor A/B element counts, and only a raw CPU-limit stop invalidates that architecture attempt.',
        'An ineffective endpoint returns to its first incorrect owner. One design hypothesis receives at most five materially revised attempts; the same focused failure three times, a resource stop, or a time ceiling ends that attempt loop and forces bounded root-cause analysis, an owner-plan revision, and a new iteration without stopping the overall task.'
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
        'Existing progressive, first-visible, convergence, guarded creation-only, and maximum-detail budgets pass with separated owner and harness spans.',
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
        'One file-scoped preloaded server response, one resolved AiActionBatch, prepared Group and child descriptor slices, one existing Factory journal and Undo entry, one separate minimal transport wire artifact, visible ordinary Vector slices, binary backpressured collaboration, zero demo document persistence, and exact performance-equivalence proof.'
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
        href: './completed/ai-conversational-drawing-performance-plan.md'
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
