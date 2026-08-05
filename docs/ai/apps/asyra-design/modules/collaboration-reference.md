# Collaboration Reference

> **Status: active socket-authoritative implementation.** The bundled socket
> server owns checkpoint/tail bootstrap, document sequence, live fan-out, and
> the fixed-window backend queue. The App owns durable unaccepted-publication
> recovery, fixed reconnect scheduling, and connection/sync state; backend
> durability remains a separate acknowledgement. See
> `../specs/socket-authoritative-document-session.md`.

## Purpose

Asyra Design includes a real two-window WebSocket collaboration composition.
It is open-source reference code, not a fake or alternate path. The browser
App, Provider, typed wire protocol, socket sequencer, and App backend use the
same publication transport and materialization contracts for one-Actor and
multi-Actor documents.

The reference proves live collaboration, disconnected local editing, durable
unaccepted-publication recovery, reconnect reconciliation, and ordered backend
materialization through ordinary App changes and remote canonical apply.

## Activation

`fileId` is required to open an App document:

```text
http://localhost:3000/?fileId=crdt-public-demo
```

It selects the App-owned document session identity and is the input the server
authorization boundary receives. The repository server accepts it without
authentication; a deployment may replace that adapter. It is not a
Collaboration toggle. A missing or empty `fileId` does not open a document
session.

RenderApp currently prepares Collaboration before Core for every ordinary
file. It uses `VITE_COLLABORATION_WS_URL` when configured and otherwise derives
same-origin `/collaboration`. Each page creates its own actor ID and uses it as
the canonical ID-counter namespace before collaborative element or property
creation. The socket returns one checkpoint plus exact pending tail; Core loads
the checkpoint and the App applies the tail before live activation. One Actor
and multiple Actors use this same path.

Core performs no commit-triggered document snapshot persistence. Manual
actions, Agent actions, Undo, and Redo produce Factory publications for the
socket sequence; accepted remote apply updates canonical state without a
receiver persistence save or echo. When the initial handshake fails, the App
starts from the formal provisional document, remains editable, stores local
publications in the outbox, and reconciles after a later handshake.

The browser endpoint comes from
`VITE_COLLABORATION_WS_URL`. The reference server validates the
request Origin against `APP_URL`; server host and port remain
separate environment settings because they identify a separate service.

## Publication Flow

```text
local app mutation
-> Factory immediate or transaction-end SharedPublication window
-> app channel filter (Scene Tree and Props)
-> Collaboration serial FIFO handoff
-> WebSocket Provider worker binary encoding
-> socket server validation, dedupe, document sequence, persistence enqueue
-> ordered frame fan-out with connected-Peer byte backpressure
-> receiving Provider worker decode and wire-credit return
-> Collaboration exclusive async app callback once
-> app validates and classifies the complete publication
-> one Factory runRemoteTransaction
-> one Core.applyCanonicalChanges(ordered CanonicalChange[])
-> Factory owner commit and one ordinary observer batch
-> local computed projection, Render, and UI
-> distinct peer-applied receipt
```

One Factory publication window remains one provider request, one receiving app
callback, one remote Factory transaction, and one Core canonical request. The
binary codec may split a large publication into ordered wire frames, but this
does not split or merge publication identity, App policy, canonical mutation,
or remote transaction semantics. Repeated routes and equal payloads remain
repeated app intent and are forwarded in order.

`SharedPublication.artifactId` is opaque wire-correlation metadata. It does not
reference a local History artifact, and Collaboration never receives the
source action's before/after, inverse, Undo, Redo, or rollback evidence.

Factory-produced undo, redo, and rollback compensation publications use the
same route. Collaboration does not require feature-specific transport flags;
the mutation owner decides `sharedDelivery` when it creates the canonical
change.

## App-Owned Processing

`src/collaboration/operations.ts` owns the current document contract:

- supported canonical Scene Tree add/remove/raw-element-data/move-elements/
  change-subtree routes;
- supported Props add/remove/update routes;
- explicit rejection of computed-data and computed-patch evidence because
  computed state is local Render/UI projection, not shared source data;
- payload validation for those routes;
- validation of every delivery before any remote mutation;
- an optional app-owned permission/domain-order/duplicate/conflict decision
  that may reject or transform a publication, followed by validation of the
  accepted result;
- classification into one ordered `CanonicalChange[]`;
- exactly one `runRemoteTransaction` and one
  `core.applyCanonicalChanges(...)` for the accepted publication.

An invalid or unsupported delivery rejects the whole publication before the
remote transaction begins. This is Asyra Design app policy, not
`@asyra/collaboration` policy.

Factory remote origin keeps accepted remote changes out of the receiving
user's ordinary local undo stack and suppresses a new outbound publication.
Owner evidence becomes visible to ordinary local observers only after Factory
owner finalization succeeds, as one ordered batch. The receiving browser
performs no persistence save. Rollback or owner-finalization failure exposes no
observer prefix.
The default reference policy accepts repeated hierarchy publications. Any
dedupe, last-write-wins, timestamp ordering, or concurrent hierarchy conflict
policy is an app/backend responsibility and is not added to Collaboration.

## Wire Protocol and Provider

Control messages use validated JSON text frames: hello/ready, request response,
failure/connection error, Awareness, source-frame admission,
`frame-consumed`, and `peer-applied`. Canonical `SharedPublication` data uses
only the versioned binary frame route; a JSON publication request is not a
second data path.

Generic Collaboration calls `sendPublication()`. The App lifecycle additionally
uses `sendPublicationWithAcceptance()` to correlate one source publication
identity with its server sequence before removing the matching outbox entry.
The Provider sends the publication object once to a Web Worker. The worker
validates and encodes ordered transferable `ArrayBuffer` frames with a 1 MiB
soft target; one indivisible record may exceed that target. Incoming
`ArrayBuffer` frames move to the worker for validation, ordered assembly, and
decode. The worker releases at most one publication to the main-thread app
consumer at a time.

Receiver diagnostics keep their owner spans distinct. Codec timing covers
binary decode, receive-to-dispatch covers socket admission through decoded
candidate readiness, and receiver-handoff starts only after that candidate is
ready and closes after the sole main-bound `publication-delivery` post
returns. Handoff timing therefore excludes codec and retained-queue time.

Wire credit and canonical apply completion are distinct. After a frame passes
worker header, order, duplicate, and capacity validation and the worker retains
its buffer, the worker immediately returns that exact frame's
`frame-consumed` credit; it does not wait for complete publication decode or
App apply. This lets one multi-frame publication finish crossing the server's
2 MiB Peer queue. If a decoded oversized publication temporarily fills the
retained assembly window while another App apply is active, later relayed
frames wait in a separate bounded ingress queue without fabricated credit and
drain in FIFO order after capacity is released. The receiver reports
`peer-applied` only after the App consumer settles the complete publication.
Sender acceptance therefore means the reference server admitted the current
frame set into bounded peer capacity; it does not mean a peer finished
canonical apply.

Neither wire boundary whitelists app channel, event names, or payload meaning;
App semantics remain in the app processor. WebSocket per-message compression
is explicitly disabled.

Disconnect rejects active transport requests. Reconnect creates a new socket
and opens a fresh authoritative checkpoint-plus-tail bootstrap; it does not ask
generic Collaboration for a state vector or semantic publication history.

## Reference Server

`collaboration-server.ts` owns one file-scoped room, sequencer, pending tail,
and persistence queue plus one session record per accepted socket. It:

- accepts the App-owned document session identity carried by the wire protocol;
- prevents two simultaneous connections from claiming the same actor in one
  file; each accepted socket owns its reservation until its own cleanup, and a
  rejected duplicate cannot release that reservation;
- validates versioned binary frames and App document publications before
  sequence allocation;
- assigns one monotonic document sequence, deduplicates publication identity,
  waits for bounded persistence-queue admission when necessary, appends the
  publication without changing sequence, and then fans it out in order;
- bounds each peer's queued publication bytes to 2 MiB while allowing one
  indivisible oversized frame;
- releases queued byte capacity only after the WebSocket send callback and the
  receiver's `frame-consumed` credit release; JSON control traffic remains
  independently deliverable;
- fans Awareness only to currently connected peers in the same file room;
- excludes sender echo;
- responds with source acceptance after sequence and persistence enqueue plus
  every current peer queue's bounded admission;
- flushes one fixed three-second dirty window to the App backend and retries an
  unacknowledged contiguous batch; and
- retains the not-yet-durable ordered tail needed by reconnect bootstrap.

If a peer disconnects, its old Peer queue receives no later live frames.
Reconnect creates a new Peer session and recovers through the latest backend
checkpoint plus exact socket pending tail before later live delivery.

This 2 MiB Peer queue is receiver-side live wire backpressure for a socket that
is still connected. `removePeer(...)` clears it when that socket disconnects.
It is not the accepted App recovery mechanism and never retains the
disconnected browser's local actions.

The active production flow adds a separate App-owned IndexedDB outbox before
this live transport boundary:

```text
Factory SharedPublication
-> App durable unaccepted-publication outbox
-> current live Provider/server path when connected
-> remove outbox entry only after matching source acceptance
```

The outbox stores only immutable local publications and file-local append
order. It stores no Core snapshot, private History, remote publication,
Selection, Awareness, or Render/UI projection. Generic
`@asyra/collaboration`, the Peer queue, and the backend checkpoint remain three
different owners.

Socket failure leaves local editing available. One
disconnected epoch emits one toast, repeated publication failures remain
console-only, and the App retries at most once every 30 seconds. Reconnect
loads the latest checkpoint/tail and reconciles the pending local publications
in server order. IndexedDB storage failure and invalid structural recovery
become explicit sync states; neither permits silent eviction.

The response to `send-publication` is socket source acceptance with its
assigned sequence. It does not prove peer canonical apply or backend
durability. `peer-applied` is a separate receipt and still does not represent
durable storage. An unexpected server restart may lose the accepted in-memory
tail after the latest backend durable sequence; the three-second window is the
accepted healthy-backend exposure.

The browser performs no canonical document save. The socket persistence queue
sends ordered publication batches to the App backend, which materializes the
checkpoint and returns a contiguous durable sequence.

## Awareness

Awareness is a separate ephemeral route for presence. Disconnect, leave, and
timeout remove remote observations. Awareness never carries element creation,
geometry, vector topology, Props changes, permission, save/load data, or undo
history.

The framework and reference transport already implement Awareness clocks,
validation, stale-message rejection, room fan-out, disconnect cleanup, and
timeout-capable state storage. An app can call
`collaboration.updateAwareness(state)`, observe
`collaboration.awareness.observe(...)`, query detached snapshots, explicitly
leave, and expire stale actors without creating a wire protocol.

The App currently does not define a presence schema or UI. A future app
developer still owns user display identity, document-space cursor coordinates,
selected element IDs, pointer throttling/coalescing, heartbeat and expiry
scheduling, privacy/authorization, and cursor/selection/online-user rendering.
These values remain ephemeral and must never become canonical authority.

## Remaining Production Deployment Responsibilities

The repository-local server/backend path does not yet define:

- user authentication or file permission lookup;
- production database/vendor selection, backup, or disaster recovery;
- complete outbox conflict review/export/discard UI;
- durable socket WAL for already accepted, not-yet-materialized publications;
- horizontal room coordination or operational monitoring.

A production app/backend owns these decisions. Asyra Design's implemented
document session defines socket-authoritative sequencing,
checkpoint-plus-tail load, an App-owned durable unaccepted-publication outbox,
a fixed 30-second reconnect cadence, transition-only notifications, a fixed
three-second persistence window, and backend materialization without changing
the generic framework transport contract.

A developer who clones the repository can run the frontend, socket server, and
included App backend to exercise the complete formal path. A deployment may
replace storage and authorization adapters without changing the frontend
document-session contract.

## Manual Test

1. Start the App backend:

   ```bash
   yarn workspace @asyra/asyra-design document:backend
   ```

2. Start the reference socket server:

   ```bash
   yarn workspace @asyra/asyra-design collaboration:server
   ```

   This command builds once and starts the server. After stopping it, restart
   the already-built server without touching build output:

   ```bash
   yarn workspace @asyra/asyra-design collaboration:server:start
   ```

3. Start the app on the configured app URL, commonly port 3000, and open the
   same required ordinary `fileId` URL in two windows. Both windows use the same
   authoritative document-session flow.
4. Verify create, delete, drag, drag-to-create, vector edits, undo, and redo.
   For pen drag-to-add, verify the peer receives the real point/segment on
   mouse-down and curve-handle changes during drag, before pointer-up.
5. Perform a local action, Undo, and Redo. Reload the originating browser and
   verify socket bootstrap restores the backend checkpoint plus pending tail
   without creating a duplicate collaboration publication.
6. Verify local selection/presence behavior separately from canonical document
   changes.
7. Disconnect one window, mutate the other, reconnect, and confirm the fresh
   checkpoint/tail bootstrap catches the returning window up before later live
   delivery.
8. After the accepted outbox slice is implemented, stop the socket, continue
   local actions/Undo/Redo, and verify one disconnect toast, console-only
   publication failures, 30-second retry, reload-safe pending entries, and
   server-order reconciliation after restart.

## Validation

```bash
yarn workspace @asyra/collaboration test:local
yarn workspace @asyra/asyra-design test:local
yarn workspace @asyra/asyra-design build:collaboration-server
yarn workspace @asyra/asyra-design test:e2e:collaboration
```

Current framework product contract:
`docs/ai/framework/plans/completed/canonical-projection-and-collaboration-contract-realignment-plan.md`.
