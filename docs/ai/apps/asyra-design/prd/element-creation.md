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
6. Mouse down uses the canvas hierarchy target rules to choose an official
   Group parent. A missing raw element hit creates under the explicit workspace
   root even when a Group is selected.
7. Nested Group creation preserves world position and keeps affected Group
   bounds canonical throughout click or drag creation.

## Constraints

- behavior implemented via `create-element` feature session
- parent identity is app-owned and comes from the canonical hierarchy
  projection; Render ancestry and Group hit-area inference are not parent
  sources
- official Group reparent and bounds/coordinate normalization use Preset
  adapters inside the create transaction
- geometry writes use `elementApis.changeElementGeometry`

## Success Criteria

- `element-creation.spec.ts`, `group-interaction.spec.ts`, and `oval.spec.ts`
  creation scenarios pass
- click and drag creation both work repeatedly without state corruption

## References

- `apps/asyra-design/src/features/create-element/feature.ts`
- `apps/asyra-design/src/common-apis/element/apis.ts`
