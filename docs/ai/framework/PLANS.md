# Framework Plans

This file tracks framework planning topics and points to detailed references.

## Near-Term Plans

1. Preset 2D/3D init profiles
- Provide explicit preset init profiles (`2d`, `3d`, `hybrid`) for fast product bootstrap.
- Preserve deterministic composition (`shared -> profile -> app override`) and backward-compatible default path.
- Reference: `docs/ai/framework/plans/preset-2d-3d-init-profile-plan.md`

2. Extendable preset
- Allow users to extend preset feature/property behavior through explicit extension points.
- Keep deterministic fallback path: `unregister -> redefine` when extension points are unavailable.
- Reference: `docs/ai/framework/plans/extendable-preset-plan.md`

3. Render-engine boundary
- Split render orchestration from concrete engine implementation.
- Keep Pixi as default engine via preset wiring while enabling engine swap for future domains.
- Reference: `docs/ai/framework/plans/render-engine-boundary-plan.md`

4. Property-driven computed sync
- Replace generic property-to-computed refresh with explicit property-owned sync wiring.
- Keep `element -> computed -> props` flow, and add the symmetric `props -> computed` path without broad recomputation.
- Reference: `docs/ai/framework/plans/property-driven-computed-sync-plan.md`

5. Canvas debugger
- Add a framework-owned debugging surface to verify render output, render-layer output, and coordinate-space correctness.
- Keep it optional, deterministic, and renderer-boundary-safe so apps can opt in without coupling domain logic to Pixi internals.
- Reference: `docs/ai/framework/plans/canvas-debugger-plan.md`

## Deferred Plans

1. Auto-layout behavior engine.
 - Reference: `docs/ai/framework/plans/unit-conversion-and-ui-aggregation-plan.md`
2. Advanced collaborative conflict policies.
 - Reference: `docs/ai/framework/plans/collaborative-conflict-policies-plan.md`
3. App-level migration pipeline formalization
 - Versioned hook chain and migration templates.
 - Reference: `docs/ai/framework/plans/props-manager-app-level-migration-plan.md`
4. Unit-aware property model (auto-layout-oriented)
 - Support value+unit semantics in schema/aggregates.
 - Keep auto-layout implementation out of this phase.
 - Reference: `docs/ai/framework/plans/unit-conversion-and-ui-aggregation-plan.md`
5. UI aggregate helpers (lowest priority, auto-layout-related)
 - Mixed values and mixed units (`MIX`) helpers.
 - App-level registration remains first-class.
 - Reference: `docs/ai/framework/plans/unit-conversion-and-ui-aggregation-plan.md`

## Decision Logging Rule

- When a plan item changes app contracts/runtime boundaries, append rationale to `decisions/releases/unreleased.md`.
- If the decision is cross-cutting (framework + app), also append `docs/ai/decisions/releases/unreleased.md`.

## Completed Plans

- Completed plan records live in `docs/ai/framework/plans/completed/`.
