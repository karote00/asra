# Package: @asyra/preset

## Responsibility

Provide selectable official framework defaults and preset-owned render-engine
profile policy before Core startup. Preset does not own app policy or runtime
readiness.

## Public Contract

```ts
import {
  applyPreset,
  PresetCatalog,
  PresetDefaults,
  PresetProfiles
} from '@asyra/preset'

const result = applyPreset(core, {
  profile: PresetProfiles['2D'],
  defaults: [PresetDefaults.BASIC_SHAPES, PresetDefaults.SELECTION]
})
```

- `profile` selects only preset engine policy.
- `defaults` selects only official product modules.
- `applyPreset(core)` selects profile `2D` and all eight available defaults.
- Omitting `defaults` selects all available defaults for every profile;
  `defaults: []` installs none.
- Explicit defaults are set-like input. Duplicate, unknown, or unavailable ids
  fail before mutation. Preset expands public dependencies and installs in
  catalog order.
- The returned `PresetApplyResult` contains only `profile`, `presetEngineId`,
  `selectedDefaults`, and `appliedDefaults`. It and its arrays are detached and
  deeply frozen; it is not a lifecycle handle and exposes no disposer.

`PresetProfiles` contains `2D`, `3D`, `HYBRID`, and `CUSTOM`. `2D` and `CUSTOM`
are available. `3D` and `HYBRID` are reserved but unavailable and fail before
mutation. `2D` registers the preset-owned Pixi provider; `CUSTOM` registers no
provider.

`PresetDefaults` contains, in canonical order:

1. `BASIC_SHAPES`
2. `CONTAINERS`
3. `VECTOR`
4. `INPUT`
5. `SELECTION`
6. `VECTOR_EDITING`
7. `VIEWPORT`
8. `UI_CONTEXT`

`VECTOR_EDITING` publicly requires `VECTOR` and `SELECTION`; `UI_CONTEXT`
requires `SELECTION`. Property, event, channel, projection, observer, and
subscription prerequisites are private and never appear as selectable ids.

`PresetCatalog` is deeply frozen. Profile entries expose `id`, `available`, and
`presetEngineId`; default entries expose `id`, `available`, and `requires`.
Catalog engine ids are diagnostics, not dynamic-import paths.

## Composition Order

```text
resolve and validate strict request
-> install selected default dependency closure in catalog order
-> bind the profile-owned provider when profile is 2D
-> publish frozen PresetApplyResult
-> app uses ordinary Core APIs for optional customization
-> core.start()
```

All customization and any app-owned provider binding must finish before the
first `core.start()`. A custom engine uses `profile: CUSTOM`, followed by
`core.setRenderEngineProvider(() => engine)`; custom providers never pass
through preset.

## Failure and Cleanup

`PresetApplyError` exposes one stable code from `PRESET_APPLY_ERROR_CODES`:

- `INVALID_OPTIONS`
- `UNKNOWN_PROFILE`
- `UNAVAILABLE_PROFILE`
- `UNKNOWN_DEFAULT`
- `UNAVAILABLE_DEFAULT`
- `DUPLICATE_DEFAULT`
- `COMPOSITION_CLOSED`
- `ALREADY_APPLIED`
- `ENGINE_PROVIDER_CONFLICT`
- `DEFAULT_INSTALL_FAILED`
- `CLEANUP_FAILED`

Validation failures mutate nothing. Installation or provider failure rolls back
all acquired preset-owned resources in reverse order. If cleanup fails, the
error reports frozen `completedCleanup` and `pendingCleanup` arrays plus the
original cause. The next apply on that Core retries only pending cleanup before
new validation or mutation.

A successful apply is permanent for that Core composition. A second apply
fails; apps customize successful defaults through ordinary Core APIs.

## Ownership Boundary

- Core owns composition lock, registration graph, provider facade, startup,
  default renderer, and teardown facade.
- Render owns instance-local abstract provider storage and engine orchestration.
- The concrete engine package owns SDK runtime and resources.
- Preset owns the fixed catalog, official module installers, private
  prerequisites, profile policy, apply result, and failed-apply rollback.
- App owns which preset choices to request and any later Core customization.

Preset must not accept app-provided installers, disposers, dependency objects,
engine ids, custom providers, extension callbacks, or replace semantics.

## App Customization Route

```ts
applyPreset(core)

core.removeComponentPropertyRelation('rect', 'fills')
core.unregisterRenderStrategy('rect')
core.registerRenderStrategy('rect', productRectangleStrategy)

await core.start(container, renderOptions)
```

Official config-mode property types can be inspected and redefined through
`core.getPropertyTypeDefinition()` and `core.redefinePropertyType()` after
`applyPreset(core)` and before the first `core.start()`. The successful property
owner transfers to the app while existing graph relations remain. Preset adds
no extension object, deep-import path, field mapping, or replace registry.
Constructor-mode types and complete capability replacement retain the explicit
unregister-then-define route.

## Validation Checklist

- imports are side-effect free;
- profile and defaults resolve independently;
- every module is independently selectable and private prerequisites dedupe;
- unselected modules install no product registrations or state;
- unknown, unavailable, duplicate, legacy, closed, conflict, and duplicate-apply
  inputs fail before mutation;
- failed apply leaves no stale registration, property, event, selection,
  channel, observer, subscription, layer, or provider;
- no 3D/Hybrid runtime is imported or bundled.
