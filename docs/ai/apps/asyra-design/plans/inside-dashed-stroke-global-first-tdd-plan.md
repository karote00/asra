# Inside Dashed Stroke Global-First TDD Plan

**Status:** active TDD plan; Phase 1 completed and product-integrated, Phase 2 completed and product-integrated, Phase 3 pending  
**Date:** 2026-04-01  
**Depends on:**  
- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-rebuild-plan.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-rebuild-plan.md)  
- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-implementation-backlog.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-implementation-backlog.md)

## Purpose

Define a strict `phase-by-phase TDD` workflow for the inside dashed stroke
rebuild.

The goal is to prevent the project from repeating the old failure mode:

- implementation grows first
- tests are added around the implementation shape
- intermediate contracts go green
- final render is still visibly wrong

This plan requires each phase to have:

- its own oracle
- its own test surface
- its own done criteria
- its own product-facing integration

No later phase may be used to pretend an earlier phase is complete.

## Phase Mapping

This TDD plan groups rebuild-plan steps into broader test phases.

- TDD Phase 1
  - rebuild plan Phase 1
- TDD Phase 2
  - rebuild plan Phase 2
- TDD Phase 3
  - rebuild plan Phase 3
- TDD Phase 4
  - rebuild plan Phases 4 and 5
- TDD Phase 5
  - rebuild plan Phases 6 and 7

When discussing phase numbers in review, always state whether the number comes
from the rebuild plan or the TDD plan.

---

## Core TDD Rules

1. Write phase-specific tests before implementing the phase.
2. Keep the test oracle at the same abstraction level as the phase output.
3. Do not use final screenshot tests to certify low-level geometry phases.
4. Do not use intermediate debug metrics to certify final render correctness.
5. A phase is only done when:
   - its tests pass
   - its debug/inspection output is readable
   - its product-facing integration is active for that phase output
   - it does not regress the earlier completed phase

6. If product is intentionally rendering an intermediate phase output:
   - blocking tests must target that phase output
   - later-phase correctness tests must be downgraded to legacy/diagnostic

7. Every clipping helper must have:
   - one `should run` contract
   - one `should not run` contract
   before it is allowed onto the main runtime path

8. Scenario tests used to approve a geometry fix are permanent repo tests.
   They must not remain temporary diagnostics.

9. If a geometry rule changes runtime cost, a performance guard is mandatory
   before the rule is allowed into the main runtime path.

10. If any current-phase contract test turns red, work must not continue into a
    later phase until the change is reverted or isolated away from the main
    runtime path.

11. If a red state cannot be reverted immediately, the issue must record:
    - which contract turned red
    - why it turned red
    - the required fix before phase advancement
    and must be escalated for lead review.

12. Helper routing must stay explicit:
    - core modeling helpers may run on all geometry only when they define the
      normal phase output
    - ownership helpers may run only on eligible conflict components
    - clipping helpers may run only on eligible overflow fragments
    - normal solid stroke and normal dashed stroke geometry must not be routed
      through ownership/clipping helpers by default

---

## Phase 1 TDD: `DashIntervalRecord`

**Current status:** completed on 2026-04-01

### Output Under Test

- full `dash/gap interval allocation`

### Tests To Write First

1. Interval ordering tests
- dash intervals are strictly ordered
- gap intervals are strictly ordered
- dash and gap alternate correctly

2. Length allocation tests
- each dash interval length matches authored dash length
- each gap interval length matches authored gap length
- seam wrap does not mutate authored lengths

3. Cross-segment interval tests
- one dash can span multiple segments
- touched segment indices are correct
- authored adjacency is correct across segment boundaries

4. Closed path interval tests
- seam adjacency is correct
- first/last interval ownership remains canonical

### Oracles

- no polygons
- no caps
- no clipping
- no overlap

### Done Criteria

Phase 1 is done only if:

- interval allocation is correct on simple line, closed polygon, and reported
  sample path
- authored dash/gap lengths are stable
- adjacency is explicit and correct

### Completion Notes

Phase 1 is now implemented with:

- exported `DashIntervalRecord`
- exported `GapIntervalRecord`
- exported `DashIntervalAllocation`
- exported `buildDashIntervalAllocation(...)`
- `createDashedGeometryModel(...).dashIntervalAllocation`

Phase 1 product-facing integration now includes:

- first-class runtime `dashIntervalAllocation`
- downstream consumers can inspect interval ownership directly

Phase 1 direct tests now cover:

- open-path dash/gap allocation
- closed-path seam adjacency with a wrapping dash
- reported sample interval allocation as first-class output

### Not Allowed In Phase 1

- polygon generation
- cap rendering
- overlap logic
- ownership logic

---

## Phase 2 TDD: `Dash Subpath Stroker`

**Current status:** completed on 2026-04-02

### Output Under Test

- one open `dash subpath`
- one stroked outline result per dash interval

### Tests To Write First

1. Subpath extraction tests
- dash subpath follows the true path slice
- subpath length does not visibly shorten before the authored interval ends
- cross-segment subpath continuity is preserved

2. Stroker cap mode tests
- `no cap` produces flat terminal cross-sections
- `square cap` produces square terminal geometry
- `round cap` produces half-circle terminal geometry on open subpaths
- only zero-length subpaths may produce a full circle

3. True path outline tests
- curved dash body must follow the true segment, not tangent projection
- terminal geometry must follow the true sub-curve, not endpoint tangent
- short curved dashes must not shoot off along the tangent
- high-curvature terminals must remain continuous without merged-envelope
  guessing

4. Candidate preview tests
- pure candidate preview contains visible caps where selected
- authored dash/gap visual spacing remains correct
- candidate preview comes from the stroker outline itself
- overlap is allowed and not treated as failure yet

### Oracles

- dash subpath + stroked outline
- no ownership
- no overlap resolution
- no final clipping

### Done Criteria

Phase 2 is done only if:

- visible candidate dash lengths are correct
- selected cap mode is visibly correct
- `round cap` on an open dash is a half-circle
- curve-following geometry is correct across the whole dash
- cross-segment candidate continuity is correct
- candidate render does not rely on `body polygon + cap polygon` stitching or
  merged-envelope fallbacks as the primary product path

### Completion Notes

Phase 2 is now implemented with:

- dash subpath extraction driven from authored interval distances
- generic open-subpath outline generation with cap support:
  - `none`
  - `square`
  - `round`
- `createDashedGeometryModel(...).model.polygons` driven directly from the
  stroked outline result

Phase 2 product-facing integration now includes:

- dashed render consuming candidate outline polygons directly
- dashed hit-testing consuming the same candidate outline polygons
- downstream mesh/render consumers receiving candidate-preview geometry from
  the stroker output itself

Phase 2 direct tests now cover:

- straight-dash half-circle round-cap behavior
- corner-spanning dash subpath extraction
- cap-mode switching between flat, square, and round terminals
- cubic dash candidate curve-following
- render/hit integration on the product path

### Not Allowed In Phase 2

- overlap solver
- wedge legality enforcement
- final inside clipping
- primary product render defined by ad hoc decomposition stitching

---

## Phase 3 TDD: `OverlapGraph` And `ConflictComponent`

**Current status:** in progress; ownership-assembly seam regressions are now
covered by targeted hotspot tests, while final clipping/cutting still needs its
own explicit phase-level oracle

### Output Under Test

- global overlap graph
- conflict component extraction

### Tests To Write First

1. Pair overlap detection tests
- overlapping candidates form graph edges
- non-overlapping candidates do not

2. Component extraction tests
- `A-B`, `B-C`, `C-D` becomes one component `{A,B,C,D}`
- disjoint overlap groups stay separated

3. Spatial index consistency tests
- bbox candidates include all true overlaps
- confirmed overlap stage removes false positives

4. Graph symmetry tests
- if `A-B` is a confirmed overlap, the graph encodes the relation symmetrically
- graph traversal order does not change edge presence

5. Product/debug surface tests
- overlap graph debug output is readable
- conflict component output is product-checkable for the current phase

### Oracles

- graph structure
- component membership
- no ownership decisions

### Done Criteria

Phase 3 is done only if:

- all true overlaps are discovered
- component grouping is deterministic
- no pairwise local trimming is needed to explain the overlap topology
- debug output for overlap graph / components is readable
- current phase output is visibly inspectable without borrowing later-stage
  correctness
- spatial-index / confirmed-edge performance guard remains green

### Not Allowed In Phase 3

- partition ownership
- clipping decisions
- render-time repair patches
- heuristic edge creation from local seam/corner windows
- primary graph construction driven by proxy windows instead of confirmed
  polygon overlap

---

## Phase 4 TDD: `Overlay Partition` And `Ownership Resolution`

### Output Under Test

- atomic regions
- ownership resolution result

### Tests To Write First

1. Partition correctness tests
- atomic regions do not overlap
- combined atomic regions account for component coverage
- each atomic region preserves its `coverageSet`

2. Exclusive region tests
- regions with one owner are preserved for that owner

3. Same-dash continuity tests
- cross-segment dash continuity is preserved before foreign-dash conflict
- one authored dash must not be shortened because local foreign overlap was
  considered too early

4. Multi-dash conflict tests
- 2-way conflict resolves deterministically
- 3-way conflict resolves deterministically
- 4-way conflict resolves deterministically

5. Order independence tests
- changing candidate traversal order must not change final ownership result

6. Ownership policy tests
- same-dash continuity rule has explicit priority over foreign-dash conflict
- exclusive-region preservation is explicit
- shared-region retention policy is explicit
- multi-dash tie-break policy is deterministic and documented

7. Product/debug surface tests
- ownership labeling debug output is readable
- atomic region overlay is inspectable as the active phase output

8. Performance / bailout tests
- atomic-region growth stays within the accepted complexity envelope
- split depth stays within the accepted complexity envelope
- component bailout, when triggered, falls back to preview geometry and records
  the bailout event

### Oracles

- region decomposition
- ownership assignment
- deterministic component resolution

### Done Criteria

Phase 4 is done only if:

- overlap is solved per component
- result is deterministic
- same-dash continuity survives the resolution step
- tie-break policy is explicit and tested
- debug output for atomic regions / ownership labels is readable
- current phase output is visibly inspectable without borrowing Phase 5
  clipping
- atomic-region / split-depth performance guard remains green
- bailout fallback behavior is explicit and tested

### Not Allowed In Phase 4

- final inside clipping as a substitute for ownership
- pair-by-pair mutation of already-resolved candidates
- implicit ownership winners caused by traversal order or proxy windows
- unbounded region splitting without a recorded complexity envelope

---

## Phase 5 TDD: `Final Inside Clipping` And `Final Render`

### Output Under Test

- final resolved polygons
- final mesh output
- final screenshot output

### Tests To Write First

1. Formal legality-definition tests
- `legal_segment_piece_domain(piece)` is derived from the exact piece slice, not
  tangent projection
- `legal_owner_domain(dash)` is the union of segment-owned piece domains
- `actual_overflow_fragment = actual geometry - legal_owner_domain`
- seam, acute, high-curvature, and segment-transition cases are expressed as
  scenarios of the same legality definition

2. Helper entry-condition tests
- `should run`: the helper runs only when actual geometry exists outside the
  legal owner domain
- `should not run`: the helper no-ops when geometry is fully inside the legal
  owner domain
- `owned` and `passthrough` routing are both explicitly covered

3. Scenario family tests
- closed seam return-to-origin scenario clips only true overflow
- left acute scenario clips only true overflow
- right acute scenario clips only true overflow
- segment-transition scenario preserves legal geometry
- smooth high-curvature scenario preserves legal geometry

4. Non-regression tests
- dash length remains correct after final clipping
- selected cap mode remains visible after final clipping
- cross-segment continuity is preserved after final clipping

5. Render agreement tests
- final polygons and mesh agree
- mesh and screenshot agree

6. Visible terminal tests
- visible round caps exist when `round cap` is selected
- visible square caps exist when `square cap` is selected
- no caps exist when `no cap` is selected

7. Performance tests
- final clipping does not introduce blanket phase-wide processing
- reported sample runtime stays within the agreed budget
- polygon-count growth stays bounded after final clipping

8. Cache / reuse tests
- unchanged owners reuse cached legal domains
- only dirty owners / dirty pieces trigger recomputation
- cache invalidation follows the written dirty-condition contract

### Oracles

- final polygons
- mesh output
- screenshot output

### Done Criteria

Phase 5 is done only if:

- final visible render is correct
- cap presence is visible in the actual render
- authored dash/gap lengths survive to the final render
- all clipping helpers have passing `should run` / `should not run` contracts
- all permanent scenario families relevant to the change remain green
- performance guards remain green
- legal-domain cache / reuse behavior is tested and green

### Explicit Phase 5 Non-Rules

The following are invalid as primary clipping proofs:

- `touchedSegmentIndices` by itself
- seam/corner radius windows by themselves
- local bounds overlap by itself
- dash index identity (`first`, `last`, etc.)
- unchanged polygon signature
- temporary diagnostic tests that are not promoted into repo tests
- routing all stroke geometry through clipping helpers just because the phase is
  active

---

## Test Surface By Phase

### Unit / Geometry-Level

Use for:

- interval allocation
- candidate geometry
- overlap graph
- partition
- ownership

### Integration / Render-Input

Use for:

- final polygon handoff to render
- mesh input correctness
- helper routing verification for owned vs passthrough geometry

### E2E / Screenshot

Use only for:

- final visible correctness
- actual cap visibility
- final dash/gap correctness in the real app
- permanent hotspot scenario approval after runtime wiring

E2E must not be treated as a substitute for earlier phase geometry tests.

E2E must also not be the first place where a scenario family becomes permanent.
The permanent scenario must exist at lower layers before E2E is used as the
final approval surface.

---

## Required Debug Outputs

Each phase must expose a readable debug output.

### Phase 1

- full interval list

### Phase 2

- candidate preview
- candidate body/cap breakdown

### Phase 3

- overlap graph
- conflict components

### Phase 4

- atomic region overlay
- ownership labeling

### Phase 5

- final mesh mask
- final screenshot probes
- final owner-domain debug output
- actual-overflow-fragment debug output
- bailout event output when a component exceeds the accepted envelope
- cache / dirty-owner debug output for final clipping

If a phase has passing tests but no readable debug output, the phase is not
considered safely complete.

---

## Stop Conditions

Do not proceed to the next phase if:

1. earlier phase tests are red
2. earlier phase debug output is not understandable
3. later implementation is being used to hide earlier-phase defects

Examples:

- do not solve overlap if candidate geometry is still tangent-driven
- do not hard-gate screenshots if final mesh input is not yet trustworthy
- do not use clipping to hide wrong candidate dash length
- do not wire a clipping helper if its `should not run` contract does not yet
  exist
- do not promote a diagnostic hotspot into approval evidence unless it has been
  converted into a permanent scenario test
- do not continue implementing Phase 4 or Phase 5 on top of a red Phase 3
  contract
- do not continue implementing Phase 5 on top of a red Phase 4 contract

---

## First TDD Execution Order

When implementation starts, the first TDD sequence should be:

1. write `DashIntervalRecord` tests
2. implement interval builder
3. write dash-subpath / cap-mode / candidate-preview tests
4. implement true-path-slice candidate generator
5. connect candidate outline polygons to the product render path

Only after those five steps are stable should overlap work begin.

When Phase 3-5 work begins, the execution order must be:

1. write Phase 3 graph + symmetry + performance tests
2. implement overlap graph and component extraction
3. write Phase 4 ownership policy + complexity tests
4. implement overlay partition and ownership resolution
5. write Phase 5 legality-definition + helper-boundary + scenario + performance
   tests
6. implement final clipping and render handoff
7. run permanent scenario matrix, visual validation, and performance guards

---

## Success Definition

This TDD plan is successful only if it makes this impossible:

- many intermediate rules pass
- local metrics improve
- e2e still passes
- final visible render is obviously wrong

The new TDD workflow must force correctness to become progressively visible,
not merely progressively explainable.

For final clipping specifically, success must also make this impossible:

- helper entry conditions stay implicit
- scenario tests exist only in temp form
- a rule fixes one hotspot by processing nearby legal geometry
- correctness improves while runtime cost silently explodes
