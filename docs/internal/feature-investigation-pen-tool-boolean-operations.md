# Feature Investigation: Pen Tool and Boolean Operations

**Date:** 2025-02-19
**Status:** ✅ Both features are FEASIBLE with additional implementation requirements
**Type:** Architecture Investigation

---

## Executive Summary

Both requested features are **supported** by the Asyra framework architecture, with varying levels of implementation complexity:

1. **Pen Tool (Vector Path/Mesh)** - ✅ Feasible, requires significant app-level implementation
2. **Boolean Operations** - ✅ Fully supported via custom component + event coordination

---

## Feature 1: Pen Tool (Vector Path Drawing)

### What This Feature Actually Is

A **professional vector pen tool** similar to Figma/Illustrator:

- **Path-based drawing** with anchor points and bezier handles
- **Editable paths** - select, move, add, delete anchor points
- **Curve control** - adjust bezier handles for smooth curves
- **Path operations** - join, break, smooth, convert to sharp, etc.
- **Vector rendering** - crisply scalable paths, not bitmap

### Current Framework Capabilities

✅ **Custom Component Definition via `defineComponent()`**

```typescript
defineComponent({
  type: 'vector-path',
  idPrefix: 'vector-path',
  namePrefix: 'Vector Path',
  properties: [
    {
      name: 'position',
      type: PropertyTypes.POSITION,
      alias: ['x', 'y']
    },
    {
      name: 'dimension',
      type: PropertyTypes.DIMENSION,
      alias: ['width', 'height']
    },
    {
      name: 'pathData',
      type: PropertyTypes.CUSTOM,
      defaultValue: null // SVG path data or custom structure
    },
    {
      name: 'anchorPoints',
      type: PropertyTypes.CUSTOM,
      defaultValue: [] // Array of anchor point objects
    },
    {
      name: 'closed',
      type: PropertyTypes.CUSTOM,
      defaultValue: false
    },
    {
      name: 'fill',
      type: PropertyTypes.CUSTOM,
      defaultValue: 'none'
    },
    {
      name: 'stroke',
      type: PropertyTypes.CUSTOM,
      defaultValue: '#000000'
    },
    {
      name: 'strokeWidth',
      type: PropertyTypes.CUSTOM,
      defaultValue: 2
    }
  ],
  renderStrategy: (graphic, data) => {
    // Renders a path defined by anchor points and bezier handles
    renderVectorPath(graphic, data)
  }
})
```

### Required Data Structures

**Anchor Point Structure:**

```typescript
interface AnchorPoint {
  id: string
  x: number
  y: number
  type: 'smooth' | 'sharp' // curve point or corner
  inHandle: { x: number; y: number } | null // incoming bezier handle
  outHandle: { x: number; y: number } | null // outgoing bezier handle
}
```

**Path Data Structure:**

```typescript
interface VectorPathData {
  id: string
  anchorPoints: AnchorPoint[]
  closed: boolean
  fill: string | 'none'
  stroke: string
  strokeWidth: number
  bounds: { x: number; y: number; width: number; height: number }
}
```

### Implementation Requirements

#### 1. **Vector Path Rendering Engine**

This is the most complex part - requires implementing:

**Option A: Use SVG Path Syntax**

```typescript
renderStrategy: (graphic, data) => {
  // Convert anchor points to SVG path string
  const pathString = generateSVGPath(data.anchorPoints, data.closed)
  graphic.clear()
  graphic.lineStyle({
    width: data.strokeWidth,
    color: data.stroke
  })
  graphic.drawPath(pathString)
}

function generateSVGPath(anchors: AnchorPoint[], closed: boolean): string {
  let d = ''

  anchors.forEach((anchor, i) => {
    if (i === 0) {
      d += `M ${anchor.x} ${anchor.y}`
    } else {
      if (anchor.type === 'smooth' && anchor.inHandle && anchor.outHandle) {
        // Cubic bezier
        const prev = anchors[i - 1]
        d += ` C ${prev.outHandle?.x || prev.x} ${prev.outHandle?.y || prev.y}, 
                 ${anchor.inHandle?.x || anchor.x} ${anchor.inHandle?.y || anchor.y}, 
                 ${anchor.x} ${anchor.y}`
      } else {
        // Line to
        d += ` L ${anchor.x} ${anchor.y}`
      }
    }
  })

  if (closed) {
    d += ' Z'
  }

  return d
}
```

**Option B: Direct PixiJS Graphics**

```typescript
renderStrategy: (graphic, data) => {
  graphic.clear()
  graphic.lineStyle({
    width: data.strokeWidth,
    color: data.stroke
  })

  data.anchorPoints.forEach((anchor, i) => {
    if (i === 0) {
      graphic.moveTo(anchor.x, anchor.y)
    } else {
      if (anchor.type === 'smooth') {
        // Implement cubic bezier
        const prev = anchors[i - 1]
        graphic.bezierCurveTo(
          prev.outHandle?.x || prev.x,
          prev.outHandle?.y || prev.y,
          anchor.inHandle?.x || anchor.x,
          anchor.inHandle?.y || anchor.y,
          anchor.x,
          anchor.y
        )
      } else {
        graphic.lineTo(anchor.x, anchor.y)
      }
    }
  })

  if (data.closed) {
    graphic.closePath()
  }
}
```

#### 2. **Pen Tool Interaction State**

Need a robust interaction manager:

```typescript
interface PenToolState {
  phase: 'idle' | 'drawing' | 'previewing' | 'editing'
  anchorPoints: AnchorPoint[]
  currentPoint: { x: number; y: number } | null
  selectedAnchor: string | null
  selectedHandle: string | null // 'in' or 'out'
}
```

**Drawing Phase:**

```typescript
onStart: (snapshot) => {
  // Create first anchor point
  const pos = getMousePosInWorkspace(snapshot)
  const firstAnchor: AnchorPoint = {
    id: generateId(),
    x: pos.x,
    y: pos.y,
    type: 'sharp',
    inHandle: null,
    outHandle: null
  }

  return {
    phase: 'drawing',
    anchorPoints: [firstAnchor],
    currentPoint: pos
  }
},

onUpdate: (snapshot, state) => {
  // Add new anchor point on click
  if (snapshot.mouse.down && newClickDetected(snapshot)) {
    const pos = getMousePosInWorkspace(snapshot)
    const newAnchor: AnchorPoint = {
      id: generateId(),
      x: pos.x,
      y: pos.y,
      type: 'sharp',
      inHandle: null,
      outHandle: null
    }

    return {
      ...state,
      anchorPoints: [...state.anchorPoints, newAnchor],
      currentPoint: pos
    }
  }

  // Preview curve to cursor position
  const pos = getMousePosInWorkspace(snapshot)
  return {
    ...state,
    currentPoint: pos
  }
},

onEnd: (snapshot, state) => {
  // Double-click or close path to finish
  if (shouldClosePath(snapshot)) {
    // Close path
    state.anchorPoints[0] = { ...state.anchorPoints[0], type: 'smooth' }
  }

  // Create final vector-path element
  const elementId = elementApis.createElement({
    type: 'vector-path',
    x: calculateBounds(state.anchorPoints).x,
    y: calculateBounds(state.anchorPoints).y,
    width: calculateBounds(state.anchorPoints).width,
    height: calculateBounds(state.anchorPoints).height,
    anchorPoints: state.anchorPoints,
    closed: shouldClosePath(snapshot),
    stroke: '#000000',
    strokeWidth: 2,
    fill: 'none'
  }, 'vector-path')

  selectionApis.selectElements([elementId])
}
```

#### 3. **Path Editing Features**

**Point Selection:**

```typescript
onClick: (snapshot) => {
  // Detect if clicking on an anchor point or handle
  const hit = detectHitOnAnchorOrHandle(
    snapshot.mouse.position,
    state.anchorPoints
  )

  if (hit) {
    return {
      ...state,
      selectedAnchor: hit.anchorId,
      selectedHandle: hit.handleType // null, 'in', or 'out'
    }
  }
}

onUpdate: (snapshot, state) => {
  // Drag to move selected point or handle
  if (state.selectedAnchor && state.phase === 'editing') {
    const pos = getMousePosInWorkspace(snapshot)

    if (state.selectedHandle === null) {
      // Move anchor point
      state.anchorPoints = updateAnchorPoint(
        state.anchorPoints,
        state.selectedAnchor,
        { x: pos.x, y: pos.y }
      )
    } else if (state.selectedHandle === 'in') {
      // Move incoming handle
      state.anchorPoints = updateHandle(
        state.anchorPoints,
        state.selectedAnchor,
        'in',
        { x: pos.x, y: pos.y }
      )
    } else {
      // Move outgoing handle
      state.anchorPoints = updateHandle(
        state.anchorPoints,
        state.selectedAnchor,
        'out',
        { x: pos.x, y: pos.y }
      )
    }

    // Re-render path with updated points
    elementApis.changeComputedData([state.elementId], {
      anchorPoints: state.anchorPoints,
      bounds: calculateBounds(state.anchorPoints)
    })
  }
}
```

**Add/Delete Points:**

```typescript
// Add point by clicking on path segment
addAnchorPointOnSegment(pathId: string, segmentIndex: number, position: {x, y}) {
  const element = elementApis.getElementById(pathId)
  const anchors = [...element.data.anchorPoints]
  const newPoint: AnchorPoint = {
    id: generateId(),
    x: position.x,
    y: position.y,
    type: 'smooth',
    inHandle: calculateInHandle(position, anchors[segmentIndex]),
    outHandle: calculateOutHandle(position, anchors[segmentIndex + 1])
  }

  anchors.splice(segmentIndex + 1, 0, newPoint)
  elementApis.changeComputedData([pathId], { anchorPoints: anchors })
}

// Delete selected point(s)
deleteAnchorPoints(pathId: string, anchorIds: string[]) {
  const element = elementApis.getElementById(pathId)
  const anchors = element.data.anchorPoints.filter(a => !anchorIds.includes(a.id))

  elementApis.changeComputedData([pathId], { anchorPoints: anchors })
}
```

**Smooth/Sharp Conversion:**

```typescript
convertAnchorPoint(pathId: string, anchorId: string, type: 'smooth' | 'sharp') {
  const element = elementApis.getElementById(pathId)
  const anchors = element.data.anchorPoints.map(anchor => {
    if (anchor.id === anchorId) {
      if (type === 'sharp') {
        return { ...anchor, type: 'sharp', inHandle: null, outHandle: null }
      } else {
        // Auto-calculate handles for smooth curve
        const { inHandle, outHandle } = calculateAutoHandles(
          anchor,
          element.data.anchorPoints
        )
        return { ...anchor, type: 'smooth', inHandle, outHandle }
      }
    }
    return anchor
  })

  elementApis.changeComputedData([pathId], { anchorPoints: anchors })
}
```

#### 4. **Visual Feedback**

**Editable Path Overlay:**

```typescript
renderStrategy: (graphic, data) => {
  // Render the main path
  renderVectorPath(graphic, data)

  // If editing mode, render anchor point handles
  if (data.isEditing) {
    renderAnchorPoints(graphic, data.anchorPoints)
  }
}

function renderAnchorPoints(graphic: Graphics, anchors: AnchorPoint[]) {
  anchors.forEach((anchor) => {
    // Draw anchor point
    graphic.beginFill(0xffffff)
    graphic.lineStyle(2, 0x000000)
    graphic.drawCircle(anchor.x, anchor.y, 4)

    // Draw handles if smooth point
    if (anchor.type === 'smooth') {
      if (anchor.inHandle) {
        graphic.moveTo(anchor.x, anchor.y)
        graphic.lineTo(anchor.inHandle.x, anchor.inHandle.y)
        graphic.drawCircle(anchor.inHandle.x, anchor.inHandle.y, 2)
      }
      if (anchor.outHandle) {
        graphic.moveTo(anchor.x, anchor.y)
        graphic.lineTo(anchor.outHandle.x, anchor.outHandle.y)
        graphic.drawCircle(anchor.outHandle.x, anchor.outHandle.y, 2)
      }
    }
  })
}
```

### What Works Out-of-the-Box

✅ Component extensibility via `defineComponent()`
✅ Custom properties for complex data (anchor points, handles)
✅ Flexible render strategies (can use PixiJS bezier methods)
✅ Input sessions for multi-step interactions
✅ Scene tree integration (CRUD operations)
✅ Selection and complex manipulation
✅ Props management for UI panels
✅ Transaction support (undo/redo)

### What Needs Implementation (App-Level Only)

✅ **Significant app-level implementation required:**

1. **Vector path rendering engine**
   - Bezier curve mathematics
   - Path data structures (anchor points, handles)
   - Rendering logic (PixiJS or SVG-based)

2. **Pen tool interaction manager**
   - Multi-phase state machine (drawing, previewing, editing)
   - Click detection for adding points
   - Drag detection for moving points/handles

3. **Path editing features**
   - Point selection (hit detection)
   - Add/delete points on segments
   - Smooth/sharp conversion
   - Handle manipulation

4. **Visual feedback overlays**
   - Anchor point rendering (when editing)
   - Handle rendering (with lines to anchor)
   - Selection highlighting

5. **UI Components**
   - Pen tool button in toolbar (with phase indicators)
   - Content panel for:
     - Anchor points list
     - Handle editing controls
     - Stroke/fill properties
     - Path operations (simplify, close, break, join)

**No framework changes required** - all app-level using existing APIs.

### Recommended Approach

**Use existing libraries where possible:**

- **Paper.js** - Full vector graphics library with robust path operations
- **Snap.svg** - SVG manipulation library
- **PixiJS Graphics** - Use built-in bezier methods (basic but workable)

**Minimum viable pen tool (MVP):**

```typescript
// Phase 1: Basic pen tool
- Click to add anchor points
- Draw straight lines between points
- Close path to finish
- Edit: move anchor points

// Phase 2: Bezier curves
- Convert points to smooth (auto-generate handles)
- Manual handle adjustment
- Smooth/sharp toggle

// Phase 3: Advanced features
- Add/delete points on segments
- Join/break paths
- Path operations (simplify, merge)
```

---

## Feature 2: Boolean Operations on Multi-Selected Elements

### Current Framework Capabilities

This feature is fully supported. See previous detailed analysis in Appendix A.

**Summary:**
✅ Define `boolean-group` component with operation property
✅ Render strategy implementing boolean operations
✅ Multi-selection support via `selectionApis`
✅ Dynamic UI (button shows when ≥2 selected)
✅ Scene tree reparenting
✅ Event coordination

**Implementation (app-level only):**

1. Boolean operation library (union, subtraction, intersection, difference)
2. BooleanGroup component definition
3. Create-boolean-group feature
4. UI: conditional button + content panel updates

---

## Comparison with Figma/Illustrator Pen Tool

| Feature                   | Asyra Framework      | Figma/Illustrator | Implementation Effort |
| ------------------------- | -------------------- | ----------------- | --------------------- |
| Component Definition      | ✅ defineComponent() | Custom            | Low (framework)       |
| Custom Data Structures    | ✅ Custom props      | Custom            | Low (framework)       |
| Flexible Rendering        | ✅ RenderStrategy    | Custom            | Low (framework)       |
| Anchor Point Management   | ❌ Must implement    | Built-in          | **High (app)**        |
| Bezier Curve Math         | ⚠️ PixiJS/lib        | Built-in          | **High (app)**        |
| Path Editing (add/delete) | ❌ Must implement    | Built-in          | **High (app)**        |
| Handle Manipulation       | ❌ Must implement    | Built-in          | **High (app)**        |
| Hit Detection (points)    | ❌ Must implement    | Built-in          | **Medium (app)**      |
| Path Operations           | ❌ Must implement    | Built-in          | **Medium (app)**      |

---

## Conclusion

### Pen Tool (Vector Path) - **Feasible with High App-Level Effort** ⚠️

**What framework provides:**

- Infrastructure: `defineComponent()`, render strategies, event system
- Canvas and rendering: PixiJS with basic bezier support
- State management: Scene tree, props management, transactions

**What app must implement:**

- **Significant functionality** (~2000-4000 lines):
  - Vector path engine (anchor points, handles, bezier math)
  - Multi-phase interaction manager (drawing, editing)
  - Path editing features (add/delete/move points, smooth/sharp)
  - Hit detection for points and handles
  - Visual feedback overlays

**No framework changes required** - but requires substantial app-level development.

### Boolean Operations - **Feasible with Medium App-Level Effort** ✅

**What framework provides:**

- Component definition and container support
- Multi-selection API
- Event coordination
- Flexible rendering
- Scene tree management

**What app must implement:**

- **Medium functionality** (~500-1000 lines):
  - Boolean operation library (can use external lib)
  - BooleanGroup component
  - UI for operation selection
  - Optional: reparenting (if not in framework)

**No framework changes required.**

---

## Appendix A: Boolean Operations Full Analysis

_(See previous section for complete details)_

---

## Recommended Implementation Strategy

### Phase 1: Boolean Operations (Easier win)

1. Implement basic `union` operation first
2. Add `boolean-group` component
3. UI: conditional button + content panel
4. Test with 2-3 elements
5. Add `subtraction`, `intersection`, `difference`

### Phase 2: Pen Tool MVP

1. Implement basic pen tool (points only, straight lines)
2. Add point selection and movement
3. Close path to finish
4. Edit mode: move anchor points
5. Test basic shapes

### Phase 3: Advanced Pen Tool

1. Bezier curves (smooth points, handle adjustment)
2. Add/delete points on segments
3. Smooth/sharp conversion
4. Visual feedback overlays
5. Path operations (simplify, break, join)

---

**Overall Assessment:**

- Both features are **architecturally feasible**
- Boolean operations: **Easy to implement**, good starting point
- Pen tool: **Complex but achievable**, requires dedicated development effort
- **No framework modifications needed** for either feature
