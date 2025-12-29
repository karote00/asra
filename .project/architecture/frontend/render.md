# Render Architecture

## Overview
The `render` package handles the visual presentation of the document directly to the canvas (or standard DOM). It is the "View" component of the system.

## Core Responsibilities
1.  **Layer Management**: Separates rendering into distinct layers for efficiency:
    *   `render-layer`: The content itself (elements).
    *   `selection-layer`: Overlays like bounding boxes and selection handles.
    *   `viewport-layer`: Canvas background, grid, and possibly input overlays.
2.  **Rendering Loop**: Manages the requestAnimationFrame loop (if applicable) or reactive updates to redraw when `scene-tree` changes.
3.  **Viewport Transforms**: Handles zooming and panning (accumulating transform matrices).

## Key Components

### `Render` (`src/render.ts`)
The main coordinator that initializes and updates the layers.

### Layers
*   **`RenderLayer`**: Iterates through `SceneTree` elements and draws them.
*   **`SelectionLayer`**: Draws auxiliary UI on top of the content.

## Data Flow
The `render` package subscribes to changes in `scene-tree` and `selection`. When data changes, it triggers a redraw of the affected layers.
