# Module: Common APIs

## Purpose

`src/common-apis/*` is the app reuse boundary for feature mutations/queries.

## API Inventory

- `cursor.ts`

  - canvas cursor updates

- `element/apis.ts` with an export-only `element/index.ts`

  - create element
  - explicit workspace-position and appearance payload handoff
  - explicit workspace/official-Group create parent handoff
  - workspace-to-parent point conversion for active create geometry
  - Group-normalized create geometry mutation (`changeElementGeometry`)
  - ordered ordinary Vector batch creation through
    `elementApis.createElements(...)` and Core `createElementsInParent(...)`
  - renderer-backed geometry hit-test for canvas targeting
  - element lock/visible query + toggle helpers
  - element position query + batch move helper
  - computed data mutation helper (`changeComputedData`)

- `element/vector-apis.ts` and focused `element/vector-*` modules

  - vector anchor point queries and updates
  - stable local topology plus Render-owned workspace/local projection
  - center-based whole-vector element scaling without point-record mutation
  - topology validation and repair
  - vector operation intents, handle modes, geometry, and Bezier adaptation

- `fills.ts` / `strokes.ts`

  - repeatable appearance-property mutations
  - first-canonical-fill and first-canonical-stroke color query/update
    boundaries for bounded feature actions
  - gradient geometry; stroke edits never rewrite independent Vector transform
    values

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

  - ordinary undo/redo wrappers
  - disposable app-root-local AI current-action projection over canonical
    action, Undo, and Redo events
  - action-id correlation only; no UI-owned history stack, inverse, snapshot,
    or replay patch

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
  undo commit. Continuous move samples intentionally do not normalize Group
  origins; `move-elements` invokes Preset normalization deepest-first once
  after its final position write and before that session transaction commits.
- `elementApis.createElement(...)` and `selectionApis.selectElements(...)` also
  accept optional mutation options and forward them to Core.
- `elementApis.createElement(...)` accepts an explicit `workspacePosition`
  without consulting Render/client geometry, and forwards explicit `fills` and
  `strokes` for deterministic app-owned composition creation.
- `elementApis.createElement(...)` converts a missing caller parent into the
  explicit canonical workspace id. For an official Group parent, it creates at
  the workspace position and uses Preset's identity-preserving reparent adapter
  in the same transaction by default; when the caller supplies the already
  validated `parentWorkspaceOrigin`, it writes the equivalent Group-local
  computed position directly and skips the post-hoc move. It never calls Core's
  unspecified-parent path.
- `elementApis.createElements(...)` routes each same-parent Vector chunk
  through Core's injected Scene Tree batch request without retaining the large
  payload in the event bus. Scene Tree applies growing parent membership once
  per internal chunk through its clone-free canonical owner write instead of
  generic Setter copies, while each Vector retains its own canonical id,
  topology, style, ordinary render route, rollback evidence, and undo replay.
  The ordered `ADD_ELEMENT` records remain the only externally delivered batch
  evidence. A supplied
  `parentWorkspaceOrigin` converts the incoming workspace topology to stable
  Vector-local points while storing the prepared Vector bounds in Group-local
  coordinates. The AI
  action creates one canonical Group first, bounds only simultaneous transient
  topology representations, streams every accepted chunk directly into that
  Group in order, and remains inside one outer transaction; mixed primitive
  batches retain the existing per-element common API fallback without changing
  transaction ownership.
- `elementApis.getPositionInParent(...)` uses the current viewport and
  identity-safe chosen-parent transform only for coordinate conversion.
  `elementApis.changeElementGeometry(...)` applies the geometry write and
  Preset ancestor-Group normalization in one transaction.
- Failure in a finite common-API mutation group rolls back all recorded
  rollbackable scene-tree, props, and selection changes before rethrowing.
- `strokeApis.getPrimaryStrokeColor(...)` and
  `strokeApis.updatePrimaryStrokeColor(...)` query or update only the first
  canonical stroke through the shared property boundary; missing strokes and
  identical colors are no-change results.
- `hierarchyApis` keeps one intended group, ungroup, move/reorder, or subtree
  removal in one transaction. Preset owns only official Group coordinates and
  bounds; Scene Tree remains the hierarchy validator/mutator.
- Vector point/control records are canonical local geometry. Element transform
  values never normalize or rebase that topology.
- `elementApis.setElementPositions(...)` sends the same constant-size `x/y`
  update for Vector and ordinary elements; point count is not part of move cost.
- `elementApis.scaleVectorElementAroundCenter(...)` updates only
  `x/y/width/height` around the current center and commits through the ordinary
  element property route. It never patches point/control records.
- Point/handle edits inverse-project workspace intent through Render, then patch
  only changed local records plus bounded geometry evidence.
- Canvas hit-testing uses renderer geometry (`getElementIdAtClientPos`) so
  hover targeting follows visible element fill or stroke geometry.
- Bounds utilities remain in use for area selection and intersection queries.
- Vector handle mode helpers read/write anchor-level canonical computed data
  (`none`, `mirror-angle`, `mirror-angle-length`) for drag and panel edits; they
  do not use a transient app-only map.
- Vector topology commits validate segment/network consistency and fail fast on
  invalid references.
- `vectorGeometry.*` centralizes topology repairs for add/move/split/update
  flows and builds computed-data patches.
