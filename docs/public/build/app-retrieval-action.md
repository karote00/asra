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

The implementation uses:

- `core.defineSystemProperty(...)`
- `core.getSystemContextSnapshot()`
- `core.setSystemProperty(...)`
- `core.defineFeature(...)` with an app-owned `api`
- the registration's `api` and `dispose()`
- `core.unregisterSystemProperty(...)`

For model-backed intent, invoke this Feature API from a registered
`@asyra/ai-agent-runtime` action executor.

## Where this runs

Put retrieval beside the app's information model or index service. It reads a
detached canonical snapshot and returns bounded identifiers. Put mutation in a
Feature API. A UI command, automation, or registered AI action may call that
same API after app permission succeeds.

## Implementation

```ts
const RECORDS = 'app:records'
type RecordStatus = 'open' | 'approved'
type AppRecord = Readonly<{ label: string; status: RecordStatus }>
type AppRecords = Readonly<Record<string, AppRecord>>

core.defineSystemProperty(RECORDS, {
  'record-a': { label: 'Cooling audit', status: 'open' },
  'record-b': { label: 'Safety review', status: 'open' }
})

const getRecords = (): AppRecords =>
  core.getSystemContextSnapshot()[RECORDS] as AppRecords

const actions = core.defineFeature('app:record-actions', undefined, {
  priority: 100,
  exclusive: true,
  api: {
    setStatus(recordId: string, status: RecordStatus) {
      const records = getRecords()
      if (!records[recordId]) throw new Error(`Unknown record: ${recordId}`)
      core.setSystemProperty(RECORDS, {
        ...records,
        [recordId]: { ...records[recordId], status }
      })
    }
  }
})

export const retrieve = (query: string) => {
  const records = getRecords()
  return Object.entries(records)
    .filter(([, record]) =>
      record.label.toLowerCase().includes(query.toLowerCase())
    )
    .map(([id, record]) => ({ id, ...record }))
}

const [match] = retrieve('safety')
if (!match) throw new Error('Safety review was not found')
actions.api.setStatus(match.id, 'approved')
```

If canonical mutation in your app requires an explicit common transaction API,
call it from `setStatus(...)`; do not let retrieval own that transaction.

## Flow

1. Register an app-owned canonical record model.
2. Build or query an app-owned index from a read-only snapshot.
3. Return bounded matches without mutation.
4. Evaluate app permission and select an explicit registered action.
5. Call the Feature/action API with stable identifiers and validated arguments.
6. Let the API update the canonical owner inside the app's transaction policy.
7. Rebuild derived retrieval data from committed canonical state as needed.

## Expected result

Retrieval finds exactly the “Safety review” record and leaves the canonical
snapshot byte-equivalent. The registered Feature API performs the only status
change, setting that record to `approved`.

If AI Runtime is absent, the same retrieval and Feature API can be used by
ordinary app code. If a remote index or model is unavailable, do not apply a
guessed mutation. The app decides whether read-only search has a declared local
fallback; mutation still requires the registered owner route.

## Validate

Add product tests for access control, stale index results, missing ids, schema
validation, transaction rollback, and the disabled AI composition. Compare the
canonical snapshot before and after retrieval to prove search is read-only.

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
- [Information-model guide](../learn/information-models.md)

## Next

- [Read current and future runtime boundaries](../learn/runtime-boundaries-roadmap.md)
- [See Asyra Design as a reference product](../cases/asyra-design.md)
