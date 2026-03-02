# Framework Plans

This file tracks framework planning topics and points to detailed internal references.

## Near-Term Plans

1. No active near-term plans

## Mid-Term Plans

1. Typed narrowing cleanup
- Replace structural casts with explicit guards.
- Reference: `docs/internal/props-manager-typed-setter-refactor-plan.md`

2. Render abstraction growth
- Expand non-Pixi adapter guidance and examples.
- Reference: `docs/internal/framework-enhancement-custom-graphics.md`

3. Interaction-core retirement
- Keep compatibility only during transition.
- Remove after all runtime decisions are feature-system-only.
- Reference: `docs/internal/framework-audit.md`

4. Cascade unregister orchestration
- Unregister parent registrations with safe owned sub-unregister behavior.
- Protect shared resources via ownership/refcount model.
- Reference: `docs/internal/cascade-unregister-plan.md`

## Deferred Plans

1. Auto-layout behavior engine.
 - Reference: `docs/internal/property-schema-validation-integration-plan.md`
2. Multi-engine reference implementations.
 - Reference: `docs/internal/framework-enhancement-custom-graphics.md`
3. Advanced collaborative conflict policies.
 - Reference: `docs/internal/asyra_audit/KernelRealityAudit_0.5.md`
4. App-level migration pipeline formalization
 - Versioned hook chain and migration templates.
 - Reference: `docs/internal/props-manager-app-level-migration-plan.md`
5. Unit-aware property model (auto-layout-oriented)
 - Support value+unit semantics in schema/aggregates.
 - Keep auto-layout implementation out of this phase.
 - Reference: `docs/internal/property-schema-validation-integration-plan.md`
6. UI aggregate helpers (lowest priority, auto-layout-related)
 - Mixed values and mixed units (`MIX`) helpers.
 - App-level registration remains first-class.
 - Reference: `docs/internal/property-schema-validation-integration-plan.md`

## Decision Logging Rule

- When a plan item changes app contracts/runtime boundaries, append rationale to `decisions/releases/unreleased.md`.
- If the decision is cross-cutting (framework + app), also append `docs/ai/decisions/releases/unreleased.md`.