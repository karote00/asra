# Completed Plans: Property Runtime

## 1. Property runtime genericization

- Completed on February 27, 2026.
- Property components are now primarily defined via `definePropertyComponent` config.
- Element/property relationships are standardized around ID-based references.
- Reference: `docs/internal/property-runtime-genericization-plan.md`

## 2. Props-manager pending change cleanup at transaction boundary

- Completed on March 2, 2026.
- Added transaction-end cleanup for pending `propsManager.changes` to prevent cross-action leakage.
- Unified add/remove property subscribe paths to use `propsManager.commitChanges(options)` for consistent commit+cleanup behavior.
- Added regression test coverage for transaction-end cleanup behavior.
