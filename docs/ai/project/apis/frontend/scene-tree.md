# API Reference: @asra/scene-tree

The `@asra/scene-tree` package manages the hierarchical scene graph of the application. It acts as the "Model" in the MVC pattern, holding the true state of all elements.

## Lifecycle

### `load()`
-   **Description**: Hydrates the scene tree from serialized data.
-   **Signature**: `load(data: SceneTreeDataType): void`

### `save()`
-   **Description**: Serializes the current scene tree state.
-   **Signature**: `save(): SceneTreeRawData`

## Element Management

### `createElement()`
-   **Description**: Creates a new element instance from raw data but does NOT add it to the tree yet.
-   **Signature**: `createElement(elementData: Partial<ElementRawData>): ElementInstanceTypes | null`

### `addNewElement()`
-   **Description**: Adds an existing element instance to the scene tree (specifically to the current workspace).
-   **Signature**: `addNewElement(element: ElementInstanceTypes, parent?: GroupInstanceTypes, index?: number): void`

### `removeElement()`
-   **Description**: Removes an element from the scene tree.
-   **Signature**: `removeElement(data: Partial<ElementRawData>, index: number, parent?: GroupInstanceTypes): void`

## Data Access

### `getElementById()`
-   **Description**: Retrieves an element instance by its ID.
-   **Signature**: `getElementById(elementId: string): ElementInstanceTypes`

### `updateComputedData()`
-   **Description**: Updates a computed property (like x, y, width, height) of an element.
-   **Signature**: `updateComputedData(elementId: string, key: string, data: any): void`
