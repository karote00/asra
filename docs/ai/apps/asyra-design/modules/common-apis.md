# Module: Common APIs

## Purpose

`src/common-apis/*` is the app reuse boundary for feature mutations/queries.

## API Inventory

- `cursor.ts`

  - canvas cursor updates

- `element/apis.ts` with an export-only `element/index.ts`

  - create element
  - explicit workspace/official-Group create parent handoff
  - workspace-to-parent point conversion for active create geometry
  - Group-normalized create geometry mutation (`changeElementGeometry`)
  - renderer-backed geometry hit-test for canvas targeting
  - canonical element-bounds client containment through the current
    identity-safe Render transform
  - element lock/visible query + toggle helpers
  - element position query + batch move helper
  - computed data mutation helper (`changeComputedData`)

- `element/vector-apis.ts` and focused `element/vector-*` modules

  - vector anchor point queries and updates
  - topology validation and repair
  - vector operation intents, handle modes, geometry, and Bezier adaptation

- `fills.ts` / `strokes.ts`

  - repeatable appearance-property mutations
  - gradient geometry and stroke-related vector-bounds repair

- `property-patch.ts`

  - app-owned changed-field traversal shared by fill and stroke mutations

- `selection.ts`

  - read/toggle/set/clear selection through core/selection

- `system-context.ts`

  - primary tool switching
  - path-editing mode and vector point state helpers
  - canonical path-editing exit clears transient editing state and activates Select

- `viewport.ts`

  - zoom center, pan, zoom-fit via system properties

- `history.ts`

  - undo/redo wrappers

- `hierarchy.ts`

  - ID-based official Group and ungroup routing through Preset
  - reorder/reparent routing through Preset's geometry-aware Core adapter
  - canonical current workspace id query through the public Core facade
  - atomic subtree removal through the public Core facade
  - no selection, shortcut, menu, hover/click, naming, or post-operation policy

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
- `elementApis.createElement(...)` and `selectionApis.selectElements(...)` also
  accept optional mutation options and forward them to Core.
- `elementApis.createElement(...)` converts a missing caller parent into the
  explicit canonical workspace id. For an official Group parent, it creates at
  the workspace position and uses Preset's identity-preserving reparent adapter
  in the same transaction; it never calls Core's unspecified-parent path.
- `elementApis.getPositionInParent(...)` uses the current viewport and
  identity-safe chosen-parent transform only for coordinate conversion.
  `elementApis.changeElementGeometry(...)` applies the geometry write and
  Preset ancestor-Group normalization in one transaction.
- Failure in a finite common-API mutation group rolls back all recorded
  rollbackable scene-tree, props, and selection changes before rethrowing.
- `hierarchyApis` keeps one intended group, ungroup, move/reorder, or subtree
  removal in one transaction. Preset owns only official Group coordinates and
  bounds; Scene Tree remains the hierarchy validator/mutator.
- Vector geometry updates normalize anchor points against computed bounds.
- Canvas hit-testing uses renderer geometry (`getElementIdAtClientPos`) so
  visible-element hover targeting follows fill or stroke geometry. When no
  visible raw hit exists, the hover controller may separately use
  `isClientPositionInsideElementBounds(...)` for official Group canonical
  bounds; that query is not a Render fallback and is not used by click
  selection, move, or create-parent targeting.
- Bounds utilities remain in use for area selection and intersection queries.
- Vector handle mode helpers read/write anchor-level canonical computed data
  (`none`, `mirror-angle`, `mirror-angle-length`) for drag and panel edits; they
  do not use a transient app-only map.
- Vector topology commits validate segment/network consistency and fail fast on
  invalid references.
- `vectorGeometry.*` centralizes topology repairs for add/move/split/update
  flows and builds computed-data patches.
