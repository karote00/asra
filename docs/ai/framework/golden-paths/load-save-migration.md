# Golden Path: Load/Save with Migration

## Preconditions

- Document payload includes version metadata.
- App has migration responsibility for domain-level schema evolution.

## Steps

1. Define version increment and migration targets

- identify independent `fromVersion -> toVersion` transforms
- treat version ids as opaque; numeric continuity is not required
- require the complete batch to form one connected linear chain

2. Register one app-level migration dispatcher

- apply migration transforms before package state application
- keep migration functions pure and deterministic
- validate the batch before Core registration: one head/tail, unique source and
  target, a complete transition in every dense array slot, and no
  self-transition, branch, merge, disconnected component, or cycle
- compile the batch into one synchronous `core.registerLoadHook(...)`
  dispatcher; array order does not define the chain
- install at most one non-empty batch per Core instance from this helper; reject
  a second non-empty installation before another hook is added, while empty
  batches remain no-ops and do not claim the installation slot
- repeatedly look up only the current document version and require each
  executed transform to return exactly its declared `to` version
- perform repeated lookup as one synchronous dispatcher loop; never recursively
  call `core.load(...)`
- require each transform to return synchronously with a non-array document and
  string version; report a Promise as an app-owned asynchronous-result failure,
  contain its eventual rejection, and report any other invalid transform result
  as an invalid-step-result failure
- stop normally when no transition matches; pass the terminal, unknown, future,
  or otherwise unmatched string version unchanged to package validation
- rely on Core's per-load load-hook snapshot; the app transition registry is
  fixed when its dispatcher is registered
- reusable copyable helper:
  `docs/public/build/persistence-migration.md`

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
- A document starting in the middle of the chain invokes only its matching
  suffix; earlier transforms are not called.
- A terminal or unmatched string version bypasses transforms but still enters
  package validation/apply.
- Disconnected, branching, merging, duplicate, self-looping, or cyclic batches
  fail registration before installing a Core load hook.
- Missing-version eligibility and invalid/Promise transform or hook results stop
  before package validation and apply.
- Invalid loaded fields fallback without runtime corruption.
- Diagnostics mutation, hook throw, or evidence assembly failure does not
  change the successful load outcome.
- Save output uses current version shape.
- Re-load saved file produces equivalent runtime state.

## Common Failure Cases

- Migration hooks run after state application (wrong order).
- Migration steps are invoked as a fixed queue instead of conditional lookup.
- Registration accepts multiple disconnected chains or graph cycles.
- Package internals include app document version branching.
- Validation logic relies on UI parsers instead of framework validators.
