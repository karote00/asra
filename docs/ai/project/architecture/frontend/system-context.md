# System Context Architecture

## Overview
The `system-context` package acts as the centralized repository for ephemeral, global application state. It aggregates various state slices into a single accessible context.

## Core Responsibilities
1.  **State Aggregation**: Combines `MouseState`, `KeyState`, `PrimaryToolState`, and `TargetState` (hovered elements).
2.  **Snapshotting**: Provides a `getSystemContextSnapshot()` method to get the instantaneous state of all these inputs. This is crucial for `interaction-core` to make decisions based on the *current* reality.
3.  **Updates**: Provides specific APIs to update each slice (e.g., `updateMouseState`, `switchPrimaryTool`).

## Key State Slices
*   **`systemState`**: General system mode.
*   **`primaryToolState`**: Which tool is active (Selector, Rectangle, Hand, etc.).
*   **`mouseState`**: Current coordinates (client, page, viewport), button states.
*   **`keyState`**: Currently held modifier keys (Shift, Ctrl, Alt, Space).
*   **`targetState`**: Which element is currently under the cursor (`hoveredElementId`).

## Usage
The `SystemContext` object is typically injected into or imported by `interaction-core` rules. When an event arrives, the specific rule checks `SystemContext` to see, for example, "Is the Space key held down?" or "Is the active tool the Pen tool?".
