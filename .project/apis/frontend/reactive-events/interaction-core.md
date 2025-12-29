# Interaction Core API

This domain handles events related to user interactions and decisions made by the interaction core.

---

### `executeAction()`

-   **Description**: Publishes an event to execute a generic action.
-   **Type**: Publisher
-   **Signature**: `export const executeAction = (eventName: InputSystemEvents, systemContextSnapshot: SystemContextSnapshot, detail?: DetailType): void`
-   **Parameters**:
    -   `eventName` (`InputSystemEvents`): The name of the input system event that triggered the action.
    -   `systemContextSnapshot` (`SystemContextSnapshot`): A snapshot of the system context at the time of the event.
    -   `detail` (`DetailType`): Optional details about the event.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `EXECUTE_ACTION`
    -   **Payload Interface**: `ExecuteActionEvent`

---

### `subscribeToExecuteAction()`

-   **Description**: Subscribes to the `executeAction` event.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToExecuteAction = (handler: (event: ExecuteActionEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: ExecuteActionEvent) => void`): A callback to execute when the event is fired.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `EXECUTE_ACTION`
    -   **Payload Interface**: `ExecuteActionEvent`

---

### `startSession()`

-   **Description**: Publishes an event to start an interaction session.
-   **Type**: Publisher
-   **Signature**: `export const startSession = (eventName: InputSystemEvents, systemContextSnapshot: SystemContextSnapshot, detail?: DetailType): void`
-   **Parameters**:
    -   `eventName` (`InputSystemEvents`): The name of the input system event that started the session.
    -   `systemContextSnapshot` (`SystemContextSnapshot`): A snapshot of the system context at the time of the event.
    -   `detail` (`DetailType`): Optional details about the event.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `START_SESSION`
    -   **Payload Interface**: `StartSessionEvent`

---

### `subscribeToStartSession()`

-   **Description**: Subscribes to the `startSession` event.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToStartSession = (handler: (event: StartSessionEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: StartSessionEvent) => void`): A callback to execute when the event is fired.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `START_SESSION`
    -   **Payload Interface**: `StartSessionEvent`

---

### `updateSession()`

-   **Description**: Publishes an event to update an ongoing interaction session.
-   **Type**: Publisher
-   **Signature**: `export const updateSession = (eventName: InputSystemEvents, systemContextSnapshot: SystemContextSnapshot, detail?: DetailType): void`
-   **Parameters**:
    -   `eventName` (`InputSystemEvents`): The name of the input system event that updated the session.
    -   `systemContextSnapshot` (`SystemContextSnapshot`): A snapshot of the system context at the time of the event.
    -   `detail` (`DetailType`): Optional details about the event.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `UPDATE_SESSION`
    -   **Payload Interface**: `UpdateSessionEvent`

---

### `subscribeToUpdateSession()`

-   **Description**: Subscribes to the `updateSession` event.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToUpdateSession = (handler: (event: UpdateSessionEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: UpdateSessionEvent) => void`): A callback to execute when the event is fired.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `UPDATE_SESSION`
    -   **Payload Interface**: `UpdateSessionEvent`

---

### `endSession()`

-   **Description**: Publishes an event to end an interaction session.
-   **Type**: Publisher
-   **Signature**: `export const endSession = (eventName: InputSystemEvents, systemContextSnapshot: SystemContextSnapshot, detail?: DetailType): void`
-   **Parameters**:
    -   `eventName` (`InputSystemEvents`): The name of the input system event that ended the session.
    -   `systemContextSnapshot` (`SystemContextSnapshot`): A snapshot of the system context at the time of the event.
    -   `detail` (`DetailType`): Optional details about the event.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `END_SESSION`
    -   **Payload Interface**: `EndSessionEvent`

---

### `subscribeToEndSession()`

-   **Description**: Subscribes to the `endSession` event.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToEndSession = (handler: (event: EndSessionEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: EndSessionEvent) => void`): A callback to execute when the event is fired.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `END_SESSION`
    -   **Payload Interface**: `EndSessionEvent`

---

---

### `decideToStartTransaction()`

-   **Description**: Publishes an event to signal the start of a transaction.
-   **Type**: Publisher
-   **Signature**: `export const decideToStartTransaction = (): void`
-   **Parameters**: None
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `DECIDE_TO_START_TRANSACTION`

---

### `decideToEndTransaction()`

-   **Description**: Publishes an event to signal the end of a transaction.
-   **Type**: Publisher
-   **Signature**: `export const decideToEndTransaction = (): void`
-   **Parameters**: None
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `DECIDE_TO_END_TRANSACTION`

---

### `decideToSwitchPrimaryTool()`

-   **Description**: Publishes an event to signal a decision to switch the primary tool.
-   **Type**: Publisher
-   **Signature**: `export const decideToSwitchPrimaryTool = (primaryTool: PrimaryToolType): void`
-   **Parameters**:
    -   `primaryTool` (`PrimaryToolType`): The primary tool to switch to.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `DECIDE_TO_SWITCH_PRIMARY_TOOL`
    -   **Payload Interface**: `DecideToSwitchPrimaryToolEvent`

---

### `subscribeToDecideToSwitchPrimaryTool()`

-   **Description**: Subscribes to the `decideToSwitchPrimaryTool` event.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToDecideToSwitchPrimaryTool = (handler: (event: DecideToSwitchPrimaryToolEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: DecideToSwitchPrimaryToolEvent) => void`): A callback to execute when the event is fired.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `DECIDE_TO_SWITCH_PRIMARY_TOOL`
    -   **Payload Interface**: `DecideToSwitchPrimaryToolEvent`

---

### `decideToCreateElement()`

-   **Description**: Publishes an event to signal a decision to create an element.
-   **Type**: Publisher
-   **Signature**: `export const decideToCreateElement = (position: PositionData, elementType: PrimaryToolType): void`
-   **Parameters**:
    -   `position` (`PositionData`): The position where the element should be created.
    -   `elementType` (`PrimaryToolType`): The type of element to create.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `DECIDE_TO_CREATE_ELEMENT`
    -   **Payload Interface**: `DecideToCreateElementEvent`

---

### `subscribeToDecideToCreateElement()`

-   **Description**: Subscribes to the `decideToCreateElement` event.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToDecideToCreateElement = (handler: (event: DecideToCreateElementEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: DecideToCreateElementEvent) => void`): A callback to execute when the event is fired.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `DECIDE_TO_CREATE_ELEMENT`
    -   **Payload Interface**: `DecideToCreateElementEvent`

---

### `decideToSelectElements()`

-   **Description**: Publishes an event to signal a decision to select elements.
-   **Type**: Publisher
-   **Signature**: `export const decideToSelectElements = (elementIds: string[]): void`
-   **Parameters**:
    -   `elementIds` (`string[]`): The IDs of the elements to select.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `DECIDE_TO_SELECT_ELEMENTS`
    -   **Payload Interface**: `DecideToSelectElementsEvent`

---

### `decideToResizeElement()`

-   **Description**: Publishes an event to signal a decision to resize an element.
-   **Type**: Publisher
-   **Signature**: `export const decideToResizeElement = (dragStart: PositionData, position: PositionData, elementType: PrimaryToolType, options?: EVNET_OPTIONS): void`
-   **Parameters**:
    -   `dragStart` (`PositionData`): Start position of the drag.
    -   `position` (`PositionData`): Current cursor position.
    -   `elementType` (`PrimaryToolType`): The type of element being resized.
    -   `options` (`EVNET_OPTIONS`): Optional event options.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `DECIDE_TO_RESIZE_ELEMENT`
    -   **Payload Interface**: `DecideToResizeElementEvent`

---

### `decideToEndResizeElement()`

-   **Description**: Publishes an event to signal the end of a resize operation.
-   **Type**: Publisher
-   **Signature**: `export const decideToEndResizeElement = (position: PositionData, elementType: PrimaryToolType): void`
-   **Parameters**:
    -   `position` (`PositionData`): Final position.
    -   `elementType` (`PrimaryToolType`): The type of element resized.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `DECIDE_TO_END_RESIZE_ELEMENT`
    -   **Payload Interface**: `DecideToEndResizeElementEvent`

---

### `decideToResetElementSize()`

-   **Description**: Publishes an event to signal a decision to reset an element's size.
-   **Type**: Publisher
-   **Signature**: `export const decideToResetElementSize = (dimension: { width: number; height: number }, elementType: PrimaryToolType): void`
-   **Parameters**:
    -   `dimension` (`{ width: number; height: number }`): The dimensions to reset to.
    -   `elementType` (`PrimaryToolType`): The type of element.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `DECIDE_TO_RESET_ELEMENT_SIZE`
    -   **Payload Interface**: `DecideToResetElementSizeEvent`

---

### `decideToUndoRedo()`

-   **Description**: Publishes an event to signal a decision to undo or redo.
-   **Type**: Publisher
-   **Signature**: `export const decideToUndoRedo = (undoredo: UNDO): void`
-   **Parameters**:
    -   `undoredo` (`UNDO`): The undo or redo action to perform.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `DECIDE_TO_UNDOREDO`
    -   **Payload Interface**: `DecideToUndoRedoEvent`

---

### `subscribeToDecideToUndoRedo()`

-   **Description**: Subscribes to the `decideToUndoRedo` event.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToDecideToUndoRedo = (handler: (event: DecideToUndoRedoEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: DecideToUndoRedoEvent) => void`): A callback to execute when the event is fired.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `DECIDE_TO_UNDOREDO`
    -   **Payload Interface**: `DecideToUndoRedoEvent`

---

### `decideToZoomFit()`

-   **Description**: Publishes an event to signal a decision to zoom to fit.
-   **Type**: Publisher
-   **Signature**: `export const decideToZoomFit = (): void`
-   **Parameters**: None
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `DECIDE_TO_ZOOM_FIT`
    -   **Payload Interface**: `DecideToZoomFitEvent`

---

### `subscribeToDecideToZoomFit()`

-   **Description**: Subscribes to the `decideToZoomFit` event.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToDecideToZoomFit = (handler: (event: DecideToZoomFitEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: DecideToZoomFitEvent) => void`): A callback to execute when the event is fired.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `DECIDE_TO_ZOOM_FIT`
    -   **Payload Interface**: `DecideToZoomFitEvent`

---

### `decideToPanZoom()`

-   **Description**: Publishes an event to signal a decision to pan or zoom.
-   **Type**: Publisher
-   **Signature**: `export const decideToPanZoom = (panzoom: PanZoom, mouse: MouseSnapshot['position'], wheel: MouseSnapshot['delta']): void`
-   **Parameters**:
    -   `panzoom` (`PanZoom`): The pan or zoom action to perform.
    -   `mouse` (`MouseSnapshot['position']`): The current mouse position.
    -   `wheel` (`MouseSnapshot['delta']`): The mouse wheel delta.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `DECIDE_TO_PAN_ZOOM`
    -   **Payload Interface**: `DecideToPanZoomEvent`

---

### `subscribeToDecideToPanZoom()`

-   **Description**: Subscribes to the `decideToPanZoom` event.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToDecideToPanZoom = (handler: (event: DecideToPanZoomEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: DecideToPanZoomEvent) => void`): A callback to execute when the event is fired.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `DECIDE_TO_PAN_ZOOM`
    -   **Payload Interface**: `DecideToPanZoomEvent`
