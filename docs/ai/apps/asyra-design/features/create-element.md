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
- store drag-start workspace position in session state

2. Update

- while dragging, compute width/height from drag delta
- handle negative drag by flipping origin
- apply geometry updates via `elementApis.changeComputedData` with `undoable: false` for continuous drag frames
- keep selection-overlay projection aligned with the current render-frame geometry, including rapid negative-direction drag updates

3. End

- if drag movement is below threshold, reset the completed element to the 100×100 click-creation size
- switch primary tool back to select after creation completes

4. Cancel

- cancel policy is `rollback`
- Escape, tool switching, a new conflicting action, handler failure, or timeout
  removes the created canonical element and compensates its immediate local
  shared projection
- cancellation does not create an undo entry

## Notes

- intended undo grouping is one create action unit; continuous drag-frame geometry updates are excluded from undo stack
- immediate shared projection does not end or split the create transaction; pointer-up still commits one undoable create action
- `onCancel` has no additional canonical mutation because Factory owns journal
  reversal; feature cleanup remains runtime-only
- movement threshold is app-owned and feature-level via `FEATURE_MOVEMENT_THRESHOLD.createElement`
