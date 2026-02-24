# Delete Key Plan: Single Selected Element

## Goal

Support Delete/Backspace key to remove the currently selected element when exactly one element is selected.

## Scope

In scope:
- keyboard shortcut mapping for delete action
- feature behavior for single-element deletion
- selection and path-editing cleanup after deletion
- undo/redo integration through existing transaction flow

Out of scope:
- multi-selection bulk delete behavior (can be separate plan)
- soft-delete/trash bin workflows

## Expected Behavior

1. If exactly one element is selected:
- pressing Delete removes that element
- selection becomes empty

2. If no element is selected:
- pressing Delete does nothing

3. If path-editing mode targets the deleted element:
- exit path-editing mode
- clear selected/hovered vector point state

## Implementation Notes

1. Input mapping
- add delete shortcut event in `apps/asyra-design/src/constants.ts`
- add key combinations for Delete/Backspace in `apps/asyra-design/src/config/key-combinations.ts`

2. Feature
- create delete feature in `apps/asyra-design/src/features/*`
- trigger only when selection count is 1 (phase 1)

3. API boundary
- delete operation should route through app/common APIs -> core APIs
- keep transaction boundary aligned with one undo unit

## Validation

- deleting selected element removes it from canvas + contents panel
- undo restores deleted element
- redo deletes again
- delete in empty selection is no-op

## Risks

1. Deleting while in path-editing mode may leave stale state if cleanup is incomplete.
2. Shortcut collisions with input fields if propagation/focus handling is not controlled.
