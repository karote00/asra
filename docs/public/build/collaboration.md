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

Run the two-actor proof:

```shell
yarn examples:run collaboration-two-memory-actors
```

## Expected result

Actor B converges to Actor A's counter value `7`. Actor A's selected tool
appears through separate Awareness projection. Construction creates no room or
network work before `start()`.

If a peer is disconnected, generic Collaboration reports a skipped outcome and
retains no replay copy. Reconnect receives future live publications only. A
send failure does not roll back an already committed local transaction; an app
that needs offline recovery must own a durable outbox.

## Validate

```shell
yarn examples:run collaboration-two-memory-actors
yarn workspace @asyra/collaboration test:local
yarn workspace @asyra/factory test:local
```

Test FIFO order, duplicate publication identity policy, disconnected behavior,
provider capacity, inbound rejection, remote history/echo policy, Awareness
removal, and resource ownership.

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
- [Executable two-actor example](../../examples/network-collaboration-transport.mjs)

## Next

- [Read the Collaboration guide](../reference/packages/collaboration.md)
- [See Asyra Design as a reference product](../cases/asyra-design.md)
