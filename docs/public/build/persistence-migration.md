# Build persistence with app-owned migration

Treat stored documents as untrusted input. The app interprets versions and
performs deterministic migration; Core and canonical packages validate the
candidate before activation.

## Prerequisites

- `@asyra/core` load/save composition
- `@asyra/persistence` contracts or a compatible app provider
- app-owned document versions and a connected migration chain
- current property and hierarchy schemas

## Ownership

Persistence owns `DocumentLoadSource`, `IPersistenceProvider`, load/save hook
types, and reference providers. Core owns hook ordering and coordinates
package-owner validation/apply. Props Manager and Scene Tree validate their
canonical data. The app owns migration meaning, supported versions, storage
selection, scheduling, authentication, retention, and backend topology.

## Public APIs

- `core.registerLoadHook(...)`
- `core.save()` and the Core load lifecycle
- `DocumentLoadSource` and `IPersistenceProvider`
- `MemoryPersistence`, `IndexedDbPersistence`, and
  `LocalStoragePersistence`
- `SaveHook` and `LoadHook`

The implementation below is an app-owned migration helper, not a Framework
API.

## Where this runs

Install migration hooks in the app's document composition before Core starts.
The provider returns untrusted data to the load source; migration happens
before canonical package apply. Keep backend selection, retries, retention, and
credentials in app/server adapters rather than the browser document model.

## Implementation

```ts
type AppDocument = {
  version: string
  [key: string]: unknown
}

type DocumentEnvelope = {
  version?: unknown
}

type Migration = (document: AppDocument) => AppDocument

const migrations = new Map<string, Migration>([
  [
    'v1',
    (document) => {
      const { legacyTitle, ...rest } = document
      return { ...rest, version: 'v2', title: legacyTitle ?? '' }
    }
  ],
  [
    'v2',
    (document) => ({
      ...document,
      version: 'v3',
      metadata: { schema: 'v3' }
    })
  ]
])

core.registerLoadHook((rawDocument) => {
  if (!rawDocument || typeof rawDocument !== 'object') {
    throw new Error('Invalid document envelope')
  }
  if (typeof (rawDocument as DocumentEnvelope).version !== 'string') {
    throw new Error('Document version is required')
  }
  let document = rawDocument as AppDocument
  const visited = new Set<string>()
  while (migrations.has(document.version)) {
    if (visited.has(document.version)) throw new Error('Migration cycle')
    visited.add(document.version)
    document = migrations.get(document.version)!(document)
  }
  if (document.version !== 'v3') {
    throw new Error(`Unsupported document version: ${document.version}`)
  }
  return document
})
```

Production registration should validate the entire transition batch up front:
one head, no duplicate input/output versions, no disconnected components, and
no asynchronous step results.

## Flow

1. Register one complete, connected app migration batch.
2. Read an untrusted document from the selected source.
3. Require an explicit string version.
4. Apply synchronous migration steps in deterministic order.
5. Require each step to return exactly its declared next version.
6. Return the migrated candidate to Core.
7. Let package owners validate the complete candidate before apply.
8. Activate the document only after all owners accept it.

## Expected result

The implementation migrates a `v1` document through one connected chain to
`v3`. Missing versions, disconnected/cyclic chains, duplicate registration,
asynchronous results, malformed results, and wrong output versions fail before
canonical apply.

If Persistence is not composed, no storage I/O occurs. If a provider fails,
that failure cannot redefine whether an already settled runtime transaction
committed. The app decides retry and recovery policy.

## Validate

Add round-trip, invalid-document, unsupported-version, partial-owner failure,
prior-document preservation, and provider-failure tests for your app schema.

## Forbidden shortcuts

- no package-owned app version table
- no asynchronous migration hidden inside a synchronous load hook
- no apply before full migration and owner validation
- no defaulting an explicitly invalid value
- no automatic save scheduling claimed by Persistence or Core
- no treating browser reference providers as production backend policy

## Canonical sources

- [Persistence contract](../../ai/framework/packages/persistence.md)
- [Props Manager contract](../../ai/framework/packages/props-manager.md)
- [Validation and load boundaries](../learn/validation-load-migration.md)

## Next

- [Learn validation, load, and migration](../learn/validation-load-migration.md)
- [Read the Persistence guide](../reference/packages/persistence.md)
