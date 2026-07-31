# Package: @asyra/factory

## Responsibility

Transaction grouping, undo/redo history, and local shared data-channel
infrastructure.

## Owns

- ordered active transaction journal and effective mutation options
- committed undo/redo stacks
- synchronous commit validators and custom inverse registration
- commit, rollback, undo, and redo status reporting
- user-action completion emission after an undoable commit
- pending shared-channel changes and transaction-end flush
- shared data-channel registration/lookup/observation
- detached shared-delivery metadata for explicit collaboration subscribers
- fresh delivery-only local channels that do not retain a document log

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
- a registered bulk action uses this same journal and committed undo stack; it
  does not create an AI-specific or bulk-specific forward/inverse history
  artifact beside the ordinary owner events
- successful owner apply is trusted after the event is recorded; Factory does
  not run a post-action save, equality comparison, finalize-save,
  full-document snapshot, or evidence-clone pass

2. Undo/redo replay

- undo replays committed changes in reverse order
- redo replays committed changes in forward order
- an ordered batch remains one state-owner event across rollback, undo, redo,
  and remote forward apply; inverse replay reverses the entry order and swaps
  each `before`/`after` pair without interpreting owner-specific payload meaning
- computed record-patch inversion distinguishes an addition from a replacement by
  own `before` property existence; a present `before: undefined` remains a set
  replacement during undo, while only an absent `before` becomes a remove
- computed patch inversion writes top-level keys and record ids as own enumerable
  data properties, so legal special names such as `__proto__` survive undo/redo
  instead of invoking inherited object setters
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

4. Shared delivery and publication

- `SharedDeliveryMode` comes from `@asyra/utils` and is shared by mutation
  options, effective journal options, and public delivery metadata
- local transaction recording is the default
- changes append to a shared channel only when `options.shared` names a
  registered channel
- every shared channel implements one exact `appendBatch(...)` /
  `observeBatch(...)` contract; scalar conveniences delegate to batch-of-one
  and do not create a second canonical delivery path
- `sharedDelivery: 'transaction-end'` buffers delivery until outer commit
- `sharedDelivery: 'immediate'` completes local shared-channel delivery and
  optional collaboration publication during the active transaction
- delivery timing is independent from `undoable`; non-undoable shared changes
  also default to transaction-end unless immediate delivery is explicit
- all changes made by one synchronous immediate delivery action are batched in
  journal order into one publication; a committed transaction-end batch is one
  publication
- a pointer session may emit multiple immediate publications while all of its
  undoable journal entries remain one outer undo commit
- already-published immediate entries are excluded from the transaction-end
  batch; Factory never restores and replays final state solely to publish it
- publication preserves repeated semantic changes such as A -> B -> C -> B and
  does not deduplicate app-authored pipeline steps
- rollback discards pending transaction-end changes and immediate changes that
  have not reached their publication microtask
- rollback after immediate publication emits one ordered reverse compensation
  publication, linked to the forward delivery ids and produced by the same
  inverse primitive
- a committed local undo publishes inverse shared replay at transaction-end;
  redo publishes the forward replay; only channels actually delivered by the
  original committed action remain eligible
- transaction-end shared delivery walks committed journal entries in mutation
  order; each registered observer receives one ordered canonical batch, and
  pending rolled-back or uncommitted entries are never exposed; canonical
  payload metadata remains detached and is never interpreted or rewritten by
  Factory
- if a registered transaction-end channel rejects an append before applying it,
  Factory restores the runtime transaction, reverts its provisional history
  transition, leaves no final undo/history or user-action completion effect,
  and propagates the delivery error
- if an earlier transaction-end append from the same flush was already applied,
  rollback compensates that delivered prefix exactly once in reverse order
- registered shared observers are isolated from one another; if a raw shared
  observer throws after the append is already present, the change remains
  classified as delivered so rollback can compensate it exactly once
- shared channels transport detached committed payloads only; they do not own
  canonical Scene Tree state, Render snapshots, or an independent revision
  authority
- `subscribeToSharedPublication(...)` observes one immutable minimal
  `SharedPublication` per synchronous immediate delivery action or committed
  transaction-end batch. Its exact transport hierarchy is publication
  identity/origin/mode → ordered slices → channel batches → ordered payload
  deliveries
- the transport publication contains no inverse events, local history or
  rollback evidence, duplicated top-level delivery list, record/change alias,
  or nested record wrapper. Reversible evidence remains only in the existing
  transaction journal and inverter contracts; Factory exposes no parallel
  local History artifact. Only actual compensation publications carry
  publication and delivery correlation ids
- `FactoryMutationDeliverySequence` is the already-decided publication order
  for the active transaction's eligible ordinary shared changes. It carries
  `atomic` or `progressive` mode plus ordered slice boundaries; it is delivery
  execution evidence, not History evidence or a planning API
- `getActiveStagedDeliveryController()` exposes only
  `setDeliverySequence(...)` and `stageSlice(...)` for a consumer that
  explicitly owns optional staged publication. The sequence does not create a
  second transaction, change canonical order, or pass delivery policy into
  Core
- consumers that do not own staged publication use the ordinary committed
  `SharedPublication` path and do not acquire the staged-delivery controller
- actual shared-delivery outcomes are recorded on the existing journal entries
  solely to decide whether Undo or Redo emits a replay publication. Factory
  does not copy canonical payloads into a parallel applied-result object

5. Status contract

- `subscribeToTransactionStatus(listener)` is instance-local
- status listeners and the default diagnostic event bridge are isolated; their
  exceptions cannot change a canonical outcome or block later listeners
- statuses distinguish discarded, committed, rolled-back, rollback-failed,
  persistence-skipped, persisted, and persistence-failed outcomes
- each status payload is a detached snapshot of its owning transaction before
  external publication/completion observers run; a reentrant nested action
  cannot replace the outer transaction id or change count
- runtime commit does not mean the persistence provider durably stored data

## Instance Contract

- The package exports a default `factory` instance and the `Factory` class.
- Consumers may create additional factory instances without creating an entire
  framework runtime bundle.
- Each `Factory` instance owns its transaction history and shared-channel
  registry, validators, inverters, and status subscriptions.
- Creating or importing a `Factory` does not create collaboration transport.
- Preset/default local projections use `LocalSharedDataChannel`; the channel
  delivers changes to observers and does not retain a second document history.
- Explicit collaboration subscribes to instance-local detached shared
  publications and passes them to a replaceable Provider; Factory remains the
  transaction/history/shared-settlement owner.
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
- `getUndoHistoryDepth()` is the sole read-only scalar query for the exact local
  undo depth owned by that Factory instance. It does not expose, clone, or allow
  mutation of history entries and does not include remote transactions.

## Hierarchy Transaction Contract

- `MOVE_ELEMENTS` records exact before/after parent and index evidence; its
  inverse replays the exact prior hierarchy instead of issuing a best-effort
  move.
- `CHANGE_SUBTREE` records the complete removed subtree and restores or removes
  it through the canonical Scene Tree replay boundary.
- One group, ungroup, move, reorder, or subtree-removal request settles as one
  intended transaction and one undo entry. Geometry writes performed by the
  official Preset adapter remain in that same transaction.
- A failed hierarchy or property write rolls the entire recorded request back;
  semantic no-ops and pre-mutation validation failures add no history or shared
  publication.
- One committed local hierarchy request becomes one grouped shared publication.
  Undo and redo publish their corresponding exact inverse/forward hierarchy
  changes. Remote-origin replay stays non-undoable and suppresses outbound echo.

## Optional Collaboration Boundary

Factory still does not own Provider/room/auth, Awareness, remote policy,
persistence, recovery, or network transport. The explicit optional
`@asyra/collaboration` instance subscribes to Factory's detached completed
publications and transports them without semantic interpretation. Factory
contributes the local transaction/history/shared-settlement boundary and the
rollbackable, non-undoable remote transaction wrapper only.
That wrapper temporarily owns nested reactive transaction calls and forces
remote-origin journal entries to remain rollbackable even when handler options
request `rollbackable: false`.

Collaboration contracts are:

- `collaboration.md`
- `../plans/completed/network-collaboration-transport-plan.md`

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
