# Compose a Preset Before App Startup

Use this path when an app needs deterministic framework defaults plus an
identified render-engine provider and optional package-owned capability
bundles. Preset composition ends before app customization and Core startup.

## 1. Keep the Default Compatibility Path

```ts
import core from '@asyra/core'
import { applyPreset } from '@asyra/preset'

const presetApplication = applyPreset(core)
```

Omitted composition selects `@asyra/render-engine-pixi`, installs every shared
default group, selects no optional bundles, and returns a completed
instance-local result. It does not construct the engine or start Core.

## 2. Select an Identified Custom Engine

```ts
import type { RenderEngineFactory } from '@asyra/render-engine'
import { ProductRenderEngine } from '@product/render-engine'

const factory: RenderEngineFactory = () => new ProductRenderEngine()

const presetApplication = applyPreset(core, {
  engine: {
    id: '@product/render-engine',
    factory
  }
})
```

The id is a stable diagnostic identity. Preset passes the validated factory to
the supplied `Render` instance and retains its reversible provider-cleanup
handle; it never owns the concrete engine runtime or resources.

The legacy `{ renderEngineFactory }` overload remains compatible and reports
`@asyra/preset/legacy-render-engine-factory`. Do not supply legacy and
identified engine inputs together.

## 3. Add Explicit Package-Owned Bundles

```ts
import type { PresetCapabilityBundle } from '@asyra/preset'

const selectionTools: PresetCapabilityBundle = {
  id: '@product/selection-tools',
  owner: {
    packageName: '@product/selection-tools',
    name: 'selection-tools'
  },
  requires: [],
  install({ core, dependencies, engineId }) {
    const dispose = installSelectionTools({ core, dependencies, engineId })
    return {
      outputs: ['selection-tools'],
      dispose
    }
  }
}

const presetApplication = applyPreset(core, {
  capabilityBundles: [selectionTools]
})
```

Bundle ids are unique. Every `requires` id must be selected earlier in the
array; preset preserves caller order and never infers or topologically reorders
bundles. Each bundle package owns its outputs and disposer. Empty/no-op bundles
are invalid.

## 4. Inspect Completion, Then Apply App Policy

```ts
if (presetApplication.result.state !== 'completed') {
  throw new Error('Preset composition did not complete')
}

core.removeComponentPropertyRelation('rect', 'fills')
core.unregisterRenderStrategy('rect')
core.registerRenderStrategy('rect', productRectangleStrategy)

registerAppMigration(core)
await core.start(container, renderOptions)
```

The stable order is:

```text
shared defaults
-> concrete-engine provider
-> selected bundles in caller order
-> completed composition result
-> app ordinary Core customization
-> app migration registration
-> core.start()
```

Preset never executes the app operations and never declares Core ready. The
first `core.start()` permanently closes registration composition and owns
runtime startup/readiness.

## 5. Handle Failure and Cleanup

Validation fails before mutation. Shared-default, provider, or bundle failure
throws `PresetCompositionError` and rolls back acquired owned resources.
`CLEANUP_FAILED` reports completed and pending cleanup keys; retry invokes only
pending handles. The next `applyPreset` on the same Core first retries any
pending apply rollback.

```ts
import { PresetCompositionError } from '@asyra/preset'

try {
  applyPreset(core, composition)
} catch (error) {
  if (error instanceof PresetCompositionError) {
    reportCompositionFailure(error.result)
  }
  throw error
}
```

Dispose a successful application only while registration composition remains
open:

```ts
presetApplication.dispose()
```

## Boundaries

- Import only public package facades; cross-package deep imports are forbidden.
- Do not infer `2d`, `3d`, `hybrid`, app mode, or bundle selection from engine
  capabilities.
- Do not add a preset app-customization callback, replace semantics, duplicate
  tolerance, fallback engine, or placeholder output.
- A custom Core/Render composition must supply matching explicit dependencies
  and bind `RenderAdapter` to that same `Render` instance.
