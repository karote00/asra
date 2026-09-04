# `@asyra/render`

Engine-neutral projection, render layers, strategy registration, interaction
bridges, viewport orchestration, and demand-driven frames.

## Owns

- canonical-to-render projection and render strategy execution
- render layer registration, order, update, and cleanup
- engine-provider lifecycle through the Render Engine contract
- interaction target/handler registries and normalized bridges
- viewport, resource, frame-request, dirty, and explicit flush orchestration

## Does not own

Canonical document state, app Feature decisions, concrete SDK objects, Preset
provider selection, UI command policy, or hidden patch output for owner bugs.

## Compose when

Compose it when canonical information needs a visual projection or engine-backed
interaction. Core includes the current default adapter. A deliberately lower
level consumer may construct `Render` directly with a provider. Do not compose
it as a canonical geometry database.

## Public entrypoints and prerequisites

- `@asyra/render` for `Render`, renderer/projection contracts, layers,
  strategies, interactions, and errors
- `@asyra/render/canvas-pipeline-debugger` for opt-in pipeline diagnostics

A real visual initialization requires a `RenderEngineProvider`. Register
strategies/layers/targets before startup through Render or Core facades.

## Lifecycle, inputs, outputs, and failure

Initialization invokes and validates the provider, initializes the engine,
registers runtime surfaces, then projects canonical state on demanded frames.
Dirty work schedules one frame; explicit flush produces output. Missing provider
on direct `Render.init()` fails. Provider, capability, strategy, layer,
interaction, or cleanup failure remains explicit and cannot fall back to
another engine.

`Render.resetRuntime()` is the explicit instance-retirement boundary. It
requires idle initialization/frame work, invalidates old callbacks and attempts
all owned cleanup before reporting failures. Layers, viewport and provider
selection are retired; shared projection/interaction/strategy registries remain
separate owners. Core coordinates complete replacement and must remain closed
after cleanup failure. Ordinary `dispose()` keeps its existing retry behavior.

## Relationships

Scene Tree/Props own canonical and computed information. Selection supplies
selection state. Render Engine owns abstract commands and queries. Concrete
providers translate them. Preset registers official strategies/layers and the
2D provider. Features decide what normalized interaction means.

## Maintained use path

Follow [Build a custom render boundary](../../build/render-boundary.md). The
[information-model guide](../../learn/information-models.md) explains how
Render remains an optional projection of canonical information.

## Replacement and disabled behavior

Replace the engine provider through the public contract before startup; replace
strategies/layers only through registration lifecycle. With no visual provider,
do not claim direct Render success. Core's exact no-provider compatibility path
is not a general Render behavior or public Headless API.

## Support, migration, and deprecation

Current support covers the engine-neutral 2D contracts and current browser/Core
composition. Geometry and visual correctness must use canonical source-space
oracles before screenshot evidence. Migration must preserve layer z-order,
strategy registration, normalized events, and deterministic resource cleanup.

## Canonical sources and release inventory

- [Package contract](../../../ai/framework/packages/render.md)
- [Package manifest](../../../../packages/render/package.json)
- [Render boundary guide](../../build/render-boundary.md)

Version plus `.` and `./canvas-pipeline-debugger` exports are generated from the
manifest and checked by the documentation gate.
