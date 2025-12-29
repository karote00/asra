# API Reference: @asra/core

The `@asra/core` package exposes a unified API surface that aggregates functionality from multiple domains. It serves as the main entry point for the application logic.

## Core Lifecycle

### `load()`
-   **Description**: Loads the application state from a raw data object. Initializing scene tree, props, and viewport.
-   **Signature**: `load(data: CoreRawData): void`

### `save()`
-   **Description**: Asynchronously serializes the current application state into a data object.
-   **Signature**: `save(): Promise<CoreRawData>`

## Transaction Management

### `startTransaction()`
-   **Description**: Starts a new undoable transaction group.
-   **Signature**: `startTransaction(): void`

### `endTransaction()`
-   **Description**: Finalizes the current transaction group.
-   **Signature**: `endTransaction(): void`

## Scene Tree & Selection

### `addRectangle()`
-   **Description**: Orchestrates the creation of a new rectangle element, including transaction management and auto-selection.
-   **Signature**: `addRectangle(data: CreateRectangleData): Promise<void>`

### `changeComputedData()`
-   **Description**: Changes a computed property of the currently selected elements, wrapped in a transaction.
-   **Signature**: `changeComputedData(key: string, data: DataTypes): Promise<void>`

### `resizeElement()`
-   **Description**: Updates the dimensions and position of selected elements during a resize operation.
-   **Signature**: `resizeElement(pos: PositionData, dimension: DimensionData, option: any): Promise<void>`

### `selectElements()`
-   **Description**: Selects the specified elements.
-   **Signature**: `selectElements(ids: string[]): void`

## Interaction & Input

### `executeAction()`
-   **Description**: Triggers a discrete interaction action based on an input event.
-   **Signature**: `executeAction(eventName: InputSystemEvents, detail?: DetailType): Promise<void>`

### `startSession()`
-   **Description**: Starts a continuous interaction session (e.g., drag start).
-   **Signature**: `startSession(eventName: InputSystemEvents, detail?: DetailType): Promise<void>`

### `updateSession()`
-   **Description**: Updates an ongoing interaction session (e.g., drag move).
-   **Signature**: `updateSession(eventName: InputSystemEvents, detail?: DetailType): Promise<void>`

### `endSession()`
-   **Description**: Ends an interaction session (e.g., drag end).
-   **Signature**: `endSession(eventName: InputSystemEvents, detail?: DetailType): Promise<void>`

## Viewport

### `zoomFit()`
-   **Description**: Zoom to fit all elements.
-   **Signature**: `zoomFit(): void`

### `panTo()`
-   **Description**: Pan the viewport to specific coordinates.
-   **Signature**: `panTo(x: number, y: number): void`

### `zoomToCenter()`
-   **Description**: Zoom to a scale at a specific center point.
-   **Signature**: `zoomToCenter(scale: number, centerX: number, centerY: number): void`
