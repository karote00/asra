# Architecture: UI Application (apps/ui)

## Core Responsibility

The `apps/ui` package acts as the **Presentation Layer** or **View** of the application. It is a React application that:
1.  **Composes** the main layout (Toolbar, Panels, Canvas).
2.  **Mounts** the rendering engine (`RenderApp`).
3.  **Binds** to the `ui-context` to display reactive state (e.g., updating property inputs when selection changes).
4.  **Initializes** the application controller.

## Key Files & Architecture

-   **`App` (`app/index.tsx`)**: The root component. It defines the CSS Grid layout for the editor workspace.
-   **`RenderApp` (`render-app/index.tsx`)**: A wrapper component that initializes the `@asra/render` engine (PixiJS) and attaches it to a DOM element. It also connects the `@asra/input-system` to the canvas element.
-   **`controllers/`**: Contains logic for initializing the application lifecycle (`initRenderApp`, `setupInputSystem`).
-   **`components/`**: Standard React UI components (Inputs, Buttons, Panels).
-   **`contexts/`**: React Context providers (if used for theming or local UI state).

## Data Flow (View-Model Binding)

The UI layer follows a **Reactive View-Model** pattern:

1.  **State Consumption**: UI components subscribe to `BehaviorSubject`s exposed by `@asra/ui-context`.
    *   *Example*: The `PropertiesPanel` subscribes to `uiContext.width`. When it changes (because the user dragged a rectangle), the input updates automatically.
2.  **Action Dispatch**: UI components dispatch actions via `@asra/core` or `@asra/reactive-events`.
    *   *Example*: When the user types in the Width input, the component calls `core.changeComputedData('width', newValue)`.

## Layout Structure

The application uses a fixed-viewport layout:
-   **Canvas**: Central area, absolute positioned.
-   **Toolbar**: Floats above or sits in a grid area.
-   **Panels**: Left (Contents) and Right (Properties) sidebars.
