# `@asyra/render-engine-pixi`

Official optional Pixi implementation of the public Render Engine contract.

## Owns

- Pixi application, surface, root container, graphics, mesh, ticker, event, and
  resource lifecycle
- engine-neutral command/query translation behind opaque handles
- normalized pointer events and deterministic cleanup
- explicit flush rendering without Pixi auto-render bypass

## Does not own

Render subscriptions/layers/strategies, Framework target mapping, canonical
state, app Feature policy, custom-engine introspection, or fallback routing.

## Compose when

Use it for the official current Preset `2D` profile or explicitly select its
provider in a custom browser composition. Apps using another engine should not
import this package. Non-render packages never need it.

## Public entrypoints and prerequisites

Use `@asyra/render-engine-pixi`. It exports `PixiRenderEngine` and
`createPixiRenderEngine(): RenderEngine`. A browser-capable host and current
engine contract are required. Default consumers normally let Preset pass the
provider through Core.

## Lifecycle, inputs, outputs, and failure

Initialization creates one owned application, canvas/input target, root handle,
and standalone ticker. Commands/queries translate abstract operations. Frame
callbacks only schedule; explicit `flush` calls `Application.render()`.
`destroy()` releases ticker, objects, owned resources, and application with
deterministic counts. Partial initialization failure cleans acquired resources
and does not report ready.

## Relationships

Depends only on `@asyra/render-engine` within the Framework boundary plus Pixi.
Preset `2D` selects `createPixiRenderEngine`. Render consumes only the abstract
contract. Core owns provider activation and runtime cleanup.

## Maintained use path

Run `yarn examples:run preset-2d-minimal` and follow
[Compose the official 2D baseline](../../start/preset-2d.md). Custom engines use
the separate conformance example.

## Replacement and disabled behavior

Choose `PresetProfiles.CUSTOM` and bind a conforming app provider to replace
Pixi. When this package is absent, Preset `2D` cannot supply its official
provider; custom compositions remain free to use another engine. Failure never
falls through to hidden Pixi output.

## Support, migration, and deprecation

This is the current official 2D provider. It is not evidence of production 3D
or HYBRID support. Migration must keep Pixi imports isolated here, maintain
abstract capability conformance, and preserve explicit dirty/flush behavior.

## Canonical sources and release inventory

- [Package contract](../../../ai/framework/packages/render-engine-pixi.md)
- [Package manifest](../../../../packages/render-engine-pixi/package.json)
- [Preset 2D example](../../../examples/preset-2d-minimal.mjs)

The root entrypoint, version, and dependency on Render Engine are
manifest-generated and release-checked.
