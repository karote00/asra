# Golden Path: Selecting an Element

This document describes the flow of selecting an element on the canvas. It highlights how visual interaction translates into selection state that drives the UI.

**User Goal**: The user wants to click on an existing rectangle to select it.

---

### The Journey

#### Step 1: User Click (Input System - Canvas)

*(Variant A: Canvas Selection)*

-   **Package**: `@asyra/input-system`
-   **Action**: Captures `mousedown` (and subsequent `mouseup` without drag) on the canvas.

#### Step 2: Hit Testing & Decision (Interaction Core - Canvas)

-   **Package**: `@asyra/interaction-core`
-   **Context**: It needs to know *what* was under the cursor. It queries `systemContext.getSystemContextSnapshot()`, which holds the `hoveredElementId` (updated previously by the Render engine).
-   **Logic**: "Tool is Select + Clicked on Element ID 'rect-1' -> Decides `INTERACTION_SELECT`".
-   **Event**: Publishes `decideToSelectElements` with payload `['rect-1']`.

#### Step 1 & 2 (Alternative): User Click (Contents Panel)

*(Variant B: UI Selection)*

-   **Package**: `apps/asyra-design`
-   **Component**: `ContentsPanel` acts as the trigger.
-   **Action**: The user clicks on the "Rectangle 1" item in the list.
-   **Dispatch**: Providing a direct bridge to the logic, the component calls `core.selectElements(['rect-1'])` directly. This bypasses `interaction-core` hit-testing because the UI already knows exactly which ID was clicked.

#### Step 3: Updating Selection State (Core & Selection)

-   **Package**: `@asyra/core`
-   **Action**: Calls `selectElements(['rect-1'])`.
-   **Delegation**: Calls `@asyra/selection.register(...)` (Internal logic updates the Selection Manager).
-   **YJS Sync**: The selection manager updates the `elementSelectionMap` (YJS). This validates the selection across all clients.

#### Step 4: Visual Feedback (Render)

-   **Package**: `@asyra/render`
-   **Action**: Observes `elementSelectionMap`.
-   **Reaction**: It sees 'rect-1' is now in the set. It draws a blue selection box (bounding box + handles) around that element's coordinates.

#### Step 5: UI Feedback (UI Context & App)

-   **Package**: `@asyra/ui-context`
-   **Action**: Observes `elementSelectionMap`.
-   **Observation**: It fetches the properties of 'rect-1' (from the Scene Tree YJS map).
-   **Emission**: It emits new values for `x`, `y`, `width`, `height`.
-   **Package**: `apps/asyra-design`
-   **Reaction**: The Property Panel inputs, which are subscribed to these streams, populate with the numbers (e.g., X: 100, Y: 100).

### Conclusion

Selection is a prime example of Data-Driven UI. The click didn't tell the UI "show these numbers." The click told the *data* "this is selected," and the UI reacted to the data change.
