# Design Principle: Update Strategies for Responsiveness

This document outlines the different strategies for reacting to application state changes, balancing immediate feedback with performance optimization. The choice of strategy depends on the component's role and its impact on user experience.

## Guiding Principle

**Components should adopt an update strategy that aligns with their functional requirements and optimizes overall application responsiveness.**

## 1. Immediate Update Strategy

-   **Purpose**: To provide real-time, granular feedback for critical visual elements or core application state that demands instant reflection of changes.
-   **Characteristics**: Components using this strategy react directly to the most granular source of truth for data changes.
-   **Example**: `@asra/render`
    -   **Action**: The `render` package directly observes the YJS resource (scene graph, selection) for granular data changes. When the YJS object changes, `render` automatically updates its visual representation immediately.
    -   **Reasoning**: Visual feedback on the canvas (e.g., moving an element, drawing a new shape) must be instantaneous to provide a smooth and responsive user experience. Delaying these updates would lead to a sluggish and disconnected feel.

## 2. Batched Update Strategy

-   **Purpose**: To optimize performance and prevent excessive re-renders or computations for components that do not require immediate, per-change updates. Changes are aggregated and processed at logical breakpoints.
-   **Characteristics**: Components using this strategy typically listen for higher-level signals that indicate a transaction or a group of changes has completed.
-   **Example**: `@asra/ui-context`
    -   **Action**: The `ui-context` package observes the YJS resource for UI-relevant data, but for certain updates (especially those that trigger complex UI re-renders or property aggregations), it listens to the `endTransaction` event from `@asra/reactive-events`.
    -   **Reasoning**: Continuously updating UI elements (like property panels) for every single granular change within a transaction (e.g., during a drag operation) would lead to excessive and unnecessary re-renders, potentially impacting performance. By listening to `endTransaction`, `ui-context` ensures that all related changes within a user action are processed and reflected in the UI at once, providing a stable and efficient update.

## Conclusion

Choosing the appropriate update strategy is vital for maintaining a performant and responsive application. Developers should consider the user experience impact and computational cost when deciding whether to react immediately to every change or to batch updates at logical transaction boundaries.
