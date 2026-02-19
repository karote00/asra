# App-Level Implementation Examples: Pen Tool & Boolean Operations

**Purpose:** This document provides pseudo code examples showing how Pen Tool and Boolean Operations would work at the app level using Asyra framework.

---

## Pen Tool (Vector Path) - App-Level Implementation

### 1. Define Vector Path Component

```typescript
// apps/asyra-design/src/components/vector-path.ts
import { defineComponent } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'
import type { RenderStrategy } from '@asyra/render'
import { Graphics } from 'pixi.js'

// ===================================================
// Data Structures
// ===================================================

interface AnchorPoint {
  id: string
  x: number
  y: number
  type: 'smooth' | 'sharp'
  inHandle: { x: number; y: number } | null
  outHandle: { x: number; y: number } | null
}

interface VectorPathData {
  anchorPoints: AnchorPoint[]
  closed: boolean
  fill: string
  stroke: string
  strokeWidth: number
}

// ===================================================
// Render Strategy
// ===================================================

const vectorPathRenderStrategy: RenderStrategy = (
  graphic: Graphics,
  data: VectorPathData & {
    id: string
    x: number
    y: number
    width: number
    height: number
  }
) => {
  graphic.clear()

  const { anchorPoints, closed, fill, stroke, strokeWidth, x, y } = data

  if (anchorPoints.length < 2) return

  // Set line style
  graphic.lineStyle({
    width: strokeWidth,
    color: parseInt(stroke.replace('#', '0x'), 16),
    cap: 'round',
    join: 'round'
  })

  // Begin path
  graphic.moveTo(anchorPoints[0].x - x, anchorPoints[0].y - y)

  // Draw segments
  for (let i = 1; i < anchorPoints.length; i++) {
    const current = anchorPoints[i]
    const prev = anchorPoints[i - 1]

    if (current.type === 'smooth' && current.inHandle && prev.outHandle) {
      // Cubic bezier
      graphic.bezierCurveTo(
        prev.outHandle.x - x,
        prev.outHandle.y - y,
        current.inHandle.x - x,
        current.inHandle.y - y,
        current.x - x,
        current.y - y
      )
    } else {
      // Sharp line
      graphic.lineTo(current.x - x, current.y - y)
    }
  }

  if (closed) {
    graphic.closePath()

    // Fill if specified
    if (fill !== 'none') {
      graphic.fill(parseInt(fill.replace('#', '0x'), 16))
    }
  }
}

// ===================================================
// Register Component
// ===================================================

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
      name: 'anchorPoints',
      type: PropertyTypes.CUSTOM,
      defaultValue: [] as AnchorPoint[]
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
  renderStrategy: vectorPathRenderStrategy
})
```

### 2. Pen Tool Feature (Drawing Interaction)

```typescript
// apps/asyra-design/src/features/pen-tool/index.ts
import { defineFeature } from '@asyra/feature-system'
import type { SystemContextSnapshot } from '@asyra/utils'
import { elementApis, selectionApis } from '../../common-apis'
import { BehaviorSubject } from 'rxjs'

// ===================================================
// State Management
// ===================================================

// Pen phase state
const penPhase$ = new BehaviorSubject<'idle' | 'drawing' | 'previewing'>('idle')
const editingPathId$ = new BehaviorSubject<string | null>(null)

// Current points being drawn
let currentPoints: { x: number; y: number }[] = []

// ===================================================
// Helper Functions
// ===================================================

function getMousePosInWorkspace(pos: { x: number; y: number }) {
  return elementApis.getMousePosInWorkspace(pos)
}

function calculateBounds(points: { x: number; y: number }[]) {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  }
}

// ===================================================
// API
// ===================================================

const api = {
  addPoint(point: { x: number; y: number }) {
    currentPoints.push(point)
  },

  getCurrentPoints() {
    return currentPoints
  },

  finishPath(close: boolean) {
    const bounds = calculateBounds(currentPoints)

    // Create vector path element
    const elementId = elementApis.createElement(
      {
        type: 'vector-path',
        x: bounds.x,
        y: bounds.y,
        width: bounds.width || 1,
        height: bounds.height || 1,
        anchorPoints: currentPoints.map((p, i) => ({
          id: `anchor-${generateId()}`,
          x: p.x - bounds.x,
          y: p.y - bounds.y,
          type: 'sharp',
          inHandle: null,
          outHandle: null
        })),
        closed: close,
        fill: 'none',
        stroke: '#000000',
        strokeWidth: 2
      },
      'vector-path'
    )

    // Reset state
    currentPoints = []
    penPhase$.next('idle')

    // Select the new path
    selectionApis.selectElements([elementId])

    return elementId
  },

  cancelDrawing() {
    currentPoints = []
    penPhase$.next('idle')
  }
}

// ===================================================
// Feature Definition
// ===================================================

const penToolFeature = defineFeature('penTool', 'input.drag', {
  priority: 10,
  exclusive: true,
  api,
  session: {
    onStart: (snapshot: SystemContextSnapshot) => {
      const { primaryTool } = snapshot

      if (primaryTool !== 'pen') {
        return null
      }

      // Start drawing
      penPhase$.next('drawing')

      const pos = getMousePosInWorkspace(snapshot.mouse.position)
      if (!pos) return null

      // Add first point
      api.addPoint(pos)

      return {
        startPoint: pos,
        hasMoved: false
      }
    },

    onUpdate: (snapshot: SystemContextSnapshot, state) => {
      if (!state || penPhase$.value !== 'drawing') return

      // Debounce: only add point if moved significantly
      const currentPos = getMousePosInWorkspace(snapshot.mouse.position)
      if (!currentPos) return

      const distance = Math.sqrt(
        Math.pow(currentPos.x - state.startPoint.x, 2) +
          Math.pow(currentPos.y - state.startPoint.y, 2)
      )

      if (distance > 10 && !state.hasMoved) {
        // First significant movement
        state.hasMoved = true
      }

      if (distance > 20) {
        // Add new point every 20 pixels
        api.addPoint(currentPos)
        return {
          ...state,
          startPoint: currentPos,
          hasMoved: true
        }
      }
    },

    onEnd: (snapshot: SystemContextSnapshot, state) => {
      if (!state || penPhase$.value !== 'drawing') return

      // Double click or special key to close path
      const shouldClose = snapshot.detail?.closePath || false

      const elementId = api.finishPath(shouldClose)

      return {
        elementId,
        closed: shouldClose
      }
    }
  }
})

export default penToolFeature
```

### 3. Path Editing Feature (Anchor Point Manipulation)

```typescript
// apps/asyra-design/src/features/path-edit/index.ts
import { defineFeature } from '@asyra/feature-system'
import type { SystemContextSnapshot } from '@asyra/utils'
import { elementApis } from '../../common-apis'

// ===================================================
// State
// ===================================================

let selectedAnchorId: string | null = null
let selectedHandleType: 'in' | 'out' | null = null

// ===================================================
// API
// ===================================================

const api = {
  selectAnchor(anchorId: string, handleType: 'in' | 'out' | null = null) {
    selectedAnchorId = anchorId
    selectedHandleType = handleType
  },

  clearSelection() {
    selectedAnchorId = null
    selectedHandleType = null
  },

  moveSelectedAnchor(pathId: string, newPos: { x: number; y: number }) {
    const element = elementApis.getElementById(pathId)
    if (!element || !selectedAnchorId) return

    const anchors = [...element.data.anchorPoints]
    const anchorIndex = anchors.findIndex((a) => a.id === selectedAnchorId)

    if (anchorIndex === -1) return

    if (selectedHandleType === null) {
      // Moving anchor point
      anchors[anchorIndex] = {
        ...anchors[anchorIndex],
        x: newPos.x,
        y: newPos.y
      }
    } else {
      // Moving handle
      anchors[anchorIndex] = {
        ...anchors[anchorIndex],
        [selectedHandleType === 'in' ? 'inHandle' : 'outHandle']: newPos
      }
    }

    elementApis.changeComputedData([pathId], {
      anchorPoints: anchors
    })
  },

  addPointOnSegment(
    pathId: string,
    segmentIndex: number,
    pos: { x: number; y: number }
  ) {
    const element = elementApis.getElementById(pathId)
    if (!element) return

    const anchors = [...element.data.anchorPoints]
    const prev = anchors[segmentIndex]
    const next = anchors[segmentIndex + 1]

    // Auto-calculate handles for smooth curve
    const newPoint: AnchorPoint = {
      id: `anchor-${generateId()}`,
      x: pos.x,
      y: pos.y,
      type: 'smooth',
      inHandle: {
        x: prev.x + (pos.x - prev.x) * 0.33,
        y: prev.y + (pos.y - prev.y) * 0.33
      },
      outHandle: {
        x: pos.x + (next.x - pos.x) * 0.33,
        y: pos.y + (next.y - pos.y) * 0.33
      }
    }

    anchors.splice(segmentIndex + 1, 0, newPoint)
    elementApis.changeComputedData([pathId], { anchorPoints: anchors })
  },

  deleteAnchorPoint(pathId: string, anchorId: string) {
    const element = elementApis.getElementById(pathId)
    if (!element) return

    const anchors = element.data.anchorPoints.filter((a) => a.id !== anchorId)
    elementApis.changeComputedData([pathId], { anchorPoints: anchors })
  },

  convertPointType(pathId: string, anchorId: string, type: 'smooth' | 'sharp') {
    const element = elementApis.getElementById(pathId)
    if (!element) return

    const anchors = element.data.anchorPoints.map((anchor) => {
      if (anchor.id !== anchorId) return anchor

      if (type === 'sharp') {
        return { ...anchor, type: 'sharp', inHandle: null, outHandle: null }
      } else {
        // Auto-calculate handles for smooth
        return calculateAutoHandles(anchor, element.data.anchorPoints)
      }
    })

    elementApis.changeComputedData([pathId], { anchorPoints: anchors })
  }
}

// ===================================================
// Hit Detection
// ===================================================

function detectHitOnPoint(
  mousePos: { x: number; y: number },
  point: { x: number; y: number },
  threshold = 8
): boolean {
  const distance = Math.sqrt(
    Math.pow(mousePos.x - point.x, 2) + Math.pow(mousePos.y - point.y, 2)
  )
  return distance < threshold
}

function detectHitOnHandle(
  mousePos: { x: number; y: number },
  handle: { x: number; y: number },
  threshold = 6
): boolean {
  return detectHitOnPoint(mousePos, handle, threshold)
}

// ===================================================
// Feature Definition
// ===================================================

const pathEditFeature = defineFeature('pathEdit', 'input.pointer', {
  priority: 20,
  exclusive: false,
  api,
  session: {
    onStart: (snapshot: SystemContextSnapshot) => {
      const { selectedIds } = snapshot
      if (selectedIds.size !== 1) return null

      const elementId = [...selectedIds][0]
      const element = elementApis.getElementById(elementId)
      if (element?.data.type !== 'vector-path') return null

      // Check if clicking on anchor point or handle
      const pos = elementApis.getMousePosInWorkspace(snapshot.mouse.position)
      if (!pos) return null

      // Check anchor points
      for (const anchor of element.data.anchorPoints) {
        if (detectHitOnPoint(pos, anchor)) {
          return {
            pathId: elementId,
            hitAnchorId: anchor.id,
            hitHandleType: null
          }
        }

        // Check handles
        if (anchor.inHandle && detectHitOnHandle(pos, anchor.inHandle)) {
          return {
            pathId: elementId,
            hitAnchorId: anchor.id,
            hitHandleType: 'in'
          }
        }

        if (anchor.outHandle && detectHitOnHandle(pos, anchor.outHandle)) {
          return {
            pathId: elementId,
            hitAnchorId: anchor.id,
            hitHandleType: 'out'
          }
        }
      }

      return null
    },

    onUpdate: (snapshot: SystemContextSnapshot, state) => {
      if (!state || !state.pathId) return

      if (snapshot.mouse.dragging) {
        const pos = elementApis.getMousePosInWorkspace(snapshot.mouse.position)
        if (!pos) return

        api.selectAnchor(state.hitAnchorId, state.hitHandleType || null)
        api.moveSelectedAnchor(state.pathId, pos)
      }
    },

    onEnd: (snapshot: SystemContextSnapshot, state) => {
      if (!state) return
      api.clearSelection()
    }
  }
})

export default pathEditFeature
```

---

## Boolean Operations - App-Level Implementation

### 1. Define Boolean Group Component

```typescript
// apps/asyra-design/src/components/boolean-group.ts
import { defineComponent } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'
import type { RenderStrategy } from '@asyra/render'
import { Graphics } from 'pixi.js'
import {
  performUnion,
  performSubtraction,
  performIntersection,
  performXOR
} from './boolean-operations'

type BooleanOperation = 'union' | 'subtraction' | 'intersection' | 'xor'

interface BooleanGroupData {
  operation: BooleanOperation
  children: string[]
}

// ===================================================
// Render Strategy
// ===================================================

const booleanGroupRenderStrategy: RenderStrategy = (
  graphic: Graphics,
  data: BooleanGroupData & { id: string; x: number; y: number }
) => {
  graphic.clear()

  const { operation, children, x, y } = data

  if (children.length < 2) return

  // Get child elements from scene tree
  // (assuming we can access via elementApis)
  const childElements: any[] = []

  // This would fetch actual elements from scene tree
  // For now, pseudo code:
  children.forEach((childId) => {
    const element = elementApis.getElementById(childId)
    if (element) {
      childElements.push({
        x: element.data.x,
        y: element.data.y,
        width: element.data.width,
        height: element.data.height,
        type: element.data.type
      })
    }
  })

  // Perform boolean operation
  const resultPath = performBooleanOperation(operation, childElements)

  // Draw result
  graphic.lineStyle({
    width: 2,
    color: 0x000000,
    cap: 'round',
    join: 'round'
  })
  graphic.fill(0xcccccc)

  graphic.beginFill()
  graphic.drawPath(resultPath)
  graphic.endFill()
}

// ===================================================
// Boolean Operations
// ===================================================

function performBooleanOperation(
  operation: BooleanOperation,
  elements: any[]
): any {
  switch (operation) {
    case 'union':
      return performUnion(elements)
    case 'subtraction':
      return performSubtraction(elements[0], elements[1])
    case 'intersection':
      return performIntersection(elements)
    case 'xor':
      return performXOR(elements[0], elements[1])
    default:
      return performUnion(elements)
  }
}

// ===================================================
// Register Component
// ===================================================

defineComponent({
  type: 'boolean-group',
  idPrefix: 'boolean-group',
  namePrefix: 'Boolean Group',
  isContainer: true,
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
      name: 'operation',
      type: PropertyTypes.CUSTOM,
      defaultValue: 'union' as BooleanOperation
    },
    {
      name: 'children',
      type: PropertyTypes.CUSTOM,
      defaultValue: [] as string[]
    }
  ],
  renderStrategy: booleanGroupRenderStrategy
})
```

### 2. Create Boolean Group Feature

```typescript
// apps/asyra-design/src/features/create-boolean-group/index.ts
import { defineFeature } from '@asyra/feature-system'
import type { SystemContextSnapshot } from '@asyra/utils'
import { elementApis, selectionApis } from '../../common-apis'
import { BehaviorSubject } from 'rxjs'

// ===================================================
// State
// ===================================================

const booleanOperation$ = new BehaviorSubject<
  'union' | 'subtraction' | 'intersection' | 'xor'
>('union')

// ===================================================
// API
// ===================================================

const api = {
  setOperation(operation: 'union' | 'subtraction' | 'intersection' | 'xor') {
    booleanOperation$.next(operation)
  },

  getOperation() {
    return booleanOperation$.value
  },

  createBooleanGroup(selectedIds: string[]) {
    if (selectedIds.length < 2) {
      console.warn('Need at least 2 elements for boolean operation')
      return null
    }

    // Get elements to calculate bounds
    const elements = selectedIds
      .map((id) => elementApis.getElementById(id))
      .filter(Boolean)

    if (elements.length < 2) return null

    // Calculate bounding box
    const xs = elements.map((e) => e.data.x)
    const ys = elements.map((e) => e.data.y)
    const widths = elements.map((e) => e.data.width)
    const heights = elements.map((e) => e.data.height)

    const bounds = {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) + Math.max(...widths) - Math.min(...xs),
      height: Math.max(...ys) + Math.max(...heights) - Math.min(...ys)
    }

    // Create boolean group element
    const groupId = elementApis.createElement(
      {
        type: 'boolean-group',
        x: bounds.x,
        y: bounds.y,
        width: bounds.width || 100,
        height: bounds.height || 100,
        operation: booleanOperation$.value,
        children: selectedIds
      },
      'boolean-group'
    )

    // Reparent selected elements to boolean group
    // This removes them from workspace and adds as children of boolean-group
    selectedIds.forEach((id) => {
      sceneTree.reparentElement(id, groupId)
    })

    // Select the boolean group
    selectionApis.selectElements([groupId])

    return groupId
  }
}

// ===================================================
// Feature Definition
// ===================================================

const createBooleanGroupFeature = defineFeature(
  'createBooleanGroup',
  'custom.boolean.group',
  {
    priority: 10,
    exclusive: false,
    api,
    execution: {
      handler: (snapshot: SystemContextSnapshot, detail?: any) => {
        const { selectedIds } = snapshot

        if (selectedIds.size >= 2) {
          const groupId = api.createBooleanGroup([...selectedIds])
          return { groupId }
        }

        return null
      }
    }
  }
)

export default createBooleanGroupFeature
```

### 3. UI: Boolean Button (Conditional Rendering)

```typescript
// apps/asyra-design/src/top-tools/BooleanButton.tsx
import { useSelection } from '../../providers/system-context'
import { FeatureSystem } from '@asyra/feature-system'
import { useState, useEffect } from 'react'

export function BooleanButton() {
  const { selectedIds } = useSelection()

  // Import feature
  const createBooleanGroupFeature = FeatureSystem.importFeature('createBooleanGroup')

  // Show button only when 2+ elements selected
  const showButton = selectedIds.size >= 2

  const handleClick = async () => {
    const result = await createBooleanGroupFeature.execute({
      selectedIds: [...selectedIds]
    })

    console.log('Created boolean group:', result)
  }

  if (!showButton) {
    return null
  }

  return (
    <button onClick={handleClick}>
      Boolean ({selectedIds.size})
    </button>
  )
}
```

### 4. UI: Boolean Operation Selector (Content Panel)

```typescript
// apps/asyra-design/src/content/panels/BooleanGroupPanel.tsx
import { useState } from 'react'
import { useProperty } from '../../hooks/useProperty'

export function BooleanGroupPanel({ elementId }: { elementId: string }) {
  const operation = useProperty<string>(elementId, 'operation')
  const [selectedOp, setSelectedOp] = useState(operation || 'union')

  useEffect(() => {
    setSelectedOp(operation || 'union')
  }, [operation])

  const handleOperationChange = (newOp: 'union' | 'subtraction' | 'intersection' | 'xor') => {
    setSelectedOp(newOp)
    elementApis.changeComputedData([elementId], { operation: newOp })
  }

  return (
    <div>
      <label>Operation Type:</label>
      <select
        value={selectedOp}
        onChange={(e) => handleOperationChange(e.target.value as any)}
      >
        <option value="union">Union (Combine)</option>
        <option value="subtraction">Subtraction (Remove)</option>
        <option value="intersection">Intersection (Overlap)</option>
        <option value="xor">XOR (Difference)</option>
      </select>

      <div>
        <strong>Preview:</strong>
        {/* Visual preview of operation */}
      </div>
    </div>
  )
}
```

---

## Summary: How It Works at App Level

```
┌─────────────────────────────────────────────────────────────┐
│  USER ACTION                                                │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  FEATURE (defineFeature)                                    │
│  - Captures user input                                      │
│  - Manages multi-step interactions (drawing, editing)        │
│  - Calls API methods                                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  API (elementApis, selectionApis, custom APIs)             │
│  - Creates/updates/deletes elements                        │
│  - Manages selection                                       │
│  - Updates computed data                                   │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  COMPONENT (defineComponent)                                │
│  - Stores element data                                     │
│  - Has properties registered                                │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  SCENE TREE                                                 │
│  - Manages element hierarchy                               │
│  - Persists data                                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  RENDER LAYER                                               │
│  - Subscribes to scene tree changes                        │
│  - Calls RenderStrategy for each element                    │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  RenderStrategy                                             │
│  - Custom rendering logic for each component type          │
│  - Draws vector paths, boolean operations, etc.             │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  PIXI.JS Graphics (Canvas)                                  │
│  - Actual rendering to canvas                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Points:

1. **User Action** → **Feature** → **API** → **Component** → **Scene Tree** → **Render** → **Canvas**
2. Features (pen-tool, path-edit, create-boolean-group) handle user interactions
3. Components (vector-path, boolean-group) define data structure and rendering
4. All custom code lives in app level, no framework modifications needed
5. Framework provides the infrastructure (defineComponent, defineFeature, event system)
