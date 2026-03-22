# Plan: Stroke Geometry-First Corner Correctness

## Scope

Replace the dashed closed-path stroke rendering path with a geometry-first
implementation that fixes the two known correctness failures:

- translucent corner-spanning dashes must not darken from self-overlap
- `inside` corner-spanning dashes must not extend outside the true
  segment-bounded wedge

This work also establishes the renderer direction needed for future gradient
stroke fill by making dashed strokes render from explicit visible geometry
instead of multi-stroke composition.

## Steps

1. Introduce exact visible dash geometry

- build polygon geometry for visible dashed parts
- keep dash allocation on the authored centerline

2. Replace dashed rendering with fill semantics

- render dashed stroke parts from one filled region instead of repeated
  `stroke(...)` draws
- preserve existing `inside`, `center`, and `outside` position semantics

3. Align hit testing with rendered geometry

- expose polygon hit primitives for dashed parts
- make vector hover hit testing consume the same visible dashed geometry

4. Add regression coverage and validate

- cover straight and corner-spanning dashed parts
- cover acute `inside` wedge clipping
- run preset tests, lint, preset build, and app build

## Validation

- `yarn workspace @asyra/preset test:local -- strokes`
- `yarn workspace @asyra/preset build:preset`
- `yarn eslint packages/preset/src/components/strokes.ts packages/preset/src/components/vector.ts packages/preset/src/__tests__/strokes.test.ts`
- `yarn workspace @asyra/asyra-design react:build`

## Result

Completed on 2026-03-21.

- Replaced dashed stroke rendering with geometry-first polygon fill output so
  dashed parts no longer rely on overlapping `stroke(...)` draws for visible
  output.
- Added dash-part endpoint context plus full closed-path `inside` clipping so
  corner-adjacent dashed geometry stays inside the true segment wedge,
  including path-start and sharp-corner cases from the reported sample.
- Increased stroke polyline bezier flattening fidelity so short dashes follow
  curved segments instead of collapsing into centerline-only straight pills.
- Unified dashed hit testing with rendered polygon geometry, including vector
  hover hit behavior.
- Expanded regression coverage for straight dashed parts, corner-spanning
  dashed parts, curve-following dashed parts, and the reported sample-specific
  inside-corner cases.

Final decision:

- Treat dashed stroke rendering as visible geometry plus paint, not as a
  stroke-command composition problem.
- Keep the same geometry-first direction as the base for future gradient stroke
  fill work.
- For translucent dashed strokes, emit one filled path per dashed stroke/polyline
  so overlapping dash polygons do not darken from repeated alpha composition.

Exit criteria:

- Semi-transparent dashed corners no longer darken from self-overlap.
- `inside` dashed corners stay within the true segment-bounded wedge.
- Short dashed parts stay aligned to curved stroke segments with sufficient
  stroke-specific flattening density.
- Dashed rendering and dashed hit testing consume the same geometry model.
- Preset tests, lint, preset build, and app build pass.

Canonical completed-plan path:

- `docs/ai/apps/asyra-design/plans/completed/stroke-geometry-first-corner-correctness-plan.md`
