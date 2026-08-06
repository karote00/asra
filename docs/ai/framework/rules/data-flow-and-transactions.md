# Rule: Data Flow and Transactions

## Data Flow

- Intent path: Any Input / UI Action / Command -> Feature -> API -> State ->
  Render/UI.
- Intent sources include humans, machines, UI actions, automation, AI, devices,
  and external commands.
- State-application path: Load / Replay / Remote Update -> Validate / Resolve ->
  Apply API -> State Owner -> Projections.
- Transactions are mutation boundaries between API orchestration and state
  owners, not independent product-intent stages.
- Feature-system is the only runtime owner for execute/session/cancel.
- Features must mutate or query framework state through app/common APIs or core facade APIs.
- Feature behavior should stay bounded to its trigger, priority/exclusive policy, and execution/session lifecycle.
- Load, undo/redo replay, and remote synchronization are not new product
  intents; they must use their owning migration/validation/apply pipeline rather
  than introduce another feature-decision runtime.

## Event Ownership Rule

- Framework event contracts must stay domain-agnostic and must not assume app/preset-specific system-context keys.
- System-context key updates should use managed-property APIs (`core.setSystemProperty` / `core.getSystemProperty`) unless an app/preset explicitly defines its own event contract.

## Transaction Rule

- APIs that mutate model data should be transaction-bounded.
- Group logically-related mutations in one transaction.
- One intended user action should create one intended undo commit.
- A bulk action uses the same transaction journal and undo stack as any other
  action. State-owner before/after or add/remove events are the reversible
  evidence; do not create an AI-specific, bulk-specific, or parallel
  forward/inverse history artifact for the same action.
- Successful state-owner apply must not trigger a second full-document
  save/equality/finalize/evidence-clone pass merely to reconstruct action
  History. Required mutation-time detachment and inverse registration remain
  owned by the ordinary state-owner and transaction contracts.
- Use `runTransaction(...)` for finite synchronous or asynchronous work so
  success commits and thrown/rejected work rolls back automatically.
- Use manual `startTransaction()` / `endTransaction(...)` boundaries only when
  an interaction intentionally spans multiple input events.
- Session updates that are part of the intended user action may remain undoable;
  the outer session boundary still groups them into one undo commit. A feature
  may use non-undoable interim writes only when those writes are genuinely not
  part of the action history.
- `undoable: false` excludes a mutation from ordinary undo history but does not
  exclude it from failure rollback.
- `rollbackable: false` opts out of failure rollback, but an event that remains
  undoable still requires an inverse contract. A documented intentionally
  irreversible commit-safe effect must set both `rollbackable: false` and
  `undoable: false`.
- A shared change that must complete the shared pipeline before the outer
  transaction ends opts into `sharedDelivery: 'immediate'`. An undoable
  immediate change remains part of the current undo commit and is not
  published again at transaction end.
- `sharedDelivery` defaults to `'transaction-end'` independently from
  `undoable`. It selects complete shared-pipeline timing: local shared-channel
  delivery plus optional collaboration publication.
- One synchronous immediate delivery action emits at most one ordered shared
  publication, even when it changes multiple elements or state owners. One
  outer pointer session may therefore emit mouse-down, drag-update, and
  conditional mouse-up publications while still producing one undo commit.
- Publication batching defaults on. A dependent interaction may explicitly
  configure `batchPublications: false` before its first mutation so each
  immediate or transaction-end source boundary settles separately. Factory
  retains that source-delivery order for Undo/Redo without splitting the
  action's one History entry.
- Factory preserves every app-authored semantic change in order. It does not
  collapse or deduplicate sequences such as A -> B -> C -> B by default.
- A continuous gesture may explicitly opt into local `replace-latest` History
  staging with one gesture key. The canonical state owner must provide a
  complete owner-issued History candidate bundle for each staged sample.
  Factory retains the first complete `before` bundle, replaces only the latest
  complete `after` bundle reference, and materializes one ordinary
  state-owner-backed History action when the outer transaction commits.
- Replace-latest staging metadata is local transaction control. It must not
  enter canonical payloads, shared publications, collaboration wire data,
  persistence, or replay payloads. Mutations without the explicit option keep
  append-only History semantics.
- Commit-current interruption finalizes the latest complete staged bundle.
  Rollback discards staged History and restores canonical state through the
  rollback contract.
- State-owner batching must preserve effective `rollbackable`, `shared`, and
  `sharedDelivery` semantics and partition changes whose options differ.
- Cross-store mutations must be coordinated through API boundaries that preserve scene-tree, props-manager, selection, and render consistency.

## Current Local ACID Guarantee Boundary

- Atomicity: failed, explicitly rollback-cancelled, or validation-rejected
  transactions replay all recorded rollbackable inverses in reverse journal
  order. Rollback creates no undo/redo entry and emits no normal user-action
  completion. User-driven interruption defaults to commit-current instead.
- Consistency: synchronous validators registered on the owning Factory run in
  registration order before a requested non-empty commit. Invalid results,
  thrown validators, and asynchronous validators cause rollback; rejected async
  results are observed rather than leaking an unhandled rejection. Canonical
  selection is applied before this phase, while its shared projection may still
  be pending.
- Isolation: Feature session/command operations use one interaction queue so
  mutations do not interleave. Active preview may still be visible to Render/UI.
- Durability: local runtime commit ends at Factory settlement and does not
  automatically capture or save a complete document through Core. An app may
  compose a separate persistence or publication-acknowledgement owner.
  `committed`, transport-retained, socket-accepted, and backend-durable remain
  separate states; none may redefine the local transaction or private History
  boundary.
- Transaction status payloads retain the transaction id and counts captured for
  their own outcome even when publication/completion observers commit another
  action reentrantly.
- Nested rollback marks the complete outer transaction rollback-only; unmatched
  end/rollback calls at depth zero are no-ops.
- Nested undo/redo validates and records an inverse restoration plan per replay
  output, independently from the mutation journal. Plans are retained after a
  confirmed semantic apply or explicit applied-then-failed acknowledgement and
  execute in reverse apply order; successful no-op and pre-apply failure retain
  no plan.
- Canonical selection replay is Factory-instance-local and targets the
  SelectionManager injected into the owning Core. Preset subscriptions own
  projections, not canonical rollback correctness.
- If one inverse fails, Factory attempts the remaining inverses, reports
  `rollback-failed`, closes the transaction, forbids persistence, and throws the
  rollback error to the caller.
- A custom inverter output must be a non-null event object with a string event
  type. Invalid output is one aggregated inverse failure, not permission to
  abort replay of the remaining journal.
- Canonical state owners acknowledge replay synchronously; a state owner that
  mutates and then throws must acknowledge after the mutation, while a normal
  mutation return is acknowledged automatically and a semantic no-op returns
  `false`. Deleted scene-tree
  and property instances are restored from owner-managed deleted maps. Scene
  hierarchy replay also restores the recorded parent and child index; an apply
  exception is a rollback failure, not an observer-only error.
- Scene-tree replay resolves the key owner before apply: Element-owned metadata
  and flags use `Element.set`, while computed-only values use the computed/property
  owner path.
- Scene-tree add/remove collapses internal initialization, parentId, children,
  and computed setter changes before publishing the transaction journal. The
  explicit ADD/REMOVE event is the one graph-restoration owner, preventing
  hierarchy replay from inserting or removing a child twice.
- Transaction journal snapshots preserve declared `DataTypes`, including
  symbol and nested `undefined` values; custom output inverters must produce at
  least one reversible event before their primary replay output is applied.
- Canonical journal events and local shared-delivery payloads are deeply
  detached at mutation time, so caller-owned mutation cannot rewrite a pending
  flush or the inverse used to compensate an immediate projection.
- Feature timeout aborts the session signal before rollback. Async handlers must
  cooperatively reject post-abort writes after each await boundary.
- This is local application-layer ACID-inspired behavior, not database
  serializable isolation. It does not lock external processes or remote clients.

## Required Terminology

- `rollback`: reverse an uncommitted failed or explicitly discarded
  transaction; it must not create a normal undo/redo history entry.
- `undo`: reverse a successfully committed user-action history entry.
- The reusable framework cooperative render policy defaults to `progressive`;
  a caller may explicitly select `atomic` when the complete canonical mutation
  and projection must settle before a dependent mutation begins.
- Progressive Undo/Redo reuses the same canonical replay and one outer
  transaction. DataTransact uses the source History entry's recorded progressive
  slice boundaries or already-delivered immediate owner-batch boundaries.
  Compatible consecutive single-element Scene events inside one source boundary
  return to the plural Scene owner apply in batches of at most 32. Recorded
  progressive boundaries remain exact render boundaries; immediate source
  boundaries remain ordered while shared evidence is grouped into publication
  windows of at most 512 distinct work items and the default render slice
  coalesces completed projection up to 1,024 distinct work items. Ordered ids
  are the work identity when present and delivery identity is the fallback.
  `maxItemsPerSlice` may override that positive render budget. This does not
  create per-slice History.
  Browser scheduling belongs to the reusable
  `@asyra/reactive-events` adapter, not DataTransact or an app-local duplicate.
- `cancel`: stop an active session; user-driven interruption defaults to
  commit-current, while its policy may choose rollback or feature-defined
  behavior for a true discard.
- `committed`: accepted by the runtime transaction owner.
- `persisted`/`durable`: acknowledged by the explicit external persistence
  owner; runtime commit or local transport retention alone does not imply
  persistence durability.

## Shared and Network Boundary

- Rolled-back transaction-end shared changes are discarded before delivery.
- A registered transaction-end append failure before application requests
  rollback, restores the provisional history transition, leaves no final
  undo/history or normal completion effect, and propagates the delivery error
  after restoration. Any already-delivered prefix from that flush is
  compensated once in reverse order.
- An immediate shared change discarded before its publication microtask emits
  no network operation. If rollback occurs after publication, Factory emits
  one ordered reverse compensation publication linked to the forward
  deliveries.
- Optional collaboration consumes each Factory shared publication. One
  synchronous immediate delivery action or transaction-end batch becomes one
  transport publication and at most one Provider send; already-published
  immediate entries are not replayed at the outer transaction end.
- Transport publication identity is correlation metadata, not a pointer to a
  second local History artifact. Local reversible evidence remains in the
  existing transaction journal and is omitted from the wire payload.
- Observer exceptions do not redefine an already-delivered local publication
  as undelivered; delivery accounting still permits exactly one compensation.
- The Factory guarantee ends at registered local shared channels and the
  shared-publication boundary. Optional Provider transport, room/auth,
  awareness/presence, remote apply, recovery, and collaborative conflict policy
  follow the ownership boundaries in
  `../plans/completed/network-collaboration-transport-plan.md`.

See `../plans/completed/transaction-atomicity-and-rollback-plan.md` for the
product cases and `../plans/transaction-flow-inspector.data.cjs` for the
executable Transaction Flow Inspector contract.

## Validation Rule

- Runtime mutation invalid data must not be committed.
- Load-time invalid data must fallback safely.
