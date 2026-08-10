# Asyra Design

Asyra Design is the open-source reference product built with Asyra Framework.
It is a real design tool and a maintained example of how an App composes
Framework state, transactions, input, rendering, optional AI, collaboration,
and backend services. Its design-tool behavior belongs to this App; it does not
limit the kinds of products the Framework can support.

Requirements:

- Node.js 24.x
- Yarn 4.3.1

## Start in this repository

Install and build the monorepo once from the repository root:

```bash
yarn install
yarn react:build
```

Start the frontend development graph:

```bash
yarn dev:all
```

Open one required non-empty `fileId`, for example:

```text
http://localhost:3000/?fileId=my-design
```

`dev:all` starts all workspace package watchers and the App dev server only. It
does not start the document backend or socket server, build missing package
outputs, or recreate `dist` after `yarn clean`; run `yarn react:build` again
when those outputs have been removed.

## Editing paths

The App always starts Collaboration for every required `fileId` and uses one
document-session composition. When its socket service is unavailable, it
enters the declared disconnected state and remains locally editable through a
provisional document. Local publications stay in the IndexedDB recovery outbox
until reconnect. The browser never writes a materialized document.

That behavior is useful for frontend development, but it is not complete
collaboration or durable backend persistence. To exercise those guarantees,
run the services in the next section.

The checked-in `apps/asyra-design/.env` owns the local origins:

```dotenv
APP_URL=http://localhost:3000
COLLABORATION_WS_HOST=127.0.0.1
COLLABORATION_WS_PORT=4101
DOCUMENT_PERSISTENCE_BACKEND_URL=http://127.0.0.1:4201
VITE_COLLABORATION_WS_URL=ws://127.0.0.1:4101/collaboration
```

`APP_URL` is the frontend origin. `VITE_COLLABORATION_WS_URL` is the browser's
socket endpoint.

The socket server reads and
writes checkpoints only through `DOCUMENT_PERSISTENCE_BACKEND_URL`. The browser
reaches document Reset through the App's same-origin proxy.

## Complete local services

Start each owner in a separate terminal, in this order:

```bash
yarn workspace @asyra/asyra-design document:backend
```

```bash
yarn workspace @asyra/asyra-design collaboration:server
```

```bash
yarn dev:all
```

Open the same `fileId` in two windows to join one document session. Different
ids remain isolated. Both single- and multi-Actor products use the same
checkpoint-plus-tail handshake, Factory publication, socket sequence,
three-second persistence window, and backend materialization path.

To restart services whose outputs are already built:

```bash
yarn workspace @asyra/asyra-design document:backend:start
yarn workspace @asyra/asyra-design collaboration:server:start
```

The reference services intentionally include no login or permission database.
A deployment must provide authorization, backup, retention, and operational
policy without creating a second browser canonical-state route. See the
[Collaboration reference](../../docs/ai/apps/asyra-design/modules/collaboration-reference.md).

## Extend the product

The fastest maintained extension is the
[App-owned review queue example](examples/review-queue-extension.mjs). It
registers one Feature API, validates App-domain records, rejects duplicate ids
atomically, and disposes its registration without changing Preset or Framework
internals:

```bash
yarn examples:run generated-design-app-extension
```

Use these public paths depending on what you are adding:

- [Start from a generated Asyra Design product](../../docs/public/start/create-design-app.md)
- [Extend it with an AI coding agent](../../docs/public/start/extend-with-ai.md)
- [Build a custom schema](../../docs/public/build/custom-schema.md)
- [Build a transaction-safe Feature](../../docs/public/build/feature-session.md)
- [Add registered AI actions](../../docs/public/build/ai-actions.md)
- [Asyra Design source-linked case study](../../docs/public/cases/asyra-design.md)

App work belongs in `src/features`, `src/common-apis`, `src/controllers`,
`src/init`, `src/render-layers`, or other explicit App owners. Do not put
design-tool rules into Framework packages merely because several UI components
need them.

## Framework and App ownership

| Layer        | Owns                                                                | Does not own                                             |
| ------------ | ------------------------------------------------------------------- | -------------------------------------------------------- |
| Framework    | canonical packages, transactions, validation, registration, runtime | design commands, panel policy, backend or AI domain      |
| Preset       | selectable official defaults and current `2D` provider policy       | Core readiness, App workflows, universal product rules   |
| Asyra Design | schemas, Features, common APIs, tools, UI, permissions, composition | Framework internals or backend durability authority      |
| App services | socket protocol, sequencing, checkpoints, persistence, server AI    | browser UI, Core instances, canonical mutation shortcuts |

The normal product path is:

```text
Input or UI intent
→ App Feature
→ App common API or controller
→ Core and canonical Framework owner
→ Factory transaction
→ Render / UI projection
→ optional App-owned transport and durability
```

AI-created elements use this same route. They remain ordinary editable Props
and Scene information, one reversible transaction, one collaboration
publication path, and one persistable document sequence—not an opaque AI-only
object or render patch.

Provider configuration is server-only:

```dotenv
AI_PROVIDER_ENDPOINT=https://your-adapter.example/actions
AI_PROVIDER_MODEL=your-model
AI_PROVIDER_API_KEY=your-secret
```

The browser receives none of these values. App startup makes no model request;
execution begins only after explicit user intent and remains behind registered
actions, permissions, confirmation, Feature, and transaction boundaries.

## Verify

Use owner-focused tests while developing, then the full App gates:

```bash
yarn workspace @asyra/asyra-design typecheck
yarn workspace @asyra/asyra-design test:local
yarn workspace @asyra/asyra-design test:e2e
yarn workspace @asyra/asyra-design test:e2e:collaboration
```

Production bundling remains a separate required gate:

```bash
yarn workspace @asyra/asyra-design react:build
```

The E2E suites use formal test access and the App's diagnostic service. Human
DevTools globals are not an automation API.

## Deployment boundary

The current public frontend deployment does not include the repository socket
server or document backend. An ordinary `fileId` therefore reports a
disconnected transition and remains locally editable; it does not silently
claim collaboration or durability.

`crdt-7076-sample` also uses the ordinary document-session and action-execution
path. It is prepared only after the designated Actor submits the checked-in
reference input; it is not a preload, alternate runtime, or hidden document
source.

## Support and contribution policy

This repository does not accept external issues or contributions, including
pull requests. You may inspect and fork the App, but product changes must retain
the Framework/App ownership boundaries and formal test contracts described
above. Follow the repository [security policy](../../SECURITY.md) for
security-sensitive reports.

## License

[MIT](../../LICENSE)
