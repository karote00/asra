# Compose the official 2D baseline

`@asyra/preset` is Asyra's optional public baseline for design-tool products.
It is similar to a design system at the capability level: choose the official
parts you want, replace what your product owns, and build the rest yourself.

Preset is not Core and it is not app-domain knowledge. Applying it registers
an ordered set of official defaults and, for profile `2D`, the official Pixi
engine provider policy before Core starts.

## Prerequisites

- a current `@asyra/core` composition
- `@asyra/preset`
- a supported browser host for the current visual startup path

## Where this runs

Call Preset from your browser app's composition entry, after constructing Core
and before `core.start(...)`. In a generated Asyra Design app this boundary is
the maintained startup module; in a custom app it belongs to your own bootstrap.

## Implementation

Apply the complete official baseline when its defaults match the product:

```ts
import { applyPreset, PresetDefaults } from '@asyra/preset'

const complete = applyPreset(core)

const vectorEditingOnly = applyPreset(core, {
  defaults: [PresetDefaults.VECTOR_EDITING]
})
```

Choose one of these calls for a Core instance; do not apply both. The complete
result reports profile `2D`, the official Pixi provider id, and the full
default catalog. The selective call expands `VECTOR_EDITING` to its required
official dependencies in deterministic catalog order.

Use `PresetDefaults` when you want a selective official baseline. The
snippet requests `VECTOR_EDITING`; use an empty `defaults` list when you want
the profile policy but no official default modules.

## Flow

The supported order is:

1. resolve the strict Preset profile and selected defaults;
2. install official defaults in catalog order;
3. bind the optional Preset-owned profile provider;
4. receive the frozen apply result;
5. apply ordinary app-owned Core customization; and
6. call `core.start(...)`, which permanently closes composition.

Validation fails before mutation. Installation or provider failure rolls back
acquired resources in reverse order. Handle `PresetApplyError` as a real
composition failure; do not continue with a partial baseline.

## Expected result

The returned frozen record tells the app which profile, engine policy, selected
defaults, and dependency-expanded defaults were applied. Core remains
unstarted until the app explicitly starts it. Invalid selection, unavailable
profiles, installation failure, or provider binding failure leaves no partial
Preset composition.

## Ownership and order

Preset owns its catalog and dependency graph. Core owns composition closure and
startup. The app decides whether the complete or selective baseline belongs in
the product and owns every domain rule layered above it.

## Replace instead of patching

Choose `PresetProfiles.CUSTOM` when your app owns the render-engine provider.
Bind it through `core.setRenderEngineProvider(...)` before startup and verify
it against the public engine contract. Do not pass providers, engine ids,
installers, or cleanup callbacks through Preset.

Production `3D` and `HYBRID` profiles are unavailable in the current release.
Do not infer support from enum names or placeholder configuration.

## Canonical sources

- [Preset composition contract](../../ai/framework/golden-paths/preset-composition.md)
- [Preset package contract](../../ai/framework/packages/preset.md)
- [Preset package guide](../reference/packages/preset.md)

## Next

- [Compose only the infrastructure you need](custom-composition.md)
- [Learn registration and replacement](../learn/projection-registration-replacement.md)
