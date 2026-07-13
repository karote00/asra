# Cascade Unregister Plan (Framework)

## Status

Completed on February 28, 2026.

## Context

Current `unregister` flows mostly remove only direct registrations.
Example: component unregister removes component/property-definition/render strategy, but does not clean all related registrations (for example id/name counters, schema ownership, shared resources).

## Goal

Add a safe, deterministic **cascade unregister** mechanism so a top-level unregister can remove its owned sub-registrations.

## Requirements

1. Ownership-aware cleanup
- unregister should remove only resources owned by the target registration

2. Shared-resource safety
- if resource is shared (schema/property/etc.), remove it only when last owner is removed

3. Runtime safety
- prevent unregistering component types still used by existing scene instances (unless force option is used)

4. Observability
- return structured result with removed/skipped entries and reasons

## Non-Goals (Phase 1)

- no automatic migration/remap of existing scene instances
- no cross-package hidden side-effects without explicit ownership records
- no best-effort silent cleanup

## Proposed Model

### 1) Registration Ownership Graph

When `defineComponent(...)` registers items, also record ownership:

- component type -> componentRegistry entry
- component type -> property definitions
- component type -> render strategy registration
- component type -> idCounter type registration
- component type -> nameCounter type registration
- component type -> property schema registrations (if present)

### 2) Reference Counting

For shared resources (especially schemas/properties):

- increment refcount on register
- decrement refcount on unregister
- remove actual resource only when refcount reaches zero

### 3) Cascade API

Add/extend API like:

```ts
unregisterComponent(type: string, options?: { cascade?: boolean; force?: boolean })
```

Default behavior suggestion:
- `cascade: true`
- `force: false`

### 4) Runtime Guard

Before removing a component type:

- check scene-tree for instances of that type
- if instances exist and `force !== true`, skip and return reason

## Return Contract (Suggested)

```ts
type UnregisterResult = {
  ok: boolean
  removed: string[]
  skipped: Array<{ item: string; reason: string }>
}
```

## Implementation Phases

### Phase 1: Metadata + Counters
- add ownership record store
- add refcount store for shared registrations

### Phase 2: Core Cascade
- implement cascade unregister for `unregisterComponent`
- include counter/schema cleanup through ownership/refcount

### Phase 3: Safety + Reporting
- add scene-instance guard (`force` support)
- return structured unregister result

### Phase 4: Test Coverage
- unregister non-shared resource -> removed
- unregister shared resource with remaining owner -> skipped
- unregister with active scene instances and no `force` -> blocked
- unregister with `force` -> removed + explicit warning/result

## Risks

1. Over-deletion if ownership tracking is incomplete.
2. Leaked registrations if refcount does not decrement on all paths.
3. Runtime inconsistency if unregister allowed while active instances still exist.

## Success Criteria

- unregister is deterministic
- no orphan sub-registrations for removed components
- shared registrations stay valid until last owner is removed
- result output clearly explains what happened
