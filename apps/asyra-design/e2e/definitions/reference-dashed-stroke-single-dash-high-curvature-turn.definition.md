# Reference Dashed Stroke Single Dash High-Curvature Turn

## Purpose

This benchmark isolates a **single inside dashed-stroke segment that must survive a high-curvature turn** on the reference 5-anchor closed vector.

It exists because whole-shape completeness can pass while one local dash is still wrong:

- the dash can visually bend the wrong way
- the terminal round cap can be present but positioned incorrectly
- the dash can stay attached to the curve while its rendered body becomes too short
- the dash body and cap can overlap and create darker compositing

## Scope

This is a **focused local benchmark**, not a full-path benchmark.

It covers the dash candidate that:

- touches segment `44`
- lies inside the high-curvature turning zone near the smooth anchor
- should terminate while still following the authored curve

The current reference fixture happens to realize this case near `tp-26`, but the benchmark name is intentionally generic.

## Oracle Source

The benchmark is geometry-first.

It is derived from:

1. the authored reference vector geometry
2. the dashed interval allocation
3. the final polygons produced for the selected high-curvature turning dash

This benchmark should not depend on manual screenshots as the primary truth source.

## Derived Observables

The benchmark measures:

- `intervalLength`
  - authored dash interval length for the selected turning dash
- `sourceLength`
  - the source path length represented by the dash before final-face rendering
- `renderLength`
  - diagnostic only: the rendered inside-centerline length after final-face construction
  - this is **not** the authored dash-body length and should not be used as the primary pass/fail criterion for inside turning dashes
- `maxCurveBoundaryDistance`
  - maximum distance from sampled authored curve points to the rendered polygon boundary
- `boundarySourceKind`
  - which boundary source was used (`exact-cubic` or `sampled`)
- `includeEndCap`
  - whether the dash keeps its terminal round cap
- `endCapArcMaxBoundaryDistance`
  - maximum distance from the ideal terminal round-cap arc to the rendered polygon boundary
- `endCapArcAverageBoundaryDistance`
  - average distance from the ideal terminal round-cap arc to the rendered polygon boundary
- `maxRasterCoverage`
  - whether rasterized coverage exceeds `1`, which indicates visible overdraw
- `true-offset final-face similarity`
  - whether the runtime final face matches an independently generated true-offset reference face for the same dash interval
- `terminal cap interior ownership`
  - whether the expected terminal-cap interior is covered once, without overdraw or missing ownership

## Pass Criteria

The benchmark is considered healthy when:

- `intervalLength ~= 20`
- `sourceLength >= 19`
- `maxCurveBoundaryDistance <= 1.25`
- `boundarySourceKind = exact-cubic`
- `includeEndCap = true`
- `endCapArcMaxBoundaryDistance <= 1.25`
- `endCapArcAverageBoundaryDistance <= 0.5`
- `maxRasterCoverage <= 1`
- runtime final face should match the true-offset reference face with high overlap
- terminal cap interior total coverage should stay near `1` without exceeding single ownership

## Known Red-Line Regression Checks

These are now active checks for this focused benchmark:

- runtime final face must not diverge materially from the true-offset reference face
- terminal cap interior must remain fully covered without overdraw

`renderLength` is intentionally excluded here because the inside turning dash shortens along its inner centerline as curvature increases; the correct body-length contract is carried by `intervalLength` and `sourceLength`, not by `renderLength`.

`endCapArcCoverageRatio` is also treated as diagnostic only. It samples points exactly on the ideal arc boundary, so it is sensitive to polygon boundary inclusion rules. The boundary-distance metrics above are the primary cap-placement oracle.

## Where It Lives

Primary benchmark implementation:

- [geometry-model.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/geometry-model.test.ts)

Supporting geometry implementation:

- [geometry-model.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/components/geometry-model.ts)
- [strokes.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/components/strokes.ts)

## Why This Benchmark Matters

This benchmark prevents the workflow from falling back to screenshot-by-screenshot debugging.

Before changing high-curvature turning-dash geometry, verify against this benchmark first.
