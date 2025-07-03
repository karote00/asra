# Golden Path: Creating a New Rectangle

This document describes the end-to-end, successful user journey of creating a new rectangle. It illustrates how multiple packages collaborate to achieve this single, critical feature, emphasizing the flow of data and decisions.

**User Goal**: The user wants to click on the canvas and see a new rectangle appear.

--- 

### The Journey

#### Step 1: The User Clicks (Input System & Core Adapter)

The journey begins when the user clicks the mouse on the main canvas element.

-   **Package**: `@asra/input-system` (or its adapter)
-   **Action**: It captures the browser's raw **mouse events** (e.g., `mousedown`, `mouseup`). It processes these raw events and determines that a "click" has occurred at a specific set of coordinates.

-   **Package**: `@asra/core` (acting as an adapter/middleware)
-   **Action**: The `core` package is subscribed to the raw mouse events exposed by the `@asra/input-system` adapter. It acts as a central handler, processing these low-level events and enriching them with system context (e.g., current tool, key states) before passing them on.
-   **Event Published**: The `core` package publishes a high-level event like `updateMouseState` (via `@asra/reactive-events`) or directly calls a function in `interaction-core` with the processed input and context.

#### Step 2: Decision Making (Interaction Core)

The `interaction-core` receives the processed input and context, and makes a decision based on the current application state.

-   **Package**: `@asra/interaction-core`
-   **Action**: It receives the processed input event (e.g., a click with associated system context). It also knows the current application state (e.g., the user has the "Rectangle" tool selected).
-   **Decision**: "The user has clicked on the canvas with the Rectangle tool selected. I have all the necessary data (position, current tool, etc.) to decide that a new rectangle should be created."

#### Step 3: Announcing the Decision (Reactive Events)

The `interaction-core` doesn't create the rectangle itself. It announces its decision to the rest of the application using the event bus.

-   **Package**: `@asra/reactive-events`
-   **Action**: The `interaction-core` calls the `decideToCreateElement()` function from `@asra/reactive-events`.
-   **Event Published**: `{ type: 'decideToCreateElement', payload: { elementType: 'rectangle', position: { ... } } }`

#### Step 4: Element Creation and State Update (Scene Tree & Factory)

This is where the element's data is manufactured and added to the application's central state.

-   **Package**: `@asra/scene-tree`
-   **Action**: The `scene-tree` package is subscribed to the `decideToCreateElement` event (via `subscribeToDecideToCreateElement()`). It has all the necessary information from the event payload to proceed.
-   **Collaboration with Factory**: The `scene-tree` then interacts with the `@asra/factory` package to get the raw data for the new element. The `factory`'s role is purely to handle data transactions and provide structured data based on requests.
-   **Action**: The `scene-tree` calls a function in the `factory` (e.g., `factory.createRectangleData(...)`) to obtain the initial data for the new rectangle. The `factory` returns a well-structured, raw data object (including default dimensions, color, properties, etc.) and potentially a YJS resource for collaborative editing.
-   **State Update**: The `scene-tree` then adds this new rectangle data to its internal data structure. This action triggers an internal change within the `scene-tree`.
-   **Event Published**: The `scene-tree` publishes a `sceneTreeChanged` event (via `@asra/reactive-events`) to announce that the state of the world has changed.

#### Step 5: Visual Representation (Render)

The `render` package is responsible for visually representing the application's state.

-   **Package**: `@asra/render`
-   **Action**: The `render` package is subscribed to the `sceneTreeChanged` event. It also directly observes the YJS resource provided by the `scene-tree`.
-   **Response**: Upon receiving the `sceneTreeChanged` event or observing changes in the YJS resource, the `render` package checks the new scene tree data, identifies the new rectangle, and uses its rendering logic (e.g., Pixi.js, Three.js) to draw the new rectangle on the canvas.

#### Step 6: UI Synchronization (UI Context)

For UI-specific needs, the `ui-context` ensures the user interface reflects the latest application state.

-   **Package**: `@asra/ui-context`
-   **Action**: The `ui-context` package also observes the YJS resource (or listens to relevant `sceneTreeChanged` events). It aggregates information specifically needed for UI components (e.g., updating a layer panel, property inspector).
-   **Response**: Based on the changes, the `ui-context` calls appropriate APIs (e.g., `notifyUIComponentUpdate()`) to trigger re-renders or updates in the user interface, ensuring the UI is synchronized with the underlying data.

### Conclusion

The user's single click has successfully traveled through the entire application stack, with each package performing its specific, decoupled role. This demonstrates the power of a reactive, event-driven architecture, where data flows through a well-defined pipeline, and components react to changes in a coordinated manner.