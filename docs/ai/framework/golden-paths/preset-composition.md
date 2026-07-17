# Compose a Preset Before App Startup

Use this path to select official defaults and a preset engine profile before
Core startup. Profile selection and defaults selection are independent.

## Default Composition

```ts
import core from '@asyra/core'
import { applyPreset } from '@asyra/preset'

const result = applyPreset(core)
```

This selects profile `2D`, registers the preset-owned Pixi provider, installs
all eight defaults, and returns a frozen result. It does not construct the
engine or start Core.

## Select Defaults Explicitly

```ts
import { applyPreset, PresetDefaults, PresetProfiles } from '@asyra/preset'

const result = applyPreset(core, {
  profile: PresetProfiles['2D'],
  defaults: [PresetDefaults.BASIC_SHAPES, PresetDefaults.VECTOR_EDITING]
})
```

Preset canonicalizes the selection, expands `VECTOR_EDITING` to include
`VECTOR` and `SELECTION`, and installs the dependency closure in catalog order.
Use `defaults: []` when no official module is wanted; the selected profile
engine policy still applies.

Inspect `PresetCatalog.profiles` and `PresetCatalog.defaults` during app
development to discover stable ids, availability, and public dependencies.
Catalog engine ids are diagnostics only.

## Use a Custom Engine

```ts
import type { RenderEngine, RenderEngineProvider } from '@asyra/render-engine'
import { applyPreset, PresetProfiles } from '@asyra/preset'
import { ProductRenderEngine } from '@product/render-engine'

applyPreset(core, { profile: PresetProfiles.CUSTOM })

const provider: RenderEngineProvider = (): RenderEngine =>
  new ProductRenderEngine()
core.setRenderEngineProvider(provider)

await core.start(container, renderOptions)
```

Preset installs all defaults because `defaults` is omitted, but `CUSTOM` binds
no engine provider. The app binds its provider through Core before startup.
The provider callback runs only when `core.start()` initializes Render.

## Apply App Policy, Then Start

```ts
const result = applyPreset(core, {
  defaults: [PresetDefaults.BASIC_SHAPES]
})

core.removeComponentPropertyRelation('rect', 'fills')
core.unregisterRenderStrategy('rect')
core.registerRenderStrategy('rect', productRectangleStrategy)

await core.start(container, renderOptions)
```

The stable order is:

```text
strict preset resolution
-> official defaults in catalog order
-> optional preset profile provider
-> frozen apply result
-> ordinary app Core customization
-> optional CUSTOM provider binding
-> core.start()
```

The first `core.start()` permanently closes composition and owns runtime
readiness. Preset never executes app callbacks or publishes ready.

## Handle Apply Failure

```ts
import { PresetApplyError } from '@asyra/preset'

try {
  applyPreset(core, options)
} catch (error) {
  if (error instanceof PresetApplyError) {
    reportPresetFailure({
      code: error.code,
      defaultId: error.defaultId,
      completedCleanup: error.completedCleanup,
      pendingCleanup: error.pendingCleanup
    })
  }
  throw error
}
```

Validation fails before mutation. Installation and provider failures roll back
acquired resources in reverse order. A cleanup failure remains internal and is
retried before the next apply; successful apply exposes no disposer.

## Boundaries

- Import public package facades only.
- Do not pass installers, dependency objects, engine ids, providers, or cleanup
  callbacks through preset.
- Do not infer defaults from profile or engine capabilities.
- `3D` and `HYBRID` are unavailable until a future plan marks them available;
  they import no placeholder runtime today.
