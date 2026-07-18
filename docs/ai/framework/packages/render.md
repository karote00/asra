# Package: @asyra/render

## Responsibility

Framework render adapter and orchestration boundary. It synchronizes
authoritative state into engine-neutral operations and maps normalized engine
results/interactions back to framework-facing APIs.

## Rules

- Depend on `@asyra/render-engine`, never on Pixi or a concrete engine package.
- Do not expose concrete engine classes or resource types.
- Core or a direct consumer may configure the target `Render` instance through
  `setEngineProvider(...)`; direct class consumers may pass exactly one engine
  instance or provider to `new Render(...)`.
- `setEngine(...)` and `setEngineProvider(...)` return an instance-local
  pre-runtime cleanup handle. Cleanup restores the exact prior provider (or an
  empty provider state), stale handles cannot erase a later selection, and
  reverse-order cleanup unwinds nested selections deterministically without
  constructing or destroying an engine.
- A `RenderAdapter` may receive that exact `Render` instance in its constructor;
  Core constructs its default adapter with the injected Core-bound instance.
- Every direct `Render`/`RenderAdapter` initialization fails with
  `MissingRenderEngineProviderError` when no provider is configured; Render
  never chooses headless or falls back to Pixi.
- Render extension APIs should be surfaced through `@asyra/core` when a Core
  facade exists. Normal app bootstrap relies on the Core-owned adapter.
- Render should react to state changes, not become source-of-truth.
- Render mutations should reflect state/system updates, not drive them.
- Default subscription wiring is not owned here; preset/core registration flow owns channel observer setup.

## Extension Points

- render strategy registry
- render layer registry
- interaction handler registry
- interaction target registry (overlay hit-test and pointer capture)
- direct custom engine instance/provider injection
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
- a provider is invoked only during initialization; provider callback and
  invalid result errors remain distinct from provider absence
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

5. Optional pipeline diagnostics

- render-layer registration and pipeline observers belong to one `Render`
  instance; registrations and evidence never cross instance boundaries
- the canonical adapter may emit detached element, viewport, layer, frame, and
  pre-engine handoff evidence only while an observer is enabled
- command evidence is normalized before `engine.execute(...)` and contains no
  opaque handle, engine result, query, hit-test, pixel, or concrete-engine data
- debugger-owned overlay commands are excluded from product pipeline evidence
- observer failure is isolated from canonical rendering; diagnostics never
  provide fallback geometry or become render-state authority
- the snapshot fault field retains the latest observation or Core-routed overlay
  projection failure message and clears when observation is re-enabled; concrete
  engine failures remain outside this debugger field
- the optional `@asyra/render/canvas-pipeline-debugger` subpath owns bounded
  trace/snapshot projection and a graphics-only expected-geometry layer; it does
  not add engine text, DOM UI, or a concrete-engine dependency

## Renderer Facade Compatibility

- `RenderAdapter` is the engine-neutral Core-facing renderer and is owned by
  Core on the default path.
- `RenderResult.instance` and `RenderAdapter.getInstance()` forward the selected
  engine's opaque runtime identity. The Pixi compatibility path therefore keeps
  returning its owned Pixi `Application` without exposing that type in the
  abstract contract.
- `PixiJSRenderer` is a deprecated compatibility alias with the same lifecycle
  behavior and a warn-once message.
- Replacement: import `RenderAdapter` from `@asyra/render` only when replacing
  Core's complete renderer facade; keep engine selection in preset/Core provider
  composition or direct `Render` composition.
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
