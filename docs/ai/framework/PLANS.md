# Framework Plans

This file tracks framework planning topics and points to detailed references.

## Near-Term Plans

1. System-context event-to-property update ownership
- Decide where event subscriptions that update system properties should live.
- Target: remove reactive-event subscribe wiring from `@asyra/system-context`, or make core orchestrate updates through system-context APIs.
- This plan is discussion-first before implementation.
- Reference: `docs/ai/framework/plans/system-context-event-to-property-update-ownership.md`

2. Extendable preset
- Allow users to extend preset feature/property behavior through explicit extension points.
- Keep deterministic fallback path: `unregister -> redefine` when extension points are unavailable.
- Reference: `docs/ai/framework/plans/extendable-preset-plan.md`

## Recently Completed

1. Interaction-core retirement (Completed: 2026-03-04)
- Removed runtime/compatibility wiring and completed package retirement.
- Reference: `docs/ai/framework/plans/completed/interaction-core-retirement-plan.md`

2. UI-context store surface removal (Completed: 2026-03-04)
- Removed ui-context scene/selection store exports and moved default aggregation wiring to preset observers.
- App provider now consumes ui-context published properties only.
- Reference: `docs/ai/framework/plans/completed/ui-context-store-surface-removal-plan.md`

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
