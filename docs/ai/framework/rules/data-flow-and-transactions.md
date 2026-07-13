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
- Use `runTransaction(...)` for finite synchronous or asynchronous work so
  success commits and thrown/rejected work rolls back automatically.
- Use manual `startTransaction()` / `endTransaction(...)` boundaries only when
  an interaction intentionally spans multiple input events.
- Session updates may use non-undoable interim writes, but the final committed state must be grouped deliberately.
- `undoable: false` excludes a mutation from ordinary undo history but does not
  exclude it from failure rollback.
- `rollbackable: false` is an explicit opt-out for a commit-safe effect that
  cannot or must not be reversed. Custom rollbackable events require a
  registered inverter.
- An undoable shared change that must be visible before the outer transaction ends may opt into `sharedDelivery: 'immediate'`; it remains part of the current undo commit and must not be published again at transaction end.
- `sharedDelivery` defaults to `'transaction-end'`. Callers must opt in per change rather than making all undoable shared changes live globally.
- Cross-store mutations must be coordinated through API boundaries that preserve scene-tree, props-manager, selection, and render consistency.

## Current Local ACID Guarantee Boundary

- Atomicity: failed, cancelled, or validation-rejected transactions replay all
  recorded rollbackable inverses in reverse journal order. Rollback creates no
  undo/redo entry and emits no normal user-action completion.
- Consistency: synchronous validators registered on the owning Factory run in
  registration order before a requested non-empty commit. Invalid results,
  thrown validators, and asynchronous validators cause rollback.
- Isolation: Feature session/command operations use one interaction queue so
  mutations do not interleave. Active preview may still be visible to Render/UI.
- Durability: committed action, undo, and redo outcomes are saved through a
  serial Core queue. `committed` and `persisted` are separate statuses.
- Nested rollback marks the complete outer transaction rollback-only; unmatched
  end/rollback calls at depth zero are no-ops.
- If one inverse fails, Factory attempts the remaining inverses, reports
  `rollback-failed`, closes the transaction, forbids persistence, and throws the
  rollback error to the caller.
- Canonical state owners acknowledge replay synchronously. Deleted scene-tree
  and property instances are restored from owner-managed deleted maps; an apply
  exception is a rollback failure, not an observer-only error.
- Feature timeout aborts the session signal before rollback. Async handlers must
  cooperatively reject post-abort writes after each await boundary.
- This is local application-layer ACID-inspired behavior, not database
  serializable isolation. It does not lock external processes or remote clients.

## Required Terminology

- `rollback`: reverse an uncommitted failed/canceled transaction; it must not
  create a normal undo/redo history entry.
- `undo`: reverse a successfully committed user-action history entry.
- `cancel`: stop an active session; its policy chooses rollback,
  commit-current, or feature-defined behavior.
- `committed`: accepted by the runtime transaction owner.
- `persisted`: durably acknowledged by the configured persistence provider;
  runtime commit alone does not imply persistence durability.

## Shared and Network Boundary

- Rolled-back transaction-end shared changes are discarded before delivery.
- An immediate local shared projection is compensated exactly once by its
  inverse during rollback.
- The current guarantee ends at registered local shared channels. Yjs network
  providers, room/auth lifecycle, awareness/presence, remote origin and
  deduplication, reconnect/convergence, and collaborative conflict policy remain
  deferred to `../plans/yjs-network-collaboration-plan.md`.

See `../plans/transaction-atomicity-and-rollback-plan.md` for the product cases
and the Transaction Flow Inspector contract.

## Validation Rule

- Runtime mutation invalid data must not be committed.
- Load-time invalid data must fallback safely.
