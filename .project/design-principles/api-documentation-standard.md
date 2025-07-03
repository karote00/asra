# Design Principle: API Documentation Standard

This document defines the standard format for all API reference documentation stored in `.project/apis/`. Following this standard ensures that API documentation is clear, consistent, and provides the necessary level of detail for developers.

## Guiding Principles

1.  **Source from Code**: Documentation should reflect the reality of the source code. Whenever possible, information should be sourced from the code itself.
2.  **Prioritize JSDoc**: If a function has a JSDoc comment block (`/** ... */`), its content **must** be used for the function's description. This encourages keeping documentation close to the implementation.
3.  **Consistency**: All API reference documents must follow the template defined below.

## Documentation Template

Each documented function must have a dedicated section with the following structure and fields.

---

### `functionName()`

-   **Description**: A clear, one-sentence summary of the function's purpose. **This MUST be taken from the function's JSDoc comments if they exist.** If not, a description should be generated.
-   **Type**: The function's role in the event system (e.g., Publisher, Subscriber, Requestor, Stream Creator).
-   **Signature**: The full TypeScript function signature.
-   **Parameters**:
    -   `paramName` (`type`): A description of the parameter's purpose.
-   **Returns**:
    -   `returnType`: A description of what the function returns (e.g., a `Promise<string>`, a `Subscription` object for unsubscribing).
-   **Associated Event**:
    -   **Event Type**: The `EventTypes` enum member (e.g., `REQUEST_CURRENT_PRIMARY_TOOL`).
    -   **Payload Interface**: The name of the event's payload interface (e.g., `RequestCurrentPrimaryToolPayload`).
-   **Example**:
    ```typescript
    // A clear, concise code snippet showing a typical use case.
    ```

---

### Golden Example: `requestCurrentPrimaryTool`

Here is an example of the template applied to a real function.

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
    -   **Payload Interface**: `RequestCurrentPrimaryToolPayload`
-   **Example**:
    ```typescript
    async function onButtonClick() {
      const currentTool = await requestCurrentPrimaryTool();
      console.log(`The current tool is: ${currentTool}`);
    }
    ```
