# Package: @asyra/render-engine

## Responsibility

Engine-independent contract shared by `@asyra/render`, concrete engines, and
custom engine implementations.

## Owns

- engine/surface lifecycle and frame-loop contracts;
- semantic create, update, hierarchy, draw, resource, viewport, resize, and
  flush commands;
- engine-neutral queries for bounds, coordinate conversion, and hit testing;
- opaque object/resource handles;
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

- `RenderEngine`, `RenderEngineFactory`;
- `RenderEngineCommand`, `RenderEngineCommandResult`;
- `RenderEngineQuery`, `RenderEngineQueryResult`;
- `RenderEngineObjectHandle`, `RenderEngineResourceHandle`;
- `RenderEngineInitializeOptions`, `RenderEngineInitializeResult`,
  `RenderEngineDestroyResult`;
- `RenderEngineInteractionEvent`, `RenderEngineInteractionListener`;
- `RenderEngineCapabilities`, `assertRenderEngineCapabilities(...)`;
- `UnsupportedRenderEngineCapabilityError`.

`initialize(...)` may be asynchronous. `execute(...)`, `query(...)`, and
`destroy()` are synchronous so render orchestration observes deterministic
command results and cleanup.

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
