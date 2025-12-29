# Golden Path: Undoing a Creation Action

This document describes the end-to-end user journey of un-doing a previously performed action (creating a rectangle). It illustrates the "Time Travel" capabilities of the architecture where the `Factory` and `Core` collaborate to revert a transaction.

**User Goal**: The user mistakenly created a rectangle and wants to remove it by pressing Cmd+Z.

---

### The Journey

#### Step 1: User Input (Input System)

The user presses `Cmd+Z` (or `Ctrl+Z` on Windows).

-   **Package**: `@asra/input-system`
-   **Action**: Captures the `keydown` event. It matches the combination `Meta(Ctrl) + z` against its internal keymap.
-   **Event Published**: The input system acts as a raw trigger. The *interaction-core* decision rules will pick this up.

#### Step 2: Decision Making (Interaction Core)

-   **Package**: `@asra/interaction-core`
-   **Action**: The `decider/rules/undoredo-rules.ts` evaluates the input.
-   **Logic**: "Input is Undo Combo -> Decides `INTERACTION_UNDO`".
-   **Dispatch**: The handler for `INTERACTION_UNDO` publishes the high-level event `undo()` via `@asra/reactive-events`.

#### Step 3: Core Orchestration (Core)

-   **Package**: `@asra/core`
-   **Action**: The `core.undo()` API is triggered (via subscription).
-   **Delegation**: Core delegates this request directly to the Factory, as `factory` owns the history stack.
-   **Call**: `factory.undo()`.

#### Step 4: Transaction Reversion (Factory)

This is where the magic happens. The Factory manages the stack of transaction deltas.

-   **Package**: `@asra/factory`
-   **Action**:
    1.  `dataTransact.undo()` is called.
    2.  It pops the last transaction group from the `undoStack`.
    3.  This group contains the `addRectangle` event payload that we recorded earlier.
    4.  The factory looks at the `undoAction` defined in that payload (which is `REMOVE_ELEMENT`).
    5.  It **re-publishes** `REMOVE_ELEMENT` (with the element's ID) via `@asra/reactive-events`.

#### Step 5: State Update (Scene Tree)

The system now reacts exactly as if the user had manually deleted the element.

-   **Package**: `@asra/scene-tree`
-   **Action**: Listens to `REMOVE_ELEMENT`.
-   **Update**: Removes the element from its internal Map and the YJS Map.
-   **Result**: The element data is gone.

#### Step 6: Visual Update (Render & UI)

-   **Package**: `@asra/render` & `@asra/ui-context`
-   **Action**: Both observe the YJS Map.
-   **Reaction**:
    -   `render`: Sees the element is missing -> Removes the sprite from the canvas.
    -   `ui-context`: Sees the element is missing -> Clears the selection (if it was selected) -> UI Panels revert to "Empty" state.

### Conclusion

The Undo operation didn't touch the DOM or the Canvas directly. It simply "played a card" from the history deck (`REMOVE_ELEMENT`) into the event bus, and the reactive architecture handled the cleanup automatically.
