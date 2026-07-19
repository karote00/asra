# Rule: Load Validation and Migration

## Ownership

- App owns document versioning and migration transforms.
- Framework owns load orchestration and validation/fallback safety.

## Required Pipeline

1. read raw document
2. run app-level migration hooks in order
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
- Prefer one-step migrations (`vN -> vN+1`) over big jump converters.
- Register synchronous app hooks in declared step order. Missing and unsupported
  versions are app-policy failures; each successful step must return its declared
  next version. Core snapshots the chain before each load. Promise results are
  not supported by the synchronous Core load contract.
- Package validation results are instance-bound, one-shot artifacts. Plain,
  foreign, or reused results cannot be applied, and artifact apply never reruns
  validators.
- No package-internal version branching for app document history.
- UI parser/formatter is UX only, never correctness authority.

Reusable app-owned example:

- `docs/examples/app-owned-versioned-load-migration.mjs`
