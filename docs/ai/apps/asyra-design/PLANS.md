# App Plans

## Near-Term

1. Expand E2E coverage for vector editing
- path-editing enter/exit edge cases
- point selection/editing scenarios
- plan reference: `docs/internal/e2e-coverage-update-plan.md`

2. Reduce app-level internal coupling
- remove internal-path imports (for example keymap source path)

3. Delete key support: single selected element
- support Delete/Backspace to remove one selected element
- include path-editing cleanup and undo/redo validation
- Reference: `docs/internal/delete-key-single-element-plan.md`

4. Delete key support: single selected vector point
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
3. Geometry domain model for vector editing (lowest priority)
- define a dedicated geometry layer to manage points (anchors/handles), segments, and path networks (including closed paths)
- keep this as a future architecture option; do not block current pen/tool delivery
- plan reference: `docs/internal/vector-geometry-domain-model-plan.md`

## Decision Logging Rule

- When a plan item changes app contracts/runtime boundaries, append rationale to `decisions/releases/unreleased.md`.
- If the decision is cross-cutting (framework + app), also append `docs/ai/decisions/releases/unreleased.md`.
