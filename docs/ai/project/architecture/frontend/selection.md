# Selection System Architecture

## Overview
The `selection` package is responsible for managing the "selection" state of the application. It tracks which elements are currently selected by the user.

## Core Responsibilities
1.  **State Management**: Tracks a set of selected element IDs.
2.  **Selection Types**: Can theoretically manage different types of selections (though typically focused on `DEFAULT` or `ELEMENT` selection).
3.  **Operations**: Provides methods to add, remove, toggle, and clear selections.

## Key Components

### `SelectionManager` (`src/selection-manager.ts`)
A registry that can hold multiple `Selection` instances keyed by type.

### `Selection` Interface
Defines the contract for selection sets. Likely uses `Set<string>` internally to store element IDs.

## Integration
*   **Interaction Core**: Checks `selection` to decide actions (e.g., if I drag on a selected element, I move it; if I drag on empty space, I select).
*   **Scene Tree**: Often queries `selection` to apply updates to "all selected items".
*   **Render**: Observes `selection` to draw selection bounds/handles.
