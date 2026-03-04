# App Plans

## Near-Term

1. Expand E2E coverage for vector editing
- path-editing enter/exit edge cases
- point selection/editing scenarios
- progress:
  - pen second-point micro-drag threshold regression is covered in `e2e/pen-tool.spec.ts`
  - delete/undo regression coverage now includes selection restore, redo crash guard, and undo-commit compactness checks
  - continue with broader path-editing edge cases
- plan reference: `docs/ai/apps/asyra-design/plans/e2e-coverage-update-plan.md`

2. Reduce app-level internal coupling
- remove internal-path imports (for example keymap source path)

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

## Decision Logging Rule

- When a plan item changes app contracts/runtime boundaries, append rationale to `decisions/releases/unreleased.md`.
- If the decision is cross-cutting (framework + app), also append `docs/ai/decisions/releases/unreleased.md`.
