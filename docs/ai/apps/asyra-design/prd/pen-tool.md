# PRD: Pen Tool and Path Editing

## Problem

Users need a vector path workflow that supports creating vectors, appending points, selecting points, and controlled exit behavior.

## Goals

- create vector on first pen action when not editing
- append points to active editing vector
- support subpath split/exit semantics with Escape
- allow point hover/selection and point property editing

## Functional Requirements

1. Pen + mouse down outside active edit context creates new vector with first point.
2. Pen + mouse down in active path edit context appends point to current vector.
3. Enter key starts path editing when exactly one vector is selected.
4. Double click enters path editing only when selected vector is hit.
5. Escape in pen mode:
- first press splits to new subpath state
- second press exits path editing and switches tool to Select
6. Non-pen in path-editing mode can select points.
7. Point hover changes cursor to pointer and updates hovered point state.

## State Model

System properties:
- `pathEditingVectorId`
- `pathEditingStartNewSubpath`
- `selectedVectorPoint`
- `hoveredVectorPoint`

## Success Criteria

- `pen-tool.spec.ts` passes
- point panel shows selected point data in path editing context
- no duplicate point-id collisions during normal point creation flow

## References

- `apps/asyra-design/src/features/pen-tool/index.ts`
- `apps/asyra-design/src/common-apis/element.ts`
- `apps/asyra-design/src/common-apis/system-context.ts`
- `apps/asyra-design/src/properties/vector-point.tsx`
