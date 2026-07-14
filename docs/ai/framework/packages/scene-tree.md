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
- Reversible `addNewElement` records the actual parent id/index after placement,
  and removal records them before graph mutation. Inverse add resolves that
  parent through the owning Scene Tree and restores the same deleted instance
  at the same index.

## Extension Points

- register component/entity definitions
- register component-level computed defaults and normalization behavior
- validate load payload via `validateLoadData(...)` before apply

## Validation Checklist

- Entity creation updates graph + computed data consistently.
- Entity removal cleans graph references.
- Rollback/undo restoration preserves parent ownership and child order.
- Save/load round-trip preserves graph shape and computed data.
- Load path skips malformed/unregistered elements and falls back to a safe workspace when metadata is invalid.
