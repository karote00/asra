# `@asyra/props-manager`

Canonical property definitions, property values, property-child graph,
validation, and registration lifecycle.

## Owns

- declarative property type definitions and runtime component classes
- schema/default validation for runtime writes and load candidates
- property instances, child graph, lookup, and graph-aware lifecycle
- prepared/apply boundaries for atomic cross-owner canonical operations

## Does not own

Scene element hierarchy, UI controls, render projection, app-domain schema
meaning, document version migration, or invalid-value fallback presentation.

## Compose when

Compose it for structured canonical component properties and validation. Core
already exposes its common registration and mutation facades. Do not use it for
temporary UI state or engine resources.

## Public entrypoints and prerequisites

Use `@asyra/props-manager`. Through Core or direct owner composition, define
property components/schemas, register complete type definitions, create/query
values, resolve property ancestor ids, and unregister while allowed. Cross-owner
element/property work should enter Core.

## Lifecycle, inputs, outputs, and failure

Registration validates a complete definition before publishing it. Runtime
writes and load validation reject invalid explicit values before mutation.
Prepared mutations are instance/registration-bound and one-shot; foreign,
stale, reused, or invalid artifacts fail before apply. Active registrations can
block incompatible redefinition/unregister.

## Relationships

Scene Tree owns element hierarchy and element-to-root-property relations, then
projects canonical property values into local computed data. Core coordinates
atomic Props-then-Scene work. UI Context/Render consume derived values. The app
owns field meaning and migration.

## Maintained use path

Run `yarn examples:run custom-component-schema` and follow
[Build a custom component and schema](../../build/custom-schema.md). The
versioned-load example proves app migration remains outside Props Manager.

## Replacement and disabled behavior

Apps may register their own property types and replace open-composition
definitions through the exact lifecycle. Omitting a property type means values
of that type cannot become canonical. Do not replace invalid values with UI
defaults; missing and invalid are different cases.

## Support, migration, and deprecation

Schema-based valid-write and invalid-fallback semantics are current. App
document migration occurs before owner validation; Props Manager does not
interpret historical app versions. Migration must preserve property identity,
child relations, and active-registration safety.

## Canonical sources and release inventory

- [Package contract](../../../ai/framework/packages/props-manager.md)
- [Package manifest](../../../../packages/props-manager/package.json)
- [Executable schema source](../../../examples/custom-component-schema.mjs)

The root entrypoint, version, and dependencies are generated from the package
manifest and verified against the release inventory.
