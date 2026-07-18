# Package: @asyra/factory

## Responsibility

Transaction grouping, undo/redo history, and Yjs-backed shared data-channel
infrastructure.

## Owns

- ordered active transaction journal and effective mutation options
- committed undo/redo stacks
- synchronous commit validators and custom inverse registration
- commit, rollback, undo, and redo status reporting
- user-action completion emission after an undoable commit
- pending shared-channel changes and transaction-end flush
- shared data-channel registration/lookup/observation
- module-level default Yjs document used by the `getYjsDataChannel(...)` helper

## Must Not Own

- product feature decisions
- package-specific mutation invariants
- render/UI state
- persistence-provider durability policy
- future domain conflict policy decisions

## Current Runtime Contracts

1. Transaction journal and grouping

- nested starts share one outer transaction boundary
- undoable changes recorded before the outer end form one undo commit
- rollbackable recording is independent from ordinary undo eligibility
- `undoable: false` remains rollbackable by default
- `rollbackable: false` opts out of failure rollback and appears in transaction
  status counts, but an undoable event still requires an inverse contract
- intentionally irreversible effects must set both `rollbackable: false` and
  `undoable: false`
- custom events eligible for rollback or undo require
  `registerTransactionInverter(...)`
- a custom inverter must produce at least one replay event; an empty result is a
  rollback failure rather than a successful no-op
- every custom inverter result must be a non-null event object with a string
  event type; invalid `null`/`undefined`/primitive outputs are aggregated as the
  current entry's rollback failure and do not stop later journal inverses
- every event emitted by a custom inverter must itself have a built-in or
  registered inverse contract; replay executes registered output inverters far
  enough to reject an empty output before canonical apply
- journal snapshots preserve the declared `DataTypes` payload contract,
  including symbol values and nested `undefined`, without JSON coercion
- canonical journal events and local shared-delivery payloads are deeply
  detached snapshots captured at mutation time; later caller mutation cannot
  rewrite transaction-end delivery or immediate rollback compensation
- each journal entry is recorded before attempting an immediate shared
  projection, so a failed append cannot remove the canonical mutation from
  rollback coverage
- scene-tree add/remove contributors record their actual parent id and child
  index after placement or before removal, respectively; their internal
  initialization and hierarchy setter changes are not separate reversible
  journal entries

2. Undo/redo replay

- undo replays committed changes in reverse order
- redo replays committed changes in forward order
- replay does not create another ordinary undo commit
- rollback, undo, and redo share the same inverse/replay primitives while keeping
  different history and lifecycle effects
- replay restoration reuses deleted scene-tree/property instances so rollback
  preserves exact state instead of constructing new defaults
- undo/redo replay nested inside an existing outer boundary defers its source
  history stack transition until that outer boundary commits; outer rollback
  restores runtime state and leaves the original undo/redo source available
- when production state owners apply nested replay without recording a second
  journal, outer rollback restores runtime by replaying the source in the
  opposite direction
- after a successful nested replay, outer rollback restores the complete source
  in the opposite direction even when only part of that replay was journaled;
  journal entries remain relevant for shared compensation, not coverage guesses
- before applying each replay output, Factory validates that output's own
  inverse contract and derives an output-level restoration plan
- a plan is retained only after an acknowledged semantic apply or explicit
  applied-then-failed acknowledgement; successful no-op and pre-apply failure
  retain no plan, plans execute in reverse apply order, and restoration apply
  failure is aggregated as `rollback-failed`
- Setter-backed scene-tree and props owners acknowledge after a successful
  semantic assignment but before change callbacks/listeners, so a post-write
  failure retains its restoration plan while a pre-write failure does not
- add/remove replay swaps its inverse metadata so the output is reversible;
  custom inverters must return at least one output, and every output from a
  custom multi-event inverter must likewise have a built-in or registered
  inverse contract
- `registerTransactionReplayHandler(...)` binds canonical replay to one Factory
  instance; a handler may return `false` for a semantic no-op, and handled
  replay is then published to ordinary observers without invoking module-global
  synchronous state owners
- scene-tree remove replay restores the deleted instance through its recorded
  parent id and child index, preserving graph ownership and order
- a new action mutation after nested undo/redo is recorded, fails immediately,
  and marks the outer boundary rollback-only; finalization reverses it before
  restoring the nested replay source
- failed undo/redo replay preserves the source history entry, resets replay
  status, and closes any boundary opened by that replay

3. Commit validation and rollback

- `registerTransactionValidator(name, validator)` registers one synchronous
  validator name and rejects duplicates
- validators run in registration order before a requested non-empty commit
- invalid, thrown, or asynchronous validators cause rollback; rejected async
  results are observed so they do not leak an unhandled Promise rejection
- rollback replays journal inverses in reverse order without adding history or
  emitting user-action completion
- inverse failure does not stop remaining inverses; final status is
  `rollback-failed`, persistence is forbidden, and `TransactionRollbackError`
  reaches the caller
- canonical state-owner apply failures are acknowledged synchronously and are
  aggregated with other inverse failures

4. Shared delivery

- local transaction recording is the default
- changes append to a shared channel only when `options.shared` names a
  registered channel
- `sharedDelivery: 'transaction-end'` buffers delivery until outer commit
- `sharedDelivery: 'immediate'` exposes the change during the active transaction
- delivery timing is independent from `undoable`; non-undoable shared changes
  also default to transaction-end unless immediate delivery is explicit
- rollback discards pending transaction-end changes
- rollback compensates each immediate local projection exactly once
- transaction-end shared delivery walks committed journal entries in mutation
  order; each registered observer receives one delivery per entry, and pending
  rolled-back or uncommitted entries are never exposed; scalar/batch
  `raw|computed` owner provenance remains part of the detached immutable payload
  and is never interpreted or rewritten by Factory
- if a registered transaction-end channel rejects an append before applying it,
  Factory restores the runtime transaction, reverts its provisional history
  transition, leaves no final undo/history or user-action completion effect,
  and propagates the delivery error
- if an earlier transaction-end append from the same flush was already applied,
  rollback compensates that delivered prefix exactly once in reverse order
- registered shared observers are isolated from one another; if a raw Yjs
  observer throws after the append is already present, the change remains
  classified as delivered so rollback can compensate it exactly once
- shared channels transport detached committed payloads only; they do not own
  canonical Scene Tree state, Render snapshots, or an independent revision
  authority

5. Status contract

- `subscribeToTransactionStatus(listener)` is instance-local
- status listeners and the default diagnostic event bridge are isolated; their
  exceptions cannot change a canonical outcome or block later listeners
- statuses distinguish discarded, committed, rolled-back, rollback-failed,
  persistence-skipped, persisted, and persistence-failed outcomes
- runtime commit does not mean the persistence provider durably stored data

## Instance Contract

- The package exports a default `factory` instance and the `Factory` class.
- Consumers may create additional factory instances without creating an entire
  framework runtime bundle.
- Each `Factory` instance owns its transaction history and shared-channel
  registry, validators, inverters, and status subscriptions.
- Creating a `Factory` does not currently create or inject another Y.Doc;
  `getYjsDataChannel(...)` still resolves channels from the module-level default
  document.
- Consumers that need another Y.Doc may create channels from their consumer-owned
  document and register those channels on the intended `Factory` instance.
- Each intended isolation boundary must explicitly choose its Factory, channel
  ownership, and event subscription wiring.
- Default imports intentionally share the default factory transaction history
  and shared-channel registry.
- Only the default singleton is registered as the global reactive transaction
  owner and bridges status/user-action events. Consumer-owned Factory instances
  remain instance-local unless the consumer explicitly wires them.
- Direct `undo()` and `redo()` on a consumer-owned Factory temporarily route
  their nested transaction calls back to that same instance; they do not touch
  the default Factory history or statuses.

## Deferred Contracts

- Yjs network collaboration:
  `../plans/yjs-network-collaboration-plan.md`
- advanced domain conflict policy:
  `../plans/collaborative-conflict-policies-plan.md`

## Validation Checklist

- One intended committed action creates one intended undo entry.
- Undo replays inverse changes in reverse order.
- Redo restores the committed forward sequence.
- Transaction-end shared changes do not flush before the outer commit.
- The eligible history transition is visible to local shared observers; it is
  provisional until transaction-end shared settlement succeeds.
- A failed registered transaction-end flush restores runtime state and leaves
  action/undo/redo source history unchanged.
- Rollback restores rollbackable entries without polluting undo/redo history.
- Immediate local shared delivery is compensated exactly once on rollback.
- Validators execute synchronously and in registration order.
- Default and consumer-owned instances do not share transaction state unless
  explicitly wired to do so.
