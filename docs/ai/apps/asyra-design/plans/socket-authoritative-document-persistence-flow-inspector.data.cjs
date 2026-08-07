;(function () {
  'use strict'

  const specPath =
    'docs/ai/apps/asyra-design/specs/socket-authoritative-document-session.md'
  const inspectorPath =
    'docs/ai/apps/asyra-design/plans/socket-authoritative-document-persistence-flow-inspector.data.cjs'

  const lanes = [
    { id: 'bootstrap', title: 'Socket Bootstrap', order: 1 },
    { id: 'client-state', title: 'Client Canonical State', order: 2 },
    { id: 'publication', title: 'Factory Publication', order: 3 },
    { id: 'socket', title: 'Socket Sequence and Flush', order: 4 },
    { id: 'backend', title: 'Backend Materialization', order: 5 }
  ]

  const steps = [
    {
      id: 'open-document-session',
      order: 1,
      laneId: 'bootstrap',
      title: 'Open one authoritative document session',
      ownerPackage: 'Design App socket server',
      purpose:
        'Authorize one Actor, reserve the document stream, and return one gap-free checkpoint plus pending-tail bootstrap through a fixed head-sequence cutoff.',
      inputs: [
        'non-empty fileId, roomId, and Actor identity',
        'replaceable authorization result',
        'artifact:durable-document-checkpoint',
        'current socket-owned pending publication tail'
      ],
      outputs: [
        'artifact:bootstrap-checkpoint',
        'artifact:bootstrap-pending-tail',
        'artifact:bootstrap-live-cutoff',
        'artifact:document-session-open-failure'
      ],
      conditions: [
        'The same handshake is mandatory for one Actor and multiple Actors.',
        'A present backend checkpoint and its durable sequence are read before the pending-tail cutoff is fixed.',
        'The pending tail contains every sequence after durableSequence through headSequence exactly once and in order.',
        'Publications accepted after headSequence remain queued behind bootstrap consumption.',
        'An absent checkpoint yields the formal initial document at durable sequence zero.'
      ],
      bypasses: [
        'An absent checkpoint bypasses backend document data but not authorization, sequence-zero labeling, or the socket handshake.',
        'An unauthorized or duplicate Actor session returns failure and produces no bootstrap artifacts.',
        'Opening crdt-7076-sample without submitting its exact Agent request performs the ordinary document handshake but bypasses action-batch execution and canonical mutation.'
      ],
      allowedContributors: [
        'Design App collaboration wire protocol',
        'Design App socket document-session registry',
        'App backend checkpoint reader',
        'replaceable App authentication/authorization adapter'
      ],
      forbiddenContributors: [
        'browser direct checkpoint GET followed by an unrelated socket connect',
        'Core persistence provider save policy',
        '@asyra/collaboration semantic history or snapshot storage',
        'IndexedDB materialized-document fallback or browser snapshot save'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/collaboration-server.ts',
        'apps/asyra-design/src/collaboration/protocol.ts',
        'apps/asyra-design/src/collaboration/websocket-provider.ts',
        'apps/asyra-design/src/collaboration/lifecycle.ts',
        'apps/asyra-design/src/render-app',
        'apps/asyra-design/src/init/__tests__',
        'apps/asyra-design/__tests__/collaboration-server.test.mjs',
        'apps/asyra-design/e2e/collaboration.spec.ts',
        'docs/ai/apps/asyra-design/specs/socket-authoritative-document-session.md',
        'docs/ai/apps/asyra-design/plans/completed/socket-authoritative-document-persistence-plan.md'
      ],
      specRefs: [
        '#session-activation',
        '#bootstrap-and-load-handshake',
        '#product-cases'
      ],
      failureOwnerStepId: 'open-document-session'
    },
    {
      id: 'hydrate-core-checkpoint',
      order: 1,
      laneId: 'client-state',
      title: 'Hydrate checkpoint through canonical Core load',
      ownerPackage: '@asyra/core',
      purpose:
        'Run the raw checkpoint through existing migration, complete package validation/fallback, owner apply, and load diagnostics without acquiring persistence-save ownership.',
      inputs: [
        'artifact:bootstrap-checkpoint',
        'registered App migration hooks',
        'Props, Scene Tree, and System Context load validators'
      ],
      outputs: [
        'artifact:hydrated-checkpoint-state',
        'artifact:checkpoint-load-failure'
      ],
      conditions: [
        'Core treats the checkpoint document as unknown until the App migration and package validation boundaries narrow it.',
        'Every package validation completes before any canonical package prefix applies.',
        'Explicit snapshot serialization remains separate from load and from transaction settlement.',
        'Core has no commit-triggered snapshot capture, provider save queue, retry, socket, or durable-watermark policy.'
      ],
      bypasses: [
        'A nullish no-document input is not used by the socket bootstrap; the server supplies the formal initial document instead.',
        'Load diagnostics remain optional and cannot change canonical load success.'
      ],
      allowedContributors: [
        '@asyra/core load-hook orchestration',
        '@asyra/props-manager load validator/apply owner',
        '@asyra/scene-tree load validator/apply owner',
        '@asyra/system-context managed-property load owner',
        'App-owned migration hooks'
      ],
      forbiddenContributors: [
        'Factory commit-capture autosave subscriber',
        'full-document clone or stringify after action, Undo, Redo, or selection',
        'browser persistence writer',
        'socket ordering, batching, retry, or durability logic'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/core/src/core.ts',
        'packages/core/src/types',
        'packages/core/src/index.ts',
        'packages/core/src/__tests__/transaction-persistence.test.ts',
        'packages/core/src/__tests__/load-validation.test.ts',
        'packages/persistence/src',
        'docs/ai/framework/packages/core.md',
        'docs/ai/framework/API_SURFACES.md',
        'docs/ai/apps/asyra-design/specs/socket-authoritative-document-session.md',
        'docs/ai/apps/asyra-design/plans/completed/socket-authoritative-document-persistence-plan.md'
      ],
      specRefs: [
        '#bootstrap-and-load-handshake',
        '#reset-import-export-and-serialization',
        '#ownership-and-forbidden-boundaries'
      ],
      failureOwnerStepId: 'hydrate-core-checkpoint'
    },
    {
      id: 'apply-bootstrap-tail',
      order: 2,
      laneId: 'client-state',
      title: 'Apply exact bootstrap tail before socket synchronization',
      ownerPackage: 'Design App collaboration publication processor',
      purpose:
        'Decode and atomically apply trusted checkpoint-following publications through the ordinary remote canonical route until the browser reaches the handshake head sequence.',
      inputs: [
        'artifact:hydrated-checkpoint-state',
        'artifact:bootstrap-pending-tail',
        'artifact:bootstrap-live-cutoff',
        'shared App wire decoder and trusted publication handoff',
        'Factory remote transaction boundary'
      ],
      outputs: [
        'artifact:socket-synchronized-session',
        'artifact:bootstrap-tail-apply-failure'
      ],
      conditions: [
        'The first pending sequence equals durableSequence plus one and the last equals headSequence when the tail is non-empty.',
        'Every pending publication is wire-decoded once and atomically applied exactly once in sequence without recursive product-payload schema validation.',
        'Tail apply reuses the same App decoder, trusted publication handoff, and Core canonical apply boundary as live remote publications.',
        'The socket session becomes synchronized only after the cutoff is reached; local editing availability is independent.',
        'Bootstrap apply creates no local Undo, browser save, or outbound echo.'
      ],
      bypasses: [
        'An empty pending tail marks the hydrated checkpoint synchronized when durableSequence equals headSequence.',
        'A sequence gap, duplicate, codec-integrity failure, or atomic apply failure blocks socket synchronization and requires authoritative resynchronization without disabling the local runtime.'
      ],
      allowedContributors: [
        'Design App wire codec and trusted publication handoff',
        'Design App shared publication-to-CanonicalChange organizer',
        '@asyra/factory runRemoteTransaction',
        '@asyra/core applyCanonicalChanges'
      ],
      forbiddenContributors: [
        'feature behavior reconstruction',
        'receiver-side persistence save',
        'local Undo History',
        'publication echo',
        'a bootstrap-specific payload interpretation',
        'recursive product-payload schema validation after decode'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/collaboration/operations.ts',
        'apps/asyra-design/src/collaboration/lifecycle.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-operations.test.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-lifecycle.test.ts',
        'packages/factory/src/factory.ts',
        'packages/factory/src/__tests__/factory.test.ts',
        'apps/asyra-design/e2e/collaboration.spec.ts',
        'docs/ai/apps/asyra-design/specs/socket-authoritative-document-session.md',
        'docs/ai/apps/asyra-design/plans/completed/trusted-publication-and-crdt-7076-flow-realignment-plan.md'
      ],
      specRefs: [
        '#bootstrap-and-load-handshake',
        '#canonical-publication-boundary',
        '#product-cases'
      ],
      failureOwnerStepId: 'apply-bootstrap-tail'
    },
    {
      id: 'settle-local-publication',
      order: 1,
      laneId: 'publication',
      title: 'Settle one immutable canonical publication',
      ownerPackage: '@asyra/factory',
      purpose:
        'Preserve transaction, History, rollback, and shared-delivery semantics while emitting the existing minimal SharedPublication as the only client document-change unit.',
      inputs: [
        'artifact:active-local-document-session',
        'committed canonical Scene Tree or Props mutation evidence',
        'existing shared channel and delivery mode',
        'existing Factory transaction journal and replay origin'
      ],
      outputs: [
        'artifact:document-shared-publication',
        'artifact:local-publication-settlement-failure'
      ],
      conditions: [
        'A committed transaction-end delivery produces the existing grouped publication.',
        'Immediate delivery may produce several ordered publications inside one outer undo action.',
        'Undo emits actual inverse deliveries, Redo emits actual forward deliveries, and rollback emits compensation only for already published immediate deliveries.',
        'Publication data is detached and contains no private History before/after, inverter, or replace-latest staging evidence.',
        'The App adapter admits only registered Scene Tree and Props document channels.'
      ],
      bypasses: [
        'A nonmatching crdt-7076-sample HTTP action-batch request fails before Runtime and canonical publication.',
        'A selection-only or other non-document transaction produces no document publication.',
        'Rollback before publication discards pending transaction-end delivery.',
        'A semantic no-op produces no publication.'
      ],
      allowedContributors: [
        '@asyra/factory transaction journal and shared settlement',
        'registered Scene Tree and Props shared channels',
        'App document-channel filter',
        'existing undo/redo and compensation replay'
      ],
      forbiddenContributors: [
        'CoreRawData snapshot capture',
        'Factory History entry exposure',
        'parallel persistence change artifact',
        'Selection, Awareness, computed projection, Render/UI, or diagnostics data'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'packages/factory/src/data-transact.ts',
        'packages/factory/src/index.ts',
        'packages/factory/src/__tests__/shared-publication.test.ts',
        'packages/factory/src/__tests__/factory-journal-history.test.ts',
        'apps/asyra-design/src/collaboration/factory-adapter.ts',
        'apps/asyra-design/src/features/__tests__/collaboration-action-publication.test.ts',
        'apps/asyra-design/e2e/app.spec.ts',
        'apps/asyra-design/e2e/collaboration.spec.ts',
        'docs/ai/framework/packages/factory.md',
        'docs/ai/apps/asyra-design/specs/socket-authoritative-document-session.md',
        'docs/ai/apps/asyra-design/plans/completed/socket-authoritative-document-persistence-plan.md'
      ],
      specRefs: [
        '#canonical-publication-boundary',
        '#ownership-and-forbidden-boundaries',
        '#product-cases'
      ],
      failureOwnerStepId: 'settle-local-publication'
    },
    {
      id: 'recover-pending-publications',
      order: 2,
      laneId: 'publication',
      title: 'Retain and reconcile unaccepted local publications',
      ownerPackage: 'Design App collaboration lifecycle and outbox',
      purpose:
        'Durably retain every unaccepted local publication, keep local editing available across connection loss, and reconcile pending publications into one server-assigned order after a fresh handshake.',
      inputs: [
        'artifact:document-shared-publication',
        'artifact:socket-synchronized-session',
        'artifact:source-publication-acceptance',
        'artifact:document-session-open-failure',
        'artifact:publication-sequence-failure',
        'native IndexedDB storage and current in-memory recovery queue',
        'Provider connection status'
      ],
      outputs: [
        'artifact:active-local-document-session',
        'artifact:recoverable-pending-publication',
        'artifact:reconciled-document-session',
        'artifact:connection-sync-state',
        'artifact:outbox-storage-failure'
      ],
      conditions: [
        'Every connected or disconnected local document publication is appended in file-local order before it is eligible for removal.',
        'The durable record contains the immutable SharedPublication and correlation metadata, never a Core snapshot or private Factory History.',
        'A matching socket source acceptance removes exactly one pending publication; response loss retransmits the same publication identity.',
        'Initial connection failure and later disconnection leave Core, Canvas, actions, Undo, and Redo available.',
        'One disconnected epoch produces at most one disconnect toast, one recovery transition produces at most one reconnect toast, and publication-level failures remain console-only.',
        'A disconnected lifecycle schedules one non-overlapping reconnect attempt every 30000 ms.',
        'Reconnect obtains the latest checkpoint and socket tail, then applies accepted local recovery and peer publications in server sequence exactly once.',
        'Same-property conflicts resolve by later server sequence; an unexpected atomic apply failure advances no sequence and restarts authoritative reconciliation instead of creating a socket semantic-conflict record.',
        'IndexedDB quota or denial enters storage-failed and retains current-runtime memory evidence when possible without evicting older pending entries.'
      ],
      bypasses: [
        'Selection-only and other non-document transactions produce no outbox entry.',
        'An empty outbox bypasses recovery upload but not the reconnect handshake.',
        'A repeated status or publication failure bypasses toast emission after its transition epoch was already reported.'
      ],
      allowedContributors: [
        'Design App collaboration lifecycle',
        'App-owned native IndexedDB publication outbox',
        'Design App WebSocket Provider and protocol',
        'App trusted publication decoder and authoritative resynchronization decision',
        'quiet App connection and sync status projection'
      ],
      forbiddenContributors: [
        '@asyra/core automatic persistence capture',
        '@asyra/factory private History persistence',
        'generic @asyra/collaboration recovery or App conflict policy',
        'complete document snapshots in the outbox',
        'silent pending-publication eviction, overwrite, expiry, or drop',
        'per-operation transport-failure toast'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/collaboration',
        'apps/asyra-design/src/render-app',
        'apps/asyra-design/src/init/__tests__',
        'apps/asyra-design/e2e/collaboration.spec.ts',
        'docs/ai/apps/asyra-design/specs/socket-authoritative-document-session.md',
        'docs/ai/apps/asyra-design/plans/completed/trusted-publication-and-crdt-7076-flow-realignment-plan.md'
      ],
      specRefs: [
        '#connection-local-outbox-and-notifications',
        '#bootstrap-and-load-handshake',
        '#acknowledgement-and-failure-semantics',
        '#product-cases'
      ],
      failureOwnerStepId: 'recover-pending-publications'
    },
    {
      id: 'sequence-live-publication',
      order: 1,
      laneId: 'socket',
      title: 'Assign document order and fan out live',
      ownerPackage: 'Design App socket server',
      purpose:
        'Admit one bounded opaque publication envelope, deduplicate exact encoded bytes, assign one monotonic document sequence, enqueue the original payload bytes, and broadcast them in that sequence order.',
      inputs: [
        'artifact:recoverable-pending-publication',
        'ready document-session identity',
        'bounded outer wire envelope and original encoded publication bytes',
        'current document head sequence',
        'current publication-id plus encoded-byte-digest acceptance index'
      ],
      outputs: [
        'artifact:sequenced-document-publication',
        'artifact:source-publication-acceptance',
        'artifact:publication-sequence-failure'
      ],
      conditions: [
        'One accepted new publication receives exactly the next document sequence.',
        'A retransmission with the accepted publication identity and exact encoded-byte digest resolves to its existing sequence and is not enqueued or broadcast twice.',
        'The source acceptance response carries the assigned sequence and does not claim peer apply or backend durability.',
        'Every peer receives the original encoded payload bytes in the server-assigned document order; only server-owned outer sequence and actor metadata may be reframed.',
        'The sequenced opaque publication bytes are appended to the pending persistence queue before source acceptance completes.',
        'The live socket does not decode product payloads, construct an admission document, or reinterpret App route and payload semantics.'
      ],
      bypasses: [
        'A known retransmission bypasses new sequence allocation and duplicate fan-out.',
        'An invalid session, publication identity, outer wire envelope, byte bound, chunk sequence, or changed payload digest is rejected before sequence allocation.'
      ],
      allowedContributors: [
        'Design App outer wire-integrity and byte-bound validation',
        'Design App document-session registry and sequencer',
        'publication identity plus exact encoded-byte digest',
        'existing bounded WebSocket peer queues'
      ],
      forbiddenContributors: [
        'client timestamp ordering',
        'independent sequence assignment by multiple socket processes',
        'backend durability claim in source or peer acknowledgement',
        'generic @asyra/collaboration persistence policy',
        'server product-payload decode, recursive schema validation, or re-encode',
        'server admissionDocument or decoded deep-equality comparison'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/collaboration-server.ts',
        'apps/asyra-design/src/collaboration/protocol.ts',
        'apps/asyra-design/src/collaboration/websocket-provider.ts',
        'apps/asyra-design/src/collaboration/publication-codec-worker.ts',
        'apps/asyra-design/src/collaboration/collaboration-transport-worker.ts',
        'apps/asyra-design/__tests__/collaboration-server.test.mjs',
        'apps/asyra-design/src/init/__tests__/collaboration-protocol.test.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-websocket-provider.test.ts',
        'docs/ai/apps/asyra-design/specs/socket-authoritative-document-session.md',
        'docs/ai/apps/asyra-design/plans/completed/trusted-publication-and-crdt-7076-flow-realignment-plan.md'
      ],
      specRefs: [
        '#socket-sequencing-and-live-fan-out',
        '#acknowledgement-and-failure-semantics',
        '#product-cases'
      ],
      failureOwnerStepId: 'sequence-live-publication'
    },
    {
      id: 'apply-live-publication',
      order: 3,
      laneId: 'client-state',
      title: 'Apply one sequenced live publication',
      ownerPackage: 'Design App collaboration publication processor',
      purpose:
        'Consume each wire-decoded trusted peer publication once through one atomic remote transaction, ordered canonical owner apply, and cooperative presentation route without receiver persistence or echo.',
      inputs: [
        'artifact:reconciled-document-session',
        'artifact:sequenced-document-publication',
        'shared App wire decoder and trusted publication handoff',
        'Factory remote transaction boundary',
        'framework cooperative presentation scheduler'
      ],
      outputs: [
        'artifact:converged-live-client-state',
        'artifact:live-publication-apply-failure'
      ],
      conditions: [
        'The next live sequence must equal the client-applied sequence plus one.',
        'One accepted publication maps to one remote transaction and one ordered source-slice series of Core canonical requests.',
        'Remote apply preserves source delivery and slice order, updates ordinary state-owner projections, and crosses cooperative paint boundaries so progressive output becomes visible.',
        'The decoded trusted publication is not recursively revalidated by App routing, Core apply, or projection consumers.',
        'Remote apply creates no receiving-client Undo, browser persistence write, or outbound publication.',
        'Peer-applied observation remains distinct from socket acceptance and backend durability.',
        'An unexpected apply failure commits no prefix, advances no applied sequence, clears later queued publications, and requires authoritative resynchronization.'
      ],
      bypasses: [
        'The sender does not receive an echo publication.',
        'A duplicate, gap, codec-integrity failure, or failed atomic canonical apply does not advance the client-applied sequence.'
      ],
      allowedContributors: [
        'Design App wire decoder and trusted publication organizer',
        '@asyra/factory runRemoteTransaction',
        '@asyra/core applyCanonicalChanges',
        'Scene Tree and Props canonical owners',
        '@asyra/reactive-events cooperative host-yield and paint adapter'
      ],
      forbiddenContributors: [
        'receiver browser save',
        'receiver local Undo History',
        'Factory transaction persistence status',
        'feature-specific reconstruction',
        'duplicate backend materialization logic',
        'recursive route or product-payload schema validation',
        'silent failed-sequence skip or partial-prefix commit'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/src/collaboration/operations.ts',
        'apps/asyra-design/src/collaboration/lifecycle.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-operations.test.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-lifecycle.test.ts',
        'apps/asyra-design/e2e/collaboration.spec.ts',
        'docs/ai/apps/asyra-design/specs/socket-authoritative-document-session.md',
        'docs/ai/apps/asyra-design/plans/completed/trusted-publication-and-crdt-7076-flow-realignment-plan.md'
      ],
      specRefs: [
        '#canonical-publication-boundary',
        '#acknowledgement-and-failure-semantics',
        '#product-cases'
      ],
      failureOwnerStepId: 'apply-live-publication'
    },
    {
      id: 'flush-persistence-window',
      order: 2,
      laneId: 'socket',
      title: 'Flush one fixed-window ordered batch',
      ownerPackage: 'Design App socket server',
      purpose:
        'Collect sequenced opaque publication bytes in one non-debounced three-second dirty window, serialize one contiguous byte-preserving batch, retry the exact batch, and track the backend durable watermark.',
      inputs: [
        'artifact:sequenced-document-publication',
        'artifact:durable-sequence-acknowledgement',
        'configured flush interval, count limit, and byte limit',
        'current pending and in-flight document queues'
      ],
      outputs: [
        'artifact:document-persistence-flush-batch',
        'artifact:persistence-flush-failure'
      ],
      conditions: [
        'The first pending publication starts one fixed 3000 ms deadline and later publications do not reset it.',
        'The configured interval validates within 1000..3000 ms.',
        'Count, byte, graceful-shutdown, or intentional-session-release policy may flush early.',
        'One document has at most one in-flight backend request.',
        'Entries accepted while a request is in flight remain ordered in the next batch.',
        'A backend failure retains and retries the exact sequence metadata and opaque encoded publication bytes; later sequences cannot overtake it.',
        'Server source admission stops before the bounded pending policy is violated; later browser publications remain in their App-owned outboxes.',
        'Only a contiguous durable acknowledgement removes pending entries and advances the durable watermark.',
        'The flush owner does not decode, validate, normalize, or re-encode product payloads.'
      ],
      bypasses: [
        'An empty pending queue owns no timer and emits no backend request.',
        'An early threshold flush cancels only the current deadline after its entries are fixed.',
        'Unexpected process failure may discard the in-memory tail after the last durable sequence; three seconds is the healthy-backend cadence, not a hard bound during backend outage.'
      ],
      allowedContributors: [
        'Design App socket document queue',
        'named server flush policy',
        'monotonic document sequence',
        'App backend persistence client'
      ],
      forbiddenContributors: [
        'sliding debounce',
        'concurrent out-of-order backend requests for one document',
        'new batch identity on ordinary retry',
        'browser persistence queue',
        'dropping changes after backend timeout or non-success response',
        'product-payload decode, semantic validation, or re-encode'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/collaboration-server.ts',
        'apps/asyra-design/server',
        'apps/asyra-design/__tests__/collaboration-server.test.mjs',
        'apps/asyra-design/__tests__/document-database-middleware.test.mjs',
        'apps/asyra-design/e2e/document-database-middleware.mjs',
        'docs/ai/apps/asyra-design/specs/socket-authoritative-document-session.md',
        'docs/ai/apps/asyra-design/plans/completed/trusted-publication-and-crdt-7076-flow-realignment-plan.md'
      ],
      specRefs: [
        '#three-second-persistence-window',
        '#acknowledgement-and-failure-semantics',
        '#product-cases'
      ],
      failureOwnerStepId: 'flush-persistence-window'
    },
    {
      id: 'materialize-backend-document',
      order: 1,
      laneId: 'backend',
      title: 'Apply ordered publications to the checkpoint',
      ownerPackage: 'Design App App backend',
      purpose:
        'Decode each trusted opaque publication once and idempotently apply one contiguous batch atomically to the materialized document, then acknowledge the highest durable sequence.',
      inputs: [
        'artifact:document-persistence-flush-batch',
        'current materialized document and durable sequence',
        'shared App wire decoder and trusted publication organizer',
        'backend authorization and storage transaction'
      ],
      outputs: [
        'artifact:durable-document-checkpoint',
        'artifact:durable-sequence-acknowledgement',
        'artifact:backend-materialization-failure'
      ],
      conditions: [
        'The expected prior durable sequence equals the current durable sequence.',
        'Every entry sequence is contiguous and publication identity is valid.',
        'Batch and publication retry are idempotent.',
        'The shared App wire decoder reconstructs each trusted publication exactly once and the App organizer converts it to ordered canonical changes without a second recursive product-schema validation or independent route/payload interpretation.',
        'Each publication boundary applies atomically and no acknowledgement advances past a failed publication.',
        'A successful request stores the updated checkpoint and returns the highest contiguous durable sequence.'
      ],
      bypasses: [
        'A fully acknowledged retry returns the existing durable watermark without applying data twice.',
        'An invalid, unauthorized, gapped, or conflicting request mutates no document prefix past the current durable sequence.'
      ],
      allowedContributors: [
        'App-owned wire decoder and trusted publication organizer',
        'trusted opaque publication bytes from the socket batch',
        'backend document materializer',
        'backend idempotency and sequence registry',
        'backend storage transaction'
      ],
      forbiddenContributors: [
        'browser Core runtime or Undo History',
        'generic @asyra/collaboration document semantics',
        'independent backend route/payload interpretation',
        'a second recursive product-payload schema validator after wire decode',
        'Selection, Awareness, computed projection, Render/UI, or diagnostics persistence',
        'acknowledgement beyond a failed or missing sequence'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'apps/asyra-design/server',
        'apps/asyra-design/e2e/document-database-middleware.mjs',
        'apps/asyra-design/__tests__/document-database-middleware.test.mjs',
        'apps/asyra-design/src/collaboration/operations.ts',
        'apps/asyra-design/src/init/__tests__/collaboration-operations.test.ts',
        'docs/ai/apps/asyra-design/specs/socket-authoritative-document-session.md',
        'docs/ai/apps/asyra-design/plans/completed/trusted-publication-and-crdt-7076-flow-realignment-plan.md'
      ],
      specRefs: [
        '#backend-materialization',
        '#acknowledgement-and-failure-semantics',
        '#ownership-and-forbidden-boundaries'
      ],
      failureOwnerStepId: 'materialize-backend-document'
    }
  ]

  const routes = [
    {
      id: 'route-checkpoint-to-session-bootstrap',
      from: 'materialize-backend-document',
      to: 'open-document-session',
      kind: 'checkpoint-read',
      predicate:
        'A new or reconnecting Actor opens the document after a backend checkpoint is available.',
      producedArtifacts: ['artifact:durable-document-checkpoint']
    },
    {
      id: 'route-bootstrap-checkpoint-to-core',
      from: 'open-document-session',
      to: 'hydrate-core-checkpoint',
      kind: 'bootstrap-load',
      predicate:
        'Authorization succeeds and the socket fixes one checkpoint/tail/head cutoff.',
      producedArtifacts: ['artifact:bootstrap-checkpoint']
    },
    {
      id: 'route-bootstrap-tail-to-app',
      from: 'open-document-session',
      to: 'apply-bootstrap-tail',
      kind: 'bootstrap-tail',
      predicate:
        'The socket returns the exact pending tail and live cutoff for the authorized session.',
      producedArtifacts: [
        'artifact:bootstrap-pending-tail',
        'artifact:bootstrap-live-cutoff'
      ]
    },
    {
      id: 'route-hydrated-checkpoint-to-tail',
      from: 'hydrate-core-checkpoint',
      to: 'apply-bootstrap-tail',
      kind: 'canonical-load-complete',
      predicate:
        'Core migration, all package validation, and owner apply complete successfully.',
      producedArtifacts: ['artifact:hydrated-checkpoint-state']
    },
    {
      id: 'route-bootstrap-session-to-recovery',
      from: 'apply-bootstrap-tail',
      to: 'recover-pending-publications',
      kind: 'socket-synchronized',
      predicate:
        'The client has applied through headSequence and may begin ordered local outbox reconciliation.',
      producedArtifacts: ['artifact:socket-synchronized-session']
    },
    {
      id: 'route-local-session-to-local-settlement',
      from: 'recover-pending-publications',
      to: 'settle-local-publication',
      kind: 'local-editing-available',
      predicate:
        'The App has an initialized local document whether the Provider is connected, disconnected, or retrying.',
      producedArtifacts: ['artifact:active-local-document-session']
    },
    {
      id: 'route-reconciled-session-to-live-apply',
      from: 'recover-pending-publications',
      to: 'apply-live-publication',
      kind: 'live-consumption-enabled',
      predicate:
        'Bootstrap and pending local recovery have established the next server sequence for ordered live consumption.',
      producedArtifacts: ['artifact:reconciled-document-session']
    },
    {
      id: 'route-publication-to-outbox',
      from: 'settle-local-publication',
      to: 'recover-pending-publications',
      kind: 'local-publication-retention',
      predicate:
        'Factory settles a non-empty Scene Tree or Props document publication.',
      producedArtifacts: ['artifact:document-shared-publication']
    },
    {
      id: 'route-outbox-publication-to-socket',
      from: 'recover-pending-publications',
      to: 'sequence-live-publication',
      kind: 'recoverable-local-publication',
      predicate:
        'The Provider is connected and the next durable pending publication is eligible for source acceptance.',
      producedArtifacts: ['artifact:recoverable-pending-publication']
    },
    {
      id: 'route-source-acceptance-to-outbox',
      from: 'sequence-live-publication',
      to: 'recover-pending-publications',
      kind: 'source-acceptance',
      predicate:
        'The socket returns the assigned or previously deduplicated sequence for the same publication identity.',
      producedArtifacts: ['artifact:source-publication-acceptance']
    },
    {
      id: 'route-sequenced-publication-to-peer',
      from: 'sequence-live-publication',
      to: 'apply-live-publication',
      kind: 'ordered-live-fanout',
      predicate:
        'A peer is connected and its next expected sequence matches the accepted publication.',
      producedArtifacts: ['artifact:sequenced-document-publication']
    },
    {
      id: 'route-sequenced-publication-to-flush',
      from: 'sequence-live-publication',
      to: 'flush-persistence-window',
      kind: 'persistence-enqueue',
      predicate:
        'A new publication sequence is accepted into the document pending queue.',
      producedArtifacts: ['artifact:sequenced-document-publication']
    },
    {
      id: 'route-flush-batch-to-backend',
      from: 'flush-persistence-window',
      to: 'materialize-backend-document',
      kind: 'ordered-persistence-batch',
      predicate:
        'The fixed deadline or an early threshold fixes one contiguous opaque-byte batch and no earlier batch is in flight.',
      producedArtifacts: ['artifact:document-persistence-flush-batch']
    },
    {
      id: 'route-durable-ack-to-flush-owner',
      from: 'materialize-backend-document',
      to: 'flush-persistence-window',
      kind: 'durable-watermark',
      predicate:
        'The backend commits a contiguous prefix and acknowledges its highest durable sequence.',
      producedArtifacts: ['artifact:durable-sequence-acknowledgement']
    },
    {
      id: 'route-live-state-terminal',
      from: 'apply-live-publication',
      kind: 'terminal-client-state',
      predicate:
        'The sequenced publication applies and ordinary projections settle.',
      producedArtifacts: ['artifact:converged-live-client-state']
    },
    {
      id: 'route-session-open-failure',
      from: 'open-document-session',
      to: 'recover-pending-publications',
      kind: 'connection-failure-observation',
      predicate:
        'Initial connection, authorization, reservation, checkpoint read, or cutoff creation fails; retryable reachability failures enter the disconnected epoch.',
      producedArtifacts: ['artifact:document-session-open-failure']
    },
    {
      id: 'route-checkpoint-load-failure',
      from: 'hydrate-core-checkpoint',
      kind: 'terminal-failure',
      predicate: 'Migration, validation, or canonical load apply fails.',
      producedArtifacts: ['artifact:checkpoint-load-failure']
    },
    {
      id: 'route-bootstrap-tail-failure',
      from: 'apply-bootstrap-tail',
      kind: 'terminal-failure',
      predicate:
        'The pending tail has a sequence, codec-integrity, or atomic apply failure before readiness.',
      producedArtifacts: ['artifact:bootstrap-tail-apply-failure']
    },
    {
      id: 'route-local-publication-failure',
      from: 'settle-local-publication',
      kind: 'terminal-failure',
      predicate:
        'Factory shared settlement fails and its existing rollback owner settles the local action.',
      producedArtifacts: ['artifact:local-publication-settlement-failure']
    },
    {
      id: 'route-publication-sequence-failure',
      from: 'sequence-live-publication',
      to: 'recover-pending-publications',
      kind: 'source-rejection',
      predicate:
        'The session identity, publication identity, outer wire envelope, byte bounds, chunk sequence, payload digest, or bounded pending capacity cannot be admitted by the socket sequencer.',
      producedArtifacts: ['artifact:publication-sequence-failure']
    },
    {
      id: 'route-outbox-storage-failure',
      from: 'recover-pending-publications',
      kind: 'terminal-observation',
      predicate:
        'IndexedDB append fails and the App enters storage-failed without dropping older pending entries.',
      producedArtifacts: ['artifact:outbox-storage-failure']
    },
    {
      id: 'route-connection-sync-state',
      from: 'recover-pending-publications',
      kind: 'terminal-observation',
      predicate:
        'Connection or sync state changes and the App updates its quiet status plus transition-limited notification policy.',
      producedArtifacts: ['artifact:connection-sync-state']
    },
    {
      id: 'route-live-apply-failure',
      from: 'apply-live-publication',
      kind: 'terminal-failure',
      predicate:
        'The live publication has a sequence or codec-integrity failure, or its atomic canonical apply fails and requires authoritative resynchronization.',
      producedArtifacts: ['artifact:live-publication-apply-failure']
    },
    {
      id: 'route-persistence-flush-failure',
      from: 'flush-persistence-window',
      kind: 'terminal-observation',
      predicate:
        'A backend attempt fails while the exact batch remains owned for retry.',
      producedArtifacts: ['artifact:persistence-flush-failure']
    },
    {
      id: 'route-backend-materialization-failure',
      from: 'materialize-backend-document',
      kind: 'terminal-failure',
      predicate:
        'Authorization, sequence, validation, canonical application, or checkpoint commit fails.',
      producedArtifacts: ['artifact:backend-materialization-failure']
    }
  ]

  const artifacts = [
    {
      id: 'artifact:durable-document-checkpoint',
      ownerStepId: 'materialize-backend-document',
      channel: 'backend checkpoint read',
      consumerStepIds: ['open-document-session']
    },
    {
      id: 'artifact:bootstrap-checkpoint',
      ownerStepId: 'open-document-session',
      channel: 'socket bootstrap',
      consumerStepIds: ['hydrate-core-checkpoint']
    },
    {
      id: 'artifact:bootstrap-pending-tail',
      ownerStepId: 'open-document-session',
      channel: 'socket bootstrap',
      consumerStepIds: ['apply-bootstrap-tail']
    },
    {
      id: 'artifact:bootstrap-live-cutoff',
      ownerStepId: 'open-document-session',
      channel: 'socket bootstrap',
      consumerStepIds: ['apply-bootstrap-tail']
    },
    {
      id: 'artifact:hydrated-checkpoint-state',
      ownerStepId: 'hydrate-core-checkpoint',
      channel: 'Core canonical load completion',
      consumerStepIds: ['apply-bootstrap-tail']
    },
    {
      id: 'artifact:socket-synchronized-session',
      ownerStepId: 'apply-bootstrap-tail',
      channel: 'App socket synchronization boundary',
      consumerStepIds: ['recover-pending-publications']
    },
    {
      id: 'artifact:active-local-document-session',
      ownerStepId: 'recover-pending-publications',
      channel: 'App local editing availability',
      consumerStepIds: ['settle-local-publication']
    },
    {
      id: 'artifact:document-shared-publication',
      ownerStepId: 'settle-local-publication',
      channel: 'Factory shared publication',
      consumerStepIds: ['recover-pending-publications']
    },
    {
      id: 'artifact:recoverable-pending-publication',
      ownerStepId: 'recover-pending-publications',
      channel: 'App durable publication outbox',
      consumerStepIds: ['sequence-live-publication']
    },
    {
      id: 'artifact:reconciled-document-session',
      ownerStepId: 'recover-pending-publications',
      channel: 'App recovery boundary',
      consumerStepIds: ['apply-live-publication']
    },
    {
      id: 'artifact:connection-sync-state',
      ownerStepId: 'recover-pending-publications',
      channel: 'App quiet status and transition notification',
      consumerStepIds: []
    },
    {
      id: 'artifact:sequenced-document-publication',
      ownerStepId: 'sequence-live-publication',
      channel: 'socket opaque encoded document stream',
      consumerStepIds: ['apply-live-publication', 'flush-persistence-window']
    },
    {
      id: 'artifact:source-publication-acceptance',
      ownerStepId: 'sequence-live-publication',
      channel: 'socket source acceptance',
      consumerStepIds: ['recover-pending-publications']
    },
    {
      id: 'artifact:document-persistence-flush-batch',
      ownerStepId: 'flush-persistence-window',
      channel: 'socket-to-backend opaque publication persistence request',
      consumerStepIds: ['materialize-backend-document']
    },
    {
      id: 'artifact:durable-sequence-acknowledgement',
      ownerStepId: 'materialize-backend-document',
      channel: 'backend-to-socket durability response',
      consumerStepIds: ['flush-persistence-window']
    },
    {
      id: 'artifact:converged-live-client-state',
      ownerStepId: 'apply-live-publication',
      channel: 'terminal canonical client state',
      consumerStepIds: []
    },
    {
      id: 'artifact:document-session-open-failure',
      ownerStepId: 'open-document-session',
      channel: 'connection or authorization failure',
      consumerStepIds: ['recover-pending-publications']
    },
    {
      id: 'artifact:checkpoint-load-failure',
      ownerStepId: 'hydrate-core-checkpoint',
      channel: 'terminal failure',
      consumerStepIds: []
    },
    {
      id: 'artifact:bootstrap-tail-apply-failure',
      ownerStepId: 'apply-bootstrap-tail',
      channel: 'terminal failure',
      consumerStepIds: []
    },
    {
      id: 'artifact:local-publication-settlement-failure',
      ownerStepId: 'settle-local-publication',
      channel: 'terminal failure',
      consumerStepIds: []
    },
    {
      id: 'artifact:publication-sequence-failure',
      ownerStepId: 'sequence-live-publication',
      channel: 'socket source wire, identity, digest, or capacity rejection',
      consumerStepIds: ['recover-pending-publications']
    },
    {
      id: 'artifact:outbox-storage-failure',
      ownerStepId: 'recover-pending-publications',
      channel: 'terminal recovery-storage observation',
      consumerStepIds: []
    },
    {
      id: 'artifact:live-publication-apply-failure',
      ownerStepId: 'apply-live-publication',
      channel: 'terminal failure',
      consumerStepIds: []
    },
    {
      id: 'artifact:persistence-flush-failure',
      ownerStepId: 'flush-persistence-window',
      channel: 'retryable failure observation',
      consumerStepIds: []
    },
    {
      id: 'artifact:backend-materialization-failure',
      ownerStepId: 'materialize-backend-document',
      channel: 'terminal failure',
      consumerStepIds: []
    }
  ]

  const invariants = [
    {
      id: 'one-production-document-path',
      statement:
        'Every one-Actor and multi-Actor document uses one socket handshake, one Factory publication path, one App recovery outbox, one server sequence, and one backend materialization path.',
      stepIds: [
        'open-document-session',
        'settle-local-publication',
        'recover-pending-publications',
        'sequence-live-publication',
        'materialize-backend-document'
      ],
      artifactIds: [
        'artifact:bootstrap-checkpoint',
        'artifact:document-shared-publication',
        'artifact:recoverable-pending-publication',
        'artifact:sequenced-document-publication',
        'artifact:durable-document-checkpoint'
      ],
      specRefs: [
        '#session-activation',
        '#canonical-publication-boundary',
        '#ownership-and-forbidden-boundaries'
      ]
    },
    {
      id: 'load-is-gap-free',
      statement:
        'Checkpoint load plus pending-tail apply reaches the handshake head sequence before reconnect reconciliation and later live delivery begin.',
      stepIds: [
        'open-document-session',
        'hydrate-core-checkpoint',
        'apply-bootstrap-tail'
      ],
      artifactIds: [
        'artifact:bootstrap-checkpoint',
        'artifact:bootstrap-pending-tail',
        'artifact:bootstrap-live-cutoff',
        'artifact:socket-synchronized-session'
      ],
      specRefs: ['#bootstrap-and-load-handshake', '#product-cases']
    },
    {
      id: 'history-is-not-persistence',
      statement:
        'The server receives immutable encoded trusted publication bytes and never receives private Factory History or a CoreRawData autosave snapshot.',
      stepIds: [
        'hydrate-core-checkpoint',
        'settle-local-publication',
        'recover-pending-publications',
        'sequence-live-publication'
      ],
      artifactIds: [
        'artifact:document-shared-publication',
        'artifact:recoverable-pending-publication',
        'artifact:sequenced-document-publication'
      ],
      specRefs: [
        '#canonical-publication-boundary',
        '#ownership-and-forbidden-boundaries'
      ]
    },
    {
      id: 'trusted-publication-is-admitted-once',
      statement:
        'Scene Tree and Props admit the original local mutation once; Factory publication, socket relay, remote apply, and backend materialization do not repeat recursive product-payload schema validation.',
      stepIds: [
        'settle-local-publication',
        'sequence-live-publication',
        'apply-live-publication',
        'materialize-backend-document'
      ],
      artifactIds: [
        'artifact:document-shared-publication',
        'artifact:sequenced-document-publication',
        'artifact:durable-document-checkpoint'
      ],
      specRefs: [
        '#canonical-publication-boundary',
        '#socket-sequencing-and-live-fan-out',
        '#backend-materialization'
      ]
    },
    {
      id: 'unaccepted-publication-is-recoverable',
      statement:
        'Every unaccepted local document publication is retained in App-owned IndexedDB order, survives connection loss, and is removed only after matching socket acceptance.',
      stepIds: [
        'settle-local-publication',
        'recover-pending-publications',
        'sequence-live-publication'
      ],
      artifactIds: [
        'artifact:document-shared-publication',
        'artifact:recoverable-pending-publication',
        'artifact:source-publication-acceptance'
      ],
      specRefs: [
        '#connection-local-outbox-and-notifications',
        '#acknowledgement-and-failure-semantics',
        '#product-cases'
      ]
    },
    {
      id: 'fixed-window-not-debounce',
      statement:
        'The first dirty publication starts a fixed three-second deadline that later activity cannot postpone.',
      stepIds: ['flush-persistence-window'],
      artifactIds: ['artifact:document-persistence-flush-batch'],
      specRefs: ['#three-second-persistence-window', '#product-cases']
    },
    {
      id: 'ordered-idempotent-durability',
      statement:
        'Socket and backend advance only one contiguous document sequence, and retry never applies a batch or publication twice.',
      stepIds: [
        'sequence-live-publication',
        'flush-persistence-window',
        'materialize-backend-document'
      ],
      artifactIds: [
        'artifact:sequenced-document-publication',
        'artifact:document-persistence-flush-batch',
        'artifact:durable-sequence-acknowledgement'
      ],
      specRefs: [
        '#socket-sequencing-and-live-fan-out',
        '#backend-materialization',
        '#acknowledgement-and-failure-semantics'
      ]
    },
    {
      id: 'ephemeral-state-never-persists',
      statement:
        'Selection, Awareness, computed projection, Render/UI state, diagnostics, and transport-only evidence never enter the document persistence stream.',
      stepIds: ['settle-local-publication', 'materialize-backend-document'],
      artifactIds: [
        'artifact:document-shared-publication',
        'artifact:durable-document-checkpoint'
      ],
      specRefs: [
        '#canonical-publication-boundary',
        '#ownership-and-forbidden-boundaries'
      ]
    }
  ]

  const acceptanceContracts = [
    {
      id: 'bootstrap-session-contract',
      title: 'Socket bootstrap is complete before authoritative reconciliation',
      assertions: [
        'One Actor and multiple Actors use the same mandatory handshake.',
        'Checkpoint sequence N plus pending tail N+1..M produces a synchronized socket client at M.',
        'Live M+1 cannot overtake bootstrap consumption.',
        'Disconnected or failed bootstrap sessions remain locally editable and make no remote-load claim.'
      ],
      stepIds: [
        'open-document-session',
        'hydrate-core-checkpoint',
        'apply-bootstrap-tail'
      ],
      specRefs: [
        '#session-activation',
        '#bootstrap-and-load-handshake',
        '#product-cases'
      ]
    },
    {
      id: 'publication-and-undo-contract',
      title: 'Canonical changes, not undo History, cross the socket',
      assertions: [
        'The permanent toolbar Reset is the one standalone stored-file DELETE exception: it replaces the current checkpoint with the formal empty document when the backend is available and always refreshes after the request attempt settles, including when a storage-free demo has no backend, without entering Core, Feature System, transactions, History, CRDT, Selection, Factory publication, or Collaboration. crdt-7076-sample otherwise uses the same socket session and publishes only after Actor A submits its exact HTTP action-batch request.',
        'Transaction-end, immediate, Undo, Redo, and compensation publications preserve existing Factory semantics.',
        'One canonical owner admission produces trusted publication data; transport and receivers do not recursively revalidate its product payload.',
        'Selection-only transactions produce no document publication.',
        'Remote apply creates no receiving Undo, browser save, or echo; an unexpected atomic failure advances no sequence and requires authoritative resynchronization.',
        'No full document snapshot is captured merely because a transaction commits.'
      ],
      stepIds: [
        'settle-local-publication',
        'recover-pending-publications',
        'sequence-live-publication',
        'apply-live-publication'
      ],
      specRefs: [
        '#canonical-publication-boundary',
        '#product-cases',
        '#definition-of-done'
      ]
    },
    {
      id: 'offline-recovery-contract',
      title:
        'Connection loss does not interrupt local editing or lose pending publications',
      assertions: [
        'Connected and disconnected local publications enter the same durable App outbox.',
        'One disconnected epoch and one successful reconnect produce at most one toast each; per-publication failures remain console-only.',
        'Reconnect attempts are non-overlapping and occur no more than once every 30000 ms.',
        'Reconnect loads the latest authoritative state and applies peer plus accepted local recovery publications in server sequence.',
        'Quota failure retains explicit evidence and never silently evicts an unaccepted publication; an unexpected apply failure restarts authoritative reconciliation.'
      ],
      stepIds: [
        'open-document-session',
        'recover-pending-publications',
        'sequence-live-publication',
        'apply-live-publication'
      ],
      specRefs: [
        '#connection-local-outbox-and-notifications',
        '#bootstrap-and-load-handshake',
        '#product-cases',
        '#definition-of-done'
      ]
    },
    {
      id: 'three-second-durability-contract',
      title: 'Three-second batching has explicit cadence and retry semantics',
      assertions: [
        'The default flush deadline is 3000 ms and only 1000..3000 ms is valid.',
        'Continuous activity never restarts the active dirty deadline.',
        'Backend failure retains the same batch and blocks later sequence overtaking.',
        'The socket retains and retries exact opaque encoded publication bytes without product-payload decode or re-encode.',
        'Server admission stops before its bounded pending policy is violated while browser editing and outbox retention continue.',
        'With a healthy backend, socket-crash exposure for already accepted publications is the active three-second window plus request latency; a hard outage bound requires a durable server outbox.'
      ],
      stepIds: [
        'sequence-live-publication',
        'flush-persistence-window',
        'materialize-backend-document'
      ],
      specRefs: [
        '#three-second-persistence-window',
        '#acknowledgement-and-failure-semantics',
        '#product-cases'
      ]
    },
    {
      id: 'large-document-performance-contract',
      title:
        'Persistence work is independent from full document size per action',
      assertions: [
        'Selection performs no persistence capture or request.',
        'Undo and Redo transport only their actual canonical publications.',
        'The browser does not clone, stringify, or PUT the complete document after action settlement.',
        'Server batching does not block browser property-panel or Render projection.'
      ],
      stepIds: [
        'hydrate-core-checkpoint',
        'settle-local-publication',
        'flush-persistence-window'
      ],
      specRefs: ['#product-cases', '#definition-of-done']
    }
  ]

  const data = {
    schema: { id: 'flow-inspector', version: 2 },
    target: {
      id: 'asyra-design-socket-authoritative-document-persistence',
      kind: 'system',
      title: 'Design App Socket-Authoritative Persistence Inspector',
      subtitle:
        'Mandatory socket bootstrap, canonical publication sequencing, fixed-window batching, and backend materialization.'
    },
    authority: {
      specPath,
      inspectorPath,
      semanticOwner: 'Design App document-session product contract',
      inspectorOwner:
        'Design App socket sequencing and backend persistence architecture'
    },
    links: [
      {
        id: 'product-contract',
        kind: 'authority',
        label: 'Socket document-session specification',
        href: '../specs/socket-authoritative-document-session.md'
      },
      {
        id: 'implementation-plan',
        kind: 'plan',
        label: 'Trusted publication and CRDT 7,076 realignment plan',
        href:
          './completed/trusted-publication-and-crdt-7076-flow-realignment-plan.md'
      },
      {
        id: 'factory-collaboration-inspector',
        kind: 'upstream-inspector',
        label: 'Canonical projection and collaboration Inspector',
        href: '../../../framework/plans/canonical-projection-and-collaboration-contract-flow-inspector.data.cjs'
      }
    ],
    lanes,
    steps,
    routes,
    artifacts,
    invariants,
    acceptanceContracts
  }

  Object.freeze(data.schema)
  Object.freeze(data.target)
  Object.freeze(data.authority)
  data.links.forEach(Object.freeze)
  data.lanes.forEach(Object.freeze)
  data.steps.forEach((step) => {
    ;[
      'inputs',
      'outputs',
      'conditions',
      'bypasses',
      'allowedContributors',
      'forbiddenContributors',
      'cacheDimensions',
      'implementationBoundary',
      'specRefs'
    ].forEach((field) => Object.freeze(step[field]))
    Object.freeze(step)
  })
  data.routes.forEach((route) => {
    Object.freeze(route.producedArtifacts)
    Object.freeze(route)
  })
  data.artifacts.forEach((artifact) => {
    Object.freeze(artifact.consumerStepIds)
    Object.freeze(artifact)
  })
  data.invariants.forEach((invariant) => {
    Object.freeze(invariant.stepIds)
    Object.freeze(invariant.artifactIds)
    Object.freeze(invariant.specRefs)
    Object.freeze(invariant)
  })
  data.acceptanceContracts.forEach((contract) => {
    Object.freeze(contract.assertions)
    Object.freeze(contract.stepIds)
    Object.freeze(contract.specRefs)
    Object.freeze(contract)
  })
  Object.freeze(data.links)
  Object.freeze(data.lanes)
  Object.freeze(data.steps)
  Object.freeze(data.routes)
  Object.freeze(data.artifacts)
  Object.freeze(data.invariants)
  Object.freeze(data.acceptanceContracts)
  Object.freeze(data)

  globalThis.FLOW_INSPECTOR_DATA = data
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = data
  }
})()
