# Package: @asyra/render

## Responsibility

Framework render adapter and orchestration boundary. It synchronizes
authoritative state into engine-neutral operations and maps normalized engine
results/interactions back to framework-facing APIs.

## Rules

- Depend on `@asyra/render-engine`, never on Pixi or a concrete engine package.
- Do not expose concrete engine classes or resource types.
- Preset may configure the target `Render` instance through
  `setEngineFactory(...)`; direct class consumers may pass exactly one engine
  instance or factory to `new Render(...)`.
- `setEngine(...)` and `setEngineFactory(...)` return an instance-local
  pre-runtime cleanup handle. Cleanup restores the exact prior provider (or an
  empty provider state), stale handles cannot erase a later selection, and
  reverse-order cleanup unwinds nested selections deterministically without
  constructing or destroying an engine.
- A `RenderAdapter` may receive that exact `Render` instance in its constructor;
  the no-argument constructor remains the default-singleton compatibility path.
- A custom `Render` instance must fail when no provider is configured; it must
  not fall back to a module-level Pixi engine.
- Render extension APIs should be surfaced through `@asyra/core` when a Core
  facade exists. App bootstrap may import the public `RenderAdapter` directly
  to configure `core.setRenderer(...)`.
- Render should react to state changes, not become source-of-truth.
- Render mutations should reflect state/system updates, not drive them.
- Default subscription wiring is not owned here; preset/core registration flow owns channel observer setup.

## Extension Points

- render strategy registry
- render layer registry
- interaction handler registry
- interaction target registry (overlay hit-test and pointer capture)
- direct custom engine instance/factory injection
- Core-facing `RenderAdapter`
- render-side update stores (`renderSceneTreeStore`, `renderSelectionStore`) for external registration wiring

Render strategies registered through Core may include local
`RegistrationDefinitionMetadata`. Declared property dependencies are opaque;
the graph never inspects strategy code. `unregisterRenderStrategy(type)` removes
the named strategy and its graph relations without inferring a product mode.

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

- one selected engine instance belongs to one `Render` instance
- render maps framework target ids to opaque engine handles
- render owns abstract resource descriptors/ref-counting while the concrete
  engine owns concrete resource objects and cleanup
- required capabilities are checked through `@asyra/render-engine`; unsupported
  requirements fail without concrete-engine introspection or fallback
- adapter API exposes engine-agnostic methods to other packages/app layers

4. Engine interaction return

- concrete engine events are normalized by `@asyra/render-engine`
- render maps the opaque target handle to a framework interaction target
- the existing interaction bridge publishes framework events; render and the
  engine do not execute product features

## Renderer Facade Compatibility

- `RenderAdapter` is the recommended engine-neutral Core-facing renderer.
- `RenderResult.instance` and `RenderAdapter.getInstance()` forward the selected
  engine's opaque runtime identity. The Pixi compatibility path therefore keeps
  returning its owned Pixi `Application` without exposing that type in the
  abstract contract.
- `PixiJSRenderer` is a deprecated compatibility alias with the same lifecycle
  behavior and a warn-once message.
- Replacement: import `RenderAdapter` from `@asyra/render` and keep engine
  selection in preset or direct `Render` composition.
- The alias remains available through the next planned major-release migration
  window; it receives compatibility/security fixes only.
- `RenderStrategy` remains as a deprecated, Graphics-like callback signature so
  existing explicitly annotated strategies stay assignable. New code should use
  `EngineNeutralRenderStrategy`, whose first parameter is `RenderGraphics`.

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
- `@asyra/render` imports no Pixi SDK or concrete engine package.
- `@asyra/render` and `@asyra/render-engine-pixi` do not depend on one another.
- A custom engine passes the shared contract adapter without framework package
  changes.
