# Build a custom component and schema

Define app-domain information through public registration APIs, then let
Framework owners enforce relation integrity and property validation. This guide
uses a review-state example, but the schema meaning belongs to your product.

## Prerequisites

- a current `@asyra/core` composition while registration is still open
- `@asyra/props-manager` for property definitions and values
- `@asyra/scene-tree` for component/property relations
- a product decision for property fields, defaults, and valid domain values

## Ownership

The app owns component names, property names, field meaning, domain constraints,
and migration policy. Props Manager owns property definition/value lifecycle and
schema validation. Scene Tree owns component relations. Core exposes the public
coordination facade. Preset is not required.

## Public APIs

The implementation uses these Core facade methods:

- `core.definePropertyComponent(...)`
- `core.registerPropertySchema(...)`
- `core.defineComponent(...)`
- `core.getComponentPropertyRelations(...)`
- `core.getPropertySchema(...)`
- `core.unregisterComponent(...)`
- `core.unregisterPropertyRegistration(...)`

Use the public `@asyra/core` entrypoint. Do not import registries or component
classes from package `src` paths.

## Where this runs

Register the schema from an app composition module before `core.start(...)`.
Product Features and common APIs may construct or update values after startup,
but the type and relation registration lifecycle remains owned by the
composition that created it.

## Implementation

```ts
const REVIEW = 'app:review-state'
const WORK_ITEM = 'app:work-item'

const ReviewState = core.definePropertyComponent({
  type: REVIEW,
  defaults: { score: 0, status: 'draft' }
})

core.registerPropertySchema({
  type: REVIEW,
  fields: [
    { key: 'status', kind: 'string', defaultValue: 'draft' },
    { key: 'score', kind: 'number', defaultValue: 0 }
  ]
})

core.defineComponent({
  type: WORK_ITEM,
  idPrefix: 'work-item',
  namePrefix: 'Work item',
  properties: [{ name: 'review', type: REVIEW }]
})

export const approvedReview = new ReviewState({
  id: 'review-1',
  type: REVIEW,
  score: 92,
  status: 'approved'
})
```

Use product-specific ids and add the exact field validation your domain needs.
The returned property component is the supported construction boundary; do not
write into a registry or internal value map.

## Flow

1. Choose stable app-owned component and property type ids.
2. Define the property component with complete defaults.
3. Register its field schema.
4. Define the component and its named property relation.
5. Construct values through the returned public property class.
6. Query the registered relation and schema as acceptance evidence.
7. Unregister test or temporary definitions while composition remains open.

## Expected result

The implementation resolves exactly one review relation and retains a valid
`score` of `92` and `status` of `approved`. Defaults remain part of the
definition; the app retains the meaning of those fields.

Invalid definitions, duplicate ownership, relations to unknown property types,
or invalid values must fail before a partial registration or write. Active
component instances may block relation mutation with the declared registration
in-use failure.

## Validate

Test one valid construction, one invalid explicit write, one invalid load,
duplicate registration, relation cleanup, and an in-use registration change.
Assert the canonical owner snapshot and relation graph, not only UI text.

## Forbidden shortcuts

- no duplicate canonical value in React or render state
- no direct registry or map mutation
- no package-private or relative cross-package import
- no schema inference from the current UI widget
- no accepting an invalid explicit value as if it were a missing default
- no app-domain review, BIM, simulation, or other rules inside Framework code

## Canonical sources

- [Core contract](../../ai/framework/packages/core.md)
- [Props Manager contract](../../ai/framework/packages/props-manager.md)
- [Scene Tree contract](../../ai/framework/packages/scene-tree.md)
- [Props Manager package guide](../reference/packages/props-manager.md)

## Next

- [Learn validation, load, and migration](../learn/validation-load-migration.md)
- [Read the Props Manager guide](../reference/packages/props-manager.md)
