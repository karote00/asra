# Plan: Select Element with Hovered Element Target Directly

## Goal
Improve element selection accuracy by using the currently hovered element (determined by precise geometry-aware hit testing) instead of falling back to bounding box calculations.

## Background
Currently, the selection feature tries to find an element at the mouse position using `elementApis.getElementIdAtClientPos(mouse.position)`, which was previously using bounding box checks. 
The hover detection system has been updated to use Pixi.js's native event system, providing precise geometry-aware hit testing. 

By using the research from the hover system and implementing direct geometry-accurate hit testing in the renderer, we can ensure that when a user clicks on an element they are visually hovering over, that specific element is selected, even if it's within the bounds of another larger element (like an Oval).

## Progress
- [x] Implement geometry-aware hit testing in renderer (Pixi.js `hitTest`)
- [x] Update `getElementIdAtClientPos` in `elementApis` to use accurate hit testing
- [x] Update `selection` feature to use accurate hit testing
- [x] Update `move-elements` feature to use accurate hit testing
- [x] Verification with overlapping elements (e.g. Oval corners)

## Done
I have implemented a solid, geometry-accurate hit testing system:
1.  **Renderer Enhancement**: Added `getElementIdAtClientPos` to the `Render` class in `@asyra/render`. This method uses Pixi.js's native `hitTest` API, which is geometry-accurate (e.g., correctly ignores corners of Ovals).
2.  **API Update**: Updated `elementApis.getElementIdAtClientPos` in `asyra-design` to utilize the new renderer method, effectively removing the legacy bounding-box-based selection.
3.  **Feature Integration**: Modified both `selection` and `move-elements` features to use `snapshot.hoveredElementId` as the primary target and `elementApis.getElementIdAtClientPos` as a reliable, geometry-accurate fallback.
4.  **Bug Fix**: Resolved a `TypeError` where `hitTest` was not found on the renderer events by correctly accessing `rootBoundary.hitTest` and adding safety checks for empty space interactions.
