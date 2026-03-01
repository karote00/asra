# PRD: Element Creation

## Problem

Users need low-friction shape creation with both quick default-size placement and drag-sized placement.

## Goals

- create rectangles and ovals via shared interaction model
- auto-select newly created element
- provide threshold-based click-vs-drag behavior

## Functional Requirements

1. With rectangle/oval tool active, mouse down starts creation.
2. Drag updates width/height and origin correctly for negative drag direction.
3. Small movement uses default element size.
4. Created element is selected immediately.
5. Creation is visible in contents panel and property panel.

## Constraints

- behavior implemented via `create-element` feature session
- geometry writes use `elementApis.changeComputedData`

## Success Criteria

- `element-creation.spec.ts` and `oval.spec.ts` creation scenarios pass
- click and drag creation both work repeatedly without state corruption

## References

- `apps/asyra-design/src/features/create-element/index.ts`
- `apps/asyra-design/src/common-apis/element/index.ts`
