# Socket-Authoritative Document Persistence Plan

## Status

Completed on 2026-08-04 after product-owner closeout. Product direction was
accepted on 2026-08-03 and the durable browser-recovery decisions were accepted
on 2026-08-04. Slices 1–10 are implemented and passed their focused unit,
server, browser, build, and contract gates. Slice 7
(`settle-local-publication`) required no Factory production change because the
existing publication contract passed its formal gates.

Final outcome: Asyra Design now uses one socket-authoritative document-session
path with Core load-only ownership, Factory `SharedPublication`, an App-owned
durable unaccepted-publication outbox, a fixed 30-second reconnect cadence, a
fixed three-second server persistence window, and ordered backend
materialization. The temporary `crdt-7076-sample` Reset remained the sole
non-production bypass in the original 2026-08-04 closeout. That exception was
superseded on 2026-08-05: the sample now uses the ordinary socket document
session, has no Reset, and receives prepared data only through Actor A's exact
HTTP action-batch request.

Semantic authority:
`../../specs/socket-authoritative-document-session.md`.

Architecture authority:
`../socket-authoritative-document-persistence-flow-inspector.data.cjs`.

The public deployment runs the same full-stack client path as every ordinary
document. It deploys no socket server or backend, so the ordinary handshake
fails, local editing continues through the ordinary pending-publication
outbox, and the App reports the disconnected transition once. This is not a
separate frontend-only document mode. `crdt-7076-sample` now uses that same
socket composition and recovery outbox; its generated compressed document is
retained only as a regression asset. A developer who clones the repository
must be able to start the frontend, socket server, and persistence backend
locally to exercise the full formal flow.

## Goal

Replace Core-triggered full-document autosave and browser document writes with
one mandatory socket document-session flow:

```text
socket bootstrap load
-> Core canonical load + pending-tail apply
-> Factory SharedPublication
-> App durable unaccepted-publication outbox
-> socket sequence and live fan-out
-> fixed three-second persistence batch
-> backend ordered materialization
-> durable-sequence acknowledgement
```

This plan implements the production direction explicitly authorized after the
documentation-only cancellation recorded in
`durable-collaboration-server-and-continuous-sync-plan.md`. That
completed file remains historical and must not be edited or silently reopened.

## Root Cause and First Incorrect Owner

Profiling the checked-in 7,076-element sample found:

- uncompressed persisted JSON is about 88 MB;
- selecting an element, Undo, and Redo each spend roughly 0.85–0.89 seconds in
  Core persistence capture before the browser can visibly update;
- deep snapshot detachment accounts for roughly 0.58–0.62 seconds;
- the App then serializes and sends the same full document, taking another
  roughly 1.2–1.3 seconds in the measured unavailable-backend path; and
- Factory shared publication and UI projection are sub-millisecond in the same
  actions.

The first incorrect owner contract is Core's unconditional interpretation of a
committed `action`/`undo`/`redo` status as a request to capture and queue one
complete `CoreRawData` snapshot. Transaction settlement is not inherently a
persistence snapshot boundary.

The repair must remove that ownership. It must not hide the cost with delayed
snapshot cloning, debounce, a selection exception, a file-size threshold, or a
second App autosave path.

## Bounded Task Contract

### Authorized implementation scope after explicit implementation approval

- `@asyra/core`
  - remove commit-triggered snapshot capture/provider save ownership;
  - retain canonical load and explicit serialization as distinct operations;
  - replace full persistence-provider startup coupling with one load-only
    bootstrap boundary.
- `@asyra/factory`
  - preserve one existing immutable `SharedPublication` output;
  - expose no undo History entry or parallel persistence artifact.
- `@asyra/collaboration`
  - preserve provider-neutral publication transport and separate Awareness;
  - make only contract changes required for the App provider's accepted
    sequence/handshake handoff without adding App backend policy.
- Asyra Design:
  - startup/document-session lifecycle;
  - App-owned native IndexedDB outbox for unaccepted publications;
  - connection/sync state, transition notifications, and fixed reconnect
    scheduling;
  - collaboration protocol, worker codec, Provider, App publication processor,
    and server;
  - server/backend document persistence adapter;
  - removal of the old browser document-persistence path and its direct
    consumers;
  - explicit exclusion of the temporary `crdt-7076-sample`
    save-empty-then-refresh demo Reset from the formal document session;
  - focused unit, server, integration, E2E, reconnect, failure, and performance
    tests.
- Directly affected framework/App docs, plan, Inspector, and decision history.

### Behavior that must remain unchanged

- Scene Tree and Props remain canonical document owners.
- Factory remains the only transaction, History, rollback, shared-delivery, and
  `SharedPublication` settlement owner.
- One intended action remains one intended undo commit even when it emits
  several immediate publications.
- Undo/Redo use existing inverse/forward replay and send only actual canonical
  publications.
- Accepted remote apply remains non-undoable and suppresses outbound echo.
- Computed data, Selection, Awareness, Render/UI state, and diagnostics remain
  non-document data.
- Core load migration, validation/fallback, one-shot owner apply artifacts, and
  load diagnostics remain authoritative.
- Collaboration remains provider-neutral; App/server policy does not move into
  the generic package.

### Explicit exclusions

- Browser storage of materialized Core snapshots, private Undo History, remote
  publications, Selection, Awareness, or Render/UI projection.
- A second canonical document store or direct browser backend write disguised
  as the transport-recovery outbox.
- A new third-party database, queue, binary, package, or runtime dependency
  without separate user approval.
- Authentication-provider selection, account UI, billing, backup product
  policy, or deployment-vendor choice. The document-session authorization
  boundary is required, but its external identity provider remains replaceable.
- Adding a socket or backend deployment to the public deployment. The public
  deployment still executes the ordinary full-stack client path and must not
  gain browser persistence or a frontend-only document fallback when its
  production services are unavailable. This exclusion does not apply to the
  repository's documented local full-stack workflow.
- General local-only document modes. `crdt-7076-sample` is the only bounded
  exception and exists solely for the bundled AI Agent simulation.
- General CRDT conflict-policy redesign beyond the existing App publication
  decision boundary. This plan defines only server-sequence property ordering,
  canonical structural validation, and retained rejection records required for
  outbox reconciliation.
- Awareness/presence UI.
- Unrelated transaction, History, collaboration, render, or property-panel
  refactors.
- Compatibility fallback that leaves current snapshot autosave reachable.

### Stop conditions

- The implementation requires a second persistence path or browser snapshot
  write.
- A required publication cannot be represented by the existing
  `SharedPublication` without exposing private History evidence.
- The backend cannot share the App publication decoder and would need an
  independently maintained route/payload interpretation.
- The outbox would need to silently evict, overwrite, or expire an unaccepted
  publication.
- Reconnection cannot produce one server-assigned order for checkpoint/tail,
  peer publications, and accepted local recovery publications.
- The product specification and Inspector disagree on owner, sequence,
  acknowledgement, load cutoff, or failure semantics.
- A third-party dependency or runtime/tool upgrade becomes necessary without
  explicit approval.

## Target Public Contracts

### Load-only Core boundary

Core owns raw checkpoint migration, package validation/fallback, and canonical
apply. It does not own socket connection, persistence batching, backend retry,
or durable acknowledgement.

The implementation must replace Core's read/write persistence composition with
one explicit load-only input selected during App startup. `core.save()` may
remain as explicit document serialization for export/diagnostics/tests, but it
must not be invoked by transaction commit or presented as durability.
Core-to-Factory `persistence-*` reporting leaves the production path; App
document-session status owns accepted and durable sequence watermarks.

### Sequenced publication

The server persistence unit wraps, but does not rewrite, the existing
`SharedPublication`:

```ts
interface SequencedDocumentPublication {
  readonly documentId: string
  readonly sequence: number
  readonly publication: SharedPublication
}
```

The exact final type name may follow repository naming standards, but it must
preserve this semantic shape. It is not a Factory History artifact.

### Persistence flush batch

```ts
interface DocumentPersistenceBatch {
  readonly protocolVersion: number
  readonly batchId: string
  readonly documentId: string
  readonly expectedDurableSequence: number
  readonly firstSequence: number
  readonly lastSequence: number
  readonly entries: readonly SequencedDocumentPublication[]
}
```

The backend response returns the highest contiguous durable sequence. Retry
uses the same batch and publication identities.

### Bootstrap result

```ts
interface DocumentSessionBootstrap {
  readonly document: unknown
  readonly durableSequence: number
  readonly headSequence: number
  readonly pending: readonly SequencedDocumentPublication[]
}
```

The final wire representation may remain compact/binary, but it must preserve
the exact checkpoint/tail/cutoff semantics and validation boundary.

### Local recovery outbox

```ts
interface PendingDocumentPublication {
  readonly fileId: string
  readonly localSequence: number
  readonly publication: SharedPublication
  readonly state: 'pending' | 'conflicted'
  readonly failureReason?: string
}
```

`localSequence` is an IndexedDB-assigned file-local append order that can span
multiple tabs. `publication.publicationId` remains the socket dedupe identity.
The App may refine the storage type internally, but it must not store a complete
Core document or private History evidence. Pending records are removed only
after matching socket acceptance. Conflicted records remain retained until an
explicit future review/export/discard action; this plan does not add that UI.

## Formal Flow Policy

### Persistence cadence

- `DOCUMENT_PERSISTENCE_FLUSH_INTERVAL_MS = 3000`.
- Policy validation accepts only `1000..3000`.
- The first pending publication starts a fixed deadline.
- Later publications join without resetting the deadline.
- Count/byte thresholds and graceful shutdown may flush early.
- One document has at most one in-flight persistence request.
- Backend failure retains and retries the same contiguous batch.

### Accepted loss

An unexpected socket-process failure may lose the in-memory tail after the last
durable sequence. With a healthy backend, the normal exposure is the active
three-second window plus persistence-request latency. Three seconds is not a
hard bound during a backend outage. Publications that did not receive socket
acceptance remain in the originating browser outbox. If the server cannot
admit more work without violating its bounded pending policy, it stops
accepting new sources; the browser continues local editing and retains those
publications. A hard three-second guarantee for already accepted publications
across simultaneous backend and socket failure requires a separately approved
durable server outbox/WAL.

### Editing availability

The socket handshake is required for authoritative remote load, not for local
editing availability. An ordinary file with no successful handshake operates
from its formal provisional initial document and must not claim that remote
content loaded. Connected and disconnected local publications use the same
App-owned IndexedDB outbox and are removed only after matching socket
acceptance.

Connection and sync are separate states. Initial failure or later disconnect
emits one toast per disconnected epoch; a successful reconnection emits one
toast for that epoch. Repeated publication/send/write failures are console and
diagnostic events only. Pending count and sync state use a quiet persistent
surface. While disconnected, the lifecycle schedules one non-overlapping
reconnect attempt every `30000 ms`.

IndexedDB is a transport-recovery journal, not browser document persistence. It
stores immutable unaccepted `SharedPublication` values in file-local append
order and no complete document. Browser quota or storage denial moves the
session to `storage-failed`, preserves pending work in the current in-memory
queue when possible, and produces at most one transition notification. No
older pending entry is dropped to make room.

## Inspector Execution Slices

Every implementation segment must create its Step Execution Card from
`../socket-authoritative-document-persistence-flow-inspector.data.cjs` before
editing. Work on only one owner step per segment.

### Slice 1 — `materialize-backend-document`

Execution status: complete on 2026-08-03. The App-owned backend service,
shared publication decoder, idempotency boundary, and test middleware handoff
exist; later socket slices still own production queueing and runtime wiring.

First add backend contract tests that fail on the current whole-document-only
endpoint:

- accept one ordered publication batch;
- enforce expected durable sequence and contiguous entry sequences;
- deduplicate batch/publication retry;
- apply every publication in order through the shared App decoder;
- keep publication boundaries atomic;
- acknowledge only the highest contiguous durable sequence;
- reject invalid channels/payloads before document mutation.

Then implement the App-owned backend adapter without selecting or installing a
new database dependency.

Focused gates:

- App backend unit/integration tests;
- document database middleware tests;
- TypeScript build for the server boundary.

### Slice 2 — `sequence-live-publication`

Execution status: complete on 2026-08-03. The App socket server now validates
complete document publications through the shared App decoder, assigns one
room-owned monotonic sequence, records the pending publication before source
acceptance, excludes the sender from ordered fan-out, and deduplicates exact
publication retries. Wire protocol version 2 carries the assigned sequence on
peer frames and returns `acceptedSequences` only after server acceptance;
source-frame credit and backend durability remain separate acknowledgements.

First add server tests for:

- one sequence per accepted publication;
- retransmission idempotency;
- one total order across two Actors;
- source acceptance distinct from peer apply and durability;
- no Selection/Awareness publication in the document sequence;
- sender exclusion and ordered peer fan-out.

Then add the document sequencer and accepted-sequence protocol response.

Focused gates:

- collaboration server tests;
- protocol/codec tests;
- server build.

### Slice 3 — `flush-persistence-window`

Execution status: complete on 2026-08-03. A server-owned queue starts one fixed
3000 ms dirty deadline, validates the 1000–3000 ms policy range, flushes early
on count/byte/session-release/shutdown policy, and permits only one in-flight
batch per document. It retains the same frozen batch identity across backend
failure, blocks new publication allocation while durability is unavailable,
drains the already accepted tail in order, and advances only on an exact
contiguous durable acknowledgement. The socket backend origin is explicit
server configuration and is not derived from the frontend `APP_URL`.

First add fake-timer/server tests for:

- first dirty item starts a three-second fixed deadline;
- continuous input does not reset that deadline;
- invalid intervals below one second or above three seconds reject;
- count/byte limits flush early;
- one in-flight batch per document;
- later entries remain in the next batch;
- backend failure retries the same batch without overtaking;
- admission stops before the bounded pending policy is violated while clients
  retain later local publications in their recovery outboxes;
- durable watermark advances only on contiguous acknowledgement;
- graceful shutdown attempts an early flush.

Then implement the server-owned queue and backend handoff.

Focused gates:

- server queue unit tests;
- backend failure/retry integration tests;
- bounded timing tests with fake clocks, not wall-clock sleeps.

### Slice 4 — `open-document-session`

Execution status: complete on 2026-08-03. The protocol, socket server, backend
checkpoint reader, and App provider now expose one gap-free checkpoint/tail
bootstrap through a fixed head cutoff. The server queues post-cutoff live
publications until explicit browser bootstrap completion, and reconnect opens a
fresh bootstrap. Core hydration remains owned by Slice 5 and bootstrap-tail
apply remains owned by Slice 6.

First add protocol/provider tests proving:

- the handshake returns checkpoint, durable/head sequences, and exact pending
  tail;
- publications accepted after the cutoff cannot overtake bootstrap;
- one Actor and two Actors use the same path;
- a missing checkpoint yields the formal initial document at sequence zero;
- reconnect returns a fresh bootstrap rather than assuming live-only recovery.

Then implement the socket bootstrap boundary and App lifecycle preparation.

Focused gates:

- protocol and Provider tests;
- collaboration lifecycle tests;
- collaboration server tests.

### Slice 5 — `hydrate-core-checkpoint`

Execution status: complete on 2026-08-03. Core no longer subscribes to Factory
commit capture, builds automatic snapshots, calls provider writers, or reports
file durability through transaction status. `setLoadSource(...)` is the
read-only startup surface; `setPersistence(...)` temporarily delegates only to
that load boundary for existing browser composition. Explicit `core.save()`
remains detached and side-effect free. Full Core load-validation tests remain
green.

This is the canonical Core ownership correction.

The strengthened Core persistence regression tests prove:

- committed action, Undo, Redo, and selection do not capture or clone
  `CoreRawData`;
- no provider save is subscribed to commit capture;
- checkpoint load still runs the full migration/validation/apply contract;
- explicit serialization remains detached and side-effect free;
- runtime commit and server durability remain separate observations.
- Factory transaction status does not receive file-scoped backend durability
  reports.

Core commit-triggered autosave is removed and the load-only startup boundary is
active. Do not add a deferred or debounced full snapshot.

Focused gates:

- `@asyra/core` tests/build;
- `@asyra/factory` transaction/publication tests;
- direct public API/type consumers.

### Slice 6 — `apply-bootstrap-tail`

Execution status: complete on 2026-08-03. The App publication processor now
preflights the complete bootstrap tail for an exact contiguous sequence,
duplicate publication identities, and supported document routes before any
apply. It then applies each publication once and in order through the ordinary
remote canonical owner. Provider completion and startup activation remain
owned by Slice 8.

First add App tests proving checkpoint load followed by exact ordered tail apply
reaches `headSequence`, suppresses undo/echo/browser save, and rejects
gap/duplicate/out-of-order bootstrap data before edit readiness.

Then reuse the App's canonical publication decoder and remote transaction path
for bootstrap tail application.

Focused gates:

- App publication-processor tests;
- startup lifecycle tests;
- load validation tests.

### Slice 7 — `settle-local-publication`

Execution status: verified complete on 2026-08-03 with no production change.
The existing Factory contract already covers transaction-end and immediate
delivery, Undo/Redo replay, rollback compensation, detached transport shape,
zero-mutation bypass, and App document-channel filtering. The focused Factory
and App adapter suites passed, so no second persistence artifact was added.

Confirm with formal Factory/App tests that the existing
`SharedPublication` already covers:

- transaction-end changes;
- multiple immediate publications inside one undo action;
- Undo inverse, Redo forward, and rollback compensation;
- immutable detached payloads;
- document-channel filtering;
- no private History evidence.

Modify Factory only if a failing formal contract proves a missing invariant.
Do not create a second persistence artifact.

Focused gates:

- `@asyra/factory` shared-publication and History tests;
- App collaboration adapter/action-publication tests.

### Slice 8 — `recover-pending-publications`

Execution status: complete on 2026-08-04. The App now retains every
unaccepted local document publication in one file-scoped IndexedDB outbox,
keeps the local runtime editable while disconnected, retries once per 30-second
interval without overlap, and reconciles checkpoint/tail plus pending locals
in server order. Matching acceptance removes one record; rejection,
storage failure, and transition notifications remain explicit without
operation-level toast spam.

First add App integration and E2E tests proving:

- every connected or disconnected local document publication enters the
  file-scoped IndexedDB outbox in append order;
- matching socket acceptance removes exactly that publication, while response
  loss retransmits the same identity and relies on server dedupe;
- initial connection failure and later disconnect leave editing available;
- one disconnected epoch emits one toast, repeated send failures stay in the
  console, and retries occur no more than once every 30 seconds;
- reconnect obtains the latest checkpoint/tail, submits pending publications
  in append order, and applies the resulting server sequence once;
- same-property conflicts follow server sequence, while invalid structural
  recovery publications become retained conflict records;
- storage quota/denial enters one `storage-failed` state without silently
  evicting pending entries; and
- reload can recover unaccepted publications without persisting private local
  Undo History or a Core snapshot.

Then implement the App-owned outbox, recovery generation, connection/sync
state, transition notification policy, and reconnect scheduler. Generic
`@asyra/collaboration` remains live transport and receives no App recovery
policy.

Focused gates:

- App outbox and lifecycle unit tests;
- protocol/provider dedupe and recovery tests;
- disconnect/reload/reconnect E2E;
- storage-failure and conflict cases;
- App and collaboration-server builds.

### Slice 9 — `apply-live-publication`

Execution status: complete on 2026-08-04. Ordinary startup and reconnect use
the mandatory document session, sequenced peer publications apply through the
single App decoder/Factory remote transaction/Core canonical route, and the
browser owns no document save path or receiver echo.

First add E2E/integration tests proving:

- accepted remote publication applies once in sequence;
- it creates no receiver undo entry, browser save, or outbound echo;
- disconnect leaves the document editable and retains local publications;
- reconnect handshake restores checkpoint plus pending tail and reconciles the
  local outbox in server sequence;
- backend failure retains server pending work while connected clients continue
  to show the correct accepted live state, while unaccepted local work remains
  recoverable in the App outbox.

Then switch App startup to the mandatory document session and delete the old
browser document persistence path. This slice originally retained a temporary
`crdt-7076-sample` Reset; the 2026-08-05 superseding decision removed that
utility and routed the sample through the ordinary socket session.

Focused gates:

- App unit/integration tests;
- collaboration E2E;
- restart/reconnect and backend-unavailable cases;
- App and collaboration-server builds.

### Slice 10 — production-path performance and removal closure

Execution status: complete on 2026-08-04. Core commit capture and provider
autosave were removed, explicit serialization remains opt-in, browser
`PUT`/`DELETE` persistence was removed from the App, and action/Undo/Redo use
bounded Factory publications. The 7,076 fixture and full-stack browser gates
prove the removed snapshot path is not part of interaction settlement.

Run the 7,076-element document through the ordinary socket path and prove:

- selection triggers no document publication or persistence work;
- Undo/Redo send only bounded canonical publications;
- no action performs full-document clone/stringify for autosave;
- property-panel visibility is not blocked by snapshot capture;
- the three-second server flush is independent of browser render latency.

Delete current pre-release snapshot autosave, direct browser `PUT`/`DELETE`,
receiver-side save, local-only collaboration mode, and stale documentation.
Do not retain capability probes or fallback routes.

Focused gates:

- the formal 7,076-element performance E2E;
- ordinary and collaboration E2E suites;
- affected package/App builds and tests;
- `yarn lint:ci`;
- bounded docs/Inspector contract checks.

## Definition of Done

- Every implementation slice satisfies its exact Inspector step and formal
  tests before advancing.
- Every authoritative remote load uses one socket handshake.
- Single-Actor and multi-Actor sessions share one runtime path.
- Core performs no automatic full-document persistence work.
- Factory exposes only the existing minimal `SharedPublication`, never undo
  History.
- Socket sequence, acceptance, peer apply, and durable acknowledgement remain
  distinct.
- Factory transaction status ends at runtime settlement; App session status
  owns accepted and durable watermarks.
- The fixed dirty window defaults to three seconds, can be configured only
  between one and three seconds, and cannot be postponed by continuous input.
- Backend failure retries the same ordered batch; server admission stops before
  its bounded pending policy is violated, while browser editing and outbox
  retention continue.
- Bootstrap checkpoint plus tail is gap-free and races neither live delivery
  nor backend materialization.
- Every unaccepted local publication is durably retained without a full
  document snapshot, and reconnect reconciles it into one server-assigned
  sequence before removal.
- Connection loss/recovery produces one toast per transition epoch, repeated
  operation failures remain console-only, and retry uses a fixed 30-second
  cadence.
- Selection and ephemeral state cause no persistence.
- Current browser snapshot persistence and alternate paths are deleted.
- The public deployment follows the ordinary full-stack client path and reports
  its unavailable server once while local editing and outbox retention
  continue; `crdt-7076-sample` now follows that same socket path and receives
  its prepared drawing only after the exact HTTP action-batch request.
- A documented repository-local workflow starts the frontend, socket server,
  and persistence backend together for the complete formal flow.
- Formal unit, integration, E2E, failure, reconnect, and large-document
  performance gates pass.

## Current Documentation Slice

This documentation slice is complete when:

- this plan and the product specification state the accepted decisions;
- the Inspector records the exact owner flow;
- framework/App owner and API documents clearly distinguish current behavior
  from the accepted target;
- the completed plan indexes point to this canonical record;
- the completed cancellation record remains unchanged; and
- format, path, anchor, Inspector-structure, and bounded contradiction checks
  pass.
