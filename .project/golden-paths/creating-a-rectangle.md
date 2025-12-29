# Golden Path: Creating a New Rectangle

This document describes the end-to-end, successful user journey of creating a new rectangle. It illustrates how multiple packages collaborate to achieve this single, critical feature, emphasizing the flow of data and decisions.

**User Goal**: The user wants to click on the canvas and see a new rectangle appear.

---

### The Journey

#### Architectural Note: Event Flow vs. Data Flow

It's crucial to understand the distinction between **Event Flow** and **Data Flow** in this architecture:

- **Event Flow (via `@asra/reactive-events`)**: This handles notifications, commands, and decisions. It describes _what happened_ or _what should happen_. Packages publish and subscribe to events to communicate actions and intentions. For certain events (e.g., `updateComputedData`), the event payload itself contains the data destined for the YJS document.
- **Data Flow (via YJS/CRDT)**: This handles the actual application state and collaborative document. It describes _what the current state is_. Packages directly observe the YJS document for granular data changes, leveraging its CRDT capabilities for real-time synchronization and automatic updates across clients.

These two flows work in tandem. Events often signal that data changes have occurred or are about to occur, while direct observation of the YJS document provides the granular data for updates.

---

#### Step 1: The User Clicks (Input System & Core Middleware)

The journey begins when the user clicks the mouse on the main canvas element.

- **Package**: `@asra/input-system` (or its adapter)
- **Action**: It captures the browser's raw **mouse events** (e.g., `mousedown`, `mouseup`).

- **Package**: `@asra/core` (acting as middleware)
- **Action**: The `core` package's specific input subscriber listens to these raw events. It enriches them with the current system context (tool, keys, etc.).
- **Event Published**: The `core` package publishes a generic **Input Action** event, such as `executeAction` (via `@asra/reactive-events`), carrying the context and details of the interaction.

#### Step 2: Decision Making (Interaction Core)

The `interaction-core` receives the generic input action and determines the specific user intent.

- **Package**: `@asra/interaction-core`
- **Action**: It subscribes to `executeAction`. It passes the event payload to its internal **Decider**.
- **Logic**: The Decider checks the current rules (e.g., "If Primary Tool is Rectangle AND Input is LeftClick...").
- **Decision**: The system concludes: "The user intends to create a rectangle."

#### Step 3: Announcing the Decision (Reactive Events)

The `interaction-core` announces this specific intent to the rest of the system.

- **Package**: `@asra/reactive-events`
-   **Action**: The `interaction-core` publishes the specific decision event: `decideToCreateElement`.
-   **Event Payload**: `{ elementType: 'rectangle', position: { x: ..., y: ... } }`.

#### Step 4: Core Orchestrates Action & Transaction (Core)

The `@asra/core` package acts as the central coordinator. It hears the decision and executes the necessary sequence of operations.

-   **Package**: `@asra/core`
-   **Action**: It is subscribed to `decideToCreateElement`. Upon receiving it, it executes a coordinated workflow (defined in `core/src/apis/scene-tree.ts`).
-   **Transaction Start**: `core` calls `startTransaction()` to begin recording the history.
-   **Request**: `core` calls the asynchronous `addRectangle()` API (wrapping a request event) to ask the Scene Tree to create the data.

#### Step 5: Element Creation and State Update (Scene Tree)

This is where the element's data is added to the application's central state, managed by YJS, and recorded for undo/redo.

-   **Package**: `@asra/scene-tree`
-   **Action**: The `scene-tree` package is subscribed to the `addRectangle` event (via `subscribeToAddElement()`). It receives **all necessary information** (element type, position, etc.) directly within the event payload. It does not need to request further data.
-   **State Update**: The `scene-tree` uses the new rectangle data (received from the event payload) to create a new `Rectangle` element instance (e.g., `new Rectangle(data)`). It then adds this new `Rectangle` instance to its internal data structure.
-   **Transaction Update**: As the change is applied to the `scene-tree`'s state, `scene-tree` calls `updateTransaction()` (via `@asra/reactive-events`) with the relevant payload describing the change. This records the specific modification for the undo stack.
-   **Event Published**: The `scene-tree` publishes a `sceneTreeChanged` event (via `@asra/reactive-events`) to announce that its state has been updated. This event serves as a high-level notification.

#### Step 6: Finalizing Action & Transaction (Core)

After the `addRectangle` event is published, `core` continues to orchestrate the completion of the user action, including selecting the new element and finalizing the transaction.

-   **Package**: `@asra/core`
-   **Action**: `core` proceeds with the next steps in the user action flow:
    -   It obtains the `elementId` of the newly added rectangle (likely returned from the `addRectangle` API call).
    -   It calls `selectElements()` (via `@asra/reactive-events`) to ensure the newly created element is selected.
    -   Finally, it calls `endTransaction()` (via `@asra/reactive-events`) to commit all recorded changes for this user action as a single undoable unit.

#### Step 7: Visual Representation (Render)

The `render` package is responsible for visually representing the application's state.

-   **Package**: `@asra/render`
-   **Action**: The `render` package *primarily* observes the YJS resource (which is the source of truth for the scene graph) *managed by the `@asra/factory`* for granular data changes. When the YJS object changes, `render` automatically updates its visual representation. It *also* observes a separate **YJS Selection Object** (also managed by `@asra/factory`) to determine which elements are currently selected. Based on this, it draws appropriate selection boxes around the selected elements. Furthermore, `render` listens to relevant events from `@asra/reactive-events` (such as `subscribeToPanTo`) for commands or signals that are not directly tied to YJS data changes, but trigger specific rendering actions.
-   **Response**: Upon observing changes in the YJS resources (scene graph or selection) or receiving relevant events, the `render` package identifies the new rectangle (or any other changes) and uses its rendering logic (e.g., Pixi.js, Three.js) to draw or update the elements on the canvas, ensuring the visual representation is always in sync with the YJS data.

#### Step 8: UI Synchronization (UI Context)

For UI-specific needs, the `ui-context` ensures the user interface reflects the latest application state.

-   **Package**: `@asra/ui-context`
-   **Action**: The `ui-context` package *primarily* observes the YJS resource *managed by the `@asra/factory`* for UI-relevant data. It *also* observes the separate **YJS Selection Object** to determine which elements are selected. Based on the selected elements, `ui-context` performs **property aggregation**: for each property (e.g., x, y, width, height), it checks if all selected elements have the same value. If so, that value is saved. If not, the value is set to `MIXED_STRING` (from `@asra/utils`). These aggregated properties are exposed as `rxjs BehaviorSubject`s. Furthermore, `ui-context` listens to relevant events from `@asra/reactive-events` for commands or signals that are not directly tied to YJS data changes, but trigger specific UI actions.
-   **Response**: When the YJS objects change, or relevant events are received, `ui-context` automatically processes these changes to update its internal UI state. UI components (in `apps/ui`) subscribe to the `BehaviorSubject`s exposed by `ui-context`, ensuring that only relevant input fields are updated when a property changes, and the UI is synchronized with the underlying data.

#### Step 9: User Interface Updates (apps/ui)

This is the final step where the user directly observes the changes in the application's graphical user interface.

-   **Package**: `apps/ui`
-   **Action**: The UI components within `apps/ui` subscribe to the `BehaviorSubject`s exposed by the `@asra/ui-context` package. These subscriptions allow the UI to react efficiently to granular changes in aggregated properties or other UI-specific state.
-   **Response**: When a `BehaviorSubject` emits a new value (e.g., the `x` property of the selected element changes), the corresponding UI input field or display element is automatically updated. This ensures that the user interface is always synchronized with the underlying application state, providing immediate visual feedback.

### Conclusion

The user's single click has successfully traveled through the entire application stack, with each package performing its specific, decoupled role. This demonstrates the power of a reactive, event-driven architecture, where **events signal actions and data changes, and the YJS document serves as the single source of truth for the application's state**, enabling robust collaboration and real-time updates.