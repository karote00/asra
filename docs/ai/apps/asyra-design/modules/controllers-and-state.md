# Module: Controllers and App State

## Sources

- `src/controllers/app.ts`
- `src/controllers/scene-tree.ts`
- `src/controllers/element-selection.ts`
- `src/states/app.ts`
- `src/contexts/core.ts`

## Responsibilities

### `controllers/app.ts`

- delegates render lifecycle calls to core (`setupInputSystem`, `renderIsReady`)
- delegates primary-tool change to feature API (`importFeature('switchPrimaryTool')`)
- owns app reset utility (`resetData`)

### `controllers/scene-tree.ts`

- validates numeric layout property updates
- routes element computed-data writes through `elementApis.changeComputedData(...)`

### `controllers/element-selection.ts`

- thin wrapper for list-panel selection -> `core.selectElements(...)`

### `states/app.ts`

- stores render app instance for mount/unmount lifecycle
- keeps UI-level app reference out of core packages

## Rules

- Controllers are orchestration adapters; domain mutation stays in common APIs.
- `states/app.ts` should only hold UI runtime objects (renderer instance), not domain data.
- If controller behavior defines a reusable interaction contract, move it to common API.
