# Feature: Create Element

## Source

- `src/features/create-element/feature.ts`

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
- resolve the mouse-down raw Render hit through the same canonical hierarchy
  target policy used by canvas hover/selection/move
- use the resolved official Group as the create parent, use a resolved
  non-Group's official Group parent, or use the explicit workspace root when
  there is no raw hit
- reject creation when the canonical hierarchy or exact parent scope is
  invalid; never leave parent unspecified or activate Scene Tree's legacy
  first-Frame fallback
- create the element at mouse down position without supplying or mutating width/height, so its element-owned initial data remains authoritative
- for a Group parent, keep creation and Preset's identity-preserving
  reparent/coordinate/bounds normalization in one transaction
- immediately project the undoable ADD_ELEMENT so the canvas and Contents panel show it before pointer-up
- select and immediately project the created element so selection-derived UI is available during the active session
- store drag-start workspace position and latest applied bounds in session
  state

2. Update

- while dragging, compute width/height from drag delta
- handle negative drag by flipping origin
- convert current workspace drag points through the current selected-parent
  transform and apply geometry via `elementApis.changeElementGeometry` with
  `sharedDelivery: 'immediate'`; each applied input update uses the complete
  canonical shared pipeline without ending the outer session transaction
- update only the created child; do not normalize ancestor Group bounds,
  rebase siblings, or append Group changes after drag geometry updates
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
- Render supplies identity-safe hit/transform inputs only; canonical parent
  membership comes from the app hierarchy projection and Group geometry
  normalization comes from Preset
- `onEnd` owns conditional mouseup finalization; `onCancel` performs no
  canonical write because Factory owns failure rollback
- movement threshold is app-owned and feature-level via `FEATURE_MOVEMENT_THRESHOLD.createElement`
