Never record completed plans here.

# App Plans

## In Progress

1. Professional stroke engine architecture

- umbrella architecture plan for a professional-grade stroke system covering canonical geometry, paint separation, render/hit/export unification, and dirty-graph performance rules
- establishes the required pipeline and data contracts for solid/dashed, inside/center/outside, joins/caps, dash-gap, and solid/gradient stroke paint
- plan: `docs/ai/apps/asyra-design/plans/professional-stroke-engine-plan.md`

2. Professional stroke engine execution

- implementation-ready rollout plan for the canonical stroke architecture, with hard phase gates, supported/unsupported matrices, decision tables, debug deliverables, and migration rules
- Phase 1 (`solid + center + uniform width + solid paint`), Phase 2 (`solid + inside/outside + uniform width + solid paint`), Phase 3 (`dashed + center + uniform width + solid paint`), and Phase 4A (`dashed + center + solid` with overlap/ownership enabled) are now accepted for their currently supported matrices; Phase 4A closeout is locked by `center-dashed-overlap-visual.spec.ts` + `@asyra/preset test:local`, and the next execution target is Phase 4B constrained ownership and legality on solid geometry
- Phase 4B groundwork now includes:
  - canonical legality-domain viewer
  - packet-level constrained solid ownership overlay
  - ownership-aware legality clipping helper with no-op preservation on the
    current promoted slice
  - deterministic multi-network vector ownership-diagnostics merge without
    graphic-local id collisions
  - helper-level inside overflow clipping plus a declared outside single-edge
    convex sub-slice
  - convex outside corner-overflow partitioning into disjoint complement
    sectors
  - canonical shared overlap regions for two-candidate convex ownership
    components
  - exact candidate-set ownership regions for nested and partial-overlap
    convex multi-candidate ownership components
  - deterministic four-candidate partial-overlap chain support on the same
    convex exact-subset owner-domain path
  - deterministic four-candidate branch-topology support on the same convex
    exact-subset owner-domain path
  - mixed-topology multi-polygon candidate support on the same convex
    exact-subset owner-domain path
  - orthogonal non-convex single-polygon candidate support via deterministic
    canonical rectangle decomposition on the same exact-subset owner-domain
    path
  - non-orthogonal non-convex single-polygon candidate support via
    deterministic bounded ear decomposition on that same exact-subset
    owner-domain path
  - mixed-topology candidate support that includes orthogonal non-convex
    packet pieces on that same exact-subset owner-domain path
  - mixed-topology candidate support that includes non-orthogonal
    non-convex packet pieces on that same bounded ear-decomposition
    exact-subset owner-domain path
  - mixed-topology candidate support that includes multiple non-orthogonal
    non-convex packet pieces on that same bounded ear-decomposition
    exact-subset owner-domain path
  - orthogonal non-convex packet subtraction via the same canonical rectangle
    decomposition while preserving disconnected local remainders
  - non-orthogonal non-convex packet whole-drop when exact foreign-owned
    regions cover the whole non-owner packet on that same bounded
    ear-decomposition path
  - mixed-topology packet subtraction when the non-owner packet includes
    orthogonal non-convex pieces on that same bounded canonical-rectangle
    path
  - mixed-topology packet whole-drop when the non-owner packet includes
    non-orthogonal non-convex pieces and exact foreign-owned regions cover
    all packet pieces on that same bounded ear-decomposition path
  - mixed-topology packet subtraction when the non-owner packet includes
    non-orthogonal non-convex pieces on that same bounded ear-decomposition
    path
  - mixed-topology packet subtraction when the non-owner packet includes
    multiple non-orthogonal non-convex pieces on that same bounded
    ear-decomposition path
  - exact foreign-owned outside polygon removal plus convex partial
    foreign-owned region subtraction as the first true owner-domain clipping
    slices
  - real app-path visual benchmark proving owner stroke visibility while
    foreign-owned exact-match outside polygons remain absent
  - targeted closeout via `constrained-solid-legality-visual.spec.ts` + `@asyra/preset test:local`
- plan: `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

3. Dashed center geometry scenario matrix

- scenario-family-first test contract for Phase 3 dashed center geometry
- defines the required topology/angle/pattern families, benchmark semantics,
  and the rule that incident regressions must map back to explicit scenarios
- plan: `docs/ai/apps/asyra-design/plans/dashed-center-scenario-matrix.md`

4. Center dashed overlap / ownership scenario matrix

- scenario-family-first test contract for Phase 4A overlap graph, component
  extraction, ownership priority, and component-local bailout on center dashed
  geometry
- keeps overlap/ownership work anchored to geometry families instead of
  incident-specific ownership patches
- plan: `docs/ai/apps/asyra-design/plans/center-dashed-overlap-ownership-scenario-matrix.md`

5. Constrained solid ownership / legality scenario matrix

- scenario-family-first test contract for Phase 4B canonical legality domains,
  constrained eligibility, non-overflow preservation, and legality-domain
  viewer behavior on solid geometry
- keeps constrained legality work anchored to topology/ownership semantics
  instead of shape-specific clipping patches
- plan: `docs/ai/apps/asyra-design/plans/constrained-solid-ownership-legality-scenario-matrix.md`

6. Constrained solid general owner-domain algorithm

- next algorithm-class plan once Phase 4B bounded expansion reaches its stop
  condition
- covers broader mixed-topology subtraction, broader general non-convex
  owner-domain construction, and the first promoted scenarios that require
  general polygon-boolean-class behavior instead of bounded normalization
- first promoted broader scenario now starts with deterministic exact
  candidate-set ownership on nested five-candidate constrained solid
  components beyond the former four-candidate cap
- second promoted broader scenario now extends that same path to nested
  six-candidate constrained solid components beyond the former five-candidate
  cap
- third promoted broader scenario now extends that same path to nested
  seven-candidate constrained solid components beyond the former six-candidate
  cap
- fourth promoted broader scenario now extends that same path to nested
  eight-candidate constrained solid components beyond the former seven-candidate
  cap
- fifth promoted broader scenario now extends that same path to nested
  nine-candidate constrained solid components beyond the former eight-candidate
  cap
- sixth promoted broader scenario now replaces the artificial nested-convex
  candidate cap with a subset-budget gate, proven by ten nested constrained
  solid components on the same exact candidate-set path
- seventh promoted broader scenario now extends that plan into mixed-topology
  five-candidate constrained solid components across disconnected
  multi-polygon sub-packets, with app-path visual coverage on a multi-network
  vector-generated path
- eighth promoted broader scenario now extends that same mixed-topology path
  to six-candidate constrained solid components across disconnected
  multi-polygon sub-packets, with app-path visual coverage on a multi-network
  vector-generated path
- ninth promoted broader scenario now extends that broader mixed-topology
  subtraction path to retained local miter remainders when a bevel owner clips
  disconnected vector-generated sub-packets, with app-path visual coverage on a
  multi-network vector-generated path
- tenth promoted broader scenario now closes the first Family D equivalence
  gate by proving shape-generated and vector-generated closed rectangles keep
  equivalent local miter remainders on that broader subtraction path
- eleventh promoted broader scenario now extends that broader mixed-topology
  subtraction family to a disconnected vector-generated path where one
  sub-packet is a non-orthogonal non-convex piece, and the local miter
  remainder still remains visible on the final product path
- twelfth promoted broader scenario now closes the first Family B
  equivalence gate for non-orthogonal non-convex mixed-topology input by
  proving two equivalent vector-generated paths keep deterministic owner-domain
  construction and equivalent local miter remainders on that broader
  subtraction path
- thirteenth promoted broader scenario now extends that broader
  mixed-topology subtraction family to vector-generated paths where multiple
  disconnected sub-packets are non-orthogonal non-convex pieces, while the
  local miter remainders still remain visible on the final product path
- plan: `docs/ai/apps/asyra-design/plans/constrained-solid-general-owner-domain-plan.md`

7. Legacy stroke code removal

- formal removal plan for old stroke runtime, adapter, authored-model, and documentation paths; defines slice-based deletion, comparison shutdown, cutover gates, and lock checks
- Phase 1 legacy center-solid removal is complete: old `strokes.ts` / `geometry-model.ts` runtime paths are gone, and retained foundation has been extracted into `stroke-render/`
- inventory source: `docs/ai/apps/asyra-design/reports/legacy-stroke-inventory-2026-04-15.md`
- plan: `docs/ai/apps/asyra-design/plans/legacy-stroke-code-removal-plan.md`

8. Inside dashed stroke priority recovery

- phase-driven execution order for scenario matrix, unit-first coverage, final-face ownership, projection stability, and overlay hygiene
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-priority-plan.md`

9. Inside dashed stroke flow-first recovery

- requirements-first rewrite of the dashed-stroke computation flow
- focuses on step ownership, legal scenarios, and benchmark mapping
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-flow-first-plan.md`

10. Inside dashed stroke gap-local cap rules

- defines the local ownership rules between adjacent dash caps and authored gap windows
- scope is contract/spec only; not a runtime patch by itself
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-gap-local-cap-rules.md`

11. Inside dashed stroke final-face algorithm rules

- algorithm-first contract for the full inside-dashed pipeline, with explicit final-face decomposition rules and unit-test mapping
- scope is pure algorithm/spec, intended to guide future runtime changes and debugging
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-final-face-algorithm-rules.md`

12. Inside dashed stroke split-pair pseudo algorithm

- implementable pseudo-algorithm for the same-corner split-pair three-region method, including feasibility assessment and next unresolved design choices
- scope is algorithm design only; no runtime patch by itself
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-split-pair-pseudo-algorithm.md`

12. Inside dashed stroke split-pair lens window rules

- defines how to build the local shared lens window and bridge lens region for the split-pair decomposition
- scope is algorithm design only; no runtime patch by itself
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-split-pair-lens-window-rules.md`

13. Inside dashed stroke gap-local cap pseudo algorithm

- implementable pseudo-algorithm for local gap ownership between adjacent dash terminals, with explicit separation between local pair bugs and remote self-overlap pollution
- scope is algorithm design only; no runtime patch by itself
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-gap-local-cap-pseudo-algorithm.md`

13. Inside dashed stroke gap-local implementation spec

- adopted implementation spec for local gap classification, gap-window construction, and retained-region subtraction, consolidated from current project findings plus external design suggestions
- scope is algorithm design only; intended to guide the next runtime pass
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-gap-local-implementation-spec.md`

14. Inside dashed stroke outlineshape adaptation

- maps the current dash debug/final-face model onto an outlineshape-style region model inspired by Bezier.js, to guide terminal-owned ownership and gap-local work
- scope is representation design only; intended to replace whole-dash subtraction with named terminal/body regions
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-outlineshape-adaptation.md`

15. Inside dashed stroke remote-pollution spec

- defines the next algorithm-first path for non-neighbor self-overlap inside authored gap windows, explicitly separating remote pollution from local adjacent-gap repair
- scope is algorithm design only; intended to guide the next blocker after narrow local-gap promotion
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-remote-pollution-spec.md`

16. Inside dashed stroke global-first rebuild

- active rebuild baseline for the current runtime path; the design/contracts are now locked for execution, Phase 1 and Phase 2 remain product-integrated, and implementation resumes from Phase 3 under the approved global-first pipeline
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-rebuild-plan.md`

17. Inside dashed stroke global-first implementation backlog

- active execution backlog for the rebuild; ownership policy, complexity bounds, clipping routing, cache/reuse, bailout, and merge-gate rules are now fixed as execution constraints for the remaining Phase 3+ work
- plan: `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-implementation-backlog.md`

18. Inside dashed stroke global-first TDD plan

- active phase-by-phase test contract for the rebuild; scenario permanence, helper `should run` / `should not run`, performance guards, and rollback rules are now locked before Phase 3+ implementation proceeds
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

3. Future dashed corner visual balancing

- future product-semantics options for visually balancing short-carryover
  dashed corners when strict arc-length semantics are mathematically correct
  but visually surprising
- plan: `docs/ai/apps/asyra-design/plans/future-dashed-corner-visual-balancing.md`

4. Reduce app-level internal coupling

- remove internal-path imports (for example keymap source path)

5. Gradient move drag 120 FPS (multi-selection)

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
