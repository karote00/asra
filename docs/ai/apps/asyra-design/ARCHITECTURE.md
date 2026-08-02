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

## Configuration Ownership

- `app-environment.mjs` owns parsing and validation of the app origin and the
  reference WebSocket server's host and port.
- `APP_URL` is the canonical app-origin input consumed by Vite,
  Playwright, visual review, and reference-server Origin validation.
- `VITE_COLLABORATION_WS_URL` identifies the browser's WebSocket
  service endpoint. It is independent from the app origin because the app and
  WebSocket server are separate services.
- RenderApp does not parse build-tool or test-runner configuration.

## Startup Flow

1. `src/index.tsx`

- calls `initApp()` before React render
- mounts `DataContexts` + `App`

2. `src/init/init-app.ts`

- `applyPreset(core)` selects profile `2D`, installs all eight official defaults,
  and stores the preset-owned Pixi provider without constructing the engine
- the current app chooses the default no-customization route; an app that
  customizes defaults performs ordinary Core get/redefine, relation, or
  unregister/define calls after `applyPreset(core)` and before diagnostics,
  capabilities, input-system, feature initialization, and the first
  `core.start()`
- DEV-only diagnostics dynamically import
  `@asyra/core/canvas-pipeline-debugger` and expose a disabled
  `window.__CanvasPipelineDebugger__` handle for human DevTools use; HMR disposes the prior
  handle, while production bypasses the import and runtime entirely
- diagnostics: `initLoadDiagnostics()`
- derived-state sync: `initSelectionCompatibility()`, `initPathEditingContinuation()`
- capability init: `initAreaSelection()`, `initGradientFillEditing()`, `initVectorIconData()`
- foundation: `initInputSystem()`, `initFeatures()`

3. `src/render-app/index.tsx`

- requires one non-empty `fileId`; that value maps to the App document,
  and, when `VITE_COLLABORATION_WS_URL` is configured, the collaboration
  document and room identity. A full UUID actor identity is generated per page
  and configures the canonical ID-counter namespace before collaborative
  actions
- injects the App-owned same-origin document database provider before Core
  startup. It uses `GET`, `PUT`, and `DELETE` at
  `/api/documents/<encoded fileId>`; local actions, Agent actions, Undo, Redo,
  and Reset use this one provider
- treats database availability as a visible persistence status, not App
  availability. A failed database load displays an error and continues through
  the file-specific initial canonical document; failed saves remain errors but
  do not roll back the already committed local action or crash Canvas
- for `fileId=crdt-7076-sample`, the initial source is the checked-in compressed
  canonical document generated through the ordinary prepared action and
  Factory path. Other files use one fresh empty canonical document. Core
  remains the load-validation owner
- has no IndexedDB, localStorage, demo-only fake persistence, compatibility
  format, or second persistence route. A fork implements the matching database
  server without replacing the frontend client
- starts framework via `core.start(...)` using Core's default `RenderAdapter`;
  renderer/engine initialization must
  succeed before observers, persistence load, features, or ready publication
- remains the sole runtime-start/ready owner; preset completion does not close
  registration composition or publish ready
- owns the mount-lifetime teardown request for the Core renderer and optional
  collaboration lifecycle; the lifecycle disposer owns idempotent resource cleanup.
  Teardown does not reopen composition, and an unmount during pending startup
  cannot activate collaboration afterward
- collaboration setup is optional when no WebSocket endpoint is configured.
  Initial connection failure and later disconnection display an unavailable
  status while Core, Canvas, and local editing continue; a partial setup is
  disposed without turning transport availability into App availability
- imports no Pixi SDK or concrete render-engine package

4. `src/contexts/data-change.tsx`

- listens to render-ready/load-complete events
- triggers zoom-fit after load completion

## Data Flow (App)

Input -> Feature -> Common API/Controller -> Core/Framework State -> Render/UI-context -> React Providers -> UI

Existing Vector data remains canonical through this flow. Whole-element
transforms never compensate by rewriting point/control records; Render derives
and retains engine-local draw geometry, then applies transform-only deltas to
the existing Render object.

## Collaboration Ownership

- RenderApp owns mount-lifetime activation/teardown requests;
  the collaboration lifecycle module owns instance startup, failure cleanup, and
  disposal, including HMR cleanup. Core and Preset do not activate
  collaboration implicitly.
- `src/collaboration/factory-adapter.ts` exposes only the registered
  Scene Tree and Props document channels to the collaboration instance.
- `src/collaboration/operations.ts` owns app route/payload validation and turns
  one accepted remote publication into one Factory remote transaction through
  the ordinary canonical event path. It does not reconstruct app behavior from
  canonical state.
- For hierarchy deliveries, the same adapter also owns the optional
  `DecideRemotePublication` permission/domain-order/duplicate/conflict decision.
  Accepted or transformed `MOVE_ELEMENTS` and `CHANGE_SUBTREE` publications are
  revalidated before one remote transaction; Collaboration remains
  transport-only.
- `src/collaboration/protocol.ts` is the one typed browser/server
  wire boundary; the browser provider and reference server validate untrusted
  messages against it before invoking provider operations.
- Factory owns shared-publication timing and batching. A synchronous immediate
  delivery action is one publication; an outer pointer session may contain
  several publications while remaining one local undo commit.
- `@asyra/collaboration` and the WebSocket Provider preserve publications and
  live connection order only. They own no app dedupe, permission, conflict,
  persistence, recovery, or reconnect-replay policy.
- Scene Tree and Props remain canonical state owners for local and remote
  changes. Awareness is ephemeral and cannot carry canonical create or move
  geometry; Render remains a downstream projection.
- Core's persistence lifecycle stores local actions, Agent actions, Undo, and
  Redo from the client that originated the operation. An accepted remote
  publication applies canonical state and updates projections without
  persistence, Undo, or echo publication; `peer-applied` therefore acknowledges
  remote apply rather than receiver durability.

## Module Ownership (App)

- `features/*`: interaction behavior and session logic
- `common-apis/*`: reusable app mutation/query operations
- `controllers/*`: UI-triggered orchestration helpers
- `init/*`: app startup, capability init, and property/derived-state wiring
- `render-layers/*`: app-owned overlay projection; system-property reads use the
  Core facade contract rather than reaching through `core.deps.systemContext`
- `providers/*`: UI consumption adapters from ui-context/scene data

Preset customization ownership:

- framework registries/runtime own deterministic registration and cleanup
- `@asyra/preset` owns explicit defaults, local relation declarations, stable
  preset owner metadata, deterministic composition diagnostics, and failed-
  apply rollback; successful apply returns no lifecycle or cleanup handle
- app startup removes/defines exact relations for structural changes, or uses
  Core `getPropertyTypeDefinition -> redefinePropertyType` for a declarative
  fixed-field change and `unregister -> define/register` for a complete
  implementation change
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
