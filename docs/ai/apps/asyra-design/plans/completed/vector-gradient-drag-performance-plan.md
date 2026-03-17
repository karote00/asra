# Plan: Improve Vector Drag Performance With Gradient Fills

## Scope

Reduce lag when dragging vector points/handles on gradient-filled vectors without changing post-drag rendering fidelity.

Targets:

- reduce even-odd gradient raster cost during path-editing drag
- keep gradient fill accurate after drag completes
- preserve render-layer and preset/package boundaries

## Completion (2026-03-17)

- outcome: gradient-filled vectors rebuild even-odd fills immediately during drag without breaking fill rule behavior
- outcome: drag-time raster budget is reduced for responsiveness, with full-quality render after drag ends

## Steps

1. Gradient drag fidelity path

- keep even-odd gradient fill during path-editing drag to preserve fill rule
- cap rasterization budget while dragging for responsiveness

2. Post-drag fidelity

- restore full rasterization budget when drag ends so final fill matches geometry
- ensure existing caches and disposal paths remain safe

3. Validation

- manual: drag vector anchors/handles with gradient fills and confirm smoothness + correct final fill

## Validation

- `yarn workspace @asyra/preset test:local` (if existing coverage)
- manual interaction check for vector drag with gradient fills
