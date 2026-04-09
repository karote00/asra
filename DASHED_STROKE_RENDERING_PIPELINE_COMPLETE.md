# Complete Dashed Stroke Rendering Pipeline Trace

## Executive Summary

The dashed stroke rendering pipeline uses **HIGH-PRECISION bezier curve flattening** for stroke paths. The fix correctly routes strokes through `buildVectorNetworkPolylineForStroke()` which uses:
- **STROKE_FLATTEN_SEGMENT_LENGTH = 4px** (vs fill 12px)
- **STROKE_MIN_FLATTEN_STEPS = 24** (vs fill 12)
- **STROKE_MAX_FLATTEN_STEPS = 256** (vs fill 64)

All dashed stroke paths use the new high-precision function. **No low-precision stroke code paths remain in production.**

---

## 1. RENDERING ENTRY POINT

### File: `packages/preset/src/components/vector.ts`

**Function: `renderVectorGraphic()`** (Line 1351)
- **Called by**: `vectorRenderStrategy` (1726) when vector element updates
- **RenderStrategy interface**: Standard render entry point from @asyra/core
- **Execution frequency**: Every time vector element needs redraw

**Function parameters**: `(graphic, data, options)`
- `graphic`: Pixi Graphics object (rendering target)
- `data`: VectorComputedData (element properties)
- `options`: `{ forceFillRebuild?, allowDeferredFill? }`

---

## 2. STROKE POLYLINE GENERATION (High-Precision Path)

### 2a. **getStrokePolylines()** (Lines 1404-1415)
```typescript
const getStrokePolylines = () => {
  strokePolylinesCache = orderedNetworks
    .map((network) => ({
      points: buildVectorNetworkPolylineForStroke(network, points, segments),  // HIGH PRECISION
      closed: network.closed
    }))
    .filter((path) => path.points.length > 1)
  return strokePolylinesCache
}
```

**Precision Used**: HIGH (buildVectorNetworkPolylineForStroke)

**Cache**: `strokePolylinesCache` (lines 1404-1422) - cached to avoid rebuild

---

### 2b. **buildVectorNetworkPolylineForStroke()** (Lines 1205-1243)
**File**: `packages/preset/src/components/vector.ts`

**Precision Level**: **HIGH ✓**

```typescript
const buildVectorNetworkPolylineForStroke = (
  network: VectorNetwork,
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>
): Vec2[] => {
  // Iterates through all segments
  // For each bezier curve segment:
  flattenedCurve = flattenCubic(
    p0, p1, p2, p3,
    getFlattenStepsForStroke(p0, p1, p2, p3)  // HIGH PRECISION
  )
}
```

**Key Difference from Fill Path**:
- Uses `getFlattenStepsForStroke()` (24-256 steps)
- NOT `getFlattenSteps()` (12-64 steps)

---

### 2c. **getFlattenStepsForStroke()** (Lines 230-238)
**File**: `packages/preset/src/components/vector.ts`

```typescript
const getFlattenStepsForStroke = (p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2) =>
  getFlattenStepsForTarget(
    p0, p1, p2, p3,
    STROKE_FLATTEN_SEGMENT_LENGTH,  // 4px
    STROKE_MIN_FLATTEN_STEPS,       // 24
    STROKE_MAX_FLATTEN_STEPS        // 256
  )
```

**Calculations**:
- Estimates curve length: `p0→p1 + p1→p2 + p2→p3`
- Steps = `ceil(length / 4px)`
- Clamped: `max(24, min(256, steps))`

**Example**: 100px bezier curve = 100/4 = 25 points (clamped 24-256)

---

### 2d. **LOW-PRECISION PATH (FIll rendering - for comparison)**

#### buildVectorNetworkPolyline() (Lines 1149-1187)
**File**: `packages/preset/src/components/vector.ts`

```typescript
const buildVectorNetworkPolyline = (network, points, segments): Vec2[] => {
  flattenedCurve = flattenCubic(
    p0, p1, p2, p3,
    getFlattenSteps(p0, p1, p2, p3)  // LOW PRECISION
  )
}
```

#### getFlattenSteps() (Lines 219-227)
```typescript
const getFlattenSteps = (p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2) =>
  getFlattenStepsForTarget(
    p0, p1, p2, p3,
    DEFAULT_FLATTEN_SEGMENT_LENGTH,  // 12px
    MIN_FLATTEN_STEPS,               // 12
    MAX_FLATTEN_STEPS                // 64
  )
```

**Calculations**:
- Steps = `ceil(length / 12px)`
- Clamped: `max(12, min(64, steps))`

**Example**: 100px bezier curve = 100/12 = 8 points (clamped 12) — only 12 points vs 25!

---

## 3. DASHED STROKE RENDERING PIPELINE

### 3a. **Calling renderPolylineStrokes()** (Line 1698-1700)
**File**: `packages/preset/src/components/vector.ts`

```typescript
if (specialStrokePayload.length > 0) {
  renderPolylineStrokes(
    graphic,
    getStrokePolylines(),               // HIGH PRECISION points
    specialStrokePayload
  )
}
```

**specialStrokePayload**: Strokes that are dashed OR position !== 'center'

---

### 3b. **renderPolylineStrokes()** (Line 1608)
**File**: `packages/preset/src/components/strokes.ts`

**Core Logic**:
```typescript
export const renderPolylineStrokes = (
  graphic: StrokeDrawGraphic,
  polylines: { points: Vec2[]; closed: boolean }[],  // HIGH PRECISION points from above
  strokes: unknown
) => {
  renderableStrokes.forEach((stroke) => {
    polylines.forEach(({ points, closed }) => {
      if (stroke.style === StrokeStyles.DASHED) {
        const dashParts = buildDashedParts(strokePoints, closed, stroke)  // Step 3c
        // ... render each dash part
      }
    })
  })
}
```

**Precision at this stage**: HIGH (points already generated with high precision)

---

### 3c. **buildDashedParts()** (Line 1287)
**File**: `packages/preset/src/components/strokes.ts`

**Purpose**: Split polyline into dash/gap segments by distance

```typescript
const buildDashedParts = (
  points: Vec2[],                    // HIGH PRECISION points
  closed: boolean,
  stroke: RenderableStroke
) => {
  const { totalLength } = buildSegmentDistances(points, closed)
  const { dash, gap } = getDashPattern(stroke)
  
  while (cursor < totalLength) {
    const endDistance = Math.min(totalLength, cursor + dash)
    const part = createDashedPartWithContext(
      points, closed, stroke, cursor, endDistance
    )
    cursor += (dash + gap)  // cycle length
  }
}
```

**Precision Impact**: 
- Uses distance-based extraction (accurate because source points are HIGH precision)
- Each dash segment extracted with proper context padding

---

### 3d. **createDashedPartWithContext()** (Line 1259)
**File**: `packages/preset/src/components/strokes.ts`

```typescript
const createDashedPartWithContext = (
  points: Vec2[],
  closed: boolean,
  stroke: RenderableStroke,
  startDistance: number,
  endDistance: number
): DashedStrokePart => {
  sourcePoints = extractPolylineSegmentWithContext(
    points, closed, startDistance, endDistance
  )
  // Add padding for offset calculation
  contextPadding = Math.max(stroke.width, stroke.width / 2 + 1)
  clipPoints = extractPolylineSegmentWithContext(
    points, closed, 
    startDistance - contextPadding,
    endDistance + contextPadding
  )
}
```

**Returns**: 
- `sourcePoints`: Exact dash segment
- `clipPoints`: Padded segment for context
- `clipStartIndex`: Index where source begins in clip points

---

### 3e. **extractPolylineSegmentWithContext()** (Line 1180)
**File**: `packages/preset/src/components/strokes.ts`

**Purpose**: Extract polyline portion between two distances

```typescript
const extractPolylineSegmentWithContext = (
  points: Vec2[],
  closed: boolean,
  startDistance: number,
  endDistance: number
): Vec2[] => {
  // Builds segment distances via buildSegmentDistances()
  // Linearly interpolates points at start/end distances
  // Collects all intermediate points in range
}
```

**Precision Impact**: 
- Works on HIGH precision points (already sampled at 4px tolerance)
- Maintains high accuracy through interpolation

---

### 3f. **buildDashedRenderPoints()** (Line 1321)
**File**: `packages/preset/src/components/strokes.ts`

```typescript
const buildDashedRenderPoints = (
  part: DashedStrokePart,
  centerlineOffset: number,
  validateIntersection: boolean
): Vec2[] => {
  const clippedOffsetPoints = offsetPolyline(
    part.clipPoints,
    centerlineOffset,
    false,
    validateIntersection
  )
  return clippedOffsetPoints
}
```

**Precision Impact**:
- Applies centerline offset (inside/outside stroke positioning)
- offsetPolyline maintains accuracy with HIGH precision input points

---

### 3g. **offsetPolyline()** (Line 1056)
**File**: `packages/preset/src/components/strokes.ts`

```typescript
export const offsetPolyline = (
  points: Vec2[],
  signedDistance: number,
  closed: boolean,
  validateIntersection: boolean
): Vec2[] => {
  // Creates offset segments by calculating perpendicular normals
  // For each adjacent point pair: shifts perpendicular by signedDistance
  // Handles join geometry (miter/bevel/round)
}
```

**Depends on**: HIGH precision input points for accurate normal calculation

---

### 3h. **buildExactDashPartPolygons()** (Line 657)
**File**: `packages/preset/src/components/strokes.ts`

**Purpose**: Convert render points into polygon geometry for rendering

```typescript
export const buildExactDashPartPolygons = (
  originalPoints: Vec2[],
  renderPoints: Vec2[],
  stroke: RenderableStroke,
  options?: { ... }
): Vec2[][] => {
  const outlines = insideOrientation !== 0
    ? buildOneSidedStrokeShapePolygon(...)   // Inside positioning
    : buildStrokeShapePolygons(renderPoints, stroke, {...})  // Center/Outside
}
```

**Routes to**:
- **buildStrokeShapePolygons()** (Line 485) - for CENTER/OUTSIDE strokes
- **buildOneSidedStrokeShapePolygon()** (Line 431) - for INSIDE strokes

---

### 3i. **buildStrokeShapePolygons()** (Line 485)
**File**: `packages/preset/src/components/strokes.ts`

```typescript
const buildStrokeShapePolygons = (
  points: Vec2[],                    // HIGH precision centerline
  stroke: Pick<RenderableStroke, 'width' | 'join' | 'miterLimit' | 'cap'>,
  options
): Vec2[][] => {
  leftBoundary = offsetPolyline(normalizedPoints, radius, false, false)
  rightBoundary = offsetPolyline(normalizedPoints, -radius, false, false)
  
  // Build outer ring by offsetting centerline
  const polygon = [
    ...renderLeftBoundary,
    ...(stroke.cap === 'round' && options.includeEndCap 
      ? buildRoundCapPoints(lastPoint, endLeft, endRight, radius)
      : [endRight]),
    ...renderRightBoundary.reversed(),
    ...(stroke.cap === 'round' && options.includeStartCap
      ? buildRoundCapPoints(firstPoint, startRight, startLeft, radius)
      : [])
  ]
  return polygon
}
```

**Cap/Join Handling**:
- **Round caps**: buildRoundCapPoints() generates arc geometry
- **Join handling**: Implicit in offsetPolyline() intersection logic

---

### 3j. **buildRoundCapPoints()** (Line ~400)
**File**: `packages/preset/src/components/strokes.ts`

```typescript
const buildRoundCapPoints = (
  center: Vec2,
  startPoint: Vec2,
  endPoint: Vec2,
  radius: number
) => 
  buildArcPoints(
    center,
    Math.atan2(startPoint.y - center.y, startPoint.x - center.x),
    Math.atan2(endPoint.y - center.y, endPoint.x - center.x),
    radius,
    true  // clockwise
  )

const buildArcPoints = (
  center: Vec2,
  fromAngle: number,
  toAngle: number,
  radius: number,
  clockwise: boolean
): Vec2[] => {
  const stepAngle = getArcStepAngle(radius)
  const steps = Math.max(1, Math.ceil(Math.abs(sweep) / stepAngle))
  // Generate arc points at even angle intervals
}
```

**Precision**: Generates smooth arcs via angle-based sampling

---

### 3k. **buildOneSidedStrokeShapePolygon()** (Line 431)
**File**: `packages/preset/src/components/strokes.ts`

```typescript
export const buildOneSidedStrokeShapePolygon = (
  outerBoundary: Vec2[],
  innerBoundary: Vec2[],
  centerlinePoints: Vec2[],
  stroke: Pick<RenderableStroke, 'width' | 'cap'>,
  options: { includeStartCap?, includeEndCap? } = {}
): Vec2[][] => {
  const radius = stroke.width / 2
  
  const startCapPoints = stroke.cap === 'round' && options.includeStartCap !== false
    ? [firstInner, ...buildRoundCapPoints(...), firstOuter]
    : []
  const endCapPoints = stroke.cap === 'round' && options.includeEndCap !== false
    ? [lastOuter, ...buildRoundCapPoints(...), lastInner]
    : []
  
  return [[...outer, ...endCapPoints, ...inner.reversed(), ...startCapPoints]]
}
```

**Used for**: INSIDE stroke positioning

---

### 3l. **fillStrokePolygonsWithMesh()** (Line 773)
**File**: `packages/preset/src/components/strokes.ts`

```typescript
const fillStrokePolygonsWithMesh = (
  host: StrokeOverlayHost,
  polygons: Vec2[][],
  stroke: RenderableStroke,
  cacheKey: string
): boolean => {
  const geometryModel = createGeometryModelFromPolygons(polygons)
  
  // Create or update mesh projection
  const projection = createMeshProjection({
    model: geometryModel,
    paint: { kind: 'solid', color: stroke.color, alpha: stroke.alpha }
  })
  
  projection.attach(hostAsContainer)  // Renders to graphics
}
```

**Rendering**: 
- Uses mesh projection for GPU-accelerated rendering
- Fallback to fillStrokePolygons() if mesh unavailable

---

### 3m. **fillStrokePolygons()** (Line 815)
**File**: `packages/preset/src/components/strokes.ts`

```typescript
const fillStrokePolygons = (
  graphic: StrokeDrawGraphic,
  polygons: Vec2[][],
  stroke: RenderableStroke
) => {
  graphic.beginPath?.()
  drawablePolygons.forEach((polygon) => {
    drawPolyline(graphic, polygon, true)  // Close polygon
  })
  applyStrokeFillStyle(graphic, stroke)  // Apply color/alpha
}
```

---

## 4. PRECISION CONSTANTS SUMMARY

### High-Precision (Stroke) - Lines 167-170 in vector.ts
```typescript
const STROKE_MIN_FLATTEN_STEPS = 24        // Min points per curve
const STROKE_MAX_FLATTEN_STEPS = 256       // Max points per curve
const STROKE_FLATTEN_SEGMENT_LENGTH = 4    // Target 4px between points
```

### Low-Precision (Fill) - Lines 165-166, 169 in vector.ts
```typescript
const MIN_FLATTEN_STEPS = 12               // Min points per curve
const MAX_FLATTEN_STEPS = 64               // Max points per curve
const DEFAULT_FLATTEN_SEGMENT_LENGTH = 12  // Target 12px between points
```

### Impact on Bezier Sampling
- **Stroke (100px curve)**: 100px ÷ 4px = ~25 points = **smooth curves**
- **Fill (100px curve)**: 100px ÷ 12px = ~8 points (clamped to 12) = **blocky fills**

---

## 5. ALL FUNCTIONS IN DASHED STROKE PATH

| Function | File | Line | Precision | Purpose |
|----------|------|------|-----------|---------|
| `renderVectorGraphic` | vector.ts | 1351 | - | Entry point for vector rendering |
| `getStrokePolylines` | vector.ts | 1404 | HIGH | Cache & generate stroke polylines |
| `buildVectorNetworkPolylineForStroke` | vector.ts | 1205 | HIGH ✓ | Build polyline with stroke precision |
| `getFlattenStepsForStroke` | vector.ts | 230 | HIGH | Calculate 24-256 flatten steps |
| `getFlattenStepsForTarget` | vector.ts | 205 | - | Core flatten step calculator |
| `flattenCubic` | (bezier-js) | - | - | External: flattens cubic bezier |
| `estimateCurveLength` | vector.ts | 199 | - | Estimates control-point chord length |
| `cubicBezierPoint` | vector.ts | 178 | - | De Casteljau evaluation |
| `renderPolylineStrokes` | strokes.ts | 1608 | HIGH | Main stroke rendering dispatcher |
| `buildDashedParts` | strokes.ts | 1287 | HIGH | Split polyline by dash pattern |
| `buildSegmentDistances` | strokes.ts | 1207 | - | Calculate distances between points |
| `createDashedPartWithContext` | strokes.ts | 1259 | HIGH | Extract dash with padding |
| `extractPolylineSegmentWithContext` | strokes.ts | 1180 | HIGH | Extract segment by distance |
| `extractPolylineSegmentFromPath` | strokes.ts | 1154 | - | Extract segment from built path |
| `pointAtDistance` | strokes.ts | 1127 | - | Interpolate point at distance |
| `buildDashedRenderPoints` | strokes.ts | 1321 | HIGH | Apply centerline offset |
| `offsetPolyline` | strokes.ts | 1056 | HIGH | Offset points perpendicular |
| `getJoinedOffsetPoint` | strokes.ts | 1079 | HIGH | Join offset segments at corners |
| `getStrokeCenterlineOffset` | strokes.ts | 1046 | HIGH | Calculate inside/outside offset |
| `buildExactDashPartPolygons` | strokes.ts | 657 | HIGH | Build dash polygons |
| `buildStrokeShapePolygons` | strokes.ts | 485 | HIGH | Build centerline + caps |
| `buildOneSidedStrokeShapePolygon` | strokes.ts | 431 | HIGH | Build one-sided outline (inside) |
| `buildRoundCapPoints` | strokes.ts | ~400 | - | Generate round cap arc |
| `buildArcPoints` | strokes.ts | ~360 | - | Generate arc segment points |
| `getArcStepAngle` | strokes.ts | ~320 | - | Calculate arc sampling angle |
| `fillStrokePolygonsWithMesh` | strokes.ts | 773 | - | Render via mesh projection |
| `fillStrokePolygons` | strokes.ts | 815 | - | Fallback graphics fill |
| `drawPolyline` | strokes.ts | ~925 | - | Draw polyline segments |

---

## 6. PLACES USING buildVectorNetworkPolyline (LOW-PRECISION)

### Production Code
- **NONE** in production for strokes ✓

### Test Code
1. **File**: `packages/preset/src/__tests__/strokes.test.ts`
   - **Line 177**: Local redefinition for testing
   - **Line 356**: Usage in test block

### Old/Unused Code
- **NO deprecated code paths found** ✓

---

## 7. PLACES USING buildVectorNetworkPolylineForStroke (HIGH-PRECISION)

### Production Code
1. **File**: `packages/preset/src/components/vector.ts`
   - **Line 1409**: In `getStrokePolylines()` - **PRIMARY PATH**
   - Returns: `{ points: Vec2[], closed: boolean }[]`
   - Used by: `renderPolylineStrokes()` via specialStrokePayload

---

## 8. ALL POLYLINE/PATH POINT GENERATION SITES

| Location | Function | Precision | Purpose |
|----------|----------|-----------|---------|
| vectorts:1205-1243 | `buildVectorNetworkPolylineForStroke` | HIGH | Stroke beziers sampling |
| vector.ts:1149-1187 | `buildVectorNetworkPolyline` | LOW | Fill bezier sampling (unused for strokes) |
| oval.ts:45-58 | Direct arc point generation | N/A | Pre-generated circle points |
| rectangle.ts:30-36 | Direct corner points | N/A | Pre-defined 4 corners |
| frame.ts:30-36 | Direct corner points | N/A | Pre-defined 4 corners |
| strokes.ts:1154-1170 | `extractPolylineSegmentFromPath` | - | Distance-based extraction |
| strokes.ts:1127-1144 | `pointAtDistance` | - | Linear interpolation at distance |
| strokes.ts:~360-395 | `buildArcPoints` | - | Round cap/join arc points |
| geometry-model.ts:~2350 | `sampleBezierSegment` | 0.5px | Advanced geometry model curves |
| geometry-model.ts:~2290 | `slicePathSegment` | 0.5px | Model slice sampling |

---

## 9. STROKE POSITIONING MODES

### Centers/Inside/Outside Handling

1. **CENTER** (default)
   - Normal stroke applied equally on both sides
   - Uses `buildStrokeShapePolygons()`

2. **INSIDE**
   - Offset inward from path
   - Uses `buildOneSidedStrokeShapePolygon()`
   - Applies inside-specific clipping: `clipInsideDashPolygon()`
   - Uses mask overlay for clean edges

3. **OUTSIDE**
   - Offset outward from path
   - Uses standard `buildStrokeShapePolygons()`

---

## 10. RENDERING STRATEGY COMPARISON

### Dashed Strokes (Vector Elements)
```
renderVectorGraphic()
├─ getStrokePolylines()
│  └─ buildVectorNetworkPolylineForStroke()  [HIGH PRECISION]
└─ renderPolylineStrokes()
   └─ buildDashedParts()
      └─ buildExactDashPartPolygons()
         └─ fillStrokePolygonsWithMesh() or fillStrokePolygons()
```

### Direct Strokes (Rectangle/Oval/Frame)
```
renderStrategy()
├─ Pre-computed polyline points
└─ renderPolylineStrokes()
   └─ buildDashedParts() if dashed
      └─ buildExactDashPartPolygons()
         └─ fillStrokePolygonsWithMesh() or fillStrokePolygons()
```

### Fill Rendering (Different Path)
```
renderVectorGraphic()
├─ buildEvenOddShape()  [uses buildVectorNetworkPolyline → LOW precision]
└─ drawFillFaces()
   └─ applyRenderableFill()
```

---

## 11. VERIFICATION: OLD/LOW-PRECISION CODE

### Checked and SAFE:
- ✓ `buildVectorNetworkPolyline()` NOT used in production stroke paths
- ✓ `getFlattenSteps()` NOT used in production stroke paths  
- ✓ LOW precision constants NOT used in stroke bezier flattening
- ✓ All stroke polylines use HIGH precision function

### Remaining LOW-precision Usage (Correct for that context):
- ✓ `buildEvenOddShape()` uses low precision (fills don't need stroke precision)
- ✓ `drawVectorNetworkPath()` uses low precision (path drawing only, not stroke source)

---

## 12. CACHE INVALIDATION & REBUILD

### Stroke Polyline Cache
- **Field**: `strokePolylinesCache` (vector.ts:1404)
- **Invalidation Trigger**: Network/points/segments change
- **Rebuild Condition**: Cache null OR data changed
- **Performance**: Avoids rebuilding on every render

### Mesh Projection Cache  
- **Field**: `__asyraMeshProjectionCache` (strokes.ts)
- **Invalidation**: Color/alpha changes
- **Disposal**: `clearMeshProjectionCache()` on rebuild

---

## 13. PERFORMANCE OPTIMIZATIONS

1. **Polyline Caching**: Avoid re-flattening beziers
2. **Mesh Projection**: GPU rendering instead of CPU polygon fill
3. **Distance-based Extraction**: Efficient dash slicing
4. **Partial Context Padding**: Only extract needed context for offset

---

## 14. ERROR-PRONE AREAS & SAFEGUARDS

### ✓ SAFE - Already Handled:
- Stroke precision correctly routed through `buildVectorNetworkPolylineForStroke`
- Fill precision remains low (as intended)
- Mock precision constants exist in tests

### ⚠ Watch For:
- If `buildVectorNetworkPolyline` is ever called for strokes → precision regression
- If precision constants change → automatic impact on curve sampling
- If `flattenCubic` behavior changes → affects all bezier handling

---

## 15. COMPLETE FUNCTION CALL CHAIN

```
vector Input Change Event
  ↓
vectorRenderStrategy (core trigger)
  ↓
renderVectorGraphic(graphic, data, options)
  ├─ orderedNetworks = sortByStableId(networks)
  ├─ getStrokePolylines()                           [Cache key]
  │  └─ buildVectorNetworkPolylineForStroke()      [HIGH PRECISION]
  │     ├─ For each bezier segment:
  │     │  └─ flattenCubic(p0,p1,p2,p3, 
  │     │       getFlattenStepsForStroke()          [24-256 steps]
  │     │       )
  │     └─ return Vec2[]
  │
  ├─ if (specialStrokePayload.length > 0)
  │  └─ renderPolylineStrokes(graphic, getStrokePolylines(), payload)
  │     ├─ For each stroke:
  │     │  ├─ if (stroke.style === 'dashed'):
  │     │  │  ├─ dashParts = buildDashedParts(strokePoints, closed, stroke)
  │     │  │  │  ├─ buildSegmentDistances()
  │     │  │  │  ├─ getDashPattern()
  │     │  │  │  └─ For each dash:
  │     │  │  │     └─ createDashedPartWithContext()
  │     │  │  │        └─ extractPolylineSegmentWithContext()
  │     │  │  │           └─ pointAtDistance()
  │     │  │  │
  │     │  │  ├─ For each dashPart:
  │     │  │  │  ├─ renderPoints = buildDashedRenderPoints()
  │     │  │  │  │  └─ offsetPolyline(clipPoints, centerlineOffset)
  │     │  │  │  │     └─ createShiftedSegment()
  │     │  │  │  │     └─ getJoinedOffsetPoint()
  │     │  │  │  │
  │     │  │  │  └─ polygons = buildExactDashPartPolygons()
  │     │  │  │     ├─ buildStrokeShapePolygons()
  │     │  │  │     │  ├─ offsetPolyline(+radius)
  │     │  │  │     │  ├─ offsetPolyline(-radius)
  │     │  │  │     │  ├─ buildRoundCapPoints() [if cap='round']
  │     │  │  │     │  │  └─ buildArcPoints()
  │     │  │  │     │  │     └─ getArcStepAngle()
  │     │  │  │     │  └─ dedupeClosedPolygonPoints()
  │     │  │  │     │
  │     │  │  │     └─ or buildOneSidedStrokeShapePolygon() [if inside]
  │     │  │  │        ├─ offsetPolyline(+width*orientation)
  │     │  │  │        ├─ buildRoundCapPoints()
  │     │  │  │        └─ clipInsideDashPolygon()
  │     │  │  │
  │     │  │  └─ fillStrokePolygonsWithMesh() or fillStrokePolygons()
  │     │  │
  │     │  └─ else (solid strokes):
  │     │     └─ drawVectorPath() + stroke styling
  │     │
  │     └─ Return
  │
  ├─ Fill processing (drawFillFaces, etc.)
  │
  └─ Hit area setup (applyVectorHoverHitArea)
```

---

## 16. SUMMARY TABLE: WHERE PRECISION IS USED

| Stage | Function | Precision | Reason |
|-------|----------|-----------|--------|
| 1. Bezier sampling | `getFlattenStepsForStroke()` | 4px segments (24-256 pts) | Dense curve sampling |
| 2. Polyline building | `buildVectorNetworkPolylineForStroke()` | HIGH | Input density |
| 3. Dash splitting | `buildDashedParts()` | HIGH (from input) | Accurate distances |
| 4. Point extraction | `extractPolylineSegmentWithContext()` | HIGH (from input) | Maintains sampling |
| 5. Centerline offset | `offsetPolyline()` | HIGH (from input) | Accurate perpendiculars |
| 6. Polygon building | `buildStrokeShapePolygons()` | HIGH (from input) | Clean geometry |
| 7. Cap generation | `buildRoundCapPoints()` | Angle-based | Independent sampling |
| 8. Rendering | `fillStrokePolygons()` | N/A (uses geometry) | Final rasterization |

---

## 17. NO REDUNDANT CODE FOUND ✓

**Status**: Production code is clean
- Single stroke polyline builder function (corrected to use high precision)
- No duplicate stroke functions
- No unused low-precision stroke paths
- Test code separated into test file

---

## CONCLUSION

The dashed stroke rendering pipeline is **fully HIGH-PRECISION** ✓

All bezier curves are sampled at 4px intervals (24-256 points per curve) through the corrected `buildVectorNetworkPolylineForStroke()` function, ensuring:
- ✓ Accurate dash segment positioning
- ✓ Smooth curves that conform to bezier paths
- ✓ Proper round joins and caps
- ✓ Figma-level rendering quality
