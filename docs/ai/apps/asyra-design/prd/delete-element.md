# PRD: Delete Behavior

## Problem

Users need a predictable delete workflow that removes the intended target without breaking path-editing context.

## Goals

- support keyboard-first deletion via `Delete` and `Backspace`
- keep element-level delete behavior deterministic
- preserve path-editing semantics by routing delete to point-level behavior when applicable
- keep delete actions fully undoable/redoable

## Functional Requirements

1. When `pathEditingMode` is `false` and exactly one element is selected, pressing `Delete` or `Backspace` removes that selected element.
2. When no element is selected, element delete is a no-op.
3. When `pathEditingMode` is `true`, element-level delete is blocked.
4. In path-editing mode, if one anchor point is selected on the active editing vector, delete removes that anchor point instead of deleting the whole element.
5. Deleting an interior anchor in an open subpath splits the path into two open subpaths and regenerates affected segment IDs.
6. After successful element deletion, element selection is cleared and hovered target is re-evaluated from current pointer state.
7. Delete actions remain reversible through undo/redo in expected order.

## Constraints

- Delete routing is priority-based at feature runtime:
  - `delete-vector-point` (higher priority) handles eligible path-editing point deletes first.
  - `delete-element` handles element deletes only when path-editing delete preconditions are not met.
- Delete mutations must execute through app/common APIs inside intended transaction boundaries.

## Success Criteria

- `delete-element.spec.ts` passes for:
  - element delete (`Delete` / `Backspace`)
  - no-op and mode-guard scenarios
  - hover re-evaluation after delete
  - path-editing anchor delete split behavior
- delete flows remain compatible with `undo-redo.spec.ts` history behavior.

## References

- `apps/asyra-design/src/features/delete-element/index.ts`
- `apps/asyra-design/src/features/delete-vector-point/index.ts`
- `apps/asyra-design/src/common-apis/element/index.ts`
- `apps/asyra-design/src/common-apis/selection.ts`
- `apps/asyra-design/e2e/delete-element.spec.ts`
