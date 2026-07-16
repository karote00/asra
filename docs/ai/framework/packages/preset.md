# Package: @asyra/preset

## Responsibility

Optional startup defaults for framework consumers. Preset provides a working
composition; it does not own app policy or framework runtime semantics.

## Owns

- explicit property schema/runtime defaults
- pure Rectangle, Oval, Vector, Frame, and Group component definitions
- separate default render strategy registrations
- builtin event, selection, render-layer, UI-property, shared-channel, and
  observer wiring
- default `@asyra/render-engine-pixi` factory selection/injection
- stable owner metadata `{ packageName: '@asyra/preset', name: 'default-preset' }`
- one `PresetApplication` handle for graph registrations and runtime wiring
  installed by an `applyPreset` call

## Must Not Own

- Core lifecycle or registration graph semantics
- app business/domain workflows or customization policy
- semantic equivalence or a replace operation
- render-engine runtime/resources, product mode, Generic Preset Composition,
  profiles, or multi-engine composition

## Public Contract

- `applyPreset(core)` explicitly installs defaults on the supplied Core.
- `applyPreset(core, dependencies)` preserves the explicit dependency overload.
- `applyPreset(core, { renderEngineFactory, dependencies? })` preserves custom
  engine-factory composition without selecting a product mode.
- `ApplyPresetOptions` has no extension array. Apps add features with
  `core.defineFeature(...)` and customize registrations through ordinary Core
  APIs after `applyPreset`.
- importing `@asyra/preset` or its component definitions does not register
  components. `applyPreset(core)` installs defaults in deterministic order:
  property schemas, property runtimes, component definitions, render
  strategies, then remaining preset wiring.
- component definitions and render strategies are exported separately so
  consumers do not accidentally create an untracked inline render registration.
- preset property/component/render/UI nodes use
  `PRESET_REGISTRATION_OWNER`. App registrations may omit owner metadata.
- constructor-mode property runtimes and render/UI registrations declare opaque
  dependencies through local `registration.relations`; Core derives structural
  component and config-child relations automatically.
- `PresetApplication.dispose()` uses Core graph-aware unregister APIs, skips a
  The same handle removes its events, selections, preset-owned shared channels,
  system subscriptions, data-channel observers, and render layers. App-owned
  pre-existing shared channels are preserved.
- cleanup failure reports pending resource keys through
  `RegistrationRelationError`; retry runs only pending cleanup.
- graph disposal is preflighted before runtime teardown, so disposal rejected by
  a closed composition does not partially dismantle active wiring.
- if later preset wiring fails, `applyPreset` disposes all graph and runtime
  defaults installed by that call before rethrowing.

## App Customization Route

```ts
applyPreset(core)

core.removeComponentPropertyRelation('rect', 'fills')
core.removeComponentPropertyRelation('oval', 'fills')

core.unregisterRenderStrategy('rect')
core.unregisterRenderStrategy('oval')
core.registerRenderStrategy('rect', whiteboardRectangleStrategy)
core.registerRenderStrategy('oval', whiteboardOvalStrategy)

core.start(container, renderOptions)
```

Removing a relation preserves the property capability. If the app needs no
Fills capability at all, it may instead call:

```ts
core.unregisterPropertyType(PropertyTypes.FILLS)
```

`FILLS` and its child `FILL` are separate registration nodes. The framework
does not infer that unregistering one should unregister the other.

## Ownership Boundary

- `@asyra/utils`: graph primitives, stable metadata, deterministic traversal,
  structured errors/results, retry state
- Core: composition lock, public façade, graph coordination
- scene-tree/props-manager/feature/render/ui-context: definitions and owned
  lifecycle cleanup
- preset: defaults and explicit declarations
- app: which relations/capabilities to remove and what to define next

## Validation Checklist

- preset import has no component-registration side effect
- `applyPreset(core)` and both overloads remain compatible
- no preset extension target, app extension object, or replace strategy is
  exported
- owner metadata and declared relations are queryable through Core
- direct Core unregister followed by `PresetApplication.dispose()` does not
  repeat cleanup
- failed apply/dispose leaves no stale event, selection, channel, subscription,
  observer, or render-layer wiring; cleanup retry does not repeat completed work
- custom engine composition remains engine-neutral and never derives product
  mode
