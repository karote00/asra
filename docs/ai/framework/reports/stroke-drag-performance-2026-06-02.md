# Stroke Drag Performance Report - 2026-06-02

## Summary

This report records the current vector point/control drag performance work for the stroke renderer. Geometry correctness remains the first gate; performance changes were only retained when focused stroke tests stayed green and the change did not introduce preview-only rendering, hidden strokes, or reduced stroke detail.

Current status:

- Real app drag performance is now roughly in the 60-120 fps range.
- The latest browser E2E still does not meet the 120 fps target at p95.
- CPU-only geometry/render pipeline is close to the 120 fps budget, but real browser render/flush and paint scheduling remain the current bottleneck.

## Latest Measurements

Unit/profile gates:

- CPU-only drag profile:
  - Worst p95: about `8.68ms`
  - Worst average: about `6.69ms`
- Fake full pipeline profile:
  - Typical worst p95 after retained changes: about `9-10ms`, with noisy runs above that
  - The fake pipeline is useful for regression detection, but it does not include real Pixi/browser paint cost.

Browser E2E:

- Spec: `apps/asyra-design/e2e/stroke-drag-render-performance.spec.ts`
- Base URL: `http://localhost:3000`
- Latest key results:
  - `productRenderObserved === true`
  - `visualChanged === true`
  - No preview-only replacement for point/control drag product rendering
  - `render-layer:strategy:vector` p95: about `15.5ms`
  - `render:flush-frame` p95: about `16.3ms`
  - Approximate p95 fps: `61-65 fps`
  - Representative average render flush was around `9.3ms`, roughly `107 fps`

Interpretation:

- Average interaction is much better than before, but p95 frame consistency is still below the 120 fps target.
- Browser E2E burst metrics show multiple complete product renders can occur before a small number of observed paint frames. That points to render scheduling/coalescing as a larger remaining opportunity than small geometry micro-optimizations.

## Retained Changes

### Geometry Correctness Repairs Kept

- Solid outside constrained stroke no longer downsamples the fill cutout mask for the visible exterior render mask. This fixed high-zoom gaps along source segments, including the canonical star outside solid cases.
- Dashed open terminal square/round cap coverage now includes terminal overhang geometry for true open path endpoints.
- Dashed product-final source-path rendering preserves source-vertex/cap ownership rules and does not restore the legacy `boundary-terminal-join` path.
- Native center solid faces are filtered only for render entries where appropriate, not before export/hit/collapse data.

### Resolved Vector Geometry / Source Path Data

- `PathGeometry` now carries reusable source segment distance ranges and sampled segment distance data.
- Resolved vector geometry can reuse segment distance metadata instead of repeatedly deriving it from sampled points.
- Source path slicing/interpolation uses binary-search helpers over cumulative distances instead of repeated linear scans in hot paths.
- Segment records include revision keys used by exact internal caches.

### Dashed Product-Final Cache/Data Improvements

- Source-path ribbon frame cache keys use segment revision identity and sampling settings.
- Source-path final range polygon cache remains exact and keyed by segment revision, range, stroke position/width/cap, round-cap ownership, and sampling settings.
- Product visual normalization has an exact clean-input fast path when polygon bounds prove no overlap.
- Constrained dashed runtime diagnostics are collected in one pass.

### Render Projection / Final Face Improvements

- Constrained dashed product render projection groups faces by stable owner/stroke identity and only uses exact arrangement/union when overlap requires it.
- Non-overlapping constrained dashed product faces can be merged without exact arrangement.
- Filled-face boundary roles avoid unsafe direct-union shortcuts.
- Render projection arrangement results are cached by exact candidate geometry signatures and backend signature.

### Render Layer / Mesh Improvements

- Mesh projection updates reuse the existing Pixi `MeshGeometry` object and update buffers in place instead of replacing the whole mesh geometry object.
- Render requests made during layer updates are coalesced into the current frame where possible.
- Scene-tree computed render data uses a mutable mirror so repeated computed updates do not require rebuilding a full render snapshot from scratch each time.
- Mesh projection now uses a convex polygon fan-triangulation fast path and keeps concave polygons on the Earcut path.
- Mesh projection unit tests now cover convex fast path behavior, concave fallback behavior, and in-place geometry reuse.

### E2E/Performance Assertions

- The drag render performance E2E now asserts product render per render frame instead of relying on paint-window ratios that can be distorted by browser paint scheduling.
- E2E still asserts product rendering and visible changes during point/control drag.

## Tried And Reverted

These ideas were tested and rejected because they either failed geometry tests or made measured performance worse:

- Self-intersection outer-loop clean-pair skip. It looked redundant but regressed CPU-only and pipeline p95.
- Removing polygon cloning before mesh projection. It reduced allocation in theory but made pipeline runs worse.
- Rendering constrained dashed product-final polygons as mesh instead of the current solid graphics path. This regressed CPU/pipeline metrics.
- Disabling per-interval product-final normalization. This regressed the pipeline.
- Offset ribbon normalization removal. This regressed performance.
- Self-intersection `Map` to indexed-array face lookup rewrite. This regressed performance.
- Source-path range cache LRU refresh simplification. This regressed performance.
- Product visual normalize object-identity cache. It produced no useful hits and regressed performance.
- Dirty-index-only self-intersection pair loop. It caused severe p95 regressions.
- Adaptive flattening attempt. It failed correctness gates and is not currently retained.
- Render projection signature shortcuts that weakened geometry identity. These were reverted when they regressed or risked stale projection behavior.

## Not Yet Adjusted

### Frame-Aligned Product Render Coalescing

Browser E2E burst metrics show repeated complete product renders before a small number of observed paint frames. The next major performance opportunity is to ensure one browser frame applies only the latest pending complete product render for the dragged vector.

Requirements:

- Must still render complete stroke geometry.
- Must not hide strokes.
- Must not use preview geometry.
- Must not skip export/hit/final-face data generation when the committed frame is rendered.
- Must preserve transaction/undo semantics.

### Dirty-Zone Planar Graph Rebuild

Current incremental self-intersection work reuses pair intersection data, but the complete split segments, planar graph, legal faces, and boundary contours are still rebuilt every frame.

Potential next step:

- Keep full rebuild parity tests.
- Build dirty-zone graph splice only for affected segment neighborhoods.
- Fall back to full rebuild on any parity mismatch.

Risk:

- High. This can easily break self-intersection legality and stroke ownership.

### Dash Allocation Rebase

Dash interval topology is still rebuilt through the full source path each frame.

Potential next step:

- Cache dash interval topology by stroke spec and source segment revisions.
- Rebase unchanged interval distances when only prefix lengths changed.
- Recompute dirty segment intervals and adjacent authored vertex join/cap coverage.

Risk:

- Medium to high. Must not mix cap-owned terminals with authored source-vertex joins.

### Render/Pixi Paint Scheduling

Real E2E p95 is dominated by browser/Pixi render/paint timing after CPU geometry becomes close to budget.

Potential next step:

- Audit render dirty flag flow from vector drag event -> computed data mirror -> pending render layer -> Pixi app render.
- Coalesce multiple drag updates that arrive before the next RAF into one complete product render for the latest drag state.
- Preserve immediate visual updates per frame, not per input event.

Risk:

- Medium. Needs E2E proof that stroke remains live and product-rendered during drag.

### Adaptive Flattening Replacement

Fixed sampling remains a cost center. A deterministic adaptive flattening algorithm could reduce point count while preserving exact visual tolerances.

Current status:

- A previous attempt failed correctness gates.

Potential next step:

- Replan from geometry oracles first.
- Use shared sampled geometry for render, hit, and export so paths do not diverge.
- Add per-fixture parity gates before using it in drag.

Risk:

- High. Stroke adherence and smoothness tests must pass first.

## Current Test Gates Used

Focused geometry:

```bash
yarn workspace @asyra/preset vitest run src/__tests__/resolved-vector-geometry-model.test.ts src/__tests__/stroke-canonical-matrix.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/constrained-solid-stroke-packets.test.ts --reporter=basic
```

Render unit tests:

```bash
yarn workspace @asyra/render vitest run src/__tests__/mesh-projection.test.ts src/__tests__/render.test.ts --reporter=basic
```

CPU-only performance:

```bash
ASYRA_STROKE_DRAG_PROFILE=1 ASYRA_STROKE_DRAG_FRAMES=120 yarn workspace @asyra/preset vitest run src/__tests__/stroke-drag-performance.test.ts --reporter=basic
```

Fake full pipeline performance:

```bash
ASYRA_STROKE_DRAG_PIPELINE_PROFILE=1 ASYRA_STROKE_DRAG_PIPELINE_FRAMES=120 yarn workspace @asyra/preset vitest run src/__tests__/stroke-drag-pipeline-performance.test.ts --reporter=basic
```

Browser E2E:

```bash
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL=http://localhost:3000 yarn workspace @asyra/asyra-design test:e2e e2e/stroke-drag-render-performance.spec.ts --reporter=line
```

## Recommended Next Plan

1. Treat current changes as the first stable 60-120 fps checkpoint.
2. Do not continue geometry micro-optimizations without a clear p95 win.
3. Focus next on frame-aligned product render coalescing.
4. Add an E2E counter that proves at most one complete product render is applied per render frame for a single dragged vector.
5. Keep canonical stroke matrix and browser drag E2E as hard gates before any future performance commit.
