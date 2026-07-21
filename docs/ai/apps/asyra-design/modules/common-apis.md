# Module: Common APIs

## Purpose

`src/common-apis/*` is the app reuse boundary for feature mutations/queries.

## API Inventory

- `cursor.ts`

  - canvas cursor updates

- `element.ts`

  - create element
  - renderer-backed geometry hit-test for canvas targeting
  - element lock/visible query + toggle helpers
  - element position query + batch move helper
  - vector anchor point queries and updates
  - computed data mutation helper (`changeComputedData`)

- `selection.ts`

  - read/toggle/set/clear selection through core/selection

- `system-context.ts`

  - primary tool switching
  - path-editing mode and vector point state helpers

- `viewport.ts`

  - zoom center, pan, zoom-fit via system properties

- `history.ts`

  - undo/redo wrappers

- `render-layer.ts`

  - app-level render layer registration wrappers

- `transaction.ts`
  - `runTransaction` for finite mutation groups
  - manual start/end/rollback wrappers for interactions that span input events

## Rules

- Feature files should prefer these APIs instead of duplicating logic.
- Mutation APIs should preserve undo grouping intent.
- Keep app-domain-specific behavior here, not in framework packages.

## Notable Behaviors

- `elementApis.changeComputedData(...)` uses `runTransaction` and forwards
  optional mutation options (for example, `undoable: false`) to core.
- `elementApis.setElementPositions(...)` applies per-element `x/y` updates in
  one `runTransaction` boundary and forwards mutation options. Create/move
  features use `sharedDelivery: 'immediate'` so one synchronous multi-element
  update becomes one shared publication while the outer session remains one
  undo commit.
- `elementApis.createElement(...)` and `selectionApis.selectElements(...)` also accept optional mutation options and forward them to core.
- Failure in a finite common-API mutation group rolls back all recorded
  rollbackable scene-tree, props, and selection changes before rethrowing.
- Vector geometry updates normalize anchor points against computed bounds.
- Canvas hit-testing uses renderer geometry (`getElementIdAtClientPos`) so
  hover targeting follows visible element fill or stroke geometry.
- Bounds utilities remain in use for area selection and intersection queries.
- Vector handle mode helpers read/write anchor-level canonical computed data (`none`, `mirror-angle`, `mirror-angle-length`) for drag and panel edits; they do not use a transient app-only map.
- Vector topology commits validate segment/network consistency and fail fast on invalid references.
- Vector geometry helper (`vectorGeometry.*`) centralizes topology repairs for add/move/split/update flows and builds computed-data patches.
