# Dashed Stroke Rendering Path Analysis

## Summary

I've traced the complete path for how dashed line strokes get rendered in the asra codebase. The investigation reveals:

1. **Two rendering paths exist**: an old Graphics.fill() path and a newer mesh-based path
2. **The acute angle bug location**: `packages/preset/src/components/strokes.ts:1557-1568`
3. **Root cause**: Overlapping polygons are NOT merged before Graphics.fill() is called
4. **Quick fix available**: Apply existing `mergeOverlappingConvexPolygons()` function

---

## Part 1: The Two Rendering Paths

### OLD PATH: Graphics.fill() (Currently Active for Dashed Strokes)

**Entry Point**: `packages/preset/src/components/vector.ts:1686`
```typescript
const renderVectorGraphic = (graphic, data) => {
  // ... setup code ...
  
  if (specialStrokePayload.length > 0) {
    renderPolylineStrokes(graphic, getStrokePolylines(), specialStrokePayload)
  }
}
```

**Rendering Flow**:
1. **Line 1554** → `buildExactDashPartPolygons()` generates polygon geometry
2. **Line 1557** → `renderPolylineStrokes()` in strokes.ts handles rendering
3. **Line 1560** → `fillStrokePolygons()` actually renders to PixiJS Graphics

**fillStrokePolygons Implementation** (`strokes.ts:788`):
```typescript
const fillStrokePolygons = (graphic, polygons, stroke) => {
  graphic.beginPath?.()
  
  // Add all polygons to SINGLE path
  drawablePolygons.forEach((polygon) => {
    drawPolyline(graphic, polygon, true)  // moveTo, lineTo, closePath
  })
  
  // Single fill() call for ALL polygons
  applyStrokeFillStyle(graphic, stroke)  // Graphics.fill(color, alpha)
  
  return true
}
```

**Visual Rendering**:
- Uses PixiJS Graphics object
- Calls `graphics.fill()` which applies color to the entire path
- Works fine for non-overlapping polygons
- **Can fail for overlapping polygons** ← THIS IS THE BUG

---

### NEW PATH: MeshProjection (Partial Integration)

**Location**: `packages/render/src/projections/mesh-projection.ts`

**How it works**:
1. Takes `GeometryModel` with polygon array
2. **Triangulates** each polygon using `earcut` library
3. Converts to PixiJS `MeshGeometry` with vertices + indices
4. Creates `Mesh` with paint sprite as mask
5. Handles overlapping automatically during triangulation

**Key function** (`mesh-projection.ts:115`):
```typescript
const createGeometry = (model: GeometryModel) => {
  const meshData = buildProjectionMeshData(model)
  
  // Triangulate all polygons together
  return new MeshGeometry({
    positions: meshData.vertices,    // Float32Array
    indices: meshData.indices,       // Uint32Array
    uvs: meshData.uvs
  })
}
```

**Status**: Only used in tests and examples, NOT integrated into vector rendering yet
- `MeshProjectionCache` is defined in vector.ts but never used
- `createDashedGeometryModel()` exists but only called in geometry-model tests
- No code path connects vector rendering to MeshProjection

---

## Part 2: Where Dashed Stroke Polygons Get Rendered

### Current Rendering Location: `renderPolylineStrokes()`

**File**: `packages/preset/src/components/strokes.ts:1475`

**For DASHED strokes** (lines 1556-1574):
```typescript
if (stroke.style === StrokeStyles.DASHED) {
  const dashParts = buildDashedParts(strokePoints, closed, stroke)
  
  // Generate geometry for each dash
  const dashedGeometries = dashParts.map((part) => {
    const renderPoints = buildDashedRenderPoints(part, centerlineOffset, validateIntersection)
    return {
      renderPoints,
      polygons: buildExactDashPartPolygons(  // ← Returns multiple polygons
        part.clipPoints,
        renderPoints,
        stroke,
        { insideOrientation, contextStartIndex: part.clipStartIndex }
      )
    }
  })

  // Render all geometries
  targetGraphics.forEach((targetGraphic) => {
    const strokePolygons = dashedGeometries.flatMap(({ polygons }) => polygons)
    
    if (strokePolygons.length > 0) {
      const filled = fillStrokePolygons(
        targetGraphic,
        strokePolygons,     // ← Can be [polygon1, polygon2] at acute angles
        stroke
      )
    }
  })
}
```

---

## Part 3: The Acute Angle Bug

### What Happens at Acute Angles (~36°)

From session investigation:
```
Part 5 (at acute angle):
  Polygon 0: bounds [264.8, 0.0] to [274.0, 21.2]
  Polygon 1: bounds [270.9, 0.0] to [279.6, 14.7]
  
X-ranges overlap: [270.9, 274.0] ← The problem!
```

### Why This Causes Visual Gaps

1. **Correct geometry** is produced by `buildExactDashPartPolygons()` ✓
2. **Two overlapping polygons** are returned - this is geometrically correct ✓
3. **But `fillStrokePolygons()` doesn't merge them** ✗
4. Graphics.fill() renders overlapping segments as single path ✗
5. Rendering engine may have issues with overlapping strokes/fills ✗
6. Result: **Visual fragmentation/gaps** appear

### Proof: The Missing Merge Function

**In `createDashedGeometryModel()`** (`geometry-model.ts:1866`), after building polygons:
```typescript
if (
  !(stroke.position === StrokePositions.INSIDE && insideOrientation !== 0)
) {
  // ← THIS MERGES OVERLAPPING POLYGONS
  dashPolygons = mergeOverlappingConvexPolygons(dashPolygons)
}
```

**But in `renderPolylineStrokes()`** (`strokes.ts:1557`):
```typescript
const strokePolygons = dashedGeometries.flatMap(({ polygons }) => polygons)
// ← NO MERGE HAPPENS HERE!

if (strokePolygons.length > 0) {
  const filled = fillStrokePolygons(targetGraphic, strokePolygons, stroke)
}
```

---

## Part 4: The Solution (Two Options)

### Option A: Quick Fix - Add Polygon Merging

**Location**: `packages/preset/src/components/strokes.ts:1557`

**Change**:
```typescript
const strokePolygons = dashedGeometries.flatMap(({ polygons }) => polygons)

// ADD THIS LINE:
const mergedPolygons = mergeOverlappingConvexPolygons(strokePolygons)

if (mergedPolygons.length > 0) {
  const filled = fillStrokePolygons(targetGraphic, mergedPolygons, stroke)  // ← Use merged
}
```

**Why it works**:
- Reuses tested `mergeOverlappingConvexPolygons()` function
- Automatically merges polygons at overlapping boundaries
- Fixes the acute angle case in 1 line
- No architectural changes needed

**Where `mergeOverlappingConvexPolygons` is defined**: `geometry-model.ts:1012`
```typescript
const mergeOverlappingConvexPolygons = (
  polygons: Vec2[][],
  canMergeHull: (polygon: Vec2[]) => boolean = () => true
) => {
  // Iteratively check all polygon pairs
  // If they overlap, compute their convex hull
  // If hull area ≈ union area, merge them
  // Repeat until no more merges possible
}
```

---

### Option B: Complete Replacement - Use MeshProjection Path

**Scope**: Integrate mesh-based rendering into vector component

**Steps**:
1. Call `createDashedGeometryModel()` for each dashed stroke
2. Feed the resulting `GeometryModel` to `createMeshProjection()`
3. Attach mesh to vector graphics container
4. Automatically handles overlapping via earcut triangulation

**Advantages**:
- Mesh-based rendering is more robust
- earcut triangulation automatically handles overlaps
- Matches the new architecture from dashed-stroke-correctness-recovery-plan
- Scales better for complex geometry

**Current integration status**:
- `createDashedGeometryModel()` exists and is tested ✓
- `createMeshProjection()` exists and is tested ✓
- `MeshProjectionCache` interface exists in vector.ts ✓
- But nothing connects them together ✗

---

## Part 5: Files Involved

### Core Rendering Logic
- **`packages/preset/src/components/vector.ts:1686`** - `renderVectorGraphic()` entry point
- **`packages/preset/src/components/strokes.ts:1475`** - `renderPolylineStrokes()` main renderer
- **`packages/preset/src/components/strokes.ts:788`** - `fillStrokePolygons()` Graphics.fill() caller
- **`packages/preset/src/components/strokes.ts:649`** - `buildExactDashPartPolygons()` generates polygons

### Geometry Model (New Path)
- **`packages/preset/src/components/geometry-model.ts:1460`** - `createDashedGeometryModel()` builds GeometryModel
- **`packages/preset/src/components/geometry-model.ts:1012`** - `mergeOverlappingConvexPolygons()` merges overlaps
- **`packages/preset/src/components/geometry-model.ts:1866`** - Uses merge in geometry building

### Mesh Projection (New Path)
- **`packages/render/src/projections/mesh-projection.ts`** - Triangulation + mesh rendering
- **`packages/render/src/index.ts`** - Exports `createMeshProjection`
- **`packages/core/src/apis/render.ts:79`** - Core API wrapper

---

## Part 6: What Each Function Does

| Function | File | Purpose | Used By |
|----------|------|---------|---------|
| `buildExactDashPartPolygons()` | strokes.ts:649 | Generates polygon geometry for dashes | renderPolylineStrokes |
| `fillStrokePolygons()` | strokes.ts:788 | Renders polygons via Graphics.fill() | renderPolylineStrokes |
| `renderPolylineStrokes()` | strokes.ts:1475 | Main dashed stroke renderer | vector.ts |
| `mergeOverlappingConvexPolygons()` | geometry-model.ts:1012 | Merges overlapping polygons | createDashedGeometryModel |
| `createDashedGeometryModel()` | geometry-model.ts:1460 | Builds complete GeometryModel | tests only |
| `createMeshProjection()` | mesh-projection.ts | Converts GeometryModel to PixiJS Mesh | tests only |
| `buildProjectionMeshData()` | mesh-projection.ts:115 | Earcut triangulation | createMeshProjection |

---

## Summary Table: Old vs New Rendering Paths

| Aspect | OLD (Graphics.fill) | NEW (MeshProjection) |
|--------|-------------------|-------------------|
| **Location** | strokes.ts:788 | mesh-projection.ts |
| **Renderer** | PixiJS Graphics | PixiJS Mesh |
| **Approach** | Polylines + fill() | Triangulation + mesh |
| **Overlap handling** | Manual merging needed | Auto via earcut |
| **Currently used** | ✓ YES (dashed strokes) | ✗ NO (tests only) |
| **Handles overwrapping** | Not reliably | Yes, automatically |
| **Polygon merge** | Required before fill | Built into triangulation |

---

## Recommended Next Step

1. **First**: Try Option A (quick fix with merging)
   - Add `mergeOverlappingConvexPolygons()` call before `fillStrokePolygons()` at line 1557
   - Should immediately fix acute angle gaps
   - Minimal risk, single line change

2. **If Option A works**: Consider Option B migration later
   - Integrate full MeshProjection path
   - More robust long-term solution
   - Aligns with geometry-first rendering architecture

