# Module: Init and Startup

## Entry Points

- `.env`
- `app-environment.mjs`
- `vite.config.ts`
- `playwright.config.ts`
- `playwright.collaboration.config.ts`
- `collaboration-server.ts`
- `tsconfig.collaboration-server.json`
- `vite.collaboration-server.config.ts`
- `src/index.tsx`
- `src/init/index.ts`
- `src/init/init-app.ts`
- `src/init/foundation/init-features.ts`
- `src/init/foundation/init-input-system.ts`
- `src/init/diagnostics/init-load-diagnostics.ts`
- `src/init/capabilities/init-area-selection.ts`
- `src/init/capabilities/init-gradient-fill-editing.ts`
- `src/init/capabilities/init-vector-icon-data.ts`
- `src/init/derived-state/init-path-editing-continuation.ts`
- `src/init/derived-state/init-selection-compatibility.ts`
- `src/render-app/index.tsx`
- `src/contexts/data-change.tsx`

## Configuration Ownership

- `app-environment.mjs` parses and validates `APP_URL` for Vite,
  Playwright, and reference-server Origin validation. The visual-review
  workflow consumes the same canonical input instead of defining another app
  URL authority.
- The WebSocket server host/port and browser-visible WebSocket URL remain
  separate service configuration; RenderApp does not own them.
- The repository app and generated standalone environment default the
  browser-visible URL to `ws://127.0.0.1:4101/collaboration`, matching the local
  reference server. Clearing that value intentionally selects the same-origin
  `/collaboration` deployment fallback.

## Startup Order (Current)

1. `initApp()`

- `applyPreset(core)` selects the `2D` profile, installs all eight official
  defaults, and registers the preset-owned Pixi engine provider without
  constructing the engine
- the current app uses the default no-customization route; when app policy
  needs customization, call public Core get/redefine, relation, or
  unregister/define APIs after `applyPreset(core)` and before the remaining init
  steps
- diagnostics: `initLoadDiagnostics()`
- derived-state sync: `initSelectionCompatibility()`, `initPathEditingContinuation()`
- capability init: `initAreaSelection()`, `initGradientFillEditing()`, `initVectorIconData()`
- foundation: `initInputSystem()`, `initFeatures()`
- AI composition is evaluated immediately before `initFeatures()`:
  - required-file startup composes the one formal server-action-batch provider
  - the provider receives the pre-ready resident server response and exposes no
    URL-selected alternate execution mode
  - the App passes one runtime to the exclusive programmatic AI Feature
  - the abortable same-origin VTracer client remains inert until an accepted
    attachment accompanies an explicit whole-image vectorization intent
- `initApp()` returns the AI composition and an idempotent async disposer;
  disposal aborts/awaits active AI work and disposes only explicitly owned AI
  resources

2. React mount

- mounts `DataContexts`
- mounts `App`

3. RenderApp effect

- a non-empty ordinary `fileId` selects collaboration document/room identity,
  derives the WebSocket endpoint from configured
  `VITE_COLLABORATION_WS_URL` or same-origin `/collaboration`, and generates a
  full UUID actor identity per page
- the collaboration lifecycle opens the checkpoint/tail handshake before Core
  startup and RenderApp supplies that checkpoint through
  `core.setLoadSource(...)`
- after Core load, the lifecycle applies the bootstrap tail through the
  ordinary remote canonical processor and activates Factory publication
  transport; immediate publications may occur during an outer pointer
  transaction, while transaction-end publications wait for commit
- `crdt-7076-sample` uses this same socket-authoritative startup; its checked-in
  response enters only after Actor A's same-origin HTTP action-batch request
  and never through a separate load source
- `core.start(container, options)` uses the Core-owned default `RenderAdapter`;
  the app does not call `setRenderer()`
- if renderer/engine initialization rejects, Core stops before observers,
  persistence load, features, and render-ready publication
- effect cleanup calls `core.destroyRenderer()` and the app-owned collaboration
  disposer; teardown is idempotent, does not reopen composition, and an
  unmount/aborted startup cannot later activate collaboration
- collaboration disposal detaches publication and Awareness observers, clears
  timers/store state, and destroys only owned collaboration resources
- setup failure disposes the partially composed instance; an unavailable socket
  uses the formal provisional local startup and durable pending-publication
  outbox without claiming an authoritative remote load

## Current Socket-Authoritative Startup Flow

The implemented socket-authoritative session uses this RenderApp startup
ordering:

1. Require `fileId`, create Actor identity, and open the socket document
   session.
2. Receive one checkpoint/durable sequence plus the exact pending tail through
   a fixed head-sequence cutoff.
3. Start Core through a load-only checkpoint boundary.
4. Apply the pending tail through the ordinary App remote canonical processor.
5. Open the App-owned IndexedDB outbox and submit unaccepted local
   publications in file-local append order.
6. Reconcile accepted local and peer publications in the server-assigned
   sequence without creating duplicate local History or echo.
7. Enable later live publication send/receive beginning at the next sequence.

The browser does not call canonical document persistence `PUT` or `DELETE` and
does not register Core autosave. Socket unavailability does not disable the
local canonical path: actions continue into the durable publication outbox,
the lifecycle retries once every 30 seconds, and only disconnected/reconnected
state transitions produce ordinary connection toasts. Repeated operation
failures remain console-only. The same order applies to one-Actor and
multi-Actor sessions.

Authority:
`../specs/socket-authoritative-document-session.md`.

4. DataContexts effects

- on render-ready: publish `fileLoadComplete()`
- on file-load-complete: trigger `zoomFit` feature API

## Rules

- Keep registration/init in deterministic order.
- Preset completion is synchronous composition evidence, not Core readiness;
  only the later `core.start()` owns permanent closure and ready publication.
- Complete preset customization before diagnostics, capabilities, input-system,
  app feature initialization, and the first `core.start()`.
- Remove only a relation when source/target capabilities should remain. Use the
  relevant Core unregister API before defining a complete custom
  implementation. Use `redefinePropertyType()` only for the bounded atomic
  fixed-field config-mode contract; there is no general replace API or preset
  extension target.
- Redefinition never maps old/new field meaning or rewrites render, UI,
  commands, relations, or persisted data. Register any app semantic migration
  before package validation and adapt each consumer explicitly.
- Do not continue redefine after missing target, active usage, or cleanup
  failure; do not add duplicate tolerance or app exceptions to framework code.
- Init modules must be idempotent (safe to call once, no duplicate registrations).
- Foundation init is required for app boot (`input-system`, `features`).
- Capability init is optional and scoped to a single feature area; it may:
  - define system/UI properties for that capability
  - register render layers
  - subscribe to events to keep derived state in sync
- Derived-state init should only mirror or compute state from existing sources.
- Avoid placing feature behavior or UI logic in init modules; those belong in
  `src/features/*` or `src/common-apis/*`.
- Current implementation: Core owns load and explicit serialization only; do
  not restore automatic complete-document save orchestration.
- Do not add another App autosave route. The mandatory socket session replaces
  Core autosave; frontend startup keeps only the authoritative load handshake,
  and the App publication outbox remains distinct from canonical document
  persistence.
- Keep startup side effects explicit in init modules.
- Keep app startup concrete-engine-neutral; Preset owns default provider
  selection/diagnostics, `Render` owns reversible provider state, the concrete
  engine package owns its instance/resources, and Core owns the default
  `RenderAdapter` lifecycle.
- Renderer/engine capability must not select an app product mode.
- Keep AI activation explicit and default-off. Model/provider selection,
  credentials, permission, confirmation, and app action definitions do not
  belong in Core or Preset startup.
