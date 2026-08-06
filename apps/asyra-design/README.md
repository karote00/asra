# Asyra Design

Asyra Design is the open-source reference app built on the Asyra Framework. It
provides a usable design canvas and demonstrates how an app can compose Asyra's
state, rendering, interaction, and collaboration APIs.

## Requirements

- Node.js 24.x
- Yarn 4.3.1

Install dependencies from the repository root:

```bash
yarn install
```

On a fresh clone, build the workspace outputs once before starting development:

```bash
yarn react:build
```

After running `yarn clean`, run `yarn react:build` again before starting
development. Ordinary development sessions can reuse the existing outputs.

## Local Service Configuration

The checked-in `apps/asyra-design/.env` configures the frontend, socket
listener, and backend origin:

```dotenv
APP_URL=http://localhost:3000
COLLABORATION_WS_HOST=127.0.0.1
COLLABORATION_WS_PORT=4101
DOCUMENT_PERSISTENCE_BACKEND_URL=http://127.0.0.1:4201
```

This repository reference app intentionally composes its complete document
session. The generated standalone template instead leaves
`VITE_COLLABORATION_WS_URL` empty so Collaboration is opt-in and creates no
provider/network side effect until the consumer explicitly configures it. See
[`TEMPLATE.md`](TEMPLATE.md) for the generated-app contract.

Vite, the normal Playwright suite, visual review, the collaboration E2E suite,
and the socket server's Origin check use `APP_URL`. The socket server reads and
writes checkpoints only through `DOCUMENT_PERSISTENCE_BACKEND_URL`; Vite uses
that same backend origin to proxy the browser's same-origin
`/api/documents/*` Reset DELETE during ordinary development. Neither derives
the backend origin from the frontend URL.

Reset always refreshes after the DELETE attempt settles. A storage-free demo
without a reachable backend therefore still reloads the formal empty App; the
failed request is diagnostic only and never blocks refresh.

For example:

```dotenv
APP_URL=http://localhost:4317
```

## Start the Complete Local App

Start the backend first:

```bash
yarn workspace @asyra/asyra-design document:backend
```

Start the socket server in a second terminal:

```bash
yarn workspace @asyra/asyra-design collaboration:server
```

Start the frontend in a third terminal:

```bash
yarn dev:all
```

`dev:all` starts all workspace package watchers plus the App dev server only.
It does not create missing workspace `dist` outputs. On a fresh clone, run
`yarn install` and `yarn react:build` before `yarn dev:all`; after `yarn clean`,
run `yarn react:build` before `yarn dev:all`. The backend and socket server
remain the explicit first two terminals above.

Open one required non-empty `fileId`, for example:

```text
http://localhost:3000/?fileId=manual-design-file
```

Opening the same `fileId` in two windows joins the same document session;
different values remain isolated. One Actor and multiple Actors use exactly
the same checkpoint-plus-tail handshake, Factory publication, socket sequence,
three-second persistence window, and backend materialization path. The
frontend always starts Collaboration for every required `fileId`, including
`crdt-7076-sample`.

The browser never writes a materialized document. It stores only unaccepted
local `SharedPublication` values in an IndexedDB recovery outbox and removes
each one after matching socket source acceptance. Core remains the load owner
and provides explicit serialization only for export and diagnostics.

To restart already-built services without rebuilding:

```bash
yarn workspace @asyra/asyra-design document:backend:start
yarn workspace @asyra/asyra-design collaboration:server:start
```

You can inspect the connection in DevTools:

```js
window.__Collaboration__?.getStatus()
window.__Collaboration__?.getSessionState()
window.__Collaboration__?.identity
```

The repository server intentionally has no login or permission database. A
deployment must supply authorization, backup, and operational policy without
changing the frontend document-session contract. See the complete ownership,
data-flow, configuration, and extension contract in
[`collaboration-reference.md`](../../docs/ai/apps/asyra-design/modules/collaboration-reference.md).

## Public Frontend Deployment

The public deployment ships the same full-stack frontend code but does not
deploy the socket server or backend. An ordinary `fileId` therefore enters the
disconnected state, displays one transition toast, and remains locally
editable. Per-operation send failures stay in the console, and one
non-overlapping reconnect attempt is scheduled every 30 seconds. This is not a
second local-only mode.

`crdt-7076-sample` uses this same disconnected socket composition. Opening
`http://localhost:3000/?fileId=crdt-7076-sample` does not preload a drawing.
After Actor A submits the checked-in reference image and exact instruction, the
same-origin HTTP action-batch endpoint returns the prepared sample. Actor A
then executes it through the ordinary Runtime/Core/Factory/Render path; with a
socket, Actor B receives the result through CRDT, and without a socket Actor A
still renders locally while the ordinary outbox retains its publication.

## Tests

```bash
yarn workspace @asyra/asyra-design test:local
yarn workspace @asyra/asyra-design test:e2e
yarn workspace @asyra/asyra-design test:e2e:collaboration
```

The Playwright suites use the DEV app runtime for their diagnostic
canonical-state assertions through imported test access and the bounded
document diagnostic service; the human-only DevTools globals are never an
automation API. Production bundling remains a separate build gate.
The collaboration E2E suite may reuse already-running app and WebSocket servers.
It never replaces the manual two-window test surface.

## Project Structure

- `src/` — app UI, features, common APIs, and runtime composition
- `src/collaboration/` — always-on collaboration provider and app composition
- `src/render-layers/` — app-owned overlay and preview layers
- `e2e/` — browser behavior tests, including real multi-window collaboration
- `collaboration-server.ts` — socket session, sequence, fan-out, and
  persistence-queue server
- `server/document-backend.ts` — ordered checkpoint materialization backend
- `vite.collaboration-server.config.ts` — Node server build configuration
- `app-environment.mjs` — shared app URL and reference server configuration

## Contributing

Pull requests for app, framework-integration, and collaboration improvements are
welcome. Preserve canonical state ownership, registered rendering boundaries,
one intended undo unit per outer user interaction, and one shared publication
per synchronous delivery action.

## License

MIT
