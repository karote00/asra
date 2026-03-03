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

## Must Not Own

- core lifecycle ownership
- domain/package runtime state ownership
- app business/domain workflows

## Current Contract

- `applyPreset(core)` applies preset-provided registrations using explicit app call.
- `applyPreset(core)` is the owner of framework default/builtin wiring that was previously implicit or app-local.
- preset owns default event names/definitions and registers them through `core.registerEvent(...)` while `@asyra/reactive-events` provides event infra (registry + publish/subscribe wiring).
- preset registers default shared-channel observers (render + ui-context scene-tree/selection) by channel name instead of touching YJS instances directly.

## Validation Checklist

- Applying preset multiple times does not corrupt runtime registration state.
- App startup works when preset is applied explicitly.
- Ownership triage is explicit for new changes:
  - does this belong to user customization, preset defaults, or framework runtime owner?
  - does this preset default help users quickly get working functionality without locking extension paths?
