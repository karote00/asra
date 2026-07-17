# Preset Profile and Selectable Defaults Plan

## Status and Authority

Active after the completed Render-Engine Boundary and Extendable Preset plans.
This plan supersedes the unreleased Generic Preset Composition API implemented
on the current feature branch. The removed `renderEngineFactory`, identified
engine bootstrap, capability-bundle, dependency-overload, and
`PresetApplication` paths are not compatibility contracts.

The exact owner flow is defined by
`preset-composition-flow-inspector.data.cjs`. Implementation advances one
Inspector owner step at a time and follows the Inspector readiness and step
execution rules.

## Goal

Expose two independent preset choices before Core startup:

```text
profile -> preset-owned render-engine provider policy only
defaults -> selectable official preset modules only
```

The app completes preset selection, optional app customization, and optional
custom provider binding before `core.start()`. The first `core.start()` closes
composition permanently and owns runtime initialization/readiness.

## Product Contract

### Public identifiers and catalog

```ts
const PresetProfiles = {
  '2D': '2D',
  '3D': '3D',
  HYBRID: 'HYBRID',
  CUSTOM: 'CUSTOM'
} as const

const PresetDefaults = {
  BASIC_SHAPES: 'basic-shapes',
  CONTAINERS: 'containers',
  VECTOR: 'vector',
  INPUT: 'input',
  SELECTION: 'selection',
  VECTOR_EDITING: 'vector-editing',
  VIEWPORT: 'viewport',
  UI_CONTEXT: 'ui-context'
} as const

interface ApplyPresetOptions {
  profile?: PresetProfile
  defaults?: readonly PresetDefaultId[]
}

interface PresetApplyResult {
  readonly profile: PresetProfile
  readonly presetEngineId: string | null
  readonly selectedDefaults: readonly PresetDefaultId[]
  readonly appliedDefaults: readonly PresetDefaultId[]
}
```

`PresetCatalog` is deeply frozen and contains separate profile and default
lists. Profile entries expose `id`, `available`, and `presetEngineId`; default
entries expose `id`, `available`, and public `requires`. A profile entry never
lists or selects defaults. Catalog engine ids are preset-owned diagnostics;
they are not dynamic-import paths and callers cannot supply them.

`PresetDefaults.VECTOR_EDITING` requires `VECTOR` and `SELECTION`.
`PresetDefaults.UI_CONTEXT` requires `SELECTION`. Preset-private property,
event, shared-channel, render-projection, and observer prerequisites are not
public default ids.

### Application semantics

- `applyPreset(core)` means profile `2D` plus every available default.
- Omitting `defaults` selects every available default for every profile,
  including `CUSTOM`; profile never filters defaults.
- `defaults: []` installs no default module while retaining the selected
  profile's engine policy.
- Explicit defaults are a set-like request. Duplicate, unknown, or unavailable
  ids fail before mutation. Preset expands public dependencies and installs in
  canonical catalog order, never caller order.
- `selectedDefaults` contains the canonicalized caller selection (or all
  available defaults when omitted). `appliedDefaults` includes public
  dependency closure. Both and the result are detached and deeply frozen.
- Profile `2D` is available and binds the preset-owned Pixi provider through
  the Core facade. `CUSTOM` is available and binds no provider.
- Profiles `3D` and `HYBRID` are stable known identifiers but unavailable.
  Selecting either fails before any default or provider mutation.
- A successful apply is permanent for that Core composition. A second apply
  fails before mutation; app customization instead uses ordinary Core APIs.
- `applyPreset` after the first `core.start()` fails even when no defaults or
  provider would otherwise be installed.

### Core render provider and startup

```ts
type RenderEngineProvider = () => RenderEngine

core.setRenderEngineProvider(provider)
core.hasRenderEngineProvider()
core.destroyRenderer()
```

- A provider is a zero-argument concrete-engine creator, unrelated to
  `@asyra/factory`. Core accepts one provider during open composition and
  Render invokes it only during startup.
- A second provider or a post-start provider/renderer change fails. Apps that
  need a custom engine select `CUSTOM` and set their provider before start.
- Core owns an engine-neutral `RenderAdapter` by default. `setRenderer()`
  remains an advanced full-renderer replacement API.
- With the Core-owned adapter, an absent provider is a valid headless startup:
  no canvas or input surface is created, while observers, load, features, and
  ready publication still complete.
- Direct `Render.init()` without a provider remains a strict error. A provider
  that throws, returns an invalid engine, fails initialization, or lacks
  required capabilities is not headless and fails Core startup before later
  phases or ready publication.
- `destroyRenderer()` delegates renderer resource teardown and does not reopen
  composition or remove preset/app registrations.

### Official default modules

1. `BASIC_SHAPES`: Rectangle and Oval definitions, strategies, and required
   position/dimension/fill/stroke defaults.
2. `CONTAINERS`: Frame and Group definitions, strategies, and required model
   defaults.
3. `VECTOR`: Vector definition/strategy and vector topology property defaults.
4. `INPUT`: normalized input event definitions plus mouse, keyboard, and
   primary-tool state defaults.
5. `SELECTION`: element selection runtime/state, shared projection, and
   selection overlay.
6. `VECTOR_EDITING`: vector point/segment selections, path-editing state, and
   vector-editing layer.
7. `VIEWPORT`: zoom/viewport state and Render pan/zoom subscriptions.
8. `UI_CONTEXT`: derived element, selection, and property-panel UI values plus
   their scene/selection synchronization.

Framework developers add or change these modules inside `@asyra/preset`; apps
cannot inject installers, callbacks, bundle metadata, or cleanup owners.

### Failures and cleanup

`PresetApplyError` exposes one stable code from:

- `INVALID_OPTIONS`;
- `UNKNOWN_PROFILE`;
- `UNAVAILABLE_PROFILE`;
- `UNKNOWN_DEFAULT`;
- `UNAVAILABLE_DEFAULT`;
- `DUPLICATE_DEFAULT`;
- `COMPOSITION_CLOSED`;
- `ALREADY_APPLIED`;
- `ENGINE_PROVIDER_CONFLICT`;
- `DEFAULT_INSTALL_FAILED`;
- `CLEANUP_FAILED`.

Validation errors mutate nothing. Installation failure stops later modules and
rolls back acquired preset-owned resources in exact reverse order. Cleanup
failure reports completed and pending cleanup keys plus the original cause;
the next apply on that Core retries pending cleanup before any new validation
or installation. No public disposer or application handle is exposed.

## Ownership and Flow

1. App calls `applyPreset(core, options?)`.
2. Preset snapshots and validates strict options, profile availability,
   default ids/dependencies, composition state, duplicate apply, and provider
   conflict before mutation.
3. Preset installs selected/default dependency closure in canonical order,
   acquiring private shared prerequisites exactly once.
4. For `2D`, Preset binds the Pixi provider through
   `core.setRenderEngineProvider`; for `CUSTOM`, it performs no provider call.
5. Preset returns one frozen `PresetApplyResult`. App may use ordinary Core
   APIs and may bind a custom provider for `CUSTOM`.
6. App calls `core.start()`. Core closes composition, validates relations, and
   initializes its renderer. Missing provider alone selects headless startup;
   all actual provider/engine failures remain errors.
7. Core initializes observers, persistence load, features, and publishes ready.

## Product Cases

- omitted options equal explicit `2D` plus all defaults;
- `CUSTOM` plus omitted defaults installs all defaults and no provider;
- empty defaults install no modules for either `2D` or `CUSTOM`;
- identical explicit defaults resolve identically across `2D` and `CUSTOM`;
- vector editing expands only `VECTOR` and `SELECTION` public dependencies;
- UI context expands only `SELECTION` as a public dependency;
- unavailable/unknown profiles, invalid/default ids, legacy option keys,
  duplicate defaults, closed composition, duplicate apply, and provider
  conflict fail before accepted mutation;
- partial installation failure and cleanup retry leave no stale registrations,
  events, channels, observers, subscriptions, layers, or provider;
- Core-owned adapter starts without app `setRenderer()`;
- headless Core startup resolves with no canvas/input while direct Render stays
  strict and real provider/engine failures remain visible;
- Asyra Design keeps the same default UI, interaction, load, undo/redo, and
  render behavior.

## Definition of Done

- active plan, Inspectors, package/app docs, golden paths, and decision history
  contain no live legacy bundle/factory/application contract;
- profile/default constants and catalog have one preset-owned source of truth;
- eight modules are independently selectable with deterministic private
  prerequisite acquisition and cleanup;
- provider selection uses only Core and abstract render-engine boundaries;
- affected package/app/Inspector tests, root tests, lint, build, dependency
  validation, diff check, live startup, and synchronized visual review pass;
- no 3D/Hybrid runtime or package import is introduced;
- the plan remains active until user-reviewed closeout is explicitly requested.

## Implementation Segments

1. [x] Repair plan and Inspector authority.
2. [x] Rename and test the abstract provider contract and strict Render path.
3. [x] Add and test Core provider/default-renderer/headless/teardown ownership.
4. [x] Add and test preset identifiers, catalog, strict validation, and result.
5. [x] Split and test eight default modules plus private prerequisites.
6. [x] Migrate and verify Asyra Design startup.
7. [x] Synchronize docs and run full validation/review.

Do not move this plan to `completed/` until the user reviews the implementation
and explicitly requests closeout.
