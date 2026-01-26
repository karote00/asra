# Architecture: @asyra/reactive-events

## Core Responsibility

This package implements a global, application-wide event bus using `rxjs`. It is the **single source of truth for all asynchronous, cross-package communication**. Its primary goal is to allow feature packages (like `@asyra/core`, `@asyra/scene-tree`, etc.) to interact without depending on each other, preventing circular dependencies and ensuring a clean, unidirectional data flow.

## Architectural Principle: The Central Event Hub

The fundamental rule of this architecture is:

**No feature package should ever import another feature package. All interactions must go through `@asyra/reactive-events`.**

-   **Correct:** `@asyra/core` imports from `@asyra/reactive-events` to listen for an event from `@asyra/interaction-core`.
-   **Incorrect:** `@asyra/core` imports from `@asyra/interaction-core`.

This package acts as a central hub, defining all possible events and providing all necessary functions to publish and subscribe to them. This makes the system modular, testable, and easier to reason about.

## Key Files & Architecture

The architecture is a classic **Event Bus** pattern, centralized around a single `rxjs` `ReplaySubject`.

-   **`event-bus.ts`**: This is the heart of the package.
    -   It creates a single, global `ReplaySubject(1)` instance named `eventBus`. Using `ReplaySubject(1)` is a crucial design choice: it ensures that any new subscriber immediately receives the *last emitted event*, which is useful for state synchronization.
    -   `publishEvent(event: AllEvent)`: The primary function for dispatching events to the bus. All parts of the application use this to announce that something has happened.
    -   `createSubscribeEvent<T>(type, operators)`: A powerful higher-order function for creating type-safe subscription utilities. It abstracts away the `rxjs` `filter` logic, allowing consumer packages to create simple, declarative subscription functions (e.g., `subscribeToMouseUpdates(...)`).
    -   `getEventBusObserve()`: Returns the observable stream from the event bus, allowing for direct `rxjs`-based interactions.

-   **`types.ts`**: This file defines the "vocabulary" of the entire application.
    -   It contains multiple `enum` definitions (e.g., `CoreEventTypes`, `RenderEventTypes`), each corresponding to a specific domain or feature of the application.
    -   It exports a single, comprehensive `EventTypes` object that merges all the individual enums. This provides a single source of truth for all possible event type strings.

-   **`constants.ts`**:
    -   It defines the `AllEvent` type, which is a TypeScript union of all possible event interfaces. This ensures that any event passed to `publishEvent` is structurally valid.

-   **`index.ts`**:
    -   This file acts as the public API for the package, exporting all the necessary functions, types, and domain-specific event modules.

-   **Domain-Specific Directories (`/interaction-core`, `/scene-tree`, etc.)**:
    -   These directories re-export event definitions, publishers, and subscriber hooks for a specific internal domain. For example, `packages/reactive-events/src/interaction-core/` will contain files like:
        -   `events.ts`: Defines the interfaces for input system events (e.g., `{ type: 'updateMouseState', payload: ... }`).
        -   `publish.ts`: Contains wrapper functions that call the main `publishEvent` with the correct event structure (e.g., `publishMouseUpdate(payload)`).
        -   `subscribes.ts`: Contains functions created with `createSubscribeEvent` for easy consumption (e.g., `subscribeToInteractionCoreEvent(handler)`).

## How It Works: The Event Flow

1.  **Event Definition**: A developer first defines a new event type in `types.ts` (e.g., `MY_NEW_EVENT = 'myNewEvent'`) and its corresponding interface in the relevant domain directory (e.g., `packages/reactive-events/src/my-feature/events.ts`).

2.  **Publishing**: A feature package (e.g., `@asyra/interaction-core`) calls the specific, high-level publisher function for the event it wants to signal (e.g., `decideToCreateElement(...)`). It **does not** call the generic `publishEvent` directly.

3.  **Subscription**: Other packages that care about this event (e.g., `packages/render` to draw a cursor, `packages/ui-context` to show coordinates) use a pre-defined subscription function (like `subscribeToMouseUpdate(...)`).

4.  **Filtering & Delivery**: The `eventBus` receives the event. The `rxjs` stream within the subscription function filters the millions of potential events down to only the one it cares about (e.g., `updateMouseState`) and delivers the payload to the subscriber's handler function.

## Example Usage: Internal Communication

This example shows the primary use case: communication between two internal packages.

**Scenario**: The `interaction-core` package determines a user action should result in creating a new element. It calls the appropriate high-level function from `@asyra/reactive-events`. The `core` package, in turn, uses the corresponding high-level subscription function to listen for this event and handle the logic.

**1. Publishing Package (`@asyra/interaction-core`)**
```typescript
// In a file within @asyra/interaction-core
import { decideToCreateElement } from '@asyra/reactive-events';

function userClicksCreateButton() {
  // This package calls the specific, named function for the event.
  // It does NOT use the generic `publishEvent`.
  decideToCreateElement({ x: 10, y: 20 }, 'box');
}
```

**2. Subscribing Package (`@asyra/core`)**
```typescript
// In a file within @asyra/core
import { subscribeToDecideToCreateElement } from '@asyra/reactive-events';

// This package listens for the decision and handles the work.
const unsubscribe = subscribeToDecideToCreateElement((event) => {
  console.log('Creating element:', event.payload.elementType);
  // ... logic to actually create the element ...
});

// To prevent memory leaks, call unsubscribe() when appropriate.
```

## Integrating External Packages (The Adapter Pattern)

For packages that are intended to be open-source (like `@asyra/input-system`) or for any third-party libraries, a different approach is required. These packages **must not** have a direct dependency on `@asyra/reactive-events`.

Instead, we use the **Adapter Pattern**.

1.  **The External Package**: It has its own internal event system and exposes its own API (e.g., `inputSystem.on('pointerMove', handler)`).
2.  **The Adapter**: A dedicated internal package or a module in your main application is created. Its sole responsibility is to "bridge" the two systems. It listens to the external package's native events and **re-publishes** them onto the main application bus via `@asyra/reactive-events`.

This keeps the external package fully decoupled while allowing it to integrate cleanly with the rest of the application.
