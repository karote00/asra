# Module: Registrations

## Ownership

Asyra Design installs the official registrations supplied by
`@asyra/preset`; it does not maintain a parallel app registration layer.

Primary files:

- `packages/preset/src/ui/register-properties.ts`
- `packages/preset/src/defaults/modules/input.ts`
- `packages/preset/src/defaults/modules/selection.ts`
- `packages/preset/src/defaults/modules/vector-editing.ts`
- `packages/preset/src/defaults/modules/viewport.ts`
- `packages/preset/src/defaults/modules/ui-context.ts`

The app consumes those registrations through:

- `apps/asyra-design/src/hooks/useProperty.ts`
- `apps/asyra-design/src/providers/*`
- `apps/asyra-design/src/properties/*`

## Responsibilities

1. UI projection properties

- selection sets
- flattened scene ids
- element panel data

2. Aggregate properties

- `x`, `y`, `width`, `height`, `rotation`
- trigger config for recompute on computed-data updates and selection changes

3. Preset-managed system properties and UI mirrors

- `zoom`, `primaryTool`
- path editing properties (`pathEditingVectorId`, `selectedVectorPoint`, etc.)

## Composition Order

`initApp()` applies the selected Preset defaults before app customization and
Core startup:

1. `applyPreset(core)` resolves the requested defaults and their dependencies
   in Preset catalog order.
2. Each selected default installs only its owned system/UI properties and
   subscriptions.
3. Optional app customization uses public Core APIs.
4. `core.start()` closes composition.

`PresetSystemPropertyKeys` is the public typed owner for property names managed
by the official defaults. App-only state remains app-owned.

## Rules

- Extend official reusable registrations at the responsible Preset default;
  do not recreate them in Asyra Design.
- Keep app-only state and UI projection at the app boundary when it is not an
  official reusable default.
- Components read registered values through providers/hooks and do not perform
  ad-hoc registration.
- Avoid duplicate key registration and conflicting defaults.
- Do not use a general replace API or preset target manifest. The bounded
  `redefinePropertyType()` facade changes one complete config-mode fixed-field
  definition only. Relation removal preserves registrations; unregister is
  reserved for a capability the app does not need.
- Custom fields used by UI belong in an explicit typed UI-property registration;
  the property schema never makes UI Context a model owner.
