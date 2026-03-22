# Plan: Geometry Layer and Dash Gap Completion

**Status:** IN PROGRESS (2026-03-23)  
**Category:** Stroke Rendering Infrastructure (Critical Path)  
**Target Complexity:** High (Multi-layer geometry + complete test coverage)

---

## Executive Summary

Geometry-first dashed stroke rendering is **partially complete** but has known bugs in:

1. **Geometry correctness** - Sharp corners escape wedge bounds; dash sizing inconsistent
2. **Dash gap specification** - Gap size rules undefined; calculation logic broken

This plan defines a **two-phase completion** with explicit oracle validation gates between phases. Only geometry-first methods allowed; no workarounds.

**Key Principle:** Validate each layer before proceeding to the next.

---

## Problem Statement

### Current Gaps

| Issue | Severity | Impact |
|-------|----------|--------|
| Sharp inside corners escape segment wedge | Critical | Visible rendering is incorrect |
| Dash polygons not conforming to segments | Critical | Stroke geometry diverges from authored path |
| Dash sizing inconsistent across path | High | Visual artifacts at curve transitions |
| Gap size rules undefined | High | Gaps may be wrong size or not rendered |
| Gap calculation logic broken | High | Gap rendering may fail silently |

### Why Both Phases Matter

- **Phase 1 (Geometry)** must be solid before Phase 2
- **Phase 2 (Dash Gap)** depends on verified geometry engine
- If Phase 1 fails, Phase 2 is blocked and gaps cannot be correct
- Both must pass all oracles before moving to gradient stroke

---

## Phase 1: Geometry Layer Correctness (Critical Gate)

### Objective

Produce verified polygon geometry for dashed strokes that meets all oracle criteria. This is the **foundation**—if this is wrong, everything above it is wrong.

**Duration:** Days 1-3  
**Exit Criteria:** All geometry oracles pass + tests complete + no regressions

### Phase 1.1: Module Organization

**File:** `packages/preset/src/components/geometry-model.ts` (refactor)

Structure the module to expose:

```typescript
export function buildVectorGeometryModelPath(
  network: VectorNetwork,
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>
): PathGeometry

export function createDashedGeometryModel(
  path: PathGeometry,
  stroke: RenderableStroke
): DashedGeometryModelResult | null

export interface PathGeometry {
  segments: PathSegment[]
  closed: boolean
  totalLength: number
  sampledPoints: Vec2[]
}

export interface DashedGeometryModelResult {
  model: GeometryModel
  hitPolygons: Vec2[][]
  debugParts: GeometryModelDebugPart[]
}

export interface GeometryModelDebugPart {
  startDistance: number
  endDistance: number
  sourcePoints: Vec2[]
  clipPoints: Vec2[]
  renderPoints: Vec2[]
  polygons: Vec2[][]
}
```

**Acceptance:** Module compiles, interfaces defined, debug exports available.

---

### Phase 1.2: Geometry Oracles (Verification Rules)

**File:** `packages/preset/src/__tests__/geometry-model.test.ts` (expand)

Define 5 oracle validators per dash interval:

#### Oracle 1: Dash Interval Monotonicity

**Rule:** Every dash interval's `startDistance < endDistance`  
**Validator:**

```typescript
function validateDashMonotonicity(parts: GeometryModelDebugPart[]): boolean {
  return parts.every((part) => part.startDistance < part.endDistance)
    && parts.every((part, i) => 
      i === 0 || parts[i-1].startDistance < part.startDistance
    )
}
```

**Test:** `'keeps dashed intervals monotonic'`

#### Oracle 2: Sharp Corner Wedge Clipping

**Rule:** All inside-corner dash polygon vertices must lie within the corner's segment half-planes  
**Validator:**

```typescript
function validateInsideCornerWedge(
  polygon: Vec2[],
  corner: Vec2,
  prevTangent: Vec2,
  nextTangent: Vec2,
  strokeWidth: number
): boolean {
  // Every vertex must satisfy both half-plane constraints
  // pseudocode
  return polygon.every(vertex => {
    const prevNormal = perpendicular(prevTangent)
    const nextNormal = perpendicular(nextTangent)
    return dot(subtract(vertex, corner), prevNormal) >= -TOLERANCE
      && dot(subtract(vertex, corner), nextNormal) >= -TOLERANCE
  })
}
```

**Test:** `'keeps inside dashed geometry within acute corners on a right triangle'`

#### Oracle 3: Polygon Connectivity

**Rule:** No dash polygon should have duplicate vertices or degenerate edges  
**Validator:**

```typescript
function validatePolygonConnectivity(polygon: Vec2[]): boolean {
  return polygon.length >= 3
    && !hasConsecutiveDuplicates(polygon)
    && !hasDegenerateEdges(polygon)
}
```

**Test:** Part of geometry module unit tests

#### Oracle 4: Self-Intersection Absence

**Rule:** No polygon should self-intersect (except at corners)  
**Validator:**

```typescript
function validateNoSelfIntersection(polygon: Vec2[]): boolean {
  for (let i = 0; i < polygon.length; i++) {
    const edge1 = [polygon[i], polygon[(i+1) % polygon.length]]
    for (let j = i + 2; j < polygon.length - (i === 0 ? 1 : 2); j++) {
      const edge2 = [polygon[j], polygon[(j+1) % polygon.length]]
      if (segmentsIntersect(edge1, edge2)) {
        return false
      }
    }
  }
  return true
}
```

**Test:** Part of coverage for connected-component validation

#### Oracle 5: Coverage Density

**Rule:** Dashed geometry must cover sufficient area of the target path (no disappearing dashes)  
**Validator:**

```typescript
function validateCoverageDensity(
  polygons: Vec2[][],
  path: PathGeometry,
  dashLength: number
): boolean {
  const rasterPixels = rasterizePolygons(polygons, 160, 160)
  const bounds = getOccupiedBounds(rasterPixels)
  const minCoverageTarget = dashLength * 0.7 // At least 70% of expected
  return bounds.count >= minCoverageTarget
}
```

**Test:** `'keeps dashed intervals monotonic and produces broad visible coverage for the reported sample'`

---

### Phase 1.3: Test Fixtures

**File:** `packages/preset/src/__tests__/geometry-model.test.ts`

Add comprehensive test cases:

1. **Right Triangle with Inside Dash**
   - Test: Sharp 90° angle clipping
   - Fixture: 3-anchor simple triangle
   - Oracle checks: All 5 oracles
   - Expected: All vertices stay inside wedge

2. **Reported Sample (5-Anchor Closed Path)**
   - Test: Complex real-world geometry
   - Fixture: The exact failing case from earlier
   - Oracle checks: All 5 oracles at multiple checkpoints
   - Expected: Broad coverage, monotonic dashes, no self-intersection

3. **Edge Cases**
   - Very short dashes on curved segments
   - Dashes starting/ending at corners
   - Closed self-intersecting paths
   - Translucent vs opaque dashes

**Acceptance:** All test fixtures pass; all oracles green.

---

### Phase 1.4: Exit Gate

**Requirement:** Before proceeding to Phase 2, **ALL** of the following must be true:

- [ ] `yarn workspace @asyra/preset test:local -- geometry-model` returns all ✓
- [ ] Geometry oracles 1-5 all pass on canonical fixtures
- [ ] No self-intersecting polygons detected in rasterized output
- [ ] Reported sample achieves > 70% coverage density
- [ ] No regressions in existing stroke tests
- [ ] `yarn lint:ci` passes for geometry-model.ts
- [ ] `yarn workspace @asyra/preset build:preset` succeeds

**If Phase 1 fails:** Halt Phase 2 and fix geometry bugs until all oracles pass.

---

## Phase 2: Dash Gap Specification & Fixes (Depends on Phase 1 ✓)

### Objective

Define correct gap size rules and fix gap calculation logic so dashes and gaps render with correct proportions.

**Duration:** Days 4-5 (only after Phase 1 passes)  
**Exit Criteria:** Gap oracle passes + all tests complete + no regressions

### Phase 2.1: Gap Specification Rules

**Rule Definition File:** (document in plan or comments)

```typescript
// Gap calculation rules
interface DashGapSpec {
  // Dash length (user-authored or auto-calculated)
  dashLength: number
  
  // Gap length (user-authored or auto-calculated)
  gapLength: number
  
  // Proportional constraints
  minDashLength: number   // e.g., 0.1px minimum
  minGapLength: number    // e.g., 0.1px minimum
  
  // Cycle behavior
  totalCycleLength: number = dashLength + gapLength
}

// Example rules:
// 1. If dashLength + gapLength = 0, no dashes render
// 2. If dashLength < minDashLength, round up or use minimum
// 3. Gap proportions must match 1:1 on closed paths when possible
// 4. Gap must never collapse to zero width on authored path
```

**Acceptance:** Rules document approved; rules implemented in `strokes.ts`.

### Phase 2.2: Gap Rendering Oracle

**File:** `packages/preset/src/__tests__/strokes.test.ts` (expand)

Add gap-specific test:

```typescript
it('renders dashes and gaps with correct proportions on straight and curved segments', () => {
  // Test: Straight line with 20px dash, 10px gap
  // Expected: Dashes are 20px long, gaps are 10px long
  
  // Test: Curved segment with same proportions
  // Expected: Dashes follow curve with same proportions
  
  // Test: Gap never collapses to zero
  // Expected: Gap is always > minGapLength
  
  // Oracle: Measure rendered dash lengths and gap lengths
  // They must match spec within ±1px tolerance
})
```

### Phase 2.3: Exit Gate

**Requirement:** Before moving to Gradient Stroke Fill, **ALL** of:

- [ ] Gap specification rules documented and implemented
- [ ] `yarn workspace @asyra/preset test:local -- strokes` returns all ✓
- [ ] Gap oracle passes on straight and curved segments
- [ ] Phase 1 oracles still pass (no regression)
- [ ] Reported sample renders with correct dash:gap ratio
- [ ] `yarn lint:ci` passes for strokes.ts
- [ ] `yarn workspace @asyra/preset build:preset` succeeds

**If Phase 2 fails:** Debug gap calculation until oracle passes; Phase 1 remains stable.

---

## Complete Test Suite (All Phases)

### Unit Tests

1. **Geometry Module Tests** (`geometry-model.test.ts`)
   - 5 geometr oracles on canonical fixtures
   - Edge-case matrix (short dashes, corners, curves, closed paths)
   - Self-intersection detection
   - Coverage density check

2. **Strokes Module Tests** (`strokes.test.ts`)
   - Straight dashed part rendering
   - Dashed part spanning a corner
   - Bezier curve dashed parts
   - Polygon hit geometry generation
   - Inside dashed corner clipping
   - **New:** Gap proportion tests (Phase 2)

3. **Integration Tests** (`vector-component.test.ts`)
   - Mesh projection of dashed geometry
   - Reported sample rendering (5-anchor case)
   - Gradient-filled vectors with dashed stroke (Phase 2)

### E2E Tests

From `e2e/pen-tool.spec.ts`:

- Create a closed vector with dashed inside stroke
- Verify dashes are visible and correctly proportioned
- Verify gaps are the correct size
- Verify sharp corners render dashes inside the wedge
- Verify dashes disappear as expected at gaps

### Coverage Matrix

| Feature | Unit | Integration | E2E |
|---------|------|-------------|-----|
| Geometry oracle 1-5 | ✓ | ✓ | - |
| Dash sizing | ✓ | ✓ | ✓ |
| Gap proportions | ✓ | ✓ | ✓ |
| Corner clipping | ✓ | ✓ | ✓ |
| Self-intersection | ✓ | - | - |
| Reported sample | ✓ | ✓ | ✓ |

---

## Dependency Chain

```
Phase 1: Geometry ✓ (MUST PASS)
    ↓ (exit gate checks)
Phase 2: Dash Gap (only starts after Phase 1 ✓)
    ↓ (exit gate checks)
Gradient Stroke Fill (can proceed)
```

If Phase 1 fails, Phase 2 is blocked.  
If Phase 2 fails, Gradient is blocked.  
No workarounds allowed to skip phases.

---

## Success Criteria Summary

**Phase 1 Complete:**
- All geometry oracles passing
- Reported sample renders with broad coverage
- Sharp corners correctly clipped
- No self-intersections
- Tests comprehensive and passing

**Phase 2 Complete:**
- Gap sizes match specification
- Dash:gap ratio correct on straight and curved paths
- Gap never collapses to zero
- All Phase 1 oracles still passing

**Ready for Gradient Stroke Fill:**
- Geometry-first rendering stable and verified
- Dash sizes and gaps correct
- All tests passing
- No technical debt from workarounds
