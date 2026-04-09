# 09 — Per-Shape Integration

This chapter documents how each shape type in Asyra Design integrates with the stroke system, including default values, path source construction, and render strategy invocation.

## Shape Integration Pattern

All shape components follow the same integration pattern:

1. **Define** a `strokes` property of type `PropertyTypes.STROKES` with shape-specific defaults.
2. **Build** `StrokePathSource[]` from the shape's geometry.
3. **Call** `renderStrokeSources(graphic, sources, data.strokes)` in the render strategy.

---

## Rectangle

**File**: `packages/preset/src/components/rectangle.ts`

### Default Strokes

```typescript
const DEFAULT_RECTANGLE_STROKES: StrokeAttrs[] = []  // No strokes by default
```

### Path Source Construction

```typescript
const buildRectangleStrokeSources = (width, height) =>
  buildPolylineStrokePathSources([{
    points: [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height }
    ],
    closed: true
  }])
```

Four vertices forming a closed rectangle. This produces a single `StrokePathSource` with:
- `geometry`: 4 line segments
- `sampledPoints`: the 4 corner points
- `closed`: `true`

### Render Strategy

```typescript
renderStrategy: (graphic, data) => {
  graphic.clear()
  const replayPath = () => graphic.rect(0, 0, data.width, data.height)
  replayPath()
  applyRenderableFill(graphic, data.fills, { replayPath })
  renderStrokeSources(
    graphic,
    buildRectangleStrokeSources(data.width, data.height),
    data.strokes
  )
  graphic.x = data.x
  graphic.y = data.y
}
```

### Stroke Position Behavior

| Position | Behavior |
|----------|----------|
| Center | Stroke is centered on the rectangle edges, half extends outward, half inward |
| Inside | Stroke extends fully inward from each edge |
| Outside | Stroke extends fully outward from each edge |

---

## Oval

**File**: `packages/preset/src/components/oval.ts`

### Default Strokes

```typescript
const DEFAULT_OVAL_STROKES: StrokeAttrs[] = []  // No strokes by default
```

### Path Source Construction

```typescript
const OVAL_STROKE_SEGMENTS = 48

const buildOvalStrokeSources = (width, height) =>
  buildPolylineStrokePathSources([{
    points: Array.from({ length: OVAL_STROKE_SEGMENTS }, (_, index) => {
      const angle = (index / OVAL_STROKE_SEGMENTS) * Math.PI * 2
      return {
        x: width / 2 + Math.cos(angle) * (width / 2),
        y: height / 2 + Math.sin(angle) * (height / 2)
      }
    }),
    closed: true
  }])
```

48 points evenly distributed around an ellipse. This is a polyline approximation — the points are connected by straight line segments, but at 48 segments the visual result is smooth.

### Render Strategy

Same pattern as rectangle. Fill is drawn as a true ellipse (`graphic.ellipse(...)`), but stroke uses the 48-point polyline approximation.

---

## Frame

**File**: `packages/preset/src/components/frame.ts`

### Default Strokes

```typescript
const DEFAULT_FRAME_STROKES = createDefaultStrokes({ color: '#000000' })
```

**Unlike other shapes**, frames have a default stroke (black, 1px, solid, center). This is because frames serve as containers and need a visible boundary by default.

### Path Source Construction

Identical to rectangle:

```typescript
const buildFrameStrokeSources = (width, height) =>
  buildPolylineStrokePathSources([{
    points: [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height }
    ],
    closed: true
  }])
```

### Render Strategy

Same pattern as rectangle.

---

## Vector

**File**: `packages/preset/src/components/vector.ts`

Vectors are the most complex shape type for stroke integration because they can have:
- Multiple subpaths (networks)
- Bézier curves
- Open and closed paths
- Variable topology

### Default Strokes

```typescript
defaultValue: [
  createDefaultStroke({
    color: '#cccccc',
    visible: true,
    joinType: StrokeJoinTypes.ROUND
  })
]
```

Vectors have a default stroke: `#cccccc` (light gray), visible, with round joins. The round join type is chosen because vectors often have sharp corners where miter joins would produce excessive spikes.

### Path Source Construction

Vector path sources are built using the geometry model system, which handles Bézier curves:

```typescript
const getStrokePathSources = () => {
  // Built from buildVectorGeometryModelPath
  // which processes points, segments, and networks
  // to create PathGeometry with cubic Bézier support
}
```

`buildVectorGeometryModelPath` (in `geometry-model.ts`):
1. Iterates over ordered vector networks.
2. For each network segment, resolves anchor points and control points.
3. Creates `PathSegment[]` — either `line` (for straight segments) or `cubic` (for Bézier curves).
4. Computes segment lengths (for lines: Euclidean distance; for curves: `bezier-js` arc length).
5. Samples points along each segment for the `sampledPoints` array (used for polyline operations like offset).

### Render Strategy (Stroke Portion)

```typescript
if (strokePayload.length > 0) {
  renderStrokeSources(graphic, getStrokePathSources(), strokePayload)
}
```

The stroke rendering is called at the very end of the vector render strategy, after fill computation and vector path drawing.

### Multiple Network Support

A vector can have multiple networks (subpaths). Each network produces its own `StrokePathSource`, and strokes are rendered independently for each source. This means:

- Each subpath gets its own stroke outline.
- Caps are added at the endpoints of open subpaths.
- Closed subpaths get continuous stroke outlines without caps.

### Vector-Specific Stroke Behavior

| Feature | Behavior |
|---------|----------|
| **Open path** | Position is always treated as `center`, round caps at endpoints |
| **Closed path** | All three positions work (center, inside, outside) |
| **Bézier curves** | Strokes follow the curve with adaptive tessellation |
| **Self-intersecting paths** | Stroke polygons may overlap (intentional, blended by alpha) |
| **Dashed stroke on curves** | Dash intervals are measured along arc length, not chord length |

---

## Comparison Table

| Shape | Default Strokes | Path Points | Closed | Path Type |
|-------|----------------|-------------|--------|-----------|
| **Rectangle** | `[]` (none) | 4 | Yes | Polyline |
| **Oval** | `[]` (none) | 48 | Yes | Polyline |
| **Frame** | 1× black, 1px, solid | 4 | Yes | Polyline |
| **Vector** | 1× `#cccccc`, 1px, round join | Variable | Variable | Line + Cubic Bézier |

---

## Component Property Registration

All shapes register their `strokes` property the same way:

```typescript
{
  name: 'strokes',
  type: PropertyTypes.STROKES,          // 'strokes'
  defaultValue: DEFAULT_SHAPE_STROKES   // Shape-specific defaults
}
```

This tells the core framework:
- The property is a **STROKES container** (managed by `strokes-component.ts`).
- It can have child properties of type **STROKE**.
- The default value determines what strokes a newly created element starts with.
