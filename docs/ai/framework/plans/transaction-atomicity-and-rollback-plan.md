# Transaction Atomicity and Rollback Plan

## Status

Near-term, docs-only planning record. No runtime behavior or public API in this
file is implemented merely because it is documented here.

## Context

Asyra currently provides:

- nested transaction grouping with one outer commit boundary
- one intended user action to one intended undo commit
- undo replay in reverse change order
- redo replay in forward change order
- non-undoable transaction updates
- transaction-end or immediate shared-channel delivery
- user-action completion after an undoable commit
- transaction-end persistence triggering through core

The missing failure path is automatic reversal of already-applied changes when
an active transaction fails or when a session cancellation policy requests
rollback.

Current transactions therefore provide action grouping and history replay, not
database ACID guarantees.

## Goal

Complete an ACID-inspired runtime transaction contract appropriate for an
interactive information-modeling framework:

- failed active transactions can restore canonical state atomically
- rollback reuses the same inverse change semantics as undo
- rollback, undo, and cancel remain distinct lifecycle concepts
- undoable and rollbackable recording are independent
- cross-store invariants can be checked before commit
- commit, shared delivery, and persistence acknowledgement have explicit timing
- normal interactive preview remains visible to Render/UI while the transaction
  is active

## Non-Goals

- claiming database-level serializable isolation
- implementing a database write-ahead log in the framework core
- hiding all interactive preview state until commit
- introducing a mandatory all-package runtime container
- replacing state-owner validation with transaction-level business logic
- implementing Yjs networking or distributed rollback in this plan

## ACID Interpretation for Asyra

### Atomicity

Target guarantee:

- a failed uncommitted action either applies all intended mutations or restores
  all recorded rollbackable mutations to their transaction-start meaning
- rollback must not create normal undo/redo history
- transaction-end shared changes must be discarded on rollback

### Consistency

Target guarantee:

- state owners continue to enforce package-local validation/invariants
- an optional cross-store commit validation phase verifies relationships such as
  scene parent/child consistency, property ownership, topology references, and
  selection references
- failed validation triggers rollback before ordinary commit effects

### Isolation

Target guarantee:

- Asyra does not promise database serializable isolation
- active session preview may be visible to Render/UI
- feature priority, exclusivity, and the single session runtime remain the
  interaction concurrency boundary
- ordinary undo history, transaction-end shared delivery, and commit-only
  effects do not observe the transaction as committed before outer completion

### Durability

Target guarantee:

- runtime `committed` and persistence `persisted` are distinct states
- core may request persistence after commit
- only the configured persistence provider can acknowledge durable storage
- a persistence failure does not retroactively redefine a successful runtime
  commit as an uncommitted transaction

## Required Terminology

### Rollback

Reverse an active uncommitted failed/canceled transaction.

Rollback must:

- consume the active transaction journal
- replay rollbackable inverses in reverse order
- avoid normal undo and redo stack entries
- avoid user-action-completed emission
- discard pending transaction-end shared changes
- leave all transaction depth/status state closed deterministically

### Undo

Reverse a successfully committed user-action history entry.

Undo may:

- pop from the undo stack
- replay inverse changes
- create a redo entry
- update user-visible history state

### Cancel

Stop an active feature session. Cancel is a decision, not automatically a state
reversal.

Future explicit policies:

- `rollback`
- `commit-current`
- `feature-defined`

### Commit and Persist

- `committed`: the runtime transaction owner accepted and finalized the action
- `persisted`: the configured persistence provider acknowledged storage

## Reuse the Existing Inverse Replay Engine

The implementation should extract the existing undo inverse loop into a shared
internal replay primitive rather than push a failed active transaction onto the
public undo stack and call ordinary `undo()`.

Conceptual direction:

```ts
replayInverse(changes, {
  mode: 'undo' | 'rollback',
  recordRedo: boolean,
  publishCompensation: boolean
})
```

Undo usage:

```ts
replayInverse(committedChanges, {
  mode: 'undo',
  recordRedo: true,
  publishCompensation: true
})
```

Rollback usage:

```ts
replayInverse(activeTransactionChanges, {
  mode: 'rollback',
  recordRedo: false,
  publishCompensation: requiresImmediateSharedCompensation
})
```

Exact API naming is implementation-owned; the contract is shared inverse
semantics with distinct lifecycle effects.

## Rollbackable vs Undoable

`undoable: false` means a change should not appear in normal user undo history.
It does not necessarily mean the change may remain after transaction failure.

Target mutation metadata direction:

```ts
interface MutationOptions {
  undoable?: boolean
  rollbackable?: boolean
  shared?: string
  sharedDelivery?: 'transaction-end' | 'immediate'
}
```

Target defaults:

- `undoable: true`
- `rollbackable: true`

The active transaction journal must retain all rollbackable changes. Commit may
filter the same journal to create normal undo history from undoable changes.

## Error and Timeout Propagation

- A handler returning “not participating” must remain distinguishable from a
  handler failure.
- Feature handler exceptions and timeout failures must reach or mark the active
  transaction owner as failed.
- A failed transaction must not silently continue to ordinary commit.
- Recoverable feature-local errors may be handled locally only when the feature
  explicitly preserves valid canonical state.
- Transaction cleanup must use deterministic `try/finally` ownership.

## Cancel Policy

Recommended default outcomes:

- normal session end: commit
- escape: rollback
- pointer cancel: rollback
- handler error/timeout: rollback
- conflicting exclusive action/tool switch: rollback or feature-defined
- explicit apply-current action: commit-current
- empty/no-participant session: discard without history

Feature-local cleanup and canonical state reversal are separate:

- feature/session lifecycle releases capture, temporary resources, and local
  helpers
- transaction/factory lifecycle reverses recorded canonical mutations

## Shared Delivery During Rollback

### Transaction-end delivery

- pending shared changes are not externally visible before commit
- rollback discards the pending shared buffer
- no distributed compensation is required

### Immediate delivery

- remote observers may already have seen the forward change
- rollback must publish a compensating inverse when distributed convergence is
  required
- remote clients may observe transient forward state before compensation
- rollbackable interactions should prefer transaction-end delivery when remote
  transient state is unacceptable

This plan guarantees local failure atomicity first. Distributed compensation is
completed with the Yjs network collaboration plan.

## Ownership

- `@asyra/factory`: transaction journal, rollback mode, shared inverse replay,
  undo/redo stack effects
- `@asyra/feature-system`: session cancel decision and handler failure/timeout
  propagation
- state-owner packages: correct reversible change payloads and local invariants
- `@asyra/core`: commit vs persistence orchestration and diagnostics surfaces
- persistence provider: durable acknowledgement
- app/domain feature: selects explicit cancel policy when framework defaults do
  not match product behavior

## Implementation Slices

1. Formalize transaction state and failure status.
2. Extract inverse replay from ordinary undo.
3. Record rollbackable changes independently from normal undo history.
4. Add active-transaction rollback without redo/user-completion effects.
5. Propagate feature error/timeout/cancel decisions to transaction owner.
6. Define transaction-end shared discard and immediate compensation behavior.
7. Add optional cross-store invariant validation phase.
8. Separate runtime commit diagnostics from persistence acknowledgement.
9. Update API surfaces and package docs only after concrete APIs exist.

## Test Plan

Atomicity:

- failure after the first of multiple mutations restores all rollbackable state
- rollback replays inverse changes in reverse order
- rollback creates no undo or redo entry
- rollback emits no normal user-action-completed event
- nested transaction failure closes the outer transaction deterministically

Recording semantics:

- `undoable: false`, `rollbackable: true` restores on failure but is absent from
  normal undo history
- `rollbackable: false` is explicit and limited to documented commit-safe effects
- mixed rollbackable/undoable changes produce the expected history entry

Cancel/error:

- escape/pointer cancel follows configured policy
- handler exception and timeout cannot silently commit partial mutation
- feature-defined commit-current remains explicit

Shared behavior:

- transaction-end pending changes are discarded on rollback
- immediate delivery emits deterministic compensation when enabled
- rollback replay does not echo as a new ordinary local action

Consistency/durability:

- cross-store validation failure rolls back
- runtime commit and persistence failure are reported as different states

## Success Criteria

- every failed rollbackable transaction ends in committed-all or restored-all
  local canonical state
- existing undo/redo behavior reuses the same inverse semantics without lifecycle
  regression
- cancel behavior is explicit and testable
- shared and persistence effects occur at documented lifecycle points
- docs no longer need to qualify transaction atomicity as missing

## Assumptions

- This plan precedes Yjs network collaboration work.
- Existing reversible change payloads remain the starting point.
- Complex aggregate mutations may use owner-provided scoped snapshots when a
  field-by-field inverse is unsafe.
- This file records a target contract only; implementation requires formal
  test-first work.
