# Package: @asyra/persistence

## Responsibility

Define read-only document load sources, replaceable persistence providers, and
synchronous serialization/load transformation hooks.

## Owns

- the `DocumentLoadSource` contract: `name` and untrusted `load`;
- the `IPersistenceProvider` contract, which extends `DocumentLoadSource` with
  `save` and `clear` for explicit non-Core owners;
- `SaveHook` and `LoadHook` types;
- browser `IndexedDbPersistence` and `LocalStoragePersistence`, plus the
  process-local `MemoryPersistence` reference provider;
- the convenience `providers` instances.

## Must Not Own

- Core save scheduling, serialization, validation, or canonical apply;
- app document-version policy or migration decisions;
- collaboration update history, awareness, network transport, or durable
  acknowledgement policy;
- server authentication, authorization, retention, or storage topology.

## Contract

- `load()` returns untrusted `unknown | null`; Core and registered app load
  hooks establish eligibility before package-owner validation and apply.
- `SaveHook` receives and returns detached `CoreRawData` synchronously during
  explicit `core.save()` serialization; Core performs no provider I/O.
- `LoadHook` synchronously transforms untrusted input and must return a
  versioned document. App-owned migrations belong in this hook chain.
- Provider writers are not scheduled by Core transaction settlement and their
  failure cannot redefine whether a runtime transaction committed.
- `IndexedDbPersistence` stores structured-clone documents under an
  app-selected key, defaults to `FILE`, and accepts an injected `IDBFactory`
  for isolated runtimes and tests. It is the capacity-appropriate offline
  browser reference for high-detail documents.
- `MemoryPersistence` is ephemeral. `LocalStoragePersistence` accepts an
  app-selected browser storage key and defaults to `FILE`; it remains suitable
  only for small prototypes. None of the reference providers is a production
  backend policy.

## Authorities

- Core lifecycle and failure behavior: `core.md`
- App-owned migration rule: `../rules/load-validation-and-migration.md`
- Supported migration example: `../../../examples/app-owned-versioned-load-migration.mjs`
