# UI Context API

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
