# API Reference: @asyra/interaction-core

The `@asyra/interaction-core` package is the decision engine. It exposes methods to feed input events into its internal state machine/decider logic.

## Session Management

### `executeAction()`
-   **Description**: Processes a discrete, one-off action.
-   **Signature**: `executeAction(eventName: InputSystemEvents, systemContextSnapshot: SystemContextSnapshot, detail?: DetailType): void`

### `startSession()`
-   **Description**: Initiates a continuous interaction session. Clears any previous session and dispatches the start event.
-   **Signature**: `startSession(eventName: InputSystemEvents, systemContextSnapshot: SystemContextSnapshot, detail?: DetailType): void`

### `updateSession()`
-   **Description**: Updates the current ongoing session. Used for continuous events like dragging.
-   **Signature**: `updateSession(eventName: InputSystemEvents, systemContextSnapshot: SystemContextSnapshot, detail?: DetailType): void`

### `endSession()`
-   **Description**: Terminates the current session. Dispatches the end event and clears the session state.
-   **Signature**: `endSession(eventName: InputSystemEvents, systemContextSnapshot: SystemContextSnapshot, detail?: DetailType): void`
