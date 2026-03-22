# PLAN REJECTED: Dashed Stroke Corner Exact Geometry (Workaround Approach)

**Status:** REJECTED (2026-03-23)  
**Reason:** Workaround approaches are prohibited. Only geometry-first methods are allowed.  
**Superseded By:** `docs/ai/apps/asyra-design/plans/geometry-and-dash-gap-completion.md`

---

## Original Plan Content

The following document describes a workaround-based approach to dashed stroke corner geometry that **has been rejected in favor of a pure geometry-first solution**.

### Scope

Replace the current translucent-corner workaround for dashed strokes with an
exact geometry implementation.

This plan is app-level because the bug is user-visible in Asyra Design, but the
implementation owner remains the preset stroke renderer in
`packages/preset/src/components/strokes.ts`.

### Problem Statement

Current behavior has two conflicting failures when one logical dash spans a
corner:

- if we let the renderer stroke both segment pieces directly, translucent
  colors darken at the overlap
- if we route the dash through the current mask/fill workaround, the visible
  shape can escape the true segment wedge at acute inside corners

The correct result is stricter than "looks close":

- one logical dash must render once
- the rendered area must remain inside the true geometric bounds implied by the
  segment pair and stroke settings
- join/cap semantics must still match the authored stroke definition

### Current Implementation Review

Current implementation in `packages/preset/src/components/strokes.ts` is not a
real geometry solution:

1. It introduces dedicated workaround state for translucent corner dashes:

- `DashAlphaUnionCacheEntry` and `DashAlphaUnionHost`
- `resetDashAlphaUnionCache(...)`
- `getDashAlphaUnionCacheEntry(...)`

2. In the dashed render path, it detects `stroke.alpha < 1` plus a multi-point
   dash part and diverts that part into `alphaUnionParts` instead of rendering
   the actual dash geometry directly.

3. It then:

- strokes per-segment mask pieces with opaque white
- fills a padded bounding rectangle through that mask

4. This is a workaround because:

- the rectangle is not the dash geometry
- the mask is assembled from separate segment strokes rather than from one
  exact corner outline
- shape correctness depends on raster/mask composition details instead of the
  actual stroke geometry model

Observed consequence in the current implementation:

- acute inside corners can still show fill outside the true segment-bounded
  wedge even though alpha stacking is avoided

### Why This Plan Was Rejected

This plan proposed a technically sound direction (exact geometry instead of
workarounds) but applied workaround-style thinking to the implementation. The
decision to reject this approach in favor of `geometry-and-dash-gap-completion.md`
reflects:

1. **No incremental workarounds allowed** - The app policy now forbids ANY
   workaround path, no matter how reasonable the local reasoning appears.

2. **Time to clean implementation** - Geometry-first stroke rendering is already
   partially implemented. Refining that path is cleaner than maintaining parallel
   workaround and geometry paths.

3. **Foundation for gradient support** - Only pure geometry-first rendering can
   serve as the stable foundation for future gradient stroke fill.

### Non-Negotiable Constraints (Still Valid)

- no mask-plus-rectangle workaround
- no "looks good enough" corner heuristic
- no separate geometry rules for rendering vs hit testing
- keep existing centerline-first dash allocation and dash continuity
- keep `inside` / `center` / `outside` stroke position semantics

---

## Decision Record

**Date:** 2026-03-23  
**Decision:** REJECT dashed-stroke-corner-alpha-union plan  
**Reason:** Workaround-based approach incompatible with app policy requiring pure geometry-first solutions.  
**Impact:**
- Plan moved to completed records as historical reference
- Superseded by geometry-and-dash-gap-completion plan
- Confirms no workaround transitions allowed during implementation

**Related Decisions:**
- 2026-03-21 - Dashed stroke recovery finalized on GeometryModel → MeshProjection path
- 2026-03-21 - Geometry-first dashed stroke closeout finalized from sample regressions
