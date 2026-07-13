# Plan: System-Context Builtin State Registration Migration

## Status

- Accepted on March 4, 2026.
- Completed on March 4, 2026.
- Delivered:
  - Legacy duplicated system-context state files/APIs removed.
  - Builtin system-context properties registered in preset through managed-property registration.
  - `getSystemContextSnapshot` now returns flattened managed properties via key collection.
  - App/preset consumers migrated from grouped snapshot fields to flattened keys.

## Goal

Use managed-property registration as the single source of truth for builtin system-context states, with default registrations owned by preset, and unify system-context access around managed APIs plus one aggregated snapshot API.

## Agreed Direction

1. Remove duplicated legacy state holders in `@asyra/system-context` (`mouse/key/target/system/primaryTool` state files).
2. Use managed-property APIs as the primary get/set/update path for system-context state.
3. Register builtin system-context keys in preset as defaults.
4. Keep one framework-level `getSystemContextSnapshot` API that aggregates registered managed properties.
5. Keep snapshot flattened by managed property key; nested/grouped projections belong to preset/app adapters.

## Scope

1. `packages/system-context` internal state ownership.
2. `packages/system-context` public API surface simplification (managed-first path).
3. `packages/preset` default builtin system property registration.
4. Snapshot aggregation contract.
5. Tests and import updates caused by deleted legacy state files.

## Implementation Steps

1. Refactor system-context APIs to read/write managed properties for builtin state keys.
2. Remove legacy system-context state files and related deps wiring.
3. Register builtin system-context keys in preset:
- `primaryTool`
- `systemMode`
- `systemFeatureFlags`
- `systemPermissions`
- `mouseDragStart`
- `mousePosition`
- `mouseDelta`
- `mouseButton`
- `mouseDown`
- `mouseDragging`
- `keyShift`
- `keyCtrl`
- `keyAlt`
- `keyMeta`
- `hoveredElementId`
4. Keep root snapshot as managed-property aggregation with no hardcoded grouped shape.
5. Ensure snapshot is aggregated from managed registrations and returned as readonly/plain flattened data.
6. Run package tests + app compile checks.

## Exit Criteria

1. `@asyra/system-context` has no legacy duplicated state files for builtin states.
2. Preset registers all builtin system-context keys by default.
3. Managed-property APIs are the only get/set path for builtin system-context state.
4. `getSystemContextSnapshot` aggregates managed properties in flattened shape.
5. Tests/compile checks pass.
