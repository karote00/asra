# PRD: Element Selection

## Problem

Users need predictable single-selection behavior from both canvas and layer/content list.

## Goals

- reliable select/deselect behavior
- direct drag-to-move for selected canvas elements
- consistent panel updates from selection state
- stable behavior with path editing context

## Functional Requirements

1. Click element on canvas -> select element.
2. Click empty canvas -> clear selection.
3. Drag empty canvas -> area-select intersecting elements.
4. Click element row in contents panel -> select that element.
5. Click empty area in contents panel -> clear selection.
6. Shift-modified selection toggles element membership.
7. Path editing mode should keep focus and block regular selection start logic where applicable.
8. Hover state should resolve by element bounds hit-test on mouse move.
9. Drag start on an already selected element in select mode should move selected element(s).
10. Drag move should ignore micro pointer jitter below app-defined movement threshold.
11. Drag start on an unselected unlocked element in select mode should select and move that element.
12. Shift-drag on empty canvas adds area selection to existing selection.

## Constraints

- bounds-based hit testing used by app (`elementApis.getElementIdAtClientPos`)
- selection feature wraps selection mutations in transaction boundary
- move behavior owns drag-to-position updates through `move-elements` feature and `elementApis.setElementPositions(...)`

## Success Criteria

- `selection.spec.ts` passes
- property panel visibility follows selection state correctly

## References

- `apps/asyra-design/src/features/selection/index.ts`
- `apps/asyra-design/src/features/hover-element/index.ts`
- `apps/asyra-design/src/common-apis/selection.ts`
- `apps/asyra-design/src/common-apis/element/index.ts`
