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

- currently reserved (no-op) for future bezier editing.

## Point Hover/Selection

- hover feature updates `hoveredVectorPoint` and cursor (`pointer`/`default`).
- select-point feature selects hovered point when in path-editing mode and non-pen tool.

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
