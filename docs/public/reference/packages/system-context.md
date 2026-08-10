# `@asyra/system-context`

Registered managed global/runtime properties for modes, viewport values, and
app/system flags.

## Owns

- managed property registration, observable value, validation, and snapshot
- primary tool, zoom, interaction-mode, and app-defined system-level state
- persisted-versus-runtime-only registration option
- instance-bound validate-then-apply load artifacts

## Does not own

Entity graphs, property components, UI binding, default event subscriptions,
render output, or app-domain command policy.

## Compose when

Compose it for small global values that are not element/property graph data.
Core already exposes managed-property facades. Do not use it as an arbitrary
document store or duplicate per-entity Props state.

## Public entrypoints and prerequisites

Use `@asyra/system-context` or Core's `defineSystemProperty(...)`,
`setSystemProperty(...)`, `getSystemContextSnapshot()`, query, load/save, and
unregister facades. Define initial value, optional validator, and whether the
property is runtime-only before use.

## Lifecycle, inputs, outputs, and failure

Registration creates one consistent observable value source. Runtime set
validates before update. Load validation normalizes unregistered/invalid values
according to the owner contract and issues one instance-bound artifact; apply
accepts that artifact once without rerunning validators. Foreign, stale, reused,
or invalid artifacts fail before mutation.

## Relationships

Core coordinates public registration, read/write, frame request, and load/save
ordering. Reactive adapters map events to managed values. UI Context/Render can
derive presentation. Persistence includes only registrations marked
non-runtime.

## Maintained use path

Run `yarn examples:run core-information-model` for a custom managed record. The
[app retrieval/action guide](../../build/app-retrieval-action.md) uses a
read-only snapshot and registered Feature API for mutation.

## Replacement and disabled behavior

Apps may define/unregister their own managed properties while composition is
open. Runtime-only values are intentionally omitted from persistence. When a
property is unregistered, consumers must handle absence; no stale snapshot or
UI default becomes its owner.

## Support, migration, and deprecation

Current validation/load uses owner-issued artifacts and safe initialized
defaults. Migration of app values remains app-owned before load. Preserve
registration identity and validator semantics; do not fabricate artifacts or
mutate observable internals.

## Canonical sources and release inventory

- [Package contract](../../../ai/framework/packages/system-context.md)
- [Package manifest](../../../../packages/system-context/package.json)
- [Executable managed-model source](../../../examples/core-information-model.mjs)

The root entrypoint, version, and dependencies are generated from the manifest
and release-checked.
