# Property Schema Validation Plan

## Goal

Move numeric/type validation from UI handlers into system-level schema rules, so invalid input cannot corrupt data even if UI forgets to validate.
Also support unit-aware properties (`px`, `%`, future auto-layout units) and mixed-selection aggregation behavior in UI.

## Target Architecture

1. Component/property definitions declare schema metadata.
2. Props runtime enforces schema in one place.
3. Scene/computed updates use the same validation path (or shared validator registry).
4. UI parser/formatter is optional UX, not source of truth.
5. `ui-context` remains a framework convenience layer (default path), not a mandatory source of truth.
6. App-level can register custom aggregation logic for domain-specific UI behavior.

## Concrete Interface (Proposed)

```ts
type PropertyValueKind =
  | 'number'
  | 'string'
  | 'boolean'
  | 'object'
  | 'array'
  | 'custom'

type PropertyUnitKind = 'px' | 'pct' | 'auto' | 'custom'

interface PropertyFieldSchema<T = unknown> {
  key: string
  kind: PropertyValueKind
  unitKey?: string // e.g. x -> xUnit
  allowedUnits?: PropertyUnitKind[]
  required?: boolean
  defaultValue?: T
  parse?: (input: unknown) => T | null
  validate?: (value: T) => boolean
  normalize?: (value: T) => T
}

interface PropertySchema {
  type: string // property component type
  fields: PropertyFieldSchema[]
}
```

### Builtin schema examples

- `position`: `x`, `y` are finite numbers; units in allowed enum.
- `dimension`: `width`, `height` finite numbers; optional min clamp.
- `anchorPoint`: `x`, `y` finite numbers; `pointType` in allowed values.
- `anchorPoints`: array of point IDs (or legacy object array converted by parser).

### Unit-aware behavior (required for auto-layout)

- Unit conversion belongs to system APIs, not UI handlers.
- When changing unit (`px` -> `%`), convert value using parent/layout context.
- Render uses resolved/computed values; UI aggregates should read raw `{value, unit}` semantics.

## `ui-context` Aggregation Strategy

1. Keep aggregate registration at app-level (flexible by design).
2. Framework provides helpers for common aggregation:
- `MIX` handling
- unit-aware equality checks
- single/multi-selection reducers
3. If app needs a different behavior, it can bypass `ui-context` and aggregate from data subscriptions directly.

This preserves:
- fast default implementation path
- flexible escape hatch for advanced products

## Integration Points

## 1) `props-manager` base enforcement

Files:
- `packages/props-manager/src/components/base.ts`
- `packages/props-manager/src/utils.ts` (or new `schema-registry.ts`)

Plan:
1. Attach `schema` to each property component class (or pass it on construction).
2. In `BaseComponent`:
- `load(...)`: parse -> validate -> normalize -> assign default/fallback
- `set(...)` and `update(...)`: parse/validate/normalize before commit
3. Reject invalid writes silently or return explicit failure signal (recommended: return `false` from `set` path where possible).

## 2) Component registration path

Files:
- `packages/core/src/components/*.ts`
- future builtin register package

Plan:
1. Extend property registration definition to optionally carry schema.
2. At creation time, props-manager receives schema-aware components.
3. Keep backward compatibility: if no schema, fallback to current permissive behavior.
4. Add unit metadata for position/dimension fields at registration level.

## 3) Scene-tree computed update guard

File:
- `apps/asyra-design/src/controllers/scene-tree.ts` (temporary guard)
- future: core-level scene-tree API validation

Plan:
1. Move current app-level numeric guards to core/common API layer.
2. Reuse same schema validation utility so computed data uses consistent rules.
3. Keep UI code simple: send values; system decides accept/reject.
4. Add conversion hooks for unit changes that require parent/layout context.

## 4) UI layer contract (optional UX)

Files:
- `packages/design-system/src/components/Input/Input.tsx`
- app property panels

Plan:
1. Keep parser/formatter/validate in UI only for user experience.
2. Do not rely on UI for correctness.
3. On validation failure, UI reverts to latest committed value.

## 5) `ui-context` aggregate registration

Files:
- app-level registrations in `apps/*/src/registrations/*`
- optional framework helpers in `packages/core` or `packages/ui-context`

Plan:
1. Continue to register aggregate properties in app-level.
2. Introduce helper reducers for unit-aware mix logic.
3. Standardize output shape for value+unit display (e.g. `{ value, unit }` with `MIX` support).
4. Keep this optional; app can fully own aggregation if needed.

## Migration Plan

1. Introduce schema types + registry (no behavior change).
2. Migrate builtin property components (`position`, `dimension`, `anchorPoint`, `anchorPoints`) to schema-based validation.
3. Add unit-aware conversion entry points for position/dimension changes.
4. Move scene-tree numeric guards from app-level to core/common API.
5. Add `ui-context` aggregation helpers for mixed units and mixed values.
6. Keep app-level aggregate registration as extension point.
7. Remove duplicated ad-hoc validators in each component where schema now covers them.
8. Add tests:
- invalid loads fallback safely
- invalid runtime `set` ignored
- valid values still serialized/deserialized unchanged
- mixed unit/value aggregation yields `MIX` as expected

## Design Decisions

1. Validation authority is system-level, not UI-level.
2. Parser/validate/normalize chain should be deterministic and side-effect free.
3. Schema must support future registry-based builtin extraction.
4. Keep failure behavior consistent (`reject + keep previous value`).
5. Do not overfit edge cases into framework defaults; provide robust defaults + extension hooks.
