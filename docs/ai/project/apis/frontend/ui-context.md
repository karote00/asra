# API Reference: @asra/ui-context

The `@asra/ui-context` package acts as the view model for the UI. It aggregates application state into `RxJS BehaviorSubjects` that UI components can consume directly. It handles logic like property averaging (e.g., showing "Mixed" if selected elements have different colors).

## Reactive State (BehaviorSubjects)

The class exposes `BehaviorSubject` properties that emit values whenever the context changes.

-   **`zoom`**: Current zoom level.
-   **`primaryTool`**: Current active tool (e.g., SELECT, RECTANGLE).
-   **`elementSelection`**: Set of currently selected IDs.
-   **`x`, `y`, `width`, `height`, `rotation`**: Geometric properties of the selection. If multiple elements are selected with different values, these emit `MIXED_STRING`.

## State Updates

### `updateZoom()`
-   **Description**: Updates the zoom subject.
-   **Signature**: `updateZoom(newZoom: number): void`

### `updatePrimaryTool()`
-   **Description**: Updates the primary tool subject.
-   **Signature**: `updatePrimaryTool(tool: PrimaryToolType): void`

### `updateComputedProperty()`
-   **Description**: Updates a specific geometric property based on a list of values (performs comparison for "Mixed" state).
-   **Signature**: `updateComputedProperty(key: string, data: any[]): void`

### `updateElementSelection()`
-   **Description**: Updates the set of selected element IDs.
-   **Signature**: `updateElementSelection(ids: Set<string>): void`
