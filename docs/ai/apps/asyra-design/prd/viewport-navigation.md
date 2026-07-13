# PRD: Viewport Navigation

## Problem

Users need fast canvas navigation for overview and detail work without mode confusion.

## Goals

- smooth zoom and pan
- clear shortcut behavior
- stable zoom display in toolbar

## Functional Requirements

1. Wheel + Meta/Ctrl -> zoom around cursor center.
2. Wheel without Meta/Ctrl -> pan viewport.
3. Zoom-fit shortcut centers and fits content with padding.
4. Toolbar displays current zoom level.

## Constraints

- viewport state is system-property-driven (`zoom`, `viewportPosition`)
- calculations use shared utils (`calculateZoomToCenter`, `calculateZoomFit`)

## Success Criteria

- `viewport-navigation.spec.ts` passes
- zoom level display reflects internal zoom state

## References

- `apps/asyra-design/src/features/zoom/index.ts`
- `apps/asyra-design/src/features/pan/index.ts`
- `apps/asyra-design/src/features/zoom-fit/index.ts`
- `apps/asyra-design/src/common-apis/viewport.ts`
- `apps/asyra-design/src/toolbar/zoom.tsx`
