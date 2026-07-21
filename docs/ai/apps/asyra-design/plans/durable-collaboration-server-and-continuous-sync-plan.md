# Asyra Design Durable Collaboration Server and Continuous Sync Plan

## Status

Queued as the next Asyra Design app/server implementation stage after the
current Yjs network collaboration Gate 2 changes are reviewed, staged, and
committed.

This is an app-owned reference implementation plan. It does not make durable
CRDT transport a framework requirement, expand the current uncommitted Gate 2
implementation, or close, archive, or renumber any framework release gate.
When the user starts this plan, the first segment must create and validate its
matching Inspector owner flow; after readiness passes, implementation proceeds
through the ordered slices below without another report-only planning pause.

## Decision

When Asyra Design selects collaboration for a file, that file uses one
collaboration write path from open to close, regardless of whether one or many
users are currently connected.

```text
Feature / app API
-> canonical transaction and state owner
-> one action publication
-> one Yjs update
-> WebSocket provider
-> durable server append
-> durable acknowledgement
```

Within that selected collaborative mode, peer count must never switch the file
between an HTTP document-mutation path and a CRDT document-mutation path.
Presence is an observation produced after connection, not an activation
signal. A URL or file record without a collaboration `fileId` may remain
explicitly local-only or use an app-owned HTTP persistence provider; a file
whose app composition selects collaboration connects and synchronizes even
when its opener is the only participant.

For Asyra Design's collaborative mode, HTTP APIs may own file creation,
listing, metadata, sharing, permission management, export, and administrative
operations. They must not become a second document-content mutation path just
because the collaborative file temporarily has one user.

## Framework and App Composition Boundary

The framework owns the canonical mutation and persistence extension points; it
does not choose an app's network transport. Every app mutation begins through
the same product path:

```text
Input -> Feature -> app/common API -> transaction -> canonical state owner
```

After canonical commit, the app-selected composition determines whether and
where data leaves the process:

| App composition           | Load path                                                                                     | Commit/output path                                                                                                                                                         | Collaboration side effects                                 |
| ------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Local-only                | App-selected `IPersistenceProvider.load()`, such as localStorage, IndexedDB, or a file        | Core captures the committed canonical snapshot and serially calls `IPersistenceProvider.save(...)`                                                                         | None                                                       |
| Non-collaborative backend | App-owned HTTP-backed `IPersistenceProvider.load()`                                           | Core captures the committed canonical snapshot and serially calls the provider's HTTP-backed `save(...)`                                                                   | None; no Y.Doc, room, Awareness, or collaboration provider |
| Collaborative             | Explicit app-owned `@asyra/collaboration` composition performs recovery and state-vector sync | Factory action publication -> Yjs update -> app-owned Provider; Core persistence, when also configured, remains a separate cache/snapshot policy and not convergence proof | Only the explicitly created collaboration instance         |

An app that does not want CRDT therefore implements `IPersistenceProvider`
with ordinary HTTP `load`, `save`, and `clear` operations and never imports or
creates `@asyra/collaboration`. Core already owns snapshot capture, serial save
ordering, load migration/validation, and persistence status reporting.

Factory shared channels remain delivery-only local channels when no
collaboration instance subscribes. `shared` or `sharedDelivery` metadata does
not create Yjs or network activity by itself.

The app must select its composition from product/file policy before editing.
The framework must not inspect peer count, silently switch transports, or
require collaboration to use remote persistence.

## Current Baseline

- `@asyra/collaboration` already owns provider-neutral Y.Doc composition,
  action-update production, state-vector exchange, reconnect, update
  persistence interfaces, and distinct durability outcomes.
- One Factory action publication already produces one Yjs update and one
  provider `sendUpdate(...)` call.
- `ProviderAcknowledgement` already identifies a durable operation by
  `operationId`.
- Asyra Design already owns one typed browser/server WebSocket protocol and a
  real public-room reference server.
- The reference server currently stores room history only in `MemoryHub`.
  Restarting the process loses every room, update, and synchronization state.
- The current public reference intentionally has no authentication,
  authorization lookup, durable history, tenancy, abuse controls, or
  production deployment hardening.
- Core already accepts a replaceable `IPersistenceProvider`; a non-CRDT app can
  use an HTTP implementation without changing Feature, transaction, state
  owner, Render, or UI behavior.

The next stage extends this baseline. It must not replace the existing
collaboration pipeline or create a second normalized document authority.

## Goal

Provide a real, open-source durable Asyra Design collaboration server for the
app's explicitly selected collaborative mode. It must be easy to run locally,
straightforward to deploy as one service, and replaceable when an app needs a
different database or server topology.

The completed stage must provide:

- immediate collaboration connection for every opened collaborative file;
- durable append of every accepted action update before acknowledgement;
- restart recovery from stored Yjs history;
- late-join and reconnect synchronization by state vector;
- idempotent retry behavior;
- crash-safe snapshot and update-log compaction;
- one real SQLite-backed reference store behind an app/server-owned storage
  contract;
- explicit failure behavior without silently falling back to memory-only or
  HTTP document mutation.

Persisted Yjs snapshots and update history are backend collaboration data.
They transport and recover canonical app operations but do not replace Scene
Tree, Props Manager, or another registered state owner as the authority that
validates and applies product semantics.

## Ownership

### Framework-neutral mutation and persistence

- Feature/app APIs, transactions, and canonical state owners remain the one
  product mutation path in every app composition;
- Core continues to load and serially persist committed snapshots through the
  app-injected `IPersistenceProvider`;
- an app may implement that provider with HTTP and omit collaboration
  completely;
- Factory local shared delivery creates no Y.Doc or network connection;
- framework packages do not depend on Asyra Design's WebSocket server, SQLite
  store, `fileId` convention, or fixed-connection policy.

### `@asyra/collaboration`

- remains optional and retains the existing public `Provider`, state-vector,
  operation envelope,
  inbound validation, canonical apply, awareness, and durability contracts;
- continues to map one action publication to one binary Yjs update;
- does not import SQLite, HTTP, WebSocket server, authentication, or app
  storage code;
- changes only when formal implementation evidence proves that the current
  provider-neutral contract cannot represent required durable behavior.

### Asyra Design browser composition

- decides whether the current file uses local persistence, an app-owned HTTP
  persistence provider, or collaboration from product/file policy, never from
  current participant count;
- uses a stable `fileId` only for the selected collaboration path;
- connects and completes initial recovery/state-vector synchronization before
  collaborative document editing is enabled;
- exposes connection, synchronization, retry, and failure status without
  fabricating local durability;
- keeps every collaborative document mutation on the existing Factory -> Yjs
  -> Provider path.

### Asyra Design collaboration server

- validates the app-owned wire protocol and accepted connection identity;
- serializes room ingestion per `fileId` while allowing independent files to
  progress independently;
- stages and validates an update before it can change durable or live room
  history;
- durably stores accepted live and synchronization updates;
- reconstructs a room Y.Doc from its stored snapshot plus ordered update tail;
- broadcasts only accepted durable input;
- sends `durable` acknowledgement only after storage commit succeeds;
- owns server restart recovery, snapshot/compaction coordination, health, and
  operational failure reporting.

### Durable update store

- is an app/server-owned interface, not a framework package dependency;
- has a real SQLite reference implementation suitable for local development
  and a single-node deployment;
- stores binary values without interpreting app entity, property, geometry, or
  feature semantics;
- allows a future PostgreSQL, object-store, hosted Yjs, or other implementation
  without changing the browser `Provider` contract.

### App/backend APIs

- may be the complete non-collaborative persistence implementation through an
  app-owned HTTP `IPersistenceProvider`;
- in collaborative mode, may own file metadata, public/private policy,
  authentication, permission, export, and administrative operations;
- do not bypass the selected collaboration path for document-content writes
  while a collaborative file happens to have one connected user.

## Durable Storage Contract

The exact TypeScript names and database schema must be finalized by the
Inspector before implementation, but the owner contract must support these
operations:

- open or reconstruct one file history;
- append one accepted live action update with its `fileId`, `operationId`,
  binary update, and monotonic file sequence;
- append an accepted state-vector synchronization upload without pretending
  that the aggregate has one authenticated operation author;
- detect an identical `operationId` retry and return its existing durable
  result without a second append or broadcast;
- reject an `operationId` collision whose stored update differs;
- load one committed snapshot and every later update in sequence order;
- atomically install a compacted snapshot at one high-water sequence;
- delete only update records covered by that committed snapshot;
- close the database cleanly and surface open, read, write, corruption, and
  compaction failures.

The SQLite reference schema must preserve, at minimum:

- one stable file identity;
- ordered update sequence;
- optional live-action `operationId` and a uniqueness boundary scoped to the
  file;
- immutable binary update bytes;
- snapshot bytes and their covered high-water sequence;
- timestamps or equivalent operational evidence needed for diagnosis and
  maintenance, never for product conflict semantics.

An implementation may use a content digest to suppress an identical aggregate
sync upload, but that digest is storage idempotency evidence only. It cannot
replace operation identity, Yjs state vectors, or app conflict policy.

## Canonical Server Flows

### Collaborative file open

```text
fileId resolved
-> WebSocket handshake and current public access policy
-> load snapshot + ordered update tail
-> reconstruct server room Y.Doc
-> exchange client/server state vectors
-> durably accept any missing client update
-> apply missing server update on the client
-> mark synchronized
-> enable collaborative document editing
```

Opening a collaborative file must not briefly expose an editable canvas before
the collaboration subscription and initial synchronization boundary are ready.
Connection or recovery failure remains visible and retryable; it must not
silently turn the file into an HTTP- or memory-only editing session.

### Live action update

```text
one client action publication
-> one provider update
-> protocol and actor validation
-> detached Yjs append validation
-> per-file ordered durable append
-> integrate live room Y.Doc
-> broadcast to peers
-> durable acknowledgement to sender
```

The server may acknowledge an identical already-durable retry without
rebroadcasting it. Storage failure produces no durable acknowledgement and no
peer broadcast. The sender's already committed local runtime state remains
committed and receives the existing network/durability failure outcome.

### Restart, reconnect, and late join

```text
server process starts or file is first requested
-> open SQLite store
-> load latest committed snapshot
-> apply ordered tail updates
-> recreate room Y.Doc
-> answer state-vector exchange with only missing Yjs state
```

A process crash after durable append but before broadcast is recovered by the
next state-vector exchange. Clients must not depend on an in-memory broadcast
as proof of durability.

### Snapshot and compaction

```text
capture one room high-water sequence
-> encode equivalent Yjs state
-> atomically persist snapshot + high-water sequence
-> commit
-> remove only covered tail records
```

New appends after the captured high-water sequence remain in the tail.
Compaction timing and thresholds are operational configuration, not product
semantics. The compacted snapshot plus remaining tail must produce the exact
same Yjs state vector and missing-update behavior as the uncompacted history.

## Awareness and Other Ephemeral State

- Awareness remains live, optional, and non-authoritative.
- Cursor, selection, viewport, tool, heartbeat, and disconnect observations
  are never written to the durable update store or snapshots.
- Restart clears Awareness and clients republish it after reconnect.
- Peer count may be observed for UI or operations, but cannot change the
  document mutation pipeline.

## Public Reference and Extension Boundary

- `collaboration:server` remains the supported command for the open-source
  reference service and starts the durable implementation after this plan is
  complete.
- The SQLite database location and compaction settings are explicit server
  configuration. Tests use project-owned temporary paths and clean only those
  exact paths.
- The health contract reports storage readiness and durable capability rather
  than claiming durability from process memory.
- The existing typed WebSocket protocol remains the starting contract. Protocol
  additions must be versioned or fail closed and must not duplicate framework
  operation fields without a transport need.
- The reference remains public-by-`fileId` unless a separate authentication and
  permission plan is approved. Public access must be stated clearly; no fake
  user validation or placeholder permission success is added.
- Framework documentation must preserve the separate non-collaboration route:
  app-owned HTTP persistence through `IPersistenceProvider` with no
  collaboration import, Y.Doc, room, or WebSocket requirement.

## Unsupported and Deferred Behavior

- switching one Asyra Design collaborative file between HTTP and CRDT according
  to peer count;
- full authentication, account sessions, file permission lookup, tenancy, and
  permission revocation;
- multi-region or active-active server deployment;
- distributed locking or cross-process room coordination;
- a normalized SQL copy of Scene Tree or Props data as another write
  authority;
- query-oriented materialized views of app document content;
- persisted Awareness;
- server-side app conflict decisions not explicitly registered at the existing
  collaboration boundary;
- automatic data-loss fallback to `MemoryHub` when durable storage fails.

An independently developed app that intentionally chooses HTTP persistence
without collaboration is supported by existing framework contracts and is not
part of this unsupported list. This plan does not implement a universal HTTP
backend because endpoint shape, authentication, document identity, and storage
policy belong to each app.

These require separate contracts. The storage and provider boundaries must
remain replaceable so they can be added without rewriting document mutation.

## Formal Product Cases

- one user opens a collaborative file, edits alone, closes, restarts the
  server, and recovers the exact document through the collaboration path;
- a second user joins after prior edits and receives the exact missing state;
- two and three clients converge through ordinary live actions;
- same `fileId` shares one durable history while different file ids remain
  isolated;
- an identical live update retry is acknowledged once without a duplicate
  append or peer mutation;
- an `operationId` collision with different bytes is rejected;
- an accepted sync upload survives restart and participates in later
  state-vector exchange;
- storage append failure causes no acknowledgement or broadcast and is exposed
  through the existing provider failure/durability surface;
- a crash after durable append but before broadcast converges after reconnect;
- snapshot plus tail is byte-state equivalent to uncompacted history for state
  vector and missing-update results;
- concurrent append during compaction remains in the tail and is not deleted;
- corrupt or unreadable stored history fails closed instead of creating an
  empty room over existing data;
- Awareness is absent after restart until peers publish it again and is never
  present in SQLite history;
- a URL without `fileId` retains the documented local-only path and creates no
  collaboration database record;
- a non-collaborative app composition can load and save through an HTTP-backed
  `IPersistenceProvider` without importing collaboration or creating Yjs,
  room, Awareness, or WebSocket state;
- collaborative editing cannot begin before initial subscription and sync are
  ready.

## Ordered Implementation Slices

1. Inspector readiness
   - create the product-flow Inspector for app mode selection, collaboration
     activation, room recovery, durable append, broadcast/acknowledgement,
     reconnect, and compaction;
   - record the existing HTTP `IPersistenceProvider` route as a bypass that
     never enters collaboration owners;
   - resolve every implementation boundary, failure owner, route, artifact,
     bypass, and formal test before production edits.
2. Durable store contract and SQLite adapter
   - add failing contract tests first for append, replay, idempotency,
     collision, failure, close, and restart;
   - implement the replaceable store and real SQLite adapter without importing
     it into `@asyra/collaboration`.
3. Durable room recovery and synchronization
   - replace process-memory history authority with snapshot-plus-tail room
     reconstruction;
   - prove state-vector late join, reconnect, sync upload, and room isolation.
4. Persist-before-broadcast and acknowledgement
   - make live update ingestion fail closed before room integration;
   - acknowledge only durable commits and preserve existing client durability
     outcomes.
5. Collaborative startup readiness
   - keep `fileId` as the explicit activation identity;
   - connect and synchronize before enabling collaborative mutations;
   - expose failure and retry without a single-user API mutation mode.
6. Snapshot and compaction
   - add exact equivalence and concurrent-tail tests before implementing
     compaction;
   - keep thresholds configurable and outside product semantics.
7. Public workflow and deployment documentation
   - document database configuration, backup/restore, compaction, health,
     public-access limits, extension boundaries, and manual restart testing.
   - document the framework-neutral HTTP persistence composition separately
     from Asyra Design's selected CRDT server path.
8. Full validation and user review
   - run focused storage/server/provider tests, app integration, collaboration
     E2E with process restart, package tests, root tests, dependency validation,
     lint, production builds, and diff checks;
   - notify the user for review without committing or pushing unless requested.

Each implementation slice follows the Inspector Step Execution Rule. A bug or
missing enforcement requires a failing formal test before its production fix.

## Stop Conditions

Stop and request a decision instead of silently changing scope when:

- the selected Asyra Design collaborative mode requires a second
  document-content write path;
- durable acknowledgement cannot be tied to committed storage;
- the selected Node 20-compatible SQLite dependency cannot pass repository
  license, clean-install, build, and CI requirements;
- cross-process or multi-region coordination becomes required;
- authentication or authorization semantics are required to judge storage
  correctness;
- compaction cannot prove exact state-vector equivalence;
- current Gate 2 public contracts must change beyond a demonstrated missing
  durable capability;
- the current uncommitted Gate 2 work has not yet been reviewed and committed.

## Definition of Done

- current Gate 2 work is committed before this plan's implementation begins;
- the dedicated Inspector and product contract agree and pass their formal
  contract tests;
- collaborative files connect regardless of peer count and have no HTTP
  document-mutation fallback;
- framework users can still select an HTTP-backed `IPersistenceProvider`
  without importing or activating collaboration;
- every accepted action update is durable before acknowledgement;
- restart, late join, retry, sync upload, collision, failure, room isolation,
  and compaction cases pass formal tests;
- the SQLite reference is real, documented, replaceable, and produces no
  silent memory fallback;
- Awareness remains absent from durable storage;
- the public reference command, health contract, environment configuration,
  backup/restore guidance, and deployment boundary are documented;
- affected package/app tests, collaboration E2E restart cases, root tests,
  TypeScript, dependency validation, lint, builds, examples, and diff checks
  pass;
- the user reviews the completed stage before any commit, push, release, or
  plan closeout.
