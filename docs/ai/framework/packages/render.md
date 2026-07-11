# Package: @asyra/render

## Responsibility

Rendering runtime and engine abstraction boundary.

## Rules

- Engine-specific imports (Pixi) must stay here.
- Other packages consume render abstractions only.
- Public exports from `@asyra/render` must not directly re-export concrete engine classes from `pixi.js`.
- When a render abstraction is intended for preset/app consumption, surface it through `@asyra/core` facade APIs instead of requiring direct `@asyra/render` imports in those packages.
- Render should react to state changes, not become source-of-truth.
- Render mutations should reflect state/system updates, not drive them.
- Default subscription wiring is not owned here; preset/core registration flow owns channel observer setup.

## Extension Points

- render strategy registry
- render layer registry
- interaction handler registry
- interaction target registry (overlay hit-test and pointer capture)
- custom renderer integration via core
- render-side update stores (`renderSceneTreeStore`, `renderSelectionStore`) for external registration wiring

## Runtime Contracts

1. State-driven rendering

- consume scene/system state
- update visual layers based on state deltas
- overlays that project authored element bounds during an active interaction must
  use the current precise transform chain; a cached transform from the previous
  render pass is not authoritative after frame-aligned scene updates

2. Interaction bridge

- pointer events from render are inputs, not authoritative selection/hit policy
- hit-test policies can be framework/app-defined when bounds-based behavior is needed
- overlay interaction targets publish `render.pointer.*` events with engine-agnostic payloads
- pointer capture can block underlying input-system drag when configured

3. Engine isolation

- adapter API exposes engine-agnostic methods to other packages/app layers
- only render package knows concrete engine primitives

## Glossary

- Interaction target: the hit-testable overlay descriptor (geometry + metadata) registered with the render interaction target registry.
- Interaction handler: the callback registration for a target id (or pattern) + event type that receives normalized `render.pointer.*` payloads.

## Example: Overlay Interaction Flow

```ts
import core, { createRenderInteractionPointTarget } from '@asyra/core'

const handleTarget = createRenderInteractionPointTarget({
  id: 'gradient-handle-1',
  type: 'gradient-handle',
  center: { x: 120, y: 80 },
  radius: 6,
  zIndex: 100,
  capture: 'pointer-block-input'
})

core.registerRenderInteractionTargets(handleTarget)

core.registerRenderInteractionHandler('gradient-handle-1', {
  eventType: 'pointerdown',
  handler: ({ payload }) => {
    // Begin overlay drag using payload.position + payload.modifiers
  }
})
```

## Validation Checklist

- Replacing render adapter does not require non-render package changes.
- Render output matches state after load, undo/redo, and tool interactions.
- No Pixi import appears outside `@asyra/render`.
