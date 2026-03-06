# Plan: Drag Selected Element To Reposition

## Scope

Implement select-mode drag-to-move for selected elements in Asyra Design.

Behavior targets:

- dragging from a selected element repositions selected element(s)
- dragging from a non-selected element keeps existing selection behavior (selection first)
- path-editing mode does not move whole elements
- drag-move produces a deterministic undo/redo step that restores prior position

## Steps

1. Feature session authoring

- add a dedicated `move-elements` session feature on `input.drag`
- define explicit priority/exclusive semantics so move intent wins only when start-hit is already selected
- gate by tool/mode (`select` tool, not path-editing mode)

2. Common API boundary

- add reusable element position batch helpers in `elementApis`
- keep mutation writes behind `common-apis` (no deep runtime mutation in feature file)
- preserve compact undo semantics for continuous drag updates

3. Interaction + history behavior

- apply continuous drag-frame position updates as non-undoable
- finalize move with one intended undoable commit on drag end

4. Regression coverage

- add E2E for drag-to-move position change
- add E2E for undo/redo restoring moved position

5. Contract sync

- update app feature/API/BDD/PRD docs and app decision history

## Validation

- `yarn workspace @asyra/asyra-design react:build`
- `yarn workspace @asyra/asyra-design test:e2e e2e/selection.spec.ts e2e/undo-redo.spec.ts --workers=1`

## Result

Completed on 2026-03-06.

- Added app feature `move-elements` on `input.drag` to own select-mode drag-to-move sessions.
- Drag start now supports hovered unlocked elements even when not preselected.
- Drag-start auto-selection and final position commit are now captured in one undoable action for unselected-target drags.
- Added/updated E2E coverage for drag-to-move and undo/redo selection+position restoration.
- Synced app contracts and preset selection replay wiring to keep render/UI/runtime selection state aligned.

Final decision:
- Keep drag session updates non-undoable per frame, with one intended final undo commit that restores both position and selection state.

Exit criteria:
- `yarn workspace @asyra/preset test:local` passes.
- `yarn workspace @asyra/asyra-design react:build` passes.
- `yarn workspace @asyra/asyra-design test:e2e e2e/selection.spec.ts e2e/undo-redo.spec.ts --workers=1` passes.

Canonical completed-plan path:
- `docs/ai/apps/asyra-design/plans/completed/drag-element-position-plan.md`
