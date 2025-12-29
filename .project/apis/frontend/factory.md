# API Reference: @asra/factory

The `@asra/factory` package manages collaborative data state (YJS) and the undo/redo history.

## Transaction Control

### `startTransaction()`
-   **Description**: Signals the start of a new undo/redo group. Events recorded after this call will be grouped together.
-   **Signature**: `startTransaction(): void`

### `updateTransaction()`
-   **Description**: Records a change event into the current transaction. This payload is what will be re-played during undo/redo.
-   **Signature**: `updateTransaction(eventName: EventTypes, payload: any): void`

### `endTransaction()`
-   **Description**: Closes the current transaction group and pushes it to the undo stack.
-   **Signature**: `endTransaction(): void`

## Undo / Redo

### `undo()`
-   **Description**: Reverts the last transaction by popping from the undo stack and inverting/replaying the recorded events.
-   **Signature**: `undo(): void`

### `redo()`
-   **Description**: Re-applies the previously undone transaction.
-   **Signature**: `redo(): void`

## Shared Data Access (YJS)

The factory exposes YJS types directly for other packages (like `render` or `ui-context`) to observe.

### `sceneTreeMap`
-   **Type**: `Y.Map<any>`
-   **Description**: The YJS map holding the scene tree data elements.

### `elementSelectionMap`
-   **Type**: `Y.Map<boolean>`
-   **Description**: The YJS map holding the current selection state of elements.

### `propsMap`
-   **Type**: `Y.Map<any>`
-   **Description**: The YJS map holding component properties.
