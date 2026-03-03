# Plan: UI-Context Data-Channel Subscriber Registration

## Status

- Accepted on March 3, 2026.
- Planned (not started).

## Goal

After render-side YJS observer registration moved to preset/core contracts, apply the same data-channel pattern for `ui-context` so UI derived-state subscriptions are configurable without editing framework internals.

## Agreed Direction

1. `ui-context` should not hardcode YJS observer wiring in package internals.
2. Preset provides default `ui-context` channel subscriber registration.
3. Framework exposes registration APIs by channel name + handler (no direct YJS object passing in app/preset code).
4. Local-first transaction flow stays unchanged; shared sync stays opt-in via `options.shared`.

## Scope

1. `ui-context` subscription registration lifecycle contracts.
2. Preset default wiring for scene-tree/selection related UI aggregates.
3. Cleanup of direct/hardcoded YJS subscriptions inside `ui-context` package.
4. Tests/docs for the new ownership boundary.

## Implementation Steps

1. Add `ui-context` observer registration surface in core-level API (parallel to render observer registration style).
2. Move current default `ui-context` YJS subscribe logic into preset-owned registration modules.
3. Ensure channel-based registration uses channel names only, with handlers defined by preset/app.
4. Keep `ui-context` package focused on derivation/update logic only (no built-in subscribe bootstrap).
5. Add regression tests:
- default preset registration updates UI aggregates from shared channel changes.
- unregistered channel does not break local flow.
- unregister/dispose path works without stale observers.
6. Update framework docs (`API_SURFACES`, `packages/ui-context.md`, `packages/preset.md`, workflow notes) and release decision history.

## Exit Criteria

1. `ui-context` package contains no hardcoded YJS subscription bootstrap.
2. Default `ui-context` observer wiring is preset-owned.
3. App/framework users can register `ui-context` channel handlers by channel name.
4. Tests and docs reflect the ownership split (`user`, `preset`, `framework`).
