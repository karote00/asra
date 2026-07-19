# Yjs Network Collaboration Plan

## Status

Framework Release Gate 2: next after the completed app-level migration pipeline
formalization and closeout. This plan has not started implementation; its
product contract and dedicated Inspector must pass readiness first.

Network collaboration remains unimplemented today, but it is no longer a
post-release deferred capability. The first public Asyra Framework release must
ship the provider-replaceable CRDT foundation and the supported conflict-policy
contract in this plan. Runtime activation remains optional: a canvas tool that
does not need collaboration must not create a Y.Doc, provider, room, awareness
runtime, network connection, or collaboration bundle side effect.

Before implementation begins, create the matching Inspector owner flow and
prove every prerequisite below against current formal contracts. A missing or
unstable prerequisite is repaired inside this release gate before downstream
network work advances.

## Context

Asyra currently provides local collaboration infrastructure:

- one module-level default Yjs document used by the current
  `getYjsDataChannel(...)` helper
- shared data-channel registration by channel name
- local-first transaction recording
- opt-in shared delivery through `options.shared`
- transaction-end buffered delivery
- immediate shared delivery when explicitly requested
- registered shared-channel observers for render/UI/default runtime wiring

The framework does not yet provide a complete network collaboration system.

## Prerequisites

Do not advance from the Release Gate 2 readiness segment until these contracts
are stable:

- authoritative state ownership
- transaction atomicity and rollback
- undo/redo replay origins
- cancel semantics
- local vs remote apply boundaries
- load validation/migration
- selective instance ownership and disposal

Primary completed prerequisite:

`completed/transaction-atomicity-and-rollback-plan.md`

## Goal

Add an optional, provider-replaceable Yjs collaboration layer that transports
committed Asyra changes between peers without making Yjs, transport state, or
render state a second product data authority.

End-state:

- apps opt into collaboration explicitly
- each collaboration/document instance owns its intended Y.Doc/provider state
- local inputs/actions/commands continue through Feature -> API -> State ->
  Render/UI, with transactions guarding the API-to-state mutation boundary
- remote changes pass origin/dedupe/schema/conflict checks before canonical apply
- awareness/presence remains ephemeral and non-authoritative
- server/offline persistence can be composed independently
- local-user undo does not undo remote users' changes
- all peers converge after reconnect and complete update delivery

## Non-Goals

- making one network provider mandatory
- making collaboration a core requirement for non-collaborative apps
- treating presence as persisted document state
- letting remote updates mutate render/UI mirrors without canonical state apply
- replacing app authentication/authorization policy
- implementing app-specific collaboration UI in the framework
- starting this work before local transaction failure semantics are stable

## Canonical Collaboration Flows

### Local intent to network

```text
Any Intent
-> Feature
-> App/Core API
-> Local Transaction
-> State Owner
-> Commit
-> Shared Operation / Yjs Update
-> Provider
-> Server / Peers
```

### Remote update to canonical state

```text
Provider Update
-> Origin / Dedupe / Schema Checks
-> Conflict Policy
-> Remote Apply Transaction
-> State Owner
-> Projections
```

Remote updates are state-application inputs, not new feature decisions.

## Provider Boundary

Define an optional provider adapter contract for:

- connect/disconnect/reconnect
- document/room identity
- authenticated connection metadata
- sync status
- binary update transport
- awareness transport
- provider disposal
- diagnostics

Candidate direction:

```ts
interface CollaborationProvider {
  connect(): Promise<void>
  disconnect(): Promise<void>
  destroy(): Promise<void>
  getStatus(): CollaborationStatus
  onStatusChange(callback: (status: CollaborationStatus) => void): () => void
}
```

Exact APIs remain implementation-owned. The framework contract must permit a
central WebSocket provider, peer-to-peer provider, hosted service, or custom
backend.

## Instance Ownership

- Collaboration is selectively instantiated; consumers do not need an entire
  framework runtime bundle to own another collaboration/document instance.
- A document/collaboration instance must explicitly own or receive its Y.Doc,
  provider, shared-channel registry, and cleanup lifecycle.
- Default singleton collaboration infrastructure may remain as convenience for
  the default runtime path.
- Multiple document instances must not share update history, awareness, room,
  or provider state unless the consumer intentionally wires them together.

## Shared Operation Envelope

When Asyra transports semantic change records, remote-required metadata must be
encoded in the shared payload rather than relying only on local Yjs transaction
origin metadata.

Candidate envelope:

```ts
interface SharedOperationEnvelope<TPayload = unknown> {
  operationId: string
  transactionId: string
  documentId: string
  actorId: string
  schemaVersion: number
  channel: string
  eventName: string
  payload: TPayload
}
```

Required properties:

- deterministic operation identity
- transaction grouping identity
- document and actor ownership
- schema/protocol version
- registered channel/event routing
- typed/validated payload

## Remote Canonical Apply

Remote observers must not stop at render/UI mirror updates.

Required pipeline:

1. receive provider update
2. identify provider/remote origin
3. deduplicate operation IDs
4. validate protocol/schema version
5. validate registered channel/event shape
6. evaluate permission/conflict policy at the owning boundary
7. apply through a remote transaction/apply API
8. update canonical state owners
9. recompute projections
10. prevent remote apply from echoing as a new local operation

Remote apply must be deterministic under duplicate, delayed, and reordered
delivery.

## Origin and Echo Prevention

Define origins at minimum for:

- local user action
- local automation/AI action
- remote provider apply
- undo
- redo
- rollback/compensation
- load/migration

Origin is used to decide:

- whether to append a shared operation
- whether to capture normal local undo
- whether to emit compensation
- whether diagnostics identify local or remote ownership

## Awareness and Presence

Presence is ephemeral and must not become canonical persisted document state.

Suggested awareness fields:

- user identity/display metadata
- cursor/workspace position
- remote selection channels/IDs
- viewport/follow state
- active tool/editing hint
- connection heartbeat/status

Awareness rules:

- remote state is removed on disconnect/timeout
- presence does not participate in normal document undo/redo
- presence cannot authorize a mutation
- Render/UI may project presence without treating it as model truth

## Authentication and Authorization

- Provider connection authenticates the user/session.
- Server/authoritative boundaries validate document-room access.
- Read/write/admin permission is app/server policy, not inferred from awareness.
- Untrusted clients must not gain write authority merely by producing a valid
  Yjs update shape.
- Rejected operations require diagnostics without corrupting the local canonical
  state.

## Persistence and Offline Behavior

The collaboration layer should permit independent composition of:

- browser/offline update persistence
- server update log
- periodic snapshots
- update compaction/garbage-collection policy
- reconnect state-vector/diff synchronization
- version history/recovery

Runtime commit and durable server acknowledgement remain distinct.

## Undo/Redo and Rollback

- Normal user undo tracks only the intended local origin by default.
- Remote operations must not enter another user's ordinary local undo history.
- Rollback before transaction-end shared flush discards pending local operations.
- Immediate shared changes that later roll back require compensating inverse
  operations and may be transiently visible to peers.
- Remote compensation applies through the same origin/dedupe/conflict pipeline.

## Conflict Policy

Yjs/CRDT convergence does not replace application-domain invariants.

Examples requiring explicit policy:

- delete vs concurrent edit
- concurrent reparent
- lock/permission vs offline edit
- property overwrite/merge
- vector point deletion vs concurrent segment creation
- topology repairs and dangling references

Detailed policy registration and deterministic resolution are owned by:

`collaborative-conflict-policies-plan.md`

## Ownership

- `@asyra/factory` or a future optional collaboration package: Y.Doc/channel
  bridge and transaction-origin integration
- provider adapter: network transport and connection state
- server/app: authentication, authorization, room policy, durable backend
- state-owner packages: canonical apply and package-local invariants
- conflict policy registry: domain resolution/repair decisions
- awareness runtime: ephemeral presence
- render/UI: derived collaboration projections only

## Implementation Slices

1. Define collaboration instance/provider ownership and disposal.
2. Define shared operation envelope, protocol version, and origins.
3. Implement remote dedupe/schema validation and echo prevention.
4. Implement remote canonical apply transaction path.
5. Add first replaceable network provider adapter and room/auth handshake.
6. Add awareness/presence transport and cleanup.
7. Add browser offline and server persistence interfaces.
8. Integrate local-only undo and rollback compensation.
9. Implement advanced conflict-policy sub-plan.
10. Add reconnect, convergence, recovery, and load tests.
11. Update public API/package docs only as concrete surfaces land.

## Test Plan

Transport:

- two clients exchange updates and converge
- duplicate, reordered, and delayed updates remain deterministic
- disconnect/reconnect receives only missing updates
- provider disposal stops all transport and awareness observers

Canonical apply:

- remote change updates state owner before Render/UI projection
- invalid schema/version does not mutate canonical state
- remote apply does not echo as a new local operation
- operation dedupe prevents duplicate mutation

Instances:

- two collaboration/document instances remain isolated by default
- intentional shared wiring is explicit and testable
- disposing one instance does not break another

Presence:

- cursor/selection presence appears and updates
- disconnected users are removed
- presence is absent from document save/load and undo history

History and failure:

- local undo does not undo remote operations
- rollback before shared flush sends nothing
- immediate shared rollback emits deterministic compensation
- persistence failure is distinct from runtime/network convergence

Conflict and permissions:

- unauthorized operation is rejected at the owning boundary
- concurrent domain conflicts resolve or repair deterministically
- all peers converge on the same valid canonical state

## Success Criteria

- collaboration is optional and provider-replaceable
- local and remote changes converge without parallel state authority
- remote changes always pass through canonical apply boundaries
- presence remains ephemeral
- multiple collaboration instances are selectively composable and isolated
- undo/rollback/origin behavior is deterministic
- apps can supply authentication, authorization, persistence, and domain policy
  without patching framework internals
- non-collaborative apps retain the current local transaction, persistence,
  render, and package-loading behavior without collaboration activation
- the framework release includes the tested collaboration packages/contracts;
  provider connection and room participation remain explicit app composition

## Assumptions

- This is the second required framework release gate; it starts only after Gate
  1 closes and its local-kernel prerequisites pass the Inspector readiness
  review.
- Existing shared-channel infrastructure is reused where it preserves the target
  ownership and apply rules.
- Exact package/API shape remains open until implementation planning starts.
