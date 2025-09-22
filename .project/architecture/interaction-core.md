# Architecture: @asra/interaction-core

## Core Responsibility

The `@asra/interaction-core` package serves as the central decision-making unit of the application. Its primary responsibility is to interpret high-level input events (processed by `@asra/core`'s middleware) and the current system context, determine the user's intent, and then dispatch these decisions as specific, actionable events via `@asra/reactive-events`. It effectively translates raw user interactions into meaningful application actions.

## Key Files & Architecture

The package implements a **Decision-Dispatch Pattern**, where input is processed, a decision is made, and then dispatched to a specific handler.

-   **`interaction-core.ts`**: This file defines the `InteractionCore` class, which is the heart of the package. It manages the lifecycle of user interaction sessions and orchestrates the decision-making and dispatch process.
    -   It utilizes the `decideInteraction` function (from the `decider` module) to determine the user's intent based on input events and system context.
    -   It uses the `InteractionCoreHandlers` map (from the `handlers` module) to find and execute the appropriate handler for the determined interaction.
    -   It maintains a `_previousSession` to manage ongoing interactions. Its methods (`executeAction`, `startSession`, `updateSession`, `endSession`) implement specific logic:
        -   `executeAction()`: Calls `dispatchSession()`. This method first clears any `_previousSession` and then sets it to the new action, effectively **replacing** the previous session.
        -   `startSession()`: Calls `dispatchSession()`. This method first clears any `_previousSession` and then sets it to the new session, effectively **replacing** the previous session.
        -   `updateSession()`: Always sets `_previousSession` to the newly decided `interaction`. (Note: The current code does not implement conditional cancellation or stopping based on type mismatch as discussed).
        -   `endSession()`: Calls `cancelPreviousSession()`, which sets `_previousSession` to `null`, effectively **clearing** the previous session.

- **`decider/`**: This directory contains the logic responsible for interpreting input and context to make a decision about the user's intent.

  - **`interaction-decider.ts`**: (Inferred from `interaction-core.ts` import) This file likely contains the `decideInteraction` function. This function takes an `InputSystemEvents` (the high-level input event name) and a `SystemContextSnapshot` (the current state of the application context) and returns an `InteractionEvent` (e.g., `DECIDE_TO_CREATE_ELEMENT`, `DECIDE_TO_SWITCH_PRIMARY_TOOL`). This is where the core logic for translating input into intent resides.

- **`handlers/`**: This directory contains the specific handlers for each type of `InteractionEvent`.

  - **`index.ts`**: This file aggregates all individual handlers into a single `InteractionCoreHandlers` map. Each handler function in this map is responsible for taking the payload of an `InteractionEvent` and publishing the corresponding specific event via `@asra/reactive-events` (e.g., `decideToCreateElement`, `decideToSwitchPrimaryTool`). This ensures that the decisions made by the `decider` are properly announced to the rest of the application.
  - **Subdirectories (e.g., `primary-tool`, `element`, `undoredo`)**: These subdirectories contain the individual handler functions for specific interaction types. For example, `primary-tool/index.ts` would export handlers related to tool switching decisions.

- **`subscribes.ts`**: This file initializes the package's entry point for receiving events from `@asra/reactive-events`.
  - It subscribes to generic interaction lifecycle events (e.g., `executeAction`, `startSession`, `updateSession`, `endSession`) which are typically published by the `@asra/core` middleware.
  - Upon receiving these events, it calls the corresponding methods on the `InteractionCore` instance, feeding the processed input and context into the decision-making pipeline.

## Inter-Package Communication

- **Receives from `@asra/reactive-events`**: Subscribes to high-level input events (e.g., `executeAction`, `startSession`) that have been processed and enriched by `@asra/core`.
- **Publishes to `@asra/reactive-events`**: Publishes specific decision events (e.g., `decideToCreateElement`, `decideToSwitchPrimaryTool`) that signal the user's intent to other parts of the application. These are the events that other core application logic packages will subscribe to.

## How It Works: Decision Flow

1.  **Input Reception**: The `subscribes.ts` file listens for processed input events from `@asra/reactive-events`. These events (e.g., `executeAction`, `startSession`, `updateSession`, `endSession`) are published by `@asra/core`'s middleware, which determines the appropriate event based on the nature of the user input (e.g., a single click vs. a continuous drag).
2.  **Method Call**: The received event triggers a corresponding method call on the `InteractionCore` instance (e.g., `interactionCore.executeAction(...)` or `interactionCore.startSession(...)`).
3.  **Decision Making**: Inside the `InteractionCore` method, the `decideInteraction` function (from `decider/`) is invoked. It analyzes the input event and the current `SystemContextSnapshot` to determine the precise user intent (e.g., `DECIDE_TO_CREATE_ELEMENT`).
4.  **Handler Dispatch**: The `InteractionCore` then uses the `InteractionCoreHandlers` map to find the appropriate handler for the determined `InteractionEvent.type`.
5.  **Event Publication**: The selected handler (from `handlers/`) publishes a specific, high-level decision event (e.g., `decideToCreateElement`) via `@asra/reactive-events`. This event carries all the necessary payload for other parts of the application to act upon.

This structured flow ensures that `interaction-core` acts as a clear translation layer between raw user input and high-level application commands.
