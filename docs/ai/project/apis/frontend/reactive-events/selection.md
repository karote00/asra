# Selection API

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
