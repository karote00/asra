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
- register synchronous adjacent steps in version order
- rely on Core's per-load registration snapshot; hooks registered during a load
  begin with the next load
- reject missing/unsupported app versions and require every step to return its
  declared next version
- reusable copyable helper:
  `docs/examples/app-owned-versioned-load-migration.mjs`

3. Run framework validation/fallback pipeline

- package validators handle invalid field values
- runtime remains stable even with partial invalid input
- each package returns an owner-issued one-shot artifact, not plain trusted data

4. Apply migrated/validated state

- apply the Core version, validated scene-tree and props data, and persisted
  System Context values through their owning framework APIs
- return each complete validated artifact to the same package owner; apply does
  not rerun validators

5. Observe optional load diagnostics

- after successful canonical apply, Core may assemble detached post-apply load
  evidence only when validation diagnostics and an observer exist
- evidence uses the normalized version, validated package apply inputs, and
  applied managed-system serialization; it is not a canonical state artifact
  or state owner
- diagnostics mutation or throw remains observational; evidence assembly
  failure skips emission without changing the successful load, and one hook's
  failure does not prevent later current hooks

6. Save in latest schema

- emit latest-version payload shape on save
- do not persist legacy shape after successful load

## Verification Checklist

- Legacy version file loads successfully after migration.
- Already-current input bypasses semantic transforms but still validates.
- Missing/unsupported versions and invalid/Promise hook results stop before
  package validation and apply.
- Invalid loaded fields fallback without runtime corruption.
- Diagnostics mutation, hook throw, or evidence assembly failure does not
  change the successful load outcome.
- Save output uses current version shape.
- Re-load saved file produces equivalent runtime state.

## Common Failure Cases

- Migration hooks run after state application (wrong order).
- Package internals include app document version branching.
- Validation logic relies on UI parsers instead of framework validators.
