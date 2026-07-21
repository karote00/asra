# Feature: Move Elements

## Source

- `src/features/move-elements/index.ts`

## Trigger

- event: `input.drag`
- mode: session
- priority: `8`
- exclusive: `true`

## Behavior

1. Start

- active only when primary tool is `select`
- blocked when Shift is held (preserves selection-toggle semantics)
- blocked while path-editing mode is active
- blocked when hovered element is locked (`lock=true`)
- drag start inside current selection bounds (even on empty space) moves the
  existing selection without replacing it
- if drag starts on an unselected unlocked element, selects that element as drag target first (undoable; rolls back on drag undo)
- snapshots unlocked selected element start positions in workspace coordinates

2. Update

- ignores micro movement below `FEATURE_MOVEMENT_THRESHOLD.moveElement`
- computes workspace delta from drag start to current pointer
- applies per-element `x/y` position updates for selected elements with
  explicit `sharedDelivery: 'immediate'`; all selected-element changes produced
  by one synchronous update are one ordered canonical publication without
  closing the outer transaction

3. End

- if movement occurred, finalizes one intended undoable move commit
- does not replay positions that already match the latest applied drag update;
  if pointer-up contains a newer final position, applies all final positions
  once with `sharedDelivery: 'immediate'`
- keeps final drag position on canvas while preserving one-session undo/redo
- if a drag crossed the movement threshold but returns exactly to its initial
  positions, the return update remains a real canonical delivery action
- if no movement occurred after starting inside selection bounds, selects the
  hovered element on mouse up (or clears selection if nothing is hovered)

4. Cancel

- cancel policy is `commit-current`
- Escape, tool switching, or a new conflicting action keeps the positions at
  the interruption moment and creates one move undo entry
- handler failure or timeout restores the transaction-start element positions
  and selection without creating a move undo entry

## Notes

- drag-to-move is intentionally separated from selection feature ownership
- selection feature continues to own click/select/deselect and shift-toggle behavior
- all applied drag updates remain in one outer undo entry; `onEnd` only fills a
  missing final pointer update and does not restore/replay state
- canonical element position never travels through Awareness; one synchronous
  multi-element update becomes one publication, one Yjs update, and one
  provider send
- `onCancel` performs no canonical write, and Factory reverses failure-path
  mutations
