# Rule: Load Validation and Migration

## Ownership

- App owns document versioning and migration transforms.
- Framework owns load orchestration and validation/fallback safety.

## Required Pipeline

1. read raw document
2. run app-level migration hooks in order
3. run package-level validation/fallback
4. apply validated runtime state
5. optionally emit diagnostics

## Validation Semantics

- Runtime set/update: valid -> write; invalid -> reject.
- Load value: valid -> write; invalid + default -> fallback.
- Load value invalid without default -> keep initialized safe value.

## Rules

- Migration functions should be pure and deterministic.
- Prefer one-step migrations (`vN -> vN+1`) over big jump converters.
- No package-internal version branching for app document history.
- UI parser/formatter is UX only, never correctness authority.
