# API Reference: @asra/core

The `@asra/core` package exposes a unified API surface that aggregates functionality from multiple domains. It serves as the main entry point for the application logic.

## Request API Architecture

The core uses a request-response pattern for synchronous data access. Request APIs provide direct access to package state without business logic.

### Request Layer

**Available Request APIs**:

- `SystemContextRequests`: Direct system context data access
- `PropsRequests`: Properties manager state access
- `SceneTreeRequests`: Scene tree state access
- `FactoryRequests`: Factory/undo state access
- `RenderRequests`: Render state access (mixed sync/async)
- `SelectionRequests`: Selection state access

**Example Request Usage**:

```typescript
// Direct synchronous data access
const context = core.requests.systemContext.getSystemContextSnapshot()
const selectedIds = core.requests.selection.getElementSelectionIds()
const inUndoRedo = core.requests.factory.isInUndoRedo()
```

All methods below orchestrate these requests to provide business logic with transaction management.

## Core Lifecycle

### `load()`

- **Description**: Loads application state from a raw data object. Initializing scene tree, props, and viewport.
- **Signature**: `load(data: CoreRawData): void`

### `save()`

- **Description**: Synchronously serializes current application state into a data object using request APIs.
- **Signature**: `save(): CoreRawData`

## Transaction Management

### `startTransaction()`

- **Description**: Starts a new undoable transaction group.
- **Signature**: `startTransaction(): void`

### `endTransaction()`

- **Description**: Finalizes the current transaction group.
- **Signature**: `endTransaction(): void`

## Scene Tree & Selection

### `addRectangle()`

- **Description**: Orchestrates the creation of a new rectangle element, including transaction management and auto-selection.
- **Signature**: `addRectangle(data: CreateRectangleData): void`

### `changeComputedData()`

- **Description**: Changes a computed property of the currently selected elements, wrapped in a transaction.
- **Signature**: `changeComputedData(key: string, data: DataTypes): void`

### `resizeElement()`

- **Description**: Updates the dimensions and position of selected elements during a resize operation.
- **Signature**: `resizeElement(pos: PositionData, dimension: DimensionData, option: any): void`

### `selectElements()`

- **Description**: Selects the specified elements.
- **Signature**: `selectElements(ids: string[]): void`

## Interaction & Input

### `executeAction()`

- **Description**: Triggers a discrete interaction action based on an input event.
- **Signature**: `executeAction(eventName: InputSystemEvents, detail?: DetailType): void`

### `startSession()`

- **Description**: Starts a continuous interaction session (e.g., drag start).
- **Signature**: `startSession(eventName: InputSystemEvents, detail?: DetailType): void`

### `updateSession()`

- **Description**: Updates an ongoing interaction session (e.g., drag move).
- **Signature**: `updateSession(eventName: InputSystemEvents, detail?: DetailType): void`

### `endSession()`

- **Description**: Ends an interaction session (e.g., drag end).
- **Signature**: `endSession(eventName: InputSystemEvents, detail?: DetailType): void`

## Viewport

### `zoomFit()`

- **Description**: Zoom to fit all elements.
- **Signature**: `zoomFit(): void`

### `panTo()`

- **Description**: Pan the viewport to specific coordinates.
- **Signature**: `panTo(x: number, y: number): void`

### `zoomToCenter()`

- **Description**: Zoom to a scale at a specific center point.
- **Signature**: `zoomToCenter(scale: number, centerX: number, centerY: number): void`
