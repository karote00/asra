# Input System Architecture

## Overview
The `input-system` package is responsible for capturing raw user interactions from the browser (mouse, keyboard, wheel) and normalizing them into internal "Input Actions". It serves as the first layer in the event handling pipeline.

## Core Responsibilities
1.  **Event Listeners**: Attaches `mousedown`, `mousemove`, `mouseup`, `keydown`, `keyup`, and `wheel` listeners to the window or canvas.
2.  **Normalization**: Converts browser events into a standard internal format.
3.  **Mapping**: Uses a simplified keymap and event mapping system to translate raw inputs into `INPUT_ACTIONS` (e.g., `InputAction.LeftMouseDown`, `InputAction.SpaceKeyDown`).
4.  **Emission**: Emits these actions via a local subscription mechanism, which `packages/core` eventually subscribes to.

## Key Components

### `InputSystem` (`src/input-system.ts`)
The singleton class that initializes listeners and manages the event loop.

### `event-mappings.ts`
Defines the mapping between raw event types (and modifiers) and internal `INPUT_ACTIONS`.

### `keymap.ts`
Handling specific key bindings and aliases.

## Interaction Flow
1.  User performs an action (e.g., presses 'V').
2.  `InputSystem` captures the `keydown` event.
3.  It checks `event-mappings.ts` / `keymap.ts`.
4.  It identifies the action as `INPUT_ACTIONS.SWITCH_TO_SELECT_TOOL` (hypothetically).
5.  It invokes subscribed callbacks (usually from `@asra/core`) with this action.

## Isolation
The `input-system` **does not** know about:
*   Tools (Select tool, Rectangle tool)
*   Canvas elements
*   Selection state
It blindly reports "User pressed 'V'", and leaves the interpretation to `interaction-core`.
