# Plan: Delete Key Support For Single Selected Element

## Scope

Support keyboard deletion for one selected element in Asyra Design:
- `Delete` / `Backspace` removes exactly one selected element
- no-op when selection size is not 1
- blocked while path-editing mode is active
- undo/redo restores/removes element and selection state correctly

## Steps

1. feature and shortcut wiring
- add app feature for delete shortcut handling
- wire `Delete` / `Backspace` shortcut events
- gate execution by selection size and path-editing mode

2. scene-tree removal hardening
- move parent/index resolution into scene-tree remove flow
- persist `parentId` on elements and use it for remove routing
- remove app-side parent/index scan

3. selection and hover consistency
- keep delete + selection clear in one undoable transaction
- after delete, re-evaluate hover target via hover feature API
- avoid stale hovered id to deleted element

4. regression coverage
- add E2E for:
  - delete/backspace remove behavior
  - no-op with empty selection
  - undo/redo behavior
  - path-editing delete block
  - sequential delete redo safety
  - hover re-evaluation (no stale deleted hover id)
- add undo-stack quality E2E for drag-create commit compactness and no-op selection commit guard

## Validation

- `yarn workspace @asyra/asyra-design test:e2e e2e/delete-element.spec.ts --workers=1` passes
- `yarn workspace @asyra/asyra-design test:e2e e2e/undo-redo.spec.ts --workers=1` passes
- `yarn workspace @asyra/asyra-design react:build` passes

## Result

Completed on 2026-03-02.

- single-selected element deletion via `Delete` / `Backspace` is implemented
- delete is blocked during path-editing mode
- undo/redo now restores both element and selection state correctly
- hovered target is not left stale on deleted element
- scene-tree remove contract now owns membership validation and remove routing details
