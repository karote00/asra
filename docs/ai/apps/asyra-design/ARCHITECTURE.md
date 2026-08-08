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
- the App server owns `AI_PROVIDER_ENDPOINT`, `AI_PROVIDER_MODEL`, and
  `AI_PROVIDER_API_KEY`. Ordinary Agent
  requests require all three; the browser receives none of them and contains
  neither the App domain prompt nor the backend image-tool catalog.
- the exact `crdt-7076` backend sample bypasses AI provider configuration and
  model execution, returning its checked-in ordered `AiActionBatch` directly.
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
  collaboration document, and room identity for every ordinary file. A full
  UUID actor identity is generated per page and configures the canonical
  ID-counter namespace before collaborative actions
- derives the ordinary WebSocket endpoint from
  `VITE_COLLABORATION_WS_URL` or same-origin `/collaboration`, composes one
  App-owned document session, and registers its neutral lifecycle with Core
- Core prepares the checkpoint/tail handshake, loads the returned read-only
  checkpoint source, initializes Features, applies the pending tail, activates
  live transport, and only then publishes ready
- every required `fileId`, including `crdt-7076-sample`, receives its initial
  checkpoint from the same socket document session. The prepared 7,076-element
  sample enters only through Actor A's request-time HTTP action-batch after
  Send; the checked-in compressed document is a regression asset, not a
  RenderApp load source
- currently has no IndexedDB publication recovery outbox; the accepted
  socket-authoritative target adds one App-owned IndexedDB outbox containing
  only unaccepted `SharedPublication` values, never a materialized document,
  compatibility format, or second canonical persistence route
- starts framework via `core.start(...)` using Core's default `RenderAdapter`;
  renderer/engine initialization must
  succeed before observers, persistence load, features, or ready publication
- remains the sole runtime-start/ready owner; preset completion does not close
  registration composition or publish ready
- owns the mount-lifetime `core.destroy()` request; Core disposes the registered
  collaboration session before the renderer and owns idempotent runtime cleanup.
  Teardown does not reopen composition, and an unmount during pending startup
  cannot activate collaboration afterward
- collaboration setup is mandatory for every required `fileId`. Session
  failure uses provisional local state, durable publication retention, and
  continued editing without selecting a second RenderApp composition
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

- RenderApp composes the file-scoped session and registers it with Core.
  The collaboration lifecycle module owns Provider/session policy and cleanup;
  Core owns the registered prepare/load/activate/ready/dispose ordering without
  importing or interpreting `@asyra/collaboration`.
- `src/collaboration/factory-adapter.ts` filters Core's neutral publication
  source to the registered Scene Tree and Props document channels.
- `src/collaboration/operations.ts` owns app route/payload validation and turns
  one accepted remote publication into canonical slices, then submits those
  slices through Core's remote-apply facade. Core owns the Factory remote
  transaction and replay mode. Within that publication, adjacent
  non-container element removals may be coalesced into one ordered Core
  canonical request; a container removal remains a lifecycle barrier, and
  different publications are never merged. The adapter does not reconstruct
  app behavior from canonical state.
- For hierarchy deliveries, the same adapter also owns the optional
  `DecideRemotePublication` permission/domain-order/duplicate/conflict decision.
  Accepted or transformed `MOVE_ELEMENTS` and `CHANGE_SUBTREE` publications are
  revalidated before one remote transaction; Collaboration remains
  transport-only.
- `src/collaboration/protocol.ts` is the one typed browser/server
  wire boundary; it and `app-protocol-types.ts` are App-owned and import no
  framework package. The browser provider and reference server validate
  untrusted messages against that App protocol before their respective
  handoffs.
- The frontend collaboration adapter is the only bridge to the framework: it
  subscribes through Core, converts publications to the App wire contract, and
  submits decoded canonical slices through Core's remote-apply facade. The
  socket server and document backend import no `@asyra/*` package and never
  construct or call Core, Factory, or Collaboration.
- Factory owns shared-publication timing and batching. A synchronous immediate
  delivery action is one ordered source boundary; default progressive delivery
  groups consecutive source boundaries into bounded publication windows of at
  most 512 distinct work items. An explicit
  `batchPublications: false` sequence preserves per-slice publication
  settlement, and neither mode splits the local undo commit.
- `@asyra/collaboration` and the WebSocket Provider preserve publications and
  live connection order only. They own no app dedupe, permission, conflict,
  persistence, recovery, or reconnect-replay policy.
- Scene Tree and Props remain canonical state owners for local and remote
  changes. Awareness is ephemeral and cannot carry canonical create or move
  geometry; Render remains a downstream projection.
- Core owns load and explicit serialization only; it no longer captures or
  saves a complete document after local actions, Agent actions, Undo, or Redo.
  An accepted remote publication applies canonical state and updates
  projections without persistence, Undo, or echo publication; `peer-applied`
  therefore acknowledges remote apply rather than receiver durability.

## Socket-Authoritative Document Session

The implemented document-session contract replaces the former split
browser-database save plus optional live Collaboration composition:

```text
mandatory socket handshake
-> backend checkpoint + exact socket pending tail
-> Core canonical checkpoint load
-> App remote apply through handshake head sequence
-> Factory SharedPublication
-> App durable unaccepted-publication outbox
-> reconnect checkpoint/tail reconciliation when required
-> socket-assigned document sequence and live fan-out
-> fixed three-second dirty-window persistence batch
-> backend ordered materialization
-> contiguous durable-sequence acknowledgement
```

- One Actor and multiple Actors use this same document-session path.
- Core retains load validation/apply and explicit serialization but loses
  automatic commit-triggered persistence ownership.
- Factory's existing immutable `SharedPublication` remains the only browser
  document-change unit; private Undo History never reaches the server.
- Selection, Awareness, computed projection, Render/UI state, and diagnostics
  remain outside document persistence.
- The browser performs no canonical document persistence write during ordinary
  App operation. The permanent toolbar Reset is the one standalone exception:
  it attempts to delete only the current stored checkpoint and always refreshes
  after that attempt settles, including when a storage-free demo has no
  backend, without Core, Feature, transaction, History, CRDT, Selection, or
  Collaboration participation. `crdt-7076-sample` otherwise uses the same
  socket-authoritative document session and request-time HTTP action-batch as
  its only prepared sample source.
- The App owns a native IndexedDB transport-recovery outbox containing only
  immutable local publications that have not received socket acceptance.
- A disconnected or incomplete socket session remains locally editable.
  Connection starts at `none` and never returns to it. Only
  `none -> connected` is silent; both `none -> disconnected` and
  `connected -> disconnected` emit one disconnected transition notification,
  while `disconnected -> connected` emits one reconnected notification.
  Repeated same-state observations publish no new connection state. Retries
  occur at most once every 30 seconds and do not emit per-operation failure
  toasts.
- Reconnect reloads the authoritative checkpoint/tail, reconciles the durable
  local outbox in server sequence, and removes each entry only after matching
  source acceptance. Conflict and recovery-storage failure remain explicit
  sync states.
- Socket acceptance, peer apply, and backend durability remain separate
  observable states.
- The server's dirty window defaults to 3000 ms, supports only 1000–3000 ms,
  does not debounce continuous input, and retries backend failures without
  allowing later sequences to overtake.

Semantic authority:
`specs/socket-authoritative-document-session.md`.

Completed plan:
`plans/completed/socket-authoritative-document-persistence-plan.md`.

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
