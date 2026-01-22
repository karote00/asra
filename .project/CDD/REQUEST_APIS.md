# CDD Request-Response APIs

**Purpose**: Specification for synchronous API patterns in Communication-Driven Development

## Core Request API Principles

### 1. Synchronous Execution

Request APIs return immediately without async/await patterns.

```typescript
// ✅ Good - Synchronous
const elementId = core.requests.sceneTree.addRectangle(data, true)

// ❌ Bad - Async for sync operation
const elementId = await core.requests.sceneTree.addRectangle(data, true)
```

### 2. Dependency Injection

Request APIs are injected into consumer packages.

```typescript
// Core package
export class Core {
  requests: CoreRequests

  constructor() {
    this.requests = {
      sceneTree: this.createSceneTreeRequests(),
      selection: this.createSelectionRequests(),
      systemContext: this.createSystemContextRequests()
    }
  }

  private createSceneTreeRequests() {
    return {
      addRectangle: (data, inUndoRedo) =>
        this.sceneTree.addRectangle(data, inUndoRedo),
      updateElement: (id, updates) => this.sceneTree.updateElement(id, updates),
      deleteElement: (id) => this.sceneTree.deleteElement(id)
    }
  }
}

// Consumer package
export class Uicomponent {
  constructor(private core: Core) {
    // Direct access to synchronous APIs
    this.elementId = core.requests.sceneTree.addRectangle(data, true)
    this.selectedIds = core.requests.selection.getElementSelectionIds()
  }
}
```

## Request API Patterns

### 1. System Context Requests

```typescript
export interface SystemContextRequests {
  getSystemContextSnapshot(): SystemContextSnapshot
  updateSystemContext(updates: Partial<SystemContext>): void
  getCurrentTool(): string
  setCurrentTool(tool: string): void
}

// Implementation
export class SystemContextService {
  private context: SystemContext = {}

  getSystemContextSnapshot(): SystemContextSnapshot {
    return { ...this.context }
  }

  updateSystemContext(updates: Partial<SystemContext>): void {
    Object.assign(this.context, updates)

    // Publish change event
    reactiveEvents.publish.systemContextChanged({
      updates,
      newContext: this.context
    })
  }
}
```

### 2. Selection Requests

```typescript
export interface SelectionRequests {
  getElementSelectionIds(): string[]
  setElementSelection(elementIds: string[]): void
  clearSelection(): void
  addToSelection(elementIds: string[]): void
  removeFromSelection(elementIds: string[]): void
  getSelectionBounds(): Rectangle | null
}

// Implementation
export class SelectionService {
  private selectedIds: Set<string> = new Set()

  getElementSelectionIds(): string[] {
    return Array.from(this.selectedIds)
  }

  setElementSelection(elementIds: string[]): void {
    const previousSelection = Array.from(this.selectedIds)
    this.selectedIds = new Set(elementIds)

    // Publish selection change event
    reactiveEvents.publish.selectionChanged({
      previousIds: previousSelection,
      newIds: elementIds
    })
  }

  addToSelection(elementIds: string[]): void {
    elementIds.forEach((id) => this.selectedIds.add(id))
    this.publishSelectionChange()
  }
}
```

### 3. Scene Tree Requests

```typescript
export interface SceneTreeRequests {
  addRectangle(data: RectangleData, inUndoRedo: boolean): string
  addCircle(data: CircleData, inUndoRedo: boolean): string
  addPolygon(data: PolygonData, inUndoRedo: boolean): string
  updateElement(elementId: string, updates: Partial<ElementData>): void
  deleteElement(elementId: string): void
  getElement(elementId: string): Element | null
  getAllElements(): Element[]
}

// Implementation
export class SceneTreeService {
  addRectangle(data: RectangleData, inUndoRedo: boolean): string {
    const elementId = this.generateElementId()

    // Create element
    const rectangle = new Rectangle(elementId, data)
    this.elements.set(elementId, rectangle)

    // Publish creation event
    reactiveEvents.publish.elementCreated({
      elementId,
      type: 'rectangle',
      data,
      inUndoRedo
    })

    return elementId
  }

  updateElement(elementId: string, updates: Partial<ElementData>): void {
    const element = this.elements.get(elementId)
    if (!element) return

    // Update element
    Object.assign(element, updates)

    // Publish update event
    reactiveEvents.publish.elementUpdated({
      elementId,
      updates,
      previousState: element.getPreviousState()
    })
  }
}
```

## Request API Best Practices

### 1. Input Validation

Validate request parameters before processing.

```typescript
export class RequestValidator {
  static validateRectangleData(data: RectangleData): ValidationResult {
    const errors: string[] = [];

    if (!data.position || typeof data.position.x !== 'number') {
      errors.push('Invalid position data');
    }

    if (data.size && (data.size.width <= 0 || data.size.height <= 0)) {
      errors.push('Invalid size dimensions');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Usage in request API
addRectangle(data: RectangleData, inUndoRedo: boolean): string {
  const validation = RequestValidator.validateRectangleData(data);
  if (!validation.isValid) {
    throw new Error(`Invalid rectangle data: ${validation.errors.join(', ')}`);
  }

  return this.actualAddRectangle(data, inUndoRedo);
}
```

### 2. Return Value Contracts

Define clear return types for all request APIs.

```typescript
// ✅ Good - Clear contract
interface ElementCreationResult {
  success: boolean
  elementId?: string
  error?: string
}

// ❌ Bad - Ambiguous return
function addElement(data): any {
  // Could return success, error, or element ID
  return processElement(data)
}
```

### 3. Request API Testing

Test request APIs directly without mocking internal state.

```typescript
describe('Request APIs', () => {
  it('should provide synchronous access to scene tree', () => {
    const mockSceneTree = new MockSceneTree()
    const core = new Core(mockSceneTree)

    const elementId = core.requests.sceneTree.addRectangle(testData, true)

    expect(elementId).toBeDefined()
    expect(mockSceneTree.addRectangle).toHaveBeenCalledWith(testData, true)
  })

  it('should handle selection requests', () => {
    const mockSelection = new MockSelectionService()
    const core = new Core(null, mockSelection)

    const ids = core.requests.selection.getElementSelectionIds()
    const newIds = ['test-id-1', 'test-id-2']
    core.requests.selection.setElementSelection(newIds)

    expect(mockSelection.setElementSelection).toHaveBeenCalledWith(newIds)
  })
})
```

## Request API Integration

### With Event System

Request APIs should trigger appropriate events:

```typescript
export class RequestAPIIntegration {
  updateElementProperty(elementId: string, property: string, value: any): void {
    const oldValue = this.getElementProperty(elementId, property)

    // Update internal state
    this.setElementProperty(elementId, property, value)

    // Publish change event
    reactiveEvents.publish.propertyChanged({
      elementId,
      property,
      oldValue,
      newValue: value
    })
  }
}
```

### With Transaction System

Request APIs should integrate with transaction management:

```typescript
export class TransactionAwareRequestAPI {
  deleteElements(elementIds: string[]): void {
    const transactionId = this.transactionManager.startTransaction()

    try {
      elementIds.forEach((id) => {
        this.sceneTree.deleteElement(id)
        reactiveEvents.publish.elementDeleted({ elementId: id })
      })

      this.transactionManager.endTransaction()
    } catch (error) {
      this.transactionManager.abortTransaction()
      throw error
    }
  }
}
```

## Quality Gates

### Before Submitting Request API Code

- [ ] All methods are synchronous (no async/await)
- [ ] Clear input validation with meaningful errors
- [ ] Well-defined return type contracts
- [ ] Proper separation of concerns
- [ ] Integration with event system
- [ ] Transaction support for state changes
- [ ] Comprehensive test coverage
- [ ] Documentation with examples

### Request API Validation Script

```typescript
const validateRequestAPICode = (code: string): RequestAPIViolation[] => {
  const violations: RequestAPIViolation[] = []

  // Check for async patterns in sync APIs
  if (code.includes('await') && code.includes('requests.')) {
    violations.push({
      type: 'async-in-sync-api',
      message: 'Async/await used in synchronous request API'
    })
  }

  // Check for missing validation
  if (code.includes('addRectangle') && !code.includes('validate')) {
    violations.push({
      type: 'missing-validation',
      message: 'Request API missing input validation'
    })
  }

  return violations
}
```

---

**This specification covers all request-response API patterns for synchronous operations in CDD.**
