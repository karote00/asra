# Rule: Deprecation Lifecycle

## Stages

1. Active
- fully supported and recommended

2. Deprecated
- still available
- warning/documentation marker required
- no new feature development on deprecated path

3. Compatibility-only
- only regression/security fixes
- migration target is already available and documented

4. Removed
- major-version removal after migration window

## Required Actions

- mark status in package docs and API comments
- add `@deprecated` JSDoc on public exports/types
- add a runtime `warn-once` message for JavaScript consumers
- document migration target and minimal migration steps
- avoid introducing new dependencies on deprecated modules
- if publishing externally, mark package versions with `npm deprecate` on registry

## Framework Application

- New runtime flows should be implemented in `@asyra/feature-system`.
