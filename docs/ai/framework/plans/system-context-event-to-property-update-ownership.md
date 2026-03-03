# Plan: System-Context Event-to-Property Update Ownership

## Status

- Proposed on March 4, 2026.
- Discussion required before acceptance.

## Goal

Define a consistent framework ownership model for handling events that mutate system-context managed properties.

Target direction:
- no reactive-event subscribe wiring inside `@asyra/system-context`, or
- core owns the orchestration path and calls system-context APIs directly.

## Problem Statement

Today, event-to-state mutation wiring can be split across package boundaries, which makes ownership less explicit and increases the chance of duplicated wiring.

For framework clarity, we need one canonical place that maps incoming events to system property mutations.

## Options To Evaluate

1. Preset-owned subscriptions (recommended baseline)
- Keep `@asyra/system-context` as pure managed-property storage APIs.
- Move event subscribe wiring to preset defaults (same ownership style as render/ui-context channel observers).
- Pros: consistent with current preset-as-default-wiring direction.
- Cons: requires preset lifecycle discipline for subscribe/unsubscribe.

2. Core-owned orchestration
- Core subscribes to framework events and calls system-context managed-property APIs.
- Pros: one central runtime owner, explicit startup lifecycle.
- Cons: core may become heavier and less minimal.

3. Hybrid registration contract
- Core provides a registration API for "event -> system property updater" handlers.
- Preset registers default mappings through core.
- Pros: explicit extension point, keeps system-context storage-only.
- Cons: adds API surface and migration work.

## Scope

1. Ownership boundary between `@asyra/system-context`, `@asyra/core`, and `@asyra/preset`.
2. Subscribe lifecycle (register/unregister/dispose) for event listeners that mutate system properties.
3. Test coverage updates for chosen ownership.
4. Docs updates for package contracts and startup flow.

## Key Discussion Questions

1. Should `@asyra/system-context` contain zero event subscribe logic?
2. Should core be allowed to own default event-to-system mutation wiring?
3. If preset owns defaults, what is the required unregister/dispose contract?
4. What API shape gives user override without touching framework internals?
5. How do we prevent duplicate handlers for the same event/property mapping?

## Proposed Decision Criteria

1. Clear single owner of event-to-system mutation routing.
2. Minimal coupling and predictable startup/dispose lifecycle.
3. Extensible by app/preset without changing framework internals.
4. No duplicated default wiring.
5. Tests can assert ownership and side effects deterministically.

## Draft Implementation Steps (after decision)

1. Pick ownership model (preset-owned, core-owned, or hybrid registration).
2. Refactor/remove subscribe wiring from `@asyra/system-context` if required by decision.
3. Introduce the selected registration/orchestration path.
4. Move default mappings to chosen owner and remove duplicates.
5. Add regression tests for lifecycle and mapping correctness.
6. Update framework docs (`packages/system-context.md`, `packages/core.md`, `packages/preset.md`, and `API_SURFACES.md`).
7. Append decision rationale to `docs/ai/framework/decisions/releases/unreleased.md`.

## Exit Criteria

1. One explicit owner for event-to-system property mutation routing.
2. `@asyra/system-context` boundary matches decided role (storage-only if chosen).
3. Default wiring location is documented and tested.
4. Extension/override path is explicit for app/preset users.
