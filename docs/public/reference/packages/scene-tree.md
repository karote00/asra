# `@asyra/scene-tree`

Canonical entity graph, parent/child hierarchy, raw entity state,
element-to-property relations, and local computed projection.

## Owns

- entity create/remove/update, hierarchy, order, identity, and serialization
- element-slot-to-root-property relations and reverse indexes
- batch-only local computed projection and ordinary computed events
- prepared/apply boundaries for atomic insertion, removal, move, and subtree
  lifecycle

## Does not own

Property definitions/child graphs, UI policy, render objects, app Group command
meaning, or computed data as canonical/shared/history/persisted state.

## Compose when

Compose it for canonical entity/hierarchy products. Core already coordinates it
for app use. Do not use Scene Tree for a pure global managed-property model or
as a render display list.

## Public entrypoints and prerequisites

Use `@asyra/scene-tree` or Core's curated facades. Public owner surfaces include
entity/hierarchy operations, component relations, prepared canonical mutations,
load validation/apply, local computed update/patch/projection, and subtree
move/remove/restore contracts. Property roots must be registered with Props
Manager.

## Lifecycle, inputs, outputs, and failure

Every batch validates ids, membership, relations, parent slot, cycle, order,
and staleness before first mutation. Owner-issued prepared artifacts are
one-shot and instance-bound. Valid apply emits ordered canonical evidence;
local computed projection emits no history/publication/persistence. Invalid or
stale operations fail without a map, hierarchy, relation, or history prefix.

## Relationships

Props Manager owns property values/graphs. Core coordinates atomic cross-owner
work. Factory records owner evidence. Render/UI consume computed projections.
Preset supplies official Group defaults/adapters; the app owns product command
policy.

## Maintained use path

Run `yarn examples:run custom-component-schema` for component relations, then
follow [Build hierarchy and Group behavior](../../build/hierarchy-groups.md)
for the generated app's formal hierarchy route.

## Replacement and disabled behavior

Apps may register custom components/containers and bypass Preset Group defaults,
but canonical hierarchy still belongs to Scene Tree. Local computed projection
may be replaced/rebuilt without changing canonical data. Without Scene Tree,
entity hierarchy APIs are unavailable rather than emulated in UI state.

## Support, migration, and deprecation

Current Group hierarchy supports deterministic move/reorder/subtree lifecycle,
rollback, replay, load, and collaboration evidence. Migration must preserve
identity, parent/index/order, relations, and separation of canonical versus
computed data. Direct map/parent mutation is unsupported.

## Canonical sources and release inventory

- [Package contract](../../../ai/framework/packages/scene-tree.md)
- [Package manifest](../../../../packages/scene-tree/package.json)
- [Hierarchy guide](../../build/hierarchy-groups.md)

The root entrypoint, version, and dependencies are generated from the manifest
and validated against the release inventory.
