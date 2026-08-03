# Package: @asyra/preset

## Responsibility

Provide selectable official framework defaults and preset-owned render-engine
profile policy before Core startup. Preset does not own app policy or runtime
readiness.

Preset also owns official vector-editing presentation defaults shared by the
installed editing layer and an app using that preset: vector point and segment
selection-id encoding, plus synthetic handle derivation for missing control
points. These helpers do not create canonical vector data or move editing
policy into Utils.

The official Vector component accepts the existing canonical render snapshot
without requiring a new coordinate-space marker. Its render strategy derives
engine-local draw geometry on a geometry/style miss and declares the generic
transform-only property capability for position, dimension, rotation, scale,
and skew. Transform deltas retain existing path/fill/stroke/hit geometry;
selection and path-edit overlays continue to follow the same Render result.

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

Official managed-property names have one public typed owner:
`PresetSystemPropertyKeys`. The viewport, input, selection, and vector-editing
group exports retain responsibility boundaries; `PRESET_SYSTEM_PROPERTY_KEYS`
is derived from the flattened object for cleanup and lifecycle iteration. Apps
that install these Preset defaults reuse the exported keys rather than declaring
parallel string constants. App-only properties remain app-owned.

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
- The preset-owned Scene Tree shared-channel observer routes committed add,
  remove, scalar, ordered batch, and record-patch envelopes to the matching
  public Render scene-tree store operation without composing or retaining a
  snapshot. ADD and REMOVE forward canonical `parentId` and sibling `index`
  unchanged so Render can maintain exact parent membership and order. Scalar and
  batch routes preserve each canonical `raw` or `computed` owner together with
  its complete before/after evidence; Preset does not infer ownership. It records
  the structured Render projection outcome for bounded diagnostics. Initial
  registration and every re-registration install the
  observer first and then invoke the public Render full-rebuild route so changes
  committed during an observer gap cannot leave stale output. Its idempotent
  disposer clears Render projection state and every Scene Tree-projected visual
  node once, including their abstract engine handles/resources. If the rebuild
  fails, registration fails and the existing cleanup rollback unregisters the
  observer and clears any partial projection. File-load completion invokes the
  Render rebuild through a synchronous lifecycle handler so a rebuild failure
  propagates to the caller; UI-context and vector-editing file-load work remains
  on their separate observer route.
- The preset-owned UI-context Scene Tree observer derives
  `flattenedElementIds` and `elementDataMap` from canonical Scene Tree state.
  Each exact Core/Factory batch projects once: structural changes update
  affected entries and hierarchy order, display-property changes replace only
  affected entries without rebuilding flattened hierarchy, and unrelated
  geometry changes do not republish either projection. Validated file load
  remains the sole full canonical refresh. These values are App-facing
  projections only and never validate, repair, reorder, or become a second
  canonical hierarchy.

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

## Release-Blocking Group Operations

`CONTAINERS` installs the single official invisible Group component and its
Render projection. Preset also exports the ID-driven Group adapters defined by
`../plans/completed/group-component-and-hierarchy-behaviors-plan.md`.

- The adapters use public Core/Scene Tree/property boundaries and never mutate
  hierarchy or computed data directly.
- `prepareGroupOperation(...)` and `prepareUngroupOperation(...)` produce
  canonical plans; `groupElements(...)` and `ungroupElement(...)` execute them
  inside one transaction.
- `moveElementsWithGroupGeometry(...)` delegates hierarchy validation/mutation
  to Core and performs coordinate conversion plus derived bounds-cache
  normalization when direct official Group membership is involved.
- Vector Group/ungroup/reparent updates contain only hierarchy and bounded
  element geometry values. They never include Vector point/control/segment/
  network record patches.
- `deriveGroupBounds(...)` and `normalizeGroupsForElements(...)` provide the
  one direct-child canonical rectangle-union/bounds path, deepest affected
  Group first.
- Group `x`, `y`, `width`, and `height` are the persisted derived cache of
  direct-child canonical geometry; accepted geometry changes update that cache
  in the same transaction instead of recalculating it per frame.
- Preset owns 2D coordinate normalization and direct-child Group bounds for the
  registered canonical `x`/`y`/`width`/`height` contract. Rotation, scale, or
  skew may participate only after the component, persistence, and Render
  contracts register the same canonical fields.
- Preset does not choose selected ids, register shortcuts or app commands,
  define post-operation selection, or own hover/click/hit/UI behavior.
- Apps may replace the official Group capability through the ordinary
  pre-start composition route without patching Preset internals.

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
