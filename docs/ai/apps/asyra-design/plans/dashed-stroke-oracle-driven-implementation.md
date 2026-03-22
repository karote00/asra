# Oracle-Driven Implementation Plan: Dashed Stroke Geometry-First Rendering

**Status:** Planning (Review Required)  
**Date:** March 23, 2026  
**Category:** Stroke Rendering Infrastructure  
**Target Complexity:** High (Multi-layer geometry + validation)

---

## Executive Summary

This plan replaces the previous failed implementation (by GPT-5 mini) with an **oracle-driven development** approach. Instead of writing 1900 lines of code and hoping it works, we will:

1. Build small, verifiable components
2. Define clear validation rules (oracles) at each layer
3. Only proceed to the next layer when all oracles pass
4. Use the target sample (5-anchor inside dashed stroke) as the canary test

**Key Principle:** Validation before accumulation.

---

## Problems with Previous Approach

| Issue | Impact | How We Fix It |
|-------|--------|--------------|
| No intermediate verification | Bugs only surfaced at render time | Define geometry oracle before mesh projection |
| 1900 lines in one shot | Impossible to isolate failures | Build ~100-line modules with oracle checks |
| No render validation | "Tests pass" ≠ "rendering correct" | Add pixel-level render oracle |
| 5-layer nested logic | Changing one layer breaks all others | Layer 1 must be verified before Layer 2 |

---

## Core Strategy: Oracle-Driven Layers

```
Layer 1: Geometry Generation
├─ Input: PathGeometry + Stroke
├─ Output: Polygon arrays
└─ Oracle: {polygon bounds, corner clipping, connectivity, self-intersection}
    ↓ [Oracle must PASS]
Layer 2: Mesh Projection Integration
├─ Input: Verified polygons
├─ Output: Pixi.js Mesh
└─ Oracle: {render screenshot, mesh vertex count, UV mapping}
    ↓ [Oracle must PASS]
Layer 3: Hit Testing Sync
├─ Input: Same polygons as Layer 2
├─ Output: Hit segments
└─ Oracle: {hit area = render area, point containment consistency}
    ↓ [Oracle must PASS]
Layer 4: Gradient Support (Optional)
├─ Input: GeometryModel + GradientPaint
├─ Output: Textured mesh
└─ Oracle: {gradient sampling correctness}
```

Each layer can only proceed if all previous oracles pass.

---

## Phase 1: Geometry Layer Verification (Critical)

### Objective
Produce verified polygon geometry without any render-layer dependencies. This is the foundation—if this layer is wrong, everything above it is wrong.

### 1.1 Define Debug Export Interface (Day 1)

**File:** `packages/preset/src/components/geometry-model-debug.ts` (new)

```typescript
export interface Vec2 {
  x: number
  y: number
}

export interface DashIntervalDebugData {
  id: string                           // Unique identifier for this dash
  startDistance: number                // Path-space start coordinate
  endDistance: number                  // Path-space end coordinate
  sourcePoints: Vec2[]                 // Exact dash source points (no context padding)
  clipPoints: Vec2[]                   // Context-padded points for clipping
  polygons: Vec2[][]                   // Final visible filled regions
  cornerConstraintsInvolved: string[]  // e.g., ["corner-0", "corner-2"]
  metrics: {
    sourceLength: number               // Arc length of sourcePoints
    polygonArea: number                // Total area of generated polygons
    vertexCount: number                // Total vertices across all polygons
  }
}

export interface PathCornerConstraint {
  id: string                           // e.g., "corner-0", "corner-1"
  distance: number                     // Path-space distance
  corner: Vec2
  prevDirection: Vec2                  // Unit vector of incoming segment
  nextDirection: Vec2                  // Unit vector of outgoing segment
  turnAngle: number                    // Angle between segments (radians)
  isAcute: boolean                     // true if turnAngle < π/2
}

export interface DashedGeometryDebugExport {
  dashIntervals: DashIntervalDebugData[]
  cornerConstraints: PathCornerConstraint[]
  
  metrics: {
    totalPathLength: number
    totalDashCount: number
    totalPolygonArea: number
    maxPolygonBounds: {
      minX: number
      minY: number
      maxX: number
      maxY: number
    }
  }
  
  // Diagnostic information for troubleshooting
  diagnostics: {
    strokePosition: 'inside' | 'center' | 'outside'
    strokeWidth: number
    dashLength: number
    gapLength: number
    pathClosed: boolean
    fulfillmentStatus: 'success' | 'partial' | 'failed'
    failureReason?: string
  }
}

/**
 * Export all geometry generation data for oracle validation.
 * This function must be render-agnostic (no Pixi, no Canvas, no mesh references).
 */
export function exportDashedGeometryDebugData(
  path: PathGeometry,
  stroke: RenderableStroke
): DashedGeometryDebugExport | null
```

**Acceptance Criteria:**
- ✅ Interface defined and documented
- ✅ Function signature matches above
- ✅ No render-layer dependencies

---

### 1.2 Implement Geometry Builder (Days 1-2)

**File:** `packages/preset/src/components/geometry-model.ts` (refactored)

Extract the pure geometry logic (no mesh, no paint, no render):

```typescript
export function buildDashedGeometryPolygons(
  path: PathGeometry,
  stroke: RenderableStroke
): DashedGeometryDebugExport | null
```

**Must include:**
- ✅ Path sampling and dash interval allocation
- ✅ Corner constraint detection
- ✅ Polygon generation (outer/inner boundaries, caps/joins)
- ✅ Inside clipping logic (if `stroke.position === 'inside'`)
- ✅ Debug export with all intermediate data

**Must NOT include:**
- ❌ Mesh triangulation
- ❌ Texture generation
- ❌ Pixi.js calls
- ❌ Paint/color calculations (except for structural info)

**Acceptance Criteria:**
- ✅ Function produces non-empty export for target sample
- ✅ `dashIntervals.length > 0` for target sample
- ✅ Each dash has `polygons.length >= 1`
- ✅ All corner constraints detected

---

### 1.3 Define Geometry Oracle (Day 2)

**File:** `packages/preset/src/__tests__/geometry-oracle.ts` (new)

Define 5 independent verification rules:

```typescript
export interface Check {
  name: string
  pass: boolean
  severity: 'error' | 'warning'
  details: string[]
  failedItems?: Array<{ item: string; reason: string }>
}

export class GeometryOracle {
  constructor(
    private exportedData: DashedGeometryDebugExport,
    private path: PathGeometry,
    private stroke: RenderableStroke
  ) {}

  /**
   * Check 1: All polygon vertices must be within the stroke bounds.
   * No vertex should be further than (strokeWidth + tolerance) from the path.
   */
  checkPolygonBounds(): Check {
    // Implementation details:
    // - Calculate stroke bounds: centerline ± (width/2)
    // - For each polygon, for each vertex:
    //   - Compute distance to nearest path point
    //   - Verify distance <= width/2 + 1px tolerance
    // - Return pass/fail with detailed logs
  }

  /**
   * Check 2: Inside corner clipping correctness.
   * For stroke.position === 'inside', all non-source vertices must lie
   * within the half-plane wedge formed by the corner.
   */
  checkCornerClipping(): Check {
    // Implementation details:
    // - For each dash touching a corner:
    //   - Get corner constraint (paths A, B)
    //   - Build inward-facing half-planes for both paths
    //   - Verify all polygons are clipped within these planes
    // - Return pass/fail with details
  }

  /**
   * Check 3: Polygon connectivity and coverage.
   * Consecutive dashes should not have unexplained gaps; coverage should be dense.
   */
  checkPolygonConnectivity(): Check {
    // Implementation details:
    // - Sort dashes by startDistance
    // - Check max gap between consecutive dashes
    // - Verify rasterized coverage is continuous
    // - Allow small gaps only at explicit corners
  }

  /**
   * Check 4: Self-intersection detection.
   * No polygon should self-intersect or have degenerate edges.
   */
  checkSelfIntersection(): Check {
    // Implementation details:
    // - For each polygon, check if it's simple (non-self-intersecting)
    // - Use cross-product or convex-hull comparison
    // - Verify all edges have non-zero length
  }

  /**
   * Check 5: Coverage density.
   * Total polygon area should approximate expected dash coverage.
   */
  checkCoverageDensity(): Check {
    // Implementation details:
    // - Expected area ≈ (dashCount × dashLength × strokeWidth)
    // - Actual area = sum of all polygon areas
    // - Tolerance: ±10%
    // - Account for cap areas if applicable
  }

  // Aggregate oracle result
  aggregateResult(): {
    overallPass: boolean
    checks: Check[]
    failureReason?: string
  } {
    const checks = [
      this.checkPolygonBounds(),
      this.checkCornerClipping(),
      this.checkPolygonConnectivity(),
      this.checkSelfIntersection(),
      this.checkCoverageDensity()
    ]

    const overallPass = checks.every(c => c.pass || c.severity === 'warning')
    const failureReason =
      checks.find(c => !c.pass && c.severity === 'error')?.name

    return { overallPass, checks, failureReason }
  }
}
```

**Acceptance Criteria:**
- ✅ All 5 checks implemented with clear pass/fail logic
- ✅ Each check produces detailed diagnostic output
- ✅ Oracle is deterministic (same input → same result)

---

### 1.4 Target Sample Geometry Validation (Days 2-3)

**File:** `packages/preset/src/__tests__/geometry-model.test.ts` (add new test)

```typescript
describe('Dashed Stroke Geometry Oracle', () => {
  it('should pass all oracle checks for the target sample (5-anchor inside dashed)', () => {
    // Import target sample geometry
    const sampleData = {
      points: { /* 5-anchor sample */ },
      segments: { /* segment data */ },
      network: { /* network closed: true */ }
    }

    // Build path and stroke
    const path = buildVectorGeometryModelPath(
      sampleData.network,
      sampleData.points,
      sampleData.segments
    )
    const [stroke] = getRenderableStrokes([
      createDefaultStroke({
        style: StrokeStyles.DASHED,
        position: StrokePositions.INSIDE,
        width: 10,
        dash: 27,
        gap: 20,
        opacity: 0.5
      })
    ])

    // Export and validate
    const exported = exportDashedGeometryDebugData(path, stroke)
    expect(exported).not.toBeNull()

    // Run oracle
    const oracle = new GeometryOracle(exported!, path, stroke)
    const result = oracle.aggregateResult()

    // All checks must pass
    expect(result.overallPass).toBe(true, `Oracle failed: ${result.failureReason}`)
    
    // Detailed assertions
    expect(oracle.checkPolygonBounds().pass).toBe(true)
    expect(oracle.checkCornerClipping().pass).toBe(true)
    expect(oracle.checkPolygonConnectivity().pass).toBe(true)
    expect(oracle.checkSelfIntersection().pass).toBe(true)
    expect(oracle.checkCoverageDensity().pass).toBe(true)

    // Print diagnostics for manual review
    console.log('Geometry Oracle Report:', JSON.stringify(result, null, 2))
  })
})
```

**Acceptance Criteria:**
- ✅ Test runs without crashing
- ✅ All oracle checks **PASS** (not just warn)
- ✅ Debug export is inspectable and sensible
- ✅ No polygon extends outside corner wedges
- ✅ Coverage is reasonably dense (no mysterious gaps)

**Success = All Phase 1 oracle checks pass on target sample.**

---

## Phase 2: Mesh Projection Integration (After Phase 1 ✅)

### Objective
Integrate verified geometry into Pixi.js mesh rendering without breaking validation.

### 2.1 Integrate Export into Vector Render (Day 4)

**File:** `packages/preset/src/components/vector.ts` (modify)

```typescript
// In renderVectorGraphic, dashed stroke path:

if (stroke.style === StrokeStyles.DASHED) {
  // Phase 1: Get verified geometry
  const geometryExport = exportDashedGeometryDebugData(
    getStrokePolylines(),
    stroke
  )

  if (!geometryExport) {
    // Fallback: use simple stroke (temporary)
    renderPolylineStrokes(graphic, getStrokePolylines(), [stroke])
    return
  }

  // Phase 2: Create mesh projection
  const projection = createMeshProjection({
    model: {
      polygons: geometryExport.allPolygons // Flatten all dash polygons
    },
    paint: {
      kind: 'solid',
      color: stroke.color,
      alpha: stroke.alpha
    }
  })

  // Attach to render tree
  if (projection.attach(graphic)) {
    meshProjections.push(projection)
  }
}
```

**Acceptance Criteria:**
- ✅ Mesh projection attaches without error
- ✅ No polygons are lost in the flatten step
- ✅ Solid paint renders with correct color/alpha

---

### 2.2 Add Render Oracle (Day 4)

**File:** `packages/preset/src/__tests__/dashed-stroke-render.test.ts` (new)

```typescript
describe('Dashed Stroke Render Oracle', () => {
  it('should render target sample dashes with correct visual output', async () => {
    // Create vector with dashed stroke
    const rendered = await renderVectorToImage({
      vector: targetSampleVector,
      width: 512,
      height: 512
    })

    // Check 1: Image is not blank
    const pixelCount = countNonBlackPixels(rendered)
    expect(pixelCount).toBeGreaterThan(500, 'Rendered area should have significant coverage')

    // Check 2: Render bounds match geometry bounds
    const renderBounds = getImageBounds(rendered)
    const geometryBounds = geometryExport.metrics.maxPolygonBounds
    const boundsMatch = approximatelyEqual(renderBounds, geometryBounds, tolerance: 5)
    expect(boundsMatch).toBe(true, 'Render bounds should match geometry bounds')

    // Check 3: No overflow or artifacts
    const artifactPixels = detectStrangePixels(rendered)
    expect(artifactPixels).toBeLessThan(10, 'Should have minimal rendering artifacts')

    // Optional: Compare against golden snapshot
    // expect(rendered).toMatchSnapshot()
  })
})
```

**Acceptance Criteria:**
- ✅ Render produces visible geometry
- ✅ Bounds match geometry export
- ✅ No obvious rendering errors

---

## Phase 3: Hit Testing Sync (After Phase 2 ✅)

### Objective
Ensure hit detection area matches rendered area exactly.

### 3.1 Modify Hit Segment Generation (Day 5)

**File:** `packages/preset/src/components/strokes.ts` (modify)

```typescript
// In buildStrokeHitSegments, for dashed strokes:

if (stroke.style === StrokeStyles.DASHED) {
  const geometryExport = exportDashedGeometryDebugData(...)

  if (geometryExport) {
    // Use the exact same polygons for hit testing
    geometryExport.dashIntervals.forEach(interval => {
      interval.polygons.forEach(polygon => {
        hitSegments.push({
          kind: 'polygon',
          points: polygon
        })
      })
    })
    return
  }
}
```

**Also modify:** `isPointNearStrokeHitSegments` in vector.ts to handle polygon segments:

```typescript
export const isPointNearStrokeHitSegments = (
  point: Vec2,
  segments: StrokeHitSegment[]
) =>
  segments.some(segment => {
    if (segment.kind === 'polygon' && segment.points) {
      return pointInPolygon(point, segment.points)
    }

    // Original segment handling
    if (segment.start && segment.end && segment.radius) {
      return (
        distanceSquaredToSegment(point, segment.start, segment.end) <=
        segment.radius * segment.radius
      )
    }

    return false
  })
```

### 3.2 Add Hit Test Oracle (Day 5)

```typescript
describe('Hit Test Consistency Oracle', () => {
  it('should have hit area equal to rendered area for target sample', async () => {
    const vector = targetSampleVector
    const stroke = vector.strokes[0]

    // Get geometry
    const geometryExport = exportDashedGeometryDebugData(...)
    const geometryArea = geometryExport.metrics.totalPolygonArea

    // Get hit segments
    const hitSegments = buildStrokeHitSegments(...)

    // Calculate hit area by rasterization
    const hitArea = rasterizeHitSegments(hitSegments, 512, 512)

    // Areas should match within tolerance
    expect(Math.abs(hitArea - geometryArea)).toBeLessThan(
      geometryArea * 0.05, // ±5% tolerance
      'Hit area should match rendered geometry area'
    )
  })
})
```

**Acceptance Criteria:**
- ✅ Hit test pass/fail is identical to rendered pixel occupancy
- ✅ No gaps between hit-testable and rendered regions
- ✅ Point containment is consistent

---

## Phase 4: Gradient Support (Optional, After Phase 3 ✅)

### Objective
Add gradient fill capability using the verified geometry.

### 4.1 Extend Mesh Projection for Gradients

```typescript
// Only proceed after Phase 3 is complete

const projection = createMeshProjection({
  model: { polygons: geometryExport.allPolygons },
  paint: stroke.gradient
    ? deserializeGradientPaint(stroke.gradient)
    : { kind: 'solid', color: stroke.color, alpha: stroke.alpha }
})
```

**Acceptance Criteria:**
- ✅ Gradient strokes render with bounds-space sampling
- ✅ All previous oracle checks still pass
- ✅ No performance regression

---

## Timeline & Milestones

| Phase | Steps | Est. Days | Gate Condition |
|-------|-------|-----------|----------------|
| **Phase 1** | 1.1-1.4 | Days 1-3 | All 5 oracle checks **PASS** on target sample |
| **Phase 2** | 2.1-2.2 | Day 4 | Render oracle **PASS**, image bounds match geometry |
| **Phase 3** | 3.1-3.2 | Day 5 | Hit area ≈ render area (±5% tolerance) |
| **Phase 4** | 4.1 | Day 6+ | Existing oracles still **PASS**, gradient visual test |

---

## Critical "Must-Do-First" Tasks

### 🔴 Must-Do 1: Geometry Debug Export Interface

```typescript
// File: geometry-model-debug.ts
export function exportDashedGeometryDebugData(...): DashedGeometryDebugExport | null
```

**Why:** This is the foundation. Without it, auditing the geometry is impossible. All other phases depend on this.

**Acceptance:** Function signature defined and exported properly.

---

### 🔴 Must-Do 2: Geometry Oracle Implementation

```typescript
// File: geometry-oracle.ts
export class GeometryOracle {
  checkPolygonBounds(): Check
  checkCornerClipping(): Check
  checkPolygonConnectivity(): Check
  checkSelfIntersection(): Check
  checkCoverageDensity(): Check
}
```

**Why:** This is the quality gate. Tests passing ≠ correctness. Oracles catch subtle bugs.

**Acceptance:** All 5 checks implemented with clear pass/fail logic.

---

### 🔴 Must-Do 3: Target Sample Geometry Validation

```typescript
// Test file: geometry-model.test.ts
it('target sample should pass all oracle checks', () => {
  const result = oracle.aggregateResult()
  expect(result.overallPass).toBe(true)
})
```

**Why:** The target sample is THE proof. If geometry fails on the exact problem case, everything fails.

**Acceptance:** Test green, all 5 oracle checks pass.

---

## Success Criteria

### Phase 1 Complete ✅
- Geometry oracle all green on target sample
- No polygon crosses corner wedge boundary
- Coverage is continuous (no mysterious gaps)
- All diagnostic output is sensible

### Phase 2 Complete ✅
- Mesh projection renders visible geometry
- Render bounds match geometry bounds
- No rendering artifacts or overflow

### Phase 3 Complete ✅
- Hit detection area ≈ rendered area
- Point containment consistent with rendering
- No silent failures in hover/click tests

### Phase 4 Complete ✅ (if applicable)
- Gradient strokes render with correct color sampling
- All previous oracles still pass
- Performance within bounds

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Inside clipping produces self-intersecting polygons | High | Critical | Oracle check 4 catches it early |
| Dashes don't populate all expected corners | Medium | High | Oracle check 3 detects connectivity gaps |
| Mesh projection loses polygons | Low | Critical | Vertex count assertion in render oracle |
| Hit test and render areas diverge | Medium | High | Dedicated hit test oracle at Phase 3 |
| Gradient sampling has wrong bounds space | Low | Medium | Only proceed after Phase 3 complete |

---

## File Structure After Implementation

```
packages/preset/src/
├── components/
│   ├── geometry-model.ts              [refactored: extract pure geometry]
│   ├── geometry-model-debug.ts        [new: debug export interface]
│   ├── strokes.ts                     [modified: add polygon hit segments]
│   └── vector.ts                      [modified: integrate geometry export]
├── __tests__/
│   ├── geometry-oracle.ts             [new: oracle implementation]
│   ├── geometry-model.test.ts         [modified: add Phase 1 validation]
│   ├── dashed-stroke-render.test.ts   [new: Phase 2 rendering oracle]
│   └── vector-component.test.ts       [modified: add hit test oracle]
```

---

## Review Checklist

Before proceeding to implementation:

- [ ] All phases are clearly delineated with specific entry/exit criteria
- [ ] Each oracle check is mathematically well-defined
- [ ] Target sample is selected as the primary validation point
- [ ] Timeline is realistic for each phase
- [ ] Gate conditions are binary (pass/fail, not subjective)
- [ ] Risk mitigations address critical failure modes
- [ ] File structure is clear and non-invasive to existing code

---

## Questions for Review

1. **Oracle Coverage:** Are the 5 oracle checks sufficient? Should we add or remove any?
2. **Target Sample:** Is the 5-anchor inside dashed sample the right canary? Should we test against additional samples after Phase 1?
3. **Gradient Phase:** Should Phase 4 be included in this plan, or deferred to a follow-up?
4. **Timeline:** Is 5 days realistic for Phases 1-3? Any constraints we should account for?
5. **Fallback Strategy:** If any phase fails, should we fall back to simple stroke rendering, or abort?

---

**END OF PLAN**

Please review and provide feedback on:
- Clarity of phase gates
- Completeness of oracle definitions
- Feasibility of timeline
- Any missing risks or considerations
