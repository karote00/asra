# API Reference: @asra/render

The `@asra/render` package manages the visual representation of the application using Pixi.js. It handles the canvas, viewport, and rendering of all elements and selection boxes.

## Initialization

### `init()`
-   **Description**: Initializes the Pixi application and attaches it to the DOM.
-   **Signature**: `init(width: number, height: number, backgroundColor: number): Promise<Application>`

## Viewport Control

### `panTo()`
-   **Description**: Moves the camera to a specific coordinate.
-   **Signature**: `panTo(x: number, y: number): void`

### `zoomTo()`
-   **Description**: Sets the zoom scale.
-   **Signature**: `zoomTo(scale: number): void`

### `zoomToCenter()`
-   **Description**: Zooms to a scale targeting a specific center point (e.g., mouse position).
-   **Signature**: `zoomToCenter(scale: number, centerX: number, centerY: number): void`

### `zoomFit()`
-   **Description**: Adjusts the viewport to fit the provided bounding box.
-   **Signature**: `zoomFit(bounds: DOMRect): void`

### `getViewportPosition()`
-   **Description**: Returns the current x/y of the viewport.
-   **Signature**: `getViewportPosition(): { x: number, y: number }`

### `getViewportScale()`
-   **Description**: Returns the current zoom scale.
-   **Signature**: `getViewportScale(): number`

## Element Management

### `addElement()`
-   **Description**: Adds a visual element to the stage.
-   **Signature**: `addElement(data: RenderElementData): void`

### `removeElement()`
-   **Description**: Removes a visual element from the stage.
-   **Signature**: `removeElement(elementId: string): void`

### `updateElement()`
-   **Description**: Updates visual properties of an element.
-   **Signature**: `updateElement(elementId: string, key: string, before: any, after: any): void`
