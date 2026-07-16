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
- stable feature/property extension target manifest and one application lifetime

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
- `applyPreset(core, { extensions, renderEngineFactory?, dependencies? })`
  accepts an ordered extension array without changing the other overloads and
  returns one `PresetApplication` lifecycle handle.
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

## Extension Target Contract

- `PRESET_EXTENSION_TARGETS` is the stable public key registry:
  - `FEATURE_REGISTRATIONS` is the app-owned feature registration hook.
  - `PROPERTY_SCHEMAS[propertyType]` identifies each bundled schema default.
  - `PROPERTY_RUNTIMES[propertyType]` identifies each bundled property runtime
    definition, including the dynamic `custom` runtime.
- `getPresetExtensionTarget(key)` and `getPresetExtensionTargets()` return
  detached metadata with stable key/name, capability kind, supported strategies,
  and owner `{ packageName: '@asyra/preset', name: 'default-preset' }`.
- target manifest order is all property schemas, then all property runtimes,
  then the feature-registration hook. Extension order within the feature target
  is `before -> default or replace -> after -> append`, preserving caller array
  order within a strategy bucket.
- property schema/runtime targets support explicit `replace`. The feature hook
  supports `before`, `after`, `append`, and `replace`.
- one explicit `replace` bypasses the default installer and never enters the
  ordinary duplicate-registration path.
- missing target, duplicate extension key, invalid/unsupported strategy,
  replace conflict, apply failure, target-not-applied, and cleanup failure use
  the stable public `ExtensionContractError` contract.
- `PresetApplication.unregisterTarget(key)` runs that target's owned cleanup in
  reverse order. Cleanup failure keeps the target applied and blocks redefine;
  successful cleanup allows app redefinition through public Core APIs.
- `PresetApplication.dispose()` disposes the extension-target registrations it
  owns in reverse manifest order. It does not claim ownership of unrelated app
  policy or infer product mode from renderer/engine capability.
- if later preset startup wiring fails after target application, `applyPreset`
  disposes the applied target registrations before rethrowing; cleanup failure
  remains the structured failure and is never reported as successful rollback.

## Ownership Boundary

- `@asyra/utils` resolves target identity, ordering, conflicts, errors, and
  application cleanup state.
- `@asyra/feature-system` owns feature handlers/subscriptions and their disposer.
- `@asyra/props-manager` owns active-use validation and scoped schema/runtime
  unregister.
- Core only exposes the public registration façade.
- preset supplies defaults and hooks; app supplies customization policy and the
  custom installer/cleanup implementation.

## Validation Checklist

- Applying preset multiple times does not corrupt runtime registration state.
- Target metadata is detached and stable, and startup applies targets in the
  documented order.
- Unsupported direct extension uses `unregisterTarget -> Core redefine`, with
  no duplicate tolerance or hidden fallback state.
- App startup works when preset is applied explicitly.
- Default startup creates a fresh Pixi engine per target `Render` instance.
- A custom factory replaces the default without a Pixi singleton fallback.
- Custom engines pass `@asyra/render-engine/testing` contract tests.
- Ownership triage is explicit for new changes:
  - does this belong to user customization, preset defaults, or framework runtime owner?
  - does this preset default help users quickly get working functionality without locking extension paths?
