# Property-Driven Computed Sync Plan

## Goal

Replace broad `refreshComputedDataFromProperty(...)` recomputation with direct property-to-computed synchronization.

Final target flow:
- `element.set -> update computed data -> update props component`
- `update props component -> update computed data`

## Problem

Current prop-originated writes rely on `sceneTree.refreshComputedDataFromProperty(elementId, propertyName, ...)`.
That path:
- re-reads the whole property component value object
- rewrites computed keys by iterating all returned values
- keeps the sync rule in scene-tree transaction subscription code instead of near property registration/ownership

This works as a fallback bridge, but it is broader than necessary and does not make per-property computed ownership explicit.

## Target Principle

- Property components should declare how their writes affect computed data.
- Element-owned prop updates stay incremental and key-scoped where possible.
- Scene-tree should not need a generic "pull all computed values from one prop" path for normal runtime updates.
- The sync contract should live with property registration/runtime wiring, not be inferred later by a transaction replay helper.

## Scope

In scope:
- define a framework contract for property-to-computed sync registration
- wire prop updates so computed data is updated from property changes directly
- preserve transaction and undo semantics
- preserve load/runtime validation behavior

Out of scope:
- changing app-level UI aggregation behavior
- redesigning property schemas
- removing all fallback refresh paths before direct sync is proven stable

## Implementation Slices

1. Define sync contract
- Add an explicit registration surface for "property change -> computed key update" behavior.
- Support single-key and multi-key property outputs.

2. Move runtime sync closer to property ownership
- Trigger computed updates from the property component update path or registered property handlers.
- Keep owner element and property name explicit in the contract.

3. Narrow the scene-tree bridge
- Reduce `refreshComputedDataFromProperty(...)` to fallback/debug/migration use only.
- Remove normal runtime dependence on broad property-value rehydration.

4. Preserve transaction semantics
- One intended property interaction should still map to one intended computed update transaction.
- Avoid duplicate scene-tree writes when props and computed are already synchronized in the same action.

5. Tests and docs
- Add framework tests for prop-driven computed sync.
- Document ownership boundaries between element, props-manager, and scene-tree.

## Success Criteria

- Prop updates no longer require generic "refresh all computed keys for this property" in normal runtime flow.
- Computed updates caused by property writes are explicit and property-owned.
- Existing element-originated flow remains unchanged and deterministic.
- Undo/redo and collaborative replay do not duplicate or miss computed updates.
