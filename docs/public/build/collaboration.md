# Build opt-in collaboration

`@asyra/collaboration` transports completed immutable Factory publications and
separate ephemeral Awareness. It does not own canonical document data, app
operation policy, reconnect history, or a backend.

## Prerequisites

- `@asyra/factory` shared publication from canonical transactions
- non-empty app-owned document, room, and actor identities
- a replaceable Collaboration `Provider`
- app validation and one remote transaction callback
- explicit lifecycle ownership for Provider and Awareness resources

## Ownership

Factory owns transaction evidence and `SharedPublication`. Collaboration owns
FIFO handoff, provider lifecycle, outcomes, and Awareness routing. The Provider
owns connection, bounded capacity, wire encoding, queue position, and transport
failure. The app/backend owns identity policy, authorization, schema checks,
conflicts, missed-change recovery, durable outbox, checkpoints, and canonical
remote apply.

## Public APIs

- `createCollaboration(...)`
- `Collaboration`
- `Provider`, `MemoryHub`, and `MemoryProvider`
- `publicationSource.subscribe(...)`
- `processRemotePublication(publication)`
- `start()`, `disconnect()`, `reconnect()`, and `dispose()`
- `updateAwareness(...)` and Awareness observation
- Factory `subscribeToSharedPublication(...)` and `runRemoteTransaction(...)`

## Where this runs

Create Collaboration in the app's document-session lifecycle after document,
room, actor, Provider, and canonical apply policy are known. The Provider may
live in a separate package; inbound validation and remote mutation remain in
the app module that understands the document schema.

## Implementation

```ts
import { createCollaboration } from '@asyra/collaboration'

const collaboration = createCollaboration({
  documentId,
  roomId,
  actorId,
  provider,
  publicationSource: {
    subscribe: (subscriber) =>
      factory.subscribeToSharedPublication(subscriber)
  },
  processRemotePublication: (publication) => {
    const deliveries = publication.slices.flatMap((slice) =>
      slice.batches.flatMap((batch) =>
        batch.deliveries.map((delivery) => ({
          channel: batch.channel,
          delivery
        }))
      )
    )

    validatePublication(deliveries)
    factory.runRemoteTransaction(() => {
      deliveries.forEach(({ delivery }) => applyRemoteDelivery(delivery))
    })
  },
  resourceOwnership: { provider: 'owned' }
})

await collaboration.start()
```

`validatePublication(...)` and `applyRemoteDelivery(...)` are app-owned. They
must accept only supported event names and payload schemas, then route each
accepted delivery through the same canonical owner APIs used locally.

## Flow

1. Create the app/provider identity and publication source.
2. Register an exclusive inbound `processRemotePublication` callback.
3. Construct Collaboration; construction is inert.
4. Call `start()` to bind observers and connect.
5. Send each completed Factory publication once in canonical FIFO order.
6. Validate each inbound publication in the app.
7. Apply accepted deliveries inside one Factory remote transaction.
8. Keep presence in Awareness, outside document state.
9. Dispose observers and only the resources the composition owns.

## Expected result

After Actor A commits a supported change, Actor B receives one publication,
validates it, and applies it in one remote transaction. Actor A's selected tool
may appear through separate Awareness projection. Construction creates no room
or network work before `start()`.

If a peer is disconnected, generic Collaboration reports a skipped outcome and
retains no replay copy. Reconnect receives future live publications only. A
send failure does not roll back an already committed local transaction; an app
that needs offline recovery must own a durable outbox.

## Validate

Test FIFO order, duplicate publication identity policy, disconnected behavior,
provider capacity, inbound rejection, remote history/echo policy, Awareness
removal, and resource ownership. Include two app instances and assert their
canonical owner state, not merely sent messages or transport logs.

## Forbidden shortcuts

- no canonical element changes through Awareness
- no generic package authorization, conflict, or retry policy
- no rebuilt snapshot in place of the exact Factory publication
- no direct remote map mutation outside one canonical transaction
- no claim that `MemoryProvider` proves cross-process transport
- no secret, private endpoint, or backend credential in browser content

## Canonical sources

- [Collaboration contract](../../ai/framework/packages/collaboration.md)
- [Asyra Design reference composition](../../ai/apps/asyra-design/modules/collaboration-reference.md)
- [Collaboration package guide](../reference/packages/collaboration.md)

## Next

- [Read the Collaboration guide](../reference/packages/collaboration.md)
- [See Asyra Design as a reference product](../cases/asyra-design.md)
