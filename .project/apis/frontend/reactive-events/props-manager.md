# Props Manager API

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
