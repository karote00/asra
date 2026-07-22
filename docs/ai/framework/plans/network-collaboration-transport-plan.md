# Network Collaboration Transport Plan

## Status

Framework Release Gate 2 is active. The former Yjs operation-log design is
superseded by this transport-only contract because application publications,
not a framework-owned CRDT history, are the canonical unit of collaboration.

This plan remains active until the user explicitly closes Release Gate 2. A
passing implementation or review does not authorize beginning the next gate.

## Goal

Provide an optional, provider-replaceable collaboration transport that carries
completed Factory shared publications between live peers without deciding what
application data means, retaining semantic operation history, or becoming a
second state authority.

Apps that do not create a collaboration instance keep using their own ordinary
HTTP/load/save path and incur no collaboration runtime or network side effect.

## Product Contract

### Supported behavior

- Collaboration starts only after an app explicitly creates and starts one
  `@asyra/collaboration` instance. Construction itself is inert.
- A collaboration instance owns one document/room/actor identity, an optional
  replaceable Provider, optional Awareness, and explicit owned/borrowed
  lifecycle semantics for injected resources.
- Factory `SharedPublication` is the transport unit. Its publication metadata,
  delivery order, repeated routes, repeated payloads, undo/redo deliveries, and
  compensation deliveries are forwarded without semantic filtering.
- Every local Factory publication maps to at most one Provider send. The
  Provider preserves send order for one connection and settles the send only
  after its transport acknowledgement succeeds or fails.
- After a send settles, Collaboration retains no semantic publication history.
  It owns no operation log, replay buffer, state vector, dedupe registry,
  conflict registry, permission registry, or canonical document copy.
- An inbound publication is delivered once to the app callback in Provider
  arrival order. Collaboration does not reorder, deduplicate, merge, repair,
  accept, or reject application meaning.
- The app callback owns payload/route/schema validation, permission and domain
  policy, remote transaction boundaries, canonical state-owner apply, and
  projection updates. Those concerns may be composed by an app or backend but
  are not collaboration-framework behavior.
- The app callback must use the app's remote transaction boundary when remote
  changes must avoid local undo history and network echo. Factory remains the
  owner of remote-origin echo suppression.
- Provider reconnect restores a live connection only. A publication missed
  while disconnected is not replayed by Collaboration. Loading a canonical
  snapshot, asking a backend for missed domain changes, or replacing current
  state is an app/backend responsibility.
- Provider implementations reject incomplete Factory publication/delivery
  metadata and values that JSON cannot preserve without change. This is a wire
  integrity boundary only; it must not interpret an app
  route, payload, event order, timestamp, entity, geometry, hierarchy, or
  conflict.
- Awareness is a separate ephemeral observational route. It is never document
  data, permission, canonical state, undo history, or a substitute for element
  updates.
- Disconnect and dispose detach observers. Owned Provider/Awareness resources
  are destroyed; borrowed resources are not.
- Provider failures and connection status are observable. A failed network
  send does not retroactively roll back a local Factory transaction.

### Explicitly unsupported framework behavior

The collaboration framework does not provide:

- a Y.Doc or another permanent semantic operation log
- state-vector synchronization or framework history replay
- duplicate-operation detection or publication identity collision policy
- timestamp ordering, last-write-wins, late-message insertion, rebase, or
  compensating history reconstruction
- app payload schemas, operation registries, permission policy, or domain
  conflict policy
- backend snapshots, durable database persistence, authentication, or
  authorization
- TTL cleanup for already acknowledged publications

An app or backend may implement any of these outside the framework when its
product contract requires them.

## Public Input and Output Contracts

### Composition input

The collaboration composition receives:

- non-empty `documentId`, `roomId`, and `actorId`
- a Factory-facing source that subscribes to completed `SharedPublication`
- an app callback that processes each inbound `SharedPublication`
- an optional replaceable Provider
- optional Awareness
- explicit owned/borrowed resource choices

### Provider input and output

A Provider supplies:

- identity and connection lifecycle/status
- `sendPublication(publication)` with Promise settlement as the send
  acknowledgement boundary
- `onPublication(subscriber)` for live inbound publications
- separate Awareness send/observe/disconnect methods
- failure observation

Provider publication payloads are detached values. A sender or receiver cannot
mutate another participant's copy through shared object references.

### App callback

The inbound callback receives the exact detached publication and optional
transport context such as the authenticated sender actor ID. Collaboration
does not call the app once per delivery and does not split one publication into
multiple remote transactions.

## Canonical Flow

1. The app explicitly composes and starts Collaboration.
2. Factory finishes one shared publication according to its immediate or
   transaction-end rules.
3. Collaboration passes that publication to Provider exactly once and in
   publication order.
4. Provider transports it to currently connected peers and acknowledges the
   send; sender-side Collaboration then retains nothing about that publication.
5. A receiving Provider emits one detached publication.
6. Collaboration calls the app's inbound publication callback once.
7. The app validates and applies all deliveries through its own remote
   transaction and canonical state owners.
8. Canonical projections update through the app's ordinary pipeline.

Awareness follows a separate observational route from steps 2–8.

## Representative Product Cases

### Collaboration disabled

- An app that does not compose Collaboration creates no Provider, room,
  Awareness runtime, or connection.
- Its HTTP/load/save behavior is unchanged.

### Live two-client publication

- Client A publishes one Factory publication containing one or many ordered
  deliveries.
- Provider sends one publication.
- Client B receives one detached publication and invokes its app callback once.
- Client B's app applies it through one remote transaction without echo.

### Repeated application intent

- Publications or deliveries with repeated routes and equal payload values are
  all forwarded in their original order.
- Collaboration does not treat repetition as duplication.

### Undo, redo, and compensation

- Factory-produced undo, redo, or compensation publications use the same
  Provider path as ordinary forward publications.
- Collaboration requires no feature-specific `immediate` exception and does
  not inspect the semantic reason for the publication.

### Disconnect and reconnect

- A disconnected peer receives no live publications.
- Reconnect rejoins the live room but does not request or replay missed
  publications.
- The app/backend decides whether and how to refresh canonical state.

### Invalid wire input

- Protocol messages with incomplete Factory transport metadata or values that
  JSON would omit or change are rejected before send or before the app callback.
- A valid but unsupported app route reaches the app callback; the app owns that
  rejection.

### Awareness

- Presence can update, leave, expire, and clear on disconnect.
- Removing all Awareness state leaves canonical document state unchanged.

## Ownership and Forbidden Boundaries

- `@asyra/factory` owns local transactions, undo/redo, shared publication
  formation, remote-origin echo suppression, and local delivery ordering.
- `@asyra/collaboration` owns explicit composition, FIFO handoff, Provider
  lifecycle, send settlement, inbound callback delivery, and Awareness
  lifecycle.
- Provider adapters own wire encoding, connection transport, live-room fanout,
  acknowledgement, and transport integrity checks.
- Apps own which channels participate, app payload validation, remote
  transactions, canonical apply, and presentation.
- App/backend services own authentication, authorization, snapshots,
  persistence, recovery, domain ordering, and conflict decisions.
- Render/UI remain projections and never become collaboration authority.

Framework Collaboration must not import or encode state-owner-specific scene,
props, vector, geometry, hierarchy, permission, or conflict logic.

## Test Plan

- disabled composition has no connection side effect
- one local publication causes one Provider send
- multi-delivery publication stays intact and ordered
- repeated equal publications are both transported
- inbound publication calls the app once and does not echo
- disconnected peers miss publications and reconnect receives only future ones
- no public or private Y.Doc, state-vector, persistence, dedupe, permission, or
  conflict-policy surface remains
- Provider lifecycle, failure, detachment, and owned/borrowed disposal pass
- Awareness remains separate and ephemeral
- Asyra Design's real WebSocket reference transports create, update, delete,
  undo, redo, vector, and compensation publications through app-owned canonical
  apply

## Definition of Done

- The public collaboration API expresses only the supported transport contract.
- `@asyra/collaboration` has no Yjs dependency or semantic history store.
- Memory and WebSocket Providers fan out only to currently connected peers.
- Reconnect has no state-vector or history-replay request.
- App-owned validation and canonical apply are outside the package.
- Current package, app, Inspector, documentation-example, and browser tests
  prove the representative cases.
- TypeScript, tests, lint, and production builds pass.
- A bounded diff/direct-consumer review finds no remaining old-contract path.

## Assumptions

- WebSocket preserves message order on one connection. Cross-connection or
  backend domain ordering is outside this framework contract.
- Provider acknowledgement means the configured transport accepted the send;
  it does not imply durable database persistence unless an app-specific
  Provider explicitly defines and documents that stronger contract.
