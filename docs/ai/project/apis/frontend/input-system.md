# API Reference: @asyra/input-system

The `@asyra/input-system` package normalizes raw browser events (keyboard, mouse, wheel) into a coherent stream of high-level input signals using a combination-based matching system.

## Setup & Configuration

### `setCombinations()`
-   **Description**: Configures custom key combinations. (Note: Currently the system relies heavily on internal `InputEventMappings`).
-   **Signature**: `setCombinations(combinations: Combinations): void`

### `switchWatchedElement()`
-   **Description**: Changes the DOM element that the input system attaches event listeners to. Defaults to `window`.
-   **Signature**: `switchWatchedElement(watchedElement: HTMLElement): void`

## Event Subscription

### `on()`
-   **Description**: Register a callback for a specific high-level input action (e.g., 'LEFT_MOUSE_UP').
-   **Signature**: `on(action: string, callback: (raw: RawInputEvent) => void): this`
-   **Payload**: The callback receives a `RawInputEvent` containing keys, modifiers, and pointer data.

## Internal Mechanics

The system automatically handles:
-   **Debouncing/clearing** of key states.
-   **Modifier key normalized** (meta, ctrl, alt, shift).
-   **Gesture detection** using `mousedown`, `mousemove`, `mouseup` to distinguish clicks from drags.
