# Build a transaction-safe Feature session

Use Feature System to turn one bounded intent into an ordered session and use
Factory to commit its canonical writes as one intended undo unit.

## Prerequisites

- an app-owned intent and mutation API
- `@asyra/feature-system` for session lifecycle
- `@asyra/factory` for transaction, rollback, and history
- an explicit priority, exclusivity decision, and cancellation policy

## Ownership

Feature System owns session ordering and active-session arbitration. Factory
owns transaction settlement, rollback, Undo, Redo, and replay. The app owns the
meaning of the interaction, its mutation API, and whether cancellation rolls
back or commits the current valid result.

## Public APIs

The maintained proof uses:

- `new SessionManager()`
- `registerSession(...)` and `unregisterSession(...)`
- `handleStart(...)`, `handleUpdate(...)`, and `handleEnd(...)`
- `factory.updateTransaction(...)`
- `factory.registerTransactionInverter(...)`
- `factory.registerTransactionReplayHandler(...)`
- `factory.getUndoHistoryDepth()`, `factory.undo()`, and `factory.redo()`

In an app, keep canonical mutations behind its existing common/Core APIs. The
example's small local value exists only to make transaction evidence directly
observable.

## Flow

1. Register replay and inverse behavior for the app event.
2. Register one session with priority, exclusivity, and cancellation policy.
3. Enter the session through `handleStart(...)`.
4. Record updates through the active Factory transaction.
5. Finish through `handleEnd(...)` to create one commit.
6. Let handler failure enter the declared cancellation/rollback path.
7. Dispose the session and replay handler.

Use the exact
[`feature-session-undo`](../../examples/feature-session-undo.mjs) source region.

## Expected result

A successful session commits value `5` as one history entry. Undo restores `0`;
Redo restores `5`. A later update that throws rolls back to `5`, reports the app
error, and leaves history depth at one.

When the Feature condition does not match or the Feature is not composed, no
fallback mutation should occur. An error must not leave an active session,
transaction, or partial canonical prefix.

## Validate

```shell
yarn examples:run feature-session-undo
yarn workspace @asyra/feature-system test:local
yarn workspace @asyra/factory test:local
```

For pointer or AI sessions, add a product test proving the complete start,
update, end, cancellation, and interruption timeline.

## Forbidden shortcuts

- no transaction per update when the product defines one continuous action
- no canonical mutation in raw input listeners or React effects
- no independent UI-only session state as the owner
- no swallowed handler failure or cleanup failure
- no separate “collaboration transaction” for the same local intent
- no manual history entry that bypasses Factory replay

## Canonical sources

- [Feature System contract](../../ai/framework/packages/feature-system.md)
- [Factory contract](../../ai/framework/packages/factory.md)
- [Executable example](../../examples/feature-session-undo.mjs)

## Next

- [Learn transactions and durability](../learn/transactions-and-durability.md)
- [Read the Feature System guide](../reference/packages/feature-system.md)
