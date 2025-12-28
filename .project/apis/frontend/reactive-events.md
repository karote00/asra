# API Reference: @asra/reactive-events

This document provides a detailed reference for the public API of the `@asra/reactive-events` package. For architectural details and design patterns, see the documents in `.project/architecture/frontend/` and `.project/design-principles/`.

## Core API

*This section will be detailed later.*

## Domain-Specific APIs

### System Context

This domain manages events related to the overall state of the application context, such as the current tool, mouse position, and keyboard state.

#### Primary Tool

---

### `switchPrimaryTool()`

-   **Description**: Publishes an event to change the active primary tool.
-   **Type**: Publisher
-   **Signature**: `export const switchPrimaryTool = (tool: PrimaryToolType): void`
-   **Parameters**:
    -   `tool` (`PrimaryToolType`): The name of the tool to switch to.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `SWITCH_PRIMARY_TOOL`
    -   **Payload Interface**: `SwitchPrimaryToolEvent`
-   **Example**:
    ```typescript
    import { switchPrimaryTool } from '@asra/reactive-events';

    switchPrimaryTool('select');
    ```

---

### `subscribeToSwitchPrimaryTool()`

-   **Description**: Subscribes to the event that is fired when the primary tool is changed.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToSwitchPrimaryTool = (handler: (event: SwitchPrimaryToolEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: SwitchPrimaryToolEvent) => void`): A callback function to execute when the event is fired.
-   **Returns**:
    -   `Subscription`: An `rxjs` subscription object with an `.unsubscribe()` method.
-   **Associated Event**:
    -   **Event Type**: `SWITCH_PRIMARY_TOOL`
    -   **Payload Interface**: `SwitchPrimaryToolEvent`
-   **Example**:
    ```typescript
    const subscription = subscribeToSwitchPrimaryTool((event) => {
      console.log(`Tool switched to: ${event.payload.tool}`);
    });

    // Later, to clean up:
    subscription.unsubscribe();
    ```

---

### `emitSwitchPrimaryTool()`

-   **Description**: Publishes a notification event to signal that the primary tool has finished changing. This is useful for triggering side effects in other parts of the application.
-   **Type**: Publisher (Notification)
-   **Signature**: `export const emitSwitchPrimaryTool = (): void`
-   **Parameters**: None
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `EMIT_SWITCH_PRIMARY_TOOL`
    -   **Payload Interface**: `EmitSwitchPrimaryToolEvent` (empty payload)
-   **Example**:
    ```typescript
    emitSwitchPrimaryTool();
    ```

---

### `requestCurrentPrimaryTool()`

-   **Description**: Asynchronously requests the current `PrimaryToolType` from the system context. Returns a promise that resolves with the tool's name.
-   **Type**: Requestor
-   **Signature**: `export const requestCurrentPrimaryTool = (): Promise<PrimaryToolType>`
-   **Parameters**: None
-   **Returns**:
    -   `Promise<PrimaryToolType>`: A promise that resolves with the string value of the currently active primary tool.
-   **Associated Event**:
    -   **Event Type**: `REQUEST_CURRENT_PRIMARY_TOOL`
    -   **Payload Interface**: `RequestCurrentPrimaryToolEvent`
-   **Example**:
    ```typescript
    async function onButtonClick() {
      const currentTool = await requestCurrentPrimaryTool();
      console.log(`The current tool is: ${currentTool}`);
    }
    ```

---

### `finishRequestCurrentPrimaryTool()`

-   **Description**: Publishes the response to a `requestCurrentPrimaryTool` event. This is typically called by the system that owns the primary tool state.
-   **Type**: Publisher (Response)
-   **Signature**: `export const finishRequestCurrentPrimaryTool = (requestId: string, tool: PrimaryToolType): void`
-   **Parameters**:
    -   `requestId` (`string`): The unique ID from the original request event.
    -   `tool` (`PrimaryToolType`): The current primary tool to send as the response.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `FINISH_REQUEST_CURRENT_PRIMARY_TOOL`
    -   **Payload Interface**: `FinishRequestCurrentPrimaryToolEvent`
-   **Example**:
    ```typescript
    // Inside the handler for subscribeToRequestCurrentPrimaryTool
    finishRequestCurrentPrimaryTool(event.payload.requestId, 'select');
    ```

#### Mouse State

---

### `updateMouseState()`

-   **Description**: Publishes an event with the latest snapshot of the mouse state.
-   **Type**: Publisher
-   **Signature**: `export const updateMouseState = (mouseSnapshot: MouseSnapshot): void`
-   **Parameters**:
    -   `mouseSnapshot` (`MouseSnapshot`): An object containing the current mouse state (position, buttons, etc.).
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `UPDATE_MOUSE_STATE`
    -   **Payload Interface**: `UpdateMouseStateEvent`
-   **Example**:
    ```typescript
    updateMouseState({ x: 100, y: 200, buttons: 0 });
    ```

---

### `subscribeToUpdateMouseState()`

-   **Description**: Subscribes to mouse state updates.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToUpdateMouseState = (handler: (event: UpdateMouseStateEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: UpdateMouseStateEvent) => void`): A callback to execute with the latest mouse state.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `UPDATE_MOUSE_STATE`
    -   **Payload Interface**: `UpdateMouseStateEvent`
-   **Example**:
    ```typescript
    const sub = subscribeToUpdateMouseState((event) => {
      console.log('Mouse at:', event.payload.x, event.payload.y);
    });
    ```

#### Key State

---

### `updateKeyState()`

-   **Description**: Publishes an event with the latest snapshot of the keyboard state.
-   **Type**: Publisher
-   **Signature**: `export const updateKeyState = (keySnapshot: KeySnapshot): void`
-   **Parameters**:
    -   `keySnapshot` (`KeySnapshot`): An object containing the current keyboard state.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `UPDATE_KEY_STATE`
    -   **Payload Interface**: `UpdateKeyStateEvent`
-   **Example**:
    ```typescript
    updateKeyState({ altKey: true, shiftKey: false });
    ```

---

### `subscribeToUpdateKeyState()`

-   **Description**: Subscribes to keyboard state updates.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToUpdateKeyState = (handler: (event: UpdateKeyStateEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: UpdateKeyStateEvent) => void`): A callback to execute with the latest keyboard state.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `UPDATE_KEY_STATE`
    -   **Payload Interface**: `UpdateKeyStateEvent`
-   **Example**:
    ```typescript
    const sub = subscribeToUpdateKeyState((event) => {
      if (event.payload.altKey) {
        console.log('Alt key is pressed');
      }
    });
    ```

#### System Context Snapshot

---

### `requestSystemContextSnapshot()`

-   **Description**: Asynchronously requests a complete snapshot of the entire system context.
-   **Type**: Requestor
-   **Signature**: `export const requestSystemContextSnapshot = (): Promise<SystemContextSnapshot>`
-   **Parameters**: None
-   **Returns**:
    -   `Promise<SystemContextSnapshot>`: A promise that resolves with the full system context snapshot.
-   **Associated Event**:
    -   **Event Type**: `REQUEST_SYSTEM_CONTEXT_SNAPSHOT`
    -   **Payload Interface**: `RequestSystemContextSnapshotEvent`
-   **Example**:
    ```typescript
    const snapshot = await requestSystemContextSnapshot();
    console.log(snapshot.mouseState);
    ```

---

### `finishRequestSystemContextSnapshot()`

-   **Description**: Publishes the response to a `requestSystemContextSnapshot` event.
-   **Type**: Publisher (Response)
-   **Signature**: `export const finishRequestSystemContextSnapshot = (requestId: string, systemContextSnapshot: SystemContextSnapshot): void`
-   **Parameters**:
    -   `requestId` (`string`): The ID from the original request.
    -   `systemContextSnapshot` (`SystemContextSnapshot`): The snapshot object.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `FINISH_REQUEST_SYSTEM_CONTEXT_SNAPSHOT`
    -   **Payload Interface**: `FinishRequestSystemContextSnapshotEvent`
-   **Example**:
    ```typescript
    // Inside the handler for subscribeToRequestSystemContextSnapshot
    finishRequestSystemContextSnapshot(event.payload.requestId, myCurrentSnapshot);
    ```

### Interaction Core

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

### Scene Tree

This domain handles events related to the scene tree, including initialization, data loading, and element manipulation.

---

### `sceneTreeInit()`

-   **Description**: Publishes an event to initialize the scene tree.
-   **Type**: Publisher
-   **Signature**: `export const sceneTreeInit = (): void`
-   **Parameters**: None
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `SCENE_TREE_INIT`
    -   **Payload Interface**: `SceneTreeInitEvent`

---

### `subscribeToSceneTreeInit()`

-   **Description**: Subscribes to the `sceneTreeInit` event.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToSceneTreeInit = (handler: (event: SceneTreeInitEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: SceneTreeInitEvent) => void`): A callback to execute when the event is fired.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `SCENE_TREE_INIT`
    -   **Payload Interface**: `SceneTreeInitEvent`

---

### `sceneTreeLoadData()`

-   **Description**: Publishes an event to load data into the scene tree.
-   **Type**: Publisher
-   **Signature**: `export const sceneTreeLoadData = (data: SceneTreeRawData): void`
-   **Parameters**:
    -   `data` (`SceneTreeRawData`): The raw scene tree data to load.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `SCENE_TREE_LOAD_DATA`
    -   **Payload Interface**: `SceneTreeLoadDataEvent`

---

### `subscribeToSceneTreeLoadData()`

-   **Description**: Subscribes to the `sceneTreeLoadData` event.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToSceneTreeLoadData = (handler: (event: SceneTreeLoadDataEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: SceneTreeLoadDataEvent) => void`): A callback to execute when the event is fired.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `SCENE_TREE_LOAD_DATA`
    -   **Payload Interface**: `SceneTreeLoadDataEvent`

---

### `sceneTreeLoadComplete()`

-   **Description**: Publishes an event to signal that the scene tree has finished loading data.
-   **Type**: Publisher
-   **Signature**: `export const sceneTreeLoadComplete = (): void`
-   **Parameters**: None
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `SCENE_TREE_LOAD_COMPLETE`
    -   **Payload Interface**: `SceneTreeLoadCompleteEvent`

---

### `subscribeToSceneTreeLoadComplete()`

-   **Description**: Subscribes to the `sceneTreeLoadComplete` event.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToSceneTreeLoadComplete = (handler: (event: SceneTreeLoadCompleteEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: SceneTreeLoadCompleteEvent) => void`): A callback to execute when the event is fired.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `SCENE_TREE_LOAD_COMPLETE`
    -   **Payload Interface**: `SceneTreeLoadCompleteEvent`

---

### `sceneTreeSaveData()`

-   **Description**: Asynchronously requests the scene tree to save its data.
-   **Type**: Requestor
-   **Signature**: `export const sceneTreeSaveData = (): Promise<SceneTreeRawData>`
-   **Parameters**: None
-   **Returns**:
    -   `Promise<SceneTreeRawData>`: A promise that resolves with the saved scene tree data.
-   **Associated Event**:
    -   **Event Type**: `SCENE_TREE_SAVE_DATA`
    -   **Payload Interface**: `SceneTreeSaveDataEvent`

---

### `finishSceneTreeSaveData()`

-   **Description**: Publishes the response to a `sceneTreeSaveData` event.
-   **Type**: Publisher (Response)
-   **Signature**: `export const finishSceneTreeSaveData = (requestId: string, data: SceneTreeRawData): void`
-   **Parameters**:
    -   `requestId` (`string`): The ID from the original request.
    -   `data` (`SceneTreeRawData`): The saved scene tree data.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `FINISH_SCENE_TREE_SAVE_DATA`
    -   **Payload Interface**: `FinishSceneTreeSaveDataEvent`

---

### `addRectangle()`

-   **Description**: Asynchronously requests to add a rectangle element to the scene tree.
-   **Type**: Requestor
-   **Signature**: `export const addRectangle = (elementData: CreateRectangleData): Promise<string>`
-   **Parameters**:
    -   `elementData` (`CreateRectangleData`): The data for the rectangle to create.
-   **Returns**:
    -   `Promise<string>`: A promise that resolves with the ID of the newly created element.
-   **Associated Event**:
    -   **Event Type**: `ADD_ELEMENT`
    -   **Payload Interface**: `AddElementEvent`

---

### `finishAddRectangle()`

-   **Description**: Publishes the response to an `addRectangle` event.
-   **Type**: Publisher (Response)
-   **Signature**: `export const finishAddRectangle = (requestId: string, elementId: string): void`
-   **Parameters**:
    -   `requestId` (`string`): The ID from the original request.
    -   `elementId` (`string`): The ID of the newly created element.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `FINISH_ADD_ELEMENT`
    -   **Payload Interface**: `FinishAddElementEvent`

---

### `removeElement()`

-   **Description**: Publishes an event to remove an element from the scene tree.
-   **Type**: Publisher
-   **Signature**: `export const removeElement = (elementData: ElementRawData, index: number, parent?: GroupInstanceTypes): void`
-   **Parameters**:
    -   `elementData` (`ElementRawData`): The data of the element to remove.
    -   `index` (`number`): The index of the element in its parent.
    -   `parent` (`GroupInstanceTypes`): The parent of the element.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `REMOVE_ELEMENT`
    -   **Payload Interface**: `RemoveElementEvent`

---

### `subscribeToRemoveElement()`

-   **Description**: Subscribes to the `removeElement` event.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToRemoveElement = (handler: (event: RemoveElementEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: RemoveElementEvent) => void`): A callback to execute when the event is fired.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `REMOVE_ELEMENT`
    -   **Payload Interface**: `RemoveElementEvent`

---

### `updateComputedData()`

-   **Description**: Publishes an event to update the computed data of an element.
-   **Type**: Publisher
-   **Signature**: `export const updateComputedData = (id: string, key: string, before: DataTypes, after: DataTypes): void`
-   **Parameters**:
    -   `id` (`string`): The ID of the element to update.
    -   `key` (`string`): The key of the data to update.
    -   `before` (`DataTypes`): The value before the update.
    -   `after` (`DataTypes`): The value after the update.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `UPDATE_COMPUTED_DATA`
    -   **Payload Interface**: `UpdateComputedDataEvent`

---

### `subscribeToUpdateComputedData()`

-   **Description**: Subscribes to the `updateComputedData` event.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToUpdateComputedData = (handler: (event: UpdateComputedDataEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: UpdateComputedDataEvent) => void`): A callback to execute when the event is fired.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `UPDATE_COMPUTED_DATA`
    -   **Payload Interface**: `UpdateComputedDataEvent`

---

### `changeComputedData()`

-   **Description**: Publishes an event to change the computed data of multiple elements.
-   **Type**: Publisher
-   **Signature**: `export const changeComputedData = (elementIds: string[], key: string, data: DataTypes): void`
-   **Parameters**:
    -   `elementIds` (`string[]`): The IDs of the elements to update.
    -   `key` (`string`): The key of the data to update.
    -   `data` (`DataTypes`): The new data value.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `CHANGE_COMPUTED_DATA`
    -   **Payload Interface**: `ChangeComputedDataEvent`

---

### `subscribeToChangeComputedData()`

-   **Description**: Subscribes to the `changeComputedData` event.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToChangeComputedData = (handler: (event: ChangeComputedDataEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: ChangeComputedDataEvent) => void`): A callback to execute when the event is fired.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `CHANGE_COMPUTED_DATA`
    -   **Payload Interface**: `ChangeComputedDataEvent`

---

### `sceneTreeLoadComplete$()`

-   **Description**: Creates a stream that emits when the scene tree has finished loading.
-   **Type**: Stream Creator
-   **Signature**: `export const sceneTreeLoadComplete$ = (reloadAction?: () => void): Observable<SceneTreeLoadCompleteEvent>`
-   **Parameters**:
    -   `reloadAction` (`() => void`): An optional action to execute when the stream emits.
-   **Returns**: `Observable<SceneTreeLoadCompleteEvent>`
-   **Associated Event**:
    -   **Event Type**: `SCENE_TREE_LOAD_COMPLETE`
    -   **Payload Interface**: `SceneTreeLoadCompleteEvent`

### Selection

This domain handles events related to element selection.

---

### `selectElements()`

-   **Description**: Publishes an event to select elements.
-   **Type**: Publisher
-   **Signature**: `export const selectElements = (elementIds: string[]): void`
-   **Parameters**:
    -   `elementIds` (`string[]`): The IDs of the elements to select.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `SELECT_ELEMENTS`
    -   **Payload Interface**: `SelectElementsEvent`

---

### `subscribeToSelectElements()`

-   **Description**: Subscribes to the `selectElements` event.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToSelectElements = (handler: (event: SelectElementsEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: SelectElementsEvent) => void`): A callback to execute when the event is fired.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `SELECT_ELEMENTS`
    -   **Payload Interface**: `SelectElementsEvent`

### Render

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

### Props Manager

This domain handles events related to the properties manager, including loading, saving, and manipulating properties.

---

### `propsLoadData()`

-   **Description**: Publishes an event to load data into the properties manager.
-   **Type**: Publisher
-   **Signature**: `export const propsLoadData = (data: PropsComponentRawData): void`
-   **Parameters**:
    -   `data` (`PropsComponentRawData`): The raw properties data to load.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `PROPS_LOAD_DATA`
    -   **Payload Interface**: `PropsLoadDataEvent`

---

### `subscribeToPropsLoadData()`

-   **Description**: Subscribes to the `propsLoadData` event.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToPropsLoadData = (handler: (event: PropsLoadDataEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: PropsLoadDataEvent) => void`): A callback to execute when the event is fired.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `PROPS_LOAD_DATA`
    -   **Payload Interface**: `PropsLoadDataEvent`

---

### `propsSaveData()`

-   **Description**: Asynchronously requests the properties manager to save its data.
-   **Type**: Requestor
-   **Signature**: `export const propsSaveData = (): Promise<PropsComponentRawData>`
-   **Parameters**: None
-   **Returns**:
    -   `Promise<PropsComponentRawData>`: A promise that resolves with the saved properties data.
-   **Associated Event**:
    -   **Event Type**: `PROPS_SAVE_DATA`
    -   **Payload Interface**: `PropsSaveDataEvent`

---

### `finishPropsSaveData()`

-   **Description**: Publishes the response to a `propsSaveData` event.
-   **Type**: Publisher (Response)
-   **Signature**: `export const finishPropsSaveData = (requestId: string, data: PropsComponentRawData): void`
-   **Parameters**:
    -   `requestId` (`string`): The ID from the original request.
    -   `data` (`PropsComponentRawData`): The saved properties data.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `FINISH_PROPS_SAVE_DATA`
    -   **Payload Interface**: `FinishPropsSaveDataEvent`

---

### `addProperty()`

-   **Description**: Publishes an event to add one or more properties.
-   **Type**: Publisher
-   **Signature**: `export const addProperty = (data: Partial<PropertyComponentRawData>[]): void`
-   **Parameters**:
    -   `data` (`Partial<PropertyComponentRawData>[]`): An array of partial property data to add.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `ADD_PROPERTY`
    -   **Payload Interface**: `AddPropertyEvent`

---

### `subscribeToAddProperty()`

-   **Description**: Subscribes to the `addProperty` event.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToAddProperty = (handler: (event: AddPropertyEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: AddPropertyEvent) => void`): A callback to execute when the event is fired.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `ADD_PROPERTY`
    -   **Payload Interface**: `AddPropertyEvent`

---

### `removeProperty()`

-   **Description**: Publishes an event to remove one or more properties.
-   **Type**: Publisher
-   **Signature**: `export const removeProperty = (data: Partial<PropertyComponentRawData>[]): void`
-   **Parameters**:
    -   `data` (`Partial<PropertyComponentRawData>[]`): An array of partial property data to remove.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `REMOVE_PROPERTY`
    -   **Payload Interface**: `RemovePropertyEvent`

---

### `subscribeToRemoveProperty()`

-   **Description**: Subscribes to the `removeProperty` event.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToRemoveProperty = (handler: (event: RemovePropertyEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: RemovePropertyEvent) => void`): A callback to execute when the event is fired.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `REMOVE_PROPERTY`
    -   **Payload Interface**: `RemovePropertyEvent`

---

### `updateProperty()`

-   **Description**: Publishes an event to update a property.
-   **Type**: Publisher
-   **Signature**: `export const updateProperty = (data: Partial<PropertyComponentRawData>): void`
-   **Parameters**:
    -   `data` (`Partial<PropertyComponentRawData>`): The partial property data to update.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `UPDATE_PROPERTY`
    -   **Payload Interface**: `UpdatePropertyEvent`

---

### `subscribeToUpdateProperty()`

-   **Description**: Subscribes to the `updateProperty` event.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToUpdateProperty = (handler: (event: UpdatePropertyEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: UpdatePropertyEvent) => void`): A callback to execute when the event is fired.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `UPDATE_PROPERTY`
    -   **Payload Interface**: `UpdatePropertyEvent`

### UI Context

This domain handles events related to the UI context, such as element selection.

---

### `requestElementSelection()`

-   **Description**: Asynchronously requests the current element selection from the UI context.
-   **Type**: Requestor
-   **Signature**: `export const requestElementSelection = async (): Promise<string[]>`
-   **Parameters**: None
-   **Returns**:
    -   `Promise<string[]>`: A promise that resolves with an array of selected element IDs.
-   **Associated Event**:
    -   **Event Type**: `REQUEST_ELEMENT_SELECTION`
    -   **Payload Interface**: `RequestElementSelectionEvent`

---

### `finishRequestElementSelection()`

-   **Description**: Publishes the response to a `requestElementSelection` event.
-   **Type**: Publisher (Response)
-   **Signature**: `export const finishRequestElementSelection = (elementSelection: Set<string>): void`
-   **Parameters**:
    -   `elementSelection` (`Set<string>`): The set of selected element IDs.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `FINISH_REQUEST_ELEMENT_SELECTION`
    -   **Payload Interface**: `FinishRequestElementSelectionEvent`

### Core

This domain handles core events, such as adding elements.

---

### `coreAddElement()`

-   **Description**: Publishes an event to add an element to the core.
-   **Type**: Publisher
-   **Signature**: `export const coreAddElement = (data: PositionData & Partial<DimensionData>): void`
-   **Parameters**:
    -   `data` (`PositionData & Partial<DimensionData>`): The position and optional dimensions of the element to add.
-   **Returns**: `void`
-   **Associated Event**:
    -   **Event Type**: `CORE_ADD_ELEMENT`
    -   **Payload Interface**: `CoreAddElementEvent`

---

### `subscribeToCoreAddElement()`

-   **Description**: Subscribes to the `coreAddElement` event.
-   **Type**: Subscriber
-   **Signature**: `export const subscribeToCoreAddElement = (handler: (event: CoreAddElementEvent) => void): Subscription`
-   **Parameters**:
    -   `handler` (`(event: CoreAddElementEvent) => void`): A callback to execute when the event is fired.
-   **Returns**: `Subscription`
-   **Associated Event**:
    -   **Event Type**: `CORE_ADD_ELEMENT`
    -   **Payload Interface**: `CoreAddElementEvent` 
