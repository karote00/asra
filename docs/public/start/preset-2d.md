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

## Use the maintained path

Run the exact example:

```shell
yarn examples:run preset-2d-minimal
```

The verified source calls `applyPreset(core)` while composition is open. The
result reports profile `2D`, the official Pixi provider id, and the complete
default catalog. Preset does not construct the engine, start Core, execute app
callbacks, or publish runtime readiness.

Use `PresetDefaults` when you want a selective official baseline. The
[`preset-selective-defaults`](../../examples/preset-selective-defaults.mjs)
example requests `VECTOR_EDITING` and verifies the exact dependency closure.
Use an empty `defaults` list when you want the profile policy but no official
default modules.

## Ownership and order

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
- [Verified minimal 2D example](../../examples/preset-2d-minimal.mjs)

## Next

- [Compose only the infrastructure you need](custom-composition.md)
- [Learn registration and replacement](../learn/projection-registration-replacement.md)
