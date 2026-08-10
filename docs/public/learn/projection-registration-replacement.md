# Register projections; replace providers

Canonical information and visual output are separate owners. Render observes
canonical changes, projects them through registered strategies and layers, and
delegates engine work through the public render-engine contract. A concrete
engine never becomes the owner of document geometry or app behavior.

## Registration

Register component definitions, render strategies, render layers, interaction
targets, and UI properties while composition is open. Core exposes curated
public registration facades; the owning package retains the underlying
lifecycle and validation.

Registration should fail explicitly on duplicate or invalid ownership. Do not
silently replace a strategy because two extensions chose the same id. Use the
declared unregister/replacement path while composition permits it.

## Where this runs

Provider selection happens in the browser app's composition module before
Core startup. The concrete adapter belongs in an app-owned or provider package;
the rest of the app imports only `@asyra/render-engine` types and Render/Core
facades.

## Implementation

Expose the concrete adapter as a provider function and bind it exactly once:

```ts
import type { RenderEngineProvider } from '@asyra/render-engine'
import { applyPreset, PresetProfiles } from '@asyra/preset'
import { createCanvasRenderEngine } from './canvas-render-engine'

const canvasProvider: RenderEngineProvider = () => createCanvasRenderEngine()

applyPreset(core, { profile: PresetProfiles.CUSTOM, defaults: [] })
core.setRenderEngineProvider(canvasProvider)
await core.start(document.querySelector('#app')!, {
  width: window.innerWidth,
  height: window.innerHeight
})
```

`createCanvasRenderEngine()` is your adapter implementation. It keeps DOM nodes,
Canvas contexts, SDK objects, resource caches, and handles behind the public
engine-neutral methods.

## Flow

1. The app selects `CUSTOM` policy while composition is open.
2. Core accepts one engine provider without constructing it immediately.
3. Startup asks the provider for one engine and initializes it with the host.
4. Render issues semantic commands and queries through the adapter.
5. The adapter normalizes interactions back to engine-neutral events.
6. App disposal destroys provider-owned objects and resources.

## Expected result

Canonical information projects through the custom provider without concrete
SDK objects entering Core, Factory, Scene Tree, or app document state. Missing
capabilities, invalid engines, initialization failure, and cleanup failure stay
visible; none silently switches to Pixi.

## Provider replacement

`@asyra/render-engine` defines the engine-neutral provider contract. The
official `@asyra/render-engine-pixi` package is one optional implementation,
selected by the current Preset `2D` profile. A custom app can choose
`PresetProfiles.CUSTOM`, call `core.setRenderEngineProvider(...)` before
startup, and verify actual product behavior at the adapter boundary. Concrete
SDK objects, resources, and handles must not escape into Core or canonical
package state.

## Layer ownership

Render layers own presentation order and projection behavior. Interaction
bridges normalize engine events back to Framework targets. App Features decide
what an accepted interaction means. A layer may display selection or guides,
but it cannot make those visuals the only state oracle.

## Failure and absence

Direct `Render.init()` without a provider throws the declared missing-provider
error. Core's exact no-provider compatibility path is narrower and remains the
ordinary browser-shaped `core.start(...)`; it is not public Headless support.
Provider callback, capability, initialization, or cleanup failures remain real
errors and must not fall back to Pixi.

## Validate replacement

- provider selection occurs before startup and exactly once;
- engine capabilities and lifecycle pass the shared contract;
- canonical create/update/remove and replay project correctly;
- hit testing and interaction return normalized semantic results;
- engine resources are released; and
- no app or Framework package imports the concrete engine SDK outside its
  provider boundary.

## Canonical sources

- [Render contract](../../ai/framework/packages/render.md)
- [Render Engine contract](../../ai/framework/packages/render-engine.md)
- [Replace the default engine](../../ai/framework/golden-paths/replace-render-engine.md)
- [Custom render-boundary guide](../build/render-boundary.md)

## Next

- [Build a custom render boundary](../build/render-boundary.md)
- [Read the Render Engine guide](../reference/packages/render-engine.md)
