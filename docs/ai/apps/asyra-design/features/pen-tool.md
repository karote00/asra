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

### Trigger

- event: `input.drag`
- priority: `15`
- exclusive: `true`

### Start behavior

1. If primary tool is not pen -> no-op.
2. If selected vector is active path-editing target -> append anchor point.
3. If not editing selected vector -> create new vector with first point.
4. New/updated point becomes selected vector point state.

### Update/End

- while mouse remains down, if new point has a connected previous point in the same subpath:
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
- select-point feature selects hovered point target when in path-editing mode and non-pen tool.

## Curve Handle Visual/Selection Contract

- curve handles render as diamonds in vector path-editing overlay
- path-editing segment rendering rule:
  - if either adjacent handle exists (`prev.outHandle` or `current.inHandle`), render that segment as cubic bezier
  - if no adjacent handles exist, render as straight line
- vector geometry bounds are computed from segment geometry (including cubic bezier extrema), not anchor coordinates only
- virtual preview segment (pen hover before commit) follows the same rule:
  - if preview start point has `outHandle`, render bezier preview
  - otherwise render straight preview line
- handle style:
  - same fill color/size as anchor points
  - white 1px stroke
  - selected target uses same blue selection outline style as selected anchor points
- curve handles are selectable targets and feed point target data to the property panel

## Enter Path Editing

- Enter shortcut: enters path editing when exactly one selected element is vector.
- Double click: enters path editing only if double-click hits currently selected vector bounds.

## Escape / Cancel Semantics

Handled by `cancelPenEditing`:

1. no editing vector -> cursor reset only
2. editing vector + non-pen tool -> exit path editing directly
3. editing vector + pen tool + connected subpath
- first escape marks new-subpath split state
- if current subpath has one move-point only, that subpath point is removed
4. editing vector + pen tool + already split/new-subpath state
- second escape exits path editing and switches primary tool to select

## Path Editing State Keys

- `pathEditingVectorId`
- `pathEditingStartNewSubpath`
- `selectedVectorPoint`
- `hoveredVectorPoint`

These are managed through `systemContextApis` helpers.
