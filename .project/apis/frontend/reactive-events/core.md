# Core API

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
