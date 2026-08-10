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

The maintained helper exports `registerAppVersionMigrations(...)` as copyable
app code, not as a Framework API.

## Flow

1. Register one complete, connected app migration batch.
2. Read an untrusted document from the selected source.
3. Require an explicit string version.
4. Apply synchronous migration steps in deterministic order.
5. Require each step to return exactly its declared next version.
6. Return the migrated candidate to Core.
7. Let package owners validate the complete candidate before apply.
8. Activate the document only after all owners accept it.

Follow the exact
[`app-versioned-load-migration`](../../examples/app-owned-versioned-load-migration.mjs)
helper and its type/regression tests.

## Expected result

The verified example migrates a `v1` document through one connected chain to
`v3`. Missing versions, disconnected/cyclic chains, duplicate registration,
asynchronous results, malformed results, and wrong output versions fail before
canonical apply.

If Persistence is not composed, no storage I/O occurs. If a provider fails,
that failure cannot redefine whether an already settled runtime transaction
committed. The app decides retry and recovery policy.

## Validate

```shell
yarn examples:run app-versioned-load-migration
yarn workspace @asyra/persistence test:local
yarn workspace @asyra/props-manager test:local
```

Add round-trip, invalid-document, unsupported-version, partial-owner failure,
and prior-document preservation tests for your app schema.

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
- [Executable migration example](../../examples/app-owned-versioned-load-migration.mjs)

## Next

- [Learn validation, load, and migration](../learn/validation-load-migration.md)
- [Read the Persistence guide](../reference/packages/persistence.md)
