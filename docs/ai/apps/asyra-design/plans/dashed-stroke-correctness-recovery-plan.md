# Plan: Dashed Stroke Correctness Recovery

## Status

Implemented for the current dashed-stroke path.

Verification harness and anti-workaround gates were applied before the new
`GeometryModel -> MeshProjection` path was merged. The finished path now splits
responsibilities explicitly:

- `GeometryModel` owns authored dash intervals, local inside-corner geometry,
  and hit-test polygons
- `MeshProjection` owns solid-paint composition as a single compound fill pass,
  so overlapping dash polygons do not darken from repeated alpha paint

This file remains as the canonical recovery record and implementation contract
for the finished work.

## Why This Plan Exists

The earlier geometry-first dashed-stroke work established the right direction
but did not satisfy real render validation on the reported sample. The failure
mode was structural:

- success was inferred from local geometric reasoning instead of validated from
  rendered output
- `inside` correction drifted into workaround-style clipping behavior
- self-intersecting closed paths exposed gaps between local assumptions and
  actual visible output

This recovery plan reopens the problem with a stricter rule:

- no workaround is acceptable in the stroke geometry pipeline

## Required Outcome

Deliver dashed stroke rendering that is correct enough to serve as the base for
future gradient stroke fill and other stroke-derived capabilities.

Minimum acceptance:

- dashed parts follow authored bezier geometry, not coarse centerline pills
- `inside` dashed parts stay inside the intended local corner/wedge semantics
- translucent dashed overlap does not darken from repeated paint composition
- self-intersecting closed paths do not collapse to empty or near-empty output
- render result is proven by executable render validation, not by reasoning

## Non-Negotiable Constraints

- No global full-path clipping used as a substitute for local stroke geometry.
- No fallback from failed dashed geometry fill to generic `stroke(...)` output
  in the same correctness path.
- No “looks good on this sample” acceptance without deterministic validation.
- No completion claim unless render oracle, algorithm oracle, side-effect checks,
  and edge-case matrix all pass.

## What Counts As A Workaround

Treat the following as disallowed workaround patterns:

1. Using whole-shape masks or global half-plane clipping to repair local dash
   corner geometry.
2. Increasing flatten density alone to “hide” incorrect local stroke expansion.
3. Falling back to primitive stroke drawing when polygon generation/clipping
   fails.
4. Adding case-by-case branch rules for specific sample IDs or point orders.
5. Accepting a heuristic whose correctness cannot be expressed as a stable
   invariant or render oracle.

## Verification First

Implementation may begin only after these verification paths are defined and
 wired into the workflow.

### 1. Render Oracle

The render result must be checked from actual rendered output.

Required method:

- build deterministic fixture rendering for dashed stroke samples
- include the user-provided failing sample as a canonical fixture
- render to image with fixed viewport / zoom / background / stroke settings
- compare against golden snapshots or invariant pixel checks

Render checks must cover:

- dash count / ordering is stable
- no unexpected disappearance of most dashes
- no dash extends outside the visible intended local inside region
- translucent overlap does not introduce darker repeated-paint islands

Manual-only inspection is not sufficient for completion. Manual inspection is
allowed only as secondary support.

### 2. Algorithm Oracle

The dash generation algorithm must expose inspectable intermediate data.

Required inspectable outputs:

- authored path-length intervals per dash
- monotonic dash order along the authored path
- local clip/expansion context used for each dash
- final visible polygons per dash before paint

Algorithm invariants:

- dash intervals are monotonic and non-overlapping in path-distance space
- dash order in output matches path order
- every visible polygon belongs to exactly one authored dash interval
- local inside clipping only references geometry adjacent to that dash interval
- no dash polygon can vanish unless the authored visible interval is truly empty

### 3. Side-Effect Checks

Changes must not silently break adjacent capabilities.

Required checks:

- hit testing still matches the rendered dashed geometry
- `center` and `outside` stroke positions are unchanged unless intentionally
  modified
- non-dashed strokes are unaffected
- self-intersecting fill behavior is not accidentally used as stroke semantics
- build output and app startup remain healthy

### 4. Edge-Case Matrix

The implementation is not done without explicit coverage for:

- open path, straight segment, single dash
- open path, curved segment, short dash
- closed convex path
- closed concave path
- closed self-intersecting path
- dash starting at path origin
- dash ending at path origin wrap
- dash spanning a sharp corner
- dash fully inside one curve segment
- very short trailing dash
- translucent dashed stroke with overlap opportunity
- future compatibility: bounds-space gradient stroke fill must remain possible

## Reassessed Technical Direction

The plan still keeps the original geometry-first direction, but with stricter
interpretation:

1. Dash allocation is based on authored path distance.
2. Each dash corresponds to an authored local subpath interval.
3. Local stroke expansion is derived from that local interval.
4. Local inside constraints are applied from adjacent authored geometry only.
5. Paint happens after visible geometry is finalized.

This specifically rejects:

- global interior clipping as the source of inside semantics
- primitive-stroke composition as the source of visible correctness

## Full Recovery Workflow

### Phase 1. Reopen the Problem Correctly

- mark previous closeout as insufficient for acceptance of the user-reported
  sample
- keep historical records, but treat this plan as the active canonical path for
  correctness recovery
- identify and remove current workaround code paths before new geometry logic is
  merged

### Phase 2. Build Verification Harness Before Renderer Changes

- create render fixtures for canonical samples, including the reported sample
- define pixel/golden comparison contract
- define debug export contract for dash intervals and polygons
- add failure output so incorrect geometry is inspectable without guesswork

Exit gate:

- a broken renderer must fail deterministically from render and algorithm
  checks before any fix starts

### Phase 3. Implement Exact Local Dash Geometry

- rework dashed geometry generation around local authored intervals
- derive local clip/expansion context from adjacent authored subpath geometry
- keep `inside` semantics local; do not use full-path global clipping
- keep geometry and paint strictly separate

Exit gate:

- algorithm invariants pass on all canonical fixtures

### Phase 4. Reintroduce Paint Semantics

- once geometry is correct, apply paint in a way that preserves authored alpha
- confirm translucent overlap is solved as a paint/composition property on top
  of already-correct geometry

Implemented outcome:

- solid dashed stroke projection renders all geometry polygons in one compound
  fill pass instead of per-polygon alpha accumulation

Exit gate:

- translucent render oracle passes without changing geometry correctness

### Phase 5. Side-Effect and Edge-Case Sweep

- rerun hit-test validation
- rerun app build and affected package build/tests
- verify untouched stroke modes remain stable
- verify all edge-case fixtures remain green

## Start-Implementation Checklist

Implementation was allowed only after all answers became “yes”:

- [x] Do we have an executable render oracle for the failing sample?
- [x] Do we have inspectable algorithm outputs for each dash interval/polygon?
- [x] Do we know which current code paths are workaround paths to avoid/remove?
- [x] Can each planned step be justified without relying on global clipping
      repair?
- [x] Can the final result be validated without human imagination?

## Validation Matrix For Completion

- render fixture oracle passes for canonical samples
- algorithm oracle invariants pass
- targeted preset tests pass
- lint passes for touched files
- affected builds pass
- manual visual validation confirms fixtures match expected output after the
  executable checks are already green

## Implemented Outcome

- Introduced canonical dashed-stroke geometry generation in
  `packages/preset/src/components/geometry-model.ts`.
- Introduced Pixi mesh projection in
  `packages/render/src/projections/mesh-projection.ts` and exposed it through
  the `@asyra/core` render facade.
- Replaced single self-intersecting dash outline polygons with simple segment
  quads, join patches, and cap patches before projection triangulation.
- Kept dash allocation on authored path distance and kept `inside` clipping
  local to the authored dash context.
- Moved dashed vector render/hit behavior onto the `GeometryModel ->
  MeshProjection` path in `packages/preset/src/components/vector.ts`.

## Verification Used

- Algorithm oracle:
  - canonical sample exposes monotonic dash intervals and inspectable polygon
    output through `debugParts`.
- Projection/render oracle:
  - canonical sample polygons are rasterized directly and after triangulated
    mesh projection, both with deterministic occupancy/bounds assertions.
- Side-effect checks:
  - dashed hit-testing remains polygon-based and aligned with rendered geometry.
  - non-dashed stroke paths remain on their previous render route.
  - `render`, `core`, `preset`, and app builds pass.

## Canonical Next Step

Use this completed recovery as the base for
`docs/ai/apps/asyra-design/plans/gradient-stroke-fill-plan.md`.
