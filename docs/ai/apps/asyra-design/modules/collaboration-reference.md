# Collaboration Reference

## Purpose

Asyra Design includes a real two-window WebSocket collaboration composition.
It is open-source reference code, not a fake or mock path. The browser app,
Provider, typed wire protocol, and memory-only server all use the same
publication transport contract available to product apps.

The reference proves live CRDT-oriented app behavior through ordinary app
changes and remote canonical apply. It intentionally does not implement the
production backend responsibilities listed below.

## Activation

Collaboration activates only when the app URL contains one non-empty `fileId`:

```text
http://localhost:3000/?fileId=crdt-public-demo
```

The app maps `fileId` to internal document and room identity. Each page creates
its own actor ID and uses it as the canonical ID-counter namespace before any
collaborative element or property creation.

Core load/save keeps using localStorage as the open-source reference app's demo
database. An ordinary URL retains the legacy `FILE` key. A collaboration URL
uses `FILE:<encoded fileId>`, so matching `fileId` values load the same
browser-local snapshot and different files do not overwrite each other. On
refresh, Core loads that file's snapshot before collaboration connects. On
first collaboration startup, RenderApp initializes a canonical empty workspace
only when the selected key has no document; it never overwrites an existing
snapshot. URLs without `fileId` simply do not create Collaboration or connect a
Provider.

The browser endpoint comes from
`VITE_ASYRA_DESIGN_COLLABORATION_WS_URL`. The reference server validates the
request Origin against `ASYRA_DESIGN_APP_URL`; server host and port remain
separate environment settings because they identify a separate service.

## Publication Flow

```text
local app mutation
-> Factory immediate or transaction-end SharedPublication
-> app channel filter (Scene Tree and Props)
-> Collaboration FIFO handoff
-> WebSocket Provider send-publication request
-> reference server live-room fanout and response acknowledgement
-> receiving WebSocket Provider publication message
-> Collaboration app callback once
-> app validates every delivery before mutation
-> one Factory runRemoteTransaction
-> ordinary publishEvent / canonical state-owner apply
-> Render and UI projections
```

One Factory publication remains one wire request and one receiving app
callback. A multi-element or multi-owner publication is not split. Repeated
routes and equal payloads remain repeated app intent and are forwarded in
order.

Factory-produced undo, redo, and rollback compensation publications use the
same route. Collaboration does not require feature-specific transport flags;
the mutation owner decides `sharedDelivery` when it creates the canonical
change.

## App-Owned Processing

`src/collaboration/operations.ts` owns the current document contract:

- supported Scene Tree
  add/remove/computed-data/computed-patch/move-elements/change-subtree routes;
- supported Props add/remove/update routes;
- payload validation for those routes;
- validation of every delivery before any remote mutation;
- an optional app-owned permission/domain-order/duplicate/conflict decision
  that may reject or transform a publication, followed by validation of the
  accepted result;
- one `runRemoteTransaction` for all deliveries in one publication;
- ordinary `factory.applyRemoteEvent(..., publishEvent)` canonical apply.

An invalid or unsupported delivery rejects the whole publication before the
remote transaction begins. This is Asyra Design app policy, not
`@asyra/collaboration` policy.

Factory remote origin keeps accepted remote changes out of the receiving
user's ordinary local undo stack and suppresses a new outbound publication.
The default reference policy accepts repeated hierarchy publications. Any
dedupe, last-write-wins, timestamp ordering, or concurrent hierarchy conflict
policy is an app/backend responsibility and is not added to Collaboration.

## Wire Protocol and Provider

`src/collaboration/protocol.ts` accepts these message families:

- client: `hello`, `send-publication`, `send-awareness`;
- server: `ready`, `response`, `publication`, `awareness`,
  `awareness-disconnect`, `failure`, `connection-error`.

The protocol validates every Factory-owned publication and delivery field. The
WebSocket Provider also rejects values that JSON would omit or change instead
of acknowledging a different payload. Neither boundary whitelists app channel,
event names, or payload meaning; app semantics remain in the app processor.

`sendPublication()` settles only after the server returns its request response.
Disconnect rejects pending requests. Reconnect creates a new live socket and
does not request a state vector or publication history.

## Reference Server

`collaboration-server.ts` uses `MemoryHub` and one `MemoryProvider` per accepted
socket. It:

- accepts the app-defined `fileId` identity;
- prevents two simultaneous connections from claiming the same actor in one
  file; each accepted socket owns its reservation until its own cleanup, and a
  rejected duplicate cannot release that reservation;
- fans publications and Awareness only to currently connected peers in the
  same file room;
- excludes sender echo;
- responds after the memory transport accepts the publication;
- retains no publication history.

If a peer disconnects, publications sent during that period are missed.
Reconnect receives future live publications only.

The server's memory-only contract describes live room transport, not browser
persistence. The Asyra Design demo still saves canonical snapshots to
localStorage; that local durability is not a production shared database or
cross-device recovery mechanism.

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

3. Open the same `fileId` in two windows.
4. Verify create, delete, drag, drag-to-create, vector edits, undo, and redo.
   For pen drag-to-add, verify the peer receives the real point/segment on
   mouse-down and curve-handle changes during drag, before pointer-up.
5. Refresh a window and verify its localStorage snapshot loads before live
   collaboration reconnects.
6. Open a different `fileId`, create different content, and verify switching
   between the two URLs restores each file's own browser-local snapshot.
7. Verify local selection/presence behavior separately from canonical document
   changes.
8. Disconnect one window, mutate the other, reconnect, and confirm no hidden
   history replay occurs; a production refresh would be app/backend work.

## Validation

```bash
yarn workspace @asyra/collaboration test:local
yarn workspace @asyra/asyra-design test:local
yarn workspace @asyra/asyra-design build:collaboration-server
yarn workspace @asyra/asyra-design test:e2e:collaboration
```

Framework product contract:
`docs/ai/framework/plans/completed/network-collaboration-transport-plan.md`.
