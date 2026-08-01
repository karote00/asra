# Package: @asyra/scene-tree

## Responsibility

Own the canonical document entity graph, raw entity state,
element-slot-to-property relations, and local computed projection.

## Owns

- entity create/remove/update operations
- parent/child hierarchy and ordering
- canonical raw entity fields and entity-level serialization
- element-slot-to-root-property relations and their derived reverse index
- local computed runtime data and ordinary projection-event delivery

## Must Not Own

- UI formatting logic
- render-engine-specific objects
- app interaction policy (tool decisions, shortcuts, session routing)
- property/component identity, lifecycle, schemas, or the property-child graph
- computed data as canonical, shared, historical, or persisted state

## Rules

- Scene Tree is source-of-truth for entity graph state, canonical raw entity
  fields, and element-slot-to-root-property relations. Props Manager is the
  independent canonical owner of property/component state and the
  property-child graph.
- Data changes must go through framework APIs, not direct map mutation.
- Scene Tree can expose read APIs freely; writes stay behind controlled APIs.
- App-level domain behavior may orchestrate Scene Tree writes, but must not
  bypass Core or app API boundaries.
- `UPDATE_ELEMENT_DATA` is canonical Scene evidence for raw `name`, `visible`,
  and `lock` fields. `UPDATE_PROPERTY` is canonical Props source evidence.
  Computed data is neither of those canonical owners.
- Canonical property/source and structural evidence is the path eligible for
  Factory history, SharedDataChannel/CRDT delivery, and persistence. Local
  computed evidence is never eligible for those routes.

### Canonical Source and Local Computed Projection

- Local property actions, remote property application, Undo, Redo, and load
  establish canonical Props values first. Element setup snapshots those values;
  later `UPDATE_PROPERTY` evidence is projected through one Scene-owned ordinary
  event-batch subscription.
- Props Manager exposes
  `resolvePropertyAncestorIds(propertyIds: readonly string[]): readonly string[]`
  as a read-only, ordered, deduplicated closure over its property-child graph.
  Scene uses that closure so a changed nested property can reach each related
  root without duplicating the Props graph.
- Scene maps the resolved property IDs through its
  component-to-element reverse relation index. One shared root property is
  updated canonically once, then projects locally to every current
  `ElementPropertyRelation`.
- `updateLocalComputedData(updates: readonly LocalComputedDataUpdate[]): void`
  and
  `patchLocalComputedData(updates: readonly LocalComputedDataPatchUpdate[]): void`
  are the only explicit local computed mutation APIs. Both are batch-only; a
  one-element operation uses a batch of one.
- `projectLocalComputedDataFromPropertyIds(propertyIds: readonly string[]): void`
  is the read-current-canonical projection API. It resolves the complete
  ordered Props ancestor closure, maps those properties through Scene's
  reverse relation index, and replaces affected local computed values without
  creating a canonical write.
- Both local APIs validate the complete batch before mutating the first
  element. Duplicate or inactive element IDs, invalid patch shapes, and
  attempts to write canonical raw keys reject without a partial prefix.
- Value updates emit ordinary local `UPDATE_COMPUTED_DATA` event batches.
  Record/value patches emit ordinary local `UPDATE_COMPUTED_DATA_PATCH` event
  batches. Equal values and missing removals are inert.
- Neither local API accepts `EVENT_OPTIONS`, mutates a property component, or
  enters a Factory transaction. Computed events are excluded from Undo/Redo
  history, rollback evidence, SharedDataChannel delivery, Collaboration
  publications/CRDT, Scene serialization, and persistence snapshots.
- Core exposes same-mission `updateLocalComputedData(...)` and
  `patchLocalComputedData(...)` facades plus the read-only
  `projectLocalComputedDataFromPropertyIds(...)` projection facade. No mixed
  computed/property API or computed compatibility command remains.
- A forced-rollback interaction cancel first clears its transient projection
  caches, then uses the property-ID projection facade to restore current
  canonical Props before cancel cleanup returns. An ordinary Feature System
  `commit-current` interruption instead finalizes through the feature's
  `onEnd` path.
- Preset owns the single ordinary computed-event batch consumer for Render and
  UI Context. It sends each semantic change to Render once and flushes affected
  UI Context entries once per observer batch; app-derived local state may
  observe the same ordinary batch route, but no shared computed observer runs
  in parallel.
- This local route is also the reserved boundary for a future single-machine
  animation tick, which may update computed state without changing Props or
  producing CRDT data.
- During add/remove, initialization plus parent/children/computed setter changes
  are internal graph side effects and are collapsed before journal publication;
  the explicit ADD/REMOVE event with parent/index metadata is the sole
  reversible scene-tree owner for that graph operation.
- Reversible `addNewElement` records the actual parent id/index after placement,
  and removal records them before graph mutation. Inverse add resolves that
  parent through the owning Scene Tree and restores the same deleted instance
  at the same index.
- `addNewElements` validates all ids and the parent slot before mutation,
  constructs the ordered elements, applies parent membership with one child
  list write that bypasses generic Setter clone/change capture, records one
  reversible add change per ordinary element, and commits the state-owner
  transaction once. Those ordered add records are the sole history, replay,
  Render, persistence, and optional Collaboration evidence; the internal
  clone-free write is not a second event route. It is the canonical owner
  behind Core's `createElementsInParent`; it is not a direct-map fast path.

### Creation Lifecycle

- `addNewElement(...)` and `addNewElements(...)` remain ordinary
  `CreateElementData` conveniences; the scalar API delegates to the same
  batch-of-one path.
- Cross-owner framework creation goes through Core. Core obtains the prepared
  Props property-graph batch and prepared Scene mutation before either owner
  applies.
- Scene `prepareElementInsertion(...)` validates ordinary Scene entries and
  their owner relations without applying them. It also prepares the exact
  relation-index update once.
- Scene `prepareCanonicalElementInsertion(...)` validates detached canonical
  entries and issues the exact frozen element-slot-to-property relations.
  Core passes those relations unchanged to Props rather than asking Scene to
  materialize or register property instances.
- `applyPreparedElementMutation(...)` is the only Scene map, relation, and
  hierarchy apply owner for both prepared mutation kinds. Apply consumes the
  prepared relation-index update directly; it does not serialize each
  materialized element to rediscover or deep-compare the same relations.

These APIs describe data lifecycle; none accepts a local/remote mode or checks
caller origin. An active transaction owner must accept the complete ordered
Scene evidence through one batch handoff.

### Removal Lifecycle

- Direct Scene `removeElement(...)` and `removeSubtree(...)` own Scene
  lifecycle only and retain Props.
- `prepareCanonicalElementRemoval(...)` validates an ordered exact flat
  removal; `prepareSubtreeRemoval(...)` derives and validates one complete
  child-first subtree closure.
- Both prepared mutations include exact released relations, orphan property
  roots, retained roots, parent/index evidence, and staleness evidence. Scene
  does not inspect the Props graph.
- Core owns complete element-plus-property removal: it passes the Scene-issued
  orphan and retained roots unchanged to the prepared Props exact orphan-graph
  batch, then applies the prepared Scene mutation and optional Props batch
  inside the caller transaction.
- Replay and Collaboration use the same origin-neutral canonical Core facade.
  There is no active-property API family or local/remote branch.

A semantic no-op is not successful apply evidence, Scene and Props records are
not reordered, and a later invalid entry leaves no hierarchy, map, tombstone,
relation, transaction, or publication prefix.

## Extension Points

- register component/entity definitions
- query, remove, and define exact component-property relations through Core
- register component property definitions whose canonical Props values project
  into local computed data
- validate load payload via `validateLoadData(...)` before apply
- consume only that Scene Tree instance's owner-issued one-shot result through
  `applyValidatedLoad(...)`; plain/foreign/reused artifacts fail before mutation
  and validators do not rerun during apply

App-defined property fields use the same projection path as builtin fields.
Scene Tree projects only the complete canonical result of property `getValue()`
into local computed element data during setup or canonical-property event
projection. It does not reconstruct removed or non-projected fields from
schema/defaults, interpret custom field meaning, or become a second schema or
property-graph owner.

## Release-Blocking Group Hierarchy Contract

Scene Tree owns the canonical atomic contract for group-backed hierarchy
mutation, reparent/reorder, and subtree lifecycle behavior.

- Scene Tree owns validation, exact before/after parent/index evidence, cycle
  prevention, one-parent membership, deterministic order, and subtree
  restoration for every registered `isContainer` component.
- The Core-facing operation boundary is ID-based; apps and Preset must not need
  internal Group instances or mutate `parentId`/`children` directly.
- A hierarchy move preserves entity identity and is not modeled as deleting and
  recreating a different entity.
- `moveElements(...)` validates the complete request before the first mutation,
  interprets `targetIndex` against the final target child list, and preserves
  canonical source sibling order for contiguous or non-contiguous ids.
- `removeSubtree(...)`, `restoreSubtree(...)`, and replay through
  `applySubtreeChange(...)` retain exact identity, parent, index, child order,
  and raw Group data. Stale replay evidence fails instead of partially applying.
- Core may call `preflightRestoreSubtree(..., { propertyState:
  'pending-restore' })` while coordinating an atomic Props + Scene restore.
  This mode defers only the active-property assertion; all hierarchy and
  relation evidence is still validated, and `applyRestoreSubtree(...)` always
  revalidates the ordinary active-property contract before mutation.
- Preset owns only official Group defaults and basic coordinate/bounds adapters;
  app interaction and UI policy remain outside Scene Tree.

The supported cases and release-gate ownership are defined by
`../plans/completed/group-component-and-hierarchy-behaviors-plan.md`.

## Validation Checklist

- Entity creation updates graph + computed data consistently.
- Ordered batch creation applies parent membership once without generic
  growing-array cloning and keeps every element individually editable and
  reversible through its ordinary add evidence.
- Entity removal cleans graph references.
- Rollback/undo restoration preserves parent ownership and child order.
- Rollback, Undo, and Redo restore canonical raw/Props sources; computed values
  are then derived locally through the same projection boundary.
- Save/load round-trip preserves graph shape, raw state, and
  element-slot-to-property relations. Computed values are excluded from the
  serialized payload and reconstructed locally from canonical Props values.
- Computed projection produces no Factory history/rollback evidence,
  SharedDataChannel batch, Collaboration publication, or persistence write.
- Load validation first applies its documented invalid/unregistered-record
  normalization, then rejects any resulting missing or duplicate membership,
  invalid parent, cycle, or malformed child order before replacing current
  state.

## Component Relation Contract

- component definitions are retained declaratively and each `properties[]` slot
  becomes one graph `detach` relation
- relation identity is component-local `{ componentType, propertyName }`; two
  components may use the same property name with different exact definitions
- remove/define builds the complete next dynamic component class and property
  indexes before swapping registry state
- relation mutation preserves component identity, counters, unrelated slots,
  render registrations, and the property target
- active component instances block mutation with a structured
  `REGISTRATION_IN_USE` failure
