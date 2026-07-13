# Plan: Gradient Vector Move Drag 120 FPS (Multi-Selection)

## Scope

Reach ~120 FPS while drag-moving vector elements with gradient fills, focusing
on multi-selection scenarios. Single-selection performance is acceptable after
current caching fixes; future work should only apply to multi-selection.

Targets:

- maintain correct final fill rendering after drag ends
- preserve hit testing and undo semantics
- avoid stutters during continuous drag

## Steps

1. Detect multi-selection drag

- gate high-performance drag behavior only when multiple elements are moving
- keep single-selection path on existing behavior

2. Drag-time raster budget

- reduce even-odd gradient raster pixel budget only during multi-selection drag
- restore full raster budget immediately on drag end

3. Optional follow-ups (if needed)

- cache even-odd shapes by topology fingerprint to avoid rebuilds
- batch render updates for multi-selection drag frames

## Validation

- manual: drag-move multiple gradient-filled vectors and confirm smooth motion
  with acceptable drag-time quality
- manual: release drag and confirm final gradients render correctly
