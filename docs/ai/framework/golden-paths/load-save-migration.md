# Golden Path: Load/Save with Migration

## Preconditions

- Document payload includes version metadata.
- App has migration responsibility for domain-level schema evolution.

## Steps

1. Define version increment and migration targets
- identify `fromVersion -> toVersion` steps
- keep migration steps explicit and ordered

2. Register app-level load migration hooks
- apply migration transforms before package state application
- keep migration functions pure and deterministic

3. Run framework validation/fallback pipeline
- package validators handle invalid field values
- runtime remains stable even with partial invalid input

4. Apply migrated/validated state
- load scene-tree, props, system, and selection state via framework APIs

5. Save in latest schema
- emit latest-version payload shape on save
- do not persist legacy shape after successful load

## Verification Checklist

- Legacy version file loads successfully after migration.
- Invalid loaded fields fallback without runtime corruption.
- Save output uses current version shape.
- Re-load saved file produces equivalent runtime state.

## Common Failure Cases

- Migration hooks run after state application (wrong order).
- Package internals include app document version branching.
- Validation logic relies on UI parsers instead of framework validators.
