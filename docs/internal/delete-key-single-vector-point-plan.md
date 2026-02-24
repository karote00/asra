# Delete Key Plan: Single Selected Vector Point

## Goal

Support Delete/Backspace key to remove the selected vector point when in path-editing mode and exactly one point is selected.

## Scope

In scope:
- delete shortcut behavior for point-level deletion
- vector geometry recomputation after point removal
- path-editing state updates after point deletion
- undo/redo integration

Out of scope:
- deleting multiple points at once
- advanced path repair/merge heuristics beyond current geometry rules

## Expected Behavior

1. Preconditions to delete point:
- path-editing mode is active
- selected vector point exists
- selected point belongs to current path-editing vector

2. On Delete:
- remove selected point from vector anchor points
- recompute vector geometry (x/y/width/height/anchorPoints)
- clear selected point state (or select nearest next point if later defined)

3. If resulting subpath/path becomes invalid:
- follow existing path-editing cleanup rule
- keep runtime state valid (no orphan point references)

## Implementation Notes

1. Feature behavior
- can be a dedicated delete-point feature or a branch under delete feature
- priority should ensure it runs before generic element delete when point preconditions are met

2. API boundary
- point removal should go through `elementApis` mutation helpers
- avoid direct mutation of computed anchor point arrays

3. State cleanup
- update `selectedVectorPoint` and `hoveredVectorPoint`
- if no valid target remains, keep null states

## Validation

- delete selected point updates shape and point count
- undo restores point and geometry
- redo removes point again
- delete key in path-editing mode with no selected point does nothing

## Risks

1. Deleting first/last/subpath-start point may expose edge cases in path state.
2. Inconsistent state if selected point id remains after geometry update.
