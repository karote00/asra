# Architecture (Framework-First)

Asyra architecture is designed around deterministic execution over declarative information models.

## Layer Model

1. Framework Core Layer
- `@asyra/core`
- orchestration, lifecycle, registrations, persistence hooks

2. Domain Runtime Layer
- `@asyra/scene-tree`
- `@asyra/props-manager`
- `@asyra/system-context`
- `@asyra/selection`

3. Interaction and Input Layer
- `@asyra/feature-system`
- `@asyra/input-system`
- `@asyra/reactive-events`
- `@asyra/interaction-core` (deprecated compatibility)

4. Output Layer
- `@asyra/render`
- `@asyra/ui-context` (optional convenience)

5. Shared Infrastructure
- `@asyra/utils`

## Canonical Runtime Flow

1. Input event arrives.
2. Feature-system executes/sessions.
3. Feature calls app/common APIs.
4. APIs update framework state via transactions.
5. Render reacts to state.
6. UI-context recomputes derived UI properties.
7. UI renders final derived values.

## Architecture Invariants

- Single runtime owner for user-action execution/session/cancel: `feature-system`.
- `interaction-core` remains deprecated compatibility, not a parallel decision runtime.
- State ownership stays split by package boundaries (scene-tree, props-manager, system-context, selection).
- Render and UI are downstream consumers of state.

## Ownership Rules

- Feature-system owns execute/session/cancel runtime decisions.
- Interaction-core is compatibility-only and should not own runtime decisions.
- Scene-tree owns entity graph.
- Props-manager owns property component values and schema validation.
- System-context owns app/system mode flags.
- Render owns graphics engine specifics.
- UI-context owns derived UI state only.

## Registration Surfaces

- Component registration (`defineComponent` / core path).
- Property definition registration.
- Property schema registration.
- Feature registration.
- Render layer registration through core entrypoint.

## Persistence and Loading

- Core orchestrates save/load and load hooks.
- App-level migrations run before package-level validation.
- Package validators apply fallback/reject semantics.
- Optional diagnostics can be emitted after validation without blocking load.

## Package Deep Dives

See:
- `packages/core.md`
- `packages/scene-tree.md`
- `packages/system-context.md`
- `packages/preset.md`
- `packages/selection.md`
- `packages/input-system.md`
- `packages/reactive-events.md`
- `packages/utils.md`
- `packages/props-manager.md`
- `packages/ui-context.md`
- `packages/render.md`
- `packages/feature-system.md`
- `packages/interaction-core.md`
