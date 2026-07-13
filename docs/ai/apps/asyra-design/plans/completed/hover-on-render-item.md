# Plan: Hover on Render Item Implementation (Updated)

Previously, hover detection was based solely on the bounding box (rectangle) of elements. This prevented selecting elements behind others even if they weren't visually overlapping.

This plan implements precise hit testing by leveraging Pixi.js's native event system.

## Proposed Changes

### 1. `@asyra/render` Enhancements
- Normalize renderer feedback by publishing `render.pointer.hover` and `render.pointer.leave` events via the `EventBus`.
- Added `containsPoint` helper to `Render` class with correct coordinate space conversion (`toLocal`) for manual hit testing re-evaluation.

### 2. `apps/asyra-design` Hover Feature
- Upgraded `hover-element` feature to listen to `EventTypes.POINTER_HOVER` and `EventTypes.POINTER_LEAVE`.
- Shifted the source of truth for hover state from active polling (mouse move) to passive event-driven updates from the rendering engine.
- Fixed coordinate space bug in `isPointInsideElement` to ensure `reEvaluate` (used during deletions or mode changes) is also precise.

## Implementation Steps

### Step 1: Coordinate Space Correction
1. Modify `packages/render/src/layers/scene/render-layer.ts`:
   - Added `containsPoint` using `element.toLocal(point, this.currentWorkspace)` to correctly map workspace coordinates to element geometry.

### Step 2: Event-Driven Hover Feature
1. Modify `apps/asyra-design/src/features/hover-element/index.ts`:
   - Added `hover-element-render-hover` and `hover-element-render-leave` features.
   - Removed redundant `execution` logic from the `INPUT_MOUSE_MOVE` feature.

## Verification
- Rect, Oval, and Vector elements with overlapping bounds but distinct geometries now hover correctly.
- Hovering over transparent corners of an Oval correctly hits elements behind it.
- Re-evaluation (e.g. after deletion) uses the precise `containsPoint` helper.
