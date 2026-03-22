Never record completed plans here.

# App Plans

## In Progress

None

## Near-Term

1. Geometry Layer and Dash Gap Completion

- **Phase 1:** Geometry correctness (Oracle validation)
  - Issue: Sharp corners escape segment wedge; dash sizing inconsistent
  - Exit gate: All geometry oracles pass + complete test coverage
- **Phase 2:** Dash gap fixes (Depends on Phase 1 ✓)
  - Issue: Gap size rules undefined; calculation broken
  - Depends on: Phase 1 oracle gates
- plan: `docs/ai/apps/asyra-design/plans/geometry-and-dash-gap-completion.md`

2. Gradient stroke fill

- Depends on: Geometry Layer and Dash Gap Completion
- plan: `docs/ai/apps/asyra-design/plans/gradient-stroke-fill-plan.md`

2. Reduce app-level internal coupling

- remove internal-path imports (for example keymap source path)

3. Gradient move drag 120 FPS (multi-selection)

- plan: `docs/ai/apps/asyra-design/plans/vector-gradient-move-120fps-plan.md`


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
