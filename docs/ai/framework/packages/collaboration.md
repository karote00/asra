# Collaboration Package Contract

`@asyra/collaboration` is the optional, provider-replaceable network
collaboration runtime. Importing or omitting it changes no Core, Factory,
Preset, Persistence, Render, or UI startup behavior. An app activates it only
by creating a `CollaborationInstance`, then explicitly calling `start()`.

Framework Release Gate 2 remains active until user-directed closeout. The
implemented surface described here is review-ready behavior, not a claim that
the release gate is closed.

## Ownership

Each instance owns or receives exactly one:

- document/room/actor identity;
- intended Factory shared-delivery and transaction owner;
- Y.Doc operation transport log;
- optional replaceable `CollaborationProvider`;
- `AwarenessRuntime`;
- optional `CollaborationUpdatePersistence`;
- operation validator/canonical apply registry, permission policy, framework
  invariant policy, and ordered app conflict-policy extensions;
- lifecycle that detaches every observer and destroys only resources marked
  `owned`.

Default-created Y.Doc and Awareness resources are owned. Injected resources
default to borrowed. Provider and persistence adapters default to borrowed
unless composition explicitly marks them owned. Instances share nothing unless
the app injects the same resource intentionally.

Y.Doc, provider state, durability outcomes, Awareness, Render, and UI are never
canonical document owners. State-owner packages remain authoritative.

## Public Composition

Use `createCollaboration(...)` with:

- `documentId`, `roomId`, and `actorId`;
- the intended `Factory`;
- registered `{ channel, eventName, schemaVersion, validate, apply }`
  definitions;
- `permissionPolicy`;
- optional `frameworkInvariants` and ordered `conflictPolicies`;
- optional provider, collaboration update persistence, Y.Doc, Awareness,
  session identity, connection metadata, and resource ownership.

Construction validates identity and registration but does not subscribe,
connect, recover, or send. `start()` binds observers, replays optional persisted
updates through the inbound pipeline, connects the provider when supplied, and
exchanges state vectors. Provider-less `start()` remains an offline explicit
collaboration composition and opens no network connection.

Lifecycle and observation methods include:

- `start()`, `disconnect()`, `reconnect()`, `dispose()`;
- `whenIdle()` for draining the instance-local async processing queue;
- `observeOperationOutcomes(...)` and `observeDurability(...)`;
- `updateAwareness(...)`, `leaveAwareness()`, and `expireAwareness()`.

## Local and Remote Flow

Local flow:

```text
Intent -> Feature/API -> Factory local transaction -> canonical state owner
-> commit -> detached shared delivery -> validated operation envelope
-> instance Y.Doc update -> optional local update persistence/provider
```

Remote flow:

```text
Provider or persisted update -> Yjs decode/origin -> operation-id dedupe
-> protocol/schema/route/payload validation -> permission
-> framework invariants -> ordered app policies -> Factory remote transaction
-> registered canonical apply handler -> state owner -> projections
```

Inbound binary is staged against a detached Y.Doc before integration. A
malformed, non-operation, non-append, or undecodable update is rejected without
changing the instance-owned Y.Doc.

Inbound operation and Awareness records are treated as inert JSON data.
Enumerable accessors are rejected without execution, while prototype-named
JSON keys are preserved as own data properties rather than changing a clone's
prototype.

Remote Factory transactions are rollbackable, excluded from ordinary local
undo history, and suppress new shared publication. Local action, automation,
undo, redo, and rollback-compensation origins remain explicit in the envelope.
Locally published operations enter the instance outcome registry before Yjs or
provider transport, so a provider replay of the sender's own operation is a
deterministic duplicate; a reused ID with different content is an identity
collision.

Factory discards transaction-end shared changes on rollback. A committed local
undo/redo produces a new inverse/forward operation. If an immediate shared
change rolls back, Factory publishes one linked compensation operation; peers
run it through the same decode, dedupe, validation, permission, conflict, and
canonical-apply route.

## Provider and Durability Boundary

`CollaborationProvider` defines connect/disconnect/reconnect/status, binary
updates, state-vector exchange, Awareness, durable acknowledgement, failure
observation, and disposal. Authentication, room access, authorization, durable
backend policy, update compaction, and server history remain app/server owned.

`MemoryCollaborationHub` and `MemoryCollaborationProvider` are deterministic
in-memory reference adapters, not a mandatory transport authority.

Runtime commit, local collaboration-update persistence, network send,
state-vector convergence, and durable acknowledgement are separate observable
phases. Persistence or acknowledgement failure does not reverse an already
committed canonical transaction. `MemoryCollaborationUpdatePersistence` stores
binary collaboration updates only; it never stores Awareness.

## Conflict Policy

Permission always runs first. Framework policies then run in fixed order for
entity existence, hierarchy membership/order, and property validation. Ordered
app policies may return `not-applicable`, `accept`, `repair`, or `reject`.
Every repair is cloned, frozen, and revalidated before canonical apply.

Yjs log convergence does not make arbitrary app operations commutative. Apps
must register deterministic domain policy for non-commutative geometry,
topology, locking, or property semantics. Such policy reads canonical owner
state and returns an operation decision; it must not patch Render/UI.

## Awareness

Awareness permits app-selected identity, cursor, selection, viewport, tool,
editing, and heartbeat metadata only. It has an actor-local monotonic clock,
rejects stale remote updates, and clears state on leave, disconnect, or timeout.
It is excluded from the Y.Doc operation log, Core save/load, collaboration
update persistence, permission, canonical mutation, and ordinary undo/redo.
Apps may omit Awareness projection entirely.

## Example and Authorities

- End-to-end composition: `docs/examples/yjs-network-collaboration.mjs`
- Product contract: `../plans/yjs-network-collaboration-plan.md`
- Dedicated Inspector: `../plans/yjs-network-collaboration-flow-inspector.html`
- Conflict sub-plan: `../plans/collaborative-conflict-policies-plan.md`
