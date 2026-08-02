# Package: @asyra/render-engine

## Responsibility

Engine-independent contract shared by `@asyra/render`, concrete engines, and
custom engine implementations.

## Owns

- engine/surface lifecycle and one-shot frame-scheduling contracts;
- semantic create, update, hierarchy, draw, resource, viewport, resize, and
  flush commands;
- engine-neutral queries for bounds, coordinate conversion, and hit testing;
- opaque object/resource handles;
- an opaque runtime identity returned from initialization for compatibility
  facades; the contract does not define or inspect its concrete SDK type;
- normalized pointer interaction events;
- capability identifiers and deterministic unsupported-capability errors;
- engine-independent contract-test utilities.

## Must Not Own

- Pixi, DOM, or another concrete engine SDK;
- framework state subscriptions, render layers, or feature decisions;
- a default engine singleton;
- speculative production modes without an implemented engine and formal use
  case.

## Public Surface

- `RenderEngine`, `RenderEngineProvider`;
- `RenderEngineCommand`, `RenderEngineCommandResult`, and the named command
  variants composed by `RenderEngineCommand`;
- `RenderEngineDrawOperation` and its named operation variants;
- `RenderEngineQuery`, `RenderEngineQueryResult`, and their named query/result
  variants;
- `RenderEngineObjectHandle`, `RenderEngineResourceHandle`;
- `RenderEngineInitializeOptions`, `RenderEngineInitializeResult`,
  `RenderEngineDestroyResult`;
- `RenderEngineInteractionEvent`, `RenderEngineInteractionListener`;
- `RenderEngineCapabilities`, `assertRenderEngineCapabilities(...)`;
- `UnsupportedRenderEngineCapabilityError`.

`initialize(...)` may be asynchronous. `execute(...)`, `query(...)`, and
`destroy()` are synchronous so render orchestration observes deterministic
command results and cleanup. `RenderEngineInitializeResult.runtime` is
`unknown`: adapters may forward its identity through an existing compatibility
API, but may not branch on its concrete type.

`requestFrame(callback)` owns one pending one-shot scheduling slot. A concrete
engine consumes that callback before invoking it, so it cannot become a
permanent loop; `cancelFrame()` prevents the pending callback. Scheduling never
draws by itself. Concrete output occurs only when Render submits the explicit
`flush` command.

The engine-neutral Graphics operations include a `poly` path primitive with
ordered points and an explicit close flag. It represents one linear path inside
one Graphics object; it does not merge canonical elements or introduce a
multi-object Render command. Concrete engines may translate it to their native
single-path primitive while curved topology continues to use the ordered
move/line/Bézier operations.

## Capabilities

The current contract exposes only capabilities backed by current formal cases:

- `objects`;
- `graphics`;
- `interaction`;
- `resources`.

Call `assertRenderEngineCapabilities(...)` before initialization. Missing
requirements throw `UnsupportedRenderEngineCapabilityError`; no adapter may
inspect a concrete engine or fall back to Pixi.

## Contract Testing

Import `RecordingRenderEngine` and `runRenderEngineContract(...)` from
`@asyra/render-engine/testing`. The adapter verifies lifecycle, semantic
commands, opaque handles, normalized events, capability failure, cleanup, and
instance isolation without depending on a concrete SDK.

## Dependency Boundary

- `@asyra/render` -> `@asyra/render-engine`;
- concrete engine -> `@asyra/render-engine`;
- no dependency between `@asyra/render` and a concrete engine;
- non-render framework packages do not depend on this package unless they own
  composition types.
