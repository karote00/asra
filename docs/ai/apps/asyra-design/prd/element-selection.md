# PRD: Element Selection

## Problem

Users need predictable single-selection behavior from both canvas and layer/content list.

## Goals

- reliable select/deselect behavior
- consistent panel updates from selection state
- stable behavior with path editing context

## Functional Requirements

1. Click element on canvas -> select element.
2. Click empty canvas -> clear selection.
3. Click element row in contents panel -> select that element.
4. Click empty area in contents panel -> clear selection.
5. Shift-modified selection toggles element membership.
6. Path editing mode should keep focus and block regular selection start logic where applicable.
7. Hover state should resolve by element bounds hit-test on mouse move.

## Constraints

- bounds-based hit testing used by app (`elementApis.getElementIdAtClientPos`)
- selection feature wraps selection mutations in transaction boundary

## Success Criteria

- `selection.spec.ts` passes
- property panel visibility follows selection state correctly

## References

- `apps/asyra-design/src/features/selection/index.ts`
- `apps/asyra-design/src/features/hover-element/index.ts`
- `apps/asyra-design/src/common-apis/selection.ts`
- `apps/asyra-design/src/common-apis/element.ts`
