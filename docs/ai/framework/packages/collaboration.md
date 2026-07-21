# Collaboration Package Contract

`@asyra/collaboration` is the optional, provider-replaceable network
collaboration runtime. Importing or omitting it changes no Core, Factory,
Preset, Persistence, Render, or UI startup behavior. An app activates it only
by creating a `Collaboration`, then explicitly calling `start()`.

## Ownership

Each `Collaboration` owns or receives exactly one:

- document/room/actor identity;
- intended Factory action-publication and transaction owner;
- Y.Doc operation transport log;
- optional replaceable `Provider`;
- `Awareness`;
- optional `UpdatePersistence`;
- operation validator/canonical apply registry, permission policy, and ordered
  app conflict-policy extensions;
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
  definitions, with `apply` created by `defineCanonicalOperationApply(...)`;
- `permissionPolicy`;
- optional ordered `conflictPolicies`;
- optional provider, collaboration update persistence, Y.Doc, Awareness,
  session identity, and resource ownership.

Connection authentication metadata is not duplicated on collaboration
composition. It belongs to the explicitly supplied provider's
`ProviderIdentity`, which the app/server connection boundary
consumes.

Canonical `apply` handlers are trusted synchronous state-owner boundaries. Wrap
each handler with `defineCanonicalOperationApply(...)`: TypeScript rejects a
Promise return, and a native async function is rejected during registration
without invocation. A `void` or `true` return is an applied operation and
`false` is a semantic no-op. JavaScript callers must also keep the wrapped
handler synchronous. A contract-violating runtime thenable records
`apply-failed` and rolls back synchronous journal mutations, but JavaScript
cannot cancel effects that the handler scheduled after return. Scheduling such
effects violates this trusted registration contract; the wrapper is not an
asynchronous code sandbox.

Construction validates identity and registration but does not subscribe,
connect, recover, or send. `start()` binds observers, replays optional persisted
updates through the inbound pipeline, connects the provider when supplied, and
exchanges state vectors. Durability acknowledgement tracking begins on
`start()` and remains lazy and idempotent inside the collaboration owner.
Provider-less `start()` remains an offline explicit collaboration composition
and opens no network connection.

Lifecycle and observation methods include:

- `start()`, `disconnect()`, `reconnect()`, `dispose()`;
- `whenIdle()` for draining the collaboration-local async processing queue;
- `observeOperationOutcomes(...)` and `observeDurability(...)`;
- `updateAwareness(...)`, `leaveAwareness()`, and `expireAwareness()`.

Disposal detaches collaboration observers and destroys owned provider/persistence
adapters before awaiting pending startup or work-queue settlement, allowing
their lifecycle to abort outstanding I/O. Borrowed adapters are detached but
never destroyed; owned Awareness and Y.Doc resources are destroyed only after
the queue settles. A provider must not revive or remain room-connected when an
in-flight `connect()` completes after disposal. Already-started inbound work
rechecks disposal after asynchronous permission/conflict policy settlement and
does not enter canonical apply once disposal has begun.

## Local and Remote Flow

Local flow:

```text
Intent -> Feature/API -> Factory local transaction -> canonical state owner
-> sharedDelivery boundary -> one detached shared publication
-> ordered validated envelopes
-> one collaboration-owned Y.Doc update -> one optional persistence/provider send
```

Remote flow:

```text
Provider or persisted update -> Yjs decode/origin -> operation-id dedupe
-> protocol/schema/route/payload validation -> permission
-> optional ordered app-domain policies -> Factory remote transaction
-> registered canonical apply handler -> state owner -> projections
```

Inbound binary is staged against a detached Y.Doc before integration. A
malformed, non-operation, non-append, or undecodable update is rejected without
changing the collaboration-owned Y.Doc.

Inbound operation and Awareness records are treated as inert JSON data.
Enumerable accessors are rejected without execution, while prototype-named
JSON keys are preserved as own data properties rather than changing a clone's
prototype.

Registered payload validators are fail-closed per operation: an exception
produces an invalid-payload or invalid-repair rejection without aborting later
operations decoded from the same update.

Provider `connectionMetadata` is an opaque app/server contract. Replaceable
providers forward it and expose connection status/failure; they do not assign
meaning to file, user, branch, tenant, authentication, or permission fields.
The Asyra Design public reference implementation chooses `{ fileId }` and its
memory-only server intentionally performs no authentication or permission
check. That public policy is not an authorization contract for protected
documents.

Remote Factory transactions route nested reactive transaction calls to the
collaboration's intended Factory, force every remote mutation to remain rollbackable,
exclude those mutations from ordinary local undo history, and suppress new
shared publication. Local action, automation, undo, redo, and
rollback-compensation origins remain explicit in the envelope.
State-owner payloads are transported in publication order without framework
reinterpretation. If an app operation requires property changes before an
entity change, the app's canonical transaction publishes that order;
collaboration neither synthesizes missing state nor reorders the payloads.
All deliveries in one shared publication are validated before any Y.Doc
mutation. They are appended in one Y.Doc transaction, persisted as one binary
update, and invoke `provider.sendUpdate(...)` once. Locally published operations
enter the collaboration outcome registry before provider transport, so a provider
replay of the sender's own operation is a deterministic duplicate; a reused ID
with different content is an identity collision.

Factory discards an immediate batch that rolls back before its publication
microtask and emits a linked reverse compensation publication when rollback
occurs after publication. A committed local undo/redo produces one new
inverse/forward publication. Compatible explicit compensation envelopes run
through the same decode, dedupe, validation, permission, conflict, and
canonical-apply route.

The collaboration outcome registry records whether each forward operation actually
mutated canonical state. A compensation proceeds only when its exact
same-actor, non-compensation forward is final, accepted or repaired, and
`applied`; a missing, rejected, apply-failed, or semantic no-op forward produces
no inverse mutation. The Yjs operation-log dependency orders valid
forward/compensation pairs, so an unavailable forward is an invalid linkage
rather than a second pending queue.

## Provider and Durability Boundary

`Provider` defines connect/disconnect/reconnect/status, binary
updates, state-vector exchange, Awareness, durable acknowledgement, failure
observation, and disposal. Authentication, room access, authorization, durable
backend policy, update compaction, and server history remain app/server owned.
`PROVIDER_FAILURE_CODES` is the canonical frozen runtime registry for
`ProviderFailureCode`; adapters that decode untrusted transport failures use
`isProviderFailureCode(...)` instead of maintaining an app-local copy.
For live one-author delivery, `InboundBinaryUpdate.fromActorId` is the
provider-authenticated operation author and must match `envelope.actorId`.
Multi-author sync aggregates omit it; custom providers must never label an
unverified transport peer as the operation author.

`MemoryHub` and `MemoryProvider` are deterministic
in-memory reference adapters, not a mandatory transport authority. The hub
stages live and state-vector sync updates before integrating its room history,
so malformed or non-operation Yjs content is rejected without polluting the
room, broadcasting to peers, or issuing a durability acknowledgement. Every
new operation in a live or sync upload must name the authenticated sender as
its actor before the hub integrates room history, broadcasts, or acknowledges
it; previously validated multi-author room history remains available through
state-vector download.

### Asyra Design reference consumer

The Asyra Design reference composition is an app-owned consumer of the provider
boundary. It exposes only registered Scene Tree and Props document channels,
routes inbound operations to their canonical handlers, and excludes local
selection. A URL without `fileId` bypasses this composition; a URL with
`fileId` may activate the same dynamic composition in development or a
deployed build.

The accompanying memory WebSocket server is a public-room reference adapter,
not an authenticated or durable backend. `app-environment.mjs` owns parsing of
the `ASYRA_DESIGN_APP_URL` app-origin input consumed by Vite, Playwright, and
server Origin validation; the WebSocket endpoint remains an independently
replaceable service. See
`../../apps/asyra-design/modules/collaboration-reference.md` for its manual
workflow, limits, and production extension boundary.

Runtime commit, local collaboration-update persistence, network send,
state-vector convergence, and durable acknowledgement are separate observable
phases. Persistence or acknowledgement failure does not reverse an already
committed canonical transaction. `MemoryPersistence` stores
binary collaboration updates only; it never stores Awareness.

## Conflict Policy

Permission always runs first. Ordered, explicitly registered app policies may
return `not-applicable`, `accept`, `repair`, or `reject`. Every repair is cloned,
frozen, and revalidated before canonical apply. If no registered policy applies,
the validated operation continues unchanged.

Collaboration-owned origin, dedupe, protocol, schema, route, and payload checks
cannot be replaced by a policy. Entity existence, hierarchy membership/order,
property validation, geometry, and topology semantics remain in canonical
state owners or explicitly registered app-domain policy. The collaboration
adapter does not reread canonical state to reconstruct those decisions.

Yjs log convergence does not make arbitrary app operations commutative. Apps
must register deterministic domain policy for non-commutative geometry,
topology, locking, or property semantics. Such policy reads canonical owner
state and returns an operation decision; it must not patch Render/UI.

## Awareness

Awareness accepts app-selected JSON-safe presence fields; identity, cursor,
selection, viewport, tool, and editing metadata are common conventions, not a
framework allowlist. The runtime reserves `heartbeatAt` and has an actor-local
monotonic clock,
rejects stale remote updates, and clears state on leave, disconnect, or timeout.
It is excluded from the Y.Doc operation log, Core save/load, collaboration
update persistence, permission, canonical mutation, and ordinary undo/redo.
Apps may omit Awareness projection entirely. Canonical element creation,
geometry, style, hierarchy, and deletion never enter Awareness; those changes
use document-operation transport and remain correct when Awareness is absent.

## Example and Authorities

- End-to-end composition: `docs/examples/yjs-network-collaboration.mjs`
- Supported executable workspace runner:
  `yarn workspace @asyra/collaboration example:collaboration`
- Product contract: `../plans/yjs-network-collaboration-plan.md`
- Dedicated Inspector: `../plans/yjs-network-collaboration-flow-inspector.html`
- Conflict sub-plan: `../plans/collaborative-conflict-policies-plan.md`

The runner executes the public `.mjs` composition through the workspace's
supported package resolver. Direct Node execution of monorepo build output is
not claimed because current emitted ESM uses bundler-resolved internal imports.
