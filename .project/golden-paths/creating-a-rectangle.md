# Golden Path: Creating a New Rectangle

This document describes the end-to-end, successful user journey of creating a new rectangle. It illustrates how multiple packages collaborate to achieve this single, critical feature, emphasizing the flow of data and decisions.

**User Goal**: The user wants to click on the canvas and see a new rectangle appear.

--- 

### The Journey

#### Architectural Note: Event Flow vs. Data Flow

It's crucial to understand the distinction between **Event Flow** and **Data Flow** in this architecture:

-   **Event Flow (via `@asra/reactive-events`)**: This handles notifications, commands, and decisions. It describes *what happened* or *what should happen*. Packages publish and subscribe to events to communicate actions and intentions. For certain events (e.g., `updateComputedData`), the event payload itself contains the data destined for the YJS document.
-   **Data Flow (via YJS/CRDT)**: This handles the actual application state and collaborative document. It describes *what the current state is*. Packages directly observe the YJS document for granular data changes, leveraging its CRDT capabilities for real-time synchronization and automatic updates across clients.

These two flows work in tandem. Events often signal that data changes have occurred or are about to occur, while direct observation of the YJS document provides the granular data for updates.

---

#### Step 1: The User Clicks (Input System & Core Middleware)

The journey begins when the user clicks the mouse on the main canvas element.

-   **Package**: `@asra/input-system` (or its adapter)
-   **Action**: It captures the browser's raw **mouse events** (e.g., `mousedown`, `mouseup`). It processes these raw events and determines that a "click" has occurred at a specific set of coordinates.

-   **Package**: `@asra/core` (acting as middleware)
-   **Action**: The `core` package is subscribed to the raw mouse events exposed by the `@asra/input-system` adapter. It acts as a central handler, processing these low-level events and enriching them with system context (e.g., current tool, key states, click position relative to canvas). At this point, `core` has **all the necessary data** to inform a decision.
-   **Event Published**: The `core` package publishes a high-level event like `decideToCreateElement` (via `@asra/reactive-events`) with the fully prepared payload.

#### Step 2: Decision Making (Interaction Core)

The `interaction-core` receives the fully prepared input and context, and makes a decision based on the current application state.

-   **Package**: `@asra/interaction-core`
-   **Action**: It receives the `decideToCreateElement` event from `core`. Since the event payload already contains all necessary data (position, element type, etc.), `interaction-core`'s role is to validate the decision and potentially add further context or trigger related actions.
-   **Decision**: "Based on the complete data provided, the user intends to create a rectangle. I will confirm this decision."

#### Step 3: Announcing the Decision (Reactive Events)

The `interaction-core` confirms the decision to create the rectangle by re-publishing the event, ensuring all relevant listeners are notified.

-   **Package**: `@asra/reactive-events`
-   **Action**: The `interaction-core` calls the `decideToCreateElement()` function from `@asra/reactive-events` (or a similar event if `interaction-core` adds further processing before re-publishing).
-   **Event Published**: `{ type: 'decideToCreateElement', payload: { elementType: 'rectangle', position: { ... } } }` (This event now carries all the data needed for creation).

#### Step 4: Element Creation and State Update (Scene Tree & Factory)

This is where the element's data is added to the application's central state, managed by YJS.

-   **Package**: `@asra/scene-tree`
-   **Action**: The `scene-tree` package is subscribed to the `decideToCreateElement` event (via `subscribeToDecideToCreateElement()`). It receives **all necessary information** (element type, position, etc.) directly within the event payload. It does not need to request further data.
-   **Collaboration with Factory**: The `scene-tree` then uses the `@asra/factory` package *only* for handling the YJS object and its transactions. The `factory` does not generate the initial element data; it provides the mechanism for applying changes to the shared collaborative document (the YJS object).
-   **Action**: The `scene-tree` adds the new rectangle data (received from the event payload) to its internal data structure and applies this change via the `factory` to the YJS document. This action triggers an internal change within the `scene-tree`'s YJS-managed state.
-   **Event Published**: The `scene-tree` publishes a `sceneTreeChanged` event (via `@asra/reactive-events`) to announce that the YJS document has been updated. This event serves as a high-level notification, not the granular data itself.

#### Step 5: Visual Representation (Render)

The `render` package is responsible for visually representing the application's state.

-   **Package**: `@asra/render`
-   **Action**: The `render` package *primarily* observes the YJS resource (which is the source of truth for the scene graph) provided by the `scene-tree` for granular data changes. When the YJS object changes, `render` automatically updates its visual representation. It *also* listens to relevant events from `@asra/reactive-events` (such as `sceneTreeChanged`) as *triggers* or *signals* to re-evaluate the YJS state or perform specific rendering actions that might not be directly tied to a YJS data change.
-   **Response**: Upon observing changes in the YJS resource, the `render` package identifies the new rectangle (or any other changes) and uses its rendering logic (e.g., Pixi.js, Three.js) to draw or update the elements on the canvas, ensuring the visual representation is always in sync with the YJS data.

#### Step 6: UI Synchronization (UI Context)

For UI-specific needs, the `ui-context` ensures the user interface reflects the latest application state.

-   **Package**: `@asra/ui-context`
-   **Action**: The `ui-context` package *primarily* observes the YJS resource for UI-relevant data. When the YJS object changes, `ui-context` automatically processes these changes to update its internal UI state. It *also* listens to relevant events from `@asra/reactive-events` (such as `sceneTreeChanged`) as *triggers* or *signals* for UI updates that might not be directly tied to a YJS data change.
-   **Response**: Based on the changes observed in the YJS document or triggered by events, the `ui-context` calls appropriate APIs (e.g., `notifyUIComponentUpdate()`) to trigger re-renders or updates in the user interface, ensuring the UI is synchronized with the underlying data.

### Conclusion

The user's single click has successfully traveled through the entire application stack, with each package performing its specific, decoupled role. This demonstrates the power of a reactive, event-driven architecture, where **events signal actions and data changes, and the YJS document serves as the single source of truth for the application's state**, enabling robust collaboration and real-time updates.