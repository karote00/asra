# Package: @asyra/render-engine-pixi

## Responsibility

Default Pixi implementation of the `@asyra/render-engine` contract. This is the
only package that owns Pixi SDK imports and concrete Pixi runtime objects.

## Owns

- Pixi `Application`, surface, root container, graphics, mesh, ticker, and
  event lifecycle;
- abstract command/query translation behind opaque handles;
- graphics, mesh geometry, viewport, resize, hit-test, and flush execution;
- gradient, raster-pattern, texture, and other concrete resource translation;
- normalized pointer events returned through the abstract contract;
- cleanup after complete or partial initialization.

## Must Not Own

- imports from `@asyra/render`;
- framework state subscriptions, layer ordering, or render strategies;
- framework target-id mapping;
- product feature decisions or app-domain interaction policy;
- custom-engine introspection or fallback routing.

## Public Surface

- `PixiRenderEngine implements RenderEngine`;
- `createPixiRenderEngine(): RenderEngine`.

For profile `2D`, Preset passes `createPixiRenderEngine` through
`core.setRenderEngineProvider(...)`. The Core-owned Render invokes that
provider during `core.start(...)`, creates one fresh engine, and owns its
runtime cleanup. Profile `CUSTOM` receives no provider from Preset. The
catalog's `presetEngineId` is diagnostic metadata, not a dynamic-import or
package-resolution path.

## Execution Contract

1. `initialize(...)` creates the Pixi application, canvas/input target, and
   root object handle. The result forwards that owned `Application` only as the
   contract's `unknown` runtime identity for legacy renderer-instance access.
2. `execute(...)` translates engine-neutral object, hierarchy, draw, resource,
   viewport, resize, and flush commands.
3. `query(...)` resolves bounds, coordinate conversions, and hit testing
   without exposing Pixi objects.
4. Pixi pointer events are normalized to `RenderEngineInteractionEvent` and
   returned with an opaque target handle.
5. `destroy()` stops the frame loop, releases all owned objects/resources
   (including engine-created mesh geometry while preserving shared textures),
   destroys the application, and returns deterministic cleanup counts.

Unsupported capabilities and initialization failures do not emit fallback
surface output or a successful ready result.

## Dependency Boundary

- depends on `@asyra/render-engine` and `pixi.js`;
- does not depend on `@asyra/render` or another framework runtime package;
- non-render packages and apps do not import this package directly in the
  default composition path.

## Validation

- the shared `runRenderEngineContract(...)` adapter runs against
  `PixiRenderEngine`;
- package-boundary tests reject `@asyra/render` imports;
- Pixi-specific tests cover lifecycle, commands, interactions, mesh/property
  updates, resource translation, and deterministic cleanup.
