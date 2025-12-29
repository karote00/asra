# Golden Path: Modifying Properties (Two-Way Binding)

This document describes the flow when a user modifies a property via the UI (e.g., changing opacity or width) and how it updates the canvas.

**User Goal**: The user types "300" into the Width input field to resize the selected rectangle.

---

### The Journey

#### Step 1: User Input (UI App)

-   **Package**: `apps/ui`
-   **Component**: `PropertiesPanel/Input`.
-   **Action**: User types "300" and presses Enter (or blurs).
-   **Dispatch**: Comparison check passes (value changed). Component calls `core.changeComputedData('width', 300)`.

#### Step 2: Transaction & Data Update (Core & Scene Tree)

-   **Package**: `@asra/core`
-   **Action**:
    1.  `startTransaction()`
    2.  `sceneTree.updateComputedData('rect-1', 'width', 300)`
    3.  `endTransaction()`
-   **Package**: `@asra/scene-tree`
-   **Action**: Updates the `width` property of the element in the YJS Map.
-   **Audit**: Records a `PropsChange` event for Undo/Redo history.

#### Step 3: Visual Update (Render)

-   **Package**: `@asra/render`
-   **Action**: Observes the YJS Map change for 'rect-1'.
-   **Reaction**: PixiJS updates the width of the sprite immediately. The Canvas redraws.

#### Step 4: Selection Box Update (Render)

-   **Action**: Since the element grew, the `Render` package (Selection Layer) recalculates the bounding box and redraws the selection outline to match the new width.

#### Step 5: Loop Validation (UI Context)

-   **Package**: `@asra/ui-context`
-   **Action**: It also sees the YJS update. It emits `300` on the `width` subject.
-   **Result**: The Input field receives `300`. Since it matches what the user just typed, no visual change happens (prevents cursor jumping), but it confirms the cycle is complete.

### Conclusion

This path demonstrates the "Reactive Loop": UI Input -> Logic -> Data -> Render -> UI Update.
