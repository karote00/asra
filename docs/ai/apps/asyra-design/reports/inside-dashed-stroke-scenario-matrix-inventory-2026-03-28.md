# Inside Dashed Stroke Scenario Matrix Inventory

**Date:** 2026-03-28  
**Purpose:** Phase 0 / Phase 1 inventory for the inside dashed stroke priority plan  
**Driving plan:** [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-priority-plan.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-priority-plan.md)

---

## Summary

The current test suite is no longer "ad hoc", but it is also not yet a full
scenario matrix.

Current state:

- **Unit geometry coverage is strong** for `inside + dashed` on the current
  reference samples.
- **Projection/render integration coverage is moderate** and focused on mesh
  reuse, projection updates, and a few stroke-render behaviors.
- **E2E coverage is strong enough as a guard**, but it is still not the right
  place to prove local geometry correctness.

The previous `inside + solid + high-curvature cubic` containment gap is now
covered by a passing integration benchmark. The remaining work is no longer
about missing unit coverage on the main scenario matrix; it is about continuing
to simplify runtime ownership without regressing these gates.

---

## Matrix Axes

### A. Stroke Position

- `center`
- `inside`
- `outside`

### B. Stroke Style

- `solid`
- `dashed`

### C. Source Geometry

- straight segment
- low-curvature cubic
- high-curvature cubic
- multi-segment interval

### D. Topology

- open path
- closed path

### E. Local Scenario

- no corner
- smooth turn
- sharp corner
- acute inside corner
- seam-crossing interval

---

## Test Ownership Inventory

### Layer 1: Unit Geometry

**Primary file:** [/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/geometry-model.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/geometry-model.test.ts)

#### Confirmed Coverage

1. `inside + dashed + single high-curvature cubic + closed + smooth turn`
   - `single-dash high-curvature-turn benchmark: keeps the turning dash at full interval length and tight to segment 44 for dash 20 gap 20`
   - `single-dash high-curvature-turn benchmark: keeps the terminal cap aligned to the ideal round cap arc for dash 20 gap 20`
   - `single-dash high-curvature-turn benchmark: matches the true-offset final face for dash 20 gap 20`
   - `single-dash high-curvature-turn benchmark: keeps the end cap disjoint from the main strip for dash 20 gap 20`
   - `single-dash high-curvature-turn benchmark: keeps single-ownership and complete coverage across the terminal cap interior for dash 20 gap 20`

2. `inside + dashed + multi-segment interval + closed + smooth turn`
   - `reported sample benchmark: crossing dash preserves full interval ownership through the tp-21 smooth turn`
   - `reported sample benchmark: runtime crossing dash should stay close to the multi-segment exact-offset candidate around tp-21`
   - `reported sample benchmark: crossing dash keeps high local body coverage through the tp-21 smooth-corner neighborhood`
   - `reported sample benchmark: crossing dash keeps full-width body ownership across tp-21 before the terminal cap begins`
   - `reported sample benchmark: crossing dash does not treat the tp-21 smooth turn as a wedge-clipped corner`
   - `reported sample benchmark: crossing dash keeps continuous terminal-cap coverage through the tp-21 smooth turn`
   - `reported sample benchmark: crossing dash resolves to a single continuous final face through the tp-21 smooth turn`

3. `inside + dashed + acute inside corner`
   - `keeps the first acute-corner dash as non-overlapping valid polygons for dash 20 gap 20`
   - `keeps acute-corner dash polygons inside the authored corner wedges for dash 20 gap 20`
   - `keeps inside dashed geometry within acute corners on a right triangle`

4. `inside + dashed + full-path interval monotonicity / source-length stability`
   - `oracle 1: keeps dashed intervals monotonic on right triangle`
   - `oracle 1: keeps dashed intervals monotonic on reported sample`
   - `full-path dash benchmark: keeps authored full-dash source lengths uniform for dash 20 gap 20`
   - `full-path dash benchmark: prefers exact-cubic boundary sources for full dashes contained within a single cubic segment`
   - `full-path dash benchmark: keeps inside boundary sources on the current reference sample within exact-cubic or sampled for dash ...`

5. `inside + dashed + full-path completeness`
   - `preserves full-path inside dash completeness on the current reference canary sample`
   - `retains full-path inside dash completeness on the current reference sample for dash 25 gap 20`
   - `retains full-path inside dash completeness on the current reference sample for dash 20 gap 20`

6. `dashed polygon legality`
   - `oracle 3: validates polygon connectivity for all dashed polygons`
   - `oracle 4: validates no self-intersection for all dashed polygons`

#### Coverage Gaps

1. `inside + dashed + seam-crossing interval on closed path`
   - Focused benchmark now exists on a synthetic closed seam square sample.
   - Current status: **covered**

2. `center + dashed + seam-crossing interval`
   - Focused benchmark now exists on a synthetic closed seam square sample.
   - Current status: **covered**

3. `outside + dashed + sharp corner`
   - Focused benchmark now exists on a synthetic sharp square corner sample.
   - Current status: **covered**

4. `inside + solid + high-curvature cubic`
   - Focused integration benchmarks exist in `strokes.test.ts`:
     - finite/non-empty polygon characterization is green
     - simple non-degenerate polygon legality is green
     - strict authored closed-shape containment is green

5. `single-dash high-curvature turn`
   - Focused hard gates are green:
     - curve adherence
     - ideal round-cap alignment
     - true-offset final-face agreement
     - end-cap / strip disjointness
     - terminal-cap interior single-ownership
   - No standalone body-length hard gate remains, because the older
     cap-excluded body metric did not describe a valid region for this sample.

---

### Layer 2: Integration / Projection

**Files:**
- [/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/strokes.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/strokes.test.ts)
- [/Users/asa/Desktop/workspace/asra/packages/render/src/__tests__/mesh-projection.test.ts](/Users/asa/Desktop/workspace/asra/packages/render/src/__tests__/mesh-projection.test.ts)
- [/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/vector-path-editing-render-layer.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/vector-path-editing-render-layer.test.ts)

#### Confirmed Coverage

1. Projection generation
   - `mesh projection: triangulates polygon geometry into indexed mesh data`
   - `mesh projection: renders solid geometry through a pixi mesh projection`

2. Stroke mesh reuse / startup safety
   - `renders centered closed strokes as a single mesh projection`
   - `reuses mesh projections when the rendered stroke geometry and paint are unchanged`
   - `updates an existing mesh projection when only the paint changes`

3. Stroke render helpers
   - `offsets closed stroke centerlines for inside and outside positions`
   - `builds hit segments from the rendered outside stroke geometry`
   - `inside dashed smooth-turn integration: runtime keeps one local polygon across the tp-21 turn neighborhood`
   - `inside solid high-curvature characterization: runtime emits finite non-empty polygons on a closed cubic sample`
   - `inside solid high-curvature characterization: runtime emits simple non-degenerate polygons on a closed cubic sample`

4. Edit-state render-layer behavior
   - `uses a lower-alpha base segment stroke when visible artwork exists`
   - `forces clipped guide strokes to use butt caps`
   - `scales artwork guide trim and clip tolerance from the visible stroke width`
   - `keeps the tp-21 editing guide out of the crossing dash artwork on the reported sample`
   - `keeps the tp-21 selected-segment highlight out of the crossing dash artwork on the reported sample`
   - `keeps the tp-21 adjacent segment guide out of the crossing dash artwork on the reported sample`

#### Coverage Gaps

1. `inside + solid + high-curvature cubic`
   - focused integration benchmarks now cover:
     - finite/non-empty polygon characterization
     - simple non-degenerate polygon legality
     - strict authored closed-shape containment

---

### Layer 3: Reference E2E

**Files:**
- [/Users/asa/Desktop/workspace/asra/apps/asyra-design/e2e/reference-dashed-stroke-rendering.spec.ts](/Users/asa/Desktop/workspace/asra/apps/asyra-design/e2e/reference-dashed-stroke-rendering.spec.ts)
- [/Users/asa/Desktop/workspace/asra/apps/asyra-design/e2e/reference-dashed-stroke-completeness.spec.ts](/Users/asa/Desktop/workspace/asra/apps/asyra-design/e2e/reference-dashed-stroke-completeness.spec.ts)

#### Confirmed Coverage

1. Reference fixture creation via real UI
2. Full-path completeness for:
   - `dash 30 gap 40`
   - `dash 25 gap 20`
   - `dash 20 gap 20`
3. Transition stability:
   - `dash 30 gap 40 -> dash 20 gap 20`
4. Selected vs deselected local diagnostics:
   - local IoU
   - overlay-adjusted IoU
   - overlay occluded ratio
5. Rendering canary:
   - local probes
   - runtime mesh vs raster diagnostics

#### Coverage Gaps

1. No hard e2e gate specifically for:
   - the reported `tp-21` / right-lower crossing dash continuity failure

2. Current selected/deselected diagnostics are still mostly:
   - local mask similarity
   - overlay influence
   not direct:
   - body continuity across the smooth turning corner

---

## Priority Assessment

### Good Enough Today

These areas are already strong enough to support runtime work:

- authored interval allocation
- source-length correctness
- exact-cubic preference on single cubic full dashes
- high-curvature single-turn cap alignment
- polygon legality / non-self-intersection
- e2e fixture creation and full-path completeness

### Not Good Enough Yet

The current unit / integration matrix is green on the priority scenarios.
The next missing confidence now sits above this layer:

1. selected-state visual continuity at the reported `tp-21` turning corner still
   relies on high-level e2e guards rather than dedicated hard-gated visual
   continuity assertions
2. property-panel / edit-state shell stability still belongs to higher-layer
   validation, not the completed unit matrix

---

## Recommended Immediate Actions

### Action 1

Treat the unit/integration matrix as green on the current priority scenarios,
and only then return to higher-layer integration and e2e guards.

---

## Conclusion

The project already has enough unit / integration tests to stop blind
debugging on the priority dashed-stroke scenarios.  
The next stage is no longer expanding the unit matrix; it is proving the same
contracts through stable higher-layer e2e guards.

The next work should therefore be:

1. keep the current unit/integration matrix green while simplifying runtime
2. resume higher-layer integration and e2e work against those stronger gates
