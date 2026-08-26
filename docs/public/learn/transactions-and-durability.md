# One user intent, one transaction

A transaction is the durability boundary for one intended product action. It
groups canonical writes so success commits one coherent result and failure
restores the previous result. The same boundary gives undo/redo, collaboration
publication, and persistence a stable unit to observe.

Factory owns transaction execution, rollback, history, and replay. Reactive
Events carries typed coordination and transaction-owner routes; it does not
authorize UI or transport code to open unrelated nested commits.

## Where this runs

The app opens and closes the transaction inside the Feature or common API that
owns one product decision. Pointer listeners, React effects, collaboration
providers, persistence adapters, and AI providers call that owner route; they
do not create competing transactions.

## Implementation

Record the reversible evidence in the same transaction that applies the value:

```ts
import factory from '@asyra/factory'

const state = { value: 0 }
const EVENT = 'app:set-value'

type ValuePayload = Readonly<{
  before: number
  after: number
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

export const setValue = (after: number) => {
  factory.startTransaction()
  try {
    factory.updateTransaction({
      type: 'updateTransaction',
      eventName: EVENT,
      payload: { before: state.value, after },
      options: { rollbackable: true, undoable: true }
    })
    state.value = after
    factory.endTransaction()
  } catch (error) {
    factory.endTransaction({
      outcome: 'rollback',
      failure: { kind: 'handler-error', cause: error }
    })
    throw error
  }
}
```

The replay handler is registered beside the inverter so Undo, Redo, and
rollback apply validated evidence back to the same state owner.

## Flow

```text
Feature/session starts
→ app opens one transaction
→ canonical owners validate and apply writes
→ success commits once
→ observers project, publish, or persist the commit
```

On failure, the transaction restores prior canonical state and does not append
a history item. Undo and Redo replay the committed action through the declared
owner route. One drag, one group command, or one approved AI action should not
be split into several accidental undo steps.

## Expected result

One successful `setValue(...)` call produces one committed history unit. If a
write throws, rollback restores the previous value and adds no history item.
Undo and Redo replay through the registered owner handler, so visual output and
remote publication remain downstream consequences of the same decision.

## Durability is broader than storage

Persistence stores a validated representation of canonical state.
Collaboration carries canonical changes between actors. Undo/redo replays one
committed intent. AI actions invoke registered app operations. These systems
share the transaction unit, but each retains its own owner:

- Factory owns commit and replay;
- the app owns command meaning and remote/history policy;
- Collaboration owns deterministic replication adapters, not network policy;
- Persistence owns its adapter boundary, not app document migration meaning;
- canonical packages own the data they validate and mutate.

## Avoid split ownership

Do not commit once per pointer move when the product defines one drag. Do not
create one local commit and a different “collaboration commit” for the same
action. Do not let a backend response bypass the owner transaction. Do not hide
partial failure by rendering the desired final output.

## Validate a transaction

- one intended action creates one expected history entry;
- failure restores all touched canonical owners;
- undo and redo reach the same owner instances;
- publication occurs only for accepted committed changes;
- repeated replay is deterministic; and
- cleanup closes every session and temporary owner override.

## Canonical sources

- [Factory contract](../../ai/framework/packages/factory.md)
- [Reactive Events contract](../../ai/framework/packages/reactive-events.md)
- [Transaction-safe Feature guide](../build/feature-session.md)

## Next

- [Build a transaction-safe Feature](../build/feature-session.md)
- [Build persistence with app-owned migration](../build/persistence-migration.md)
