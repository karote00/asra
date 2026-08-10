# Build a custom render boundary

Wrap a concrete rendering SDK behind `@asyra/render-engine` so canonical state,
Core, Render, and app Features remain engine-neutral.

## Prerequisites

- a concrete engine adapter owned by your app or provider package
- the public `@asyra/render-engine` contract
- the public `@asyra/render-engine/testing` conformance adapter
- `PresetProfiles.CUSTOM` when the app also uses `@asyra/preset`

## Ownership

Render Engine owns the semantic lifecycle, command, query, interaction, frame,
capability, and error contracts. Render owns projection and layer orchestration.
The app/provider owns the concrete SDK and adapter. Core stores one provider
before startup and does not inspect concrete engine resources.

## Public APIs

- `RenderEngine` and `RenderEngineProvider`
- `runRenderEngineContract(...)` from `@asyra/render-engine/testing`
- `core.setRenderEngineProvider(...)`
- `PresetProfiles.CUSTOM` with `applyPreset(...)` when Preset is composed
- `new Render({ engineProvider })` only for intentional lower-level composition

The conformance example also uses the public `RecordingRenderEngine` test
adapter to prove operation ordering.

## Flow

1. Implement `initialize`, `execute`, `query`, interaction subscription,
   request/cancel frame, and `destroy` behind one adapter.
2. Keep concrete SDK objects and resources private.
3. Run the shared engine contract against a fresh adapter instance.
4. For Core composition, bind the provider before `core.start(...)`.
5. Let startup invoke and validate the provider exactly once.
6. Treat missing capability, invalid engine, initialization, and cleanup errors
   as real failures.

Follow
[`custom-render-boundary`](../../examples/custom-render-boundary.mjs) and the
[replacement golden path](../../ai/framework/golden-paths/replace-render-engine.md).

## Expected result

The maintained conformance oracle completes initialization, object/resource
commands, draw, resize, interaction, frame, and destroy. The final recorded
operation is `destroy`, and the app-owned adapter remains the runtime boundary.

When no provider is selected, direct `Render.init()` fails. Core's narrow
default-renderer no-provider compatibility path must not be copied into a
custom adapter or described as a Headless runtime.

## Validate

```shell
yarn examples:run custom-render-boundary
yarn workspace @asyra/render-engine test:local
yarn workspace @asyra/render test:local
```

Add app integration proof for canonical create/update/remove, viewport, hit
testing, interaction, load/replay, undo/redo, resource release, and instance
isolation.

## Forbidden shortcuts

- no concrete SDK import outside the provider package
- no engine object stored as canonical product state
- no fallback to Pixi after provider or capability failure
- no binding or replacing the provider after startup
- no pixel-only oracle for canonical geometry or transaction correctness
- no renderer-specific branch in Core

## Canonical sources

- [Render contract](../../ai/framework/packages/render.md)
- [Render Engine contract](../../ai/framework/packages/render-engine.md)
- [Executable conformance example](../../examples/custom-render-boundary.mjs)

## Next

- [Learn registration and replacement](../learn/projection-registration-replacement.md)
- [Read the Render Engine guide](../reference/packages/render-engine.md)
