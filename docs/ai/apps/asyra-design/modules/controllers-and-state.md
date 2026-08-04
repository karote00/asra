# Module: Controllers and App State

## Sources

- `src/controllers/app.ts`
- `src/controllers/scene-tree.ts`
- `src/controllers/element-selection.ts`
- `src/controllers/group-commands.ts`
- `src/controllers/layer-pointer-session.ts`
- `src/controllers/layer-move-source.ts`
- `src/controllers/layer-drop-intent.ts`
- `src/controllers/layer-move-session.ts`
- `src/controllers/layer-dom-drop-target.ts`
- `src/states/app.ts`
- `src/contexts/core.ts`

## Responsibilities

### `controllers/app.ts`

- delegates render lifecycle calls to core (`setupInputSystem`, `renderIsReady`)
- delegates primary-tool change to feature API (`getFeature(FeatureNames.SWITCH_PRIMARY_TOOL)`)
- owns the temporary `crdt-7076-sample` demo Reset adapter (`resetData`), which
  delegates save-empty-then-refresh behavior to `config/demo-document.ts` and
  is not a formal document mutation path

### `controllers/scene-tree.ts`

- validates numeric layout property updates
- routes element computed-data writes through `elementApis.changeComputedData(...)`

### `controllers/element-selection.ts`

- thin wrapper for list-panel selection -> `core.selectElements(...)`

### Group and Layers hierarchy controllers

- `group-commands.ts` derives app command availability and ID-only intent from
  selection plus canonical Layers projection; Scene Tree remains final
  validator.
- `layer-pointer-session.ts` normalizes threshold, pointer identity, and
  deterministic end/cancel reasons.
- `layer-move-source.ts` keeps one complete sibling source or rejects it
  without partial filtering or app-side canonical ordering.
- `layer-drop-intent.ts` derives advisory drop zone and final-list target index
  without hierarchy or geometry mutation.
- `layer-dom-drop-target.ts` maps only Layers DOM rows/empty area to stable
  target ids and zones.
- `layer-move-session.ts` routes normalized phases through the public Core
  SessionManager; the registered feature owns the intended transaction.

### `states/app.ts`

- stores render app instance for mount/unmount lifecycle
- keeps UI-level app reference out of core packages

## Rules

- Controllers are orchestration adapters; domain mutation stays in common APIs.
- `states/app.ts` should only hold UI runtime objects (renderer instance), not domain data.
- If controller behavior defines a reusable interaction contract, move it to common API.
