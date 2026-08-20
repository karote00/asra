# `@asyra/utils`

Pure shared types, ids, geometry/numeric helpers, registries, registration
graph primitives, and diagnostics dispatch.

## Owns

- canonical low-level types shared across packages
- id generation/loading and optional namespace behavior
- pure geometry, color, bounds, projection, distance, and numeric helpers
- `MapRegistry`, `ExtensionRegistry`, `RegistrationGraph`, owner metadata, and
  structured registry failures
- low-level diagnostic counter/drag-phase dispatch primitives

## Does not own

Runtime business policy, startup side effects, canonical app state, rendering,
Feature decisions, app budgets, or domain-specific geometry meaning.

## Compose when

Import it when a consumer needs a declared public type or pure primitive. Do
not add a helper merely to avoid giving behavior to its real owner, and do not
put app-specific policy in Utils.

## Public entrypoints and prerequisites

Use the root `@asyra/utils` entrypoint. Important families include shared data
and geometry types, `SharedDeliveryMode`, `LoadDiagnostic`, id counters,
own-property helpers, registry primitives, `RegistrationOwnerMetadata`, and
pure measurement/math functions. No runtime initialization is required.

## Lifecycle, inputs, outputs, and failure

Pure functions return detached values or deterministic calculations. Registries
own explicit register/apply/unregister/cleanup lifecycle: duplicates, missing
targets, unsupported strategies, dangling relations, active usage, and cleanup
failure produce structured errors. Cleanup is reverse-order and retryable;
completed cleanup does not rerun.

## Relationships

Framework packages import canonical shared shapes from Utils instead of
duplicating them. Core coordinates registration graphs; package registries
remain their definition sources. Render, Preset, Design System, and apps consume
pure geometry helpers without moving product policy into Utils.

## Maintained use path

The [hierarchy guide](../../build/hierarchy-groups.md) uses public
`MoveHierarchyRequest` and result types. Other advanced guides exercise
Utils transitively through public Framework package contracts; an artificial
standalone runtime sample would not add owner evidence.

## Replacement and disabled behavior

Apps may use their own pure helpers when they do not need a public canonical
type. Shared Framework contracts must continue importing the one Utils type.
There is no package activation to disable; importing must not create listeners,
timers, or mutable product runtime.

## Support, migration, and deprecation

Shared type changes follow package semver and require all public consumers to
remain aligned. Registry migration must preserve deterministic order,
structured failure, rollback, and retry. New domain types belong to the app
unless multiple Framework owners require a neutral canonical shape.

## Canonical sources and release inventory

- [Package contract](../../../ai/framework/packages/utils.md)
- [Package manifest](../../../../packages/utils/package.json)
- [Hierarchy public type use](../../build/hierarchy-groups.md)

The root entrypoint, version, and dependency-free package facts are generated
from the manifest and checked against the release inventory.
