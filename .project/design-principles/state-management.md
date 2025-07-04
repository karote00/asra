# Design Principle: State Management

This document defines the principles for managing application state, distinguishing between local (client-specific) and shared (collaborative) state. This distinction dictates where state should reside and how it should be synchronized.

## Guiding Principle

**The nature of the state (local vs. shared) determines its management strategy.**

-   **Local State**: State that is relevant only to a single client and does not need to be synchronized with other users.
-   **Shared State**: State that must be synchronized across all connected clients to enable real-time collaboration.

## Local State Management

-   **Definition**: Information that is unique to a user's current session or environment and does not impact other collaborators.
-   **Examples**: Mouse position, keyboard key states, local UI preferences, temporary selections (if not intended for collaboration).
-   **Handling**: This state is managed directly within the relevant repository or component. It does not involve YJS or the collaborative document.
-   **Communication**: Changes to local state can be communicated via `@asra/reactive-events` if other parts of the *local* application need to react to them.

## Shared State Management

-   **Definition**: Information that represents the core application data model and must be consistent across all collaborative clients.
-   **Examples**: Scene graph (elements, their hierarchy, properties), document metadata, undo/redo history (if collaborative).
-   **Handling**: This state is managed using **YJS objects**. YJS provides the underlying CRDT (Conflict-free Replicated Data Type) capabilities to ensure automatic synchronization and conflict resolution across all connected clients.
-   **Communication**: When shared state changes, the updates are automatically propagated by YJS. Repositories that need to react to these changes (e.g., `@asra/render`, `@asra/ui-context`) directly observe the YJS object for granular updates. High-level events (via `@asra/reactive-events`) may still be published to signal that a shared state change *has occurred*, but the detailed data for the change comes from the YJS object itself.

## Relationship between Event Flow and Data Flow

-   **Events (Reactive Events)**: Primarily signal *actions*, *commands*, or *notifications* (e.g., "user clicked here", "element created", "tool changed"). For shared state, events might carry the data that will be applied to the YJS document (e.g., `updateComputedData` event payload becomes YJS data).
-   **Data (YJS)**: Represents the *current truth* of the shared application state. Components react to changes in the YJS document to update their views or internal logic.

This clear separation ensures that the system is both responsive to user actions and robust in its collaborative capabilities.
