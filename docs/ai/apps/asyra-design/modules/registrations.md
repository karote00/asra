# Module: Registrations

## Files

- `src/registrations/ui-properties.ts`
- `src/registrations/aggregate-properties.ts`
- `src/registrations/system-properties.ts`
- `src/registrations/index.ts`

## Responsibilities

1. Base UI properties

- selection sets
- flattened scene ids

2. Aggregate properties

- `x`, `y`, `width`, `height`, `rotation`
- trigger config for recompute on computed-data updates and selection changes

3. System properties mirrored to UI

- `zoom`, `primaryTool`
- path editing properties (`pathEditingVectorId`, `selectedVectorPoint`, etc.)

## Registration Order

`initPropertyRegistrations()` currently does:

1. base UI properties
2. aggregate properties
3. system properties

Keep this deterministic.

Preset structural customization, when a product needs it, occurs earlier in
`initApp()`:

```text
applyPreset(core)
-> optionally get/redefine one declarative property type
-> remove/define component or property relations
-> optionally unregister/define a complete capability
-> continue app registrations
-> core.start()
```

## Rules

- Register new UI-facing derived properties here (not ad-hoc in components).
- Register new system properties when they represent app interaction mode/state.
- Avoid duplicate key registration with conflicting defaults.
- Do not use a general replace API or preset target manifest. The bounded
  `redefinePropertyType()` facade changes one complete config-mode fixed-field
  definition only. Relation removal preserves registrations; unregister is
  reserved for a capability the app does not need.
- Custom fields used by UI belong in an explicit typed UI-property registration;
  the property schema never makes UI Context a model owner.
