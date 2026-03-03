# Package: @asyra/render

## Responsibility

Rendering runtime and engine abstraction boundary.

## Rules

- Engine-specific imports (Pixi) must stay here.
- Other packages consume render abstractions only.
- Render should react to state changes, not become source-of-truth.
- Render mutations should reflect state/system updates, not drive them.
- Default subscription wiring is not owned here; preset/core registration flow owns channel observer setup.

## Extension Points

- render strategy registry
- render layer registry
- interaction handler registry
- custom renderer integration via core
- render-side update stores (`renderSceneTreeStore`, `renderSelectionStore`) for external registration wiring

## Runtime Contracts

1. State-driven rendering
- consume scene/system state
- update visual layers based on state deltas

2. Interaction bridge
- pointer events from render are inputs, not authoritative selection/hit policy
- hit-test policies can be framework/app-defined when bounds-based behavior is needed

3. Engine isolation
- adapter API exposes engine-agnostic methods to other packages/app layers
- only render package knows concrete engine primitives

## Validation Checklist

- Replacing render adapter does not require non-render package changes.
- Render output matches state after load, undo/redo, and tool interactions.
- No Pixi import appears outside `@asyra/render`.
