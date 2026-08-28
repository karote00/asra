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
small local value below only makes transaction evidence directly observable.

## Where this runs

Register the session in the app Feature that owns the gesture or long-running
intent. Raw input and UI controllers call `handleStart`, `handleUpdate`, and
`handleEnd`; canonical mutation stays in the app API invoked by the handlers.

## Implementation

```ts
import factory from '@asyra/factory'
import { SessionManager } from '@asyra/feature-system'

const sessions = new SessionManager()
const state = { value: 0 }
const EVENT = 'app:set-value'
const SESSION = 'app:value-drag'
const FEATURE = 'app:value-tool'

type ValuePayload = Readonly<{
  before: number
  after: number
}>

type ValueUpdate = Readonly<{
  nextValue: number
}>

const readValuePayload = (payload: unknown): ValuePayload => {
  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof (payload as ValuePayload).before !== 'number' ||
    typeof (payload as ValuePayload).after !== 'number'
  ) {
    throw new Error('Invalid app:set-value payload')
  }
  return payload as ValuePayload
}

factory.registerTransactionInverter(EVENT, (event) => {
  const payload = readValuePayload(event.payload)
  return {
    type: event.type,
    payload: { before: payload.after, after: payload.before }
  }
})
factory.registerTransactionReplayHandler(EVENT, (event) => {
  state.value = readValuePayload(event.payload).after
  return true
})

const applyValue = (after: number) => {
  factory.updateTransaction({
    type: 'updateTransaction',
    eventName: EVENT,
    payload: { before: state.value, after },
    options: { rollbackable: true, undoable: true }
  })
  state.value = after
}

sessions.registerSession(SESSION, FEATURE, 100, true, 'rollback', {
  onStart: () => ({ initialValue: state.value }),
  onUpdate: ({ nextValue }: ValueUpdate) => applyValue(nextValue),
  onEnd: () => undefined,
  onCancel: () => 'rollback'
})
```

For a real product, `applyValue` calls the app's canonical common API. Keep the
session open across pointer previews and close it only when the user intent is
accepted or cancelled.

## Flow

1. Register replay and inverse behavior for the app event.
2. Register one session with priority, exclusivity, and cancellation policy.
3. Enter the session through `handleStart(...)`.
4. Record updates through the active Factory transaction.
5. Finish through `handleEnd(...)` to create one commit.
6. Let handler failure enter the declared cancellation/rollback path.
7. Dispose the session and replay handler.

## Expected result

A successful session commits value `5` as one history entry. Undo restores `0`;
Redo restores `5`. A later update that throws rolls back to `5`, reports the app
error, and leaves history depth at one.

When the Feature condition does not match or the Feature is not composed, no
fallback mutation should occur. An error must not leave an active session,
transaction, or partial canonical prefix.

## Validate

Add a product test that starts the session, performs several updates, ends it,
then verifies one Undo unit. Add separate failure, cancellation, interruption,
and cleanup cases that prove no partial state or active transaction remains.

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
- [Transactions and durability](../learn/transactions-and-durability.md)

## Next

- [Learn transactions and durability](../learn/transactions-and-durability.md)
- [Read the Feature System guide](../reference/packages/feature-system.md)
