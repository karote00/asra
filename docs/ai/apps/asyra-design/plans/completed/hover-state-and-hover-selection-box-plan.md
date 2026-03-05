# Plan: Hover State Sync and Hover Selection Box Geometry

## Scope

Align hover behavior across Asyra Design surfaces:
- canvas hover target
- content panel hover row state
- hover selection box rendering

Target behavior:
- hovering an `oval` shows hover outline on canvas and matching hover state in content panel
- hovering a `vector` shows hover outline following vector segment geometry (not only axis-aligned bounds)

## Steps

1. Hover state data-channel alignment
- keep `hover-element` as the single writer of `hoveredElementId` in system context
- expose `hoveredElementId` as a UI property (observable mirror) for provider/UI consumption
- document state owner/writer/reader updates in app module contracts

2. Content panel sync
- add provider hook for hovered element id
- update `contents` row rendering to apply hover style when row id equals `hoveredElementId`
- keep selected styling precedence deterministic when row is both selected and hovered

3. Selection overlay layer migration
- move selection-box drawing responsibility out of `@asyra/render` built-in `SelectionLayer`
- introduce a registered overlay render layer (preset/app-owned) that draws both:
  - normal selection box
  - hover selection box
- consume selection ids from selection runtime mirrors and hovered id from system context
- keep path-editing guard behavior consistent with current selected-box behavior

4. Hover/selection geometry rendering
- render geometry-following hover outlines for vectors (segment/bezier geometry)
- render geometry-following hover outlines for ovals and rectangles
- fallback to bounds outline for unsupported element types

5. Render package cleanup and compatibility
- remove or deprecate old selection layer path in `@asyra/render` once overlay layer parity is verified
- keep render core focused on scene + viewport primitives, with app behavior overlays registered externally
- update package/app docs if ownership boundary changes

6. Verification and docs
- add/extend app E2E/manual checks for:
  - oval hover outline + content panel sync
  - vector hover segment outline + content panel sync
  - hover clear on empty canvas and after delete
- update app docs: `features/hover-element.md`, `modules/state-contracts.md`, and any UI/provider contract docs touched by implementation

## Validation

- `hoveredElementId` is visibly consistent across canvas and content panel
- hovering vector paths renders segment-following outline (including bezier segments)
- hover overlay does not regress existing selection outline behavior
- `yarn workspace @asyra/asyra-design react:build` passes
- targeted hover-related E2E/manual checks pass

## Result

Completed on 2026-03-06.

- Hover state is synchronized between canvas and content panel, including content-panel-originated hover.
- Selection/hover overlay rendering is app/preset-owned via registered render layer, not built into `@asyra/render`.
- Delete undo/redo selection restoration regression is fixed through selection-event runtime synchronization.
- Selection/hover outline uses shared styling controls (2px stroke, tuned blue).

Canonical completed-plan path:
- `docs/ai/apps/asyra-design/plans/completed/hover-state-and-hover-selection-box-plan.md`
