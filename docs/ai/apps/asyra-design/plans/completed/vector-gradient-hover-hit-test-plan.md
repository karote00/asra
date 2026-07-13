# Plan: Vector Gradient Hover Hit Test

Vector elements with gradient fills currently hover across the full bounds
because the gradient render path draws a bounding rectangle for rasterized
even-odd fills. This plan restores geometry-accurate hover for gradient-filled
vectors while keeping existing stroke and non-gradient behavior unchanged.

## Proposed Changes

1. Update the vector render strategy to provide a custom hit area when gradient
   fills are active, using vector geometry (fill + stroke) rather than the
   bounding rectangle.
2. Cache flattened segment data for hit testing to avoid recomputing on every
   pointer event.
3. Clear custom hit areas when gradient fills are not active so normal Pixi
   hit testing remains the default.

## Implementation Steps

1. Add helper functions in `packages/preset/src/components/vector.ts` to
   compute point-to-segment distance and determine if a point is inside
   a vector fill or near its stroke.
2. When gradient fills are active, build flattened segments once per render
   pass, attach a `hitArea.contains` implementation that checks fill/stroke,
   and store segment key maps for reuse.
3. Ensure `hitArea` is reset to `null` on non-gradient render paths to avoid
   stale geometry references.

## Verification

- Hovering a gradient-filled vector only highlights when the pointer is over
  the actual fill or stroke, not empty bounds.
- Hovering non-gradient vectors remains unchanged.
- Hover detection continues to work while editing vector paths or dragging.

## Result

Completed on 2026-03-17.

- Added geometry-aware hit testing for gradient-filled vectors so hover follows
  fill/stroke geometry instead of bounding rectangles.
- Cached flattened segments for hover hit testing to avoid redundant geometry
  work across pointer events.
- Reset hit areas on non-gradient vectors to preserve default Pixi hit testing.

Canonical completed-plan path:
- `docs/ai/apps/asyra-design/plans/completed/vector-gradient-hover-hit-test-plan.md`
