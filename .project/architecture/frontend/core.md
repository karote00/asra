# Architecture: @asra/core

## Core Responsibility

The `@asra/core` package acts as the **central nervous system** and **orchestrator** of the application. It is the middleware that connects all other domain-specific packages (`scene-tree`, `input-system`, `interaction-core`, etc.).

Its primary responsibilities are:
1.  **Facade**: Providing a unified, high-level API for the application (so the UI doesn't need to know about 10 different packages).
2.  **Orchestration**: Managing complex workflows that span multiple packages (e.g., "Create Element" involves transaction management, data creation, and selection).
3.  **Wiring**: Initializing dependencies and binding event subscribers to handlers.

## Key Files & Architecture

The package follows a **Facade & Mediator Pattern**.

-   **`core.ts`**: The main entry point. It exports the `Core` class, which aggregates all the APIs. It initializes the system by injecting dependencies (`inputSystem`, `factory`, `render`, etc.) into the subscribers.
-   **`apis/`**: This directory contains the implementation of the high-level APIs. These functions are where the *orchestration* happens.
    -   *Example*: `scene-tree.ts` implementation of `addRectangle` doesn't just call "add rectangle". It calls `startTransaction()`, then `addRectangle()`, then `selectElements()`, then `endTransaction()`. This encapsulates the business process.
-   **`subscribes/`**: This directory contains the event listeners. It listens to raw events (like Input System events) or high-level signals and routes them to the appropriate API functions.

## Inter-Package Communication

`@asra/core` sits in the middle of everything.

-   **Receives from**: `input-system` (raw processing), and virtually all other packages via `reactive-events` (listening for signals).
-   **Delegates to**: `interaction-core` (for decisions), `scene-tree` (for data), `factory` (for transactions), `render` (for visuals).

## How It Works: The Orchestration Flow

1.  **Initialization**: `core.ts` is instantiated. It calls `initAllHandlers`, which sets up subscriptions to `reactive-events`.
2.  **Event Processing**: When an event occurs (e.g., User Input), a subscriber in `subscribes/` catches it.
3.  **Workflow Execution**: The subscriber calls a method on the `Core` instance (defined in `apis/`).
4.  **Coordination**: The API method executes a sequence of actions—potentially calling APIs of multiple other packages (e.g., `sceneTree.add()`, `selection.set()`, `factory.transaction()`).

This architecture ensures that individual packages remain loosely coupled, as they don't need to know about each other's complex workflows—only `core` knows the full story.
