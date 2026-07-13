# Package: @asyra/factory

## Responsibility

Transaction grouping, undo/redo history, and Yjs-backed shared data-channel
infrastructure.

## Owns

- active transaction depth and current transaction change buffer
- committed undo/redo stacks
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

1. Transaction grouping
- nested starts share one outer transaction boundary
- undoable changes recorded before the outer end form one undo commit
- non-undoable changes do not enter normal undo history

2. Undo/redo replay
- undo replays committed changes in reverse order
- redo replays committed changes in forward order
- replay does not create another ordinary undo commit

3. Shared delivery
- local transaction recording is the default
- changes append to a shared channel only when `options.shared` names a
  registered channel
- `sharedDelivery: 'transaction-end'` buffers delivery until outer commit
- `sharedDelivery: 'immediate'` exposes the change during the active transaction

4. Current failure boundary
- an active failed transaction is not automatically reversed today
- session cancel does not automatically request factory rollback today
- runtime commit does not mean the persistence provider durably stored data

## Instance Contract

- The package exports a default `factory` instance and the `Factory` class.
- Consumers may create additional factory instances without creating an entire
  framework runtime bundle.
- Each `Factory` instance owns its transaction history and shared-channel
  registry.
- Creating a `Factory` does not currently create or inject another Y.Doc;
  `getYjsDataChannel(...)` still resolves channels from the module-level default
  document.
- Consumers that need another Y.Doc may create channels from their consumer-owned
  document and register those channels on the intended `Factory` instance.
- Each intended isolation boundary must explicitly choose its Factory, channel
  ownership, and event subscription wiring.
- Default imports intentionally share the default factory transaction history
  and shared-channel registry.

## Deferred Contracts

- ACID-inspired rollback/cancel semantics:
  `../plans/transaction-atomicity-and-rollback-plan.md`
- Yjs network collaboration:
  `../plans/yjs-network-collaboration-plan.md`
- advanced domain conflict policy:
  `../plans/collaborative-conflict-policies-plan.md`

## Validation Checklist

- One intended committed action creates one intended undo entry.
- Undo replays inverse changes in reverse order.
- Redo restores the committed forward sequence.
- Transaction-end shared changes do not flush before the outer commit.
- Default and consumer-owned instances do not share transaction state unless
  explicitly wired to do so.
