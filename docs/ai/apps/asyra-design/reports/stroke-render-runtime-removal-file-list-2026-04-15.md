# Report: Stroke Render Runtime Removal File List

**Date:** 2026-04-15  
**Goal:** remove the current product-facing stroke render runtime while keeping
stroke schema, UI/UX, initialization, and property flow intact

## Scope Rule

This file list assumes:

- keep stroke properties, stroke UI, stroke initialization, and stroke schema
- keep vector/path editing UX layers
- remove only the current stroke render / hit / runtime implementation
- do not preserve legacy stroke helper functions inside the new engine

## Safety Rule

This document is not line-number-only guidance.

Line ranges are review aids, not the sole execution contract.

The actual execution targets are:

- symbol-based removal targets
- retained-foundation constraints
- removal verification checklist

If line numbers drift after rebase or refactor, engineers must still remove the
same symbols and satisfy the same verification checklist.

## Decision Summary

The old runtime is centered in two files:

- `packages/preset/src/components/strokes.ts`
- `packages/preset/src/components/geometry-model.ts`

But five additional files must be edited because they currently call into that
runtime:

- `packages/preset/src/components/rectangle.ts`
- `packages/preset/src/components/oval.ts`
- `packages/preset/src/components/frame.ts`
- `packages/preset/src/components/vector.ts`
- `packages/preset/src/components/group.ts`

## New Files To Introduce Before Deletion

These are not legacy runtime. They are extraction targets so the runtime files
can be removed cleanly.

1. `packages/preset/src/components/stroke-render/constants.ts`

- move:
  - `DEFAULT_RECTANGLE_STROKES`
  - `DEFAULT_OVAL_STROKES`
  - `DEFAULT_GROUP_STROKES`
  - `DEFAULT_FRAME_STROKES`
- reason:
  - these are configuration defaults owned by the new stroke render engine
- hard rule:
  - `stroke-render/constants.ts` stores configuration constants only
  - it must not gain render helpers, geometry helpers, or runtime routing
  - do not promote it to a higher-level shared module unless multiple
    non-render-engine modules actually need the same constants

2. path foundation extraction target from `geometry-model.ts`

- move out the pure path foundation that the new engine and vector UX still
  need:
  - `PathGeometry`
  - `buildVectorGeometryModelPath`
  - the pure path helpers those exports depend on
- reason:
  - `geometry-model.ts` currently interleaves retained path foundation and
    legacy dashed runtime

No inline code comments are required for these extraction-only moves.

## Symbol-Based Removal Targets

These symbols must be treated as removal targets even if line numbers drift.

### `packages/preset/src/components/strokes.ts`

Delete these exported or product-facing runtime symbols:

- `RenderableStroke`
- `StrokeHitSegment`
- `ResolvedStrokeGeometryEntry`
- `getRenderableStrokes`
- `getStrokeHitWidth`
- `buildPolylineStrokePathSources`
- `buildStrokeHitSegmentsFromResolvedGeometry`
- `buildResolvedStrokeGeometryFromSources`
- `buildStrokeHitSegmentsFromSources`
- `renderPolylineStrokes`
- `renderResolvedStrokeGeometry`
- `renderStrokeSources`

Delete these internal legacy runtime helpers instead of reusing them:

- `getStrokeJoin`
- `getStrokeMiterLimit`
- `getRenderableStroke`
- `buildClosedStrokePolygons`
- `buildClosedInsideSolidStrokePolygons`
- `buildSolidStrokePolygons`
- all mesh-fill helpers used only by the old stroke runtime

Retain, but move out:

- `DEFAULT_RECTANGLE_STROKES`
- `DEFAULT_OVAL_STROKES`
- `DEFAULT_GROUP_STROKES`
- `DEFAULT_FRAME_STROKES`

### `packages/preset/src/components/geometry-model.ts`

Delete these product-facing dashed runtime entry symbols:

- `computeDashedGeometryPipelineState`
- `resolveDashedGeometryForRender`
- `selectDashedGeometryModelFromPipelineState`
- `selectDashedGeometryModelForRender`
- `createDashedGeometryModel`
- `finalizeDashedGeometryPhase6`
- `applyDashedGeometryPhase6ToPipelineState`
- `buildReadyDashedGeometryPhase6Result`
- `__dashedGeometryModelTestUtils`

Delete the old phase2 fallback behavior, even if symbol boundaries move:

- any product-facing routing that resolves dashed render output from phase2
  materialization
- any product-facing routing that mixes phase2 preview completion and phase6
  final completion

Retain, but extract:

- `PathGeometry`
- `buildVectorGeometryModelPath`
- only the pure path helpers those retained exports require

### `packages/preset/src/components/vector.ts`

Delete these legacy stroke-runtime dependencies:

- imports of `buildResolvedStrokeGeometryFromSources`
- imports of `buildStrokeHitSegmentsFromResolvedGeometry`
- imports of `renderResolvedStrokeGeometry`
- imports of `ResolvedStrokeGeometryEntry`
- imports of `StrokeHitSegment`

Delete these runtime concepts:

- `VectorStrokeGeometryCache`
- `strokeHitSegments` fields that exist only for the old stroke runtime
- `isPointNearStrokeHitSegments(...)`
- `getResolvedStrokeGeometry()`
- stroke-derived hover hit branch
- stroke-derived render call

## File List

### 1. `packages/preset/src/components/strokes.ts`

Action:

- full runtime rewrite target

What to remove:

- delete lines `1-1549`

What to keep:

- do **not** keep these lines in this file
- instead, move lines `1551-1554` into `stroke-render/constants.ts`

Why remove:

- lines `1-1549` are the old stroke render adapter and render runtime:
  - `RenderableStroke`
  - old `dash/gap` scalar render model
  - `miterAngle -> miterLimit` legacy conversion
  - hardcoded `cap: 'round'`
  - solid stroke polygon builder
  - dashed render routing via old geometry model helpers
  - mesh fill of stroke polygons
  - stroke hit-segment generation built on the old runtime

Why keep defaults:

- lines `1551-1554` are shape defaults, not render logic

Need comment:

- no

Implementation note:

- do not try to carve out individual helpers from this file for reuse
- extract defaults first, then delete the runtime body

### 2. `packages/preset/src/components/geometry-model.ts`

Action:

- full legacy dashed runtime rewrite target, but **not** a blind file delete

What to keep:

- retained path foundation must be extracted first:
  - line `35-40`: `PathGeometry`
  - line `6955`: `buildVectorGeometryModelPath`
  - plus the pure path helpers those exports depend on

Retained foundation may **not**:

- read stroke props
- branch on `solid` vs `dashed`
- compute stroke-visible geometry
- expose product-facing stroke render selection
- preserve fallback behavior from the dashed runtime
- cache or emit phase2 / phase6 render completion state

What to remove after extraction:

- remove the old product-facing dashed render runtime
- minimum explicitly identified legacy render entry block:
  - lines `10850-11094`
- remove the dashed test-utility export block:
  - lines `11096-end`

Why remove:

- this region exposes the old dashed render pipeline and mixed fallback path:
  - `computeDashedGeometryPipelineState`
  - `resolveDashedGeometryForRender`
  - `selectDashedGeometryModelForRender`
  - `createDashedGeometryModel`
  - phase2 / phase6 mixed completion behavior

Why not micro-delete the entire file by line range:

- this file heavily interleaves pure path foundation and legacy dashed runtime
- the safe plan is:
  1. extract retained path foundation
  2. delete the remaining dashed runtime
  3. rebuild the new engine from the new plan

Need comment:

- no

### 3. `packages/preset/src/components/rectangle.ts`

Action:

- partial deletion and import rewrite

Delete:

- lines `4-8`
  - old stroke runtime imports
- lines `10-21`
  - `buildRectangleStrokeSources(...)`
- lines `56-60`
  - `renderStrokeSources(...)` call inside `renderStrategy`

Keep:

- stroke property registration and `DEFAULT_RECTANGLE_STROKES`, but import that
  default from `stroke-render/constants.ts`

Why remove:

- these lines are the old shape-to-legacy-stroke-runtime adapter

Need comment:

- no

### 4. `packages/preset/src/components/oval.ts`

Action:

- partial deletion and import rewrite

Delete:

- lines `4-8`
  - old stroke runtime imports
- lines `10-24`
  - `buildOvalStrokeSources(...)`
- lines `66-70`
  - `renderStrokeSources(...)` call inside `renderStrategy`

Keep:

- stroke property registration and `DEFAULT_OVAL_STROKES`, imported from
  `stroke-render/constants.ts`

Why remove:

- these lines are the old shape-to-legacy-stroke-runtime adapter

Need comment:

- no

### 5. `packages/preset/src/components/frame.ts`

Action:

- partial deletion and import rewrite

Delete:

- lines `4-8`
  - old stroke runtime imports
- lines `10-21`
  - `buildFrameStrokeSources(...)`
- lines `57-61`
  - `renderStrokeSources(...)` call inside `renderStrategy`

Keep:

- stroke property registration and `DEFAULT_FRAME_STROKES`, imported from
  `stroke-render/constants.ts`

Why remove:

- these lines are the old shape-to-legacy-stroke-runtime adapter

Need comment:

- no

### 6. `packages/preset/src/components/group.ts`

Action:

- import-source rewrite only

Delete:

- none required inside the component body

Change:

- line `3`
  - stop importing `DEFAULT_GROUP_STROKES` from `./strokes`
  - import it from `stroke-render/constants.ts`

Why change:

- `group.ts` depends only on the stroke default constant, not on render logic

Need comment:

- no

### 7. `packages/preset/src/components/vector.ts`

Action:

- partial deletion and import rewrite

Delete:

- lines `17-23`
  - old stroke runtime imports
- lines `95-112`
  - legacy stroke-hit / stroke-geometry cache fields and types
- lines `790-810`
  - `isPointNearStrokeHitSegments(...)`
- lines `1233-1261`
  - `getResolvedStrokeGeometry()` built on old runtime output
- lines `1267-1313`
  - old stroke-based hover hit-area branch
- lines `1520-1521`
  - `renderResolvedStrokeGeometry(...)` draw call

Keep:

- vector path construction
- fill rendering
- vector point / segment / handle UX
- `buildVectorGeometryModelPath` usage once it points to extracted path
  foundation

Why remove:

- `vector.ts` is not only rendering old stroke polygons; it also derives hover
  hit geometry from the same old runtime
- if this block is left behind, the app will still depend on the removed legacy
  stroke geometry path

Need comment:

- no, unless an interim no-op path is introduced to keep compilation green
- if an interim no-op is introduced, use one short comment only:
  - `Stroke render/hit temporarily disabled pending canonical stroke engine cutover.`

Temporary no-op hard limits:

- it must not call any legacy stroke runtime symbol
- it must be compile-only, not behaviorally compatible with the old runtime
- it must include an explicit owner and removal condition in the task/plan that
  introduced it
- it must not survive past the phase where canonical vector stroke render/hit is
  introduced

## Not In Scope For This Removal Pass

These files are **not** render-runtime targets and should remain in place for
now:

- `packages/utils/src/propsManager/strokes.ts`
- `apps/asyra-design/src/common-apis/strokes.ts`
- `packages/preset/src/props/register-property-schemas.ts`
- `packages/preset/src/props/components/stroke-component.ts`
- `packages/preset/src/props/components/strokes-component.ts`
- `apps/asyra-design/src/properties/strokes/*`

Reason:

- they belong to schema, patch flow, UI, or initialization, not the current
  render runtime

Important:

- out of scope for deletion does **not** mean semantically validated for the new
  engine
- these files remain only because they are not current runtime execution targets

## Order Of Work

1. create `stroke-render/constants.ts` and move shape defaults out of `strokes.ts`
2. extract retained path foundation out of `geometry-model.ts`
3. delete old runtime body from `strokes.ts`
4. remove old dashed render entrypoints from `geometry-model.ts`
5. rewire `rectangle.ts`, `oval.ts`, `frame.ts`, `group.ts`
6. remove old vector stroke render/hit blocks from `vector.ts`
7. only then start wiring the new stroke render engine in

## Execution Requirement

Execute removal in small, reviewable steps:

1. extract defaults
2. extract retained path foundation
3. remove `strokes.ts` runtime
4. remove `geometry-model.ts` dashed runtime
5. rewire shape components
6. remove vector legacy stroke render/hit
7. verify against the removal checklist before any new engine wiring begins

## Removal Verification Checklist

A file or slice is considered cleanly detached from the legacy stroke runtime
only if all checks below pass.

### Import checks

- no imports from removed legacy stroke runtime entry points remain
- no transitive import path reintroduces removed runtime symbols through
  convenience barrels

### Runtime checks

- no product-facing render routing depends on legacy stroke runtime
- no hit-test path depends on legacy stroke-derived geometry
- no fallback hook depends on legacy stroke runtime
- no cache field stores legacy stroke-derived geometry for product use

### Shape / vector checks

- shape components compile and behave without legacy stroke render imports
- shape components do not depend on stroke-render-derived bounds or side effects
- vector hover/hit no longer depends on old stroke hit geometry

### Temporary placeholder checks

- any temporary no-op path is compile-only
- any temporary no-op path has an explicit owner and removal condition
- no temporary no-op calls legacy helpers to simulate compatibility

### Documentation checks

- comments do not instruct future engineers to reuse removed legacy helpers
- docs do not describe removed runtime behavior as current architecture

## Final Note

This list is intentionally strict:

- keep defaults
- keep schema / UI / initialization
- delete old render helpers
- delete old render routing
- delete old render-derived hit geometry

The new engine should grow from the new plan, not from leftover helper reuse.
