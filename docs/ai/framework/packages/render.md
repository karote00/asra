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
- Render owns the engine-neutral `RenderLayerRegistration` shape. Core
  re-exports that type and owns only its facade registration options and
  callback surface.
- Render-owned semantic aliases for points, rectangles, bounds, transforms, and
  RGBA values reuse the canonical low-level contracts from `@asyra/utils`.
  Concrete engine adapters may retain boundary-local wire shapes when importing
  Utils would violate the engine package boundary.
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

`EngineNeutralRenderStrategy<TAppData>` intersects an app-declared computed-data
shape with the required `RenderElementData`, so a strategy can consume custom
property fields without an unsafe cast. This is type ergonomics only: render
remains downstream, engine-neutral, and unaware of property meaning. The
registered strategy alone decides whether and how a custom field affects
drawing; Render adds no inferred mapping or fallback geometry.

## Runtime Contracts

1. State-driven rendering

- consume scene/system state
- update visual layers based on state deltas
- `prepareEvenOddShape(...)` owns the engine-neutral line/cubic preparation and
  intersection semantics shared by even-odd rasterization and downstream
  strategy hit testing; consumers may cache the prepared shape but must not
  recreate the intersection algorithm
- `createEvenOddFillStyle(...)` and
  `isPointInsidePreparedEvenOddShape(...)` consume that same prepared geometry,
  keeping visible fill and hit-test parity under one Render-owned contract
- overlays that project authored element bounds during an active interaction must
  use the current precise transform chain; a cached transform from the previous
  render pass is not authoritative after frame-aligned scene updates

2. Scene Tree delta projection

- `renderSceneTreeStore` owns one derived complete snapshot per live
  non-workspace element, keyed only by `elementId`; Scene Tree remains the sole
  canonical state owner and the shared data channel owns no snapshot state
- add and load explicitly merge the element's complete saved and computed data
  into one snapshot; the requested id, non-empty type, and non-workspace checks
  must pass before install, and ordinary updates never seed a missing base
- load rebuilds parents before their children and siblings in canonical parent
  `children` order, independent of Scene Tree `Map` insertion order, and passes
  each exact sibling index to Render placement
- ADD/REMOVE envelopes retain canonical `parentId` and sibling `index`. An add
  places the child at that exact index, and add/remove atomically patch an
  existing non-workspace parent `children` mirror before queuing its complete
  snapshot; a parent membership precondition mismatch enters explicit resync.
  Workspace-root adds use the committed index directly because workspaces are not
  mirrored
- a missing canonical add target clears matching pending work and stale visual
  before returning `removed`; an invalid existing target clears stale output and
  returns `failed`. An unsuccessful visual add, including a caught strategy
  failure, is a rebuild failure for add, reload, and resync. Its synchronous
  result returns to the projection controller before that controller reports the
  final outcome
- scalar, ordered batch, and record patch updates validate every supplied
  `before` image and require every addressed top-level base to be an own property
  before atomically installing a new snapshot; record patches require an own
  existing record base and never substitute `{}`. Deep comparison is
  cycle-safe across records and arrays, compares every enumerable own string or
  symbol array property, and preserves sparse-array semantics; an array hole and
  an own `undefined` slot are not equivalent
- every scalar, batch, and patch candidate is merged with computed-over-raw
  precedence and must retain the requested id, a non-empty type, and a
  non-workspace type before install; an incomplete candidate enters the explicit
  resync route and fails closed if the authoritative snapshot remains incomplete
- scalar and batch entries carry canonical `raw` or `computed` owner provenance;
  Render validates and updates only that declared slice and never infers owner
  from key presence, a hard-coded property list, or element type
- the complete merged snapshot keeps computed precedence over same-name raw
  fields; a shadowed raw update changes the raw projection without sending its
  ineffective value through the direct visual route
- a missing base or failed precondition emits no partial strategy input and
  performs one explicit authoritative resync through the existing synchronous
  add-or-update route; the structured outcome is `applied`, `resynced`,
  `removed`, or `failed`. Resync returns success only after the complete strategy
  rebuild succeeds, and a composition or strategy failure removes stale visual
  output and returns `failed`
- direct `x`, `y`, `rotation`, and `visible` updates retain the direct property
  route after projection validation; mixed or computed updates coalesce per
  element and rerun the unchanged strategy signature once from the final complete
  snapshot. That complete snapshot also synchronizes generic `parentId` and
  `children` hierarchy without reordering unchanged siblings
- Render does not retain a strategy dependency graph or hard-code vector schema
  keys; profiling permits only the existing `elementId` snapshot dimension
- initial observer registration and every re-registration invoke the explicit
  full rebuild route after the observer is installed; Render never relies on a
  later delta to recover an observer gap. Any element rebuild failure clears the
  partial projection and throws to the lifecycle caller
- remove, reload, observer teardown, and Render teardown clear pending frame work
  idempotently; observer and Render teardown also release every Scene
  Tree-projected visual node and its abstract engine handle/resources before
  discarding the matching snapshot. Projection cleanup addresses only Scene
  Tree-projected ids retained by mirror or projected-visual ownership and does
  not clear unrelated scene or custom-layer nodes. Removing a projected parent
  detaches live canonical children before destroying only the parent; undo/redo
  re-adds it from a fresh complete snapshot and restores the exact sibling index
  while synchronizing the non-workspace parent mirror.
  Mirror ownership and projected-visual ownership are tracked separately.
  Projected ownership is discarded only after visual release succeeds, and any
  valid mirror present at that boundary is retained across release failure.
  The opaque handle-to-node lookup is retained until the engine destroy command
  succeeds, so a failed destroy preserves hit-query resolution and exact retry
  ownership for that projected node.
  Resync invalidates a mismatched mirror before its authoritative read; if that
  read or seed fails and visual release also fails, the invalidated resync mirror
  remains absent and only projected visual retry ownership remains. Cleanup still
  continues across other projected ids, and a successfully seeded authoritative
  resync mirror remains valid if its later visual cleanup fails. Retry ownership
  uses only the existing `elementId` cache dimension
- a reload with no current workspace clears retained workspace metadata and
  resets workspace identity/transform; stable snapshot and Scene Tree-projected
  Render-node counts never exceed live non-workspace elements. Custom and overlay
  layer nodes remain under their respective lifecycle owners and are not included
  in this projection bound
- hierarchy parent and sibling-order bookkeeping commits only after the matching
  engine append or set-child-index handoff succeeds; a failed handoff preserves
  the pre-command local hierarchy so the same complete snapshot can retry it

3. Interaction bridge

- pointer events from render are inputs, not authoritative selection/hit policy
- hit-test policies can be framework/app-defined when bounds-based behavior is needed
- overlay interaction targets publish `render.pointer.*` events with engine-agnostic payloads
- pointer capture can block underlying input-system drag when configured

4. Engine isolation

- one selected engine instance belongs to one `Render` instance
- a provider is invoked only during initialization; provider callback and
  invalid result errors remain distinct from provider absence
- render maps framework target ids to opaque engine handles
- render owns abstract resource descriptors/ref-counting while the concrete
  engine owns concrete resource objects and cleanup
- required capabilities are checked through `@asyra/render-engine`; unsupported
  requirements fail without concrete-engine introspection or fallback
- adapter API exposes engine-agnostic methods to other packages/app layers

5. Engine interaction return

- concrete engine events are normalized by `@asyra/render-engine`
- render maps the opaque target handle to a framework interaction target
- the existing interaction bridge publishes framework events; render and the
  engine do not execute product features

6. Optional pipeline diagnostics

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
