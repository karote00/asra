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
- `applyPreset(core)`
- diagnostics: `initLoadDiagnostics()`
- derived-state sync: `initSelectionCompatibility()`, `initPathEditingContinuation()`
- capability init: `initAreaSelection()`, `initGradientFillEditing()`, `initVectorIconData()`
- foundation: `initInputSystem()`, `initFeatures()`

2. React mount
- mounts `DataContexts`
- mounts `App`

3. RenderApp effect
- `core.setRenderer(new PixiJSRenderer())`
- `core.setPersistence(providers.localStorage)`
- `core.start(container, options)`

4. DataContexts effects
- on render-ready: publish `fileLoadComplete()`
- on file-load-complete: trigger `zoomFit` feature API

## Rules

- Keep registration/init in deterministic order.
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
