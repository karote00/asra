# Request API Reference

The request API layer provides synchronous data access to package state. These are the building blocks used by core business logic APIs.

## Architecture Pattern

```
Requests Layer (Pure Data Access):
├── create[Domain]Requests(dependencies) → DomainRequests
├── Synchronous method calls to package state
├── No business logic, only data operations
└── Returns raw data or primitive types

Business Logic Layer (Core APIs):
├── Orchestrates multiple request calls
├── Handles transaction management
├── Emits events via @asra/reactive-events
└── Provides unified API surface
```

## System Context Requests

### `getSystemContextSnapshot()`

- **Description**: Returns current snapshot of system context state
- **Signature**: `getSystemContextSnapshot(): SystemContextSnapshot`
- **Returns**: Current mouse position, keyboard modifiers, active tool, etc.

## Props Requests

### `propsLoadData()`

- **Description**: Load properties data into props manager
- **Signature**: `propsLoadData(data: PropsComponentRawData): void`

### `propsSaveData()`

- **Description**: Save current properties data from props manager
- **Signature**: `propsSaveData(): PropsComponentRawData`
- **Returns**: Serialized properties data for persistence

## Scene Tree Requests

### `sceneTreeSaveData()`

- **Description**: Save current scene tree state
- **Signature**: `sceneTreeSaveData(): SceneTreeRawData`
- **Returns**: Serialized scene tree for persistence

### `addRectangle()`

- **Description**: Add a new rectangle element to scene tree
- **Signature**: `addRectangle(data: CreateElementData, inUndoRedo: boolean): string`
- **Returns**: ID of newly created rectangle element

## Factory Requests

### `isInUndoRedo()`

- **Description**: Check if currently in undo/redo operation
- **Signature**: `isInUndoRedo(): boolean`
- **Returns**: True if currently executing undo/redo

## Selection Requests

### `getElementSelectionIds()`

- **Description**: Get IDs of currently selected elements
- **Signature**: `getElementSelectionIds(): string[]`
- **Returns**: Array of selected element IDs

## Render Requests

### `getViewportPosition()`

- **Description**: Get current viewport center position
- **Signature**: `getViewportPosition(): PositionData`
- **Returns**: Current viewport x, y coordinates

### `getViewportScale()`

- **Description**: Get current viewport zoom scale
- **Signature**: `getViewportScale(): number`
- **Returns**: Current zoom scale factor

### `initRender()`

- **Description**: Initialize render system (async exception)
- **Signature**: `initRender(): Promise<any>`
- **Returns**: Promise resolving to initialized WebGL/Canvas context

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
// Core API that uses requests (example: addRectangle)
addRectangle(data: CreateElementData): void {
  startTransaction()

  const inUndoRedo = requests.factory.isInUndoRedo()
  const newElementId = requests.sceneTree.addRectangle(data, inUndoRedo)
  requests.selection.selectElements([newElementId])

  endTransaction()
}
```

## Key Principles

1. **Synchronous**: All request methods (except render init) are synchronous
2. **Pure Data Access**: No business logic, only state operations
3. **Type Safety**: Strongly typed return values
4. **Dependency Injection**: Requests are injected into core at initialization
5. **Transaction Management**: Business logic APIs handle transactions, not requests
