# Replace the Default Render Engine

Use this path when an app needs a concrete render engine other than the default
Pixi implementation. The engine must implement the current
`@asyra/render-engine` contract; replacing it does not change Core, state-owner,
Feature, or render-layer packages.

## 1. Implement the Contract

Implement `RenderEngine` in the custom engine package. Keep SDK objects private
and expose only opaque handles, semantic command/query results, and normalized
interaction events.

The engine owns its SDK runtime, objects, resources, frame loop, event
normalization, and deterministic cleanup. It must not import
`@asyra/render` internals or execute product features.

## 2. Pass the Shared Contract Adapter

Use `runRenderEngineContract(...)` from `@asyra/render-engine/testing` to prove
lifecycle, commands, handles, normalized events, capability behavior, and
cleanup. Also test that separately created engine instances do not share owned
objects/resources.

Unsupported required capabilities must throw
`UnsupportedRenderEngineCapabilityError`; do not fall back to Pixi.

## 3. Inject a Factory Through Preset

```ts
import core from '@asyra/core'
import { applyPreset } from '@asyra/preset'
import type { RenderEngineFactory } from '@asyra/render-engine'
import { ProductRenderEngine } from '@product/render-engine'

const renderEngineFactory: RenderEngineFactory = () => new ProductRenderEngine()

applyPreset(core, { renderEngineFactory })
```

Call `applyPreset(...)` before `core.start(...)`. Preset forwards the factory to
the target framework `Render` instance; it does not create or own the engine.

If composition already supplies explicit preset dependencies:

```ts
const dependencies = core.getPresetDependencies()

applyPreset(core, {
  dependencies,
  renderEngineFactory
})
```

## 4. Direct Render Composition

A consumer that intentionally skips preset may inject exactly one instance or
factory directly:

```ts
import { Render } from '@asyra/render'

const render = new Render({ engineFactory: renderEngineFactory })
```

`new Render({ engine, engineFactory })` is invalid. A `Render` without a selected
provider fails initialization instead of using the default Pixi runtime.

## 5. Verify Integration

- run the custom engine's shared contract adapter;
- run `@asyra/render` adapter/interaction tests with the custom engine;
- verify Core startup rejects initialization failure without publishing ready;
- verify create/update/remove, viewport, hit testing, interaction, resource
  release, load/replay, undo/redo, and instance isolation;
- verify the app imports `RenderAdapter`, not a concrete engine, for its
  Core-facing renderer.
