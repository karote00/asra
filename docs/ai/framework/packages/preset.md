# Package: @asyra/preset

## Responsibility

Optional preset bootstrap for framework defaults.

Preset role contract:

- preset is the default settings package that supports framework startup
- preset is not app-domain ownership
- preset is not framework-runtime ownership
- preset provides default initialization and fast-start wiring that users can adopt, replace, or skip

## Owns

- explicit application of bundled default registrations
- preset-level coordination across framework packages
- builtin custom event-definition registrations via core/reactive-events registry
- builtin component registrations
- builtin property-component registrations
- builtin property-schema registrations
- builtin render-layer registrations
- builtin selection registrations
- builtin base/system/aggregate UI-property registrations
- default shared data-channel registration (`sceneTree`, `selection`, `props`)
- default data-channel observer/subscription registration (render + ui-context quick-start behavior)
- default selection shared-channel apply wiring and scene-tree-driven selection cleanup
- default `@asyra/render-engine-pixi` factory selection/injection

## Must Not Own

- core lifecycle ownership
- domain/package runtime state ownership
- app business/domain workflows
- render-engine runtime/resource ownership
- engine singleton fallback or concrete-engine introspection

## Current Contract

- `applyPreset(core)` applies preset-provided registrations using explicit app call.
- `applyPreset(core)` injects `createPixiRenderEngine` as the default factory for
  the target `Render` instance. Each `Render` creates/owns its engine at init.
- `applyPreset(core, dependencies)` preserves the existing explicit dependency
  bundle path and still selects the default Pixi factory.
- `applyPreset(core, { renderEngineFactory, dependencies? })` replaces the
  default with an explicit contract-compatible factory before Core startup.
- preset selects and injects the factory; it never constructs, stores, or
  destroys the resulting engine instance/resources.
- `applyPreset(core)` expects `CorePresetInstallAPIs` (concrete required APIs, no optional capability probing).
- `applyPreset(core)` is the owner of framework default/builtin wiring that was previously implicit or app-local.
- preset owns default event names/definitions and registers them through `core.registerEvent(...)` while `@asyra/reactive-events` provides event infra (registry + publish/subscribe wiring).
- preset registers default shared-channel observers (render + ui-context scene-tree/selection) by channel name instead of touching YJS instances directly.
- preset computes default ui-context aggregates from `sceneTree` + `selection` subscriptions (no ui-context-owned scene/selection stores).
- preset applies selection changes from the shared `selection` channel to selection runtime state and handles default cleanup for removed elements.
- preset mirrors direct selection events (for example undo/redo replay path) to selection runtime, render selection store, and ui-context selection state so visual selection stays in sync even when changes bypass shared-channel observers.
- preset defines concrete canvas selection channel profile constants (element/vector point/vector segment) for default channel identity.
- preset exports canvas selection profile constants for app usage (`SelectionChannels`, `SelectionActions`).
- preset declares default selections via `core.defineSelection(...)` (with `registerSelection` compatibility retained in core).
- preset declares default UI/system properties via `core.defineUIProperty(...)` and `core.defineSystemProperty(...)` (register aliases remain compatibility-only).

## Validation Checklist

- Applying preset multiple times does not corrupt runtime registration state.
- App startup works when preset is applied explicitly.
- Default startup creates a fresh Pixi engine per target `Render` instance.
- A custom factory replaces the default without a Pixi singleton fallback.
- Custom engines pass `@asyra/render-engine/testing` contract tests.
- Ownership triage is explicit for new changes:
  - does this belong to user customization, preset defaults, or framework runtime owner?
  - does this preset default help users quickly get working functionality without locking extension paths?
