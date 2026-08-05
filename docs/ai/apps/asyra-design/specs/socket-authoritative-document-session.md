# Socket-Authoritative Document Session and Persistence

> **Status: implemented active contract.**
> Backend materialization, socket sequencing, the fixed-window persistence
> queue, socket bootstrap, Core load-only boundary, bootstrap/live apply,
> durable local outbox, provisional offline editing, fixed reconnect scheduler,
> and reconciliation flow are active. Implementation is governed by
> `../plans/completed/socket-authoritative-document-persistence-plan.md`.

## Purpose

Asyra Design uses one mandatory socket document session for both
single-Actor and multi-Actor editing. The browser loads through a socket
handshake and publishes canonical document changes, while the socket server
owns ordering, live fan-out, persistence batching, retry, and durable-watermark
tracking. The browser does not save document snapshots.

This is the only production document flow. It replaces browser-to-document-
database writes rather than coexisting with them as a second autosave mode.

## Product Decisions

- A document is always opened through its socket session, including when only
  one Actor is connected.
- The public deployment runs the same full-stack client path as every ordinary
  document. Because that deployment does not provide the socket server or
  backend, its handshake fails, the App enters the disconnected state, and
  local editing continues through the same durable pending-publication path.
  The App reports the transition once rather than creating a separate
  frontend-only document mode.
- `crdt-7076-sample` uses this same full-stack client path. Actor A's exact
  image and instruction receive the checked-in prepared response through the
  same-origin HTTP action-batch interceptor; the response then executes through
  ordinary canonical and publication owners. Socket unavailability keeps the
  provisional local document and durable outbox active rather than selecting a
  sample-specific bootstrap.
- A developer who clones the repository can start the frontend, socket server,
  and persistence backend locally to use the complete formal document-session
  flow. This is the same production architecture exercised locally, not an E2E
  middleware shortcut or a separate persistence mode.
- Load is a socket handshake that combines a persisted checkpoint with the
  socket server's ordered, not-yet-materialized tail.
- The browser performs no document persistence write. It sends accepted
  canonical `SharedPublication` values to the socket server.
- The browser owns a durable transport-recovery outbox for local publications
  that have not received socket acceptance. This outbox is not a materialized
  document, a snapshot save path, or a second canonical state owner.
- The socket server flushes ordered persistence batches on a fixed three-second
  dirty window. The window may later be configured between one and three
  seconds, but never below one second.
- With a healthy backend, an unexpected socket-process failure may lose the
  accepted changes in the active three-second dirty window plus any in-flight
  request latency. Three seconds is the flush cadence, not a hard durability
  bound during backend outage.
- Backend request failure is not accepted data loss. The socket server retains
  and retries the same ordered batch until a contiguous durable acknowledgement
  advances.
- Selection, Awareness, Render/UI projection, diagnostics, local History
  internals, and other transient state never enter document persistence.

## Terminology

- **Publication**: the existing immutable Factory `SharedPublication`. It
  contains committed canonical document deliveries, not a local undo entry or
  full document snapshot.
- **Sequence**: the socket-server-assigned monotonically increasing document
  order for one accepted publication.
- **Head sequence**: the highest sequence accepted by the live document
  session.
- **Durable sequence**: the highest contiguous sequence acknowledged as
  materialized by the backend.
- **Checkpoint**: one backend-owned materialized document snapshot labeled with
  its durable sequence.
- **Pending tail**: accepted sequenced publications after the checkpoint's
  durable sequence and through the current head sequence.
- **Local outbox**: App-owned IndexedDB records containing immutable local
  `SharedPublication` values that have not received socket acceptance.
- **Connection state**: `connecting`, `connected`, `disconnected`, or
  `retrying`; this reports transport reachability only.
- **Sync state**: `synced`, `pending`, `reconciling`, `conflicted`, or
  `storage-failed`; this reports whether local publications remain recoverable
  and accepted by the socket.

## Session Activation

One non-empty `fileId` identifies the document, room, and persistence stream.
An authoritative remote load always uses the socket handshake. Socket
availability does not determine whether the already initialized local runtime
can accept canonical actions.

The production path has no local-only document mode. A one-Actor document and
a multi-Actor document use the same handshake, publication, sequencing,
broadcast, recovery-outbox, and persistence path.

The bundled `crdt-7076-sample` Agent flow remains inside that same document
path. No file identity may bypass the socket workflow because an endpoint is
absent or unavailable. The sample has no direct compressed-document load,
localStorage Reset, or nullable Collaboration mode.

Before the first successful handshake, an ordinary file may operate from its
formal provisional initial document. It must not claim that remote content was
loaded. Every resulting local document publication enters the same durable
outbox and is reconciled when the authoritative session becomes available.

## Connection, Local Outbox, and Notifications

Every non-empty local document publication is appended to the App-owned
IndexedDB outbox before it is eligible for removal. The durable entry contains
the immutable `SharedPublication`, its publication identity, file identity,
and one file-local append order. It contains no Core snapshot, private Factory
History entry, Selection, Awareness, or Render/UI state.

The runtime commit remains independent from outbox I/O and socket acceptance.
If IndexedDB append fails, the App retains the publication in its current
in-memory recovery queue when possible, enters `storage-failed`, and reports
that transition once. It never evicts an older pending publication or claims
that an unrecorded publication is recoverable. Browser quota, user-cleared site
data, and browser storage eviction remain explicit recovery limits; the App
adds no destructive hard-cap or silent drop policy.

While disconnected:

- Core, Canvas, features, Undo, and Redo remain available;
- new local publications continue to enter the outbox in append order;
- one transition into a disconnected epoch produces at most one toast;
- publication-level skip/send/write failures go to the console and diagnostics
  only; and
- the App schedules at most one reconnect attempt every `30000 ms`, with no
  overlapping retry.

A successful transition from `disconnected` or `retrying` to `connected`
produces at most one reconnect toast for that epoch. Repeated connected,
disconnected, retry, publication-send, and acknowledgement events do not
produce repeated toasts. Pending count and sync state use a quiet persistent
status surface. A conflict or recovery-storage failure may produce one
additional transition notification because it requires user awareness.

The generic `@asyra/collaboration` package remains live transport and retains
no App outbox. The Asyra Design collaboration lifecycle, native IndexedDB
adapter, and socket protocol own this file-scoped recovery policy.

## Bootstrap and Load Handshake

The socket server owns one gap-free bootstrap boundary:

1. Authorize the Actor and reserve the document session identity.
2. Read the backend checkpoint and its durable sequence.
3. Capture the ordered pending tail through one head-sequence cutoff.
4. Return the checkpoint, durable sequence, pending tail, and head sequence as
   one bootstrap result.
5. Queue later live publications behind that cutoff until the browser confirms
   bootstrap consumption.

The browser then:

1. passes the raw checkpoint through the ordinary Core migration,
   validation/fallback, and canonical load path;
2. validates and applies each pending publication in sequence through the same
   app-owned remote canonical processor used for live publications;
3. submits durable local outbox publications in append order for validation,
   dedupe, and socket sequencing;
4. applies accepted local recovery publications and interleaved peer
   publications in the server-assigned sequence, without creating duplicate
   local History or outbound echo;
5. retains rejected publications as explicit conflict records rather than
   deleting or retrying them forever; and
6. consumes later live publications from the next sequence while new local
   actions enter the next outbox generation.

The browser must not independently `GET` a checkpoint and then connect a socket
without a revision handshake. That split would permit a publication gap between
the two operations.

Reconnection always obtains the latest checkpoint plus pending tail before
declaring reconciliation complete. The App may stage the rebuilt canonical
state while the current UI remains responsive, but it must serialize the final
canonical replacement and later actions so no local publication disappears or
applies twice.

An absent backend checkpoint produces the formal initial document at durable
sequence zero. Initial creation is part of the handshake contract, not a
browser `PUT`.

## Canonical Publication Boundary

Factory remains the only local transaction, History, rollback, and shared
settlement owner. The existing `SharedPublication` is the browser-to-socket
document-change unit:

- transaction-end changes produce the existing grouped publication;
- immediate shared changes may produce multiple ordered publications inside
  one outer undo action;
- Undo publishes the actual inverse canonical deliveries;
- Redo publishes the actual forward canonical deliveries; and
- rollback after an already published immediate change publishes the existing
  compensation publication.

The server never receives or reconstructs the private undo History entry.
History `before`/`after`, inverter evidence, and replace-latest staging metadata
remain client-local.

The App collaboration adapter admits only registered Scene Tree and Props
document channels. Selection and other non-document channels may remain local
transactions or local History behavior, but they do not enter the socket
document stream and cannot trigger persistence.

Every admitted local publication uses the same outbox route whether the socket
is connected or disconnected. Socket connection changes delivery timing, not
publication shape or transaction/History boundaries.

Accepted remote publications apply through one Factory remote transaction.
They create no receiving-client undo entry, browser persistence write, or
outbound echo.

## Socket Sequencing and Live Fan-Out

For each accepted publication, the socket server:

1. validates session identity, wire integrity, supported App document channels,
   and publication identity;
2. deduplicates a retransmission of an already accepted publication identity;
3. assigns exactly one next document sequence;
4. appends the sequenced publication to the document's pending persistence
   queue;
5. broadcasts it to the other connected Actors in that sequence order; and
6. acknowledges source acceptance with the assigned sequence.

Source acceptance means the socket owns the publication in its current
in-memory pending queue. It is distinct from backend durability. Peer apply
remains a separate observation and is also not durability.

The App removes a local outbox entry only after this source acceptance is
matched to the same publication identity. A response loss may cause
retransmission; server dedupe must return the existing sequence without
applying, persisting, or broadcasting the publication twice.

One document stream has one ordering authority. Horizontal deployment must
route a document to one sequencer or provide an equivalent single ordered
sequence service; two processes cannot assign independent sequence ranges.

## Three-Second Persistence Window

The first publication added to an empty pending queue starts a fixed
three-second deadline. Later publications join that same window and do not
restart its timer. This is periodic dirty-window batching, not debounce.

The socket server may flush before the deadline when:

- the configured publication-count limit is reached;
- the configured serialized-byte limit is reached;
- the server begins a graceful shutdown; or
- the document session is intentionally released.

There is at most one in-flight persistence request per document. Publications
accepted while a batch is in flight enter the next ordered batch.

The flush interval is a named server policy:

- default: `3000 ms`;
- permitted future tuning range: `1000–3000 ms`;
- values below `1000 ms` are invalid.

The interval controls the normal socket-crash exposure window. It does not
permit dropping a batch because the backend is slow or unavailable. A strict
three-second bound across simultaneous backend and socket failure would require
a durable socket outbox/WAL, which is outside this contract.

## Backend Materialization

The socket server sends one ordered persistence batch containing:

- document identity;
- stable batch identity;
- expected prior durable sequence;
- first and last sequence;
- ordered sequenced publications; and
- protocol/schema version.

The backend owns:

- request authorization at the server boundary;
- batch idempotency and publication-identity dedupe;
- contiguous sequence validation;
- App publication validation and conversion to canonical changes;
- ordered application to the existing materialized document;
- atomic publication boundaries;
- checkpoint/revision update; and
- acknowledgement of the highest contiguous durable sequence.

The browser and generic `@asyra/collaboration` package do not implement backend
merge policy. App-owned publication decoding must be shared by the live remote
processor and backend materializer so route/payload meaning is not duplicated
in two hand-maintained special implementations.

If one batch cannot be applied, the backend does not acknowledge a sequence
past the failure. The socket server retains the exact unacknowledged batch and
retries it with the same identities. Later batches cannot overtake it.

## Acknowledgement and Failure Semantics

The formal states are:

```text
runtime committed
-> locally retained for recovery
-> socket accepted at sequence N
-> peer applied (optional, per peer)
-> backend durable through sequence N
```

None of these states implies another.

- A local runtime commit is not socket acceptance.
- A successful local outbox append is recoverability on the current browser
  profile, not socket acceptance or backend durability.
- Socket acceptance is not peer apply or durability.
- Peer apply is not durability.
- Backend durability never retroactively changes the local undo result.
- Factory transaction status ends at runtime settlement. File-scoped socket
  acceptance and durable watermarks are App session observations, not
  `persistence-*` statuses retrofitted onto one local transaction.

On unexpected socket-process failure, only the checkpoint through the last
durable sequence is recoverable. Loss of the later in-memory tail within the
active three-second window is accepted product behavior.

On backend timeout, network failure, or non-success response, the socket keeps
the batch and retries without reordering or recreating publication identities.
If the server can no longer admit more publications without violating its
bounded pending policy, it stops accepting new source publications. The App
continues local editing and retains those publications in its durable outbox
until acceptance becomes available again. This does not turn the socket's
in-memory queue into durable storage.

For concurrent recovery, the socket sequence remains the final order.
Independent property updates remain independent; two accepted updates to the
same property resolve by later server sequence. Scene Tree and other structural
changes remain subject to their canonical owner invariants. A recovery
publication that cannot be validly applied is rejected before sequence
allocation, moved to `conflicted`, and retained with its failure reason for
review or export.

## Reset, Import, Export, and Serialization

- The App exposes no local-only Reset operation. `crdt-7076-sample` follows the
  same socket-authoritative document lifecycle and cannot store bootstrap state
  in localStorage or force a second startup route.
- Any future import must produce canonical document changes through the normal
  publication path. It cannot call a browser snapshot `PUT`, `DELETE`, or
  hidden save fallback.
- Explicit export may serialize the current Core document, but serialization is
  not persistence and must not register an automatic transaction subscriber.
- Core may retain an explicit snapshot serialization API for export,
  diagnostics, and tests. It must not automatically call it after commit.
- File creation and an absent-checkpoint initial document are owned by the
  socket/backend bootstrap contract.

## Ownership and Forbidden Boundaries

- `@asyra/factory`: local transaction, History, rollback, and immutable
  `SharedPublication` settlement; no backend durability status.
- `@asyra/core`: load migration/validation/apply and explicit serialization;
  no automatic persistence capture, queue, provider save, retry, or socket
  policy.
- `@asyra/collaboration`: provider-neutral live publication transport and
  Awareness; no App persistence policy or document materialization.
- Asyra Design collaboration lifecycle/provider/outbox: document-session
  handshake, connection and sync state, durable unaccepted-publication
  retention, fixed reconnect scheduling, reconciliation, accepted-sequence
  observations, and live transport.
- Asyra Design socket server: document sequencing, dedupe, fan-out, pending
  queue, three-second flush, retry, and durable-watermark tracking.
- App backend: canonical publication decoding, ordered materialization,
  idempotency, checkpoint storage, and durable acknowledgement.

Forbidden paths:

- Core full-document autosave on action, Undo, or Redo;
- browser `PUT`/`DELETE` persistence after startup;
- storing a materialized Core document or private Undo History in the local
  transport outbox;
- a second App autosave event or feature-specific save path;
- sending Factory undo History entries to the server;
- persisting Selection, Awareness, Render/UI projection, computed data,
  diagnostics, or transport-only metadata as document state;
- receiver-side save and publication echo;
- debounce that can postpone persistence indefinitely during continuous input;
- acknowledging past a failed or missing sequence;
- removing an outbox entry before matching socket acceptance;
- silently dropping, overwriting, or expiring an unaccepted publication; and
- repeated per-operation transport-failure toasts.

## Product Cases

1. **Single Actor**
   - One Actor opens a file through the socket handshake, edits continuously,
     and uses the same publication and three-second persistence flow as a
     multi-Actor room.
2. **Multiple Actors**
   - Concurrent accepted publications receive one total document order; every
     client and the backend observe that order.
3. **Selection-only transaction**
   - Selection and property-panel projection update without any document
     publication or persistence work.
4. **Undo and Redo**
   - Undo sends inverse canonical publications and Redo sends forward canonical
     publications; neither sends private History evidence or a full snapshot.
5. **Immediate pointer publications**
   - Multiple immediate publications may belong to one local undo action and
     remain distinct sequenced backend inputs.
6. **Continuous activity**
   - Continuous input cannot postpone a dirty flush beyond three seconds unless
     a prior batch is still in flight; later changes remain ordered in the next
     batch.
7. **Backend failure**
   - The same batch retries idempotently and later sequences do not overtake it.
8. **Load with pending tail**
   - A checkpoint at sequence `N` plus socket tail `N+1..M` yields a ready
     client at `M` with no gap, duplicate, or live-message race.
9. **Socket crash**
   - Restart recovers the backend checkpoint through the durable sequence. With
     a healthy backend, exposure is the active three-second window plus
     in-flight request latency. Publications not accepted before the crash
     remain in each originating browser outbox; already accepted, not-yet-
     durable server tail remains at risk until retry succeeds.
10. **Socket unavailable**
    - Local editing continues, each publication enters the durable outbox, one
      disconnected toast is emitted, repeated failures remain console-only,
      and reconnect attempts occur no more than once every 30 seconds.
11. **Reconnect with pending local publications**
    - The App obtains the latest authoritative checkpoint/tail, submits local
      publications in append order, applies the resulting server sequence once,
      and removes only publications acknowledged by identity.
12. **Concurrent conflict**
    - Same-property conflicts follow server sequence; invalid structural
      publications become retained conflict records and are not silently lost
      or retried forever.
13. **Recovery storage unavailable**
    - Local editing remains responsive, the current runtime retains pending
      publications when possible, one storage-failed transition is reported,
      and the App makes no recoverability claim after browser data loss.
14. **Large document**
    - Selection, Undo, and Redo do not serialize or clone the complete document
      merely to schedule persistence.

## Definition of Done

- The thin product contract and Flow Inspector agree on every owner, artifact,
  route, failure owner, bypass, and forbidden contributor.
- Core no longer captures or queues a complete snapshot from transaction commit
  status.
- The browser has no document persistence write or receiver-side save path.
- Every unaccepted local publication uses the App-owned IndexedDB outbox and is
  removed only after matching socket acceptance.
- The socket handshake loads checkpoint plus pending tail without a race.
- Initial failure and later disconnect leave local editing available, retry at
  a fixed 30-second cadence, and emit only transition-level notifications.
- Reconnect reconciles the latest server state and durable local publications
  into one server-assigned order, with explicit conflict and storage-failure
  states.
- Factory `SharedPublication` remains the one client change unit; no parallel
  persistence artifact contains undo History.
- The socket assigns one sequence, batches on a non-debounced three-second
  window, retries failures idempotently, and exposes accepted versus durable
  watermarks.
- The backend applies sequenced publications in order and returns a contiguous
  durable sequence.
- Selection and other non-document state never schedule persistence.
- Formal unit, integration, server, E2E, reconnect, failure, and large-document
  performance cases pass through the ordinary production path.
- Current snapshot persistence and non-durable alternate flows are removed
  rather than retained as compatibility fallbacks.
