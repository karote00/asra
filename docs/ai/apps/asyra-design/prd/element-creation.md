# PRD: Element Creation

## Problem

Users need low-friction shape creation with both quick default-size placement and drag-sized placement.

## Goals

- create rectangles and ovals via shared interaction model
- auto-select newly created element
- provide threshold-based click-vs-drag behavior

## Functional Requirements

1. With rectangle/oval tool active, mouse down creates and immediately projects an element using its element-owned initial data; the create interaction must not write width or height.
2. While the pointer remains down, drag updates are projected continuously and update width/height and origin correctly for negative drag direction; the selection outline must use the same current-frame element bounds.
3. Mouse up without movement resets the completed element to the 100×100 click-creation size.
4. Created element is selected immediately.
5. Creation is visible in the Contents panel and property panel during the active pointer session.

## Constraints

- behavior implemented via `create-element` feature session
- geometry writes use `elementApis.changeComputedData`

## Success Criteria

- `element-creation.spec.ts` and `oval.spec.ts` creation scenarios pass
- click and drag creation both work repeatedly without state corruption

## References

- `apps/asyra-design/src/features/create-element/feature.ts`
- `apps/asyra-design/src/common-apis/element/index.ts`
