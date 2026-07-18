# Declarative Property Type Redefinition Plan

## Status

Accepted product and architecture plan. The APIs and runtime behavior described
here are not implemented yet.

## Product Contract

App developers may customize the fixed fields of an existing declarative
property type after optional preset installation and before the first
`core.start()`. The framework exposes one high-level mutation,
`redefinePropertyType()`, so an app does not manually coordinate a partially
updated property schema, runtime defaults, persistence keys, projected value
keys, or unit keys.

Property redefinition changes how one property type stores, validates, and
projects data. It does not infer that a removed field and an added field have
the same product meaning. Component relations, child projections, render
strategies, UI-context registrations, app commands, and document migration
remain explicit app composition or app code.

This is a bounded pre-start exception for complete declarative property-type
definitions. It is not a general registry replace operation and does not alter
the existing duplicate-registration contract.

## Supported And Unsupported Behavior

Supported:

- inspect a detached normalized definition for a registered config-mode
  property type;
- add, remove, or replace fixed top-level fields in one complete definition;
- atomically rebuild the corresponding schema and config-mode runtime while
  preserving the property identity and its declared relations;
- derive defaults, persistence, value projection, unit projection, and runtime
  validation from the complete next field definition;
- consume app-defined custom fields through typed Core update, render-strategy,
  and UI aggregation APIs;
- transfer the redefined property registration owner to the app while
  preserving existing incoming and outgoing relations.

Unsupported:

- redefinition after the first `core.start()` call;
- redefinition while active or replay-retained instances use the property type;
- redefinition of constructor-mode property components whose behavior is not a
  complete declarative config;
- nested path mutation such as `stroke.fill.color`; an app replaces the whole
  top-level `fill` field definition when that rare customization is required;
- implicit child-relation, component-relation, render, UI-context, feature,
  command, export, or migration changes;
- semantic mapping from a removed field to an added field;
- fallback product values that hide an unadapted consumer;
- any render-engine or concrete-engine change.

## Public API

The planned Core facade adds one read-only companion and one mutation:

```ts
interface PropertyTypeFieldDefinition<T = DataTypes> {
  readonly key: string
  readonly kind: PropertyValueKind
  readonly defaultValue: T
  readonly validate?: (value: unknown) => boolean
  readonly allowedUnits?: readonly PropertyUnitKind[]
  readonly persist: boolean
  readonly project: boolean
  readonly unit: boolean
}

interface PropertyTypeDefinition<
  TFields extends object = Record<string, DataTypes>
> {
  readonly type: string
  readonly fields: readonly PropertyTypeFieldDefinition<
    TFields[keyof TFields]
  >[]
  readonly allowDynamicKeys: boolean
  readonly dynamicReservedKeys: readonly string[]
}

core.getPropertyTypeDefinition<TFields>(
  type: string
): Readonly<PropertyTypeDefinition<TFields>> | undefined

core.redefinePropertyType<TFields>(
  type: string,
  update: (
    current: Readonly<PropertyTypeDefinition<TFields>>
  ) => PropertyTypeDefinition<TFields>
): Readonly<PropertyTypeDefinition<TFields>>
```

The exact generic representation may be simplified during implementation only
if these public guarantees remain true:

- the returned current and next definitions are deeply detached from registry
  state;
- every fixed field has one key, kind, default, validation contract, and
  explicit persist/project/unit policy;
- the updater is synchronous and receives the complete editable field
  definition;
- the type identity cannot change;
- the returned definition is the committed normalized result;
- property-child relations remain queryable and editable only through
  `get/define/removePropertyChildRelation` and are not embedded as a second
  mutation path in `redefinePropertyType()`.

`getPropertySchema()` remains a low-level schema query. The existing
`registerPropertySchema()` and `definePropertyComponent()` APIs remain the
ordinary low-level definition path for new or constructor-mode types.

## Definition Model

`@asyra/props-manager` projects a config-mode schema plus runtime config into
one normalized `PropertyTypeDefinition`. A fixed field is valid only when its
schema, default, persistence, projected value, and unit roles form one complete
definition. Duplicate keys, invalid defaults, contradictory projection flags,
reserved keys, or schema/runtime drift make the type ineligible for
redefinition until corrected through the ordinary owner APIs.

Removing a field removes it from the next schema, defaults, persistence,
`getValue()`, and unit output together. Adding a field creates all selected
roles together. The framework must never leave a field visible in only one of
those representations.

Dynamic keys remain controlled by `allowDynamicKeys` and
`dynamicReservedKeys`; fixed-field redefinition does not reinterpret arbitrary
dynamic data. Existing property-child configuration is preserved byte-for-byte
by the atomic rebuild. If the child `toValue()` projection enumerates child
fields, the app explicitly replaces that relation through the existing child
relation APIs.

## Composition And Atomicity

The Core facade owns composition coordination:

1. require open composition and a registered property identity;
2. reject pending cleanup, constructor mode, active instances, and
   replay-retained instances;
3. request a detached normalized current definition from Props Manager;
4. run the synchronous app updater against that detached value;
5. require the same property type and validate the complete next definition;
6. build the complete next schema and property constructor before registry
   mutation;
7. atomically swap schema and runtime, preserving child configuration and graph
   relations;
8. transfer registration owner metadata to the app through a narrow
   RegistrationGraph metadata-only operation that preserves node identity,
   relations, handlers, and resources, then return a detached committed
   definition.

If the updater throws, validation fails, staging fails, or commit cannot
complete, the previous schema, constructor, owner, and relations remain intact.
No observer, render, UI, migration, or product fallback runs to repair a failed
redefinition.

Definition and usage failures use a stable Props Manager error contract.
Composition-closed, pending-cleanup, and relation-validation failures retain
their existing Core registration error contracts. Final startup relation
validation additionally rejects fixed component aliases or property-child keys
that no longer resolve to the redefined projected fields. Dynamic property
types keep their explicit dynamic-key policy.

## App Consumer Flow

Preset uses the same Core facade subset available to apps. A normal app flow is:

```ts
applyPreset(core)

core.redefinePropertyType<AStyleV2>('a-style', (current) => ({
  ...current,
  fields: [
    ...current.fields.filter((field) => field.key !== 'b'),
    {
      key: 'c',
      kind: 'number',
      defaultValue: 10,
      validate: (value): value is number =>
        typeof value === 'number' && Number.isFinite(value),
      persist: true,
      project: true,
      unit: false
    }
  ]
}))

core.unregisterRenderStrategy('a-shape')
core.registerRenderStrategy('a-shape', renderAShapeWithC)

core.unregisterUIProperty('aStyle')
core.defineUIProperty('aStyle', createAStyleUIPropertyWithC())

core.registerLoadHook(migrateAStyleBToC)
await core.start(container, renderOptions)
```

The data path after composition remains canonical:

```text
Feature / app API
-> core.changeComputedData(...) or updatePropertyById(...)
-> Props Manager validation and property getValue()
-> Scene Tree computed data
-> registered render strategy and/or UI-context compute
```

App code can use a local custom-field interface in the normal typed APIs without
unsafe casts. The typed surface must cover:

- id-first `updatePropertyById()` calls for app-declared fields;
- `EngineNeutralRenderStrategy` input data;
- `PropertyComputeContext.elements` for app-defined UI aggregation.

Existing builtin call sites remain source-compatible. This type work changes no
runtime owner and adds no engine-specific data.

The existing `defineUIProperty()` name is already the primary UI declaration
API. Render replacement continues to use
`unregisterRenderStrategy() -> registerRenderStrategy()`. Naming aliases or
general `redefineRenderStrategy()` / `redefineUIProperty()` operations are out
of scope.

## Ownership And Boundaries

- `@asyra/props-manager` owns normalized definition projection, schema/runtime
  validation, usage guards, staging, atomic swap, rollback, and runtime/load
  validation semantics.
- The existing Core config-mode definition entry delegates constructor creation
  to the Props Manager builder; Core does not retain a second config runtime
  builder.
- `@asyra/core` owns the app-facing getter/redefinition facade, permanent
  composition lock, graph owner update, preserved relation coordination, and
  final structural relation validation.
- Core's `RegistrationGraph` dependency supplies only the metadata mutation
  primitive; it does not decide whether or when app ownership transfers.
- `@asyra/scene-tree` continues to project property `getValue()` into computed
  element data; it does not interpret custom field meaning.
- `@asyra/render` supplies typed engine-neutral render-strategy input and does
  not infer how a new field should draw.
- `@asyra/ui-context` supplies typed app aggregation input and remains optional,
  derived-only state.
- `@asyra/preset` continues to install official defaults through the public
  Core facade. It exposes no preset-specific redefinition object or private app
  path.
- App composition owns the updater, explicit relation/render/UI replacements,
  domain commands, and deterministic document migration.
- `@asyra/render-engine` and `@asyra/render-engine-pixi` are unchanged.

## Product Cases

1. Definition read: an app reads a deeply detached normalized Fill or Stroke
   definition; mutating the returned data cannot change registries.
2. Add field: adding C makes its validated default, save output, projected
   value, typed app update, render input, and optional UI aggregation available
   through the canonical flow.
3. Remove field: removing B removes it from validation/default/save/value/unit
   roles together; a later runtime write to B is rejected rather than mapped to
   C.
4. Replace field meaning: the app removes B, adds C, and explicitly replaces
   affected render/UI/domain consumers through ordinary APIs; the framework
   does not claim semantic equivalence.
5. Nested boundary: an app customizing `stroke.fill` replaces that complete
   top-level field definition or redefines an app-owned Fill type; no nested
   property-path API is introduced.
6. Relation preservation: redefinition preserves existing graph relations;
   stale fixed aliases or child keys block startup until the app uses the
   existing relation APIs.
7. Failure atomicity: missing, constructor-mode, in-use, replay-retained,
   pending-cleanup, invalid, updater-throw, and closed-composition cases leave
   the old definition and relations unchanged.
8. Load boundary: a missing or invalid C uses the normal load fallback, while a
   semantic B-to-C conversion occurs only in an app migration before package
   validation.
9. App/preset parity: an app performs the complete customization through Core
   public APIs without a preset deep import or Props Manager singleton access.
10. Typed consumers: app-declared custom fields compile in id-first updates,
    render strategies, and UI compute callbacks without unsafe casts.

## Definition Of Done

- The thin product contract and dedicated Inspector agree on every owner,
  route, bypass, forbidden contributor, product case, and failure owner.
- Props Manager formal tests prove detached reads, normalized definition
  parity, active/replay usage guards, atomic commit, rollback, and load/runtime
  validation.
- Core formal tests prove open-composition enforcement, app ownership transfer,
  relation preservation, final structural validation, and no partial graph or
  registry mutation.
- Scene Tree, Render, and UI-context tests prove canonical custom-field
  projection and typed app consumption without changing data authority.
- Preset integration tests prove that official config-mode types can be read and
  redefined through the same Core facade available to apps.
- Golden paths document add, remove, nested top-level replacement, explicit
  render/UI replacement, and app-owned migration.
- No general registry replace operation, nested path API, automatic consumer
  rewrite, render-engine change, fallback field mapping, or app deep import is
  introduced.
- Inspector contract tests, affected package tests/builds, root tests, lint,
  dependency-boundary gates, and focused diff review pass.

## Inspector Authority

- Inspector data:
  `docs/ai/framework/plans/property-type-redefinition-flow-inspector.data.cjs`
- Direct-open Inspector:
  `docs/ai/framework/plans/property-type-redefinition-flow-inspector.html`
- Contract gate:
  `docs/ai/framework/plans/property-type-redefinition-flow-inspector.contract.test.cjs`

The product contract owns public behavior. The Inspector owns package and data
flow boundaries. Formal tests own executable evidence.

## Implementation Segments

Each segment begins with a fresh Inspector Step Execution Card and advances one
owner step at a time:

1. Props Manager normalized definition projection and atomic declarative
   rebuild, test-first.
2. Core facade, composition/ownership coordination, and final structural
   relation validation, test-first.
3. Scene Tree canonical custom-field projection verification.
4. Render and UI-context typed app-consumer surfaces, one package owner at a
   time.
5. Preset/Core integration, golden paths, API/package docs, and full gates.
