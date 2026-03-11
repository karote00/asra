# Plan: Vector Handle Mode Constraints

## Scope

Add handle-mode constraints for vector anchor points so handle drags and property edits can mirror angle/length based on a selectable mode.

Behavior targets:

- add handle-mode control to vector point properties panel
- enforce mirror-angle or mirror-angle-length constraints when dragging handles on canvas
- enforce same constraints when editing handle X/Y in the panel
- keep default behavior as independent handles (no mirroring)

## Completion (2026-03-11)

- outcome: added handle mode selection (`none`, `mirror-angle`, `mirror-angle-length`) to the vector point panel
- outcome: handle drag and handle coordinate edits now mirror the opposite handle based on the selected mode

## Steps

1. Handle-mode storage + constraint helpers

- add app-level handle-mode storage per anchor point
- implement shared constraint logic for drag updates and mode switching

2. Common API integration

- update vector handle mutation helpers to apply handle-mode constraints
- expose get/set handle-mode APIs for UI and selection sync

3. Properties panel wiring

- add handle-mode selector to vector point panel (anchor target)
- keep selected point mirror state updated after handle-mode changes

4. Contract + decision sync

- update pen-tool + properties-panel docs and API surfaces
- update app constraints and decision log

## Validation

- `yarn workspace @asyra/asyra-design react:build`
- manual check: select a vector point, switch handle mode, drag handle on canvas, edit handle X/Y in panel

## Exit Criteria

- handle-mode control is available in the vector point properties panel
- handle drag + handle coordinate edits reflect the selected handle mode
- updated app docs and decision log describe the new behavior
