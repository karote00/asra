# Framework Plans

This file tracks framework planning topics and points to detailed internal references.

## Near-Term Plans

1. Framework load validation pipeline
- Core orchestrated validation across props/scene/system.
- Optional diagnostics output.
- Reference: `docs/internal/props-manager-file-load-validation-plan.md`

2. App-level migration pipeline formalization
- Versioned hook chain and migration templates.
- Reference: `docs/internal/props-manager-app-level-migration-plan.md`

3. Unit-aware property model
- Support value+unit semantics in schema/aggregates.
- Keep auto-layout implementation out of this phase.
- Reference: `docs/internal/property-schema-validation-integration-plan.md`

4. UI aggregate helpers
- Mixed values and mixed units (`MIX`) helpers.
- App-level registration remains first-class.
- Reference: `docs/internal/property-schema-validation-integration-plan.md`

## Mid-Term Plans

1. Builtin extraction readiness
- Keep builtins modular and relocatable.
- Reference: `docs/internal/builtin-registry-consolidation-plan.md`

2. Typed narrowing cleanup
- Replace structural casts with explicit guards.
- Reference: `docs/internal/props-manager-typed-setter-refactor-plan.md`

3. Render abstraction growth
- Expand non-Pixi adapter guidance and examples.
- Reference: `docs/internal/framework-enhancement-custom-graphics.md`

4. Interaction-core retirement
- Keep compatibility only during transition.
- Remove after all runtime decisions are feature-system-only.
- Reference: `docs/internal/framework-audit.md`

5. Cascade unregister orchestration
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
