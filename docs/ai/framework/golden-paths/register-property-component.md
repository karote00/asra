# Golden Path: Register a Property Component

## Preconditions

- Property type is defined and used by at least one element component definition.
- Property schema validation is registered for the property type.

## Rules

1. Prefer `definePropertyComponent` config mode first.

- Use constructor/class mode only when config mode cannot express the behavior.

2. Keep property components data-only.

- Property components own: data shape, validation, load/save normalization, ID relation mapping.
- Do not include app/business behavior inside property components (auto-layout logic, unit conversion business rules, feature workflows).
- Handle business behavior in app-level APIs/features.

3. Persist IDs for references.

- When a property relates to other properties, persist only child property IDs.
- Do not persist expanded child payloads in parent property saved data.

4. Expand for read, not save.

- If caller needs expanded objects, compute those in `getValue` projection.
- Keep `save()` output canonical and ID-based.

## Steps

1. Register property component behavior.

- Use minimal config first: `definePropertyComponent({ type, defaults })`.
- Framework defaults:
  - `persistKeys` = keys from `defaults` (plus `children.key` when provided).
  - `unitKeys` = `persistKeys` ending with `Unit`.
  - `valueKeys` = `persistKeys - unitKeys`.
- For flexible key/value property types (for example `custom`), use `allowDynamicKeys: true`.
- Use explicit `persistKeys`/`valueKeys`/`unitKeys` only when override behavior is needed.

2. For parent-child property relation, use `children` config.

- `children.key` = parent field storing child IDs.
- `children.childType` = property type of the children.
- `children.mode = 'ids-or-objects'` when loading/setting legacy or expanded objects.
- `children.toChildData` to normalize object input to child property data.
- `children.toValue` to project child IDs to expanded read model.

3. Keep save payload ID-only.

- Parent property save data must store the child ID array.

4. Validate with schema and runtime behavior.

- Runtime invalid writes reject.
- Load invalid values fallback safely.

## Example

```ts
definePropertyComponent({
  type: 'fill',
  defaults: {
    color: '#000000',
    opacity: 1
  }
})

definePropertyComponent({
  type: 'fills',
  defaults: {
    fills: []
  },
  children: {
    key: 'fills',
    childType: 'fill',
    mode: 'ids-or-objects',
    toChildData: (item) => ({ ...item }),
    toValue: (child, id) => ({
      id,
      color: child.get('color'),
      opacity: child.get('opacity')
    })
  }
})
```

## Verification Checklist

- Parent property save payload contains child IDs only.
- Parent property can load from ID array and (if needed) legacy object array.
- Expanded values still available through `getValue`.
- Updating child property by ID updates parent-expanded read result.
