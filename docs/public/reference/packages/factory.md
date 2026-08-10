# `@asyra/factory`

Canonical transaction grouping, rollback, Undo/Redo history, replay, and local
shared-publication infrastructure.

## Owns

- active transaction journal and one outer commit boundary
- rollback, undo, redo, inverse registration, replay handlers, and status
- commit validators and history stacks
- shared data-channel registration, delivery timing, and immutable publication
  evidence

## Does not own

Product command meaning, package-specific invariants, render/UI state,
persistence durability, collaboration transport, or app conflict policy.

## Compose when

Compose Factory whenever intended canonical actions need atomicity, rollback,
history, or shared publication. Core already coordinates its Factory instance
for common app use. Do not add a second transaction engine for AI, bulk actions,
or Collaboration.

## Public entrypoints and prerequisites

Use `@asyra/factory`. The package exports the default `factory`, `Factory`,
transaction APIs, `DataTransact`, shared channel/publication types, and
`LocalSharedDataChannel`. Custom rollback/undo events require a registered
inverter and semantic replay handler.

## Lifecycle, inputs, outputs, and failure

Nested starts join one outer journal. Valid outer end creates at most one undo
entry and flushes eligible shared delivery. Failure or invalid commit runs
inverses in reverse order. Inverse/apply failure is aggregated and reported as
rollback failure; it is never treated as success. Undo reverses committed
evidence; Redo restores forward order without creating another ordinary
history entry.

## Relationships

Canonical packages contribute owner-issued changes. Feature sessions bound one
intent around Factory. Reactive Events carries typed transaction/replay routes.
Collaboration transports immutable `SharedPublication`; Persistence remains an
independent durability owner.

## Maintained use path

The [transaction-safe Feature guide](../../build/feature-session.md) explains
one session, one commit, rollback, Undo, and Redo with the exact owner call
sequence.

## Replacement and disabled behavior

Use the default singleton for the shared runtime or an explicit `Factory` where
the composition consistently injects that instance. A local action can opt out
of undo/shared delivery through declared options, but canonical mutation still
requires its owner boundary. Disabling history is not permission to bypass
transaction rollback.

## Support, migration, and deprecation

The current journal and history contracts preserve non-JSON data shapes and
owner-issued ordered batches. Migration must retain inverse/replay coverage,
one-action grouping, publication identity, and instance owner routing. Do not
revive old snapshot/equality/finalize-save fallback paths.

## Canonical sources and release inventory

- [Package contract](../../../ai/framework/packages/factory.md)
- [Package manifest](../../../../packages/factory/package.json)
- [Transaction-safe Feature guide](../../build/feature-session.md)

Version, dependencies, and the root public entrypoint are generated from the
manifest. The documentation gate keeps this guide tied to the exact release
inventory.
