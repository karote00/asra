# Module: Common APIs

## Purpose

`src/common-apis/*` is the app reuse boundary for feature mutations/queries.

## API Inventory

- `cursor.ts`
  - canvas cursor updates

- `element.ts`
  - create element
  - hit-test by bounds
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
  - direct transaction event wrappers (used where needed)

## Rules

- Feature files should prefer these APIs instead of duplicating logic.
- Mutation APIs should preserve undo grouping intent.
- Keep app-domain-specific behavior here, not in framework packages.

## Notable Behaviors

- `elementApis.changeComputedData(...)` wraps write in start/end transaction.
- Vector geometry updates normalize anchor points against computed bounds.
- Hit-testing is bounds-based (`isPointInsideElement`) for selection/hover behavior.
