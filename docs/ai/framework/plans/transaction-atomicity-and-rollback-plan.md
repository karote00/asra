# Transaction Atomicity and Rollback Plan

## Status

Implemented contract under final verification. Runtime behavior is governed by
formal tests and the Transaction Flow Inspector; Yjs network collaboration
remains a separate deferred plan.

## Context

Asyra provides:

- nested transaction grouping with one outer commit boundary
- one intended user action to one intended undo commit
- undo replay in reverse change order
- redo replay in forward change order
- non-undoable transaction updates
- transaction-end or immediate shared-channel delivery
- user-action completion after an undoable commit
- automatic reversal of rollbackable active-transaction changes on failure or
  cancel-policy rollback
- synchronous pre-commit validation
- transaction status-driven serial persistence acknowledgement through core

These transactions provide local application-layer ACID-inspired guarantees;
they are not database transactions and do not claim serializable isolation.

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

Implemented guarantee:

- a failed uncommitted action either applies all intended mutations or restores
  all recorded rollbackable mutations to their transaction-start meaning
- rollback must not create normal undo/redo history
- transaction-end shared changes must be discarded on rollback

### Consistency

Implemented guarantee:

- state owners continue to enforce package-local validation/invariants
- an optional cross-store commit validation phase verifies relationships such as
  scene parent/child consistency, property ownership, topology references, and
  selection references
- failed validation triggers rollback before ordinary commit effects

### Isolation

Implemented guarantee:

- Asyra does not promise database serializable isolation
- active session preview may be visible to Render/UI
- feature priority, exclusivity, and the single session runtime remain the
  interaction concurrency boundary
- ordinary undo history, transaction-end shared delivery, and commit-only
  effects do not observe the transaction as committed before outer completion

### Durability

Implemented guarantee:

- runtime `committed` and persistence `persisted` are distinct states
- core may request persistence after commit
- only the configured persistence provider can acknowledge durable storage
- a persistence failure does not retroactively redefine a successful runtime
  commit as an uncommitted transaction

## Public Transaction Contracts

The additive public contract keeps the existing transaction boundary APIs and
adds explicit outcome, failure, and status types:

```ts
type TransactionOutcome = 'commit' | 'rollback'
type TransactionOrigin = 'action' | 'undo' | 'redo'

interface TransactionFailure {
  kind:
    | 'cancelled'
    | 'handler-error'
    | 'handler-timeout'
    | 'validation-failed'
    | 'explicit'
  message?: string
  cause?: unknown
}

interface EndTransactionOptions {
  outcome?: TransactionOutcome
  failure?: TransactionFailure
}

interface RunTransactionOptions {
  failureKind?: TransactionFailure['kind']
}
```

- `endTransaction()` keeps commit as its default outcome.
- `rollbackTransaction(failure?)` requests rollback of the active outer
  transaction.
- `runTransaction(callback, options?)` commits on synchronous or asynchronous
  success, requests rollback on throw or rejection, and rethrows the original
  failure when rollback succeeds. `failureKind` defaults to `explicit`.
- any nested rollback request marks the complete outer transaction
  rollback-only; unmatched end/rollback calls at depth zero are no-ops.
- `rollbackable` defaults to `true` independently from `undoable`.
- transaction status reports runtime commit/rollback separately from
  persistence acknowledgement.
- custom rollbackable mutations require a registered inverter; intentionally
  irreversible effects must opt out with `rollbackable: false`.

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

Stop an active feature session. Cancel is the lifecycle decision; its selected
policy determines whether canonical state is reversed.

Implemented policies:

- `rollback`
- `commit-current`
- `feature-defined`

### Commit and Persist

- `committed`: the runtime transaction owner accepted and finalized the action
- `persisted`: the configured persistence provider acknowledged storage

## Reuse the Existing Inverse Replay Engine

The implementation extracts the existing undo inverse loop into a shared
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

The API contract uses shared inverse
semantics with distinct lifecycle effects.

## Rollbackable vs Undoable

`undoable: false` means a change should not appear in normal user undo history.
It does not necessarily mean the change may remain after transaction failure.

Mutation metadata:

```ts
interface MutationOptions {
  undoable?: boolean
  rollbackable?: boolean
  shared?: string
  sharedDelivery?: 'transaction-end' | 'immediate'
}
```

Defaults:

- `undoable: true`
- `rollbackable: true`

The active transaction journal must retain all rollbackable changes. Commit may
filter the same journal to create normal undo history from undoable changes.

## Error and Timeout Propagation

- A handler returning “not participating” must remain distinguishable from a
  handler failure.
- Feature handler exceptions and timeout failures must reach or mark the active
  transaction owner as failed.
- Timeout aborts the active session signal before rollback. Async handlers must
  use that signal to reject post-abort writes after await boundaries; JavaScript
  Promise execution is not forcibly terminated.
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
  plus synchronous replay acknowledgement and exact deleted-instance restoration
- `@asyra/core`: commit vs persistence orchestration and diagnostics surfaces
- persistence provider: durable acknowledgement
- app/domain feature: selects explicit cancel policy when framework defaults do
  not match product behavior

## Implementation Slices

1. [x] Formalize transaction state and failure status.
2. [x] Extract inverse replay from ordinary undo.
3. [x] Record rollbackable changes independently from normal undo history.
4. [x] Add active-transaction rollback without redo/user-completion effects.
5. [x] Propagate feature error/timeout/cancel decisions to transaction owner.
6. [x] Define transaction-end shared discard and immediate compensation behavior.
7. [x] Add optional cross-store invariant validation phase.
8. [x] Separate runtime commit diagnostics from persistence acknowledgement.
9. [x] Update API surfaces and package docs after concrete APIs exist.

## Product Cases and Failure Behavior

- normal action: outer boundary, ordered journal, validation, one commit, local
  shared delivery, and persistence acknowledgement
- empty action: closes as discarded with no history or persistence request
- nested rollback: any inner rollback request marks the outer transaction
  rollback-only and performs one reverse replay at outer close
- explicit cancel: defaults to rollback; `commit-current` and
  `feature-defined` remain explicit feature policies
- handler error or timeout: cleanup runs, rollback wins over cancel policy, and
  the session signal is aborted before rollback while the first failure reaches
  the caller
- validation failure: no commit effects occur and the rollback path restores
  all recorded rollbackable state
- rollback failure: remaining inverses are attempted, persistence is forbidden,
  transaction state closes, and the rollback error reaches the caller
- undo/redo: use the shared replay primitive with history effects distinct from
  active-transaction rollback
- persistence failure: reports failure without redefining or reversing the
  successful runtime commit

## Test Plan

Atomicity:

- failure after the first of multiple mutations restores all rollbackable state
- rollback replays inverse changes in reverse order
- rollback creates no undo or redo entry
- rollback emits no normal user-action-completed event
- nested transaction failure closes the outer transaction deterministically
- delete followed by validation failure restores the same scene-tree element,
  property component ids/data, and selection state

Recording semantics:

- `undoable: false`, `rollbackable: true` restores on failure but is absent from
  normal undo history
- `rollbackable: false` is explicit and limited to documented commit-safe effects
- mixed rollbackable/undoable changes produce the expected history entry

Cancel/error:

- escape/pointer cancel follows configured policy
- handler exception and timeout cannot silently commit partial mutation
- a cooperative async handler cannot write after its timeout-aborted signal
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
- Local behavior is implemented and remains subject to the formal regression
  tests, package gates, and Transaction Flow Inspector contract.
