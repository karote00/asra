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

## Migration

Registration composition never migrates documents. For an app version change,
register a load hook that maps old data before package validation:

```text
old file -> app load migration -> package validation -> load
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
- startup ordering is deterministic
- render-engine capability never selects a product mode
