# Framework Enhancement Needed for Custom Graphic Features

**Date:** 2025-02-19
**Status:** Architecture Analysis
**Type:** Enhancement Requirements

---

## Executive Summary

Based on the investigation of Pen Tool (Vector Path) and Boolean Operations features, the Asyra framework provides infrastructure but requires **3 key enhancements** to fully support user-defined custom graphics with proper layering, state management, and interactions.

**Conclusion:** All 3 enhancements require framework changes.

**Important Clarification:**

- **PropertyRegistry** exists for UI data collection only (Content Panel property definitions)
- **StateRegistry** (NEW) is needed for feature-level state machines (pen tool phases, anchor selection, etc.)
- These serve different purposes and are separate concerns

---

## Current Framework Capabilities

### ✅ Already Supported

#### 1. Render Strategy Registration

```typescript
import { renderRegistry } from '@asyra/render'
import type { RenderStrategy } from '@asyra/render'

// Custom render strategy works perfectly
const myRenderStrategy: RenderStrategy = (
  graphic: Graphics,
  data: RenderElementData
) => {
  // Custom rendering logic for vector paths, complex shapes, etc.
  graphic.clear()
  // ... render logic
}

// Register it
renderRegistry.register('vector-path', myRenderStrategy)
```

**Status:** ✅ Fully supported, works as-is

#### 2. Component Definition

```typescript
import { defineComponent } from '@asyra/core'

defineComponent({
  type: 'vector-path',
  idPrefix: 'vector-path',
  namePrefix: 'Vector Path',
  properties: [
    { name: 'anchorPoints', type: PropertyTypes.CUSTOM },
    { name: 'closed', type: PropertyTypes.CUSTOM }
  ],
  renderStrategy: myRenderStrategy
})
```

**Status:** ✅ Fully supported, works as-is

#### 3. Feature System for Interactions

```typescript
import { defineFeature } from '@asyra/feature-system'

const penToolFeature = defineFeature('penTool', 'input.drag', {
  session: {
    onStart: (snapshot) => {
      /* ... */
    },
    onUpdate: (snapshot, state) => {
      /* ... */
    },
    onEnd: (snapshot, state) => {
      /* ... */
    }
  }
})
```

**Status:** ✅ Fully supported, works as-is

---

## Required Framework Enhancements

### ❌ 1. Custom Render Layer Registration

**Problem:** Currently only two hardcoded layers exist (ViewportLayer, SelectionLayer). No way to add custom layers for overlays (e.g., anchor point handles, bezier curve previews, boolean operation previews).

**Current Implementation:**

```typescript
// packages/render/src/render.ts
class Render {
  viewport: ViewportLayer    // Hardcoded
  selection: SelectionLayer  // Hardcoded

  constructor() {
    this.viewport = new ViewportLayer()
    this.selection = new SelectionLayer({...})
  }

  private _setupStageLayers() {
    this.app?.stage.addChild(this.viewport.view)  // Hardcoded
    this.app?.stage.addChild(this.selection.view) // Hardcoded
  }

  updateLayers() {
    this.selection.update()  // Only updates selection
    // No way to update custom layers
  }
}
```

**Required Enhancement:**

```typescript
// packages/render/src/types/render-layer.ts (NEW)
export interface RenderLayerRegistration {
  name: string
  layer: RenderLayer
  zIndex?: number // Determines draw order
  update?: () => void // Optional update method called on each tick
}

// packages/render/src/render-layer-registry.ts (NEW)
class RenderLayerRegistry {
  private layers = new Map<string, RenderLayerRegistration>()

  register(registration: RenderLayerRegistration): void {
    this.layers.set(registration.name, registration)
  }

  unregister(name: string): boolean {
    return this.layers.delete(name)
  }

  get(name: string): RenderLayerRegistration | undefined {
    return this.layers.get(name)
  }

  getAll(): RenderLayerRegistration[] {
    return Array.from(this.layers.values()).sort(
      (a, b) => (a.zIndex || 0) - (b.zIndex || 0)
    )
  }
}

export const renderLayerRegistry = new RenderLayerRegistry()
export default renderLayerRegistry

// packages/render/src/render.ts (MODIFIED)
class Render {
  private customLayers: RenderLayerRegistration[] = []

  private _setupStageLayers() {
    // Add default layers
    this.app?.stage.addChild(this.viewport.view)
    this.app?.stage.addChild(this.selection.view)

    // Add custom layers
    const customLayers = renderLayerRegistry.getAll()
    this.customLayers = customLayers
    customLayers.forEach((layer) => {
      this.app?.stage.addChild(layer.layer.view)
    })
  }

  updateLayers() {
    this.selection.update()

    // Update custom layers
    this.customLayers.forEach((layer) => {
      if (layer.update) {
        layer.update()
      }
    })
  }
}
```

**Example Usage:**

```typescript
// App level
import { renderLayerRegistry } from '@asyra/render'

// Create anchor point overlay layer
class AnchorPointLayer extends RenderLayer {
  constructor() {
    super()
  }

  update() {
    // Re-render anchor points when elements change
    this.clear()
    this.renderAnchorPoints()
  }
}

const anchorLayer = new AnchorPointLayer()

renderLayerRegistry.register({
  name: 'anchor-points',
  layer: anchorLayer,
  zIndex: 100, // Draw on top of elements
  update: () => anchorLayer.update()
})
```

---

### ❌ 2. Custom State Management (Feature State Machines)

**Problem:** No way to register custom observables for feature-level state (e.g., pen tool phase, selected anchor point, boolean operation preview mode). Features need state management for their own logic.

**Important Distinction:**

- **PropertyRegistry**: For UI data collection ONLY. Used by Content Panel to know what properties to display for elements. Read-only, static definitions.
- **StateRegistry** (NEW): For feature-level state machines. Used by features (pen-tool, path-edit, etc.) to manage multi-phase interactions and transient state.

These serve **different purposes**:

- PropertyRegistry describes WHAT properties exist for UI display
- StateRegistry manages HOW features work through state transitions

**Current Implementation:**

```typescript
// packages/props-manager/src/property-registry.ts
class PropertyRegistry {
  // Only supports reading property definitions
  getPropertiesForComponent(componentType: string): PropertyDefinition[] {
    // Returns static property definitions for UI panel
  }
}

// No StateRegistry exists for feature state management
```

**Required Enhancement - Separate StateRegistry**

```typescript
// packages/props-manager/src/state-registry.ts (NEW)
interface StateRegistration {
  name: string
  observable: Observable<unknown>
  initialValue: unknown
}

class StateRegistry {
  private states = new Map<string, StateRegistration>()

  register(
    name: string,
    initialValue: unknown,
    observable?: Observable<unknown>
  ): void {
    const obs = observable || new BehaviorSubject(initialValue)

    this.states.set(name, {
      name,
      observable: obs,
      initialValue
    })
  }

  unregister(name: string): boolean {
    return this.states.delete(name)
  }

  getObservable(name: string): Observable<unknown> | undefined {
    return this.states.get(name)?.observable
  }

  getValue(name: string): unknown {
    return this.states.get(name)?.observable?.value
  }

  setValue(name: string, value: unknown): void {
    const state = this.states.get(name)
    if (state?.observable instanceof BehaviorSubject) {
      state.observable.next(value)
    }
  }
}

export const stateRegistry = new StateRegistry()
export default stateRegistry

// packages/props-manager/src/index.ts (MODIFIED)
export { stateRegistry } from './state-registry'
```

**Example Usage:**

```typescript
// App level
import { stateRegistry } from '@asyra/props-manager'
import { BehaviorSubject } from 'rxjs'

// Register pen tool phase state
const penPhase$ = new BehaviorSubject<'idle' | 'drawing' | 'editing'>('idle')
stateRegistry.register('penPhase', 'idle', penPhase$)

// Subscribe to changes
const penPhase = stateRegistry.getObservable('penPhase')
penPhase?.subscribe((phase) => {
  console.log('Pen phase:', phase)
})

// Update state
stateRegistry.setValue('penPhase', 'drawing')
```

---

### ❌ 3. Custom Interaction Handlers for User Graphics

**Problem:** ElementInteractionHandler is hardcoded to use `ElementInteractionHandlers.handlePointerHover` and `handlePointerLeave`. No way to register custom handlers for specific element types (e.g., hit detection on anchor points, handle dragging for bezier curves).

**Current Implementation:**

```typescript
// packages/render/src/render-layer/element-interaction-handler.ts
export class ElementInteractionHandler {
  bindElementEvents(element: Container | Graphics) {
    element.eventMode = 'static'
    element.cursor = 'pointer'

    // Hardcoded handlers
    element.on('pointerenter', (e) => this.handlePointerEnter(element, e))
    element.on('pointerleave', (e) => this.handlePointerLeave(element, e))
  }

  private handlePointerEnter(element, e) {
    // Always calls handlePointerHover
    ElementInteractionHandlers.handlePointerHover(elementId)
  }
}
```

**Required Enhancement:**

```typescript
// packages/render/src/types/interaction-handler.ts (NEW)
export type InteractionHandler = (
  elementId: string,
  event: FederatedPointerEvent
) => void

export interface InteractionRegistration {
  eventType:
    | 'pointerenter'
    | 'pointerleave'
    | 'pointerdown'
    | 'pointerup'
    | 'pointermove'
  handler: InteractionHandler
  priority?: number // Higher = runs first
}

export type InteractionHandlerMap = Record<string, InteractionRegistration[]>

// packages/render/src/interaction-handler-registry.ts (NEW)
class InteractionHandlerRegistry {
  private handlers: InteractionHandlerMap = {}

  register(
    elementId: string | RegExp, // Can target specific element ID or pattern
    registration: InteractionRegistration
  ): void {
    if (!this.handlers[elementId]) {
      this.handlers[elementId] = []
    }
    this.handlers[elementId].push(registration)
  }

  unregister(elementId: string, eventType: string): void {
    if (this.handlers[elementId]) {
      delete this.handlers[elementId]
    }
  }

  get(elementId: string, eventType: string): InteractionRegistration[] {
    // Check for exact match
    if (this.handlers[elementId]) {
      return (
        this.handlers[elementId]?.filter((h) => h.eventType === eventType) || []
      )
    }

    // Check for pattern matches (e.g., 'anchor-*' pattern)
    const results: InteractionRegistration[] = []
    for (const [pattern, handlers] of Object.entries(this.handlers)) {
      if (
        pattern.includes('*') &&
        elementId.match(pattern.replace('*', '.*'))
      ) {
        results.push(...handlers.filter((h) => h.eventType === eventType))
      }
    }

    return results.sort((a, b) => (b.priority || 0) - (a.priority || 0))
  }
}

export const interactionHandlerRegistry = new InteractionHandlerRegistry()
export default interactionHandlerRegistry

// packages/render/src/render-layer/element-interaction-handler.ts (MODIFIED)
export class ElementInteractionHandler {
  bindElementEvents(element: Container | Graphics, customHandlers = true) {
    element.eventMode = 'static'
    element.cursor = 'pointer'

    // Register custom handlers first
    if (customHandlers) {
      this.bindCustomHandlers(element)
    }

    // Always register default handlers
    element.on('pointerenter', (e) => this.handlePointerEnter(element, e))
    element.on('pointerleave', (e) => this.handlePointerLeave(element, e))
  }

  private bindCustomHandlers(element: Container | Graphics) {
    const elementId = element.label as string

    // Register all event types
    const eventTypes = [
      'pointerdown',
      'pointerup',
      'pointermove',
      'click',
      'dblclick'
    ]

    eventTypes.forEach((eventType) => {
      element.on(eventType, (e) =>
        this.handleCustomEvent(elementId, eventType, e)
      )
    })
  }

  private handleCustomEvent(
    elementId: string,
    eventType: string,
    event: FederatedPointerEvent
  ) {
    const handlers = interactionHandlerRegistry.get(elementId, eventType)

    handlers.forEach((registration) => {
      registration.handler(elementId, event)
    })
  }

  private handlePointerEnter(element, e) {
    const elementId = element.label as string
    if (elementId) {
      ElementInteractionHandlers.handlePointerHover(elementId)
    }
  }

  private handlePointerLeave(element, e) {
    const elementId = element.label as string
    if (elementId) {
      ElementInteractionHandlers.handlePointerLeave(elementId)
    }
  }
}
```

**Example Usage:**

```typescript
// App level
import { interactionHandlerRegistry } from '@asyra/render'

// Register handler for anchor point elements
interactionHandlerRegistry.register('anchor-*', {
  eventType: 'pointerdown',
  handler: (elementId, event) => {
    console.log('Anchor point clicked:', elementId)
    // Start dragging anchor point
    startAnchorPointDrag(elementId)
  },
  priority: 100 // High priority
})

// Register handler for bezier handles
interactionHandlerRegistry.register('handle-in-*', {
  eventType: 'pointermove',
  handler: (elementId, event) => {
    // Update handle position while dragging
    updateHandlePosition(elementId, event.global.x, event.global.y)
  }
})
```

---

### ✅ 4. Render Logic Registration (Already Works)

**Status:** No enhancement needed. renderRegistry provides everything needed.

---

## Use Cases for Each Enhancement

### Use Case 1: Pen Tool Anchor Point Overlay

**Requirements:**

- Custom render layer for anchor points and handles
- Custom state for pen phase (drawing/editing)
- Custom interaction for anchor point/handle dragging

```typescript
// 1. Register custom render layer
class AnchorPointLayer extends RenderLayer {
  update() {
    this.clear()
    const editingPath = stateRegistry.getValue('editingPath')
    if (editingPath) {
      this.renderAnchorPoints(editingPath)
    }
  }
}

renderLayerRegistry.register({
  name: 'anchor-points',
  layer: new AnchorPointLayer(),
  zIndex: 100
})

// 2. Register custom state
stateRegistry.register('editingPath', null, new BehaviorSubject(null))
stateRegistry.register('penPhase', 'idle', new BehaviorSubject('idle'))

// 3. Register custom interactions
interactionHandlerRegistry.register('anchor-*', {
  eventType: 'pointerdown',
  handler: (elementId, event) => {
    startAnchorDrag(elementId)
  }
})

interactionHandlerRegistry.register('anchor-*', {
  eventType: 'pointermove',
  handler: (elementId, event) => {
    updateAnchorPosition(elementId, event.global.x, event.global.y)
  }
})
```

### Use Case 2: Boolean Operation Preview

**Requirements:**

- Custom render layer for preview mode
- Custom state for operation type selection
- Custom interactions for operation selection

```typescript
// 1. Register preview overlay layer
class BooleanPreviewLayer extends RenderLayer {
  update() {
    this.clear()
    const selectedIds = selectionApis.getSelectedIds()
    const operation = stateRegistry.getValue('booleanOperation')

    if (selectedIds.size >= 2) {
      this.renderBooleanPreview(selectedIds, operation)
    }
  }
}

renderLayerRegistry.register({
  name: 'boolean-preview',
  layer: new BooleanPreviewLayer(),
  zIndex: 150 // On top of anchor points
})

// 2. Register operation type state
stateRegistry.register(
  'booleanOperation',
  'union',
  new BehaviorSubject('union')
)
```

---

## Implementation Priority

### Phase 1: Critical for Pen Tool

1. **Custom Render Layer Registration** - Required for anchor point overlay
2. **Custom Interaction Handlers** - Required for point/handle manipulation

### Phase 2: Critical for Complex Features

3. **Custom State Management** - Required for multi-phase tools, preview modes

### Phase 3: Nice to Have

4. **Layer Update Optimization** - Only update layers when relevant state changes

---

## Architecture Impact

### Changes Required

1. **New Files:**
   - `packages/render/src/types/render-layer.ts`
   - `packages/render/src/render-layer-registry.ts`
   - `packages/props-manager/src/state-registry.ts` (SEPARATE from PropertyRegistry)
   - `packages/render/src/types/interaction-handler.ts`
   - `packages/render/src/interaction-handler-registry.ts`

2. **Modified Files:**
   - `packages/render/src/render.ts` - Support custom layers
   - `packages/render/src/render-layer/element-interaction-handler.ts` - Support custom handlers

3. **NOT Modified:**
   - `packages/props-manager/src/property-registry.ts` - No changes, remains for UI data collection only

4. **API Surface:**
   - `renderLayerRegistry.register()`
   - `stateRegistry.register()`
   - `interactionHandlerRegistry.register()`

5. **API Surface:**
   - `renderLayerRegistry.register()`
   - `stateRegistry.register()`
   - `interactionHandlerRegistry.register()`

### Backward Compatibility

- All changes are **additive** - no breaking changes
- Existing code continues to work unchanged
- Features only activate when users register custom layers/handlers

---

## Conclusion

**Summary of Enhancements Needed:**

| Enhancement                    | Status               | Effort | Priority | Notes                                                                     |
| ------------------------------ | -------------------- | ------ | -------- | ------------------------------------------------------------------------- |
| 1. Render Layer Registration   | ❌ Not supported     | Medium | HIGH     | For overlays (anchor points, handles, previews)                           |
| 2. Custom State Management     | ❌ Not supported     | Low    | HIGH     | StateRegistry for feature state machines (SEPARATE from PropertyRegistry) |
| 3. Custom Interaction Handlers | ❌ Not supported     | Medium | HIGH     | For custom element interactions (anchor/handle dragging)                  |
| 4. Render Logic Registration   | ✅ Already supported | None   | N/A      | RenderRegistry works as-is                                                |

**Total Implementation Effort:** ~300-500 lines across 5 new files + modifications to 2 existing files

**Key Architecture Decision:**

- **PropertyRegistry**: For UI data collection (static property definitions)
- **StateRegistry** (NEW): For feature-level state machines (dynamic, multi-phase interactions)
- Do NOT mix these concerns - they serve different purposes

**Recommendation:**
Implement all 3 enhancements before starting Pen Tool development. They provide the foundation for all custom graphic features (pen tool, boolean operations, and future features like path operations, smart guides, etc.).

**Next Steps:**

1. Implement RenderLayerRegistry in render package
2. Implement StateRegistry in props-manager package
3. Implement InteractionHandlerRegistry in render package
4. Update documentation
5. Write tests for new APIs
