# EPIC: State Management & Collaboration

## Goal
To maintain a robust, consistent, and collaborative application state that supports Undo/Redo and real-time multiplayer editing from the ground up.

## Core Functionalities (Scope)

This Epic encompasses:
1.  **Single Source of Truth**: Using YJS as the definitive data model.
2.  **Transaction Management**: Grouping atomic actions into undoable steps.
3.  **Undo/Redo**: Reverting and re-applying history stacks.
4.  **Data Persistence**: Loading and Saving project state.

## Linked Documentation

### Architecture & APIs
-   **[Factory](./../architecture/frontend/factory.md)**: The central manager for YJS and Transactions.
-   **[Scene Tree](./../architecture/frontend/scene-tree.md)**: The data model structure.
-   **[Core](./../architecture/frontend/core.md)**: The orchestrator of transactions.

### Design Principles
-   **[State Management](./../design-principles/state-management.md)**: Rules for Local vs. Shared state.
-   **[Transaction Management](./../design-principles/transaction-management.md)**: Implementation of the `start` -> `update` -> `end` pattern.

## User Stories (High Level)

1.  **US-01**: As a user, I want my actions (create, move, resize) to be undoable.
2.  **US-02**: As a user, I want to press Cmd+Z to undo and Cmd+Shift+Z to redo.
3.  **US-03**: As a user, I expect my document to save and load correctly, preserving all properties.
4.  **US-04** (Internal): As a developer, I want all data mutations to be collaborative-ready (YJS) by default.

## Technical Dependencies

-   **`@asra/factory`**: Wraps YJS `Y.Doc`, `Y.Map`, `Y.Array`.
-   **Custom Middleware**: To translate application events into YJS mutations.
