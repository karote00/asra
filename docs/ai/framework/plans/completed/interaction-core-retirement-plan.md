# Interaction-Core Retirement Plan

## Goal

Retire `@asyra/interaction-core` after all runtime interaction behavior is fully owned by `@asyra/feature-system` + core/preset contracts.

## Scope

In scope:
- remove remaining runtime dependency paths to `@asyra/interaction-core`
- remove deprecated compatibility wiring from core/preset initialization
- keep migration guidance for app-level adopters

Out of scope:
- reintroducing interaction policies into framework internals
- app-specific behavior policy design

## Exit Criteria

1. No runtime package imports `@asyra/interaction-core` for active flows.
2. Core/preset bootstrap works without any interaction-core registration.
3. Docs and migration notes cover replacement APIs and flows.
4. Package can be archived or removed without behavior regression.

## Implementation Slices

1. Inventory remaining references and call paths.
2. Replace any compatibility adapters with feature-system/core APIs.
3. Remove deprecated init wiring and exports.
4. Update tests/docs and release notes.
