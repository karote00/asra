# Render API

This domain handles events related to rendering, including initialization, zoom, and pan.

---

### `initRender()`

-   **Description**: Asynchronously initializes the renderer.
-   **Type**: Requestor
-   **Signature**: `export const initRender = async (width: number, height: number, color: number): Promise<any>`
-   **Parameters**:
    -   `width` (`number`): The width of the renderer.
    -   `height` (`number`): The height of the renderer.
    -   `color` (`number`): The background color of the renderer.
-   **Returns**:
    -   `Promise<any>`: A promise that resolves with the renderer application instance.
-   **Associated Event**:
    -   **Event Type**: `INIT_RENDER`
    -   **Payload Interface**: `InitRenderEvent`

---

### `emitInitRender()`

-   **Description**: Publishes the response to an `initRender` event.
-   **Type**: Publisher (Response)
-   **Signature**: `export const emitInitRender = (requestId: string, newApp: any): void`
-   **Parameters**:
    -   `requestId` (`string`): The ID from the original request.
    -   `newApp` (`any`): The new renderer application instance.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `EMIT_INIT_RENDER`
    -   **Payload Interface**: `EmitInitRenderEvent`

---

### `zoomFit()`

-   **Description**: Publishes an event to zoom to fit a given rectangle.
-   **Type**: Publisher
-   **Signature**: `export const zoomFit = (rect: DOMRect): void`
-   **Parameters**:
    -   `rect` (`DOMRect`): The rectangle to zoom to.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `ZOOM_FIT`
    -   **Payload Interface**: `ZoomFitEvent`

---

### `emitZoomFit()`

-   **Description**: Publishes a notification event to signal that the zoom to fit action has completed.
-   **Type**: Publisher (Notification)
-   **Signature**: `export const emitZoomFit = (): void`
-   **Parameters**: None
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `EMIT_ZOOM_FIT`
    -   **Payload Interface**: `EmitZoomFitEvent`

---

### `panTo()`

-   **Description**: Publishes an event to pan to a given position.
-   **Type**: Publisher
-   **Signature**: `export const panTo = (x: number, y: number): void`
-   **Parameters**:
    -   `x` (`number`): The x-coordinate to pan to.
    -   `y` (`number`): The y-coordinate to pan to.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `PAN_TO`
    -   **Payload Interface**: `PanToEvent`

---

### `zoomToCenter()`

-   **Description**: Publishes an event to zoom to a given scale and center point.
-   **Type**: Publisher
-   **Signature**: `export const zoomToCenter = (scale: number, centerX: number, centerY: number): void`
-   **Parameters**:
    -   `scale` (`number`): The scale to zoom to.
    -   `centerX` (`number`): The x-coordinate of the center point.
    -   `centerY` (`number`): The y-coordinate of the center point.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `ZOOM_TO_CENTER`
    -   **Payload Interface**: `ZoomToCenterEvent`

---

### `requestRenderZoom()`

-   **Description**: Asynchronously requests the current zoom level of the renderer.
-   **Type**: Requestor
-   **Signature**: `export const requestRenderZoom = async (): Promise<number>`
-   **Parameters**: None
-   **Returns**:
    -   `Promise<number>`: A promise that resolves with the current zoom level.
-   **Associated Event**:
    -   **Event Type**: `REQUEST_RENDER_ZOOM`
    -   **Payload Interface**: `RequestRenderZoomEvent`

---

### `finishRequestRenderZoom()`

-   **Description**: Publishes the response to a `requestRenderZoom` event.
-   **Type**: Publisher (Response)
-   **Signature**: `export const finishRequestRenderZoom = (requestId: string, newZoom: number): void`
-   **Parameters**:
    -   `requestId` (`string`): The ID from the original request.
    -   `newZoom` (`number`): The current zoom level.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `FINISH_REQUEST_RENDER_ZOOM`
    -   **Payload Interface**: `FinishRequestRenderZoomEvent`

---

### `requestViewportPosition()`

-   **Description**: Asynchronously requests the current position of the viewport.
-   **Type**: Requestor
-   **Signature**: `export const requestViewportPosition = async (): Promise<PositionData>`
-   **Parameters**: None
-   **Returns**:
    -   `Promise<PositionData>`: A promise that resolves with the current viewport position.
-   **Associated Event**:
    -   **Event Type**: `REQUEST_VIEWPORT_POSITION`
    -   **Payload Interface**: `RequestViewportPositionEvent`

---

### `finishRequestViewportPosition()`

-   **Description**: Publishes the response to a `requestViewportPosition` event.
-   **Type**: Publisher (Response)
-   **Signature**: `export const finishRequestViewportPosition = (requestId: string, position: { x: number; y: number; }): void`
-   **Parameters**:
    -   `requestId` (`string`): The ID from the original request.
    -   `position` (`{ x: number; y: number; }`): The current viewport position.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `FINISH_REQUEST_VIEWPORT_POSITION`
    -   **Payload Interface**: `FinishRequestViewportPositionEvent`

---

### `requestViewportScale()`

-   **Description**: Asynchronously requests the current scale of the viewport.
-   **Type**: Requestor
-   **Signature**: `export const requestViewportScale = async (): Promise<number>`
-   **Parameters**: None
-   **Returns**:
    -   `Promise<number>`: A promise that resolves with the current viewport scale.
-   **Associated Event**:
    -   **Event Type**: `REQUEST_VIEWPORT_SCALE`
    -   **Payload Interface**: `RequestViewportScaleEvent`

---

### `finishRequestViewportScale()`

-   **Description**: Publishes the response to a `requestViewportScale` event.
-   **Type**: Publisher (Response)
-   **Signature**: `export const finishRequestViewportScale = (requestId: string, scale: number): void`
-   **Parameters**:
    -   `requestId` (`string`): The ID from the original request.
    -   `scale` (`number`): The current viewport scale.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `FINISH_REQUEST_VIEWPORT_SCALE`
    -   **Payload Interface**: `FinishRequestViewportScaleEvent`
