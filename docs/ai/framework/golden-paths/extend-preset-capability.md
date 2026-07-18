# Golden Path: Customize Preset Registrations

## Preconditions

- Customization is completed before the first `core.start()`.
- The app knows the public component type, property type, feature name, render
  strategy key, or UI-property key it wants to change.
- Persisted-data migration, when needed, remains app-owned and is registered
  before load.

## Startup Sequence

```text
applyPreset(core)
-> optionally read/redefine one declarative property type
-> remove old relation(s)
-> define new relation(s) or ordinary registrations
-> optionally unregister an entire capability
-> register load migration
-> core.start()
```

## Choose the Correct Operation

### Add a capability

Use the normal public API. No preset extension object is required.

```ts
applyPreset(core)

core.defineFeature('whiteboard-selection', undefined, {
  api: {
    /* app API */
  }
})
```

Ordinary app definitions may omit owner and relation metadata. Core assigns the
stable owner `{ packageName: 'app', name: registrationKey }`.

### Change one structural relation

Remove the old relation and define the new, non-equivalent relation explicitly.
Both property capabilities remain registered.

```ts
applyPreset(core)

core.removeComponentPropertyRelation('rect', 'fills')
core.removeComponentPropertyRelation('oval', 'fills')

core.defineComponentPropertyRelation('rect', {
  name: 'outline',
  type: PropertyTypes.STROKES
})
core.defineComponentPropertyRelation('oval', {
  name: 'outline',
  type: PropertyTypes.STROKES
})
```

The same rule applies to config-mode property children with
`removePropertyChildRelation` and `definePropertyChildRelation`.

### Change a complete implementation

Unregister the old registration, then define the app implementation through its
normal API. The API does not imply that the two implementations are equivalent.

```ts
applyPreset(core)

core.unregisterRenderStrategy('rect')
core.registerRenderStrategy('rect', whiteboardRectangleStrategy)
```

For a complete property capability:

```ts
core.unregisterPropertyType(PropertyTypes.FILLS)

core.registerPropertySchema(appFillsSchema)
core.definePropertyComponent(appFillsRuntime)
```

`unregisterPropertyRegistration(type, scope)` is the low-level schema/runtime
cleanup primitive. Use `unregisterPropertyType(type)` when removing the complete
capability and all declared relations/resources.

### Remove a capability entirely

```ts
applyPreset(core)
core.unregisterPropertyType(PropertyTypes.FILLS)
```

This detaches structural component/parent relations, recursively unregisters
only declared `unregister-source` dependents, and cleans Fills-owned resources.
It does not infer that the separate `FILL` child registration should also be
removed.

## Render and UI Are Explicit

Removing a component-property relation does not infer product rendering or UI.
If a Whiteboard changes Filled shapes into outline-only shapes, it explicitly
unregisters/registers its Rectangle/Oval render strategies and any app UI
registrations that differ from the preset.

## Redefine Declarative Fixed Fields

Use the public Core facade after preset composition and before the first
`core.start()`. The getter returns a deeply detached, normalized, complete
config-mode definition. The updater is synchronous and replaces the complete
top-level field list; adding C and removing B does not tell the framework that
their meanings are equivalent.

```ts
import core, { type EngineNeutralRenderStrategy } from '@asyra/core'
import { applyPreset } from '@asyra/preset'
import type { PropertyComputeContext } from '@asyra/ui-context'
import { PropertyTypes } from '@asyra/utils'

interface AppPositionFields {
  alignment: number
}

applyPreset(core)

const current = core.getPropertyTypeDefinition(PropertyTypes.POSITION)
if (!current) throw new Error('Preset POSITION definition is missing')

core.redefinePropertyType(PropertyTypes.POSITION, (definition) => ({
  ...definition,
  fields: [
    ...definition.fields.filter((field) => field.key !== 'legacyAlignment'),
    {
      key: 'alignment',
      kind: 'number',
      defaultValue: 0,
      persist: true,
      project: true,
      unit: false
    }
  ]
}))
```

Successful redefinition rebuilds schema, runtime/defaults, persistence keys,
value projection, and unit projection atomically, then transfers only that
property registration's owner metadata to the app. Existing incoming/outgoing
relations remain. If a removed projected field is still named by a fixed
component alias or property-child key, startup fails until the app explicitly
uses the existing relation APIs.

For nested data such as `stroke.fill`, replace the complete top-level `fill`
field definition. There is no nested property-path mutation API. Constructor-
mode types continue to use the complete unregister-then-define route above.

Render and UI semantics remain app-owned and explicit:

```ts
const strategy: EngineNeutralRenderStrategy<AppPositionFields> = (
  graphic,
  data
) => {
  // The app alone decides how data.alignment affects engine-neutral drawing.
}

core.unregisterRenderStrategy('rect')
core.registerRenderStrategy('rect', strategy)

core.unregisterUIProperty('alignment')
core.defineUIProperty('alignment', {
  defaultValue: 0,
  compute: (context: PropertyComputeContext<AppPositionFields>) =>
    context.elements[0]?.alignment ?? 0
})
```

## Migration

Registration composition never migrates documents. For an app version change,
register a load hook that maps old data before package validation:

```text
old file -> app load migration -> package validation -> load
```

Only the app may define a semantic B-to-C conversion. Register that deterministic
transform before startup; redefinition itself never rewrites stored documents.

```ts
core.registerLoadHook((data) => migrateLegacyAlignmentToAlignment(data))
```

Unknown property types after migration are diagnosed and skipped; they do not
fall back to `CUSTOM`.

## Failure Handling

- missing source/target/relation, duplicate relation, duplicate registration,
  active use, closed composition, dangling relation, and cleanup failure fail
  fast
- relation/capability failures use `RegistrationRelationError` with a stable
  `code` and structured `result`
- cleanup failure leaves pending retry state; do not define a conflicting
  registration until cleanup succeeds
- the first `core.start()` closes composition permanently, including when later
  renderer initialization fails

## Verification Checklist

- app imports only public package façades; no preset/framework deep imports
- relation removal preserves source and target nodes
- full unregister cleans observers, handlers, subscriptions, and owned registry
  entries without stale effects
- app-owned migration runs before validation
- declarative redefinition uses only `core.getPropertyTypeDefinition()` and
  `core.redefinePropertyType()`; no preset deep import or Props singleton
- startup ordering is deterministic
- render-engine capability never selects a product mode
