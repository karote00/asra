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

## Rules

- Register new UI-facing derived properties here (not ad-hoc in components).
- Register new system properties when they represent app interaction mode/state.
- Avoid duplicate key registration with conflicting defaults.
