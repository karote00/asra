Never record completed plans here.

# App Plans

## In Progress

1. Inside dashed stroke priority recovery

- phase-driven execution order for scenario matrix, unit-first coverage, final-face ownership, projection stability, and overlay hygiene
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-priority-plan.md`

2. Inside dashed stroke flow-first recovery

- requirements-first rewrite of the dashed-stroke computation flow
- focuses on step ownership, legal scenarios, and benchmark mapping
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-flow-first-plan.md`

3. Inside dashed stroke gap-local cap rules

- defines the local ownership rules between adjacent dash caps and authored gap windows
- scope is contract/spec only; not a runtime patch by itself
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-gap-local-cap-rules.md`

4. Inside dashed stroke final-face algorithm rules

- algorithm-first contract for the full inside-dashed pipeline, with explicit final-face decomposition rules and unit-test mapping
- scope is pure algorithm/spec, intended to guide future runtime changes and debugging
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-final-face-algorithm-rules.md`

5. Inside dashed stroke split-pair pseudo algorithm

- implementable pseudo-algorithm for the same-corner split-pair three-region method, including feasibility assessment and next unresolved design choices
- scope is algorithm design only; no runtime patch by itself
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-split-pair-pseudo-algorithm.md`

6. Inside dashed stroke split-pair lens window rules

- defines how to build the local shared lens window and bridge lens region for the split-pair decomposition
- scope is algorithm design only; no runtime patch by itself
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-split-pair-lens-window-rules.md`

7. Inside dashed stroke gap-local cap pseudo algorithm

- implementable pseudo-algorithm for local gap ownership between adjacent dash terminals, with explicit separation between local pair bugs and remote self-overlap pollution
- scope is algorithm design only; no runtime patch by itself
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-gap-local-cap-pseudo-algorithm.md`

8. Inside dashed stroke gap-local implementation spec

- adopted implementation spec for local gap classification, gap-window construction, and retained-region subtraction, consolidated from current project findings plus external design suggestions
- scope is algorithm design only; intended to guide the next runtime pass
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-gap-local-implementation-spec.md`

9. Inside dashed stroke outlineshape adaptation

- maps the current dash debug/final-face model onto an outlineshape-style region model inspired by Bezier.js, to guide terminal-owned ownership and gap-local work
- scope is representation design only; intended to replace whole-dash subtraction with named terminal/body regions
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-outlineshape-adaptation.md`

10. Inside dashed stroke remote-pollution spec

- defines the next algorithm-first path for non-neighbor self-overlap inside authored gap windows, explicitly separating remote pollution from local adjacent-gap repair
- scope is algorithm design only; intended to guide the next blocker after narrow local-gap promotion
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-remote-pollution-spec.md`

11. Inside dashed stroke global-first rebuild

- active rebuild baseline for the current runtime path; Phase 1 and Phase 2 are product-integrated, while Phase 3 remains in progress because ownership/cutting still has unfinished work
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-rebuild-plan.md`

12. Inside dashed stroke global-first implementation backlog

- active execution backlog for the rebuild; current baseline includes overlap seam recovery, but final clipping/cutting follow-up is still pending
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-implementation-backlog.md`

13. Inside dashed stroke global-first TDD plan

- active phase-by-phase test contract for the rebuild; current runtime is past Phase 2 and still needs Phase 3+ clipping/cutting completion
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-tdd-plan.md`

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
