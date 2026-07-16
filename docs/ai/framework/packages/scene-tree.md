# Package: @asyra/scene-tree

## Responsibility

Own the document entity graph and computed entity data.

## Owns

- entity create/remove/update operations
- parent/child hierarchy and ordering
- computed data persistence for each entity
- entity-level serialization payload

## Must Not Own

- UI formatting logic
- render-engine-specific objects
- app interaction policy (tool decisions, shortcuts, session routing)

## Rules

- Scene-tree is source-of-truth for entity graph state.
- Data changes must go through framework APIs, not direct map mutation.
- Scene-tree can expose read APIs freely; writes should stay behind controlled APIs.
- App-level domain behavior can orchestrate scene-tree writes, but should not bypass core/app API wrappers.
- Computed updates from property changes are driven by property-component subscriptions in `Computed`.
- Transient computed-data batching preserves effective rollback, shared-channel,
  and delivery options; `undoable: false` never implies immediate delivery.
  Only consecutive compatible transient changes are batched. An ordinary or
  incompatible change flushes the pending batch first so journal order remains
  identical to the canonical write timeline.
- Standalone transaction replay routes `name`, `parentId`, `visible`, `lock`,
  and group `children` through Element-owned data; only computed-only keys route
  through `Computed` and its property bridge. Both routes acknowledge semantic
  apply synchronously.
- During add/remove, initialization plus parent/children/computed setter changes
  are internal graph side effects and are collapsed before journal publication;
  the explicit ADD/REMOVE event with parent/index metadata is the sole
  reversible scene-tree owner for that graph operation.
- Reversible `addNewElement` records the actual parent id/index after placement,
  and removal records them before graph mutation. Inverse add resolves that
  parent through the owning Scene Tree and restores the same deleted instance
  at the same index.

## Extension Points

- register component/entity definitions
- query, remove, and define exact component-property relations through Core
- register component-level computed defaults and normalization behavior
- validate load payload via `validateLoadData(...)` before apply

## Validation Checklist

- Entity creation updates graph + computed data consistently.
- Entity removal cleans graph references.
- Rollback/undo restoration preserves parent ownership and child order.
- Rollback/undo restores both Element-owned flags/metadata and computed values.
- Save/load round-trip preserves graph shape and computed data.
- Load path skips malformed/unregistered elements and falls back to a safe workspace when metadata is invalid.

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
