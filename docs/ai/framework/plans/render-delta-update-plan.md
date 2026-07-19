# Plan: Render Delta Update Pipeline

## Goal

Project committed Scene Tree changes into a complete Render-owned derived snapshot,
apply scalar, batch, and record deltas atomically, and preserve the same render
result as a fresh authoritative snapshot without moving canonical ownership out of
Scene Tree.

## Authority and Baseline

- Scene Tree remains the canonical owner of element raw and computed data.
- Factory shared data channels transport committed changes in transaction order;
  they do not become a second state owner.
- Render owns one derived snapshot per live non-workspace element. A strategy may
  consume that complete snapshot but must never read Scene Tree directly.
- The current implementation already contains an element-id keyed Render mirror,
  but it silently reseeds missing entries, permits an empty-object record base,
  and does not define atomic failure, resync, teardown, or equivalence semantics.
- The formal dense-vector profile is
  `apps/asyra-design/e2e/render-delta-performance.spec.ts`: 56 points, a
  self-intersecting closed path, a solid fill, and 12 transient drag frames.

## Scope

In scope:

- the Scene Tree committed-change to Render projection contract
- explicit initial snapshot, delta validation, atomic patching, and resync
- add, remove, load, undo, redo, replay, frame coalescing, and teardown parity
- exact full-snapshot equivalence and bounded cache lifecycle tests
- the existing engine-neutral strategy and command handoff
- a formal dense-vector count and timing budget

Out of scope:

- new Scene Tree mutation semantics or canonical state
- a new data-channel state owner, revision authority, or persistence format
- new vector geometry/fill caches or hard-coded vector invalidator lists
- render-engine or Pixi contract/implementation changes
- Feature System, Input System, tool, session, or product behavior changes
- app deep imports or fallback product output

## Product Contract

### 1. Committed delta semantics

Render accepts only committed `SceneTreeChange` payloads routed by the registered
Preset data-channel observer:

- add and load establish an authoritative complete base snapshot
- add and remove carry canonical `parentId` plus sibling `index`; Preset forwards
  that metadata unchanged, Render places an added child at the exact index, and
  atomically patches an existing non-workspace parent `children` mirror before
  queuing the complete parent snapshot. A parent membership precondition mismatch
  enters explicit parent resync instead of accepting stale sibling order
- scalar change carries one top-level `key`, `before`, `after`, and its canonical
  `raw` or `computed` owner provenance
- batch carries an ordered list of owner-qualified scalar changes and is one
  atomic projection
- record patch carries replacements for existing top-level computed values plus
  record `set` and `remove` entries; each top-level value base must already exist
  as an own property in the computed snapshot and each top-level record must be
  an own record
- one top-level key may appear in either the value-change map or the record-patch
  map, never both; Scene Tree rejects an overlapping patch before mutation
- one record id may appear in either a record `set` map or `remove` list, never
  both; Scene Tree rejects the ambiguous patch before mutation
- one multi-element computed patch deduplicates target ids, reads each existing
  target snapshot once, and prevalidates every target before mutating the first;
  any invalid target rejects the full request without applying a canonical
  prefix, and each valid target applies once
- remove invalidates every pending frame update before removing the visual;
  snapshot ownership is retained until that visual release succeeds

`after` is the committed value. `before` is a projection precondition, not an
alternative source of truth. A top-level value patch never creates a computed
owner; a missing value base is rejected before canonical mutation. Record addition
requires the record id to be absent; record replacement/removal carries a `before`
own property even when its value is `undefined`, and requires that recorded value
to deep-equal the current derived value. Property existence, not
`before === undefined`, distinguishes addition from replacement. Missing record
bases are invalid and must never become `{}`.

Batch and record patch validation completes before any cached object is changed.
One failed precondition rejects the entire delta; no prefix may become visible.
Accepted changes install a new top-level snapshot atomically. Changed records are
copied before modification so a previously published strategy snapshot is not
mutated later. Deep precondition comparison is cycle-safe for the complete
`DataTypes` domain, compares every enumerable own array property, and retains
exact sparse-array semantics: an array hole and an own `undefined` slot are not
equivalent.

Before installation, every scalar, batch, and patch candidate is merged with the
same computed-over-raw precedence and must still have the requested `id`, a
non-empty `type`, and a non-workspace type. An incomplete candidate is a projection
mismatch: it is never published and enters the same explicit authoritative resync
route as a failed `before` precondition.

The explicit base records raw and computed ownership separately. Scene Tree is
the only owner that knows which canonical setter produced a scalar change, so it
records that `raw` or `computed` provenance on every scalar and batch entry.
Render validates and updates only the declared slice. It never infers ownership
from a key name, the presence of a key in either slice, or a hard-coded property
list. This remains exact when declarative properties project computed fields with
the same name as raw fields such as `visible`, `name`, or `lock`.

Factory preserves that owner provenance when it expands an owner-qualified batch
for rollback, undo, or redo. Scene Tree replay consumes the carried owner and
never re-infers it from the key or current raw/computed state. A replay event
without valid owner provenance is rejected before mutation. Factory inversion and
Scene Tree patch replay materialize top-level keys and record ids as own
enumerable data properties so legal special names survive the round trip.

The installed strategy input remains the complete merged snapshot, with computed
data taking the same precedence as a fresh
`{ ...element.save(), ...element.getAllComputedData() }`. A raw change shadowed
by a same-name computed value updates the raw projection but does not issue a
direct visual change from the shadowed raw value.

### 2. Snapshot ownership and initial source

The Render scene-tree store owns the derived snapshot only. Its sole cache key is
`elementId`; it has no vector type, property key, record id, zoom, or app-specific
dimension.

Add and load use an explicit Render resync reader over the public Scene Tree owner
to compose `{ ...element.save(), ...element.getAllComputedData() }`. First-use and
ordinary update paths may not seed implicitly. A complete base is required before
any delta can render. The merged snapshot must have the requested `id`, a non-empty
`type`, and must not be a workspace. A missing canonical add target clears its
matching pending update and stale visual before returning `removed`; an existing
target that throws or fails this completeness check clears stale output and
returns `failed`. A visual add that reports failure, including a caught strategy
failure, is an authoritative add/load/resync rebuild failure. The synchronous
strategy call returns that rebuild result to the add/load controller before the
controller reports its projection outcome.

Load rebuilds parents before their children and siblings in canonical parent
`children` order, independent of Scene Tree `Map` insertion order, and forwards
each exact sibling index to Render placement.

The data-channel observer only routes the committed payload and receives the
projection outcome. It does not assemble or retain the snapshot.

Initial registration and every later re-registration of the Preset Render
observer perform the same explicit full rebuild immediately after the observer is
installed. Shared-channel delivery is not replayable, so commits that occurred
while the observer was absent are recovered from the current authoritative Scene
Tree snapshot, never from retained Render output or a data-channel backlog. A
registration that cannot complete this rebuild fails at the Preset registration
owner and uses its existing cleanup rollback.

File-load completion invokes the Render rebuild through Preset's synchronous
lifecycle handler so any failure propagates to the `core.load()` caller. UI and
vector-editing file-load consumers remain separate observers.

### 3. Ordering, duplicates, and missing delivery

Factory owns ordered, exactly-once delivery of transaction journal entries to each
registered shared-channel observer. Render does not invent a second sequence or
revision authority.

Render validates every supplied `before` image. A detectable missing, duplicate,
or out-of-order delta therefore becomes a projection mismatch and enters the
explicit resync route. Because the current change schema has no revision, Render
does not claim to classify an ABA-shaped stale duplicate by itself; such delivery
violates the Factory exactly-once contract and is prevented and tested at that
owner boundary.

### 4. Explicit resync and failure

Missing base, invalid record base, or any `before` mismatch produces no partial
strategy call and no fallback snapshot. Render marks the entry invalid, removes
its pending update, and performs one explicit authoritative resync from Scene
Tree.

- successful resync replaces the entire derived snapshot and synchronously uses
  the existing Render add-or-update route to rebuild from that complete snapshot;
  the strategy result returns to the resync controller before the outcome is
  formed, and it returns `resynced` only after that rebuild succeeds
- if the canonical element no longer exists, Render removes the stale visual and
  treats the entry as removed
- if a complete authoritative snapshot cannot be composed, Render clears the
  stale visual and returns a failed projection outcome
- if the authoritative strategy rebuild fails, Render clears the stale visual
  and returns a failed projection outcome instead of reporting deferred success

Projection outcomes are `applied`, `resynced`, `removed`, or `failed`; observer
error swallowing is not used as correctness control flow. Every resync and failure
has bounded diagnostic evidence.

### 5. Frame ordering and strategy input

Multiple accepted deltas for one element may patch the derived snapshot in commit
order and coalesce to one frame. The strategy receives the final complete
owner-defined snapshot for that frame. Direct `x`, `y`, `rotation`, and `visible`
updates may retain their existing direct property route after the same snapshot
validation succeeds. A mixed batch uses the complete strategy route.
Every complete snapshot update also synchronizes generic `parentId` and
`children` hierarchy; unchanged parent ownership preserves stable sibling order.
ADD/REMOVE parent membership uses the same complete parent-snapshot frame route,
so insertion, removal, undo, and redo cannot leave the parent mirror behind the
canonical child order. Workspace-root insertion uses the committed sibling index
directly because workspace elements are intentionally not mirrored.
Local hierarchy parent and sibling-order bookkeeping commits only after the
matching engine append or set-child-index command succeeds. If that handoff
fails, the pre-command local hierarchy is retained so the same complete snapshot
can retry the command instead of treating the failed attempt as already applied.

The delta itself is the changed-key record. This task does not add a retained
dependency graph or change the public strategy signature: every computed render
update reruns its strategy, which is the stale-visual safety rule. Profiling did
not justify a vector-specific invalidation cache, so Render must not hard-code
`points`, `segments`, `networks`, fills, strokes, or any future schema key.

Non-vector strategies continue receiving the same complete `RenderElementData`
shape and require no migration.

### 6. Load, undo, redo, replay, remove, and cleanup

- Load clears all snapshots and pending work before rebuilding each live
  non-workspace element from Scene Tree in canonical parent `children` order,
  with parent-first placement and each exact sibling index rather than Scene
  Tree `Map` insertion order.
- Preset invokes that file-load Render rebuild synchronously so rebuild failure
  reaches the lifecycle caller instead of becoming an observer-only error.
- Initial observer registration and re-registration rebuild from the current
  Scene Tree before registration returns; they do not wait for a later delta or
  file-load event.
- Undo, redo, and persistence replay commit through the same Scene Tree change and
  shared-channel route as an ordinary action; batch expansion preserves every
  entry owner and Scene Tree replay consumes that owner without inference. They do
  not use a second Render API.
- Remove clears pending work before visual removal, then destroys the detached
  Render node and releases its abstract engine handle and resources. Mirror
  ownership and projected-visual ownership are tracked separately; the matching
  snapshot and projected id are discarded only after visual release succeeds.
  Removing a projected parent first detaches projected children that
  remain live canonical elements, so only the removed parent is destroyed and
  those children retain their nodes and engine handles. Undo/redo re-add creates
  a fresh Render node from the complete authoritative snapshot and restores its
  exact committed sibling index; the matching non-workspace parent membership is
  projected into its mirror and complete snapshot. Render node identity is not a
  product contract.
- Load with no current workspace clears the retained workspace snapshot and
  resets the Render workspace identity and transform to their neutral state.
- Preset observer teardown and Render teardown clear snapshots and pending work,
  destroy every Scene Tree-projected visual node, and release its abstract engine
  handle/resources. Custom or overlay layer nodes are outside this projection
  count and remain owned by their respective lifecycle. A failed node release
  always retains the projected `elementId` retry ownership while cleanup
  continues across other projected ids. The opaque handle-to-node lookup is not
  discarded until the engine destroy command succeeds, so a failed destroy
  retains exact hit-query resolution and retry ownership. Any valid mirror
  present at that lifecycle boundary is retained across release failure. Resync
  invalidates its mismatched mirror before the authoritative read; if that read
  or seed fails and visual release also fails, the invalidated resync mirror
  remains absent and
  only projected visual retry ownership remains. A successfully seeded authoritative
  resync mirror remains valid and is retained if its later visual cleanup fails.
  This retry bookkeeping uses only the existing `elementId` dimension.
- At every stable boundary, snapshot count is at most the number of live
  non-workspace elements, and the Scene Tree projection owns at most one Render
  node per such element; repeated load/add/remove/resync cannot grow an orphaned
  entry set, projected-node set, removed-node restore map, stale strategy
  snapshot, or prior-engine handle set.

### 7. Equivalence and stale-output oracle

For scalar, batch, record patch, coalesced frame, load, undo, redo, replay, and
resync cases, the complete data supplied to the strategy must deep-equal a fresh
authoritative composition of `element.save()` and `element.getAllComputedData()`
at the same committed boundary.

The engine-neutral draw-command trace produced from the delta snapshot must equal
the trace produced from that fresh snapshot. A rejected delta emits no trace from
partial data. A failed resync leaves no stale visual.

The formal app oracle exercises one real action, Factory inverse replay (undo),
Factory forward replay (redo), and `core.load()` rebuild. At each stable boundary,
the last complete strategy snapshot deep-equals the fresh authoritative
composition.

Lifecycle tests also cover observer dispose/re-registration, remove/re-add, and
Render dispose/re-init. Re-registration must immediately equal the current Scene
Tree, removed nodes must release their engine objects, and a later engine instance
must never receive a handle created by an earlier engine.

## Profiling and Cache Decision

Three repeated Chromium runs of the formal fixture produced these observed ranges:

| Phase                                          | Count/run | Observed p95 | Formal total / p95 / max budget |
| ---------------------------------------------- | --------: | -----------: | ------------------------------: |
| Scene Tree canonical patch                     |        12 |   1.0–1.4 ms |                   24 / 4 / 6 ms |
| transaction publish + Render snapshot delivery |        12 |       0.1 ms |                    6 / 1 / 2 ms |
| vector strategy geometry                       |        12 |   1.5–1.8 ms |                   24 / 4 / 6 ms |
| engine handoff per frame                       |        12 |   0.9–1.0 ms |                   18 / 3 / 5 ms |

The combined phase p95 budget is 12 ms. Render delta apply count must be 12 and
Render full rehydrate count must be 0. Across all canonical/UI consumers,
`element.save()` is bounded to 12 calls and `getAllComputedData()` to 13 calls;
these are separate from the zero Render seed count. The fresh full-snapshot
reference measured 0.1 ms p95, so profiling does not permit a new or expanded
vector geometry cache. The existing element-id derived snapshot remains the
semantic target of the delta projection; its dimension may not expand without new
profiling.

## Owner Slices

1. Scene Tree committed delta and Factory ordered delivery contracts.
2. Render explicit seed/resync and cache lifecycle.
3. Render atomic scalar, batch, and record-patch projection.
4. Render frame coalescing, full strategy input, and engine-neutral handoff.
5. Lifecycle/equivalence/performance integration, documentation, and visible-app
   evidence.

Each slice follows the matching dedicated Inspector owner step and begins with a
failing formal test when the current implementation violates this contract.

## Definition of Done

- the dedicated Inspector data, viewer, and contract test resolve every owner,
  route, artifact, failure owner, implementation boundary, and cache dimension
- missing base and record-base mismatch never seed silently or create `{}`
- missing top-level value bases fail before canonical mutation and emit no delta
- scalar, batch, and record patch projection is atomic and exact
- sparse-array equality distinguishes a hole from an own `undefined` slot
- every accepted delta candidate retains requested-id, non-empty-type, and
  non-workspace completeness before strategy publication
- same-name raw/computed fields follow canonical owner provenance and preserve
  fresh merged-snapshot precedence
- rollback, undo, redo, and replay preserve owner provenance through Factory
  batch expansion and Scene Tree application, including same-name raw/computed
  fields
- add/load/resync are explicit; resync reports success only after its complete
  strategy rebuild succeeds; remove/load/teardown leave no orphaned entries or
  pending updates
- add/remove/undo/redo preserve the committed sibling index; load preserves
  canonical root and nested sibling order independent of Scene Tree `Map`
  insertion order; every non-workspace parent `children` mirror remains equal
  to canonical Scene Tree order
- ordered delivery plus Render precondition tests cover missing, duplicate, and
  out-of-order behavior without assigning canonical ownership to the data channel
- load, undo, redo, replay, direct properties, mixed batches, and non-vector
  strategies preserve fresh-snapshot equivalence; file-load rebuild failure
  propagates synchronously to its lifecycle caller
- no strategy receives partial data and no failed projection leaves stale output
- dense-vector count, total, p95, max, and combined p95 budgets pass
- render-engine/Pixi, Feature System, Input System, and app import boundaries remain
  unchanged
