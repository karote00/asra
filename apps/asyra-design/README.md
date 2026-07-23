# Asyra Design

Asyra Design is the open-source reference app built on the Asyra Framework. It
provides a usable design canvas and demonstrates how an app can compose Asyra's
state, rendering, interaction, persistence, and optional collaboration APIs.

## Requirements

- Node.js 18 or newer
- Yarn

Install dependencies from the repository root:

```bash
yarn install
```

## App URL

The app has one URL setting in `apps/asyra-design/.env`:

```dotenv
ASYRA_DESIGN_APP_URL=http://localhost:3000
```

Vite, the normal Playwright suite, visual review, the collaboration E2E suite,
and the reference WebSocket server's Origin check all use this value. To use a
different local port or a deployed domain, override this one variable; do not
maintain separate Vite and test base URLs.

For example:

```dotenv
ASYRA_DESIGN_APP_URL=http://localhost:4317
```

## Start the App

From the repository root:

```bash
yarn workspace @asyra/asyra-design react:start
```

Open the URL configured by `ASYRA_DESIGN_APP_URL`.

## Run Collaboration in Two Windows

The repository includes a real public, memory-only WebSocket reference server.
It runs the same Asyra Design, Factory publication, app-owned remote
state-application, and Provider path that forked apps can extend or deploy.

Start the server and app in separate terminals:

```bash
yarn workspace @asyra/asyra-design collaboration:server
yarn workspace @asyra/asyra-design react:start
```

`collaboration:server` builds the reference server before starting it. To test
a server restart without rebuilding files or triggering app HMR, stop that
process and run:

```bash
yarn workspace @asyra/asyra-design collaboration:server:start
```

Open the same `fileId` in two windows, for example:

```text
http://localhost:3000/?fileId=crdt-public-reference
```

If `ASYRA_DESIGN_APP_URL` uses another origin, keep the same query string on
that URL. Matching `fileId` values join the same live in-memory room; different
values stay isolated. The server retains no publication history, so reconnect
receives future publications only.

The browser-local demo database is isolated by the same identity: an ordinary
URL uses localStorage key `FILE`, while a URL with `fileId` uses
`FILE:<encoded fileId>`. Refreshing or switching between file URLs therefore
restores each file's own local snapshot.

You can inspect the connection in DevTools:

```js
window.__AsyraCollaboration__?.getStatus()
window.__AsyraCollaboration__?.identity
```

This public reference intentionally has no login, permission check, durable
history, or protected-document security guarantee. It can be run as-is for
public memory-only collaboration; add the documented app/server policies
before using protected or durable documents. See the complete ownership,
data-flow, configuration, and extension contract in
[`collaboration-reference.md`](../../docs/ai/apps/asyra-design/modules/collaboration-reference.md).

## Tests

```bash
yarn workspace @asyra/asyra-design test:local
yarn workspace @asyra/asyra-design test:e2e:collaboration
```

The collaboration E2E suite may reuse already-running app and WebSocket
servers. It never replaces the manual two-window test surface.

## Project Structure

- `src/` — app UI, features, common APIs, and runtime composition
- `src/collaboration/` — optional collaboration provider and app composition
- `src/render-layers/` — app-owned overlay and preview layers
- `e2e/` — browser behavior tests, including real multi-window collaboration
- `collaboration-server.ts` — public memory-only reference server source
- `vite.collaboration-server.config.ts` — Node server build configuration
- `app-environment.mjs` — shared app URL and reference server configuration

## Contributing

Pull requests for app, framework-integration, and collaboration improvements are
welcome. Preserve canonical state ownership, registered rendering boundaries,
one intended undo unit per outer user interaction, and one shared publication
per synchronous delivery action.

## License

MIT
