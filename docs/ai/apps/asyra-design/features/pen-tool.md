# Feature: Pen Tool and Path Editing

## Source

- `src/features/pen-tool/index.ts`

## Related Features

- `pen` (session)
- `selectVectorPoint` (session)
- `hoverVectorPointCursor` (execution)
- `cancelPenEditing` (execution)
- `enterPathEditing` (execution, Enter)
- `enterPathEditingByDoubleClick` (execution, double click)

## Pen Session (`pen`)

### Vector Data Contract

- vector path runtime data is topology-native:
  - `points` (anchors + controls)
  - `segments` (edge linkage + optional control refs)
  - `networks` (ordered subpaths + closed state)
- pen add/drag/escape mutations update topology data directly through `elementApis` vector APIs
- no runtime conversion layer from legacy `anchorPoints` array models

### Trigger

- event: `input.drag`
- priority: `15`
- exclusive: `true`

### Start behavior

1. If primary tool is not pen -> no-op.
2. If selected vector is active path-editing target -> append anchor point.
3. If active vector is in split/new-subpath mode and user clicks an existing anchor:

- select that anchor first (no point is added on that click)
- if the clicked anchor is a subpath endpoint, exit split mode and resume continuation from that endpoint

4. If active vector is in connected add mode and user clicks an endpoint anchor:

- connect current continuation endpoint to the clicked endpoint (no new point is created on that click)
- if clicked endpoint is on another open subpath, both subpaths are merged into one open subpath
- if clicked endpoint is the opposite endpoint of the current open subpath, that subpath is closed (`networks[*].closed=true`)
- after endpoint connect commit (merge or close), pen enters split/new-subpath mode (`pathEditingStartNewSubpath=true`) so connected ghost-segment preview does not continue automatically

5. If not editing selected vector -> create new vector with first point.
6. New/updated point is selected through `selectionApis.selectVectorPoint(...)` (SelectionManager `VECTOR_POINT` channel).

### Update/End

- while mouse remains down, if new point has a connected previous point in the same subpath:
  - ignore micro pointer movement below pen feature drag threshold (`3` client px); no bezier handles are created in that case
  - drag motion updates bezier handles for both points
  - connected point `outHandle` update rule:
    - default (majority): preserve existing `p1` (`outHandle`) if present; otherwise use anchor fallback
    - special case: only when dragging point is the second point of the subpath, and connected point is first point with no user-defined handle, auto-compute figma-style handles:
      - `p2 = B - 0.8 * (M - B)` (new point `inHandle`)
      - `p1.x = A.x - 0.334 * (M.x - B.x)` (connected point `outHandle.x`)
      - `p1.y = A.y + 0.327 * (B.y - A.y)` (connected point `outHandle.y`)
      - new point `outHandle = M`
  - new point gets `inHandle` and `outHandle`
  - new point becomes smooth-point semantics
- first point of a subpath (no connected previous point) does not create bezier handles on drag
- on drag end, selected point target remains on the newly added anchor point

## Point Hover/Selection

- hover feature updates `hoveredVectorPoint` target (`anchor`, `inHandle`, `outHandle`) and cursor (`pointer`/`default`).
- if no point target is hovered, hover feature resolves segment hover into `hoveredVectorSegment`.
- pen hover flow resolves an explicit preview mode:
  - `connected-segment-preview` when pen has a connected append preview segment
  - `segment-insert-preview` when no connected append preview segment is available
- segment hover resolves `hoveredVectorSegmentInsertPoint` (projected workspace point on that segment) only in `segment-insert-preview`.
- while in `connected-segment-preview`, ghost insert point is hidden (segment split point preview is suppressed).
- in pen mode, point-target hover is allowed only in `connected-segment-preview` and only for endpoint anchors of the editing subpath.
- in pen `segment-insert-preview`, point hover is suppressed.
- in pen `connected-segment-preview`, segment hover is suppressed.
- point target hover takes precedence over segment hover when both are near the pointer.
- select-point feature (non-pen mode) selects hovered point target when in path-editing mode.
- select-point feature (non-pen mode) owns point-target drag editing:
  - drag start snapshots selected target position and drag-start workspace position
  - drag update applies target position with `undoable: false`
  - drag end restores initial target position (`undoable: false`) then commits final target position as one intended undoable action
  - movement below `FEATURE_MOVEMENT_THRESHOLD.moveVectorPoint` (`3` client px) is treated as click-only selection (no geometry mutation)
- when point hit is absent but path segment hit is present in non-pen mode, select-point feature selects the segment through `selectionApis.selectVectorSegment(...)`.
- pen session (pen mode) splits the hovered segment at the projected pointer position and selects the inserted anchor point.
- split preserves curve geometry by recomputing segment controls from cubic split math (`t`-based de Casteljau split) before committing topology.
- after segment split, pen keeps `pathEditingStartNewSubpath = true` (split mode), so connected append preview stays hidden until user explicitly resumes from a valid endpoint.
- point target selection takes precedence over segment selection.
- in path editing mode, hover/selection targets are restricted to the current `pathEditingVectorId` vector; other elements are ignored.
- if a selected or hovered point/segment is removed by topology edits, the selection/hover state is cleared deterministically.

## Curve Handle Visual/Selection Contract

- curve handles render as diamonds in vector path-editing overlay
- handle visibility is selection-window based:
  - only show handles for selected anchor `n` and its immediate neighbors (`n-1`, `n+1`) in the same subpath
  - for closed subpaths, neighbor window wraps around endpoints (for example selected first point includes last point as `n-1`)
  - when no anchor is selected, hide handle controls
- path-editing segment rendering rule:
  - segment rendering follows topology segment ids/control refs (`segments[*].outControlId/inControlId`) so path-editing overlay matches base vector render after load/refresh
  - if either referenced control exists, render that segment as cubic bezier
  - if no referenced controls exist, render as straight line
- vector geometry bounds are computed from segment geometry (including cubic bezier extrema), not anchor coordinates only
- virtual preview segment (pen hover before commit) follows the same rule:
  - if preview start point has `outHandle`, render bezier preview
  - otherwise render straight preview line
- handle style:
  - same fill color/size as anchor points
  - white 1px stroke
  - selected target uses same blue selection outline style as selected anchor points
- curve handles are selectable targets and feed point target data to the property panel
- moving an anchor point translates that anchor's `inHandle` and `outHandle` by the same delta (handle geometry follows anchor translation)
- dragging a selected `inHandle`/`outHandle` updates only that handle position and keeps the handle target selected
- switching handle mode to `none` removes existing handle nodes deterministically
- when handle mode is `mirror-angle`, dragging a handle mirrors the opposite handle angle while preserving its original length
- when handle mode is `mirror-angle-length`, dragging a handle mirrors both angle and length of the opposite handle

## Enter Path Editing

- Enter shortcut: enters path editing when exactly one selected element is vector.
- Double click: enters path editing only if double-click hits currently selected vector bounds.

## Escape / Cancel Semantics

Handled by `cancelPenEditing`:

1. path editing mode + vector point/segment selection

- clear vector point/segment selection
- clear compatibility vector point/segment state

2. path editing mode + no vector point/segment selection

- exit path editing mode

3. not in path editing mode + element selection

- clear element selection

## Path Editing State Keys

- `pathEditingVectorId`
- `pathEditingStartNewSubpath`
- `vectorPointSelection` / `vectorSegmentSelection` (selection channels)
- `selectedVectorPoint` (compatibility mirror derived from `vectorPointSelection`)
- `selectedVectorSegment` (compatibility mirror derived from `vectorSegmentSelection`)
- `hoveredVectorPoint`
- `hoveredVectorSegment`
- `hoveredVectorSegmentInsertPoint`

These are managed through `systemContextApis` helpers.
