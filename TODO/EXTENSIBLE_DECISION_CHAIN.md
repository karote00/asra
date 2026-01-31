# EXTENSIBLE_DECISION_CHAIN.md

## Problem: Cannot Add New Features

User needs to add NEW features (e.g., "draw polygon") which requires NEW decision types.

### Current Architecture Limitations

**Bottleneck 1: Hardcoded InteractionEvent** (`@asyra/utils`)

```typescript
// ❌ Cannot extend - enum is closed
export enum ElementInteraction {
  INTERACTION_CREATE_ELEMENT = 'INTERACTION_CREATE_ELEMENT'
  // ❌ Cannot add: INTERACTION_DRAW_POLYGON
}
```

**Bottleneck 2: Hardcoded Reactive-Events** (`@asyra/reactive-events`)

```typescript
// ❌ Cannot extend - static exports only
export const subscribeToDecideToCreateElement =
  createSubscribeEvent<DecideToCreateElementEvent>(
    EventTypes.DECIDE_TO_CREATE_ELEMENT
  )
// ❌ No way to add: subscribeToDecideToDrawPolygon
```

**Bottleneck 3: Hardcoded Decision Handlers** (`@asyra/core/src/subscribes/interaction-core/`)

```typescript
// ❌ Cannot extend - static imports only
subscribeToDecideToCreateElement(({ payload }) => {
  // Execute side effect
})
// ❌ No way to add custom handler for new decision type
```

### User Cannot Create New Features

```typescript
// ❌ BLOCKED: User wants "draw polygon" feature
inputSystemRegistry.register('input.draw.polygon.start', combos) // ✅ Can add input
// ⚠️ Need: INTERACTION_DRAW_POLYGON decision (cannot add)
// ⚠️ Need: Handler to execute "draw polygon" (cannot add)
// ⚠️ Need: Reactive-event to emit (cannot add)
```

## Solution: Extensible Decision Chain

### Goal

Users can add NEW decision types + NEW handlers without modifying framework

### Architecture Changes

#### 1. Extend InteractionEvent Types (`@asyra/utils`)

```typescript
// ✅ From enum → const object (extensible)
export const InteractionActions = {
  INTERACTION_CREATE_ELEMENT: 'INTERACTION_CREATE_ELEMENT',
  INTERACTION_DRAW_POLYGON: 'INTERACTION_DRAW_POLYGON' // User can add
} as const

export type InteractionEvent = string // ✅ Open type
```

#### 2. Make Reactive-Events Extensible (`@asyra/reactive-events`)

```typescript
// ✅ Add dynamic event registry
import { eventBus } from './event-bus'

export class DecisionEventRegistry {
  register<T>(eventName: string) {
    eventBus.add(eventName)
    return {
      subscribe: (handler: (event: T) => void) =>
        eventBus.on(eventName, handler)
    }
  }
}

export const decisionEventRegistry = new DecisionEventRegistry()

// ✅ User can register custom decision events
const drawPolygonEvents = decisionEventRegistry.register<{
  vertices: Point[]
}>('INTERACTION_DRAW_POLYGON')

drawPolygonEvents.subscribe(({ vertices }) => {
  // Execute custom side effect
})
```

#### 3. Extensible Decision Handlers (`@asyra/core`)

```typescript
// ✅ Add HandlerRegistry
export class HandlerRegistry {
  private handlers = new Map<string, (detail: any) => void>()

  register(eventName: string, handler: (detail: any) => void) {
    this.handlers.set(eventName, handler)
  }

  init() {
    for (const [eventName, handler] of this.handlers) {
      eventBus.on(eventName, handler)
    }
  }
}

export const handlerRegistry = new HandlerRegistry()
```

#### 4. Update Initialization Flow

```typescript
// apps/asyra-design/src/init-handlers.ts
import { handlerRegistry, decisionEventRegistry } from '@asyra/core'

// ✅ User registers custom decision type
decisionEventRegistry.register('INTERACTION_DRAW_POLYGON')

// ✅ User registers custom handler
handlerRegistry.register('INTERACTION_DRAW_POLYGON', ({ vertices }) => {
  // Execute draw polygon
  renderService.drawPolygon(vertices)
})
```

## Implementation Steps

### Phase 1: Extensible InteractionEvents

- [ ] Change `interaction-types.ts` from enum to const object
- [ ] Change `InteractionEvent` type to `string` (open type)
- [ ] Keep existing interaction events for backward compatibility

### Phase 2: Dynamic Reactive-Events

- [ ] Add `DecisionEventRegistry` class to `@asyra/reactive-events`
- [ ] Export `decisionEventRegistry` singleton
- [ ] Update `InteractionCore` to use registry for dispatching
- [ ] Add `dispatch()` method to emit custom events

### Phase 3: Extensible Handlers

- [ ] Add `HandlerRegistry` class to `@asyra/core`
- [ ] Move existing `initInteractionCoreHandlers` to use registry
- [ ] Export `handlerRegistry` singleton
- [ ] Call `handlerRegistry.init()` after all handlers registered

### Phase 4: User API

- [ ] Export `decisionEventRegistry` and `handlerRegistry` from `@asyra/core`
- [ ] Add documentation for registering custom decisions
- [ ] Add examples to app init

## Example: User Adds "Draw Polygon" Feature

```typescript
// apps/asyra-design/src/init/draw-polygon-feature.ts

// 1. Register input events (already possible)
import { inputSystemRegistry } from '@asyra/input-system'
import { InputEventCombo } from '@asyra/utils'

inputSystemRegistry.register('input.draw.polygon.start', [
  { key: KeyboardKey.KEY_P, modifiers: { ctrl: true } }
])

// 2. Register workflow (already possible)
import { workflowRegistry } from '@asyra/core'

workflowRegistry.register('input.draw.polygon.start', {
  contextUpdate: (core, raw) => {
    core.updateMouseState(raw.pointer)
  },
  coreAPI: 'executeAction',
  APIArgs: () => ['interaction.draw.polygon.start']
})

// 3. Register custom decision type with interaction-core (NEW!)
import { interactionRegistry } from '@asyra/interaction-core'

interactionRegistry.register(
  'interaction.draw.polygon.start',
  (context, detail) => {
    // custom decision logic
    return {
      type: 'INTERACTION_DRAW_POLYGON',
      payload: { vertices: calculateVertices(context) }
    }
  }
)

// 4. Register custom handler for decision (NEW!)
import { handlerRegistry } from '@asyra/core'

handlerRegistry.register('INTERACTION_DRAW_POLYGON', ({ vertices }) => {
  renderService.drawPolygon(vertices)
})

// 5. Register reactive-event type (NEW!)
import { decisionEventRegistry } from '@asyra/core'

decisionEventRegistry.register<{ vertices: Point[] }>(
  'INTERACTION_DRAW_POLYGON'
)
```

## Execution Flow

```
User Input (Ctrl+P)
  ↓
InputSystem emits: 'input.draw.polygon.start'
  ↓
Workflow: contextUpdate → core.executeAction('interaction.draw.polygon.start')
  ↓
InteractionCore.decide() → returns 'INTERACTION_DRAW_POLYGON' (NEW!)
  ↓
dispatchSession() → emits reactive-event (via decisionEventRegistry)
  ↓
Custom handler executes: drawPolygon(vertices) (via handlerRegistry)
```

## Benefits

1. **Fully Extensible** - Users can add ANY custom feature
2. **Preserves Core Invariant** - All decisions still go through InteractionCore
3. **No Framework Changes** - Users don't modify framework files
4. **Type Safety** - Custom handlers typed correctly
5. **Layered Architecture** - Clear separation of concerns:
   - Layer 1: Input → Workflow
   - Layer 2: Decision → InteractionCore
   - Layer 3: Execution → Handlers

## Migration Path

### Backward Compatibility

- Existing interaction events still work
- Existing handlers still work
- No breaking changes for current features

### Gradual Adoption

- Users can adopt new extensibility system incrementally
- Old handlers can coexist with new registry-based handlers
- Eventually migrate all to registry (optional)

## Testing Strategy

- [ ] Test existing features still work
- [ ] Test user can add new decision type
- [ ] Test user can add new handler
- [ ] Test Core Invariant preserved
- [ ] Test type safety with custom handlers
