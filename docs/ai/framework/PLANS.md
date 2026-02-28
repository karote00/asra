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

5. User-action completion event after transaction undo-commit
- After `DataTransact.commitUndo()` finalizes one user action unit, publish a completion event that indicates "this user action is done."
- Keep event ownership in preset (event name/definition) while `@asyra/reactive-events` remains infra-only.
- Expose app-facing subscribe path through `core.xxx` so app code can run post-action side effects deterministically.
- Reference: `docs/internal/user-action-completion-event-plan.md`

## Completed Plan Archive

Completed items are archived by category in:

- `docs/ai/framework/plans/completed/README.md`
- `docs/ai/framework/plans/completed/architecture-and-bootstrap.md`
- `docs/ai/framework/plans/completed/property-runtime.md`
- `docs/ai/framework/plans/completed/events-and-registry.md`

When an item is moved to completed archive, add/update release rationale in:

- `docs/ai/framework/decisions/releases/unreleased.md`
- If scope crosses framework+app boundaries, also append:
  - `docs/ai/decisions/releases/unreleased.md`

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
