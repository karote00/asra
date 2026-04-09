# Inside Dashed Stroke Mature-Engine Review Report

**Date:** 2026-04-02  
**Audience:** technical review / management review  
**Scope:** inside dashed stroke rebuild for Asyra Design  
**Status:** architecture direction approved internally; Phase 2 stroker path now implemented, Phase 3 pending

## Decision Framing

This document is **not** asking for visual sign-off on the current preview
output.

This document is asking for **architectural approval** of the rebuild
direction:

- continue with a `mature stroke-engine` model
- accept short-term rewrite cost
- reject a return to local-first repair logic

The decision under review is:

`dash interval allocation -> dash subpath extraction -> stroke-to-outline -> later global conflict handling`

This review intentionally prioritizes **feasibility and architectural
correctness** over implementation schedule.

This document does **not** define:

- implementation schedule
- detailed Phase 3 overlap-resolution algorithm design
- final visual sign-off criteria

## 1. Executive Summary

The inside dashed stroke implementation must move from a `local-first repair`
model to a `mature stroke-engine` model.

The previous direction consumed substantial implementation cost without
producing reliable render correctness, and it does not scale to Figma-level
stroke behavior.

The decision now requested is to approve a rebuild around:

1. full dash/gap interval allocation
2. dash subpath extraction
3. one generic stroke-to-outline step
4. later global conflict handling

This matters because it is the first direction in this effort that is aligned
with how mature graphics engines solve stroked paths, and it is the first
direction that is plausibly extensible to future features such as gradient
stroke.

## 2. Why The Previous Direction Was Rejected

The previous implementation shape was rejected for four reasons.

### 2.1 It Solved A Global Problem With Local Repairs

Inside dashed stroke correctness depends on the full path and, later, on global
dash interactions.

The previous shape instead tried to:

- generate one local dash slice
- decide local cap behavior
- apply local wedge / ownership / repair rules
- hope the global result became correct

This is structurally wrong for:

- high-curvature dash bodies
- cross-segment dashes
- overlap between non-adjacent dashes
- cap continuity

### 2.2 It Optimized For Intermediate Contracts Instead Of Render Correctness

A large number of tests and intermediate contracts were added around:

- local-gap classifications
- ownership labels
- runtime adoption surfaces
- artifact family comparisons

These were able to go green without guaranteeing that the rendered output was
visually correct.

### 2.3 It Was Not Extensible To A Figma-Level Stroke System

The old route depended on:

- body polygon decomposition
- cap polygon composition
- merged fallback polygons
- scenario-specific render branches

That shape is inherently hostile to future features such as:

- gradient stroke
- richer cap/join behaviors
- more stable stroke rendering across curvature extremes
- reusable engine-level stroke painting

### 2.4 It Made Cost Grow Faster Than Correctness

The implementation accumulated substantial complexity before the correct
architecture was made explicit. This increased both development cost and review
cost without delivering proportional visual correctness.

## 3. New Architecture Direction

The rebuild now follows a `mature stroke-engine` model.

### 3.1 Phase 1: Dash/Gap Interval Allocation

For the full vector path:

- compute total arc length
- allocate every `dash` interval
- allocate every `gap` interval
- preserve authored ordering and seam adjacency

Output:

- first-class `DashIntervalAllocation`

What this solves:

- authored dash/gap lengths
- authored adjacency
- cross-segment interval ownership

What it does not solve:

- cap rendering
- overlap
- clipping

### 3.2 Phase 2: Dash Subpath Stroker

For each dash interval:

1. extract the true subpath for that interval
2. keep the subpath as an open path
3. stroke that subpath into one outline
4. render the outline directly

This means:

- the dash center follows the true path slice
- the body is not reconstructed from ad hoc body quads
- cap geometry is part of the stroker output
- the product path does not depend on `body + cap + merged fallback`

Required cap semantics:

- `no cap`: flat terminal cross-section
- `square cap`: rectangular terminal extension
- `round cap`: half-circle on an open dash terminal
- only zero-length dash subpaths may degenerate into a full circle

### 3.3 Phase 3+: Global Conflict Analysis

Only after full dash candidates exist:

- detect overlap globally
- build overlap graph
- split into conflict components
- partition by overlay
- resolve ownership
- apply final inside clipping

This keeps overlap resolution in the correct phase instead of polluting
candidate generation.

## 4. Why This Matches Mature Graphics Engines

The new route is intentionally aligned with standard stroke-engine patterns:

1. authored path
2. dash interval allocation
3. subpath extraction
4. stroke-to-outline
5. tessellation / triangulation
6. render

This is much closer to how mature engines and tessellators are structured than
the previous polygon-splicing path because it:

- separates authored path semantics from stroke realization
- enforces one geometry-construction boundary for body, caps, and joins
- keeps candidate generation separate from later ownership/clipping decisions

The practical consequence is:

- fewer geometry hacks
- clearer correctness boundaries
- easier debug of each phase
- a much better base for future stroke paint features

## 5. Why This Is More Extensible

This architecture is intentionally chosen because it can scale beyond the
current bugfix target.

### 5.1 Gradient Stroke

With `subpath -> outline` in place, gradient stroke becomes a paint problem on
top of a stable stroke outline.

This is significantly easier than trying to coordinate gradients across:

- body polygons
- cap polygons
- merged fallback regions

### 5.2 Cap / Join Expansion

Cap and join types defined in Section 3.2 can be handled as stroke-engine
options instead of patch-specific geometry branches.

### 5.3 Better Separation Of Concerns

The new architecture separates:

- authored dash allocation
- candidate generation
- overlap/ownership
- final clipping
- paint/render

This is necessary for maintainability and reviewability.

## 6. Current Status

### Completed

- Phase 1 is implemented and product-integrated:
  - `DashIntervalAllocation`
  - direct interval tests
  - runtime result exposure

### Completed

- Phase 2 is now implemented and product-integrated:
  - candidate preview is product-facing through the mature stroker path
  - authored dash intervals render through `dash subpath -> stroke-to-outline`
  - open-dash cap modes are supported on the candidate path
  - dashed render and hit-testing both consume the outline result directly

### Not Started

- Phase 3 global overlap graph
- conflict components
- overlay partition
- ownership resolution
- final inside clipping

## 7. Decision Cost And Trade-Offs

This decision intentionally accepts short-term rewrite cost in exchange for
long-term engine quality.

Accepted short-term costs:

- rewriting the current Phase 2 transitional implementation
- discarding polygon-stitching assumptions
- delaying overlap/ownership work until candidate generation is sound

Expected long-term gains:

- lower architectural debt
- clearer separation of concerns
- more stable render correctness
- a realistic base for Figma-level stroke features

If this direction is not taken, the project is likely to continue paying for:

- local-first repair loops
- growing geometry exceptions
- weak guarantees between tests and visible output
- poor extensibility for future stroke features

## 8. Phase 2 Done Means

Phase 2 should be considered complete only when:

1. each authored dash interval is rendered from an extracted dash subpath
2. stroke body and terminal caps are produced by a single stroker path
3. rendering no longer depends on `body/cap/fallback polygon stitching`
4. `round cap` on an open dash is rendered as a half-circle
5. high-curvature cases no longer require family-specific repair logic just to
   remain visually continuous
6. remaining visible issues are clearly attributable to later phases
   (`overlap / ownership / final inside clipping`)

## 9. Transitional Boundary

The current Phase 2 preview is **candidate output**, not final visual
correctness.

It exists to validate:

- dash interval correctness
- dash subpath extraction
- stroke body/cap generation direction
- product-facing integration of candidate geometry

It must not be mistaken for:

- final render quality
- final overlap behavior
- final inside clipping behavior
- proof that later-phase overlap / ownership / clipping work is complete

This is an explicit risk boundary for review.

## 10. Expected Benefits

If this decision is accepted and implemented cleanly, the project should gain:

- more predictable visual correctness
- lower long-term complexity
- better compatibility with future stroke features
- stronger fit for Figma-level expectations

## 11. Current Risks

The main current risks are:

1. Phase 3+ overlap / ownership / final clipping remain unimplemented.
2. Candidate preview still intentionally allows overlap and out-of-range
   geometry.
3. Candidate rendering quality may create false confidence if mistaken for
   later-phase final inside-clipped output.

## 12. Approval Checklist

Approval of this document implies agreement with the following architectural
decisions.

1. The project should continue with a `mature stroke-engine` direction rather
   than return to local-first repair logic.
2. Phase 2 should be rewritten as:
   `dash subpath extraction -> stroke-to-outline -> render`
   instead of `body/cap polygon stitching`.
3. The stroke engine should be designed as one parameterized system that can
   eventually cover:
   - stroke position: `center`, `inside`, `outside`
   - stroke width
   - stroke style: `solid`, `dashed`
   - join type: `bevel`, `miter`, `round`
   - cap type: `no-cap`, `square cap`, `round cap`
   - miter limit
   - dash / gap
4. Overlap / ownership / final inside clipping must remain later-phase work and
   must not be mixed back into Phase 2 candidate generation.
5. Later-phase work must stay out of Phase 2 candidate generation and not
   reintroduce polygon stitching as the primary render path.

## 13. Bottom Line

The project now has one clearly viable extensible direction for inside dashed
stroke:

`dash interval allocation -> dash subpath extraction -> stroke-to-outline -> later global conflict handling`

Approving this document means approving that direction as the required basis
for subsequent Phase 2 and Phase 3 work, and rejecting further investment in
local-first repair as the primary architecture.
