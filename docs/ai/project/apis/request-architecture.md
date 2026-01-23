# Request API Architecture

## Overview

The Request API architecture provides a synchronous, dependency-injected pattern for accessing package state, replacing async/await patterns with direct method calls for improved testability and clearer data flow.

## Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Core API    │  │ Scene Tree  │  │ Selection   │        │
│  │ Methods     │  │ Operations  │  │ Operations  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────┬───────────────────────────────────────┘
                      │ Direct Method Calls
┌─────────────────────▼───────────────────────────────────────┐
│                   Request Layer                            │
│  Pure Data Access - No Business Logic                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Factory     │  │ Scene Tree  │  │ Selection   │        │
│  │ Requests    │  │ Requests    │  │ Requests    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────┬───────────────────────────────────────┘
                      │ Direct Package Access
┌─────────────────────▼───────────────────────────────────────┐
│                    Package Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ @asra/      │  │ @asra/      │  │ @asra/      │        │
│  │ factory     │  │ scene-tree  │  │ selection   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Key Principles

### 1. Synchronous Operations
All request methods are synchronous (with documented exceptions like `initRender`)
- Immediate return values
- No await/then chains
- Clear execution flow
- Easy testing and debugging

### 2. Pure Data Access
Request APIs provide only data operations, no business logic
- Direct state access
- No event publishing
- No transaction management
- Type-safe return values

### 3. Dependency Injection
Requests are injected into core at initialization
- Loose coupling
- Easy mocking for tests
- Clear dependency graph
- Runtime flexibility

### 4. Type Safety
All requests are strongly typed
- Compile-time checking
- Runtime validation
- Clear contracts
- IDE support

## Request Categories

### Factory Requests
Transaction management and undo/redo operations

```typescript
interface FactoryRequests {
  isInUndoRedo(): boolean
  startTransaction(): void
  endTransaction(): void
  rollbackTransaction(): void
  updateTransaction(data: any): void
}
```

### Scene Tree Requests
Document model and element management

```typescript
interface SceneTreeRequests {
  sceneTreeSaveData(): SceneTreeRawData
  addRectangle(data: CreateElementData, inUndoRedo: boolean): string
  getElement(elementId: string): Element | null
  getElements(elementIds: string[]): Element[]
  deleteElement(elementId: string): void
  updateElement(elementId: string, updates: Partial<Element>): void
}
```

### Selection Requests
Element selection state management

```typescript
interface SelectionRequests {
  getElementSelectionIds(): string[]
  selectElements(elementIds: string[]): void
  clearSelection(): void
  isSelected(elementId: string): boolean
  getSelectionBounds(): Bounds | null
}
```

### Props Requests
Property data management

```typescript
interface PropsRequests {
  propsLoadData(data: PropsComponentRawData): void
  propsSaveData(): PropsComponentRawData
  getPropertyValue(elementId: string, key: string): any
  setPropertyValue(elementId: string, key: string, value: any): void
}
```

### Render Requests
Viewport and rendering system

```typescript
interface RenderRequests {
  initRender(): Promise<any> // Async exception
  getViewportPosition(): PositionData
  getViewportScale(): number
  setViewportPosition(position: PositionData): void
  setViewportScale(scale: number): void
  fitToScreen(): void
}
```

### System Context Requests
Global state and system information

```typescript
interface SystemContextRequests {
  getSystemContextSnapshot(): SystemContextSnapshot
  getActiveTool(): string
  getMousePosition(): Position
  getKeyboardModifiers(): KeyboardModifiers
  setPrimaryTool(tool: string): void
}
```

## Implementation Pattern

### Request Factory Creation

```typescript
// packages/core/src/requests/factory.ts
export function createFactoryRequests(deps: FactoryRequestDeps): FactoryRequests {
  return {
    isInUndoRedo: () => deps.factory.isInUndoRedo(),
    startTransaction: () => deps.factory.startTransaction(),
    endTransaction: () => deps.factory.endTransaction(),
    rollbackTransaction: () => deps.factory.rollbackTransaction(),
    updateTransaction: (data) => deps.factory.updateTransaction(data)
  }
}
```

### Dependency Injection

```typescript
// packages/core/src/core.ts
import { createFactoryRequests } from './requests/factory'
import { createSceneTreeRequests } from './requests/scene-tree'
// ... other imports

export function createCore(dependencies: CoreDeps) {
  // Create request APIs
  const requests = {
    factory: createFactoryRequests(dependencies),
    sceneTree: createSceneTreeRequests(dependencies),
    selection: createSelectionRequests(dependencies),
    props: createPropsRequests(dependencies),
    render: createRenderRequests(dependencies),
    systemContext: createSystemContextRequests(dependencies)
  }

  // Core API methods that orchestrate requests
  const core = {
    // Business logic using requests
    addRectangle: (data: CreateElementData) => {
      requests.factory.startTransaction()
      
      const inUndoRedo = requests.factory.isInUndoRedo()
      const newElementId = requests.sceneTree.addRectangle(data, inUndoRedo)
      requests.selection.selectElements([newElementId])
      
      requests.factory.endTransaction()
      return newElementId
    },
    
    // Expose requests for advanced usage
    requests
  }

  return core
}
```

### Type Definitions

```typescript
// packages/core/src/types/requests/factory.ts
export interface FactoryRequests {
  isInUndoRedo(): boolean
  startTransaction(): void
  endTransaction(): void
  rollbackTransaction(): void
  updateTransaction(data: any): void
}

export interface FactoryRequestDeps {
  factory: {
    isInUndoRedo(): boolean
    startTransaction(): void
    endTransaction(): void
    rollbackTransaction(): void
    updateTransaction(data: any): void
  }
}
```

## Usage Examples

### Direct State Access

```typescript
// Check system state
const context = core.requests.systemContext.getSystemContextSnapshot()
const isSelected = core.requests.selection
  .getElementSelectionIds()
  .includes(elementId)
const isUndoing = core.requests.factory.isInUndoRedo()

// Save/load operations
const sceneData = core.requests.sceneTree.sceneTreeSaveData()
const propsData = core.requests.props.propsSaveData()

// Viewport state
const viewportPos = core.requests.render.getViewportPosition()
const viewportScale = core.requests.render.getViewportScale()
```

### Business Logic Orchestration

```typescript
// Core API that uses requests
function moveElement(elementId: string, deltaX: number, deltaY: number) {
  // Get current data
  const element = core.requests.sceneTree.getElement(elementId)
  if (!element) return
  
  // Start transaction for undoability
  core.requests.factory.startTransaction()
  
  // Update element position
  core.requests.sceneTree.updateElement(elementId, {
    x: element.x + deltaX,
    y: element.y + deltaY
  })
  
  // Commit transaction
  core.requests.factory.endTransaction()
}

// Complex operation involving multiple requests
function createAndSelectRectangle(bounds: Rectangle) {
  core.requests.factory.startTransaction()
  
  try {
    // Create element
    const elementId = core.requests.sceneTree.addRectangle({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    }, false)
    
    // Select the new element
    core.requests.selection.selectElements([elementId])
    
    // Update viewport to show new element
    core.requests.render.fitToScreen()
    
  } catch (error) {
    core.requests.factory.rollbackTransaction()
    throw error
  }
  
  core.requests.factory.endTransaction()
  return elementId
}
```

### Testing with Mocks

```typescript
// Easy testing with direct assignment
const mockRequests = {
  factory: {
    isInUndoRedo: vi.fn().mockReturnValue(false),
    startTransaction: vi.fn(),
    endTransaction: vi.fn()
  },
  sceneTree: {
    addRectangle: vi.fn().mockReturnValue('element-123')
  },
  selection: {
    selectElements: vi.fn()
  }
}

// Test business logic
test('should create rectangle and select it', () => {
  const core = createCore(mockRequests)
  
  const result = core.addRectangle({
    x: 10, y: 10, width: 100, height: 50
  })
  
  expect(result).toBe('element-123')
  expect(mockRequests.factory.startTransaction).toHaveBeenCalled()
  expect(mockRequests.sceneTree.addRectangle).toHaveBeenCalledWith(
    { x: 10, y: 10, width: 100, height: 50 },
    false
  )
  expect(mockRequests.selection.selectElements).toHaveBeenCalledWith(['element-123'])
  expect(mockRequests.factory.endTransaction).toHaveBeenCalled()
})
```

## Benefits

### 1. Simplified Testing
- No async/await complexity
- Direct method calls
- Easy mocking strategies
- Clear test patterns

### 2. Better Performance
- No promise overhead
- Direct execution path
- Reduced complexity
- Predictable timing

### 3. Clearer Architecture
- Explicit dependencies
- Type-safe contracts
- Separation of concerns
- Documentation through types

### 4. Enhanced Developer Experience
- IDE auto-completion
- Compile-time errors
- Clear execution flow
- Easy debugging

## Migration from Async Patterns

### Before (Async/Await)
```typescript
async function addRectangle(data: CreateElementData): Promise<string> {
  await this.startTransaction()
  const elementId = await this.sceneTree.addRectangle(data)
  await this.selection.selectElements([elementId])
  await this.endTransaction()
  return elementId
}
```

### After (Request Pattern)
```typescript
function addRectangle(data: CreateElementData): string {
  this.requests.factory.startTransaction()
  const elementId = this.requests.sceneTree.addRectangle(data, false)
  this.requests.selection.selectElements([elementId])
  this.requests.factory.endTransaction()
  return elementId
}
```

## Error Handling

### Request Layer
- Input validation
- Type checking
- Runtime errors
- Graceful degradation

### Business Logic Layer
- Transaction management
- Error recovery
- Rollback mechanisms
- User feedback

### Testing Considerations
- Error scenario testing
- Mock error responses
- Exception propagation
- Recovery validation
