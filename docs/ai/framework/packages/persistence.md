# Package: @asyra/persistence

## Responsibility

Define replaceable document persistence providers and synchronous save/load
transformation hooks used by Core.

## Owns

- the `IPersistenceProvider` contract: `save`, `load`, and `clear`;
- `SaveHook` and `LoadHook` types;
- browser `LocalStoragePersistence` and process-local `MemoryPersistence`
  reference providers;
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
- `SaveHook` receives and returns `CoreRawData` synchronously before provider
  I/O.
- `LoadHook` synchronously transforms untrusted input and must return a
  versioned document. App-owned migrations belong in this hook chain.
- Provider failure is reported by the Core persistence lifecycle and does not
  redefine whether the preceding runtime transaction committed.
- `MemoryPersistence` is ephemeral. `LocalStoragePersistence` accepts an
  app-selected browser storage key and defaults to `FILE`; neither provider is
  a production backend policy.

## Authorities

- Core lifecycle and failure behavior: `core.md`
- App-owned migration rule: `../rules/load-validation-and-migration.md`
- Supported migration example: `../../../examples/app-owned-versioned-load-migration.mjs`
