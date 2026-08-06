# Feature: Move Elements

## Canvas Move Source

- `src/features/move-elements/feature.ts`

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
- if drag starts on an unselected unlocked element, selects that element as the
  drag target with `undoable: false`
- before the first mutation, configures `batchPublications: false` so every
  dependent drag source settles on peers in order; Undo/Redo retain the same
  source boundaries while the complete gesture remains one History entry
- snapshots unlocked selected element start positions in their canonical
  parent-local coordinates

2. Update

- ignores micro movement below `FEATURE_MOVEMENT_THRESHOLD.moveElement`
- computes workspace delta from drag start to current pointer
- applies per-element `x/y` position updates for selected elements with
  `sharedDelivery: 'immediate'` plus the explicit gesture-keyed
  `replace-latest` History option; all selected-element changes produced by one
  synchronous update are one ordered canonical publication without closing the
  outer transaction
- Vector and ordinary elements use this same fixed-size property batch. Vector
  point/control/segment/network records are neither read nor patched, so
  pointer-sample mutation cost and publication size do not grow with point count
- each sample opts into one gesture-keyed `replace-latest` History stage; the
  canonical property owner supplies one complete candidate bundle while
  Factory replaces only the latest bundle reference instead of merging every
  element into pending History
- leaves official Group origins and operation-produced bounds snapshots
  unchanged across child-only pointer samples

3. End

- if movement occurred, finalizes exactly one Undo action for the complete move
- does not replay positions that already match the latest applied drag update;
  if pointer-up contains a newer final position, applies all final positions
  once with the same immediate replace-latest History option
- keeps final drag position on canvas and lets the existing outer transaction
  commit the first-before/latest-after staged History bundle
- does not invoke Preset Group normalization after the final child-only
  position write, so the Undo action and publication contain only the moved
  targets
- if a drag crossed the movement threshold but returns exactly to its initial
  positions, the return update remains a real canonical delivery action
- if no movement occurred after starting inside selection bounds, selects the
  hovered element on mouse up (or clears selection if nothing is hovered)

4. Cancel

- cancel policy is `commit-current`
- Escape, tool switching, or a new conflicting action keeps the positions at
  the interruption moment and finalizes one move Undo entry
- handler failure or timeout restores the transaction-start element positions
  and selection without creating a move undo entry

## Notes

- drag-to-move is intentionally separated from selection feature ownership
- selection feature continues to own click/select/deselect and shift-toggle behavior
- all applied drag updates remain rollbackable and use explicit opt-in
  replace-latest History staging; `onEnd` only fills a missing final pointer
  update and does not restore/replay state
- ordinary mutations without the staging option retain append-only History
- staged History stores complete owner-issued bundles locally and never enters
  canonical data, collaboration payloads, persistence, or Render
- canonical element position never travels through Awareness; one synchronous
  multi-element update becomes one publication, one Yjs update, and one
  provider send
- a 7,001-point Vector and the densest Vector in the complete checked-in
  `crdt-7076` cat-face sample use the same point-free move contract
- commit-current interruption uses the normal `onEnd` finalization; rollback
  cancellation performs no canonical cleanup write and Factory reverses
  failure-path mutations

## Layers Hierarchy Move

### Sources

- `src/features/layer-hierarchy-move/index.ts`
- `src/controllers/layer-pointer-session.ts`
- `src/controllers/layer-move-source.ts`
- `src/controllers/layer-drop-intent.ts`
- `src/controllers/layer-move-session.ts`
- `src/contents/contents-panel.tsx`

### Trigger

- app-owned Layers DOM pointer session: `input.layerHierarchyMove`
- mode: session
- priority: `110`
- exclusive: `true`
- cancel policy: `commit-current`

### Behavior

1. Pointer-down derives one complete source from the clicked row and current
   app selection. Locked, missing, duplicate, workspace, stale, or mixed-parent
   sources reject as a whole.
2. Pointer capture and drag feedback begin only after
   `FEATURE_MOVEMENT_THRESHOLD.layerHierarchy`; a below-threshold interaction
   remains ordinary row selection.
3. Pointer updates project one UI-local `before`, `after`, `inside`,
   `workspace`, or `invalid` state. They do not write hierarchy, geometry,
   history, or publication.
4. Pointer-up over a valid target invokes
   `hierarchyApis.moveElements(...)` exactly once. The request index is measured
   in the final target child list after moved ids in that parent are removed.
5. Scene Tree returns canonical moved-id order; the feature applies that exact
   post-selection in the same intended transaction.
6. Escape, pointer cancel, lost capture, unmount, invalid target, or outside
   drop clears all presentation state and creates no hierarchy request.
7. A successful inside drop on a collapsed Group expands it only in UI-local
   state after canonical commit.

### Boundaries

- Layers owns pointer routing, source/drop intent, selection policy, and
  presentation.
- Preset owns Group-boundary coordinate conversion and bounds normalization.
- Scene Tree owns final validation, canonical order, parent membership, index,
  self/cycle prevention, and mutation.
- Factory owns the one transaction, rollback, undo/redo, and publication.
- Render receives only the committed canonical hierarchy for the same entity
  and engine handle.
- Collaboration remains transport-only; remote permission, ordering,
  duplicate, and conflict policy stay app/backend-owned.
