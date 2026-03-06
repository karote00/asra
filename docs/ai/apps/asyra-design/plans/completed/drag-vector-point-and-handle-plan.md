# Plan: Drag Vector Points And Curve Handles

## Scope

Enable non-pen path-editing drag updates for vector anchors and curve control handles.

Behavior targets:

- dragging a selected anchor updates anchor position in real-time
- dragging a selected anchor preserves handle geometry by translating connected handles with the anchor
- dragging a selected `inHandle`/`outHandle` updates only that handle position
- drag-frame updates stay non-undoable and drag-end commits as one intended undoable action

## Steps

1. Common API mutation options

- extend vector point/handle position update APIs to accept mutation options
- allow feature-driven `undoable: false` frame updates while preserving final commit behavior

2. Feature session behavior

- extend `selectVectorPoint` session (`input.drag`, non-pen mode) with drag-start snapshot state
- apply thresholded drag updates for selected point targets
- keep selected target mirror state in sync during and after drag

3. Regression coverage

- update `e2e/pen-tool.spec.ts` to verify:
  - anchor drag translates both anchor and connected handles
  - handle drag updates handle position and keeps handle target selection

4. Contract sync

- sync app feature/API/BDD/PRD docs and decision history

## Validation

- `yarn workspace @asyra/asyra-design react:build`
- `yarn workspace @asyra/asyra-design test:e2e e2e/pen-tool.spec.ts`

## Result

Completed on 2026-03-06.

- Added point-target drag lifecycle in `selectVectorPoint` for non-pen path-editing mode.
- Added `FEATURE_MOVEMENT_THRESHOLD.moveVectorPoint` and threshold-gated drag semantics.
- Extended `elementApis.updateVectorAnchorPointPosition(...)` and `updateVectorAnchorPointHandlePosition(...)` with optional mutation options for undo-safe drag sessions.
- Added E2E coverage for anchor drag and out-handle drag behavior.
- Synced pen feature/API/BDD/PRD contracts and decision log.

Final decision:

- Keep point-target drag frame updates non-undoable and finalize with one intended undoable commit at drag end.

Exit criteria:

- `yarn workspace @asyra/asyra-design react:build` passes.
- `yarn workspace @asyra/asyra-design test:e2e e2e/pen-tool.spec.ts` passes.
