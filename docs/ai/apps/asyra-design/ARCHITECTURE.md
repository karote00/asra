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

- `initPropertyRegistrations()`
- `initInputSystem()`
- `initFeatures()`

3. `src/render-app/index.tsx`

- sets renderer via `core.setRenderer(new PixiJSRenderer())`
- sets persistence via `core.setPersistence(providers.localStorage)`
- starts framework via `core.start(...)`

4. `src/contexts/data-change.tsx`

- listens to render-ready/load-complete events
- triggers zoom-fit after load completion

## Data Flow (App)

Input -> Feature -> Common API/Controller -> Core/Framework State -> Render/UI-context -> React Providers -> UI

## Module Ownership (App)

- `features/*`: interaction behavior and session logic
- `common-apis/*`: reusable app mutation/query operations
- `controllers/*`: UI-triggered orchestration helpers
- `registrations/*`: app-managed ui/system property registrations
- `providers/*`: UI consumption adapters from ui-context/scene data

## Key App State Surfaces

System properties used by app:

- `zoom`
- `primaryTool`
- `pathEditingMode`
- `pathEditingVectorId`
- `pathEditingStartNewSubpath`
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
