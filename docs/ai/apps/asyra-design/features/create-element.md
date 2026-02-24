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
- apply geometry updates via `elementApis.changeComputedData`

3. End
- if drag movement is below threshold, reset to default element size

## Notes

- intended undo grouping is per API call path currently used by element common APIs
- movement threshold uses `MOUSE_MOVEMENT_THRESHOLD`
