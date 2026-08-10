# `@asyra/persistence`

Read-only load-source, replaceable provider, and synchronous load/save hook
contracts with browser and memory reference providers.

## Owns

- `DocumentLoadSource` and `IPersistenceProvider` contracts
- `SaveHook` and `LoadHook` types
- `IndexedDbPersistence`, `LocalStoragePersistence`, and `MemoryPersistence`
- explicit provider `load`, `save`, and `clear` behavior

## Does not own

Core save scheduling, canonical validation/apply, app version policy,
collaboration logs, authorization, retention, or production storage topology.

## Compose when

Compose a provider when the app needs a local or custom persistence boundary.
Use IndexedDB for the capacity-appropriate browser reference, memory for tests,
and local storage only for small prototypes. Do not treat a reference provider
as a production backend policy.

## Public entrypoints and prerequisites

Use `@asyra/persistence`. A `DocumentLoadSource` provides a name and untrusted
`load()`. `IPersistenceProvider` adds `save(...)` and `clear()`. Core consumers
register synchronous `LoadHook`/`SaveHook` behavior and own when I/O occurs.

## Lifecycle, inputs, outputs, and failure

`load()` returns untrusted `unknown | null`. App load hooks synchronously
transform/version the value, then Core and canonical package owners validate
before apply. `core.save()` serializes through synchronous hooks but performs
no provider I/O. Provider failure is reported to its caller and cannot redefine
whether a runtime transaction committed.

## Relationships

Core owns lifecycle hook ordering. Props Manager, Scene Tree, and System Context
validate and apply their owner slices. Factory owns transaction settlement.
Collaboration/backends may supply checkpoints through app policy but do not
change Persistence ownership.

## Maintained use path

Run `yarn examples:run app-versioned-load-migration` and follow
[Build persistence with app-owned migration](../../build/persistence-migration.md).

## Replacement and disabled behavior

Replace the reference provider with any app provider implementing the public
contract. Apps may use different providers per document/runtime. Without a
provider or load source, Core performs no storage I/O; explicit save data can
still be handed to an app-owned destination.

## Support, migration, and deprecation

App-owned synchronous migration is current. Asynchronous migration inside a
load hook is unsupported. Changing document versions requires an app migration
chain; package versions do not imply document versions. No automatic
transaction-settlement save contract exists.

## Canonical sources and release inventory

- [Package contract](../../../ai/framework/packages/persistence.md)
- [Package manifest](../../../../packages/persistence/package.json)
- [Executable migration source](../../../examples/app-owned-versioned-load-migration.mjs)

The root entrypoint, version, and dependencies are generated from the manifest
and checked by the documentation release gate.
