# Report: Legacy Stroke Inventory

**Date:** 2026-04-15  
**Scope:** current stroke runtime, authored model, manuals, and product-facing
stroke routing that predate the new canonical stroke architecture

## Purpose

This inventory identifies the legacy stroke surfaces that must be removed or
rewritten as the new stroke engine is promoted.

It is the source inventory for:

- `docs/ai/apps/asyra-design/plans/legacy-stroke-code-removal-plan.md`

## Inventory Summary

The current legacy surface falls into six groups:

1. legacy authored data model
2. legacy render adapter model
3. legacy solid stroke runtime
4. legacy dashed fallback/runtime selection
5. legacy stroke paint assumptions
6. legacy manuals and documentation

## Group 1. Legacy Authored Data Model

### A1. `StrokeAttrs` uses fixed dash/gap and miterAngle-only semantics

File:

- `packages/utils/src/propsManager/strokes.ts`

Observed legacy traits:

- `dash: number`
- `gap: number`
- `miterAngle: number`
- no pattern array
- no dash offset
- no explicit cap field
- no width profile
- no gradient stroke paint model

Why this is legacy:

- the new architecture requires pattern arrays, offset-capable dash semantics,
  width profiles, and a paint model separated from geometry

Removal/cutover target:

- Phase 6 through Phase 7

### A2. UI stroke patch layer is still tied to the old stroke schema

Files:

- `apps/asyra-design/src/common-apis/strokes.ts`
- `apps/asyra-design/src/constants/strokes.ts`

Observed legacy traits:

- patch flow still assumes the old `StrokeAttrs` shape
- field writes are scoped to the current `dash/gap/miterAngle` model

Removal/cutover target:

- after the new authored stroke schema is promoted into UI and property writes

## Group 2. Legacy Render Adapter Model

### B1. `RenderableStroke` still flattens authored stroke into a legacy render adapter

File:

- `packages/preset/src/components/strokes.ts`

Observed legacy traits:

- `RenderableStroke` stores `dash` and `gap` as scalars
- `getStrokeMiterLimit(...)` converts `miterAngle` into `miterLimit`
- `getRenderableStroke(...)` hardcodes `cap: 'round'`
- paint is flattened to `color` + `alpha`

Why this is legacy:

- the new architecture requires canonical authored stroke data, canonical
  geometry packets, and separate paint packets
- hardcoded round caps and single-color flattening are incompatible with the new
  architecture

Removal/cutover target:

- Phase 5 for cap/join behavior
- Phase 6 for paint separation
- Phase 7 for width model removal

## Group 3. Legacy Solid Stroke Runtime

### C1. Solid stroke still uses a separate local polygon builder

File:

- `packages/preset/src/components/strokes.ts`

Observed legacy traits:

- `buildResolvedStrokeGeometryFromSources(...)` routes solid strokes to
  `buildSolidStrokePolygons(...)`
- this is a separate runtime branch from dashed stroke geometry
- the solid path is still built from sampled points / polyline-style local
  helpers

Why this is legacy:

- the new architecture requires solid and dashed to share one canonical geometry
  architecture, not parallel solid-vs-dashed engines

Removal/cutover target:

- Phase 1 for center solid
- Phase 4B for constrained solid

### C2. Closed/open solid polygon helpers are still product-facing

File:

- `packages/preset/src/components/strokes.ts`

Observed legacy traits:

- local helpers build open/closed stroke polygons directly inside the renderer
- the renderer owns geometry decisions instead of consuming final canonical
  geometry packets

Removal/cutover target:

- after solid slices are promoted through the new geometry pipeline

## Group 4. Legacy Dashed Fallback And Mixed Routing

### D1. Product-facing dashed render still allows a phase2-only fallback model

Files:

- `packages/preset/src/components/strokes.ts`
- `packages/preset/src/components/geometry-model.ts`

Observed runtime:

- `buildResolvedStrokeGeometryFromSources(...)` uses:
  - `selectDashedGeometryModelForRender(...) ?? createDashedGeometryModel(...)`
- `createDashedGeometryModel(...)` returns `materializeDashedGeometryPhase2Model`
- `selectDashedGeometryModelForRender(...)` may still resolve at:
  - `completionPhase: 'phase2'`
  - or `completionPhase: 'phase6'`

Why this is legacy:

- the new execution plan requires promoted slices to cut over completely instead
  of staying on a mixed phase2/phase6 product path

Removal/cutover target:

- Phase 4A for center dashed
- Phase 4C for constrained dashed

### D2. Phase-based completion fallback is still a product-facing routing concept

File:

- `packages/preset/src/components/geometry-model.ts`

Observed runtime:

- `resolveDashedGeometryForRender(...)`
- `selectDashedGeometryModelFromPipelineState(...)`
- `buildReadyDashedGeometryPhase6Result(...)`
- `materializeDashedGeometryPhase2Model(...)`

Why this is legacy:

- once a slice is promoted, the product path must consume the canonical final
  geometry family, not switch between phase2 preview materialization and later
  phase finalization

Removal/cutover target:

- slice by slice, following the removal plan

## Group 5. Legacy Stroke Paint Assumptions

### E1. Stroke paint is still single-color render state

File:

- `packages/preset/src/components/strokes.ts`

Observed legacy traits:

- stroke render path uses `color` and `alpha`
- no gradient stroke paint packet
- paint is prepared inside the geometry-oriented render adapter

Why this is legacy:

- the new architecture requires final visible stroke geometry plus independent
  paint-field resolution

Removal/cutover target:

- Phase 6

## Group 6. Legacy Manuals And Docs

### F1. Stroke manuals still describe the old data model as current

Files:

- `docs/ai/apps/asyra-design/manuals/strokes/02-data-model.md`
- `docs/ai/apps/asyra-design/manuals/strokes/09-per-shape-integration.md`

Observed legacy traits:

- manuals document `dash: number`, `gap: number`, `miterAngle`
- manuals describe `RenderableStroke` with hardcoded round cap behavior
- manuals describe self-intersecting stroke overlap as intentional alpha blend,
  which does not reflect the new ownership / legality architecture target

Why this is legacy:

- these manuals will mislead implementation and review once the canonical stroke
  architecture is in flight

Removal/cutover target:

- rewrite or retire during Phase 1 through Phase 7, aligned to promoted slices

## Group 7. Transitional Caches And Adapters

### G1. Dashed pipeline caches are transitional, not guaranteed final architecture

File:

- `packages/preset/src/components/geometry-model.ts`

Observed transitional surfaces:

- `dashCandidateRenderGeometryCache`
- `dashCandidateRenderSourceModelCache`
- `dashCandidateLegalOwnerDomainCache`
- `dashedGeometryPhase6ResultCache`
- `dashedGeometryPipelineStateCache`

Status:

- not every cache listed here is legacy by definition
- however, each cache must be revalidated against the final canonical stage
  boundaries before the corresponding legacy slice can be declared removed

Removal/cutover target:

- validate per promoted slice
- delete any cache that exists only to support mixed old/new routing

## Comparison-Mode / Temporary Surface Inventory

### H1. Existing dashed comparison and screenshot suites are transitional validation surfaces

Files:

- `apps/asyra-design/e2e/reference-dashed-stroke-rendering.spec.ts`
- `apps/asyra-design/e2e/reference-dashed-stroke-completeness.spec.ts`
- `apps/asyra-design/e2e/reported-dashed-stroke-sharp-corners.spec.ts`

Status:

- these suites are not automatically removable
- they remain valid while the promoted slice still needs regression coverage
- however, any assertion that preserves the old product path instead of the new
  architecture must be retired during cutover

## Highest-Risk Legacy Surfaces

These are the highest-risk legacy surfaces because they allow mixed product
behavior:

1. `packages/preset/src/components/strokes.ts`
- mixed solid-vs-dashed runtime branching
- old render adapter model
- hardcoded round-cap assumption

2. `packages/preset/src/components/geometry-model.ts`
- phase2/phase6 mixed completion routing
- dashed fallback materialization path

3. `packages/utils/src/propsManager/strokes.ts`
- old authored schema still shaping UI and runtime assumptions

4. stroke manuals in `docs/ai/apps/asyra-design/manuals/strokes/`
- still teaching the old stroke model as current behavior

## Inventory Exit Condition

This inventory is complete only if:

- every legacy stroke slice is mapped to a runtime or documentation surface
- every listed surface has a cutover target phase
- every promoted slice can point to the inventory row that must exit next
