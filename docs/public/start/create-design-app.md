# Create a complete design app

`create-asyra-design-app` is the beginner product entry. It gives you a
standalone copy of Asyra Design—the maintained reference app—so you can begin
with a working product instead of assembling every capability first.

## Prerequisites

- Node.js `24.x`
- Yarn, npm, or pnpm
- a single new directory name for the project

## Create and start

```shell
npx create-asyra-design-app my-project
cd my-project
yarn start
```

For non-interactive setup, select the package manager explicitly:

```shell
npx create-asyra-design-app my-project --package-manager=yarn
```

Valid values are `yarn`, `npm`, and `pnpm`. Absolute output paths and parent
directory traversal are rejected. Use the start command printed by the CLI
when you select npm or pnpm.

Open `http://localhost:3000/?fileId=my-design`. The non-empty `fileId` is the
document-session identity.

## What you receive

The generated app demonstrates the current public Core and Preset `2D`
composition, app-owned Features, common APIs, canonical transactions,
undo/redo, hierarchy, validated load, optional collaboration, and optional AI
actions. Its Framework dependencies resolve from public package entrypoints;
the clean-consumer release gate verifies the generated copy outside the
monorepo.

The template is a product, not a new Framework default. Its drawing behavior,
document-session policy, panels, shortcuts, server adapters, and AI domain
prompt belong to Asyra Design and may be replaced by your app.

## Extend one bounded behavior

Study the verified
[review queue extension](../../../apps/asyra-design/examples/review-queue-extension.mjs)
through its inventory entry, `generated-design-app-extension`. It shows the
expected extension shape without forking canonical state: register app-owned
meaning, route intent through public APIs, and prove the result.

When working with an AI coding agent, continue with
[Extend Asyra with an AI coding agent](extend-with-ai.md). Ask for one product
behavior at a time and provide the generated app's own tests and architecture
as constraints.

## Optional local services

The generated environment points its collaboration endpoint at the local
reference service. Run these commands in separate terminals for the complete
reference document-session composition:

```shell
yarn document:backend
yarn collaboration:server
yarn start
```

If the service is unavailable, the app enters its declared disconnected state;
local editing uses the provisional document and app-owned recovery outbox. This
is Asyra Design policy, not Collaboration package fallback behavior.

## Validate before extending further

```shell
yarn typecheck
yarn react:build
yarn test
```

Do not edit generated Framework packages, import package-private files, or move
app behavior into Core. Change app-owned code and keep canonical writes behind
the generated common APIs and transaction boundaries.

## Canonical sources

- [CLI contract](../../../create-app/asyra-design/README.md)
- [Generated template contract](../../../create-app/asyra-design/template/README.md)
- [Verified extension source](../../../apps/asyra-design/examples/review-queue-extension.mjs)

## Next

- [Understand intent and Features](../learn/intent-and-features.md)
- [See Asyra Design as a reference product](../cases/asyra-design.md)
