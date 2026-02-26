# Package: @asyra/props-manager

## Responsibility

Property component data model and validation runtime.

## Source Structure

```text
packages/props-manager/src/
  components/     # property component classes
  factories/      # component instance creation
  manager/        # runtime manager + subscribes + component accessor
  registries/     # property definition/schema/state registries
  schemas/        # builtin schema registration
  index.ts        # public exports + bootstrap subscribe init
```

## Owns

- property component instances
- property definition registry
- property schema registry
- load-time fallback and runtime reject logic

## Rules

- Runtime update: valid -> write; invalid -> reject
- Load value: valid -> write; invalid -> fallback
- No document-version migration logic inside package

## Runtime Contracts

1. Component creation
- all property components are created through `factories/create-property.ts`
- id creation/loading is centralized in the factory path

2. Validation
- base component applies schema validation for load/set/update behavior
- package owns fallback/reject behavior for property data
- manager-level `validateLoadData(...)` skips malformed entries before component creation

3. Change tracking
- manager records property changes for transaction integration
- add/remove/update paths stay consistent with manager change tracking
4. Load state application
- `load(...)` is replace-style (clears previous runtime maps, then applies validated data)

## Current Extension Points

- property definition registration
- property schema registration
- state registry for UI/derived helpers

## Notes

- `manager/props-manager.ts` is the runtime center for add/remove/update/load/save.
- `registries/property-schema.ts` is the single schema entry point used by base component validation.
- `factories/create-property.ts` is the only component creation path (id load/register included).

## Validation Checklist

- Property load/save round-trip is stable.
- Invalid runtime writes are rejected without corrupting stored values.
- Schema updates are reflected in component validation behavior.
