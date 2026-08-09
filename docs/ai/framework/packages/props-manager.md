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
- detached cloning of nested declarative property-definition values used by
  the package owner and Core facade
- detached cloning of property-component config registrations before Core
  stores or returns declarative definitions
- `PropertyRegistrationOptions`, the shared duplicate-registration option
  contract used by schema and property-component registries

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
- schema value kinds remain disjoint: `object` accepts `null` or a non-array
  object, while arrays require `array`
- manager-level `validateLoadData(...)` skips malformed entries before component creation
- `validateLoadData(...)` returns an owner-issued, instance-bound, one-shot
  artifact; `applyValidatedLoad(...)` accepts only that complete artifact and
  does not rerun validation

3. Change tracking

- manager records property changes for transaction integration
- add/remove/update paths stay consistent with manager change tracking
- Factory transaction and History options are passed through unchanged. Props
  Manager does not decide whether a requested History mode is supported.
- When a mutation materializes entirely as stable `UPDATE_PROPERTY` evidence,
  including fields of an existing record component, Props Manager may attach
  the complete before/after candidate and stable event keys derived from the
  owner event name, property id, and field key. Those keys let later sparse
  frames omit unchanged fields without changing History identity.
- Record lifecycle mutations still forward the requested History options, but
  do not fabricate a partial `replace-latest` candidate. Factory trusts the
  owner-issued candidate when present and otherwise retains ordinary
  append-only History.
- multiple compatible removals produced by one exact `REMOVE_PROPERTY`
  payload remain one ordered canonical removal event; Props Manager does not
  expand that owner batch into one Factory handoff per component
- pending change buffer is cleaned at transaction end to prevent cross-action leakage

4. Load state application

- `load(...)` remains the raw convenience facade and delegates to
  validate-then-artifact-apply; artifact apply is replace-style

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
- Props Manager owns one forward owner-to-children index and one reverse
  child-to-owners index. Relationship components do not allocate one
  subscription or closure per child edge.
- A child property emits only its own canonical `UPDATE_PROPERTY` evidence.
  `resolvePropertyAncestorIds(...)` returns the ordered affected ancestor
  closure so Scene can perform one local computed projection batch without
  synthesizing duplicate parent property writes.
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
- schema and property-component registration options
- property component change subscriptions (Setter.on)
- property schema registration
- state registry for UI/derived helpers

## Declarative Redefinition Owner

Props Manager owns the low-level definition handoff used by Core's bounded
pre-start property-type redefinition facade:

- `getDeclarativePropertyTypeDefinition(type)` projects a complete normalized
  config-mode definition and returns a deeply detached value;
- `commitDeclarativePropertyTypeDefinition(type, definition, manager?)`
  validates and stages the complete schema/config runtime before atomically
  committing both registries;
- active and replay-retained instances reuse the stable
  `PROPERTY_TYPE_IN_USE` registration failure;
- constructor mode, schema/runtime drift, invalid complete definitions, and
  commit failure use `PropertyTypeDefinitionError` with stable codes;
- failed commit restores the exact prior schema, constructor, config, and child
  configuration;
- the config runtime derives defaults, persistence, value projection, unit
  projection, runtime reject, and load fallback from the committed definition.

## Canonical Property Mutation Batch

- `preparePropertyMutationBatch(...)` validates the complete ordered
  schema/ID/relationship graph and produces one owner-issued, one-shot
  `PreparedPropertyMutationBatch`.
- `applyPreparedPropertyMutationBatch(...)` materializes the prepared
  child-first snapshots, registers all new instances through one
  `registerMany(...)` boundary, updates the relationship indexes, and hands one
  ordered evidence batch to the transaction owner.
- Add and remove replay are batch-symmetric at the transaction boundary:
  compatible component snapshots from one source payload are handed off once
  in source order, while a batch of one retains the same shape.
- Prepared creation snapshots are the canonical apply input. Apply does not
  serialize and deep-compare every newly created component again; custom
  constructors are responsible for obeying their registered schema and
  relationship contract.
- A later invalid operation rejects during complete preflight, before the first
  component, relationship index, evidence, or transaction write. A one-item
  request uses the same batch shape.

These exports are the package-owner handoff for Core coordination, not an app
composition bypass. Apps use the Core public facade. Constructor-mode behavior,
semantic field migration, relation changes, render, and UI remain outside this
owner; constructor-mode customization keeps the unregister-then-define flow.

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
- Declarative definition reads and committed results are deeply detached.
- Declarative schema/runtime commits are atomic and preserve child config.
- Registration removal is rejected while active or replay-retained instances
  use the type; `unregister -> define` leaves no stale schema, constructor, or
  relationship index entry.
