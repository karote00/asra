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
- a registered transaction-end shared append failure before application restores
  canonical runtime state, compensates any earlier append from the same flush,
  restores the provisionally finalized history transition, and leaves no final
  history or completion effect

### Consistency

Implemented guarantee:

- state owners continue to enforce package-local validation/invariants
- an optional cross-store commit validation phase verifies relationships such as
  scene parent/child consistency, property ownership, topology references, and
  selection references
- selection APIs apply their state-owner canonical mutation before commit
  validation; transaction-end shared delivery remains a projection handoff and
  is not the delayed owner of canonical selection state
- failed validation triggers rollback before ordinary commit effects
- validators are synchronous; a returned thenable is rejected as validation
  failure, while any later rejection from that thenable is observed rather than
  leaking as an unhandled process-level rejection

### Isolation

Implemented guarantee:

- Asyra does not promise database serializable isolation
- active session preview may be visible to Render/UI
- an active session preview that requires pre-commit projection explicitly opts
  into `sharedDelivery: 'immediate'`
- feature priority, exclusivity, and the single session runtime remain the
  interaction concurrency boundary
- ordinary undo history, transaction-end shared delivery, and commit-only
  effects do not observe the transaction as committed before outer completion

### Durability

Implemented guarantee:

- runtime `committed` and persistence `persisted` are distinct states
- core captures the provider and a deeply detached CoreRawData snapshot when
  commit is reported; the serial queue performs provider I/O against that
  captured snapshot without retaining live mutable state references
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
- Feature System's public `withTransaction(...)` wrapper follows the same
  synchronous and asynchronous outcome contract when using injected Factory
  boundary methods.
- any nested rollback request marks the complete outer transaction
  rollback-only; unmatched end/rollback calls at depth zero are no-ops.
- `rollbackable` defaults to `true` independently from `undoable`.
- transaction status reports runtime commit/rollback separately from
  persistence acknowledgement.
- custom mutations eligible for rollback or ordinary undo history require a
  registered inverter, and every event
  emitted by that inverter must itself have a built-in or registered inverse
  contract; both source and output inverters must emit at least one reversible
  event before canonical apply, and intentionally irreversible effects must opt out with
  both `rollbackable: false` and `undoable: false`.
- transaction journal snapshots preserve declared `DataTypes`, including symbol
  and nested `undefined` values, without JSON coercion.
- canonical journal events and local shared-delivery payloads are deeply
  detached at mutation time; later caller mutation cannot rewrite a pending
  transaction-end flush or immediate rollback compensation.

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

The additive `SessionManager.registerSession(...)` API keeps the legacy
handler-only fifth argument and applies the default `commit-current` policy. The
six-argument form accepts an explicit policy before the handler.

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
- `sharedDelivery: 'transaction-end'`; `undoable: false` does not imply
  immediate delivery, and interactive projection must opt in explicitly
- state-owner batching preserves the effective rollback, channel, and delivery
  options; only consecutive compatible transient changes are merged, and a
  pending batch is flushed before an ordinary or incompatible change so the
  journal preserves canonical mutation order

The active transaction journal must retain all rollbackable changes. Commit may
filter the same journal to create normal undo history from undoable changes.
Therefore `rollbackable: false` alone does not permit an irreversible custom
event to enter undo history; an intentionally irreversible effect must also set
`undoable: false`.
Scene-tree add/remove journal entries capture their actual parent id and child
index at the owning state boundary so multi-pass replay remains reversible.
The journal entry exists before any immediate shared delivery attempt; a
delivery failure therefore leaves the canonical mutation reversible, while an
undelivered shared entry requires no compensation.

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
- escape: commit-current
- pointer cancel: commit-current
- handler error/timeout: rollback
- conflicting exclusive action/tool switch: commit-current or feature-defined
- explicit apply-current action: commit-current
- an app-owned explicit discard action: rollback
- empty/no-participant session: discard without history

User-driven interruption is a lifecycle cancel, not a failed transaction. The
interaction queue finishes the already-running update, then the active session
uses its normal end contract with the interruption snapshot to turn the current
preview into one undoable commit before the next action begins. A feature may
still opt into `rollback` or `feature-defined` behavior when its product
contract is a true discard.

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
- observer failure after a local Yjs append does not erase delivery accounting;
  the appended forward change remains eligible for exactly one compensation
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
- user-driven cancel: defaults to `commit-current`, finalizes the current
  preview through the normal session-end contract, and creates one undoable
  commit before the next interaction; `rollback` and `feature-defined` remain
  explicit feature policies for true discard behavior
- handler error or timeout: cleanup runs, rollback wins over cancel policy, and
  the session signal is aborted before rollback while the first failure reaches
  the caller
- validation failure: no commit effects occur and the rollback path restores
  all recorded rollbackable state
- rollback failure: remaining inverses are attempted, persistence is forbidden,
  transaction state closes, and the rollback error reaches the caller
- undo/redo: use the shared replay primitive with history effects distinct from
  active-transaction rollback
- nested undo/redo followed by outer rollback replays the source in the opposite
  direction even when production state owners create no replay journal or a
  mixed replay journal; the complete runtime is restored and the original
  source history remains available
- a new action mutation after nested undo/redo is journaled, fails immediately,
  and marks the outer boundary rollback-only; rollback reverses that action
  journal before restoring the nested replay source
- before nested undo/redo applies each replay output, it validates that output's
  own inverse contract and derives an output-level restoration plan
- a plan is retained after a confirmed semantic apply or when a state owner
  explicitly acknowledges that it mutated before throwing; a successful no-op
  or pre-apply failure retains no plan, so canonical state is not over-restored
- Setter-backed canonical owners acknowledge after the first successful
  semantic assignment and before change callbacks/listeners, so failures from
  post-write observers retain the plan without misclassifying pre-write errors
- output-level restoration covers add/remove by swapping inverse metadata and
  custom multi-event inverters by requiring at least one emitted output and by
  requiring every emitted output to be a non-null typed event whose inverter
  produces at least one reversible event before the primary output applies;
  invalid output is aggregated per journal entry, remaining inverses still run,
  plans run in reverse apply order, and restoration failure is aggregated as
  `rollback-failed`
- scene-tree replay routes Element-owned metadata/flags to `Element.set` and
  computed-only keys to the Computed/property owner path before synchronous
  semantic apply acknowledgement
- add/remove graph operations collapse their internal initialization and
  parentId/children/computed setter changes before journal publication; the
  explicit add/remove event with parent/index metadata is the sole reversible
  graph owner, so rollback and undo never apply hierarchy membership twice
- selection inverse replay is routed through the owning Factory's instance-local
  handler to the injected SelectionManager; preset installation is not required
  for canonical restoration and another runtime instance is not mutated
- registration-driven selection channels receive the same instance-local replay
  owner and an explicit selection inverter for their actual `eventName` before
  the first rollbackable mutation; this is not limited to the three preset
  selection event names
- after the instance-local canonical handler succeeds, replay remains visible to
  ordinary event observers without re-invoking global synchronous state-owner
  subscribers
- persistence failure: reports failure without redefining or reversing the
  successful runtime commit
- transaction-end shared append failure before application: restores runtime
  state, compensates earlier appends from the same flush, preserves undo/redo
  source history after reverting its provisional transition, and propagates the
  delivery failure

## Test Plan

Atomicity:

- failure after the first of multiple mutations restores all rollbackable state
- rollback replays inverse changes in reverse order
- an invalid custom inverter output reports rollback-failed but does not prevent
  a later valid inverse from restoring its state
- visible, lock, and name replay restore Element-owned data rather than being
  treated as computed-data no-ops
- rollback creates no undo or redo entry
- rollback emits no normal user-action-completed event
- nested transaction failure closes the outer transaction deterministically
- consumer-owned replay boundaries remain independent from an active default
  owner boundary
- nested undo/redo followed by outer rollback preserves the original history
  source for a later replay and restores runtime when the nested replay journal
  is empty or covers only part of the source
- nested undo/redo that is already reflected in canonical state is a successful
  no-op; outer rollback preserves that pre-boundary state and history source
- delete followed by validation failure restores the same scene-tree element,
  original parent/index, property component ids/data, and selection state

Recording semantics:

- `undoable: false`, `rollbackable: true` restores on failure but is absent from
  normal undo history
- `rollbackable: false`, `undoable: false` is the explicit pair for documented
  intentionally irreversible commit-safe effects; rollback opt-out alone still
  requires reversibility when ordinary undo remains enabled
- mixed rollbackable/undoable changes produce the expected history entry

Cancel/error:

- escape, pointer cancel, tool switch, and a new action default to
  `commit-current`, finalize the current preview, and create one undoable commit
  before the next queued interaction
- handler exception and timeout cannot silently commit partial mutation
- a cooperative async handler cannot write after its timeout-aborted signal
- explicit rollback and feature-defined cancellation remain available
- legacy five-argument session registration defaults to commit-current
- public transaction wrappers rollback and rethrow both synchronous throws and
  asynchronous rejections

Shared behavior:

- transaction-end pending changes are discarded on rollback
- non-undoable shared changes remain pending until transaction end unless they
  explicitly request immediate delivery
- create, move, vector-point, gradient-handle, and color-picker product tests
  observe their active preview through an explicit immediate shared delivery
  without splitting the outer transaction or its single undo commit
- immediate delivery emits deterministic compensation when enabled
- pending and immediate shared payloads remain equal to their mutation-time
  snapshot even when the caller later mutates its original payload
- observer failure after an applied Yjs append still produces exactly one
  rollback compensation and does not block later registered observers
- transaction-end shared append failure before application restores canonical
  state, leaves no final history/completion effect, and compensates earlier
  appends from the same flush
- rollback replay does not echo as a new ordinary local action

Consistency/durability:

- cross-store validation failure rolls back
- resolved or rejected asynchronous validator results are rejected without an
  unhandled Promise rejection
- cross-store validators observe the transaction's final canonical selection,
  including selection changes whose shared projection is still pending
- consumer-owned Factory/Selection pairs rollback and replay selection without
  preset wiring or mutation of the default SelectionManager
- back-to-back commits persist their commit-time snapshots rather than later
  state or an active preview
- queued snapshots remain stable when later writes mutate nested arrays or
  objects that were present in an earlier commit
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
