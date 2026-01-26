# EPIC: Property & UI Management

## Goal
To provide a responsive and reactive user interface (panels, toolbars) that reflects the current state of the design and allows granular modification of properties.

## Core Functionalities (Scope)

This Epic encompasses:
1.  **Contextual Inputs**: Properties panel showing relevant inputs for selected items.
2.  **Reactive Updates**: UI updating immediately when canvas elements change (two-way binding).
3.  **Property Aggregation**: Handling multiple selections (e.g., showing "Mixed" values).
4.  **Toolbar**: Providing access to tools.

## Linked Documentation

### BDD Specifications (Features)
-   **[Properties](./../bdd-features/properties.feature)**: Input behavior and panels.

### Architecture & APIs
-   **[UI Context](./../architecture/frontend/ui-context.md)**: The View-Model layer (RxJS) bridging logic and UI.
-   **[UI App](./../architecture/frontend/ui-app.md)**: The React application structure.
-   **[Props Manager](./../architecture/frontend/props-manager.md)**: The backend data model for component properties.

## User Stories (High Level)

1.  **US-01**: As a user, I want to see the X, Y, Width, and Height of my selected element.
2.  **US-02**: As a user, I want to type a new value into an input to update the element on the canvas.
3.  **US-03**: As a user, I want the input to update automatically if I drag the element on the canvas.
4.  **US-04**: As a user, I want to see "Mixed" if I select two items with different colors.

## Technical Dependencies

-   **`@asyra/ui-context`**: Uses RxJS `BehaviorSubject`s to push high-frequency updates to React without re-rendering the whole tree.
-   **`apps/asyra-design`**: React component tree.
