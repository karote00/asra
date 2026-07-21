# Feature: Create Element

## Source

- `src/features/create-element/index.ts`

## Trigger

- event: `input.drag`
- mode: session
- priority: `10`
- exclusive: `true`

## Active Tools

- rectangle (`rect`)
- oval (`oval`)

## Behavior

1. Start

- if tool is not rectangle/oval, do nothing
- create the element at mouse down position without supplying or mutating width/height, so its element-owned initial data remains authoritative
- immediately project the undoable ADD_ELEMENT so the canvas and Contents panel show it before pointer-up
- select and immediately project the created element so selection-derived UI is available during the active session
- store drag-start workspace position and latest applied bounds in session
  state

2. Update

- while dragging, compute width/height from drag delta
- handle negative drag by flipping origin
- apply geometry updates via `elementApis.changeComputedData` with
  `sharedDelivery: 'immediate'`; each applied input update uses the complete
  canonical shared pipeline without ending the outer session transaction
- keep selection-overlay projection aligned with the current render-frame geometry, including rapid negative-direction drag updates

3. End

- if drag movement is below threshold, reset the completed element to the
  100×100 click-creation size with `sharedDelivery: 'immediate'`
- after a significant drag, do not replay geometry that already matches the
  latest applied bounds; if pointer-up contains a newer final position, apply
  that final canonical geometry once with `sharedDelivery: 'immediate'`
- switch primary tool back to select after creation completes

4. Cancel

- cancel policy is `commit-current`
- Escape, tool switching, or a new conflicting action finalizes the shape at
  the interruption moment and creates one undo entry
- handler failure or timeout still rolls back and removes the created canonical
  element; Factory discards an unflushed immediate publication or emits linked
  compensation for one that was already published

## Notes

- intended undo grouping is one create pointer session; mousedown, applied drag
  updates, and conditional mouseup writes remain in that one undo entry
- one synchronous delivery action produces one publication, one Yjs update,
  and one provider send; a create pointer session may contain several of these
  delivery actions
- canonical create and geometry data never use Awareness or a render preview
  layer
- `onEnd` owns conditional mouseup finalization; `onCancel` performs no
  canonical write because Factory owns failure rollback
- movement threshold is app-owned and feature-level via `FEATURE_MOVEMENT_THRESHOLD.createElement`
