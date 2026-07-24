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
3. Zoom-fit shortcut centers and fits content with padding. Overall content
   bounds use canonical world coordinates, including elements inside normal or
   nested Groups whose computed positions are parent-local.
4. Toolbar displays current zoom level.

## Constraints

- viewport state is system-property-driven (`zoom`, `viewportPosition`)
- calculations use shared utils (`calculateZoomToCenter`, `calculateZoomFit`)
- Core owns overall world-space scene bounds; the app and Render must not
  reinterpret Group-local coordinates or create fallback bounds

## Success Criteria

- `viewport-navigation.spec.ts` passes
- zoom level display reflects internal zoom state
- grouping unchanged visible content does not change the bounds consumed by
  zoom-fit, and `Cmd+1` centers/fits normal and nested Group content

## References

- `apps/asyra-design/src/features/zoom/index.ts`
- `apps/asyra-design/src/features/pan/index.ts`
- `apps/asyra-design/src/features/zoom-fit/index.ts`
- `apps/asyra-design/src/common-apis/viewport.ts`
- `apps/asyra-design/src/toolbar/zoom.tsx`
