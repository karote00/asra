# `@asyra/selection`

Canonical selection-channel state and explicit selection queries/operations.

## Owns

- selected entity ids per registered selection channel
- deterministic replace, add, remove, and clear behavior
- active-selection query boundaries and selection metadata contracts

## Does not own

Tool/mode decisions, app selection eligibility, render overlays, entity
mutation, UI framework state, or automatic builtin selection registrations.

## Compose when

Compose it when product interactions need stable selection state independent
from UI components. Core and Preset already integrate it for the official
design-tool path. Do not use it for transient hover or canonical document
membership unless the product explicitly defines those as selection channels.

## Public entrypoints and prerequisites

Use `@asyra/selection`. Register the selection types/channels the app needs,
then use explicit read/write operations and subscriptions. The package ships no
concrete default selection classes; `@asyra/preset` owns official defaults.

## Lifecycle, inputs, outputs, and failure

Registration establishes a channel and its stable metadata. Replace/add/remove
operations produce deterministic selected-id sets. Duplicate/unknown
registration or invalid operation input fails through the declared boundary.
Cleanup releases channel state/subscriptions without mutating scene entities.

## Relationships

Preset installs default selection registrations and shared apply wiring. Core
owns transaction publication for its selection APIs. UI Context derives
multi-selection values. Render displays overlays from selection state. Features
decide which input changes selection.

## Maintained use path

The `core-information-model` release composition includes Selection while no
selection UI behavior is required. For a complete product path, create Asyra
Design and run its formal selection/tool-switching tests.

## Replacement and disabled behavior

Apps can register custom selection channels or replace the official Preset
defaults. Without a registration, selection operations for that channel are
unavailable; no generic element channel appears automatically. Omitting UI
Context/Render changes projection only, not selection ownership.

## Support, migration, and deprecation

Selection metadata remains string-based and registration-driven. Migration
must preserve channel ids, explicit operation semantics, and deterministic
multi-selection ordering. App-specific modes belong in Features, not in a
package compatibility branch.

## Canonical sources and release inventory

- [Package contract](../../../ai/framework/packages/selection.md)
- [Package manifest](../../../../packages/selection/package.json)
- [Asyra Design selection contract](../../../ai/apps/asyra-design/features/selection.md)

The root entrypoint, version, and dependencies are manifest-generated and
checked against the release inventory.
