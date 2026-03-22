# Plan: Dashed Stroke Corner Exact Geometry

## Scope

Replace the current translucent-corner workaround for dashed strokes with an
exact geometry implementation.

This plan is app-level because the bug is user-visible in Asyra Design, but the
implementation owner remains the preset stroke renderer in
`packages/preset/src/components/strokes.ts`.

## Problem Statement

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

## Current Implementation Review

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

## Non-Negotiable Constraints

- no mask-plus-rectangle workaround
- no "looks good enough" corner heuristic
- no separate geometry rules for rendering vs hit testing
- keep existing centerline-first dash allocation and dash continuity
- keep `inside` / `center` / `outside` stroke position semantics

## Real Implementation Target

Introduce a real dashed stroke geometry builder for one logical dash part.

For every dashed part that crosses one or more vertices:

- compute the position-adjusted centerline first, exactly as the renderer does
  today
- derive the actual visible filled region for that dash part as explicit
  polygon geometry
- render that polygon once with the authored color/alpha

That geometry must represent:

- start cap
- end cap
- outer join
- inner corner clipping
- position-adjusted centerline routing

The important rule for the bug you marked:

- at an acute inside corner, the dash fill must be clipped by the half-planes
  of the two contributing segments so no filled area extends outside the true
  segment wedge

## Concrete Implementation Plan

1. Remove the workaround path

- delete the dash alpha union cache types and helpers from
  `packages/preset/src/components/strokes.ts`
- remove the `alphaUnionParts` branch from `renderPolylineStrokes(...)`
- stop rendering translucent corner dashes through mask children and bounds
  fills

2. Add a shared exact geometry builder

- add an internal builder in `packages/preset/src/components/strokes.ts` for
  dashed-part geometry, for example:
  - `buildDashPartGeometry(...)`
  - `buildDashPartOutline(...)`
- input:
  - already position-adjusted dash-part polyline
  - original (pre-offset) segment directions, as a parallel list of unit
    vectors corresponding to each segment of the dash-part polyline, sourced
    from the authored polyline before any stroke-position offset is applied
  - stroke width
  - join type
  - miter limit
  - cap type
- output:
  - one or more polygons representing the exact visible filled region
- ownership choice for offset-centerline cleanup:
  - Option B
  - the builder itself handles trim/extend at each interior vertex as its
    first step, before any cap/join geometry is computed
  - this is required because `inside` stroke at acute corners can produce
    diverging offset segments or a distant artificial intersection if the input
    is treated as already clean geometry

3. Define the actual corner math

- treat each dash part as a strip around the dash-part centerline
- compute left/right offsets per segment
- at every interior vertex:
  - compute turn direction
  - classify outer side vs inner side
  - outer side:
    - honor `miter`, `bevel`, or `round`
    - enforce the existing miter-limit rule
  - inner side:
    - do not extend by join style
    - intersect/clamp against the two segment-side half-planes so the result
      stays inside the true wedge
    - these half-planes must be derived from the original, pre-offset segment
      directions from the authored polyline, not from the position-adjusted
      centerline
- only apply round caps at the dash start and dash end, not at the internal
  continuation vertex
- round arcs:
  - round caps and round joins are approximated as polygon arcs
  - segment count must be chosen so maximum deviation from the true arc is
    less than or equal to `0.5px` at the maximum expected render scale

4. Render from the exact geometry

- for dashed parts with more than one segment, render the returned polygon
  geometry with `fill(...)`
- for dashed parts that remain one straight segment, either:
  - keep the current stroke path if it is already exact, or
  - route them through the same geometry builder for consistency
- keep solid stroke rendering unchanged unless the exact geometry builder proves
  reusable without additional complexity

5. Share geometry with hit testing

- choose Option A for accuracy:
  - hit testing consumes the exact polygon output from
    `buildDashPartGeometry(...)`
  - vector stroke hit tests should use point-in-polygon against the same
    rendered dash-part polygons rather than a separate segment-radius
    approximation
- reason:
  - this bug is specifically about shape escaping the true wedge, so hit
    testing must match the exact rendered area, not a cheaper proxy
- the render path remains the source of truth

6. Regression coverage

- add a focused renderer test for an acute corner dash with alpha
- verify that the result is rendered as one fill, not double-stroked overlap
- add a geometry-bounds assertion for the inside-corner case:
  - every outline vertex must lie on or inside the expected segment wedge
- add a regression for `inside` because that is the failing case shown in the
  screenshots
- keep the existing dash continuity tests passing

## Verification

- `yarn workspace @asyra/preset test:local -- strokes`
- `node ./node_modules/eslint/bin/eslint.js packages/preset/src/components/strokes.ts packages/preset/src/__tests__/strokes.test.ts`
- `yarn workspace @asyra/preset build:preset`
- manual canvas check:
  - acute inside corner with alpha no longer darkens
  - acute inside corner fill does not escape the segment wedge
  - existing dashed continuity across corners remains unchanged

## Exit Criteria

- no `DashAlphaUnion*` workaround path remains in the stroke renderer
- one logical corner-spanning dash is rendered from exact geometry, not from
  mask composition
- translucent dashed corners preserve authored color without overlap darkening
- acute inside corners stay within the true segment-bounded region
- renderer tests and focused manual checks confirm both color correctness and
  shape correctness
