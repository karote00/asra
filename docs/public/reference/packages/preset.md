# `@asyra/preset`

Optional official design-tool baseline with selectable defaults and render
profile policy.

## Owns

- strict Preset profile/default resolution and catalog metadata
- official dependency expansion and deterministic install order
- official design-tool component, property, selection, Group, render, UI, and
  input defaults
- the current `2D` Pixi provider selection and rollback of partial install

## Does not own

Core lifecycle, app-domain behavior, UI command policy, custom engine
implementation, provider ids as dynamic imports, or speculative unavailable
profiles.

## Compose when

Compose it when an app wants some or all official design-tool defaults. Skip it
for a fully custom Framework product. Selecting one default installs its
declared dependency closure; an empty list installs none. Profile and defaults
are independent choices.

## Public entrypoints and prerequisites

Use `@asyra/preset` with a composition-open Core. Public surfaces include
`applyPreset(...)`, `PresetProfiles`, `PresetDefaults`, `PresetCatalog`,
`PresetApplyError`, and official adapters such as Group behavior. Apply exactly
once before `core.start(...)`.

## Lifecycle, inputs, outputs, and failure

Preset validates the complete selection, installs defaults in catalog order,
optionally binds the profile provider, and returns a frozen result. It does not
start Core or publish ready. Validation fails before mutation. Installer or
provider failure rolls back resources in reverse order; retryable cleanup
failure remains explicit.

With a lifecycle-aware Core, successful apply retains its resource cleanup
through `registerRuntimeCleanup`. Core awaits it during complete runtime reset;
Preset releases resources in reverse order and reports incomplete cleanup.
The result still exposes no disposer, and the old Core cannot apply again.
A fresh successor may install the same defaults. Legacy adapters lacking this
capability keep ordinary apply behavior, not complete replacement support.

## Relationships

Core exposes a strict Preset install surface. Preset `2D` binds
`@asyra/render-engine-pixi` through the engine contract. UI Context and Design
System remain distinct: Preset registers capabilities; the Design System is an
optional React presentation package.

## Maintained use path

Follow [Compose the official 2D baseline](../../start/preset-2d.md) for both the
complete Preset call and selective dependency expansion.

## Replacement and disabled behavior

Choose `PresetProfiles.CUSTOM` for an app-owned engine provider. Apps may
replace registered strategies/capabilities through declared Core lifecycle.
Without Preset, none of its defaults, selections, Group adapters, input maps,
or provider policy is installed.

## Support, migration, and deprecation

The current production profile is `2D`. `3D` and `HYBRID` are unavailable and
must not be inferred from ids. Migration from all-defaults to selective defaults
must name the desired catalog entries and respect dependency expansion.

## Canonical sources and release inventory

- [Package contract](../../../ai/framework/packages/preset.md)
- [Package manifest](../../../../packages/preset/package.json)
- [Preset composition guide](../../../ai/framework/golden-paths/preset-composition.md)

The root entrypoint, version, catalog dependencies, and package relationships
are release-checked; version metadata remains generated from the manifest.
