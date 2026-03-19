# Plan: Vector Stroke Hit Test Matches Rendered Stroke Settings

## Scope

Make canvas hover/selection hit testing respect the actual rendered stroke
geometry for vector elements when custom vector hit areas are active.

Targets:

- allow clicks on visibly rendered vector strokes, including offset strokes
- keep fill hit testing unchanged
- preserve current renderer-owned geometry hit-test flow

## Steps

1. Reuse rendered stroke geometry for hit testing

- derive stroke hit segments from the same offset/dashed stroke rules used for
  rendering
- stop collapsing all stroke variants down to one max-width centerline band

2. Apply the stroke-aware hit segments in vector custom hit areas

- keep fill hit logic for gradient vectors
- union fill hit and rendered-stroke hit in the custom `hitArea.contains`

3. Add regression coverage

- cover inside/outside/dashed stroke hit geometry at the preset level
- cover canvas selection on a rendered vector stroke in the app

## Validation

- manual/e2e: clicking a rendered vector stroke selects the vector even when
  the stroke sits outside the original path bounds
- unit: dashed and offset stroke hit segments match rendered stroke geometry

## Result

Completed on 2026-03-19.

- Reused rendered stroke geometry for vector custom hit areas so offset and
  dashed strokes are targetable by the same visible path users see on canvas.
- Kept fill hit behavior unchanged while replacing the old max-width
  centerline approximation for gradient-vector stroke hits.
- Added preset-level regression coverage for dashed/outside stroke hit
  geometry and gradient vector outside-stroke hit targeting.

Canonical completed-plan path:
- `docs/ai/apps/asyra-design/plans/completed/vector-stroke-hit-test-plan.md`
