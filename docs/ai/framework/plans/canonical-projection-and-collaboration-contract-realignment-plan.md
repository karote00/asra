# Asyra Pre-Release Canonical Projection and Collaboration Contract Realignment Plan

## Status

Active Level 3 pre-release architecture plan and current cross-cutting contract
authority. Production implementation was explicitly authorized on 2026-07-28
and proceeds one Inspector owner step at a time.

This plan is a release-blocking prerequisite for:

- `docs/ai/apps/asyra-design/plans/ai-conversational-drawing-performance-plan.md`;
- Framework Release Gate 5.

Architecture authority:

- `docs/ai/framework/plans/canonical-projection-and-collaboration-contract-flow-inspector.data.cjs`
- `docs/ai/framework/plans/canonical-projection-and-collaboration-contract-flow-inspector.html`
- `docs/ai/framework/plans/__tests__/canonical-projection-and-collaboration-contract-flow-inspector.contract.test.cjs`

Executable product cases:

- `docs/ai/apps/asyra-design/bdd-features/ai-conversational-drawing-performance.feature`

The Asyra Design performance plan retains its profiling evidence, product
budgets, fixtures, and visual-equivalence requirements. Its affected
architecture routes are paused until this plan has replaced the conflicting
contracts and the app plan, Inspector, contract test, and BDD have been
resynchronized.

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
7. Factory exposes transaction, history/rollback, and immutable artifact/status
   contracts. Replay, staged delivery, and compensation remain internal owners.
8. Profiling is observational evidence, not a reason to change product API
   return types.
9. `Core.changeComputedData(...)` and `changeComputedDataPatch(...)` are deleted:
   current callers use them for canonical property mutation while the names and
   events imply local computed projection. Canonical callers migrate to
   plural element-property APIs; direct local computed APIs have a separate
   name, shape, and event path.

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
3. Core exposes plural canonical element-property APIs and migrates every
   direct caller.
4. Only then does Scene Tree remove computed changes from canonical evidence
   and activate the prepared local Render projection.

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
→ Props + Scene Tree preflight plan
→ one atomic canonical apply
→ one immutable Factory transaction artifact
   ├─ one Undo/Redo action
   ├─ canonical SharedDataChannel batch
   ├─ local persistence trigger
   └─ Factory-owned progressive delivery status
→ one SharedPublication
→ Provider-owned binary framing, queueing, and backpressure
→ peer one-publication/one-remote-transaction apply
→ peer local computed projection
→ Render
```

```text
local typed element-property request
→ Core.updateElementProperties or Core.patchElementProperties
→ Scene Tree read-only element-to-property target plan
→ Props whole-batch preflight and apply
→ UPDATE_PROPERTY canonical evidence
→ Factory transaction artifact
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
- Render must continue to use computed changes as its invalidation source.
- Direct local computed mutation uses explicitly local batch APIs, accepts no
  `EVENT_OPTIONS`, and cannot be switched into a shared/history/persistence
  path by caller options.
- A no-op computed application is neither a remote canonical rejection nor a
  reason to add an app-specific replay exception; it is outside the remote
  canonical payload.

This contract deliberately reserves a clean future animation path without
implementing an animation system.

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
- The old fixed-size loop that repeatedly invokes Core is removed. Point-aware
  progressive slicing is downstream delivery policy, not repeated canonical
  mutation.

Core owns orchestration of canonical package APIs. It does not own history
artifact construction, progressive delivery, transport scheduling, or
profiling output.

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
- Core requests one read-only Scene Tree element-to-property target plan before
  asking Props Manager to preflight or apply the canonical mutation.
- Scene Tree resolves aliases such as `x`/`y` to position and
  `width`/`height` to dimension, verifies element ownership, and returns
  explicit property IDs and owner relations. It does not mutate Props.
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

It exposes a whole-batch preflight plan and one whole-batch apply boundary for
both creation/lifecycle property work and active property value or record
patch mutations:

- all schemas, IDs, property values, component ownership, instances, and
  relationships are validated before any property mutation;
- each active mutation item is an explicit typed field replacement or record
  patch against a resolved property ID and owner relation;
- apply materializes required property instances, performs relationship
  rebind/registration where required, applies active values/record patches,
  and records ordered property evidence once;
- a later invalid item leaves no property, instance, relationship, registry, or
  evidence prefix;
- Props Manager never mutates Scene maps, parent children, hierarchy order, or
  Scene evidence.

Props exposes two public owner capabilities with independent missions:

- `preparePropertyMutationBatch(...)` is read-only and returns a complete
  owner-issued property mutation plan.
- `applyPropertyMutationBatch(...)` applies only such an owner-issued plan and
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
own owner-issued plan, while documentation tells callers when to use direct
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

## Scene Tree Lifecycle and Apply Contract

Scene Tree exposes lifecycle-specific preparation because ordinary creation,
canonical insertion/replay, ordinary removal, and canonical removal do not have
the same inputs. It exposes one mutation owner because all prepared plans must
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
  element IDs, parent, index, and order.
- `prepareElementRemoval(...)` prepares ordinary Scene removal.
- `prepareCanonicalElementRemoval(...)` prepares retained canonical Scene
  evidence.
- subtree restore uses a typed canonical restore plan rather than a boolean
  option.
- `applyElementMutationPlan(...)` is the only Scene map, raw element state,
  parent-list, hierarchy order, and ordered Scene evidence mutation boundary.

The exact plan types must make their required evidence explicit. They must not
encode caller identity or use an `isRemote`, `isLocal`, `usingActiveProperties`,
or similarly overloaded mode flag.

Single-item conveniences may prepare a one-item plan and use the same apply
owner. A later invalid item leaves no Scene map, parent-list, hierarchy order,
tombstone, or Scene evidence prefix.

Property target resolution and Scene lifecycle mutation are different outputs
of the same Scene ownership boundary: the former is read-only relationship
resolution, while the latter is a typed Scene mutation plan. Neither output
may apply Props state.

Core obtains every complete owner plan required by a request before any
affected owner applies. A property-only request requires the read-only target
plan plus the Props mutation plan and does not fabricate a Scene mutation
plan. A cross-owner lifecycle request obtains both complete Props Manager and
Scene Tree mutation plans. Core invokes the required apply boundaries in
canonical evidence order inside one Factory outer transaction. Props Manager
and Scene Tree retain their independent missions; Factory rollback supplies
cross-owner atomicity if an unexpected apply failure occurs after all required
preflights pass.

The existing `*UsingActiveProperties` APIs and parallel mutation
implementations are deleted after direct consumers migrate. Documentation
teaches which lifecycle planner to choose; the framework does not block a
caller based on origin.

## Factory Ownership Contract

Factory's public mission is limited to:

- transaction execution and status;
- journal, Undo, Redo, and rollback;
- immutable committed artifact observation;
- staged artifact/status observation from the same transaction journal.

Internal owners may be split into journal, artifact builder, replay, staged
delivery, compensation, and local projection modules. Those modules are not
new public workflows.

Required behavior:

- `@asyra/reactive-events` declares
  `TransactionOwner.updateTransactionBatch(...)` as a required owner method.
  It is the only owner update SPI. The public single-event
  `updateTransaction(...)` convenience delegates to a batch-of-one, while the
  public batch publisher passes each owner evidence batch as one whole
  immutable event array to the registered owner exactly once.
- A cross-owner action may submit one Props evidence batch and one Scene
  evidence batch inside the same outer transaction. Factory combines those
  owner batches into one transaction artifact and one History action; Core
  never flattens owner missions into a synthetic cross-owner batch.
- One intended action opens one outer Factory transaction and creates at most
  one history action.
- Every Factory transaction has the same canonical record, commit, and rollback
  semantics. It accepts no atomic/progressive mode and has no second
  transaction route.
- Factory records canonical source evidence only.
- The immutable transaction artifact is detached once and reused by History,
  persistence, and Collaboration.
- Factory is the only owner that may derive `SharedPublication` evidence. An
  eligible staged canonical slice, committed remainder, or rollback
  compensation all leave Factory through the same `SharedPublication` artifact
  route; Collaboration never infers a publication from generic staged status.
- The independent staged-artifact owner observes the in-progress journal and
  emits the same artifact/status stream for every transaction. A downstream
  Render consumer may ignore staged status and use only commit, or consume
  staged status for progressive visibility; neither choice alters transaction
  execution.
- A staged slice becomes publication-eligible only after Factory assigns stable
  transaction, publication, slice, and inverse-compensation identity from the
  existing journal. A committed remainder must not republish an already
  acknowledged staged record.
- The staged-artifact owner records acknowledged externally visible slice
  tokens. On rollback, Factory derives compensation for only those tokens from
  the same journal evidence and emits it through the ordinary
  `SharedPublication` route.
- Core never returns or transports the staged-delivery capability.
- Transport framing, encoding, queueing, watermarks, and peer receipts never
  enter Factory.
- Remote transactions create no local Undo action, echo publication, or client
  persistence snapshot.

The Factory facade must not expose multiple compatibility routes for the same
transaction or publication semantics.

## Profiling Contract

Product APIs return product results only.

Profiling uses existing marks, spans, artifact/status observers, or a dedicated
diagnostic observer. It must separately measure:

- local canonical action;
- Props and Scene Tree preflight/apply;
- Factory artifact and journal;
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
   - Define and test the ordinary local computed projection handler without
     registering it on the existing `UPDATE_COMPUTED_DATA` event. Existing
     Render delivery remains unchanged and there is no second active consumer.
2. `record-canonical-transaction-artifact`
   - Establish the required `TransactionOwner.updateTransactionBatch(...)`
     owner-only SPI and make the public scalar convenience delegate to
     batch-of-one first, then consolidate the required SharedDataChannel batch
     SPI, one transaction/artifact/history semantic, Factory-owned staged
     publication identity, and compensation. Factory records
     `UPDATE_ELEMENT_DATA` but no computed projection evidence.
3. `prepare-and-apply-property-batch`
   - Give Props Manager one whole-batch preflight and one apply boundary for
     active property value/record patches as well as schema, instances,
     relationships, registration, and ordered property evidence.
4. `prepare-and-apply-scene-plan`
   - Add read-only element-to-property target resolution and typed raw
     `UPDATE_ELEMENT_DATA` mutation, then replace parallel
     `UsingActiveProperties` mutations with typed lifecycle preparation and one
     Scene-only apply owner. Update the exact Factory/Preset consumers of the
     renamed raw evidence in the same owner handoff.
5. `coordinate-canonical-owner-plans`
   - Make `createElementsInParent` the only plural creation implementation;
     add plural `updateElementProperties` and `patchElementProperties`;
     coordinate every Props/Scene plan required by each request without
     inventing an unused owner mutation; migrate all direct canonical callers;
     delete `changeComputedData*`; and remove Factory delivery/timing from Core.
6. `derive-local-computed-projection`
   - With every canonical caller already migrated, switch
     property-to-computed derivation and explicit animation-safe local computed
     updates to the ordinary local reactive route. In the same semantic switch,
     register the prepared Preset handler and stop routing computed evidence
     through Factory/shared Render observation. Local computed APIs accept no
     `EVENT_OPTIONS`. Preset moves its existing
     `@asyra/reactive-events` workspace entry from development-only metadata to
     a runtime dependency because production now imports that event subscriber;
     this adds no package or installation.
7. `prepare-one-composition-request`
   - Migrate the App composition caller to one Group plus one all-children Core
     request without owning canonical slicing.
8. `publish-shared-publication`
   - Replace optional Provider modes with one required publication path and one
     exclusive async inbound consumer; migrate the memory provider.
9. `transport-publication-bytes`
   - Migrate the Asyra Design provider, worker, and reference server while
     preserving versioned binary data, opaque relay, byte backpressure, and
     distinct receipts.
10. `apply-remote-publication`
    - Reuse the Core canonical owner flow for one remote publication, settle
      the required async consumer, derive computed state locally, and create no
      Undo, echo, or persistence.
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
  component ownership remain exact.
- Single-item convenience is equivalent to a property batch-of-one.
- Props Manager does not mutate Scene state.

### Scene Tree and Core

- A later invalid element-to-property resolution leaves no Props or Scene
  mutation and returns no partial target plan.
- Alias resolution and owner relations are exact and read-only.
- A later invalid Scene item leaves no Scene map, parent-list, hierarchy order,
  tombstone, or Scene evidence prefix.
- IDs, order, parent children, hierarchy, and Scene evidence remain exact.
- Each lifecycle planner accepts only its required evidence.
- One typed Scene plan crosses one Scene-only apply boundary.
- Single creation is equivalent to plural creation with one item.
- Single element-property convenience is equivalent to the matching plural
  batch-of-one.
- Existing group, geometry, vector topology, stroke/fill, and property-panel
  callers use canonical Core property APIs before computed becomes local-only.
- No `createElementsInParentBatch`, delivery handle, or timing result remains
  in Core exports or direct consumers.
- Both Props and Scene plans complete preflight before Core asks either owner to
  apply when the request mutates both owners; a property-only request requires
  no Scene mutation plan.

### Factory

- One action produces one immutable artifact and one history action.
- Undo, Redo, rollback, and progressive compensation are exact.
- Computed projection evidence is absent from the artifact.
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
2. default 16-item Mock AI CRDT correctness;
3. initial high-detail cat-face creation on Actor A;
4. Actor B full completion, not only first visible state;
5. blue-whisker and red-pupil follow-up convergence;
6. separated A product, artifact, encode, queue/drain, decode, B apply,
   computed projection, Render/UI, and harness timings;
7. no loss of detail, canonical IDs, hierarchy, history, or one-action Undo;
8. synchronized live visual review through `app-visual-review-sync` when the
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
- one atomic Scene/Props plan would leave a committed prefix;
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
- Scene Tree uses typed lifecycle preparation and one atomic apply owner.
- Factory's public facade and internal ownership match this plan.
- Obsolete pre-release APIs, compatibility branches, and compatibility-only
  tests are deleted.
- Focused formal gates pass and the property follow-up CRDT case converges.
- The Asyra Design performance plan and Inspector are rebased and ready to
  resume their full performance-equivalence closure.
- No package, tool, push, PR, merge, or release operation occurred without
  explicit authorization.
