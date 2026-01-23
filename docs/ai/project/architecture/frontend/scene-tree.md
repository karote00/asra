# Scene Tree Architecture

## Overview
The `scene-tree` package maintains the structure and state of the visual document. It acts as the "Model" in the MVC pattern of the application.

## Core Responsibilities
1.  **Element Management**: Creation, deletion, and retrieval of scene elements (rectangles, frames, text, etc.).
2.  **Hierarchy**: Manages parent-child relationships between elements.
3.  **State Updates**: Provides APIs to update element properties.
    *   **Computed Data**: Real-time, high-frequency updates (e.g., during a drag).
    *   **Transactional Data**: Persistent data synced via YJS (handled in coordination with `factory`).

## Key Components

### `SceneTree` (`src/sceneTree.ts`)
The main entry point. It exposes methods to query and manipulate the tree.
*   `getElement(id)`: Retrieve an element wrapper.
*   `updateComputedData(id, data)`: Fast, ephemeral updates.
*   `changeComputedData` (implicit selection): Helper to update currently selected elements.

### Components (`src/components/`)
Contains definitions for different element types and their specific logic/properties.

## Update Strategies
*   **Direct Updates**: `sceneTree.updateComputedData` is used for visual feedback (e.g., highlighting, temporary transforms) that does not necessarily need to be strictly versioned in the undo stack immediately.
*   **Transactional Integration**: `sceneTree` often works in tandem with `factory`. `factory` commits the final state to the history, while `sceneTree` handles the interim visual states.

## Data Flow
`Reactive Event` -> `Core Subscriber` -> `SceneTree API` -> `Render Trigger`
