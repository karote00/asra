# `@asyra/render-engine`

Engine-independent contract shared by Render, official engines, and custom
provider implementations.

## Owns

- engine/surface lifecycle and one-shot frame scheduling
- semantic commands, draw operations, queries, and normalized interactions
- opaque object/resource handles and runtime identity forwarding
- capability ids, unsupported-capability errors, and conformance utilities

## Does not own

Pixi or another SDK, canonical state subscriptions, render layers, Feature
policy, a default engine singleton, or unimplemented production modes.

## Compose when

Implement this contract whenever an app or package provides a rendering engine.
Render consumers depend on the abstraction, not a concrete SDK. Do not use it
for app-domain draw commands that bypass Render strategy/projection ownership.

## Public entrypoints and prerequisites

- `@asyra/render-engine` for `RenderEngine`, `RenderEngineProvider`, commands,
  queries, handles, events, capabilities, and errors
- `@asyra/render-engine/testing` for `runRenderEngineContract(...)` and
  `RecordingRenderEngine`

An engine implements required lifecycle/command/query methods and declares the
capabilities it actually supports.

## Lifecycle, inputs, outputs, and failure

`initialize(...)` may be asynchronous. `execute(...)`, `query(...)`, and
`destroy()` are synchronous. `requestFrame(...)` owns one pending one-shot slot;
only an explicit flush command draws. Missing required capabilities throw
`UnsupportedRenderEngineCapabilityError`. Invalid handles, commands, queries,
or cleanup must fail deterministically.

## Relationships

Render consumes the abstract contract. `@asyra/render-engine-pixi` implements
it. Preset selects a provider policy; Core stores and activates the chosen
provider. No dependency exists from the abstract contract back to Render or a
concrete engine.

## Maintained use path

Run `yarn examples:run custom-render-boundary`. The
[custom render guide](../../build/render-boundary.md) lists integration proof
beyond the shared conformance oracle.

## Replacement and disabled behavior

Any conforming provider can replace Pixi before startup. Concrete SDK objects
stay private behind opaque handles. A missing capability rejects the operation;
adapters must not inspect the engine and fall back to Pixi. Without a provider,
the abstract package creates no surface.

## Support, migration, and deprecation

Current formal capabilities are `objects`, `graphics`, `interaction`, and
`resources`. New capabilities require real implementations and contract tests.
Migration must preserve synchronous command/query/destroy semantics, one-shot
frames, handle isolation, and normalized interaction.

## Canonical sources and release inventory

- [Package contract](../../../ai/framework/packages/render-engine.md)
- [Package manifest](../../../../packages/render-engine/package.json)
- [Executable conformance source](../../../examples/custom-render-boundary.mjs)

Version plus `.` and `./testing` entrypoints are generated from the manifest and
verified against the release inventory.
