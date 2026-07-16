# Module: Init and Startup

## Entry Points

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

## Startup Order (Current)

1. `initApp()`

- `applyPreset(core)` uses the omitted-composition compatibility path: it
  installs all shared defaults, selects the fresh Pixi engine factory, selects
  no optional bundles, and returns a completed composition result before app
  initialization continues
- the current app uses the no-customization compatibility route; when app policy
  needs customization, call public Core remove/unregister/define APIs after
  `applyPreset(core)` and before the remaining init steps
- diagnostics: `initLoadDiagnostics()`
- derived-state sync: `initSelectionCompatibility()`, `initPathEditingContinuation()`
- capability init: `initAreaSelection()`, `initGradientFillEditing()`, `initVectorIconData()`
- foundation: `initInputSystem()`, `initFeatures()`

2. React mount

- mounts `DataContexts`
- mounts `App`

3. RenderApp effect

- `core.setRenderer(new RenderAdapter())`
- `core.setPersistence(providers.localStorage)`
- `core.start(container, options)`
- if renderer/engine initialization rejects, Core stops before observers,
  persistence load, features, and render-ready publication

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
  implementation; there is no replace API or preset extension target.
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
- Do not duplicate persistence load/save orchestration in app when core.start already handles persistence.
- Keep startup side effects explicit in init modules.
- Keep app startup concrete-engine-neutral; Preset owns default factory
  selection/diagnostics, `Render` owns reversible provider state, the concrete
  engine package owns its instance/resources, and the app uses
  `RenderAdapter` only.
- Renderer/engine capability must not select an app product mode.
