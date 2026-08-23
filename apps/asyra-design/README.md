# Asyra Design

Asyra Design is the official canvas-based design tool app built on Asyra
Framework. It is a maintained product and reference implementation, not a
demo-only shell or a set of product behaviors silently installed by the
Framework.

It gives developers a working 2D editor for shapes and Vector paths, selection,
property editing, layers and Group hierarchy, Undo/Redo, document sessions,
collaboration and persistence services, and user-initiated AI actions. These
capabilities remain ordinary App-owned behavior, so a product can extend,
replace, or remove them without turning design-tool policy into Framework
internals.

## Try and create Asyra Design

[Open the Asyra Design live app](https://asyra-design.vercel.app/?fileId=demo).

To create an independently editable Asyra Design product:

```bash
npx create-asyra-design-app my-product --package-manager=npm
cd my-product
npm run start
```

The generated project is ordinary source code. Start with the
[complete design-app guide](../../docs/public/start/create-design-app.md) to
understand its files, extension path, optional local services, and validation
commands.

Use the rest of this README when working on the maintained App source inside
the Asyra monorepo.

## Start in this repository

Requirements:

- Node.js 24.x
- Yarn 4.3.1

For product architecture, owner paths, development workflows, and AI-agent
instructions that also ship in the generated template, start at
[`docs/README.md`](docs/README.md). Framework contracts remain upstream and are
linked from [`docs/framework.md`](docs/framework.md).

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

The checked-in `apps/asyra-design/.env.example` documents the complete local
service configuration. Copy it to the ignored `.env` only when you want to run
all three local services:

```bash
cp apps/asyra-design/.env.example apps/asyra-design/.env
```

```dotenv
APP_URL=http://localhost:3000
COLLABORATION_WS_HOST=127.0.0.1
COLLABORATION_WS_PORT=4101
DOCUMENT_PERSISTENCE_BACKEND_URL=http://127.0.0.1:4201
VITE_COLLABORATION_WS_URL=ws://127.0.0.1:4101/collaboration
```

`APP_URL` is the frontend origin. `VITE_COLLABORATION_WS_URL` is the browser's
socket endpoint. Without `.env`, the frontend starts on
`http://localhost:3000` and derives `/collaboration` from its current origin.
If that socket route is unavailable, the App enters its declared provisional
offline state and remains locally editable.

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

Begin with the [generated-product extension guide](../../docs/public/start/create-design-app.md).
It shows where an App-owned Feature lives, the public registration code, its
call flow, expected result, rejection behavior, and lifecycle cleanup without
changing Preset or Framework internals.

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
publication path, and one persistable document sequence - not an opaque AI-only
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
