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

## Where this runs

Product extensions live inside the generated app, not in Framework packages.
For a new behavior, create a folder such as `src/features/review-queue/`, export
its registration from `src/features/index.ts`, and let the existing startup
import register it with the rest of the app Features.

## Implementation

This small queue is app-owned information. It uses the public Feature boundary
for registration and disposal while keeping review meaning inside the app:

```ts
import { defineFeature } from '@asyra/core'

const records = new Map<string, Readonly<{
  id: string
  title: string
  status: 'pending'
}>>()

export const reviewQueue = defineFeature('app.reviewQueue', undefined, {
  priority: 20,
  exclusive: true,
  api: {
    add(input: { id: string; title: string }) {
      if (!input.id.trim() || !input.title.trim()) {
        throw new Error('Review records require an id and title')
      }
      if (records.has(input.id)) {
        throw new Error(`Review record already exists: ${input.id}`)
      }
      const record = Object.freeze({ ...input, status: 'pending' as const })
      records.set(record.id, record)
      return record
    },
    list: () => [...records.values()]
  }
})
```

Import the module once from `src/features/index.ts`. UI code calls
`reviewQueue.api.add(...)`; disposal belongs to the app lifecycle that owns the
registration.

## Flow

1. The generated startup composes Preset and Core exactly as maintained.
2. Importing the extension registers one app-owned Feature.
3. A product surface calls the Feature API with user intent.
4. The API validates review-domain input before storing it.
5. The returned record drives UI, persistence, or later actions chosen by the
   app.

## Expected result

One valid call adds one immutable pending record. A missing field or duplicate
id throws before another record appears. Removing the extension registration
also removes its public API without changing Core, Preset, or the generated
document model.

## Extend one bounded behavior

Use the pattern above without forking canonical state: register app-owned
meaning, route intent through public APIs, and verify the product result. If
the behavior changes the generated document, replace the local `Map` with the
existing generated common API and transaction route rather than adding a
second document store.

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
- [Asyra Design Feature registrations](../../../create-app/asyra-design/template/src/features/index.ts)

## Next

- [Understand intent and Features](../learn/intent-and-features.md)
- [See Asyra Design as a reference product](../cases/asyra-design.md)
