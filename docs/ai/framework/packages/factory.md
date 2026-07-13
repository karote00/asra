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
- `rollbackable: false` is an explicit non-reversible opt-out and appears in
  transaction status counts
- custom rollbackable events require `registerTransactionInverter(...)`

2. Undo/redo replay
- undo replays committed changes in reverse order
- redo replays committed changes in forward order
- replay does not create another ordinary undo commit
- rollback, undo, and redo share the same inverse/replay primitives while keeping
  different history and lifecycle effects
- replay restoration reuses deleted scene-tree/property instances so rollback
  preserves exact state instead of constructing new defaults
- failed undo/redo replay preserves the source history entry, resets replay
  status, and closes any boundary opened by that replay

3. Commit validation and rollback
- `registerTransactionValidator(name, validator)` registers one synchronous
  validator name and rejects duplicates
- validators run in registration order before a requested non-empty commit
- invalid, thrown, or asynchronous validators cause rollback
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
- rollback discards pending transaction-end changes
- rollback compensates each immediate local projection exactly once

5. Status contract
- `subscribeToTransactionStatus(listener)` is instance-local
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
- Rollback restores rollbackable entries without polluting undo/redo history.
- Immediate local shared delivery is compensated exactly once on rollback.
- Validators execute synchronously and in registration order.
- Default and consumer-owned instances do not share transaction state unless
  explicitly wired to do so.
