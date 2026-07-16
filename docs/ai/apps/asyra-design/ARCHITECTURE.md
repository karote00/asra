# App Architecture

## Runtime Layers

1. App UI Layer

- React components (`src/app`, `src/contents`, `src/properties`, `src/toolbar`)
- Providers/hooks (`src/providers`, `src/hooks`)

2. App Interaction Layer

- Feature registrations and handlers (`src/features/*`)
- Input event mapping (`src/config/key-combinations.ts`)

3. App Orchestration Layer

- App initialization (`src/init/*`)
- App controllers (`src/controllers/*`)
- App common APIs (`src/common-apis/*`)

4. Framework Layer

- `@asyra/core` and dependent runtime packages

## Startup Flow

1. `src/index.tsx`

- calls `initApp()` before React render
- mounts `DataContexts` + `App`

2. `src/init/init-app.ts`

- `applyPreset(core)` installs shared defaults, injects the fresh Pixi engine
  factory into the framework `Render` instance, selects no optional bundles,
  and completes preset composition before app initialization continues
- the current app chooses the no-customization compatibility route; an app that
  customizes defaults performs ordinary Core remove/unregister/define calls
  after `applyPreset(core)` and before diagnostics, capabilities, input-system,
  feature initialization, and the first `core.start()`
- diagnostics: `initLoadDiagnostics()`
- derived-state sync: `initSelectionCompatibility()`, `initPathEditingContinuation()`
- capability init: `initAreaSelection()`, `initGradientFillEditing()`, `initVectorIconData()`
- foundation: `initInputSystem()`, `initFeatures()`

3. `src/render-app/index.tsx`

- sets the engine-neutral framework facade via
  `core.setRenderer(new RenderAdapter())`
- sets persistence via `core.setPersistence(providers.localStorage)`
- starts framework via `core.start(...)`; renderer/engine initialization must
  succeed before observers, persistence load, features, or ready publication
- remains the sole runtime-start/ready owner; preset completion does not close
  registration composition or publish ready
- imports no Pixi SDK or concrete render-engine package

4. `src/contexts/data-change.tsx`

- listens to render-ready/load-complete events
- triggers zoom-fit after load completion

## Data Flow (App)

Input -> Feature -> Common API/Controller -> Core/Framework State -> Render/UI-context -> React Providers -> UI

## Module Ownership (App)

- `features/*`: interaction behavior and session logic
- `common-apis/*`: reusable app mutation/query operations
- `controllers/*`: UI-triggered orchestration helpers
- `init/*`: app startup, capability init, and property/derived-state wiring
- `providers/*`: UI consumption adapters from ui-context/scene data

Preset customization ownership:

- framework registries/runtime own deterministic registration and cleanup
- `@asyra/preset` owns explicit defaults, local relation declarations, stable
  preset owner metadata, deterministic composition diagnostics/rollback, and
  its graph-backed application cleanup handle
- app startup removes/defines exact relations for structural changes, or uses
  `Core unregister -> define/register` for a complete implementation change
- app code must not deep-import preset internals or derive a product mode from
  renderer/engine capabilities

## Key App State Surfaces

System properties used by app:

- `zoom`
- `primaryTool`
- `pathEditingMode`
- `pathEditingVectorId`
- `pathEditingStartNewSubpath`
- `areaSelection`
- `selectedVectorPoint` (compatibility mirror derived from selection channel)
- `hoveredVectorPoint`

UI properties used by app:

- `elementSelection`
- `vectorPointSelection`
- `vectorSegmentSelection`
- `flattenedElementIds`
- aggregate props: `x`, `y`, `width`, `height`, `rotation`
- mirrored system props for UI: `zoom`, `primaryTool`, path-editing point props

## Feature Inventory

- tool switch: `switch-primary-tool`
- shape creation: `create-element`
- drag move: `move-elements`
- selection: `selection`
- hover selection target: `hover-element`
- viewport: `zoom`, `pan`, `zoom-fit`
- history: `undo-redo`
- vector path editing: `pen-tool`
