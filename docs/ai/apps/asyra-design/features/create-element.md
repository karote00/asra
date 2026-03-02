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
- create element at mouse down position
- select created element
- store drag-start workspace position in session state

2. Update
- while dragging, compute width/height from drag delta
- handle negative drag by flipping origin
- apply geometry updates via `elementApis.changeComputedData` with `undoable: false` for continuous drag frames

3. End
- if drag movement is below threshold, reset to default element size

## Notes

- intended undo grouping is one create action unit; continuous drag-frame geometry updates are excluded from undo stack
- movement threshold is app-owned and feature-level via `FEATURE_MOVEMENT_THRESHOLD.createElement`
