# Collaboration Package

`@asyra/collaboration` is the optional, provider-replaceable transport for
completed Factory `SharedPublication` values and separate ephemeral Awareness.
It is not a document data owner, CRDT store, operation policy engine, or backend.

## Activation and Ownership

An app opts in by explicitly creating `Collaboration` with:

- non-empty `documentId`, `roomId`, and `actorId`;
- a Factory-facing `subscribeToSharedPublication` source;
- an app-owned `processRemotePublication` callback;
- an optional replaceable `Provider`;
- optional Awareness;
- optional owned/borrowed Provider and Awareness lifecycle choices.

Construction is inert. `start()` binds observers and connects the Provider.
Apps that omit this composition create no room, Provider, Awareness runtime, or
collaboration network side effect. Their ordinary HTTP/load/save behavior is
unchanged.

Default-created Awareness is owned. Injected Provider and Awareness resources
default to borrowed unless composition says otherwise. `dispose()` detaches
observers, destroys only owned resources, waits for already-started work, and
bypasses queued work that had not started.

## Publication Flow

```text
Factory SharedPublication
-> Collaboration FIFO outbound queue
-> Provider.sendPublication(publication)
-> transport acknowledgement / Promise settlement
-> no retained semantic history

live remote Provider publication
-> Collaboration FIFO inbound queue
-> app processRemotePublication(publication, sender context) once
-> app validation and remote transaction
-> app canonical state owners
-> ordinary Render/UI projections
```

One Factory publication remains one Provider send and one receiving app
callback. Collaboration preserves publication metadata, delivery order,
repeated routes and payloads, undo/redo publications, and compensation
publications. It does not split one publication into per-delivery callbacks.

The outbound and inbound queues are separate: slow acknowledgement cannot block
incoming app processing, while each direction retains its own FIFO order.

Provider Promise settlement is the transport acknowledgement boundary. A
failed send is observable and never retroactively rolls back an already
committed local Factory transaction.

## Provider Contract

A Provider owns:

- immutable document/room/actor identity and optional app-defined connection
  metadata;
- connect, disconnect, reconnect, destroy, status, and failure observation;
- `sendPublication(publication)` and `onPublication(subscriber)`;
- separate Awareness send, receive, and disconnect notifications;
- wire encoding, transport integrity validation, live-room fanout, and
  acknowledgement.

Provider adapters must detach publication and Awareness values. A subscriber
cannot mutate another participant's copy through a shared object reference.

`MemoryHub` and `MemoryProvider` are live-room reference implementations. They
retain room membership only, never publication history. The sender is not
echoed. A disconnected peer misses publications and reconnect receives only
future live publications.

## App-Owned Remote Processing

`processRemotePublication` is the only semantic handoff. The app owns:

- channel and event selection;
- payload and schema validation;
- permission and authorization decisions;
- domain ordering, last-write-wins, merge, repair, and conflict behavior;
- one remote transaction around the intended publication;
- canonical state-owner application and projection updates;
- snapshot load, missed-change recovery, and backend persistence.

The callback may return `void` or `Promise<void>`. Collaboration waits for its
settlement before reporting the publication outcome or advancing the inbound
FIFO queue; it does not inspect how the app performs that work.

When remote work must stay out of ordinary local undo and must not echo, the app
callback uses its Factory `runRemoteTransaction` boundary. Factory owns that
origin behavior; Collaboration does not infer it from app routes.

## Intentionally Absent Behavior

The package has no:

- Yjs dependency or Y.Doc;
- semantic operation log, replay buffer, or retained publication history;
- state vectors or reconnect synchronization;
- operation envelope/registry;
- dedupe or identity-collision policy;
- timestamp ordering, rebase, or last-write-wins implementation;
- permission or conflict-policy registry;
- collaboration update persistence or TTL cleanup.

Apps and backends remain free to compose these product-specific capabilities
outside Collaboration.

## Awareness

Awareness is actor-scoped, clocked, ephemeral presence. It can represent cursor,
selection, viewport, tool, editing, identity display, or heartbeat state. Leave,
disconnect, and timeout remove remote observations.

Awareness is excluded from Factory `SharedPublication`, canonical state,
save/load, permission, backend persistence, and undo/redo. Canonical element or
vector changes never use Awareness as a transport substitute.

## Public Surface

Composition:

- `createCollaboration(input)`
- `Collaboration`
- `CreateCollaborationInput`
- `CollaborationFactory`
- `ProcessRemotePublication`
- `CollaborationResourceOwnershipMap`
- `CollaborationPublicationOutcome`
- `DisposalError`

Provider:

- `Provider`
- `ProviderIdentity`
- `ProviderStatus`
- `InboundPublication`
- `ProviderFailure` and `PROVIDER_FAILURE_CODES`
- `MemoryHub` and `MemoryProvider`

Awareness:

- `Awareness`
- Awareness state, observation, removal, validation, and Provider message types

## Distribution

The package uses the same TypeScript library build convention as the other
framework packages. `dist/index.js` and `dist/index.d.ts` are its public root
entrypoints. Complete tarball metadata, entrypoint, and clean-consumer
validation remains owned by Framework Release Gate 5 for every published
package.

Runtime transport cloning uses the platform structured-clone contract.
`@asyra/factory` remains the source of publication and Factory types, but
loading the Collaboration package does not activate or load the Factory
runtime. App-supplied Factory composition remains explicit.

## Reference App

Asyra Design supplies a real WebSocket Provider and memory-only reference
server. `fileId` is its public URL identity and maps to document/room identity.
The app owns supported Scene Tree/Props delivery validation and applies each
accepted publication through one Factory remote transaction.

The reference server is public and memory-only. It has no authentication,
permission database, durable snapshot, or missed-publication recovery. Those
remain production app/backend responsibilities.

## Validation

```bash
yarn workspace @asyra/collaboration test:local
yarn workspace @asyra/collaboration build:collaboration
yarn workspace @asyra/collaboration example:collaboration
```

Executable example:
`docs/examples/network-collaboration-transport.mjs`.

Product contract:
`../plans/completed/network-collaboration-transport-plan.md`.

Dedicated Inspector:
`../plans/network-collaboration-transport-flow-inspector.html`.
