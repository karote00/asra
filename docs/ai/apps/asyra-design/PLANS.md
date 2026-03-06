# App Plans

## Near-Term

1. Reduce app-level internal coupling
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

## Recently Completed

1. Vector editing E2E coverage expansion (completed 2026-03-06)
- expanded `pen-tool` regression scenarios for segment insert/split, path-editing guards, anchor-handle translation, and refresh consistency
- added direct `hoveredElementId` set/clear assertions in `selection.spec.ts`
- added select-mode segment hover/selection assertions while path editing in `pen-tool.spec.ts`
- established focused vector-editing regression gate via `e2e/pen-tool.spec.ts`
- completed plan: `docs/ai/apps/asyra-design/plans/completed/e2e-coverage-update-plan.md`

2. Vector target hover/selection parity (completed 2026-03-06)
- added explicit hover and normal selection visuals for vector points, curve controls, and segments
- restricted path-editing hover/selection to current editing vector
- aligned vector outline color with normal selection outline style
- completed plan: `docs/ai/apps/asyra-design/plans/completed/vector-target-hover-and-selection-plan.md`

3. Hover state and selection overlay unification (completed 2026-03-06)
- synced hovered target across canvas and content panel
- moved selection/hover overlay drawing to registered app/preset render layer
- hover outline now follows geometry for vector/oval/rect (with fallback bounds for unsupported types)
- completed plan: `docs/ai/apps/asyra-design/plans/completed/hover-state-and-hover-selection-box-plan.md`

## Decision Logging Rule

- When a plan item changes app contracts/runtime boundaries, append rationale to `decisions/releases/unreleased.md`.
- If the decision is cross-cutting (framework + app), also append `docs/ai/decisions/releases/unreleased.md`.
