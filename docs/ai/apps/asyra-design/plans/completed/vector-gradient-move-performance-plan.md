# Plan: Improve Gradient Vector Move Drag Performance

## Scope

Improve drag-to-move responsiveness for vector elements with gradient fills
without changing final render fidelity, hit testing, or undo semantics.

Targets:

- avoid rebuilding even-odd gradient fill rasterization when only element
  position changes
- keep topology/fill edits rendering accurately after move drags
- preserve gradient hit testing behavior while moving

## Completion (2026-03-17)

- outcome: drag-to-move no longer stalls when gradients are present
- outcome: gradient fills and hit testing remain correct during drag
- completed plan: `docs/ai/apps/asyra-design/plans/completed/vector-gradient-move-performance-plan.md`

## Steps

1. Cache reuse

- reuse even-odd gradient fill styles when vector topology + fill data are
  unchanged and only position updates occur
- ensure cache invalidation on size, topology, or gradient changes

2. Render safety

- keep drag-suppressed raster limits for path-editing drag paths
- avoid stale cache usage when drag suppression toggles

3. Validation

- manual: drag-move a gradient-filled vector in select mode and confirm smooth
  interaction and accurate final fill
- manual: edit vector points or gradient handles and confirm fills update as
  expected

## Validation

- manual interaction checks for move drag + gradient edits
