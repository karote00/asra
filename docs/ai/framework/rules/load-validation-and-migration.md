# Rule: Load Validation and Migration

## Ownership

- App owns document versioning and migration transforms.
- Framework owns load orchestration and validation/fallback safety.

## Required Pipeline

1. read raw document
2. run the app-owned conditional migration dispatcher as one load hook
3. run package-level validation/fallback
4. return each owner-issued validated artifact to its package apply facade
5. optionally emit diagnostics

## Validation Semantics

- Runtime set/update: valid -> write; invalid -> reject.
- Load value: valid -> write; invalid + default -> fallback.
- Load value invalid without default -> keep initialized safe value.
- Extension-provided property schemas must preserve the same runtime reject and load fallback semantics.
- App migrations may reshape versioned document data before validation, but package validators remain the safety boundary.

## Rules

- Migration functions should be pure and deterministic.
- Register one complete dense app-owned array batch of synchronous
  `{ from, to, migrate }` transitions; every array slot must contain one complete
  step. Version ids are opaque and may be non-contiguous, but the batch must form
  exactly one connected linear chain: one head/tail, unique source and target,
  no self-transition, branch, merge, disconnected component, or cycle.
- Validate the complete batch before installing one dispatcher through
  `core.registerLoadHook(...)`. At load time, look up only the current version,
  require every executed transform to return its declared `to`, and repeat with
  the returned document. A string version with no matching transition normally
  terminates migration and continues unchanged to package validation. Repeated
  lookup is one synchronous dispatcher loop and never re-enters `core.load(...)`.
- Install at most one non-empty batch per Core instance from one app helper
  module. A second non-empty registration fails before another hook is added.
  Empty batches are no-ops that do not claim the installation slot, and the
  app-owned per-Core guard must not become a Core schema registry.
- Missing document-version eligibility remains app policy. Every registered
  transform must synchronously return a non-array document object with a string
  version. A Promise is an app-owned asynchronous-result failure whose eventual
  rejection is contained; any other invalid transform result is an
  invalid-step-result failure. Core snapshots its load hooks before each load
  and does not inspect the app transition registry.
- Package validation results are instance-bound, one-shot artifacts. Plain,
  foreign, or reused results cannot be applied, and artifact apply never reruns
  validators.
- No package-internal version branching for app document history.
- UI parser/formatter is UX only, never correctness authority.

Reusable app-owned example:

- `docs/public/build/persistence-migration.md`
