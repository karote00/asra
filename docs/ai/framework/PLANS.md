Never record completed plans here.

# Framework Plans

This file tracks framework planning topics and points to detailed references.

## In Progress

- None.

## Near-Term Plans

1. Render-engine boundary

- Keep `@asyra/render` as framework adapter/orchestration, extract the abstract
  `@asyra/render-engine` contract, and move default Pixi implementation into
  `@asyra/render-engine-pixi` before exposing render-mode-specific choices.
- Add explicit engine injection and prove replaceability with a contract-test
  engine without requiring a production 3D engine.
- Reference: `docs/ai/framework/plans/render-engine-boundary-plan.md`

2. Extendable preset

- Allow users to extend preset feature/property behavior through explicit extension points.
- Keep deterministic fallback path: `unregister -> redefine` when extension points are unavailable.
- Reference: `docs/ai/framework/plans/extendable-preset-plan.md`

3. Generic preset composition

- Compose shared defaults, concrete-engine bootstrap, optional capability
  bundles, and app customizations in deterministic order without publishing
  placeholder `2d`, `3d`, or `hybrid` profiles.
- Preserve the current `applyPreset(core)` behavior and use the explicit
  extension/replacement contract from the extendable-preset plan.
- Reference: `docs/ai/framework/plans/preset-composition-plan.md`

4. Canvas debugger

- Add a framework-owned debugging surface to verify render output, render-layer output, and coordinate-space correctness.
- Keep it optional, deterministic, and renderer-boundary-safe so apps can opt in without coupling domain logic to Pixi internals.
- Reference: `docs/ai/framework/plans/canvas-debugger-plan.md`

5. Render delta update pipeline

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
  feature/property/schema/render/input bundles exist and pass the engine
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
