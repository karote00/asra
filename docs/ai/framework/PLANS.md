Never record completed plans here.

# Framework Plans

This file tracks framework planning topics and points to detailed references.

## Near-Term Plans

1. Canvas Pipeline Debugger

- Add an optional DEV-runtime surface for app developers to inspect canonical
  Render input, layer evaluation, and engine-neutral pre-handoff evidence.
- Do not inspect pixels, hit testing, concrete-engine results, or reconstruct
  missing output from debug geometry.
- Reference: `docs/ai/framework/plans/canvas-pipeline-debugger-plan.md`

2. Declarative property type redefinition

- Let app developers inspect and atomically redefine one config-mode property
  type after preset composition and before `core.start()`.
- Keep relation, render strategy, UI-context, and migration changes explicit
  through existing Core APIs; do not infer that removed and added fields are
  semantically equivalent.
- Provide typed custom-field consumption without requiring app casts in the
  normal property update, render strategy, or UI aggregation paths.
- Reference: `docs/ai/framework/plans/property-type-redefinition-plan.md`

3. Render delta update pipeline

- Apply data-channel deltas directly in render update flow to avoid full computed-data rehydrate.
- Use render-side cached snapshots + key-based invalidation for heavy geometry.
- Reference: `docs/ai/framework/plans/render-delta-update-plan.md`

## Deferred Plans

1. Auto-layout behavior engine.

- Reference: `docs/ai/framework/plans/unit-conversion-and-ui-aggregation-plan.md`

2. App-level migration pipeline formalization

- Versioned hook chain and migration templates.
- Reference: `docs/ai/framework/plans/props-manager-app-level-migration-plan.md`

3. AI agent runtime

- Optional reusable package for natural-language planning, structured action validation, transaction-bounded execution, provider replacement, and app-owned domain actions.
- Reference: `docs/ai/framework/plans/ai-agent-runtime-plan.md`

4. Unit-aware property model (auto-layout-oriented)

- Support value+unit semantics in schema/aggregates.
- Keep auto-layout implementation out of this phase.
- Reference: `docs/ai/framework/plans/unit-conversion-and-ui-aggregation-plan.md`

5. UI aggregate helpers (lowest priority, auto-layout-related)

- Mixed values and mixed units (`MIX`) helpers.
- App-level registration remains first-class.
- Reference: `docs/ai/framework/plans/unit-conversion-and-ui-aggregation-plan.md`

6. Official 2D/3D/hybrid preset profiles

- Publish a render-mode profile only after its concrete engine and canonical
  feature/property/schema/render/input default modules exist and pass the engine
  boundary contract.
- `3d` requires a supported 3D engine; `hybrid` additionally requires an
  explicit multi-engine composition and interaction contract.
- Do not expose empty, placeholder, or capability-incomplete profiles.
- Reference: `docs/ai/framework/plans/preset-2d-3d-init-profile-plan.md`

7. Yjs network collaboration (final collaboration architecture phase)

- Add provider/room/auth lifecycle, remote canonical apply, origin/dedupe,
  awareness, offline/server persistence, and reconnect/convergence contracts.
- Depends on stable local transaction atomicity, state ownership, replay, and
  selective instance boundaries.
- Reference: `docs/ai/framework/plans/yjs-network-collaboration-plan.md`

8. Advanced collaborative conflict policies (Yjs collaboration sub-plan)

- Reference: `docs/ai/framework/plans/collaborative-conflict-policies-plan.md`
