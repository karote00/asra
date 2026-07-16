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
- deterministic Generic Preset Composition ordering across shared defaults,
  one concrete-engine provider, explicitly selected capability bundles, and a
  completed result
- composition input validation, instance-local success diagnostics, structured
  apply/cleanup failures, and rollback coordination
- stable owner metadata `{ packageName: '@asyra/preset', name: 'default-preset' }`
- one `PresetApplication` handle for graph registrations and runtime wiring
  installed by an `applyPreset` call

## Must Not Own

- Core lifecycle or registration graph semantics
- app business/domain workflows or customization policy
- semantic equivalence or a replace operation
- render-engine runtime/resources, product mode, official render profiles, or
  multi-engine composition
- package-owned capability-bundle semantics, outputs, or resource cleanup

## Public Contract

- `applyPreset(core)` explicitly installs defaults on the supplied Core.
- `applyPreset(core, dependencies)` preserves the explicit dependency overload.
- `applyPreset(core, { renderEngineFactory, dependencies? })` preserves custom
  engine-factory composition under the stable legacy diagnostic identity.
- `applyPreset(core, { engine, capabilityBundles, dependencies? })` accepts one
  identified engine bootstrap and explicitly selected package-owned bundles.
  Bundle dependencies must be selected earlier; preset does not reorder them.
- omitted input and `{ engine: { id: '@asyra/render-engine-pixi' } }` produce
  equivalent default composition. A custom engine id must include its factory.
- `PresetApplication.result` is a frozen, instance-local completed result with
  `engineId`, ordered `sharedGroups`, selected `capabilityBundles`, and exact
  layer `order`. Completion means preset composition finished, not Core ready.
- `ApplyPresetOptions` has no extension array. Apps add features with
  `core.defineFeature(...)` and customize registrations through ordinary Core
  APIs after `applyPreset`.
- importing `@asyra/preset` or its component definitions does not register
  components. `applyPreset(core)` installs every shared group in its declared
  deterministic order before provider selection; selected bundles then install
  in caller order before the completed result is published.
- component definitions and render strategies are exported separately so
  consumers do not accidentally create an untracked inline render registration.
- preset property/component/render/UI nodes use
  `PRESET_REGISTRATION_OWNER`. App registrations may omit owner metadata.
- constructor-mode property runtimes and render/UI registrations declare opaque
  dependencies through local `registration.relations`; Core derives structural
  component and config-child relations automatically.
- `PresetApplication.dispose()` uses Core graph-aware unregister APIs and skips
  nodes already removed through Core. The same handle removes its events,
  selections, preset-owned shared channels,
  system subscriptions, data-channel observers, and render layers. App-owned
  pre-existing shared channels are preserved.
- Shared channels and data-channel observers are installed through the supplied
  Core instance; preset never falls back to a module-global Core or Factory.
- `PresetCompositionError` uses stable validation, duplicate, unknown/missing,
  ordering, layer-install, and cleanup codes. Validation failures mutate
  nothing; layer failures report completed layers and rollback state.
- cleanup failure uses `CLEANUP_FAILED` with completed/pending resource keys and
  the original apply failure when present; retry runs only pending cleanup.
- graph disposal is preflighted before runtime teardown, so disposal rejected by
  a closed composition does not partially dismantle active wiring.
- if later preset wiring fails, `applyPreset` disposes all graph and runtime
  defaults installed by that call before rethrowing. If rollback cleanup itself
  remains pending, preset retains that temporary application internally and the
  next `applyPreset` on the same Core retries it before installing new defaults.

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
- `@asyra/render`: reversible instance-local provider selection; the selected
  engine package owns concrete runtime/resources
- bundle package: bundle metadata, installation outputs, and disposer
- preset: defaults, composition validation/order/results, and rollback
  coordination
- app: which relations/capabilities to remove and what to define next

## Validation Checklist

- preset import has no component-registration side effect
- `applyPreset(core)`, explicit dependencies, and legacy factory overloads
  remain compatible
- identified engine/bootstrap and ordered bundle composition are deterministic
- success/error arrays are detached and composition state is instance-local
- no preset extension target, app extension object, or replace strategy is
  exported
- owner metadata and declared relations are queryable through Core
- direct Core unregister followed by `PresetApplication.dispose()` does not
  repeat cleanup
- failed apply/dispose leaves no stale event, selection, channel, subscription,
  observer, render layer, registration, provider, or bundle resource; cleanup
  retry does not repeat completed work
- custom engine composition remains engine-neutral and never derives product
  mode
