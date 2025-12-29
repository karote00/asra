# Golden Path: Selecting an Element

This document describes the flow of selecting an element on the canvas. It highlights how visual interaction translates into selection state that drives the UI.

**User Goal**: The user wants to click on an existing rectangle to select it.

---

### The Journey

#### Step 1: User Click (Input System)

-   **Package**: `@asra/input-system`
-   **Action**: Captures `mousedown` (and subsequent `mouseup` without drag) on the canvas.

#### Step 2: Hit Testing & Decision (Interaction Core)

-   **Package**: `@asra/interaction-core`
-   **Context**: It needs to know *what* was under the cursor. It queries `systemContext.getSystemContextSnapshot()`, which holds the `hoveredElementId` (updated previously by the Render engine).
-   **Logic**: "Tool is Select + Clicked on Element ID 'rect-1' -> Decides `INTERACTION_SELECT`".
-   **Event**: Publishes `decideToSelectElements` with payload `['rect-1']`.

#### Step 3: Updating Selection State (Core & Selection)

-   **Package**: `@asra/core`
-   **Action**: Calls `selectElements(['rect-1'])`.
-   **Delegation**: Calls `@asra/selection.register(...)` (Internal logic updates the Selection Manager).
-   **YJS Sync**: The selection manager updates the `elementSelectionMap` (YJS). This validates the selection across all clients.

#### Step 4: Visual Feedback (Render)

-   **Package**: `@asra/render`
-   **Action**: Observes `elementSelectionMap`.
-   **Reaction**: It sees 'rect-1' is now in the set. It draws a blue selection box (bounding box + handles) around that element's coordinates.

#### Step 5: UI Feedback (UI Context & App)

-   **Package**: `@asra/ui-context`
-   **Action**: Observes `elementSelectionMap`.
-   **Observation**: It fetches the properties of 'rect-1' (from the Scene Tree YJS map).
-   **Emission**: It emits new values for `x`, `y`, `width`, `height`.
-   **Package**: `apps/ui`
-   **Reaction**: The Property Panel inputs, which are subscribed to these streams, populate with the numbers (e.g., X: 100, Y: 100).

### Conclusion

Selection is a prime example of Data-Driven UI. The click didn't tell the UI "show these numbers." The click told the *data* "this is selected," and the UI reacted to the data change.
