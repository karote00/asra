# Collaboration Reference

> **Status: non-durable development demo.** The bundled server is not a
> production backend. It retains no shared document history, and its successful
> response means live-memory acceptance rather than durable storage.

## Purpose

Asyra Design includes a real two-window WebSocket collaboration composition.
It is open-source reference code, not a fake or mock path. The browser app,
Provider, typed wire protocol, and memory-only server all use the same
publication transport contract available to product apps.

The reference proves live app collaboration behavior through ordinary app
changes and remote canonical apply. It intentionally does not implement the
production backend responsibilities listed below and must not be presented as
continuous recovery or production-safe shared storage.

## Activation

`fileId` is required to open an App document:

```text
http://localhost:3000/?fileId=crdt-public-demo
```

It selects the App-owned document session identity and will be the input a
future production server uses to authorize whether the user may open that file.
It is not a Collaboration toggle. A missing or empty `fileId` does not open a
document session.

RenderApp always starts Collaboration after the canonical document selected by
`fileId` is loaded. There is no separate local/non-Collaboration document route.
Each page creates its own actor ID and uses it as the canonical ID-counter
namespace before any collaborative element or property creation. When only one
Actor is connected, the same production path is classified as single-Actor
processing. When another Actor opens the same `fileId`, both Actors already
share its room and the path is classified as two-Actor CRDT processing. This
classification does not change Core, Factory, Render, or Collaboration APIs.

The demo creates no client persistence provider. Startup always loads a fresh
canonical empty document; local action, Undo, Redo, and remote apply perform no
client persistence capture, provider save, IndexedDB read, or IndexedDB write.
A future production socket server and backend database checkpoint policy remain
outside this memory-only demo.

The browser endpoint comes from
`VITE_ASYRA_DESIGN_COLLABORATION_WS_URL`. The reference server validates the
request Origin against `ASYRA_DESIGN_APP_URL`; server host and port remain
separate environment settings because they identify a separate service.

## Publication Flow

```text
local app mutation
-> Factory immediate or transaction-end SharedPublication
-> app channel filter (Scene Tree and Props)
-> Collaboration serial FIFO handoff
-> WebSocket Provider worker binary encoding
-> reference server opaque frame relay with byte backpressure
-> receiving Provider worker decode and wire-credit return
-> Collaboration exclusive async app callback once
-> app validates and classifies the complete publication
-> one Factory runRemoteTransaction
-> one Core.applyCanonicalChanges(ordered CanonicalChange[])
-> Factory owner commit and one ordinary observer batch
-> local computed projection, Render, and UI
-> distinct peer-applied receipt
```

One Factory publication remains one provider request, one receiving app
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
user's ordinary local undo stack, suppresses a new outbound publication, and
captures or writes no client persistence snapshot. Owner evidence becomes
visible to ordinary local observers only after Factory owner finalization
succeeds, as one ordered batch. Rollback or owner-finalization failure exposes
no observer prefix.
The default reference policy accepts repeated hierarchy publications. Any
dedupe, last-write-wins, timestamp ordering, or concurrent hierarchy conflict
policy is an app/backend responsibility and is not added to Collaboration.

## Wire Protocol and Provider

Control messages use validated JSON text frames: hello/ready, request response,
failure/connection error, Awareness, source-frame admission,
`frame-consumed`, and `peer-applied`. Canonical `SharedPublication` data uses
only the versioned binary frame route; a JSON publication request is not a
second data path.

`sendPublication()` is the Provider's only public publication send method.
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

Wire credit and canonical apply completion are distinct. The worker may admit
later frames into its exact retained-byte window while one publication is
active, but it returns each publication's `frame-consumed` credits only when
that ordered publication leaves the retained window for the exclusive async
App handoff. Those credits are sent before that App apply begins and do not
depend on whether it later succeeds. Queued publications expose no fabricated
capacity. The receiver reports `peer-applied` only after the App consumer
settles the complete publication. Sender acceptance therefore means the
reference server admitted the current frame set into bounded peer capacity; it
does not mean a peer finished canonical apply.

Neither wire boundary whitelists app channel, event names, or payload meaning;
App semantics remain in the app processor. WebSocket per-message compression
is explicitly disabled.

Disconnect rejects pending requests. Reconnect creates a new live socket and
does not request a state vector or publication history.

## Reference Server

`collaboration-server.ts` uses `MemoryHub` and one `MemoryProvider` per accepted
socket. It:

- accepts the App-owned document session identity carried by the wire protocol;
- prevents two simultaneous connections from claiming the same actor in one
  file; each accepted socket owns its reservation until its own cleanup, and a
  rejected duplicate cannot release that reservation;
- inspects only the versioned binary frame header/identity/order metadata and
  relays canonical payload bytes unchanged to currently connected peers in the
  same file room;
- bounds each peer's queued publication bytes to 2 MiB while allowing one
  indivisible oversized frame;
- releases queued byte capacity only after the WebSocket send callback and the
  receiver's `frame-consumed` credit release; JSON control traffic remains
  independently deliverable;
- fans Awareness only to currently connected peers in the same file room;
- excludes sender echo;
- responds after every current peer queue has admitted the publication's frame
  set within its bounded capacity;
- retains no publication history.

If a peer disconnects, publications sent during that period are missed.
Reconnect receives future live publications only.

The response to `send-publication` is a live bounded-transport
acknowledgement. It does not prove peer canonical apply, a disk write, database
commit, recoverable revision, or remote backup. `peer-applied` is a separate
receipt and still does not represent durable storage. Server restart, redeploy,
or process failure discards every room.

The server's memory-only contract describes live room transport, not browser
persistence. The Asyra Design demo may save locally originated committed
snapshots to browser-local IndexedDB; a remote apply never writes it. That
local durability is not a production shared database or cross-device recovery
mechanism.

## Awareness

Awareness is a separate ephemeral route for presence. Disconnect, leave, and
timeout remove remote observations. Awareness never carries element creation,
geometry, vector topology, Props changes, permission, save/load data, or undo
history.

## Production Backend Responsibilities

The public memory-only server does not implement:

- user authentication or file permission lookup;
- durable snapshots or database persistence;
- missed-publication recovery;
- timestamp/LWW/domain ordering or late-message policy;
- app conflict merge/repair policy;
- horizontal room coordination or operational monitoring.

A production app/backend owns these decisions. It may load a canonical snapshot
or request domain changes after reconnect without changing the framework
transport contract.

Forks may omit collaboration, retain this server only as a development demo, or
replace it with an app-owned production backend. A production backend must
define durable commit, ordering, retry, duplicate/collision, recovery, backup,
security, and deployment-topology policy; Asyra Design intentionally supplies
no default database implementation.

## Manual Test

1. Start the app on the configured app URL, commonly port 3000.
2. Start the reference server:

   ```bash
   yarn workspace @asyra/asyra-design collaboration:server
   ```

   This command builds once and starts the server. After stopping it, restart
   the already-built server without touching build output:

   ```bash
   yarn workspace @asyra/asyra-design collaboration:server:start
   ```

3. Open the same required `fileId` URL in two windows. Both windows load the
   same App-owned demo document session and always connect Collaboration.
4. Verify create, delete, drag, drag-to-create, vector edits, undo, and redo.
   For pen drag-to-add, verify the peer receives the real point/segment on
   mouse-down and curve-handle changes during drag, before pointer-up.
5. Perform a local action, Undo, and Redo and verify the current session
   performs no client persistence capture, provider save, or IndexedDB write.
   Verify that merely receiving a remote publication is equally persistence
   free.
6. Verify local selection/presence behavior separately from canonical document
   changes.
7. Disconnect one window, mutate the other, reconnect, and confirm no hidden
   history replay occurs; a production refresh would be app/backend work.

## Validation

```bash
yarn workspace @asyra/collaboration test:local
yarn workspace @asyra/asyra-design test:local
yarn workspace @asyra/asyra-design build:collaboration-server
yarn workspace @asyra/asyra-design test:e2e:collaboration
```

Current framework product contract:
`docs/ai/framework/plans/completed/canonical-projection-and-collaboration-contract-realignment-plan.md`.
