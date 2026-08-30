# Asyra Pre-Release Canonical Projection and Collaboration Contract Realignment Plan

## Status

Completed on 2026-07-29.

The framework now has one origin-neutral canonical owner flow, local-only
computed projection, required batch shared-data and Provider contracts,
one existing Factory journal and Undo boundary, one separate minimal
`SharedPublication`, and remote side-effect isolation. The Asyra Design
performance plan resumed for its remaining performance-equivalence closure.

This plan completed the release-blocking prerequisite for:

- `docs/ai/apps/asyra-design/plans/completed/ai-conversational-drawing-performance-plan.md`;
- Framework Release Gate 5.

Architecture authority:

- `tools/flow-inspector/inspectors/canonical-projection-and-collaboration-contract-flow-inspector.data.cjs`
- `tools/flow-inspector/inspectors/canonical-projection-and-collaboration-contract-flow-inspector.html`
- `tools/flow-inspector/inspectors/__tests__/canonical-projection-and-collaboration-contract-flow-inspector.contract.test.cjs`

Executable product cases:

- `docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature`

The Asyra Design performance plan retained its profiling evidence, product
budgets, fixtures, and visual-equivalence requirements while its affected
architecture routes were paused. This completed record, Inspector, contract
test, and BDD now contain the resynchronized contracts.

## Goal

Restore one unambiguous framework flow for canonical state, local projection,
batch delivery, collaboration, transactions, and lifecycle-specific Scene Tree
mutation.

The framework must optimize and guarantee its own ecosystem without probing,
guessing, or preserving obsolete custom behavior. This is the first unreleased
version, so the target is the correct contract rather than backward
compatibility.

## Decision Summary

1. Property and structural changes are canonical source data.
2. Computed changes are local projection data and never shared, journaled, or
   persisted.
3. The framework shared-data service-provider contract is batch-only. Public
   single-item conveniences delegate to the same batch-of-one path.
4. `SharedPublication` is already the collaboration batch unit. Provider has
   one required outbound path and one required inbound path; wire grouping and
   backpressure are provider internals.
5. `Core.createElementsInParent(...)` is the plural API.
   `createElementsInParentBatch(...)` and Factory delivery details are removed
   from Core.
6. Scene Tree lifecycle-specific preparation APIs feed one atomic apply owner.
   Origin checks and `UsingActiveProperties` variants are removed.
7. Factory reuses its existing transaction journal, history, rollback, and
   inverter contracts and derives one separate minimal `SharedPublication`.
   It exposes no parallel mutation artifact/status or applied-result API.
8. Profiling is observational evidence, not a reason to change product API
   return types.
9. `Core.changeComputedData(...)` and `changeComputedDataPatch(...)` are deleted:
   current callers use them for canonical property mutation while the names and
   events imply local computed projection. Canonical callers migrate to
   plural element-property APIs; direct local computed APIs have a separate
   name, shape, and event path.
10. `Core.applyCanonicalChanges(...)` is one origin-neutral coordinator for an
    already validated ordered canonical request. It accepts no transport,
    remote/local, suppression, publication, or compatibility options. The
    caller owns the one enclosing Factory transaction.

## Evidence and First Incorrect Owner

The small follow-up CRDT failure exposes a semantic duplication:

```text
Actor A UPDATE_PROPERTY
→ Props applies the canonical property
→ the property subscription recomputes computed data
→ Scene Tree emits UPDATE_COMPUTED_DATA for local Render projection
→ Factory currently publishes both events

Actor B receives UPDATE_PROPERTY
→ Props applies it
→ Actor B locally recomputes the same computed data
→ Actor B later receives the duplicated UPDATE_COMPUTED_DATA
→ the semantic no-op can be interpreted as a rejected remote apply
→ the publication rolls back or fails to settle
```

The duplicated computed event increases payload size and makes Actor B update
the same object more than once even when it does not trigger rollback. The
correct first owner is the source-versus-projection boundary, not an app-level
snapshot comparison or an `already-satisfied` exception.

A complete caller audit found that the current
`Core.changeComputedData(...)`/`changeComputedDataPatch(...)` path cannot be
made local-only in place. Group geometry, element geometry, vector topology,
property panels, and stroke/fill edits use it to update canonical Props data.
`Element.updateComputedData(...)` then writes both computed state and Props,
so one public API has two conflicting missions. The replacement dependency
order is therefore fixed:

1. Props gains one whole-batch canonical property mutation boundary.
2. Scene Tree exposes read-only element-to-property target resolution.
3. The App composition path migrates from the Core batch result and delivery
   handle to the existing plural `createElementsInParent(...)` result plus the
   Factory-owned shared-delivery handle.
4. Core then deletes the legacy creation surface, completes plural canonical
   element-property coordination, and migrates every canonical direct caller.
   The transient vector preview remains an explicit local-only dependency for
   the next semantic handoff rather than being forced through a canonical API.
5. Scene Tree and Reactive Events then introduce the mission-specific
   local-computed batch route; in that same handoff the transient vector caller
   migrates, the old mixed Core/command APIs are deleted, and Preset activates
   the prepared single local Render projection. No intermediate state has two
   active computed delivery routes.

This is a contract correction inside the frozen task, not a new performance
tuning iteration.

The same over-design pattern exists in current batch work:

- `SharedDataChannel` has optional batch methods, an atomicity flag, prototype
  and identity checks, and a single-item fallback;
- Collaboration Provider exposes optional single, multi-publication, lease,
  concurrency, and batch-size modes;
- Core exposes both `createElementsInParent(...)` and
  `createElementsInParentBatch(...)`, with the latter returning Factory delivery
  and timing details;
- Scene Tree encodes cross-owner state in multiple
  `UsingActiveProperties` mutation methods;
- Factory and downstream packages have accumulated application-specific
  coordination surfaces.

These are contract problems. They are not accepted as permanent compatibility
costs.

## Bounded Contract

### Authorized implementation scope after explicit approval

- `@asyra/reactive-events`
- `@asyra/props-manager`
- `@asyra/scene-tree`
- `@asyra/factory`
- `@asyra/core`
- `@asyra/collaboration`
- direct framework consumers in `@asyra/preset` and `@asyra/render`
- Asyra Design common APIs, AI composition, collaboration adapter, worker,
  reference server, and focused formal tests
- the active plan, Inspector data, Inspector contract test, BDD, and directly
  affected public package documentation

Existing branch work may be retained only where it satisfies this contract.
Incompatible optional modes, capability probes, compatibility fallbacks, and
API leaks must be deleted rather than wrapped.

### Excluded scope

- Contents panel correctness or replacement
- animation product implementation; only its local-computed boundary is
  reserved
- Live AI provider and API-key testing
- production backend DB integration or server checkpoint policy
- VTracer detail generation
- AI-only Render paths
- generalized shared-element DAG or multi-parent hierarchy semantics
- shared-relation permissions, leases, pinning, garbage collection, or
  server-owned lifecycle policy
- a universal cross-package relationship registry
- unrelated framework cleanup
- third-party dependencies or Node.js, Yarn, package-manager, or runtime
  upgrades

No package or tool installation is authorized by this plan.

### Discovery boundary

Each owner step may inspect only its implementation allowlist, direct public
consumers, formal tests, and current source-of-truth documentation. After edits
begin, review is limited to that step's diff, direct regressions caused by the
diff, and its frozen gates.

## Target Architecture

```text
local canonical action
→ one Factory transaction
→ Core plural creation or element-property request
→ prepared Props + Scene Tree mutations
→ one atomic canonical apply
→ ordinary canonical owner batch → local computed projection → Render/UI
→ existing Factory transaction journal
   ├─ one Undo/Redo action
   ├─ one local persistence trigger
   └─ exact rollback/compensation evidence
→ one separate minimal SharedPublication
→ Provider-owned binary framing, queueing, and backpressure
→ peer one-publication/one-remote-transaction apply
→ peer local computed projection
→ Render
```

```text
local typed element-property request
→ Core.updateElementProperties or Core.patchElementProperties
→ Scene Tree read-only resolved element-to-property targets
→ Props whole-batch preflight and apply
→ UPDATE_PROPERTY canonical evidence
→ existing Factory journal entry
```

```text
local or remote UPDATE_PROPERTY
→ Props canonical state
→ local property subscription
→ local UPDATE_COMPUTED_DATA
→ Render
```

```text
future local animation tick
→ local UPDATE_COMPUTED_DATA
→ Render
```

The last flow has no Factory journal, SharedDataChannel delivery,
Collaboration publication, client persistence, or Undo action.

## Canonical and Local Projection Contracts

| Evidence                                        | Owner and purpose                    | History | Collaboration | Persistence |
| ----------------------------------------------- | ------------------------------------ | ------- | ------------- | ----------- |
| `UPDATE_PROPERTY`                               | Props canonical source state         | Yes     | Yes           | Yes         |
| `UPDATE_ELEMENT_DATA`                           | Scene Tree canonical raw state       | Yes     | Yes           | Yes         |
| canonical add/remove/move/relationship evidence | owning canonical package             | Yes     | Yes           | Yes         |
| `UPDATE_COMPUTED_DATA`                          | Scene Tree local Render projection   | No      | No            | No          |
| `UPDATE_COMPUTED_DATA_PATCH`                    | Scene Tree local Render projection   | No      | No            | No          |
| future animation computed update                | local animation-to-Render projection | No      | No            | No          |

Required behavior:

- Local property edits, remote property edits, Undo, Redo, and canonical load
  all update Props first and derive computed state locally.
- `UPDATE_COMPUTED_DATA` and `UPDATE_COMPUTED_DATA_PATCH` remain ordinary local
  reactive events so Render can update without mutating property components.
- `UPDATE_ELEMENT_DATA` is the distinct canonical event for raw element fields
  such as name, visibility, and lock. Raw state never travels through a
  computed-named event or action.
- Factory must not record either computed event in canonical transaction
  evidence, history, shared publications, or persistence snapshots.
- A direct computed update must not produce a canonical publication merely
  because it occurs during an open transaction.
- Render must continue to use computed changes as its invalidation source, and
  the same ordinary local projection must update affected UI-context entries
  once without duplicating Render delivery.
- Direct local computed mutation uses explicitly local batch APIs, accepts no
  `EVENT_OPTIONS`, and cannot be switched into a shared/history/persistence
  path by caller options.
- A no-op computed application is neither a remote canonical rejection nor a
  reason to add an app-specific replay exception; it is outside the remote
  canonical payload.

This contract deliberately reserves a clean future animation path without
implementing an animation system.

## Shared Element-Property Relation Contract

`ElementPropertyRelation` is many-to-one: `ownerElementId`,
`ownerPropertyName`, and `componentId` describe an element property slot
reference to one canonical property component.

Props independently owns property/component identity, registry and type
validity, lifecycle, and the property-child graph. Scene independently owns
element identity, the element hierarchy, and each element-slot-to-root
relation. This owner separation is the stable extension point for future
shared props, shared components, and shared elements without pre-assigning
their later product semantics to the current relation contract.

```ts
interface ElementPropertyRelation {
  readonly ownerElementId: string
  readonly ownerElementType: string
  readonly ownerPropertyName: string
  readonly componentId: string
}
```

Each unique `(ownerElementId, ownerPropertyName)` tuple identifies one element
slot, while a compatible `componentId` may repeat across any number of relation
tuples. The word `owner` identifies the element slot that holds the reference;
it does not grant exclusive lifecycle ownership of the property component.

The current framework supports this exact shared-root meaning without
pre-assigning future shared-element product semantics:

- canonical element raw `props` remain the source of element-to-root-property
  relations;
- Scene Tree owns a derived reverse relation index from `componentId` to
  ordered `ElementPropertyRelation` values and keeps it equivalent through
  load, insert, remove, restore, rollback, Undo, and Redo;
- Props Manager separately owns property-to-child-property graph relations.
  The Scene reverse relation index and Props child graph are different relation
  domains and must not be merged or duplicated as competing canonical state;
- Props Manager exposes a read-only ordered self-and-ancestor closure for
  changed property IDs. It traverses only the Props-owned child graph, mutates
  no registry or evidence, and knows nothing about Scene hierarchy;
- `UPDATE_PROPERTY` is source-only property evidence. It contains no computed
  projection and an initiating element is not the fanout authority;
- local computed projection asks Props for that property ancestor closure,
  then Scene maps only the resulting property roots through its own reverse
  relation index and emits one ordered computed batch. Scene never copies the
  Props child graph. One shared child update therefore changes its canonical
  source once while every element related to an affected root projects locally;
- Scene element-property target resolution groups the complete request by
  `propertyId`. Equivalent field or record mutations become one property
  mutation; conflicting writes to the same canonical field or record are
  rejected atomically before Props preflight;
- a prepared Scene removal records released and retained relations, deduplicated
  orphan root property IDs, the complete set of root property IDs retained by
  prepared remaining element relations, and the exact relation-set read needed
  to reject a stale apply;
- Props exact orphan property graph removal accepts only those orphan and
  retained root property ID sets, traverses its own property-child graph from
  orphan roots, stops at every retained Scene root, and removes a descendant
  only when no remaining canonical property relation retains it;
- a direct Scene removal applies only Scene state and retains Props. Core owns
  the full element lifecycle that coordinates the prepared Scene release with
  the prepared Props orphan graph mutation inside one outer Factory transaction;
- removing one relation never deletes a shared root retained by another
  relation. Removing the final relation deletes that root graph once;
- Factory records the exact Props source and Scene relation evidence so Undo,
  Redo, rollback, CRDT `SharedPublication`, and remote apply preserve canonical
  IDs and the same many-to-one relations.

This contract does not introduce multi-parent Scene elements, generic owner
kinds, permissions, leases, pinning, reference-count APIs, server persistence,
or a universal relationship service. Those semantics require separate product
contracts if they become necessary.

## SharedDataChannel Contract

The framework service-provider interface has one batch shape:

```ts
interface SharedDataChannel<TChange = unknown> {
  appendBatch(changes: readonly TChange[]): void
  observeBatch(handler: (changes: readonly TChange[]) => void): () => void
}
```

- Both methods are required.
- The built-in implementation deeply detaches and freezes one ordered batch at
  its owner boundary.
- Framework internals always call the batch methods, including one-item work.
- The public Registry/facade retains `append(change)` and
  `observe(handler)` conveniences. They must delegate to `appendBatch([change])`
  and `observeBatch(...)`; they are not a second implementation.
- Documentation must explain the cost and semantic difference between explicit
  single-item convenience and an intentional multi-item batch.
- Custom channels join the optimized framework ecosystem by implementing this
  exact interface. The framework validates the required method shape at
  registration but does not inspect prototypes, infer atomicity, benchmark,
  split, or repair custom behavior.
- A custom implementation's correctness and atomicity remain its developer's
  responsibility.

The following are removed:

- optional `appendBatch?` and `observeBatch?`;
- `batchAppendIsAtomic`;
- built-in instance `WeakSet` checks;
- prototype identity checks;
- single-item fallback loops;
- compatibility tests that require the old modes.

## Collaboration Provider Contract

`SharedPublication` represents one ordered canonical transaction publication.
It may contain many channel batches and many changes. It is not a single
element event.

Provider has one required data path in each direction:

```ts
interface Provider {
  sendPublication(publication: SharedPublication): Promise<void>
  onPublication(
    consume: (publication: SharedPublication) => Promise<void>
  ): () => void
}
```

Awareness, status, failure, and lifecycle contracts remain separate because
they have separate missions.

Required behavior:

- Collaboration submits publications in canonical order through
  `sendPublication`.
- The outbound promise resolves when the concrete provider has accepted the
  publication into bounded provider-owned capacity, fixed its ordered queue
  position, and assumed delivery ownership. It may wait for capacity and
  rejects on a permanent transport failure, but it does not claim server
  acceptance, wire completion, or peer apply.
- Provider invokes one exclusive async consumer for each inbound publication
  and does not treat it as applied until that promise settles. The consumer
  promise has one meaning: App canonical apply completed successfully or
  failed.
- A concrete provider may return wire credit after decode while the canonical
  consumer is still applying. Wire-consumed and peer-applied remain separate
  states even though the framework exposes only one inbound publication path.
- One source publication remains one remote Factory transaction.
- Provider adapters may coalesce publications into a wire frame, split bytes
  into chunks, or pipeline encoding internally. Those operations never change
  publication identity or create framework-level Provider modes.
- Queue watermarks, worker credit, transfer buffers, send callback handling,
  and wire acceptance are owned by the concrete provider/transport.
- Generic Collaboration does not prescribe fixed publication group sizes or
  send concurrency constants.
- `server-accepted`, wire-consumed, and peer-applied remain distinct receipts
  in adapters that expose those diagnostics. They are diagnostic/status
  evidence, not alternate completion meanings for `sendPublication`.

The following are removed:

- optional `sendPublications`;
- optional `onPublications`;
- optional `onInboundPublicationLease`;
- `maxConcurrentPublicationSends`;
- `maxPublicationsPerSend`;
- runtime capability branching between those paths.

The built-in memory provider and the Asyra Design WebSocket provider must
implement the same required semantic contract. Custom providers receive no
legacy adapter or behavioral inference.

## Core Creation Contract

`createElementsInParent` is the canonical plural API:

```ts
createElementsInParent(
  descriptors: readonly ElementDescriptor[],
  parentId: string,
  index?: number
): readonly string[]
```

- It accepts one or many descriptors and returns ordered canonical element IDs.
- `createElementInParent(...)` is a public convenience that calls the plural
  API with one descriptor and returns the single ordered ID.
- `createElementsInParentBatch(...)` is deleted.
- `CanonicalElementBatchResult` is not part of the Core public surface.
- Core returns no Factory delivery handle, progressive slice handle, timing
  object, publication receipt, or transport state.
- The AI composition path creates its Group and sends all accepted children
  through one plural Core request inside the same outer Factory transaction.
- The App obtains one active shared-delivery handle directly from the Factory
  that owns that outer transaction. Core never receives, stores, or returns
  the handle.
- The old fixed-size loop that repeatedly invokes Core is removed. Point-aware
  progressive slicing is downstream delivery policy, not repeated canonical
  mutation.

Core owns orchestration of canonical package APIs. It does not own history
artifact construction, progressive delivery, transport scheduling, or
profiling output.

## Core Canonical Apply Contract

Core exposes one typed coordination boundary for a caller that already owns
canonical source evidence:

```ts
applyCanonicalChanges(changes: readonly CanonicalChange[]): void
```

`CanonicalChange` is a closed union of property-component updates, raw element
data updates, hierarchy moves, subtree removal, subtree restore, canonical
element creation, and canonical element removal.

- The request preserves change order and each owner batch's internal order.
- Core invokes the existing origin-neutral Props and Scene Tree facades for
  each change; it does not parse `SharedPublication` or own App policy.
- The caller opens the one Factory transaction. Core neither opens another
  transaction nor accepts an origin or transaction-mode parameter.
- An owner rejection throws through the caller-owned transaction. Factory
  rollback restores prior canonical state and releases no ordinary observer
  prefix.
- The API returns no publication, receipt, delivery handle, profiling data, or
  compatibility result.

## Canonical Element Property Update Contract

Core exposes two plural canonical APIs with fixed missions:

```ts
updateElementProperties(
  updates: readonly ElementPropertyValuesUpdate[],
  options?: EVENT_OPTIONS
): readonly string[]

patchElementProperties(
  patches: readonly ElementPropertyPatchUpdate[],
  options?: EVENT_OPTIONS
): readonly string[]
```

- `updateElementProperties(...)` replaces complete canonical property field
  values for one or many elements and does not accept record set/remove
  operations.
- `patchElementProperties(...)` applies one atomic typed record delta containing
  ordered set/remove operations and any explicitly validated field
  replacements required by that same delta. Record set/remove is accepted only
  by this patch path.
- Both return ordered affected element IDs only. They expose no computed
  payload, Factory handle, timing, delivery mode, or origin mode.
- Core requests one read-only Scene Tree element-to-property target resolution before
  asking Props Manager to preflight or apply the canonical mutation.
- Scene Tree resolves aliases such as `x`/`y` to position and
  `width`/`height` to dimension, verifies element ownership, and returns
  explicit property IDs and owner relations. It does not mutate Props.
- The complete resolved Scene targets group requests by `propertyId`. Equivalent
  changes from multiple elements that share one component produce one Props
  mutation; conflicting changes to the same field or record reject atomically
  before Props preflight.
- Props Manager receives property IDs and typed operations; it never parses
  Scene snapshots or infers element relationships.
- A later invalid element, property target, field value, or record patch leaves
  no mutation or evidence prefix.
- Public single-item conveniences, where useful, delegate to these plural
  batch-of-one paths.
- `Core.changeComputedData(...)`,
  `Core.changeComputedDataPatch(...)`, the generic App
  `change-computed-data` adapter, and the generic
  `changeElementComputedData` controller are deleted after direct consumers
  migrate. No alias or compatibility route remains.

Local computed projection instead uses Scene Tree APIs named for their one
mission, such as `updateLocalComputedData(...)` and
`patchLocalComputedData(...)`. They accept a batch shape, accept no
`EVENT_OPTIONS`, update no property component, and emit only ordinary local
computed events.

## Props Manager Batch Contract

Props Manager owns property schema validation, property instance
materialization, relationship rebind, relationship registration, and ordered
property evidence.

It exposes one prepared whole-batch mutation and one whole-batch apply boundary for
both creation/lifecycle property work and active property value or record
patch mutations:

- all schemas, IDs, property values, Props-owned component registry/type/
  lifecycle validity, instances, and relationships are validated before any
  property mutation;
- Props normalizes a relation-backed creation descriptor with a missing
  placeholder ID before detached materialization and generates its canonical
  ID, while every explicit non-empty child ID is preserved unchanged and an
  empty canonical ID remains invalid;
- each active mutation item is an explicit typed field replacement or record
  patch against a resolved property ID and owner relation;
- a relation-backed property definition used by record set/remove explicitly
  declares `array-or-record`; this capability is opt-in and leaves generic
  array relation behavior unchanged;
- apply materializes required property instances, performs relationship
  rebind/registration where required, applies active values/record patches,
  and records ordered property evidence once;
- an inactive Props-owned tombstone is reactivated only when its exact ID,
  type, canonical data, and property instance identity match; this rule is
  origin-neutral and applies equally to ordinary, Undo/Redo, and remote
  canonical work;
- a later invalid item leaves no property, instance, relationship, registry, or
  evidence prefix;
- `UPDATE_PROPERTY` remains property-source evidence and does not treat one
  initiating element as the fanout authority for a possibly shared component;
- Props Manager never mutates Scene maps, parent children, hierarchy order, or
  Scene evidence.

Props exposes two public owner capabilities with independent missions:

- `preparePropertyMutationBatch(...)` is read-only and returns a complete
  owner-issued prepared property mutation batch.
- `applyPreparedPropertyMutationBatch(...)` applies only such an owner-issued prepared batch and
  emits its one ordered evidence batch.

Core uses those public capabilities for cross-owner coordination; it never
reaches a package-private Props method. The public `updateProperties(...)`
property-ID-only convenience composes the same prepare/apply capabilities when
no Scene mutation is required. It is not a second implementation. Separate
single and multi-item canonical implementations are forbidden. A public
single-item convenience, when retained, delegates to
`updateProperties(...)` with a batch-of-one. The old caller-managed
`updatePropertyById(...)` plus `commitPropertyChanges(...)` sequence is removed
after direct consumers migrate; one apply owns its ordered evidence emission.
Apply freezes the complete ordered event array before passing it once through
the required `TransactionOwner.updateTransactionBatch(...)` boundary. It never
loops over scalar `updateTransaction(...)`, preserves no older pending scalar
evidence, and cannot leave an accepted Factory journal prefix.
The Inspector's canonical-apply authorization is Core orchestration evidence,
not a public token, caller-origin check, or mode parameter; Props validates its
own owner-issued preparation, while documentation tells callers when to use direct
property-ID mutation versus Core element-based coordination.

For relation-backed record properties, Props is also the child property-graph
lifecycle owner:

- record set against an existing child validates and applies its typed fields;
- record set against a missing canonical record materializes and registers the
  typed child only after the complete batch preflight succeeds;
- record remove unlinks the exact parent relation and order, and removes the
  child from the property registry only when no other canonical owner remains;
- every create, update, unlink, retained shared child, and removal records
  ordered forward and inverse evidence sufficient for exact Undo, Redo, and
  rollback;
- any failure restores property values, instances, registry membership,
  relationships, owner order, and evidence to the batch-start state.

For element-root property lifecycle, Props has a fixed exact orphan graph
removal operation. It accepts only deduplicated orphan root IDs and the complete
deduplicated retained Scene root ID set from a Core-coordinated Scene
prepared relation release, validates the affected active property graph before
mutation, stops traversal at every retained Scene root, and removes each root
or descendant only when no remaining canonical relation in its own property
graph retains it. Props does not discover Scene owners, scan Scene snapshots,
or decide whether an element relation survives.

## Scene Tree Lifecycle and Apply Contract

Scene Tree exposes lifecycle-specific preparation because ordinary creation,
canonical insertion/replay, ordinary removal, and canonical removal do not have
the same inputs. It exposes one mutation owner because all prepared mutations must
cross the same atomic state boundary.

Target responsibilities:

- `resolveElementPropertyTargets(...)` is read-only and resolves a complete
  batch of element field/patch inputs to explicit property IDs and owner
  relations without mutating Scene or Props state.
- `prepareElementDataMutation(...)` validates canonical raw field updates such
  as name, visibility, and lock and produces `UPDATE_ELEMENT_DATA` evidence.
- `prepareElementInsertion(...)` validates ordinary Scene descriptors, element
  IDs, parent, index, and order.
- `prepareCanonicalElementInsertion(...)` validates canonical Scene snapshots,
  element IDs, parent, index, order, and exact element-slot relations. Its
  `PreparedCanonicalElementInsertion` exposes those frozen `ownerRelations` so Core
  can pass them unchanged to the Props `create-exact-property-graph`
  operation; Core does not reconstruct Scene registry semantics.
- `prepareElementRemoval(...)` prepares ordinary Scene removal.
- `prepareCanonicalElementRemoval(...)` prepares retained canonical Scene
  evidence.
- `prepareSubtreeRemoval(elementId)` accepts one non-workspace root, derives the
  complete canonical child-first post-order closure, and produces one typed
  prepared subtree removal with one `CHANGE_SUBTREE` evidence record. It is not an
  option or hidden expansion mode of `prepareElementRemoval(...)`.
- subtree restore uses typed prepared canonical restore evidence rather than a boolean
  option.
- `applyPreparedElementMutation(...)` is the only Scene map, raw element state,
  parent-list, hierarchy order, and ordered Scene evidence mutation boundary.

An `ADD_ELEMENTS` or `REMOVE_ELEMENTS` apply emits one plural Scene transaction
event and one ordered shared record per element. Factory publication slices may
group complete records, but cannot split one semantic record or create another
Scene mutation or history action. This keeps the Scene owner boundary plural
while preserving exact record-sized progressive delivery.

Scene also exposes one read-only load relation preflight:

```ts
preflightLoadPropertyRelations(
  sceneValidation: SceneTreeLoadValidationResult,
  propsData: Readonly<PropsComponentRawData>
): void
```

It uses the Scene owner-issued validation artifact's private detached
property-slot contract to validate exact component IDs, property types, and
registration stability against detached Props validated data before any owner
applies. It accepts compatible many-to-one shared relations, performs no
materialization or active Props read, consumes no load artifact, and creates no
second load preparation. Core passes the original validation result and Props
validated data unchanged; Core never rewrites Scene slot/type rules.

Scene Tree also owns one derived reverse relation index from `componentId` to
ordered `ElementPropertyRelation` entries. Load, insertion, removal, restore,
rollback, Undo, and Redo keep that index equivalent to canonical element raw
`props`. Resolved property targets group equivalent mutations by `propertyId` and
atomically reject conflicting shared writes before Props preflight. Removal
prepared removals include released relations, retained relations, deduplicated orphan root
property IDs, the complete deduplicated root property ID set retained by all
prepared remaining element relations, and an exact relation-set staleness read;
a relation-set change between prepare and apply rejects the prepared mutation before
mutation.

The exact prepared mutation types must make their required evidence explicit. They must not
encode caller identity or use an `isRemote`, `isLocal`, `usingActiveProperties`,
or similarly overloaded mode flag.

Single-item conveniences may prepare a one-item mutation and use the same apply
owner. A later invalid item leaves no Scene map, parent-list, hierarchy order,
tombstone, or Scene evidence prefix.

Property target resolution and Scene lifecycle mutation are different outputs
of the same Scene ownership boundary: the former is read-only relationship
resolution, while the latter is a typed prepared Scene mutation. Neither output
may apply Props state.

A direct caller preparing a Scene removal receives and applies only the Scene
mission, so active Props are retained. The Core full element lifecycle passes
the Scene-issued orphan and complete retained root ID sets unchanged to the
matching prepared Props exact orphan graph mutation; Core does not inspect the property
graph. It completes both preflights and only then applies the required owner
mutations inside the caller-owned Factory transaction.

Core obtains every complete owner preparation required by a request before any
affected owner applies. A property-only request requires the read-only resolved
targets plus the prepared Props mutation and does not fabricate a Scene
mutation. A cross-owner lifecycle request obtains both complete prepared Props
Manager and Scene Tree mutations. Core invokes the required apply boundaries in
canonical evidence order inside one Factory outer transaction. Props Manager
and Scene Tree retain their independent missions; Factory rollback supplies
cross-owner atomicity if an unexpected apply failure occurs after all required
preflights pass.

The existing `*UsingActiveProperties` APIs and parallel mutation
implementations are deleted after direct consumers migrate. Documentation
teaches which lifecycle preparation to choose; the framework does not block a
caller based on origin.

## Factory Ownership Contract

Factory's public mission is limited to:

- transaction execution and one active shared-delivery handle;
- the existing journal, Undo, Redo, rollback, and inverter contracts;
- one required batch shared-data boundary and its minimal
  `SharedPublication`;
- ordinary transaction and batch observation.

Internal owners may be split into journal, replay, delivery bookkeeping,
compensation, and publication modules. Those modules do not create a second
local-history representation or public workflow.

Required behavior:

- `@asyra/reactive-events` declares
  `TransactionOwner.updateTransactionBatch(...)` as a required owner method.
  It is the only owner update SPI. The public single-event
  `updateTransaction(...)` convenience delegates to a batch-of-one, while the
  public batch publisher passes each owner evidence batch as one whole
  immutable event array to the registered owner exactly once.
- Canonical ordered-ID and optional shared-record evidence live inside their
  owning transaction event. `updateTransactionBatch(events)` accepts no
  parallel evidence array or second evidence parameter.
- Shared relation source evidence preserves the same canonical IDs and
  many-to-one relation tuples through Undo, Redo, rollback, and every
  `SharedPublication`; Factory never reconstructs those relations from an
  initiating element.
- A cross-owner action may submit one Props evidence batch and one Scene
  evidence batch inside the same outer transaction. Factory records both owner
  batches once in the existing journal and groups them into one History action;
  Core never flattens owner missions into a synthetic cross-owner batch.
- One intended action opens one outer Factory transaction and creates at most
  one history action.
- Ordinary transaction observers receive canonical evidence only after the
  transaction owner commits successfully. Multiple owner evidence batches are
  released as one ordered observer batch.
- Rollback or transaction-owner finalization failure discards pending ordinary
  observer evidence, so no consumer can observe a canonical prefix that did
  not commit.
- Every Factory transaction has the same canonical record, commit, and rollback
  semantics. It accepts no atomic/progressive mode and has no second
  transaction route.
- Factory records canonical source evidence only.
- The existing Factory journal and Undo stack are the only local action-history
  owners. Factory creates no AI/bulk-specific forward/inverse artifact,
  parallel applied-result mirror, action-completion snapshot, or second
  history representation.
- Render and UI consume ordinary canonical owner batches and local computed
  projection directly; they never consume History, rollback, or inverse
  evidence.
- Factory is the only owner that may derive `SharedPublication` evidence. An
  eligible staged canonical slice, committed remainder, or rollback
  compensation all leave Factory through the same minimal
  `SharedPublication` route.
- The App may request the next prepared stage only through the active
  shared-delivery handle owned by the current Factory transaction. The handle
  validates every requested ordered ID against canonical evidence already
  present in that journal; it is not a transaction mode, is never returned by
  Core, and becomes stale when the outer transaction settles.
- A staged slice becomes publication-eligible only after Factory assigns stable
  transaction, publication, and slice identity from the existing journal.
  Actual compensation identity is added only when compensation exists. A
  committed remainder must not republish an already acknowledged staged
  record.
- Shared-delivery bookkeeping records acknowledged externally visible slice
  tokens only. On rollback, Factory derives compensation for only those tokens
  from the same journal evidence and emits it through the ordinary
  `SharedPublication` route; it never mirrors the canonical payload into an
  applied-result object.
- The production fast path performs no post-action `save`, equality
  comparison, finalize-save, full-document comparison, evidence clone, or
  recursive immutable-tree scan.
- Core never returns or transports the shared-delivery handle.
- Transport framing, encoding, queueing, watermarks, and peer receipts never
  enter Factory.
- Remote transactions create no local Undo action, echo publication, or client
  persistence snapshot.

The Factory facade must not expose multiple compatibility routes for the same
transaction or publication semantics.

## Profiling Contract

Product APIs return product results only.

Profiling uses existing marks, spans, journal/publication observers, or a
dedicated diagnostic observer. It must separately measure:

- local canonical action;
- Props and Scene Tree preflight/apply;
- Factory journal and publication derivation;
- local computed projection;
- publication encode;
- provider queue and wire drain;
- worker decode;
- remote canonical apply;
- remote local computed projection;
- Render/UI;
- E2E harness overhead.

Diagnostics must not change result types, transaction semantics, publication
identity, or scheduling behavior. Production no-media high-detail tests and
correctness tests remain independent.

## Pre-Release Removal Policy

There is no released legacy surface to preserve. At the owning step:

- replace direct consumers;
- delete obsolete APIs and branches;
- delete compatibility-specific tests;
- update public package docs;
- prove no supported import or documented surface still references the removed
  contract.

Deprecated aliases, fallback adapters, dual writes, runtime capability probes,
and hidden compatibility shims are forbidden unless the user explicitly
creates a separate compatibility requirement.

## Current Worktree Disposition

Existing valid work is not reset wholesale.

Retain only code and tests that remain valid under this plan, including
correctly isolated immutable artifacts, binary worker encoding, opaque
transport, byte backpressure, and exact performance evidence.

Remove or rewrite:

- duplicated computed shared evidence;
- app-level no-op acceptance patches for that duplication;
- optional batch/capability paths;
- Provider multi-mode and lease negotiation;
- Core batch-result delivery/timing leaks;
- Scene Tree `UsingActiveProperties` mutation branches;
- Factory/app coordination surfaces that no longer have one independent
  framework mission.

Each file is absorbed only when its owner step begins. Unrelated user changes
are never overwritten.

## Inspector Owner Step Order

Implementation was explicitly authorized on 2026-07-28. Before each runtime
owner segment, re-read the synchronized Inspector and issue a Step Execution
Card. Advance only after focused formal tests and bounded review report no
P0-P2 finding.

### Non-runtime readiness segment

`contract-readiness-realignment` synchronizes this plan, the app performance
status, the exact Inspector routes, Inspector contract test, BDD, and shared
viewer registration. It is docs/tests-only, is not a runtime Inspector owner,
and must first prove the conflicting old contract fails.

### Runtime owner segments

Each identifier below is one exact Inspector step and appears exactly once.
The segment may change only that step's implementation boundary and direct
consumers named by its contract.

1. `project-render-state`
   - Define and test the ordinary local computed Render and affected
     UI-context projection handlers without registering them on the existing
     `UPDATE_COMPUTED_DATA` event. Existing Render delivery remains unchanged
     and there is no second active Render consumer.
2. `record-and-deliver-transaction-batch`
   - Establish the required `TransactionOwner.updateTransactionBatch(...)`
     owner-only SPI and make the public scalar convenience delegate to
     batch-of-one first, then consolidate the required SharedDataChannel batch
     SPI, one existing journal/history semantic, Factory-owned publication
     identity, and compensation without a parallel artifact/status stream.
     Factory records
     `UPDATE_ELEMENT_DATA` but no computed projection evidence.
3. `prepare-and-apply-property-batch`
   - Give Props Manager one whole-batch preflight and one apply boundary for
     active property value/record patches as well as schema, instances,
     relationships, registration, exact orphan property-graph removal, and
     ordered property evidence.
4. `prepare-and-apply-scene-mutation`
   - Add read-only element-to-property target resolution and typed raw
     `UPDATE_ELEMENT_DATA` mutation, then replace parallel
     `UsingActiveProperties` mutations with typed lifecycle preparation and one
     Scene-only apply owner. Establish the derived reverse element-property
     relation index, shared-target aggregation, and relation-aware removal
     prepared mutation. Update the exact Factory/Preset consumers of the renamed raw evidence
     in the same owner handoff.
5. `prepare-one-composition-request`
   - Migrate the App composition caller to one Group plus one all-children Core
     request. Obtain the one active shared-delivery handle directly from
     Factory rather than through Core, and use it only for downstream slice
     requests. The App batch-result and delivery-handle migration completes
     before Core deletes `createElementsInParentBatch`; this is dependency
     ordering, not a compatibility contract. Complete the canonical
     descriptor-to-Props creation handoff before computed becomes local-only so
     element creation no longer depends on a mixed computed/property write.
6. `coordinate-canonical-owner-preparations`
   - Make `createElementsInParent` the only plural creation implementation;
     add plural `updateElementProperties` and `patchElementProperties`;
     coordinate every prepared Props/Scene mutation required by each request without
     inventing an unused owner mutation; migrate all direct canonical callers,
     including focused E2E fixtures; and remove Factory delivery/timing from
     Core. The transient vector preview is intentionally left as a local-only
     dependency of the next single semantic handoff, not treated as a
     canonical caller.
7. `derive-local-computed-projection`
   - With every canonical caller, including element creation, already migrated,
     switch property-to-computed derivation and explicit animation-safe local
     computed updates to the ordinary local reactive route. In the same
     semantic switch, migrate the transient vector preview, delete the mixed
     Core `changeComputedData*` facade and Reactive Events
     `CHANGE_COMPUTED_DATA*` commands, register the prepared Preset handler, and
     stop routing computed evidence through Factory/shared Render observation.
     Asyra Design continuation and vector-icon derived-state consumers normalize
     scalar, ordered batch, and patch projection events without duplicate work.
     Props expands changed property IDs through its read-only ordered ancestor
     closure, then Scene maps only the resulting property roots through its own
     element-slot reverse relation index before emitting one computed batch.
     Neither owner duplicates the other's relation graph. Local computed APIs
     accept no `EVENT_OPTIONS`. Preset moves its existing
     `@asyra/reactive-events` workspace entry from development-only metadata to
     a runtime dependency because production now imports that event subscriber;
     this adds no package or installation. A forced-rollback Pen Tool cancel
     clears the vector transient caches and reprojects current canonical Props
     through the same local computed route; ordinary commit-current interruption
     continues to finalize through `onEnd`.
8. `publish-shared-publication`
   - Replace optional Provider modes with one required publication path and one
     exclusive async inbound consumer. Generic Collaboration forwards the
     Factory-owned minimal `SharedPublication` unchanged through one serial FIFO, calls
     `sendPublication` once per publication, and invalidates not-yet-handed-off
     entries across disconnect generations without replay. Inbound delivery is
     the direct `SharedPublication`; its callback remains pending until App
     apply settles, reports `process-failed` before rejecting the same error,
     and has no generic sender-context envelope. The memory reference transport
     creates one detached snapshot per peer, owns one bounded peer slot, does
     not make the current sender acceptance wait for peer apply, and uses the
     connection token to release stale capacity waiters without replay after
     reconnect. Remove batch, lease, max-capability, clone/rebuild, and runtime
     compatibility branches from the public package.
9. `transport-publication-bytes`
   - Migrate the Asyra Design provider, worker, and reference server while
     preserving versioned binary data, opaque relay, byte backpressure, and
     distinct receipts.
10. `apply-remote-publication`
    - Validate and classify one remote publication into one ordered
      `CanonicalChange` request, then invoke `Core.applyCanonicalChanges(...)`
      exactly once inside one remote Factory transaction. Settle the required
      async consumer, derive computed state locally, and create no Undo, echo,
      or persistence.
11. `persist-local-commit`
    - Prove local action, Undo, and Redo each capture one FIFO snapshot while a
      remote transaction captures and writes none; change production only if
      the focused gate reveals an owner mismatch.

### Non-runtime closure segments

After all eleven runtime owners pass:

1. Prove initial creation plus blue-whisker and red-pupil property follow-ups
   converge through property-only shared evidence with local computed
   projection on both actors.
2. Synchronize the surviving app performance plan and Inspector, then resume
   its independent correctness, CRDT, performance, and visual gates.

A runtime owner segment may be reordered only by first updating the exact
Inspector routes and proving that no consumer is temporarily supported by a
compatibility branch. Runtime owners may not be combined to make an
intermediate test pass.

## Step-Local Formal Gates

### Canonical versus computed

- Existing formal tests must first demonstrate that computed events currently
  enter shared/history evidence.
- Existing formal tests must first demonstrate that
  `changeComputedData*` currently mutates canonical Props and therefore cannot
  be renamed into a local-only API in place.
- Plural canonical value and record-patch APIs update Props with one preflight,
  one apply, and one ordered property evidence batch.
- One local property edit publishes only its canonical property change.
- Raw name/visibility/lock changes publish `UPDATE_ELEMENT_DATA`, never a
  computed-named event.
- The peer derives computed state locally and Render reaches the same result.
- Undo and Redo replay property state and locally recompute Render state.
- A direct computed update reaches Render but produces no history,
  publication, persistence, or remote apply.
- A future-animation test double may update computed state repeatedly without
  any shared output.
- Local computed APIs accept no `EVENT_OPTIONS`, change no property component,
  and cannot create canonical evidence.
- No `changeComputedData*` public Core/App compatibility alias remains.

### SharedDataChannel

- One and many changes use the same required batch implementation.
- Batch order and immutability are preserved.
- Public single convenience is exactly batch-of-one.
- Registration rejects a channel missing the required method shape.
- No atomicity flag, prototype/identity branch, or single fallback remains.
- Custom behavior is not probed or repaired.

### Props Manager

- A later invalid property item leaves no property, instance, relationship,
  registry, or evidence prefix.
- A mixed active-property batch containing value replacements and record
  patches validates completely before mutation and emits one ordered evidence
  batch.
- Missing relation-backed record set, record remove, shared-child retention,
  owner order, and inverse evidence are exact and atomic.
- Core uses the public prepare/apply owner capabilities; direct property-ID
  callers may use the composing `updateProperties(...)` convenience.
- Schema, IDs, order, relationships, property instances, registrations, and
  Props-owned component registry/type/lifecycle validity remain exact.
- Single-item convenience is equivalent to a property batch-of-one.
- Two element relation tuples may reference one compatible component ID; exact
  creation, update evidence, orphan graph removal, inverse evidence, and
  rollback do not infer exclusive element ownership.
- Exact orphan graph removal retains a root or descendant while any canonical
  relation remains and removes the final orphan graph only once.
- If an orphan root graph contains a descendant that remains another element's
  root, traversal stops at that retained Scene root and preserves its complete
  descendant graph until its final element relation is released.
- Props Manager does not mutate Scene state.

### Scene Tree and Core

- One accepted remote publication produces one ordered `CanonicalChange`
  request and exactly one `Core.applyCanonicalChanges(...)` call inside its
  caller-owned Factory transaction; different publications are never merged.
- A later invalid element-to-property resolution leaves no Props or Scene
  mutation and returns no partial resolved target set.
- Alias resolution and owner relations are exact and read-only.
- `ElementPropertyRelation` identity is
  `(ownerElementId, ownerPropertyName)` and compatible `componentId` values may
  repeat across relations.
- Equivalent shared-property targets aggregate into one mutation; conflicting
  targets fail before Props preflight with no owner prefix.
- The derived reverse relation index remains equivalent after load, insert,
  removal, restore, rollback, Undo, and Redo.
- Removal evidence distinguishes released and retained relations, orphan roots,
  and the complete retained Scene root set, and rejects a stale relation set.
- A later invalid Scene item leaves no Scene map, parent-list, hierarchy order,
  tombstone, or Scene evidence prefix.
- IDs, order, parent children, hierarchy, and Scene evidence remain exact.
- Each lifecycle planner accepts only its required evidence.
- One typed prepared Scene mutation crosses one Scene-only apply boundary.
- Single creation is equivalent to plural creation with one item.
- Single element-property convenience is equivalent to the matching plural
  batch-of-one.
- Existing group, geometry, vector topology, stroke/fill, and property-panel
  callers use canonical Core property APIs before computed becomes local-only.
- No `createElementsInParentBatch`, delivery handle, or timing result remains
  in Core exports or direct consumers.
- Both prepared Props and Scene mutations complete preflight before Core asks either owner to
  apply when the request mutates both owners; a property-only request requires
  no prepared Scene mutation.
- Direct Scene removal retains active Props; Core full lifecycle removal
  coordinates exact orphan graph cleanup.
- Detached canonical creation takes the frozen `ownerRelations` from the
  owner-issued `PreparedCanonicalElementInsertion` and passes them unchanged into
  Props `create-exact-property-graph`; Core never reconstructs Scene slots.
- Remote exact flat removal uses one origin-neutral canonical-data Core API.
  Collaboration consumes the resulting Scene and optional Props owner batches
  once; no `UsingActiveProperties` alias or local/remote mode remains.
- One-root subtree removal uses `prepareSubtreeRemoval(...)` and the same
  `applyPreparedElementMutation(...)`; its relation release, orphan, retained root,
  rollback, Undo, and Redo evidence covers the complete child-first closure.
- Core load calls `preflightLoadPropertyRelations(...)` with detached validated
  Props data before any owner apply, version update, or file-load-complete
  publication.

### Factory

- One action records its ordinary owner batches once in the existing journal
  and produces one history action.
- Committed owner batches reach ordinary observers once as one ordered batch
  only after owner finalization succeeds.
- Rollback or owner-finalization failure publishes no ordinary observer prefix.
- Undo, Redo, rollback, and progressive compensation are exact.
- Shared relation source evidence retains canonical component IDs and relation
  tuples through Undo, Redo, rollback, `SharedPublication`, and remote apply.
- Computed projection evidence is absent from the journal and
  `SharedPublication`.
- Remote apply creates no Undo, echo, or local persistence.
- Observer mutation cannot alter another consumer's evidence.

### Collaboration and transport

- Provider exposes one required send path and one required async receive path.
- Publication order and one-publication/one-remote-transaction identity are
  preserved.
- Memory and WebSocket providers implement the same semantic interface.
- Binary round trip, truncated input, oversized indivisible record, slow peer,
  disconnect, byte watermark, and receipt ordering tests pass.
- Generic Collaboration contains no hard-coded provider grouping or concurrency
  policy.

## Integration and Performance Gates

Owner steps run focused tests only. Heavy tests run once after architecture
closure unless the changed owner requires one narrow high-detail diagnostic.

Final handoff to the app performance plan requires:

1. affected framework package unit/integration tests, Asyra Design focused
   integration tests, lint, and production build;
2. default 16-item Agent CRDT correctness;
3. initial high-detail cat-face creation on Actor A;
4. Actor B full completion, not only first visible state;
5. blue-whisker and red-pupil follow-up convergence;
6. separated A product, Factory journal/publication, encode, queue/drain,
   decode, B apply, computed projection, Render/UI, and harness timings;
7. no loss of detail, canonical IDs, hierarchy, history, or one-action Undo;
8. shared-root update fanout, non-final relation removal, final orphan cleanup,
   Undo, Redo, and remote CRDT apply preserve exact relation tuples and
   component IDs;
9. synchronized live visual review through `app-visual-review-sync` when the
   app plan reaches visual closure.

The 7,112 balanced gate, independent 7,076 high-detail CRDT/performance gates,
27,471-element maximum-detail gate, and optional full two-window recording
remain owned by the resumed app performance plan. Generated media, traces, and
profiles are never committed.

## Stop Conditions

Stop the current owner step and report the first incorrect owner when:

- computed output cannot be derived locally from canonical source data;
- a downstream package must reconstruct upstream canonical semantics;
- progressive compensation requires a Core return-type leak;
- a Provider requires multiple framework semantic modes rather than internal
  transport scheduling;
- a custom implementation can work only through compatibility probing;
- one atomic prepared Scene/Props mutation would leave a committed prefix;
- a shared component update cannot project to every active relation from one
  exact Scene-owned derived index;
- root cleanup cannot distinguish a released relation from the final orphan
  relation without duplicating Scene canonical state in Props;
- one focused gate fails three implementation attempts;
- closure would require a third-party dependency, runtime upgrade, backend DB,
  animation implementation, Contents work, or another excluded scope.

No local patch or fallback may be added after a stop condition.

## Definition of Done

- The synchronized Inspector, contract test, BDD, and public docs describe one
  exact owner flow.
- Property and structural evidence are canonical; computed evidence is local
  projection only.
- SharedDataChannel has one required batch SPI and batch-of-one conveniences.
- Provider has one required publication flow without capability branching.
- Core exposes one plural creation implementation with no Factory delivery or
  timing details.
- Core exposes one origin-neutral ordered canonical-change coordinator with no
  transport, origin, suppression, receipt, or compatibility modes; the caller
  owns its one Factory transaction.
- Scene Tree uses typed lifecycle preparation, one atomic apply owner, and one
  exact derived reverse element-property relation index.
- A compatible property component may serve many relation tuples; source-only
  property updates fan out locally, non-final removal retains it, and final
  orphan removal occurs exactly once.
- Shared relation Undo, Redo, rollback, publication, remote apply, and load
  preserve canonical component IDs and relation tuples.
- Factory's public facade and internal ownership match this plan.
- Factory publishes ordinary canonical observer evidence only after owner
  commit and publishes none after rollback or owner-finalization failure.
- Obsolete pre-release APIs, compatibility branches, and compatibility-only
  tests are deleted.
- Focused formal gates pass and the property follow-up CRDT case converges.
- The Asyra Design performance plan and Inspector are rebased and ready to
  resume their full performance-equivalence closure.
- No package, tool, push, PR, merge, or release operation occurred without
  explicit authorization.
