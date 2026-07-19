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
- Committed scalar changes carry one exact `key`, `before`, `after`, and
  canonical `raw` or `computed` owner; a transient batch preserves each entry's
  owner, scalar order, and effective options as one envelope.
  Computed record patches retain exact before evidence for replacement/removal,
  including an own `before` property when an existing record value is
  `undefined`; only an absent record id is an addition. They omit equal writes
  and missing removals, and collapse value plus record
  set/remove mutations into one committed patch change. Top-level value patches
  replace existing computed keys and never create a missing computed owner. A
  top-level key cannot appear in both the value and record maps of that patch;
  overlapping requests fail before canonical mutation. Every value base must be
  an own property, every record base must be an own record, and one record id
  cannot appear in both `set` and `remove`; invalid requests fail before any
  canonical mutation instead of publishing a phantom patch or creating an empty
  record base. A multi-element patch prevalidates every existing target snapshot
  before mutating the first target; one invalid target rejects the full request
  without applying a canonical prefix.
- Standalone transaction replay consumes the carried `raw|computed` owner and
  never infers it from the key or current data. `raw` routes through Element;
  `computed` routes through Computed and its property bridge even when a raw
  field has the same name. Missing or invalid owner provenance is rejected
  before mutation. Both valid routes acknowledge semantic apply synchronously.
  Patch replay materializes top-level keys and record ids as own enumerable data
  properties, including legal special names such as `__proto__`.
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

App-defined property fields use the same projection path as builtin fields.
Scene Tree projects only the complete canonical result of property `getValue()`
into computed element data during setup, property subscriptions, and explicit
owner refresh. It does not reconstruct removed or non-projected fields from
schema/defaults, interpret custom field meaning, or become a second schema
owner.

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
