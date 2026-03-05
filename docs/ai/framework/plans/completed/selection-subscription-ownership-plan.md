# Selection Subscription Ownership Plan

## Completion

- Status: Completed
- Completed On: 2026-03-05
- Final Decision: Selection subscribe ownership is preset-only; selection package has no subscribe bootstrap side effects.
- Outcome Summary: Core publishes selection mutations; preset applies runtime updates via shared-channel observers and cleanup wiring.
- Exit Criteria: Met

## Goal

Move default selection event subscription wiring from `@asyra/selection` to `@asyra/preset`, aligning with current framework boundary rules.

## Context

`@asyra/selection` currently initializes reactive-event subscriptions as a package side effect.
This mixes selection state ownership with default wiring ownership and differs from current framework direction used by render/ui-context/system-context defaults.

## Scope

In scope:
- remove built-in selection subscribe bootstrap side effects from `@asyra/selection`
- keep selection transaction publishing in core selection APIs (no selection package subscribe side effects)
- apply selection runtime state from preset-owned `selection` shared-channel observer
- keep selection package focused on selection state/query primitives
- preserve current default behavior when `applyPreset(core)` is used

Out of scope:
- changing selection data model semantics
- redesigning selection event payload shapes
- introducing app-specific selection policy into framework packages

## Target Behavior

1. Ownership clarity
- `@asyra/selection` owns selection state classes and manager APIs only.
- `@asyra/core` selection APIs publish selection transaction updates to shared `selection` channel.
- `@asyra/preset` applies selection runtime state via shared `selection` channel observer.

2. Explicit startup wiring
- default selection channel observers are registered during `applyPreset(core)`.
- custom apps can skip/replace preset wiring.

3. Deterministic behavior
- selection transaction updates continue to route through selection shared channel by default.
- remove-element selection cleanup still works in default preset wiring.

## Implementation Slices

1. Plan and boundary docs
- add plan entry and ownership notes

2. Subscription extraction
- remove side-effect subscription init from `@asyra/selection`
- add preset-owned selection subscription registration module

3. Preset integration
- call selection subscription registration from `applyPreset(core)` after default selections are registered
- keep idempotent registration behavior

4. Validation and tests
- add/update tests for default selection event behavior under preset ownership
- ensure selection package tests cover state logic without relying on reactive-event side effects

## Success Criteria

- `@asyra/selection` has no internal reactive-event subscribe bootstrap side effects
- preset default selection behavior remains working after `applyPreset(core)`
- remove-element event still updates default element selection deterministically
- ownership docs reflect preset-owned default wiring

## Risks

1. Missing preset apply
- apps that rely on previous implicit side effects may lose selection event behavior until preset is applied

2. Subscription duplication
- preset registration must remain idempotent to avoid duplicate event handling
