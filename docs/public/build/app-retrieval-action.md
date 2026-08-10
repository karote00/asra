# Build app-owned AI retrieval and action

Retrieval is an app concern: it selects domain information and prepares bounded
context. Mutation remains a registered Feature/action concern. Keeping the two
separate prevents a search index, vector store, or model response from becoming
a hidden canonical owner.

## Prerequisites

- a registered canonical information model through current Core APIs
- app-owned indexing and retrieval policy
- an app Feature or AI action with a bounded public API
- permission and transaction policy for accepted mutations

## Ownership

The app owns record schemas, index construction, query meaning, access policy,
ranking, domain action semantics, and service deployment. Core owns managed
state registration. Feature System owns the registered action boundary. AI
Runtime may orchestrate a model-backed request, but it does not own retrieval
truth or canonical state.

## Public APIs

The current deterministic example uses:

- `core.defineSystemProperty(...)`
- `core.getSystemContextSnapshot()`
- `core.setSystemProperty(...)`
- `core.defineFeature(...)` with an app-owned `api`
- the registration's `api` and `dispose()`
- `core.unregisterSystemProperty(...)`

For model-backed intent, invoke this Feature API from a registered
`@asyra/ai-agent-runtime` action executor.

## Flow

1. Register an app-owned canonical record model.
2. Build or query an app-owned index from a read-only snapshot.
3. Return bounded matches without mutation.
4. Evaluate app permission and select an explicit registered action.
5. Call the Feature/action API with stable identifiers and validated arguments.
6. Let the API update the canonical owner inside the app's transaction policy.
7. Rebuild derived retrieval data from committed canonical state as needed.

Run:

```shell
yarn examples:run app-retrieval-action
```

## Expected result

Retrieval finds exactly the “Safety review” record and leaves the canonical
snapshot byte-equivalent. The registered Feature API performs the only status
change, setting that record to `approved`.

If AI Runtime is absent, the same retrieval and Feature API can be used by
ordinary app code. If a remote index or model is unavailable, do not apply a
guessed mutation. The app decides whether read-only search has a declared local
fallback; mutation still requires the registered owner route.

## Validate

```shell
yarn examples:run app-retrieval-action
yarn workspace @asyra/core test:local
yarn workspace @asyra/feature-system test:local
```

Add product tests for access control, stale index results, missing ids, schema
validation, transaction rollback, and the disabled AI composition.

## Forbidden shortcuts

- no index or model response as canonical state
- no mutation during retrieval
- no direct action from untrusted provider output
- no private Core registry or snapshot map mutation
- no server credential in browser code
- no current `createHeadlessCore()` claim; server/worker Core Kernel support is
  future work

## Canonical sources

- [AI Agent Runtime contract](../../ai/framework/packages/ai-agent-runtime.md)
- [Feature System contract](../../ai/framework/packages/feature-system.md)
- [Executable retrieval/action example](../../examples/app-retrieval-action.mjs)

## Next

- [Read current and future runtime boundaries](../learn/runtime-boundaries-roadmap.md)
- [See Asyra Design as a reference product](../cases/asyra-design.md)
