# PRD: Pen Tool and Path Editing

## Problem

Users need a vector path workflow that supports creating vectors, appending points, drag-to-curve editing, selecting anchor/handle targets, and controlled exit behavior.

## Goals

- create vector on first pen action when not editing
- append points to active editing vector
- support drag-to-bezier while adding connected points
- support Escape cancel behavior for vector selection and path editing
- allow anchor/handle hover+selection and point-target property editing
- keep pen editing session continuity and render consistency during refresh

## Functional Requirements

1. Pen + mouse down outside active edit context creates new vector with first point.
2. Pen + mouse down in active path edit context appends point to current vector.
3. Pen + mouse move while mouse is held on a newly appended connected point updates bezier handles for:

- connected point (`outHandle`) with conditional update:
  - default: preserve existing `p1` (`outHandle`) if present; otherwise anchor fallback
  - special case (dragging second point of subpath, and connected first point has no user-defined handle): compute
    - `p2 = B - 0.8 * (M - B)` (new point `inHandle`)
    - `p1.x = A.x - 0.334 * (M.x - B.x)` and `p1.y = A.y + 0.327 * (B.y - A.y)` (connected point `outHandle`)
    - new point `outHandle = M`
- new point (`inHandle` and `outHandle`)

4. On drag end, selected point target remains the newly added anchor point (no auto-switch to out-handle).
5. Pen drag on first point of a subpath (no connected point) must not create bezier handles.
6. Curve handles render as diamond controls with:

- same size/fill color as anchor point controls
- white 1px stroke
- same selected blue outline style as selected anchor controls

7. Segment rendering must follow handle presence:

- if either adjacent handle exists, render cubic bezier for that segment
- if neither handle exists, render straight segment

8. Vector bounds (`x/y/width/height`) must be derived from rendered segment geometry (including cubic bezier extrema), not only anchor coordinates.
9. Virtual preview segment (pen hover before point commit) must follow the same rule as committed segments.
10. Non-pen in path-editing mode can select both anchor points and curve handle targets.
11. Properties panel shows selected point target data (`anchor` / `inHandle` / `outHandle`) and supports coordinate edits through app APIs.
12. Enter key starts path editing when exactly one vector is selected.
13. Double click enters path editing only when selected vector is hit.
14. Escape cancel behavior:

- if pen tool is in path editing connected-continuation mode, Escape disconnects
  the continuation preview and keeps path editing active
- if pen tool is already disconnected/new-subpath in path editing mode, Escape
  exits path editing while keeping pen active
- if a non-pen tool is in path editing mode, Escape exits path editing
- if not in path editing mode and elements are selected, Escape clears element selection

15. Point/handle hover changes cursor to pointer and updates hovered point state.
16. Micro drag below handle-creation threshold on second-point creation should keep the first segment straight (no unintended connected-point bezier handle creation).
17. Moving a selected anchor point in path-editing mode must translate its connected curve handles with the anchor.
18. In non-pen path-editing mode, dragging a selected `inHandle`/`outHandle` must update that handle position while keeping the same handle target selected.
19. Handle drag must respect handle mode constraints (`none`, `mirror-angle`, `mirror-angle-length`) and update the opposite handle accordingly.
20. Non-pen point-target drag should keep click-only selection semantics for micro movement below the point-drag threshold.
21. Pen session continuity:

- after creating a new vector with pen, path editing remains on that vector until Escape exits path editing
- when current selection is non-vector, pen action creates a new vector instead of entering invalid vector-editing state

22. In split/new-subpath mode, clicking an endpoint selects that endpoint as the continuation source before the next append action.
23. Segment split via insert preview creates one inserted anchor shared by the two resulting segments.
24. After refresh/reload, each vector element id maps to exactly one render object (no duplicate render instances).
25. Prepend-point drag in path-editing mode keeps the newly inserted anchor as selected target after drag completion.
26. In non-pen path-editing mode, segment hover and segment selection should target only segments of the active editing vector.

## State Model

System properties:

- `pathEditingMode`
- `pathEditingVectorId`
- `pathEditingStartNewSubpath`
- `selectedVectorPoint`
- `hoveredVectorPoint`

## Success Criteria

- `pen-tool.spec.ts` passes
- point panel shows selected point target data in path editing context
- no duplicate point-id collisions during normal point creation flow
- no duplicate render-object mapping per vector element after refresh/reload

## References

- `apps/asyra-design/src/features/pen-tool/index.ts`
- `apps/asyra-design/src/common-apis/element/index.ts`
- `apps/asyra-design/src/common-apis/system-context.ts`
- `apps/asyra-design/src/properties/vector-point.tsx`
- `apps/asyra-design/e2e/pen-tool.spec.ts`
