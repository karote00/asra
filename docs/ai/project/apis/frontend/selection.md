# API Reference: @asyra/selection

The `@asyra/selection` package provides a unified manager for handling different types of selections (e.g., Element selection, Node selection).

## Selection Manager

### `register()`
-   **Description**: Registers a new selection handler for a specific type.
-   **Signature**: `register(type: SELECTION_TYPES, selection: Selection): void`

### `get()`
-   **Description**: Retrieves the selection handler for a given type.
-   **Signature**: `get(type: SELECTION_TYPES): Selection | undefined`

### `clearAllSelections()`
-   **Description**: Clears selections across all registered types.
-   **Signature**: `clearAllSelections(): void`
