# Plan: Vector Editing Performance Remediation

## Goal

Make drag/edit interactions for dense vectors (50+ points, self-intersections) consistently responsive while preserving correct even-odd fill rendering.

## Context

Vector editing currently recomputes geometry and fill frequently during drag. Dense paths (many flattened segments + intersections) cause visible lag. The goal is to define a staged remediation plan that targets the true hotspots and keeps the render loop responsive.

## Scope

In scope:
- identify the most expensive drag-time workloads
- reduce or defer heavy fill computation during pointer move
- introduce incremental or cached geometry updates
- keep editing feedback accurate enough for real-time preview

Out of scope:
- changing the fill rule (must remain even-odd)
- redesigning the pen tool UX
- new UI features unrelated to performance

## Known Performance Hotspots (Current Baseline)

1. Full fill rebuild inside render strategy  
`/Users/asa/Desktop/workspace/asra/packages/preset/src/components/vector.ts`
2. O(n^2) line intersection splitting  
`/Users/asa/Desktop/workspace/asra/packages/preset/src/components/vector.ts`
3. Curve flattening on every rebuild  
`/Users/asa/Desktop/workspace/asra/packages/preset/src/components/vector.ts`
4. Face extraction + centroid filtering for even-odd  
`/Users/asa/Desktop/workspace/asra/packages/preset/src/components/vector.ts`
5. Render strategy re-run on every property change  
`/Users/asa/Desktop/workspace/asra/packages/render/src/layers/scene/render-layer.ts`
6. Frequent system property + selection updates during drag  
`/Users/asa/Desktop/workspace/asra/apps/asyra-design/src/features/pen-tool/index.ts`
7. Vector path editing overlay redraw cost  
`/Users/asa/Desktop/workspace/asra/packages/preset/src/render-layers/vector-path-editing-render-layer.ts`
8. Selection overlay redraw cost  
`/Users/asa/Desktop/workspace/asra/packages/preset/src/render-layers/selection-overlay-render-layer.ts`
9. Render ticker updates all layers every frame  
`/Users/asa/Desktop/workspace/asra/packages/render/src/render.ts`
10. No segment-level incremental cache for fill geometry  
`/Users/asa/Desktop/workspace/asra/packages/preset/src/components/vector.ts`

## Target Behavior

1. Dragging a point stays responsive at 60 FPS for dense vectors.
2. Fill rebuilds are deferred until pointer release or idle (unless explicitly requested).
3. Editing previews remain accurate enough to guide user intent.
4. Final rendered fill after drag matches even-odd semantics.

## Implementation Slices

1. Instrumentation pass
- measure time spent in fill rebuild, intersection splitting, and overlay rendering
- log rebuild frequency during drag

2. Drag-time fill policy
- suppress heavy fill rebuilds on pointermove
- render cached faces or simplified preview while dragging

3. Incremental geometry caching
- cache flattened segments per vector segment
- update only affected segments during point drag

4. Intersection optimization
- reduce pairwise intersection checks with spatial partitioning or bounding bins
- skip intersection splitting when drag-time preview is active

5. Overlay throttling
- throttle path-editing overlay redraw on drag
- avoid unnecessary selection overlay recompute for non-editing elements

6. Render loop gating
- update only relevant render layers during active drag session

## Success Criteria

- Dense vector drag maintains >= 60 FPS (no multi-frame stalls).
- Drag produces correct final fill after release.
- No regressions in pen/path editing interaction flows.

## Risks

1. Over-throttling can make preview feel inaccurate.
2. Caching can drift from final geometry if invalidation is incomplete.
3. Intersection optimization must preserve even-odd correctness.
