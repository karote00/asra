# Execution Plan: Legacy Stroke Code Removal

## Purpose

This document defines how legacy stroke code exits the product as the new stroke
engine is promoted.

It is a formal companion to:

- `docs/ai/apps/asyra-design/plans/professional-stroke-engine-plan.md`
- `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

It exists to prevent long-term dual-path stroke behavior.

## Required Inputs

This plan depends on the current inventory snapshot:

- `docs/ai/apps/asyra-design/reports/legacy-stroke-inventory-2026-04-15.md`

The inventory must be refreshed whenever a new legacy slice is discovered.

## Removal Principles

1. Remove legacy code by behavior slice, not by file boundary alone.
2. Every promoted new-engine slice must map to one legacy exit milestone.
3. Comparison mode is temporary and must have a close condition.
4. Silent fallback from a promoted slice back to legacy runtime is forbidden.
5. Removal is complete only when runtime, tests, debug surfaces, and docs no
   longer depend on the legacy slice.
6. "Deprecated but still present" does not count as removal.

## Removal Completion Definition

A legacy slice is considered removed only if all of the following are true:

- runtime no longer routes the promoted slice through the legacy implementation
- tests no longer use the legacy implementation as the product-facing oracle for
  that slice
- debug surfaces no longer visualize or depend on the legacy implementation for
  that slice
- build output no longer includes the legacy routing branch for that slice
- relevant docs and manuals no longer describe the legacy behavior as current
  architecture
- code has been physically deleted, not only hidden behind flags

## Legacy Slice Mapping

| New Slice | Legacy Slice | Current Legacy Surface | Removal Timing |
| --- | --- | --- | --- |
| `solid + center + solid` | polyline-only solid stroke renderer | `packages/preset/src/components/strokes.ts` `buildSolidStrokePolygons(...)` path | after Phase 1 promotion |
| `solid + inside/outside + solid` | legacy constrained solid clipping path | `packages/preset/src/components/strokes.ts` closed/open stroke polygon builders | after Phase 4B promotion |
| `dashed + center + solid` | phase2-only dashed materialization fallback | `packages/preset/src/components/geometry-model.ts` `createDashedGeometryModel(...)` + phase2 materialization route | after Phase 4A promotion |
| `dashed + inside/outside + solid` | mixed phase2/phase6 dashed render selection | `selectDashedGeometryModelForRender(...)` completion fallback | after Phase 4C promotion |
| `round` join / cap | hardcoded round-cap legacy behavior | `packages/preset/src/components/strokes.ts` hardcoded `cap: 'round'` plus local round cap helpers | after Phase 5 promotion |
| `gradient` stroke paint | single-color stroke render adapter and paint flattening | `packages/preset/src/components/strokes.ts` color/alpha flattening render path, legacy stroke property model | after Phase 6 promotion |
| variable width | uniform-width-only authored/runtime assumptions | `packages/utils/src/propsManager/strokes.ts`, legacy manuals, UI patch keys | after Phase 7 promotion |

## Removal Phases

### Phase R0. Inventory

Deliverables:

- legacy module inventory
- slice-to-module mapping
- owner assignment per legacy slice

Gate:

- every known legacy stroke slice is listed in the inventory document
- every legacy slice is mapped to a promotion phase or an explicit defer reason

### Phase R1. Freeze

Rules:

- no new feature work may land in legacy stroke paths
- blocker-only fixes are allowed, but must be annotated as temporary legacy
  maintenance
- docs must stop describing legacy behavior as the target architecture

Gate:

- review rule exists: no feature expansion inside legacy stroke modules

### Phase R2. Dual-Run Comparison

Rules:

- dual-run comparison is allowed only for slices not yet promoted
- mismatch logging must be explicit and bounded
- comparison mode must record:
  - slice identity
  - geometry mismatch type
  - ownership / legality mismatch when relevant
  - bailout reason when relevant

Close condition:

- once a slice is promoted and its gate passes, dual-run comparison for that
  slice must be disabled

### Phase R3. Cutover

Rules:

- product-facing routing must switch to the new engine for the promoted slice
- render, hit-test, and export for that slice must cut over together unless the
  execution plan explicitly blocks one surface
- silent routing back to legacy code after cutover is forbidden

Gate:

- promoted slice passes correctness, performance, and bailout contracts on the
  new engine

### Phase R4. Delete

Required deletions per removed slice:

- runtime routing branches
- module-local helper paths that only support the removed legacy slice
- legacy comparison adapters for that slice
- tests whose only purpose is to preserve the legacy product path
- obsolete debug overlays bound only to legacy geometry
- obsolete manuals that describe old authored/runtime semantics as current

Gate:

- code has been physically removed from the repository for that slice

### Phase R5. Lock

Rules:

- CI must reject reintroduction of removed legacy slice routing
- docs must link to the new architecture/execution plan only
- new regression tests must lock the cutover behavior

Gate:

- removal lock checks are active in CI or review automation

## Comparison Mode Policy

Comparison mode may exist only while a slice is in R2.

Required constraints:

- it must have an explicit slice list
- it must have an explicit shutoff phase
- it must not become the normal product path
- it must not be used as a hidden fallback for promoted slices

## Behavior-Slice Removal Schedule

### After Phase 1 Promotion

Remove:

- product routing for legacy center-solid polyline stroke rendering

Keep temporarily:

- constrained solid path helpers still needed by unpromoted slices

Current status:

- completed on `2026-04-17`
- product-facing legacy center-solid routing has been removed
- old `packages/preset/src/components/strokes.ts` has been deleted
- old `packages/preset/src/components/geometry-model.ts` has been deleted
- retained foundation now lives under `packages/preset/src/components/stroke-render/`
- shape/vector routing no longer calls legacy stroke runtime symbols for the
  promoted Phase 1 slice

### After Phase 4A Promotion

Remove:

- phase2-only dashed-center fallback path for promoted center-dashed slices
- product-facing use of `createDashedGeometryModel(...)` as the default dashed
  result for center slices

### After Phase 4B Promotion

Remove:

- product-facing legacy constrained solid clipping path

### After Phase 4C Promotion

Remove:

- mixed phase2/phase6 dashed constrained routing for promoted constrained dash
  slices

### After Phase 5 Promotion

Remove:

- local hardcoded round-cap and round-join assumptions that bypass canonical
  join / cap policy

### After Phase 6 Promotion

Remove:

- single-color-only stroke render assumptions
- legacy stroke paint flattening hacks on promoted slices

### After Phase 7 Promotion

Remove:

- uniform-width-only authored/runtime assumptions for promoted slices
- legacy `dash/gap/miterAngle`-only data-model documentation and adapters

## Removal Gates

Each legacy slice may be deleted only after all slice gates below pass:

1. correctness gate
- promoted slice passes geometry, ownership, legality, render, and regression
  locks

2. performance gate
- promoted slice passes the execution-plan performance thresholds

3. bailout gate
- bailout behavior is explicit and product-consistent for that slice

4. documentation gate
- manuals, plans, and API docs no longer point users or engineers toward the
  removed legacy path

## Removal Lock Checks

Required lock checks after deletion:

- no new call sites may be added to removed legacy entry points
- no new tests may assert removed legacy behavior as the desired product path
- no new docs may describe removed legacy semantics as current architecture

## Deliverables

This removal plan is complete only when:

- every promoted slice has a matching legacy exit milestone
- inventory, cutover, deletion, and lock steps are defined
- no long-term dual-path stroke runtime remains
