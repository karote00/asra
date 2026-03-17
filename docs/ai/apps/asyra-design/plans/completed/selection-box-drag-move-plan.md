# Plan: Drag Selection Box Moves Selected Elements

## Scope

Enable drag-to-move when the pointer starts inside the current selection box
(even if the hit-test target is an unselected element under the box). Avoid
clearing or replacing selection when the user drags inside the selection
bounds.

## Completion (2026-03-17)

- outcome: drag start inside selection bounds moves the existing selection
  without replacing it
- outcome: click inside selection bounds (no movement) selects the hovered
  element on mouse up, or clears selection if none is hovered
- completed plan: `docs/ai/apps/asyra-design/plans/completed/selection-box-drag-move-plan.md`

## Steps

1. Add selection-bounds hit detection

- compute a workspace-space bounding box for the current selection
- treat a drag start inside this box as a move-elements session start
- do not replace/toggle selection in this path

2. Keep existing drag rules intact

- preserve shift-blocked move behavior
- preserve locked element exclusion from move updates
- keep path-editing blocking behavior

3. Verification

- manual: drag inside selection box empty space and confirm selected elements
  move without selection changes
- manual: drag on unselected element outside selection box still selects/moves
  as before

## Validation

- manual coverage documented in the implementation notes
