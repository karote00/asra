# Scene Tree API

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
-   **Signature**: `export const changeComputedData = (elementIds: string[], key: string, data: DataTypes, options = { undoable: true }): void`
-   **Parameters**:
    -   `elementIds` (`string[]`): The IDs of the elements to update.
    -   `key` (`string`): The key of the data to update.
    -   `data` (`DataTypes`): The new data value.
    -   `options` (`{ undoable: boolean }`): Optional configuration.
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
