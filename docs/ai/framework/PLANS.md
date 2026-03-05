# Framework Plans

This file tracks framework planning topics and points to detailed references.

## Near-Term Plans

1. Extendable preset
- Allow users to extend preset feature/property behavior through explicit extension points.
- Keep deterministic fallback path: `unregister -> redefine` when extension points are unavailable.
- Reference: `docs/ai/framework/plans/extendable-preset-plan.md`

2. Render-engine boundary
- Split render orchestration from concrete engine implementation.
- Keep Pixi as default engine via preset wiring while enabling engine swap for future domains.
- Reference: `docs/ai/framework/plans/render-engine-boundary-plan.md`

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
