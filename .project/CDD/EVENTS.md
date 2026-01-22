# CDD Event-Driven Communication

**Purpose**: Specification for event-driven communication patterns in Communication-Driven Development

## Core Event Types

### 1. Action Events

Commands and user interactions that trigger system behavior.

```typescript
export interface ExecuteActionEvent {
  type: 'create-element' | 'delete-element' | 'modify-element'
  payload: {
    elementType?: 'rectangle' | 'circle' | 'polygon'
    elementId?: string
    data?: Partial<ElementData>
  }
}
```

### 2. Decision Events

System decisions about what should happen next.

```typescript
export interface DecideToCreateElementEvent {
  elementType: 'rectangle' | 'circle' | 'polygon'
  position: { x: number; y: number }
  properties?: Partial<ElementProperties>
}
```

### 3. State Change Events

Notifications about state modifications.

```typescript
export interface ElementStateChangedEvent {
  elementId: string
  property: string
  oldValue: any
  newValue: any
}
```

## Event Publishing Pattern

```typescript
// Publisher package
import { reactiveEvents } from '@asra/reactive-events'

export class InputHandler {
  onCanvasClick(position: Point) {
    // Publish decision event
    reactiveEvents.publish.decideToCreateElement({
      elementType: this.currentTool,
      position
    })
  }

  onToolbarAction(tool: string) {
    // Publish action event
    reactiveEvents.publish.executeAction({
      type: 'modify-element',
      payload: { action: 'select-tool', data: { tool } }
    })
  }
}
```

## Event Subscription Pattern

```typescript
// Subscriber package
import { reactiveEvents } from '@asra/reactive-events'

export class InteractionCore {
  private unsubscribeFunctions: (() => void)[] = []

  constructor() {
    // Subscribe to decisions
    const unsubscribeDecisions = reactiveEvents.subscribe.decideToCreateElement(
      (event) => {
        this.handleElementCreationDecision(event)
      }
    )

    // Subscribe to actions
    const unsubscribeActions = reactiveEvents.subscribe.executeAction(
      (event) => {
        this.handleAction(event)
      }
    )

    this.unsubscribeFunctions = [unsubscribeDecisions, unsubscribeActions]
  }

  ngOnDestroy() {
    this.unsubscribeFunctions.forEach((unsubscribe) => unsubscribe())
  }

  private handleElementCreationDecision(event: DecideToCreateElementEvent) {
    // Implementation logic
  }
}
```

## Event Best Practices

### 1. Typed Event Contracts

Always define clear interfaces for event payloads.

```typescript
// ✅ Good - Clear typing
export interface CreateElementEvent {
  elementType: string;
  position: Point;
  properties?: Record<string, any>;
}

// ❌ Bad - Untyped payloads
reactiveEvents.publish.someEvent({
  data: /* unknown structure */
});
```

### 2. Event Naming Conventions

Use clear, descriptive event names:

- **Decision Events**: `decideTo...` (e.g., `decideToCreateElement`)
- **Action Events**: `execute...` (e.g., `executeAction`)
- **State Events**: `element...` (e.g., `elementStateChanged`)

### 3. Unsubscribe Management

Always handle cleanup to prevent memory leaks:

```typescript
// ✅ Good - Proper cleanup
export class Component {
  private unsubscribers: (() => void)[] = []

  ngOnInit() {
    const unsub1 = reactiveEvents.subscribe.someEvent(handler1)
    const unsub2 = reactiveEvents.subscribe.someEvent(handler2)

    this.unsubscribers = [unsub1, unsub2]
  }

  ngOnDestroy() {
    this.unsubscribers.forEach((unsub) => unsub())
  }
}
```

### 4. Event Payload Validation

Validate event payloads before processing:

```typescript
export class EventValidator {
  static validateCreateElementEvent(event: CreateElementEvent): boolean {
    return (
      event.elementType &&
      event.position &&
      typeof event.position.x === 'number' &&
      typeof event.position.y === 'number'
    )
  }
}
```

## Integration Points

### Input System Events

```typescript
// @asra/input-system
export class InputSystem {
  onKeyboardShortcut(combo: string, modifiers: string[]) {
    reactiveEvents.publish.executeAction({
      type: 'keyboard-shortcut',
      payload: { combo, modifiers }
    })
  }

  onMouseAction(position: Point, button: string) {
    reactiveEvents.publish.executeAction({
      type: 'mouse-action',
      payload: { position, button }
    })
  }
}
```

### Core Orchestration Events

```typescript
// @asra/core
export class Core {
  constructor() {
    // Subscribe to decisions
    reactiveEvents.subscribe.decideToCreateElement((event) => {
      this.orchestrateElementCreation(event)
    })
  }

  private orchestrateElementCreation(event: DecideToCreateElementEvent) {
    // Start transaction
    this.factory.startTransaction()

    try {
      // Execute action
      const elementId = this.requests.sceneTree.addRectangle(event)

      // Publish state change
      reactiveEvents.publish.elementStateChanged({
        elementId,
        property: 'created',
        newValue: elementId
      })

      // End transaction
      this.factory.endTransaction()
    } catch (error) {
      this.factory.abortTransaction()
      throw error
    }
  }
}
```

---

**This specification covers all event-driven communication patterns for CDD implementation.**
