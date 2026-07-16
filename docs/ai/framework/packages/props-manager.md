# Package: @asyra/props-manager

## Responsibility

Property component data model and validation runtime.

## Source Structure

```text
packages/props-manager/src/
  components/     # runtime primitives (base component + shared change plumbing)
  factories/      # component instance creation
  manager/        # runtime manager + subscribes + component accessor
  registries/     # property definition/schema/state registries
  index.ts        # public exports + bootstrap subscribe init
```

## Owns

- property component instances
- element property registry
- property schema registry
- load-time fallback and runtime reject logic

## Rules

- Runtime update: valid -> write; invalid -> reject
- Load value: valid -> write; invalid -> fallback
- No document-version migration logic inside package
- Property components are data-focused runtime units; app/business workflows (for example auto-layout policy or unit-conversion policy) must stay in app-level APIs/features.

## Runtime Contracts

1. Component creation

- all property components are created through `factories/create-property.ts`
- id creation/loading is centralized in the factory path
- id-first property manipulation is exposed by manager APIs (`getPropertyById`, `updatePropertyById`)

2. Validation

- base component applies schema validation for load/set/update behavior
- package owns fallback/reject behavior for property data
- manager-level `validateLoadData(...)` skips malformed entries before component creation

3. Change tracking

- manager records property changes for transaction integration
- add/remove/update paths stay consistent with manager change tracking
- pending change buffer is cleaned at transaction end to prevent cross-action leakage

4. Load state application

- `load(...)` is replace-style (clears previous runtime maps, then applies validated data)

5. Registration lifecycle

- `PropsManager.getPropertyIdsByType(type)` reports active and replay-retained
  deleted property ids for unregister/redefine safety.
- `unregisterPropertyRegistration(type, manager?, scope?)` checks usage before any
  mutation. Active or replay-retained instances throw
  `PropertyRegistrationError` with stable `PROPERTY_TYPE_IN_USE` code and
  detached property ids. `scope` defaults to `all`; target-owned cleanup may
  explicitly remove only `schema` or `runtime` while preserving the sibling
  registration.
- missing schema/constructor registration returns the structured
  `PROPERTY_REGISTRATION_NOT_FOUND` result without touching other types.
- safe `all` unregister removes the existing schema and runtime constructor
  together and reports exactly which registrations were removed; a custom
  definition can then be registered without duplicate tolerance.
- individual `unregisterPropertySchema(type)` and
  `unregisterPropertyComponent(type)` primitives return whether their registry
  entry was removed.

6. Property relation ownership

- config-mode `children.childType` is retained as a declarative definition so
  Core can remove/define that relation by rebuilding the constructor atomically
- child subscriptions are disposed when a property instance is removed,
  replay-retained state is reset, or the runtime is rebuilt
- constructor-mode child/dependency logic is opaque and must declare a local
  `registration.relations` entry; hard dependencies use `unregister-source`
- unknown property types are diagnosed and skipped during load; the factory no
  longer constructs `CUSTOM` as an implicit fallback
- `unregisterPropertyRegistration(type, scope)` owns low-level schema/runtime
  cleanup. Core's `unregisterPropertyType(type)` coordinates the complete graph
  capability and delegates final cleanup here.

## Current Extension Points

- element property registration
- property component registration
- property component change subscriptions (Setter.on)
- property schema registration
- state registry for UI/derived helpers

## Notes

- `manager/props-manager.ts` is the runtime center for add/remove/update/load/save.
- `registries/property-schema.ts` is the single schema entry point used by base component validation.
- `registries/property-component.ts` is the component-constructor registration entry point used by property factory creation.
- `factories/create-property.ts` is the only component creation path (id load/register included).
- this package does not own builtin schema definitions or builtin property component implementations; builtin registration is handled by `@asyra/preset`.

## Validation Checklist

- Property load/save round-trip is stable.
- Invalid runtime writes are rejected without corrupting stored values.
- Schema updates are reflected in component validation behavior.
- Registration removal is rejected while active or replay-retained instances
  use the type; `unregister -> define` leaves no stale schema, constructor, or
  child subscription.
