# Yjs Network Collaboration Plan

## Status

Framework Release Gate 2: active after the completed app-level migration
pipeline formalization and closeout. The product contract and dedicated
Inspector passed readiness before production implementation began. The local
implementation now covers the owner steps below and is undergoing full gate and
dual-review validation.

This plan remains active. Implementation-ready or review-ready status does not
authorize moving it to `completed`, removing it from `PLANS.md`, declaring Gate
2 closed, or beginning Gate 3 closeout. Only the user may direct those actions.

The first public Asyra Framework release must ship this provider-replaceable
CRDT foundation and conflict-policy contract. Runtime activation remains
optional: a canvas tool that does not need collaboration must not create a
Y.Doc, provider, room, Awareness runtime, network connection, or collaboration
bundle side effect.

## Context

At the start of this gate, Asyra provided local collaboration infrastructure:

- one module-level default Yjs document used by the current
  `getYjsDataChannel(...)` helper
- shared data-channel registration by channel name
- local-first transaction recording
- opt-in shared delivery through `options.shared`
- transaction-end buffered delivery
- immediate shared delivery when explicitly requested
- registered shared-channel observers for render/UI/default runtime wiring

The first implemented owner step replaced the module-level Y.Doc convenience
with Factory-owned delivery-only local channels and detached shared-delivery
metadata. This preserves local projection, buffering, rollback, undo/redo, and
instance registry behavior while ensuring non-collaborative startup creates no
Y.Doc. Network Yjs ownership now belongs exclusively to the explicit optional
collaboration composition defined by this plan.

The optional collaboration package now composes the previously local-only
prerequisites into the network flow specified below. Gate validation and review
remain required before any closeout decision.

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

## Release-Gate Product Contract

### Supported behavior

- Collaboration is activated only by explicitly creating a collaboration
  instance from the optional `@asyra/collaboration` package. Core, Factory,
  Preset, Persistence, and non-collaborative app startup do not import or
  instantiate that package.
- A collaboration instance owns or receives one Y.Doc, one replaceable
  provider, one Factory-backed shared-channel registry, one document/room
  identity, one awareness runtime, and one disposal lifecycle. Injected
  resources have explicit borrowed/owned disposal semantics.
- Instance construction is inert: it validates and retains resources without
  subscribing, recovering, connecting, or sending. Explicit `start()` activates
  observers and durability acknowledgement tracking.
- Provider-less composition is supported for an explicitly created offline
  collaboration instance. An app that does not create the instance has no
  Y.Doc, provider, room, awareness, network, or collaboration persistence side
  effect.
- Local committed shared changes are transported as validated semantic
  operation envelopes after the ordinary local state-owner transaction. Yjs
  update state, provider connection state, awareness, Render, and UI are never
  canonical document owners.
- Provider updates enter one inbound pipeline in this order: decode and origin
  classification, operation-id dedupe, protocol/schema and registered
  channel/event payload validation, app/server permission, framework/app
  conflict policy, remote transaction, canonical state-owner apply, then
  projections. Decode stages untrusted binary first, so malformed,
  non-operation, non-append, or undecodable updates leave the owned Y.Doc
  unchanged. A throwing registered validator rejects only its operation and
  cannot abort later operations decoded from the same update.
- Duplicate, delayed, reordered, and replayed envelopes have deterministic
  accept, repair, reject, or duplicate outcomes. An operation-id replay with a
  different envelope is rejected as an identity collision.
- Remote canonical apply is non-undoable in the receiving user's ordinary
  local history, is always rollbackable even when a handler requests otherwise,
  and never emits a new local network operation. Reactive transaction calls
  inside the handler are routed to the instance's intended Factory. Local user
  undo and redo may emit their own inverse/forward operations.
- Transaction-end rollback discards unflushed shared changes. A delivered
  immediate change produces one linked compensation operation; that operation
  re-enters the ordinary remote origin, dedupe, validation, permission,
  conflict, and canonical-apply pipeline at peers.
- Awareness is a separate ephemeral observational route. It is excluded from
  Y.Doc document operations, Core save/load, collaboration update persistence,
  and ordinary undo/redo; it grants no mutation permission and can be removed
  on disconnect or timeout. Its nested records follow the same inert-data
  boundary as operation payloads.
- Provider transport, local/offline collaboration update persistence, runtime
  commit, network send/convergence, and durable server acknowledgement are
  separate observable states. Failure in a later state does not retroactively
  roll back an already committed local transaction.
- Reconnect exchanges Yjs state vectors and only missing updates. Isolated
  instances share nothing by default; intentional shared Y.Doc/provider wiring
  is explicit.

### Public input and output contracts

- Collaboration composition input includes document id, room id, actor id,
  intended Factory/shared registry, registered channel/event payload
  validators and canonical apply handlers, permission policy, optional
  conflict policies, optional provider, optional persistence adapter, optional
  Y.Doc/awareness runtime, and explicit resource ownership.
  Canonical apply handlers are registered through
  `defineCanonicalOperationApply(...)` and are synchronous: `void` or `true`
  means applied, while `false` means a semantic no-op. TypeScript rejects a
  Promise-returning handler, a native async handler is rejected before
  invocation, and any runtime thenable that escapes those trusted-registration
  checks fails closed through the rollbackable remote transaction.
- The stable shared operation envelope includes operation id, transaction id,
  document id, actor id, protocol version, schema version, origin, channel,
  event name, typed/validated payload, and an optional compensated operation id.
  Inbound records are inert JSON data: accessors are rejected without execution
  and prototype-named keys remain own data properties.
- The provider adapter exposes connection lifecycle/status, room/auth
  composition, binary update send/receive, state-vector synchronization,
  awareness send/receive, durable acknowledgement observation, and disposal.
  A live inbound update may carry an authenticated operation author, which must
  match the envelope actor. Multi-author state-vector aggregates omit that
  field and rely on the app/server-validated history boundary.
- Remote processing returns an immutable outcome identifying duplicate,
  accepted, repaired, rejected, or apply-failed behavior and the owner/code of
  any failure. Diagnostics observe this outcome but cannot repair it.
- Conflict policy returns accept, repair, reject, or not-applicable before the
  remote transaction begins. A repair produces another schema-valid operation
  payload; rejection produces no canonical mutation.

### Ownership and forbidden boundaries

- `@asyra/collaboration` owns opt-in Y.Doc/provider/awareness/update-persistence
  composition, the shared envelope, inbound pipeline, dedupe, provider-neutral
  lifecycle, and conflict-policy registry. It does not own app authentication,
  durable backend room policy, or package canonical state.
- `@asyra/factory` remains the one local transaction/history/shared-settlement
  owner and exposes committed local shared deliveries with transaction/origin
  metadata. Its default local projection channels must not require a Y.Doc.
- State-owner packages own canonical apply and package invariants. Apps supply
  app-domain permission and conflict extensions through the public
  collaboration boundary.
- `@asyra/core` keeps document persistence acknowledgement separate and does
  not import or re-export the optional collaboration runtime.
- Render/UI consume canonical state and ephemeral awareness projections only.
  They cannot accept, repair, reject, authorize, or apply a document operation.
- No provider implementation, Y.Doc content, operation log, awareness map,
  diagnostic record, or persistence acknowledgement may become a parallel
  canonical document state, transaction owner, or undo authority.

### Representative product cases

- disabled collaboration; explicit provider-less composition; provider
  connect, disconnect, reconnect, connection failure, acknowledgement failure,
  and disposal;
- two-client convergence; duplicate, delayed, reordered, and replayed update;
  invalid protocol/schema, invalid channel/event payload, unauthorized and
  unsupported operation, remote apply failure, and echo prevention;
- local-user-only undo; rollback before shared flush; immediate-send rollback
  compensation;
- awareness update, timeout/disconnect cleanup, save/load exclusion, update
  persistence exclusion, and undo exclusion;
- offline recovery and state-vector missing-update synchronization;
- independent instance isolation, explicit shared wiring, and disposing one
  instance without affecting another;
- deterministic conflict accept, repair, and reject; framework-owned invariant
  rejection/repair; app-owned domain policy extension.

### Bounded definition of done

- The dedicated Yjs Network Collaboration Inspector has complete owner fields,
  resolved routes/artifacts, the separate awareness route, no retained cache
  dimensions without profiling, and formal contract tests.
- Non-collaborative Core/Preset startup formally proves that it creates no
  Y.Doc or collaboration side effect.
- Formal package and integration tests cover every representative product case
  above, including local transaction/shared-delivery regressions.
- The optional package, affected packages, root tests, dependency validation,
  lint, production build, `git diff --check`, examples, public APIs, and all
  framework contract paths pass.
- Independent self-review and sub-agent review both report no concrete
  P0/P1/P2 finding. Passing this DoD means implementation-ready/review-ready;
  only the user may close or archive this plan.

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

- `@asyra/factory`: local transaction/history/shared-settlement and remote
  transaction origin integration
- `@asyra/collaboration`: optional Y.Doc/provider/Awareness/update-persistence
  composition and inbound operation pipeline
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
