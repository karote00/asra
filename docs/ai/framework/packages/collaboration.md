# Collaboration Package

`@asyra/collaboration` is the optional, provider-replaceable transport for
completed Factory `SharedPublication` values and separate ephemeral Awareness.
It is not a document data owner, CRDT store, operation policy engine, or backend.

## Activation and Ownership

An app opts in by explicitly creating `Collaboration` with:

- non-empty `documentId`, `roomId`, and `actorId`;
- an optional neutral `publicationSource.subscribe(...)` source;
- an app-owned `processRemotePublication` callback;
- an optional replaceable `Provider`;
- optional Awareness;
- optional owned/borrowed Provider and Awareness lifecycle choices.

Construction is inert. `start()` binds observers and connects the Provider.
Apps that omit this composition create no room, Provider, Awareness runtime, or
collaboration network side effect. Their ordinary HTTP/load/save behavior is
unchanged.

The deprecated Factory-shaped input remains a compatibility adapter only.
New composition supplies `publicationSource`. An app may wrap the resulting
session in Core's package-neutral collaboration lifecycle when checkpoint load,
Feature initialization, activation, ready, and teardown must share one order;
the generic Collaboration package still has no Core dependency.

Default-created Awareness is owned. Injected Provider and Awareness resources
default to borrowed unless composition says otherwise. `dispose()` detaches
observers, destroys only owned resources, waits for already-started work, and
bypasses queued work that had not started.

## Publication Flow

```text
Factory-owned immutable SharedPublication
-> Collaboration FIFO outbound queue
-> if connected: Provider.sendPublication(the same publication) exactly once
-> Provider-owned bounded capacity and ordered queue position
-> no retained semantic history

transport-owned immutable SharedPublication
-> Provider.onPublication(async consume) once
-> Collaboration processRemotePublication(publication) once
-> app validation and remote transaction
-> app canonical state owners
-> ordinary Render/UI projections
```

One Factory publication remains one canonical publication, one outbound
Provider call, and one receiving app callback. Generic Collaboration consumes
the exact immutable Factory artifact: it does not clone, call `.save()`, rebuild
payloads, or derive another snapshot. It submits publications serially in
canonical FIFO order and does not begin the next send until the current
`sendPublication` Promise settles.

Collaboration preserves publication metadata, delivery order, repeated routes
and payloads, Undo/Redo publications, and compensation publications. It never
splits one publication into per-delivery callbacks. A concrete Provider may
group wire bytes or pipeline encoding internally, but those choices cannot
merge publication identities or change canonical order.

The transported artifact has one exact minimal hierarchy: publication
identity/origin/mode, ordered slices, channel batches, and ordered payload
deliveries. Collaboration accepts and forwards that shape directly. It does
not accept legacy top-level delivery/batch aliases, reconstruct Factory record
evidence, or place inverse/history/rollback data on the wire; only actual
compensation publications retain their correlation ids.

If the Provider is not `connected` when a Factory publication reaches
Collaboration, no send occurs. Collaboration reports one `skipped` local
outcome, retains no replay copy, and reconnect observes only future Factory
publications. A failed active send reports `send-failed` and never
retroactively rolls back an already committed local Factory transaction.

An app that requires disconnected editing or restart recovery must compose its
own publication outbox outside this package. That owner may durably retain the
same immutable Factory publication before live delivery, retransmit the same
publication identity, and remove it after app-defined socket acceptance.
Materialized document snapshots, private History, reconnect cadence,
notifications, conflict policy, and acknowledgement meaning remain app/server
contracts.

The outbound and inbound paths are independent: a slow Provider send does not
block an inbound app callback. The Provider owns exclusive inbound delivery and
does not treat a publication as applied until the callback Promise settles.

## Provider Contract

A Provider owns:

- immutable document/room/actor identity and optional app-defined connection
  metadata;
- connect, disconnect, reconnect, destroy, status, and failure observation;
- `sendPublication(publication: SharedPublication): Promise<void>`;
- one exclusive
  `onPublication(consume: (publication: SharedPublication) => Promise<void>)`
  consumer;
- separate Awareness send, receive, and disconnect notifications;
- bounded provider-owned capacity, queue position, wire encoding, framing,
  transport integrity validation, live-room fanout, and acknowledgement.

`sendPublication` resolves only after the concrete Provider has accepted the
publication into bounded capacity, fixed its ordered queue position, and
assumed delivery ownership. It may wait for capacity and rejects on permanent
transport failure. Resolution does not claim server acceptance, wire
completion, peer apply, durable storage, or backend checkpoint.

The concrete Provider creates or decodes any transport-isolated immutable
publication before invoking its consumer. Generic Collaboration does not clone
the Factory artifact on outbound or the Provider artifact on inbound.
Transport adapters may frame multiple publications together or split bytes
into chunks internally; these are private wire mechanics, not alternate
framework APIs or completion meanings.

`MemoryHub` and `MemoryProvider` are live-room reference implementations. They
retain room membership only and create one detached publication snapshot for
each receiving peer. Their one-slot per-peer capacity waits before accepting a
later publication but never makes the sender's current `sendPublication`
Promise wait for that publication's peer apply. These in-process semantics
validate framework handoff and ordering, not byte encoding or cross-process
isolation. The sender is not echoed. A disconnected peer misses publications
and reconnect receives only future live publications.

## App-Owned Remote Processing

`processRemotePublication(publication)` is the only semantic handoff. It
receives the direct `SharedPublication`, without a generic sender-context
envelope. The app owns:

- channel and event selection;
- payload and schema validation;
- permission and authorization decisions;
- domain ordering, last-write-wins, merge, repair, and conflict behavior;
- one remote transaction around the intended publication;
- canonical state-owner application and projection updates;
- snapshot load, missed-change recovery, and backend persistence.

The callback may complete synchronously or return `Promise<void>`.
Collaboration exposes it to the Provider as one Promise that remains pending
until app work settles. Success reports one `processed` remote outcome.
Rejection reports one `process-failed` outcome, rejects the Provider callback
with the same error, and is never retried by generic Collaboration.

An app-processing rejection is not a `ProviderFailure` and does not enter the
Provider transport-failure stream. `ProviderFailure` remains reserved for
connection, lifecycle, acknowledgement, and transport failures.

Hierarchy publications use this unchanged boundary. Collaboration forwards
`MOVE_ELEMENTS` and `CHANGE_SUBTREE` deliveries in publication order, including
duplicates, but adds no dedupe, timestamp/LWW ordering, convergence registry,
semantic history, or concurrent-parent conflict resolution. The receiving
app/backend must accept, reject, or transform the publication before Scene Tree
performs canonical validation and mutation.

When remote work must stay out of ordinary local undo and must not echo, the app
callback submits its validated canonical slices through the owning runtime
facade. Core then uses its injected Factory remote-transaction boundary.
Factory owns origin behavior; Collaboration does not infer it from app routes.

## Intentionally Absent Behavior

The package has no:

- Yjs dependency or Y.Doc;
- semantic operation log, replay buffer, or retained publication history;
- state vectors or reconnect synchronization;
- operation envelope/registry;
- dedupe or identity-collision policy;
- timestamp ordering, rebase, or last-write-wins implementation;
- permission or conflict-policy registry;
- generic publication retry or reconnect replay;
- generic wire framing, queue-watermark, or send-concurrency policy;
- collaboration update persistence or TTL cleanup.

Apps and backends remain free to compose these product-specific capabilities
outside Collaboration. Such composition does not change the package's own
`skipped`/`send-failed`, no-history, or live-only reconnect semantics.

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
- `CollaborationPublicationSource`
- `CollaborationFactory` (deprecated compatibility input)
- `ProcessRemotePublication`
- `CollaborationResourceOwnershipMap`
- `CollaborationPublicationOutcome`
- `DisposalError`

Provider:

- `Provider`
- `ProviderIdentity`
- `ProviderStatus`
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

`@asyra/factory` remains the source of the immutable publication artifact and
Factory types. Generic Collaboration forwards that artifact without cloning;
real transport adapters own serialization and receive-side isolation. Loading
the Collaboration package does not activate or load the Factory runtime.
App-supplied publication-source composition remains explicit.

## Reference App

Asyra Design supplies a real WebSocket Provider, socket sequencer, App-owned
IndexedDB recovery outbox, and materializing backend. `fileId` is its public
URL identity and maps to document/room identity. The App owns supported Scene
Tree/Props delivery validation and applies each accepted publication through
one Factory remote transaction.

The repository server has no authentication or permission database. It reads
and writes checkpoints through the configured App backend, sequences accepted
publications, retains the not-yet-durable in-memory tail, and flushes one fixed
three-second ordered batch. The public frontend deployment does not deploy
those services; it remains locally editable and reports the disconnected
transition once.

This App composition does not move persistence policy into the generic
package: Collaboration still transports the existing `SharedPublication` and
Awareness only. Checkpoint/tail handshake, outbox recovery, sequencing,
batching, and durability are Asyra Design boundaries.

Target authority:
`../../apps/asyra-design/specs/socket-authoritative-document-session.md`.

## Validation

```bash
yarn workspace @asyra/collaboration test:local
yarn workspace @asyra/collaboration build:collaboration
yarn workspace @asyra/collaboration example:collaboration
```

Executable example:
`docs/public/build/collaboration.md`.

Product contract:
`../plans/completed/canonical-projection-and-collaboration-contract-realignment-plan.md`.

Active Inspector:
`../plans/canonical-projection-and-collaboration-contract-flow-inspector.html`
with executable data in
`../plans/canonical-projection-and-collaboration-contract-flow-inspector.data.cjs`.

The completed network-collaboration transport plan and its Inspector are
historical implementation evidence only; they are not current Provider contract
authority.
