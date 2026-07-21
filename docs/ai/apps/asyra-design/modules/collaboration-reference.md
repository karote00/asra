# Module: Collaboration Reference Implementation

## Purpose

Asyra Design includes a real two-window Yjs/WebSocket composition as
open-source reference code. It lets app developers inspect and extend the
optional collaboration boundary while keeping ordinary app startup unchanged.

The reference implementation is deliberately public and memory-only. It runs
the real Asyra Design collaboration path and verifies CRDT transport,
canonical application, shared publication, reconnect, and room isolation. It
does not implement authentication, permission lookup,
durable history, tenancy, rate limiting, or production deployment hardening.

## Shared Environment Contract

`apps/asyra-design/.env` declares the defaults. `app-environment.mjs` owns
loading those defaults plus parsing and validation for app-owned build, test,
and server consumers. Visual review consumes the same canonical app URL rather
than defining another URL authority:

| Variable                                 | Owner and use                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `ASYRA_DESIGN_APP_URL`                   | Single app origin for Vite, ordinary Playwright, visual review, collaboration E2E, and WebSocket Origin validation. |
| `ASYRA_DESIGN_COLLABORATION_WS_HOST`     | Bind host for the reference WebSocket server.                                                                       |
| `ASYRA_DESIGN_COLLABORATION_WS_PORT`     | Bind port and derived health-check port for the reference WebSocket server.                                         |
| `VITE_ASYRA_DESIGN_COLLABORATION_WS_URL` | Browser-visible WebSocket endpoint used by the optional collaboration composition.                                  |

`ASYRA_DESIGN_APP_URL` must be a root `http` or `https` origin. Shell values
override `.env`. Changing this one value changes the Vite host/port and every
app test base URL; it also changes which browser Origin the reference WebSocket
server accepts. A deployed build can set a production app origin without
introducing a second test-only URL variable.

The WebSocket URL remains separate because it identifies a different service.
For a deployed public composition, set it to the deployed `wss` endpoint. Add
authentication, authorization, and durable storage before using the server for
protected or durable documents.

## Manual Two-Window Test

From the repository root, start the server and app in separate terminals:

```bash
yarn workspace @asyra/asyra-design collaboration:server
yarn workspace @asyra/asyra-design react:start
```

`collaboration:server` first type-checks and builds the TypeScript backend, then
executes `dist/collaboration-server/collaboration-server.js` with Node.
Vite participates only in this build step and is not a backend runtime
dependency.

The generated server reads `.env` from the app working directory, while
explicit process environment values continue to take precedence.

Open `${ASYRA_DESIGN_APP_URL}/?fileId=crdt-public-reference` in two windows. The
actual URL does not contain the `${...}` syntax; substitute the configured
origin, for example `http://localhost:3000/?fileId=crdt-public-reference`.

Expected behavior:

1. Both windows report `connected`.
2. Mouse-down creation and applied drag geometry appear in the peer through
   canonical Yjs operations before pointer-up.
3. Pointer-up publishes only when it performs another canonical action, such
   as a 100×100 click-create reset or a final pointer position not seen by the
   last update.
4. Create, move, undo, redo, disconnect, and reconnect converge.
5. A different `fileId` stays in a different room.

The collaboration console handle is intentionally retained for manual
testing whenever `fileId` activates the composition:

```js
window.__AsyraCollaboration__?.getStatus()
window.__AsyraCollaboration__?.identity
await window.__AsyraCollaboration__?.whenIdle()
await window.__AsyraCollaboration__?.disconnect()
await window.__AsyraCollaboration__?.reconnect()
```

`dispose()` is also available for teardown diagnostics. Reload the page to
create a new app-owned collaboration instance after disposal.

## Identity and Permission Boundary

The app developer chooses the connection metadata. This reference app chooses
one non-empty `fileId` query parameter and forwards `{ fileId }` unchanged to the
provider. It maps that value to internal `documentId` and `roomId`, and creates
a full UUID actor ID for each page. Before collaborative actions begin, the app
uses that actor ID as the canonical ID-counter namespace. Concurrent pages can
therefore create elements and properties without generating the same app
entity IDs; the collaboration framework does not inspect competing entity
payloads to choose a winner.

The server groups sockets by `fileId` and validates only protocol shape and the
configured app Origin. It intentionally treats every valid `fileId` as public.
In a production backend, the provider/server handshake must authenticate the
user, resolve the file, verify the user's permission for that file, and only
then join the room. That policy remains app/server owned; the framework does
not assign meaning to `fileId` or other metadata.

## Wire Protocol Boundary

`src/collaboration/protocol.ts` is the single app-owned contract
for browser-to-server and server-to-browser message discriminants and payload
shapes. Both the browser provider and the Node reference server consume its
named message variants, composed client/server unions, and runtime parsers.
Incoming JSON is rejected at this boundary
unless its complete message shape is valid; binary payload strings are
validated before byte decoding. Successful sync responses must contain the
expected encoded binary fields; a missing or malformed field fails with
`transport-failed` and is never treated as an empty Yjs update. Any malformed
server frame also fails the provider, rejects every pending request, and closes
the invalid connection; startup and state-vector synchronization therefore
cannot remain pending on an unusable transport. Framework collaboration remains
transport neutral and does not own this WebSocket protocol.

## Local Action Flow

```text
mouse-down / each applied drag update / conditional mouse-up
  -> canonical state-owner mutations with sharedDelivery: 'immediate'
  -> one Factory publication for that synchronous delivery action
  -> one Y.Doc transaction/update
  -> one provider send

outer pointer session
  -> one Factory transaction
  -> one undo commit
```

One synchronous action can mutate several elements or state owners; Factory
preserves those changes in order and publishes them as one batch. Remote
forward apply, rollback, undo, and redo keep that batch as one state-owner
event. Factory does not deduplicate a meaningful repeated sequence such as
A -> B -> C -> B.
Canonical element creation and geometry never use Awareness or a second Render
preview layer.

## Remote Canonical Flow

```text
WebSocket binary update
  -> provider identity and Yjs decode
  -> operation ID dedupe and schema validation
  -> permission and conflict policy
  -> Factory remote transaction
  -> registered Scene Tree / Props canonical apply
  -> ordinary Render and UI projections
```

Only registered Scene Tree and Props document channels are transported.
Current tool, hover state, and other local UI state are excluded.
Awareness is not stored in the Y.Doc operation log, save/load data, persistence,
or undo history.

## Lifecycle Ownership

The optional lifecycle module is dynamically imported for any app URL with a valid
`fileId`, including a deployed production build. URLs without `fileId` do not
load it. `RenderApp` owns opt-in timing plus unmount and aborted-startup
teardown requests. The collaboration lifecycle module owns HMR teardown, partial-setup
cleanup, and explicit disposal. The provider owns connection-failure state,
while the collaboration instance enforces borrowed/owned resource disposal.
These paths unregister observers and destroy only resources owned by the app
composition.

## Automated Verification

```bash
yarn workspace @asyra/asyra-design test:local
yarn workspace @asyra/asyra-design test:e2e:collaboration
```

The browser suite runs three real app contexts through the same WebSocket
server and verifies same-file canonical convergence before pointer-up,
different-file room isolation, disconnect, and reconnect. Factory,
collaboration, and app integration tests own the exact one-synchronous-action
publication, one-Yjs-update, and one-provider-send assertions. The browser config reuses
running servers, so the permanent manual workflow and the formal regression
suite share the same reference implementation.

## Forking Toward Production

Keep the `Provider` boundary and extend or replace the public
memory server and provider connection policy. A protected or durable
production composition must decide and test:

- authenticated session and verified actor identity;
- file/room authorization and permission refresh or revocation;
- durable Yjs update storage, compaction, and state-vector sync;
- deterministic domain conflict policies;
- reconnect/backoff, observability, abuse controls, and resource limits;
- TLS, deployment topology, and WebSocket Origin policy.

Do not treat the memory-only server or its unconditional app permission policy
as a production default.
