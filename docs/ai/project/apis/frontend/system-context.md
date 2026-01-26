# API Reference: @asyra/system-context

The `@asyra/system-context` package maintains the real-time global state of the application's input and modes.

## State Snapshots

### `getSystemContextSnapshot()`
-   **Description**: Returns a synchronized snapshot of all current states (Mouse, Key, Tool, Target). Essential for decision making.
-   **Signature**: `getSystemContextSnapshot(): SystemContextSnapshot`

## Tool Management

### `getCurrentPrimaryTool()`
-   **Description**: Returns the currently active primary tool.
-   **Signature**: `getCurrentPrimaryTool(): PrimaryToolType`

### `switchPrimaryTool()`
-   **Description**: Sets the active primary tool.
-   **Signature**: `switchPrimaryTool(tool: PrimaryToolType): void`

## Input State Updates

### `updateMouseState()`
-   **Description**: Updates the tracked mouse position and button state.
-   **Signature**: `updateMouseState(data: MouseSnapshot): void`

### `updateKeyState()`
-   **Description**: Updates the tracked keyboard modifiers and active keys.
-   **Signature**: `updateKeyState(data: KeySnapshot): void`

### `updateHoveredElementId()`
-   **Description**: Updates which element is currently being hovered.
-   **Signature**: `updateHoveredElementId(elementId: string | null): void`
