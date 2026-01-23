# Design Principle: Transaction Management for Undo/Redo

This document defines the standard pattern for managing undoable actions within the application. This pattern ensures that user operations can be grouped into logical units for robust undo/redo functionality.

## Guiding Principle

**All user-initiated actions that modify the shared state and should be undoable must be wrapped within a transaction.**

## Transaction Lifecycle

An undoable action follows a clear transaction lifecycle, typically orchestrated by the `@asra/core` package.

1.  **Start Transaction (`startTransaction()`):**
    -   **Purpose**: Initiates a new undoable transaction. All subsequent changes until `endTransaction()` are grouped into a single undo/redo step.
    -   **Usage**: Called at the very beginning of an undoable user action.
    -   **Signature (conceptual)**: `startTransaction(): void`

2.  **Update Transaction (`updateTransaction(eventName, payload)`):**
    -   **Purpose**: Records specific changes or intermediate states within an active transaction. This allows for granular control over what constitutes a single undo/redo step, even if multiple underlying data modifications occur.
    -   **Usage**: Called whenever a significant, recordable change occurs as part of an ongoing transaction.
    -   **Signature (conceptual)**: `updateTransaction(eventName: EventTypes, payload: any): void`
    -   **Note**: The `payload` here would typically be the data that describes the change, which might then be synchronized via YJS.

3.  **End Transaction (`endTransaction()`):**
    -   **Purpose**: Finalizes the current undoable transaction. The changes recorded since `startTransaction()` are now committed as a single undoable unit.
    -   **Usage**: Called at the very end of an undoable user action.
    -   **Signature (conceptual)**: `endTransaction(): void`

## Integration with Factory and YJS

Transaction management is primarily handled by the `@asra/factory` package. The `factory` is responsible for maintaining the undo/redo stacks and processing changes.

-   When `startTransaction()` is called, it signals the `factory` to begin a new undo/redo group.
-   `updateTransaction()` provides the `factory` with the specific change payloads (which might be synchronized via YJS) that need to be recorded for the current undo/redo step.
-   `endTransaction()` signals the `factory` to finalize the current undo/redo group and commit it to its internal history.

YJS objects are used by the `factory` to synchronize these change payloads across clients. The `factory` listens to relevant YJS object changes (e.g., for scene-tree or selection data) and integrates these synchronized changes into its own undo/redo logic. This means the application does not directly use YJS's built-in UndoManager; instead, the `factory` implements a custom undo/redo mechanism that leverages YJS for cross-client synchronization of the change data.

This pattern ensures that even complex, multi-step user interactions can be undone or redone as a single, cohesive operation, with the `factory` acting as the central coordinator for collaborative undo/redo.
