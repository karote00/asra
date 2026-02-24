# App Plans

## Near-Term

1. Strengthen pen tool editing UX
- add bezier handle editing flow
- refine point/subpath visual feedback consistency

2. Expand E2E coverage for vector editing
- path-editing enter/exit edge cases
- point selection/editing scenarios

3. Reduce app-level internal coupling
- remove internal-path imports (for example keymap source path)

4. Delete key support: single selected element
- support Delete/Backspace to remove one selected element
- include path-editing cleanup and undo/redo validation
- Reference: `docs/internal/delete-key-single-element-plan.md`

5. Delete key support: single selected vector point
- support Delete/Backspace to remove one selected vector point in path-editing mode
- include geometry recompute and point-state cleanup
- Reference: `docs/internal/delete-key-single-vector-point-plan.md`

## Mid-Term

1. Advanced selection workflows
- marquee/lasso or richer multi-selection interactions

2. Property panel capability growth
- richer vector/path controls
- per-feature contextual property sections

3. Performance scaling
- hover/select hit-test strategy improvements for large documents

## Deferred

1. Auto-layout app UX once framework support is ready
2. Additional design-domain tools built on the same app architecture
