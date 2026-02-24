# Module: Init and Startup

## Entry Points

- `src/index.tsx`
- `src/init/index.ts`
- `src/init/init-app.ts`
- `src/init/init-features.ts`
- `src/init/init-input-system.ts`
- `src/render-app/index.tsx`
- `src/contexts/data-change.tsx`

## Startup Order (Current)

1. `initApp()`
- `initPropertyRegistrations()`
- `initInputSystem()`
- `initFeatures()`

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
- Do not duplicate persistence load/save orchestration in app when core.start already handles persistence.
- Keep startup side effects explicit in init modules.
