# EPIC: Canvas Interactions

## Goal
To provide a seamless, intuitive, and high-performance canvas environment where users can create, select, transform, and manipulate design elements. This is the core "drawing" experience of the application.

## Core Functionalities (Scope)

This Epic encompasses the following domains:
1.  **Element Creation**: creating basic shapes (Rectangles).
2.  **Selection**: Single select, click-to-deselect, (future: multi-select, drag-select).
3.  **Transformation**: Resizing and moving elements.
4.  **Navigation**: Panning and Zooming the viewport.
5.  **Tooling**: Switching between different tools (Select, Rectangle, Hand).

## Linked Documentation

### BDD Specifications (Features)
-   **[Creation](./../bdd-features/element-creation.feature)**: Define how elements are born.
-   **[Selection](./../bdd-features/selection.feature)**: Define how elements are chosen.
-   **[Tool Switching](./../bdd-features/tool-switching.feature)**: Define keyboard/UI mode switching.
-   **[Viewport](./../bdd-features/viewport-navigation.feature)**: Define zoom/pan behaviors.

### Golden Paths
-   **[Creating a Rectangle](./../golden-paths/creating-a-rectangle.md)**: The "Happy Path" for the most common action.

### Architecture & APIs
-   **[Interaction Core](./../architecture/frontend/interaction-core.md)**: The brain deciding what a click means.
-   **[Input System](./../architecture/frontend/input-system.md)**: The eyes and ears catching events.
-   **[Render](./../architecture/frontend/render.md)**: The visual output (PixiJS).

## User Stories (High Level)

1.  **US-01**: As a user, I want to click and drag to draw a rectangle so I can block out designs.
2.  **US-02**: As a user, I want to click an element to select it so I can modify it.
3.  **US-03**: As a user, I want to use shortcuts (V, R) to switch tools so I can work faster.
4.  **US-04**: As a user, I want to zoom in/out with the mouse wheel to see details.
5.  **US-05**: As a user, I want to drag an element to move it.

## Technical Dependencies

-   **`@asra/interaction-core`**: Must handle state machine logic for dragging vs. clicking.
-   **`@asra/render`**: Must support high-performance updates for 60fps dragging.
-   **`@asra/scene-tree`**: Must update the model transactionally.
