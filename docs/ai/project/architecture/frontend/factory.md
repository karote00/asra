# Architecture: @asyra/factory

## Core Responsibility

The `@asyra/factory` package serves as the central coordinator for **collaborative data synchronization via YJS** and the **custom undo/redo system**. Its primary responsibility is to act as the bridge between application-level changes and their propagation/reversion across clients. It manages the YJS collaborative data structures and orchestrates the custom undo/redo mechanism, using YJS to synchronize the change payloads that drive this system.

## Key Files & Architecture

The package implements a sophisticated **Collaborative Data & Transaction Management** pattern.

-   **`factory.ts`**: This file defines the `Factory` class, which is the main public interface of the package.
    -   It holds instances of YJS collaborative data structures (e.g., `Y.Array`, `Y.Map`) such as `sceneTreeChanges`, `elementSelectionChanges`, and `propsChanges`. These are the actual YJS objects that other packages (like `@asyra/render`, `@asyra/ui-context`) observe for granular data changes.
    -   It instantiates and delegates to the `DataTransact` class for the core undo/redo logic.
    -   It exposes high-level methods like `startTransaction()`, `updateTransaction()`, `endTransaction()`, `undo()`, and `redo()`, which are called by other parts of the application (primarily `@asyra/core`).

-   **`data-transact.ts`**: This file defines the `DataTransact` class, which is the heart of the custom undo/redo system.
    -   It maintains `undoStack` and `redoStack` (arrays of `AllEvent[]`). This confirms that the undo/redo system operates on *event payloads* (which describe changes), not raw YJS states.
    -   `start()`, `update()`, `end()`: These methods manage the collection of `AllEvent` payloads into a single transaction (`this.changes`).
    -   `commitUndo()`: Pushes the collected `changes` onto the `undoStack` and clears the `redoStack`.
    -   `undo()` and `redo()`: These methods iterate through the respective stacks, reverse/re-apply the stored `AllEvent` payloads by *re-publishing them* via `publishEvent()` from `@asyra/reactive-events`. This is a critical detail: undo/redo is achieved by re-emitting the original events (or their inverse) through the event bus.
    -   It uses `isInUndo()` and `isInRedo()` flags to prevent infinite loops when re-publishing events during undo/redo operations.
    -   It interacts directly with the YJS `Y.Array` or `Y.Map` instances (e.g., `ChangesMaps`) to push the `event.payload` into the YJS document. This is the point where the event payload becomes the YJS data.

-   **`registry/`**: This directory contains the definitions and instantiations of the specific YJS collaborative data structures.
    -   Files like `props.ts`, `scene-tree.ts`, and `selection.ts` within this directory define and export the actual YJS `Y.Array` or `Y.Map` instances (e.g., `sceneTreeChanges`, `elementSelectionChanges`, `propsChanges`) that hold the shared data for their respective domains.

-   **`subscribes.ts`**: This file initializes the package's entry point for receiving transaction-related events from `@asyra/reactive-events`.
    -   It subscribes to `startTransaction`, `updateTransaction`, `endTransaction`, `undo`, and `redo` events.
    -   Upon receiving these events, it calls the corresponding methods on the `factory` instance, feeding the transaction commands into the `DataTransact` logic.

## Inter-Package Communication

-   **Receives from `@asyra/reactive-events`**: Subscribes to transaction control events (`startTransaction`, `updateTransaction`, `endTransaction`, `undo`, `redo`) which are typically published by `@asyra/core`.
-   **Publishes to `@asyra/reactive-events`**: Re-publishes events during undo/redo operations (from `DataTransact`'s `undo()` and `redo()` methods) to ensure that the application state is correctly reverted or re-applied through the standard event flow.
-   **Exposes YJS Objects**: Exposes its YJS collaborative data structures (e.g., `factory.sceneTreeMap`, `factory.elementSelectionMap`) for direct observation by packages like `@asyra/render` and `@asyra/ui-context`. These YJS objects are the source of truth for shared data.

## How It Works: Collaborative Data & Undo/Redo Flow

1.  **Transaction Initiation**: `@asyra/core` publishes `startTransaction` (via `@asyra/reactive-events`). The `factory`'s `subscribes.ts` listens and calls `factory.startTransaction()`, which in turn calls `dataTransact.start()`. This begins collecting changes for a single undo step.
2.  **Change Recording**: As application logic modifies shared state (e.g., `scene-tree` adds an element), it publishes an event (e.g., `addRectangle`). The `scene-tree` then calls `updateTransaction()` (via `@asyra/reactive-events`) with a payload describing the change. The `factory`'s `subscribes.ts` listens and calls `factory.updateTransaction()`, which calls `dataTransact.update()`. `dataTransact` records this event payload in its `changes` array and also pushes the payload into the relevant YJS `Y.Array` (e.g., `sceneTreeChanges`).
3.  **YJS Synchronization**: YJS automatically synchronizes these changes across all connected clients. Other clients receive the YJS updates and apply them to their local YJS objects.
4.  **Transaction Finalization**: `@asyra/core` publishes `endTransaction`. The `factory`'s `subscribes.ts` listens and calls `factory.endTransaction()`, which calls `dataTransact.end()`. `dataTransact` then `commitUndo()`, pushing the collected `changes` onto the `undoStack` and clearing the `redoStack`.
5.  **Undo/Redo Execution**: When `@asyra/core` publishes `undo` or `redo` events, the `factory`'s `subscribes.ts` listens and calls `factory.undo()` or `factory.redo()`. `dataTransact` pops the last set of changes from the appropriate stack and *re-publishes* each `AllEvent` payload (or its inverse for undo) via `publishEvent()`. This re-triggers the original application logic, effectively reverting or re-applying the state.
6.  **Observation**: Packages like `@asyra/render` and `@asyra/ui-context` directly observe the YJS objects (e.g., `factory.sceneTreeMap`) for granular data changes. When YJS updates, these observers react and update their visual representation or UI state accordingly.

This architecture ensures a robust, collaborative, and undoable application state, with the `factory` acting as the central orchestrator for data synchronization and transaction history.
