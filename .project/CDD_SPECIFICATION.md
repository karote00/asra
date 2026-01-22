# Communication-Driven Development (CDD) Specification

**Purpose**: Central specification for Communication-Driven Development patterns and principles

## Core Definition

Communication-Driven Development (CDD) is an **architectural paradigm** where design and interaction of system components are primarily centered around explicit, well-defined communication channels. It is a specific flavor of Event-Driven Architecture (EDA) tailored for interactive applications.

## Fundamental Principles

### 1. Event-Driven Communication

All components communicate via **typed events** (`@asra/reactive-events`). No direct function calls between packages.

#### Event Flow Pattern

```typescript
// Publisher package
import { reactiveEvents } from '@asra/reactive-events'

// Publishing an event
reactiveEvents.publish.executeAction({
  type: 'create-element',
  payload: { elementType: 'rectangle', position: { x: 100, y: 100 } }
})
```

#### Subscriber Pattern

```typescript
// Subscriber package
import { reactiveEvents } from '@asra/reactive-events'

// Subscribing to events
useEffect(() => {
  const unsubscribe = reactiveEvents.subscribe.executeAction((event) => {
    if (event.payload.elementType === 'rectangle') {
      handleRectangleCreation(event.payload)
    }
  })

  return unsubscribe
}, [])
```

### 2. Request-Response Pattern

For synchronous APIs, use dependency injection instead of async/await.

#### Core Request API Structure

```typescript
// In @asra/core
export class CoreRequests {
  // System Context APIs
  systemContext = {
    getSystemContextSnapshot: () => SystemContextSnapshot,
    updateSystemContext: (updates: Partial<SystemContext>) => void
  };

  // Selection APIs
  selection = {
    getElementSelectionIds: () => string[],
    setElementSelection: (elementIds: string[]) => void,
    clearSelection: () => void
  };

  // Scene Tree APIs
  sceneTree = {
    addRectangle: (data: RectangleData, inUndoRedo: boolean) => string,
    addCircle: (data: CircleData, inUndoRedo: boolean) => string,
    updateElement: (elementId: string, updates: Partial<ElementData>) => void,
    deleteElement: (elementId: string) => void
  };
}
```

#### Usage Pattern

```typescript
// Instead of async/await:
// const result = await someApi.doSomething();

// Use synchronous request APIs:
const context = core.requests.systemContext.getSystemContextSnapshot()
const selectedIds = core.requests.selection.getElementSelectionIds()
const elementId = core.requests.sceneTree.addRectangle(data, true)
```

### 3. Transaction Management

All state changes must support undo/redo through `@asra/factory`.

#### Proper Transaction Pattern

```typescript
export class FeatureImplementation {
  async createComplexFeature(data: ComplexData) {
    // Start transaction for undo support
    const transactionId = this.factory.startTransaction()

    try {
      // 1. Create main element
      const mainElementId = this.requests.sceneTree.addRectangle(data.main)

      // 2. Create supporting elements
      const supportingIds = data.supporting.map((item) =>
        this.requests.sceneTree.addCircle(item)
      )

      // 3. Update selection
      this.requests.selection.setElementSelection([
        mainElementId,
        ...supportingIds
      ])

      // 4. Commit transaction
      this.factory.endTransaction()

      return { mainElementId, supportingIds }
    } catch (error) {
      // Rollback all changes
      this.factory.abortTransaction()
      throw error
    }
  }
}
```

### 4. No Direct Package Dependencies

Components must not directly import other packages. Use events and request APIs instead.

#### ❌ Bad - Direct Import Creates Coupling

```typescript
import { SceneTree } from '@asra/scene-tree'

// Direct call creates tight coupling
const result = sceneTree.addElement(data)
```

#### ✅ Good - Event Communication

```typescript
import { reactiveEvents } from '@asra/reactive-events'

// Loose coupling through events
reactiveEvents.publish.addElement({
  type: 'element-creation',
  payload: data
})
```

### 5. Event Flow vs Data Flow

Understanding the distinction between two parallel flows:

#### Event Flow (via `@asra/reactive-events`)

Handles notifications, commands, and decisions. Describes **what happened** or **what should happen**.

#### Data Flow (via YJS/CRDT)

Handles actual application state and collaborative document. Describes **what current state is**.

These two flows work in tandem. Events often signal that data changes have occurred or are about to occur, while direct observation of YJS document provides granular data for updates.

## Package Architecture Compliance

### System Layer

```typescript
// @asra/core - System orchestrator
export class Core {
  requests: CoreRequests

  constructor(
    private eventBus: ReactiveEvents,
    private factory: Factory
  ) {
    this.setupRequestApis()
  }

  private setupRequestApis() {
    // Initialize all request APIs
    this.requests = {
      systemContext: {
        getSystemContextSnapshot: () => this.getSystemContext(),
        updateSystemContext: (updates) => this.updateSystemContext(updates)
      }
      // ... other APIs
    }
  }
}
```

### Data Layer Examples

```typescript
// @asra/scene-tree - Document model management
export class SceneTree {
  subscribeToAddElement(callback: (event: AddElementEvent) => void) {
    return reactiveEvents.subscribe.addElement(callback)
  }

  // Direct YJS observation for data changes
  observeYJSChanges(callback: (yjsUpdate: Y.YEvent) => void) {
    return this.yjsDocument.observe(callback)
  }
}

// @asra/selection - Element selection management
export class Selection {
  observeSelectionChanges(callback: (selectedIds: string[]) => void) {
    return this.selectionYJSObject.observe(() => {
      callback(this.getSelectedIds())
    })
  }
}
```

## Implementation Patterns

### Feature Creation Workflow

1. **Define Event Types** in `@asra/reactive-events`
2. **Set up Event Publishing** in input handling packages
3. **Handle Decisions** in interaction packages
4. **Orchestrate Actions** via core package
5. **Update State** in data packages
6. **Render Changes** in output packages

### Testing CDD Patterns

#### Unit Testing with Mock Events

```typescript
import { renderHook, act } from '@testing-library/react'
import { useFeatureHook } from './useFeatureHook'

describe('useFeatureHook', () => {
  it('should handle element creation events', () => {
    const { result } = renderHook(() => useFeatureHook())

    // Simulate event
    act(() => {
      reactiveEvents.publish.addElement({
        type: 'rectangle',
        position: { x: 100, y: 100 }
      })
    })

    expect(result.current.elements).toHaveLength(1)
    expect(result.current.elements[0].type).toBe('rectangle')
  })
})
```

#### Integration Testing with Request APIs

```typescript
describe('Core Integration', () => {
  it('should create element via request API', async () => {
    const core = new Core(eventBus, factory)

    // Use request API instead of direct method calls
    const elementId = core.requests.sceneTree.addRectangle(
      {
        position: { x: 100, y: 100 },
        size: { width: 50, height: 50 }
      },
      true
    )

    expect(elementId).toBeDefined()
    expect(core.requests.selection.getElementSelectionIds()).toContain(
      elementId
    )
  })
})
```

#### Testing Dynamic Methods

For classes using `Object.assign()` for dynamic method assignment:

```typescript
describe('Core Dynamic Methods', () => {
  it('should handle dynamic method mocking', () => {
    const core = new Core(eventBus, factory)

    // ✅ Use direct assignment instead of spyOn
    core.propsLoadData = vi.fn()

    // Test mocked method
    core.propsLoadData()
    expect(core.propsLoadData).toHaveBeenCalled()
  })
})
```

## Common Violations & Solutions

### 1. Direct Package Dependencies

**Problem**: Direct import creates coupling
**Solution**: Use events and request APIs

### 2. Async/Await in Synchronous Contexts

**Problem**: Breaks request-response pattern
**Solution**: Use synchronous request APIs

### 3. Missing Transaction Management

**Problem**: No undo support
**Solution**: Wrap state changes in transactions

### 4. Improper Event Handling

**Problem**: Missing event subscription cleanup
**Solution**: Use proper unsubscribe patterns

## Quality Gates

### Before Submitting CDD Code

- [ ] No direct package dependencies (use events)
- [ ] All inter-package communication uses typed events
- [ ] Synchronous operations use request APIs
- [ ] State changes are wrapped in transactions
- [ ] YJS observations are properly cleaned up
- [ ] Dynamic methods use direct assignment mocking
- [ ] Tests follow event-driven patterns

### Architecture Validation Script

```typescript
const validateCDDCompliance = (packageContent: PackageContent) => {
  const violations = []

  // Check for direct imports
  if (hasDirectPackageImports(packageContent)) {
    violations.push('Direct package dependencies detected')
  }

  // Check event usage
  if (!usesTypedEvents(packageContent)) {
    violations.push('Missing typed event communication')
  }

  // Check request API usage
  if (!usesRequestAPIs(packageContent)) {
    violations.push('Should use request APIs for synchronous operations')
  }

  return violations
}
```

## Integration Examples

### Adding New UI Package

```typescript
// src/index.ts
export { MyFeatureComponent } from './components/MyFeatureComponent';
export { useMyFeature } from './hooks/useMyFeature';

// Package.json dependencies
{
  "dependencies": {
    "@asra/reactive-events": "workspace:*",
    "@asra/ui-context": "workspace:*",
    "@asra/utils": "workspace:*"
  }
}
```

### Cross-Package Communication

```typescript
// Event Contract Definition in @asra/reactive-events
export interface PropertyUpdateEvent {
  elementId: string
  property: string
  value: any
  oldValue?: any
}

// Publisher Package
export class PropertyPanel {
  onPropertyChange(elementId: string, property: string, value: any) {
    reactiveEvents.publish.propertyUpdate({
      elementId,
      property,
      value,
      oldValue: this.currentValues[elementId]?.[property]
    })
  }
}

// Subscriber Package
export class ElementRenderer {
  constructor() {
    reactiveEvents.subscribe.propertyUpdate((event) => {
      this.updateElementDisplay(event.elementId, event.property, event.value)
    })
  }
}
```

## Benefits of CDD

### 1. Loose Coupling

Components can evolve independently without breaking each other

### 2. Clear Communication

Event contracts make data flow explicit and traceable

### 3. Testability

Events can be easily mocked and tested in isolation

### 4. Scalability

New components can be added without affecting existing ones

### 5. Collaboration Support

YJS-based state management enables real-time synchronization

## References

- **Official Documentation**: [https://cdd-docs.vercel.app/](https://cdd-docs.vercel.app/)
- **Asra Implementation**: See `AI_ESSENTIALS.md` for project-specific patterns
- **Architecture Details**: See `ARCHITECTURE.md` for package structure
- **Implementation Examples**: See workflow files in `.project/workflows/`

---

**This specification serves as the central reference for Communication-Driven Development patterns in the Asra project. All workflows, code, and documentation should reference this file for CDD guidance.**
