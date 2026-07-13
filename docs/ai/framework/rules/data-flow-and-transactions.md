# Rule: Data Flow and Transactions

## Data Flow

- Intent path: Any Intent -> Feature -> API -> Transaction -> State Owner -> Projections.
- Intent sources include humans, machines, UI actions, automation, AI, devices,
  and external commands.
- State-application path: Load / Replay / Remote Update -> Validate / Resolve ->
  Apply API -> State Owner -> Projections.
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
- Session updates may use non-undoable interim writes, but the final committed state must be grouped deliberately.
- An undoable shared change that must be visible before the outer transaction ends may opt into `sharedDelivery: 'immediate'`; it remains part of the current undo commit and must not be published again at transaction end.
- `sharedDelivery` defaults to `'transaction-end'`. Callers must opt in per change rather than making all undoable shared changes live globally.
- Cross-store mutations must be coordinated through API boundaries that preserve scene-tree, props-manager, selection, and render consistency.

## Current Transaction Guarantee Boundary

- Current runtime guarantees transaction grouping, undo/redo event replay,
  nested outer-boundary commit behavior, and optional shared-channel delivery.
- Current runtime does not automatically roll back every already-applied
  mutation when an active transaction fails.
- Canceling an active feature session does not currently imply rollback; the
  session is ended through the existing end path.
- Do not describe the current runtime as database-ACID or as providing automatic
  failure atomicity.

## Required Terminology

- `rollback`: reverse an uncommitted failed/canceled transaction; it must not
  create a normal undo/redo history entry.
- `undo`: reverse a successfully committed user-action history entry.
- `cancel`: stop an active session; its future policy may choose rollback,
  commit-current, or feature-defined behavior.
- `committed`: accepted by the runtime transaction owner.
- `persisted`: durably acknowledged by the configured persistence provider;
  runtime commit alone does not imply persistence durability.

Automatic rollback, cancel policy, rollbackable-vs-undoable recording, and
commit/persistence acknowledgement are deferred contracts. See
`../plans/transaction-atomicity-and-rollback-plan.md`.

## Validation Rule

- Runtime mutation invalid data must not be committed.
- Load-time invalid data must fallback safely.
