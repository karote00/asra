# Feature: Selection

## Sources

- `src/features/selection/index.ts`

## Selection Feature

### Trigger

- event: `input.drag`
- mode: session (`onStart` used)
- priority: `5`
- exclusive: `false`

### Behavior

- active only when primary tool is `select`
- if path editing mode is active, selection by drag start is blocked
  - this prevents selecting non-editing elements while path editing is active
- if drag start is on an unlocked element (selected or not), move ownership is handled by `move-elements` (higher-priority exclusive feature)
- if drag start is inside the current selection bounds, move ownership is handled by `move-elements` (even if the hit-test target is unselected)
- resolves hovered element id from bounds hit-test
- locked or hidden elements are ignored for canvas click selection
- with Shift: toggle selection
- without Shift: replace selection
- drag start on empty canvas: begin area selection session
- drag update on empty canvas: update area selection bounds and selection set
- drag end on empty canvas: select elements intersecting bounds (Shift toggles membership)
- area selection excludes locked or hidden elements
- click-only empty hit: clear selection

### Transaction handling

- wraps selection change in start/end transaction in feature

## Path Editing Interaction

- selection flow calls path-editing cleanup when selection no longer matches editing vector
- keeps editing focus when selected vector remains the same single selection
