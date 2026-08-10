# Replace the Default Render Engine

Use this path when an app supplies a concrete engine other than the preset 2D
Pixi engine. Replacing the engine does not change Core, state-owner, Feature, or
render-layer packages.

## Implement and Test the Contract

Implement `RenderEngine` in the custom engine package. Keep SDK objects private
and expose only opaque handles, semantic command/query results, and normalized
interaction events.

Run `runRenderEngineContract(...)` from `@asyra/render-engine/testing` to verify
lifecycle, commands, handles, normalized events, capabilities, cleanup, and
instance isolation. Missing required capabilities must throw
`UnsupportedRenderEngineCapabilityError`; never fall back to Pixi.

## Select CUSTOM and Bind Through Core

```ts
import core from '@asyra/core'
import { applyPreset, PresetProfiles } from '@asyra/preset'
import type { RenderEngineProvider } from '@asyra/render-engine'
import { ProductRenderEngine } from '@product/render-engine'

applyPreset(core, {
  profile: PresetProfiles.CUSTOM
})

const provider: RenderEngineProvider = () => new ProductRenderEngine()
core.setRenderEngineProvider(provider)

await core.start(container, renderOptions)
```

`CUSTOM` asks preset not to bind an engine. Omitting `defaults` still installs
all official defaults. Set `defaults: []` if the app wants none.

Core accepts one provider while composition is open. The provider is stored,
not invoked, until `core.start()`. A duplicate provider or post-start change
fails before replacement.

The default Core-owned `RenderAdapter` uses the same Core-bound `Render`
instance automatically, so normal custom-engine apps do not call
`core.setRenderer(...)`. That API remains only for an advanced full renderer
replacement.

## Direct Render Composition

A lower-level consumer that intentionally skips Core and preset can configure a
provider on its own `Render` instance:

```ts
import { Render } from '@asyra/render'

const render = new Render({ engineProvider: provider })
```

Direct `Render.init()` without a provider throws
`MissingRenderEngineProviderError`. Only Core may normalize that exact absence
to its existing no-canvas compatibility path. That path still uses the ordinary
Core startup contract and is not a public Headless Core/Core Kernel. Provider
callback, engine validation, capability, and initialization failures always
remain real errors.

## Verify Integration

- run the shared engine contract adapter;
- run Render adapter and interaction tests with the custom engine;
- verify Core invokes the provider only during startup and only once;
- verify startup rejects provider/capability/initialization failure without
  publishing ready;
- verify create/update/remove, viewport, hit testing, interaction, resource
  release, load/replay, undo/redo, and instance isolation;
- verify the app imports no concrete engine SDK outside its provider package.
