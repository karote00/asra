# Undoable Option Support Plan (Framework)

## Status

Completed on February 25, 2026.

## Context

In v0.2.5 event flow, mutation events can carry:

```ts
options = { undoable: boolean }
```

Default is `true`.
When `undoable` is `false`, event changes are applied but not pushed into undo history.

Current implementation evidence:
- `packages/factory/src/data-transact.ts`
  - `update(...)` skips `this.changes.push(...)` when `options.undoable === false`
- `packages/reactive-events/src/scene-tree/publish.ts`
  - `changeComputedData(...)` already has `options = { undoable: true }`

## Current Gap

Framework-level APIs do not consistently expose `undoable` control.

Example:
- `packages/core/src/apis/scene-tree.ts`
  - `changeComputedData(elementIds, data)` calls event publish without passing options

Result:
- app/framework callers cannot intentionally mark specific mutations as non-undoable through core API
- behavior is inconsistent between raw event-level capability and high-level API surfaces

## Goal

Support `undoable` control as a first-class mutation option in Asyra framework API paths, while preserving default behavior (`undoable: true`).

## Design Principles

1. Backward compatible defaults
- existing calls remain undoable unless explicitly overridden

2. Explicit at API boundary
- options are passed intentionally through core/common API signatures

3. Consistent propagation
- options should flow from app call -> core API -> reactive event -> factory transaction

4. No hidden behavior switches
- avoid global mutable flags; keep per-call options explicit

## Proposed API Shape

Introduce a shared mutation options type (example):

```ts
type MutationOptions = {
  undoable?: boolean
}
```

Then extend write APIs, for example:

```ts
changeComputedData(
  elementIds: string[],
  data: Record<string, DataTypes>,
  options?: MutationOptions
)
```

Default handling:
- if `options` absent -> treat as `{ undoable: true }`

## Scope

In scope:
- core write APIs that should support non-undoable updates
- related reactive-events publish functions where options already exist or should be added
- app/common API call sites for selective adoption

Out of scope (phase 1):
- rewriting all feature flows to use `undoable: false`
- changing undo stack internals beyond option propagation

## Implementation Phases

### Phase 1: Inventory
- list mutation APIs and events that should accept `MutationOptions`
- identify existing options-capable publish functions

### Phase 2: Type + API Extension
- add shared `MutationOptions` type (likely in `@asyra/utils`)
- extend core mutation API signatures with optional options
- keep current behavior when options omitted

### Phase 3: Event Propagation
- pass options from core APIs into reactive event publish calls
- ensure factory transaction update reads options consistently

### Phase 4: App-Level Adoption Strategy
- define when app should use `undoable: false`
- initial candidates: ephemeral/non-user-meaningful writes

### Phase 5: Validation
- verify undoable=true keeps current history behavior
- verify undoable=false applies data change but skips undo stack entry
- verify mixed undoable/non-undoable calls in one transaction behave as expected

## Open Questions

1. Should `undoable` be supported by all mutation APIs or only selected ones?
2. For a transaction containing both undoable and non-undoable events:
- should transaction commit if only non-undoable changes happened?
3. Should we support additional options in same shape (future-proofing), e.g. diagnostics tags?

## Risks

1. Inconsistent adoption can create surprising undo behavior.
2. Missing option propagation on one layer can cause silent history bugs.
3. Overuse of non-undoable updates may make user history feel unreliable.

## Success Criteria

- framework APIs expose explicit `undoable` option where relevant
- default behavior remains unchanged for existing calls
- non-undoable updates are applied but not added to undo history
- behavior is documented in framework + app docs before widespread usage
