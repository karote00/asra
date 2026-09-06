# `@asyra/ui-context`

Optional derived UI-property registration and aggregation runtime.

## Owns

- UI-property definitions, compute callbacks, managed derived observables, and
  unregister cleanup
- aggregate, mixed, empty, and selection-aware derived computation contracts
- optional registration metadata for Core graph coordination

## Does not own

Canonical model state, Scene Tree/Selection mirror stores, automatic controls,
formatters, field mappings, app command policy, or polling-based recompute.

## Compose when

Compose it when panels or controls need reusable derived values across current
selection/model/system state. A custom app may bypass it and compute directly
from public subscriptions. Do not write canonical values into UI Context.

## Public entrypoints and prerequisites

Use `@asyra/ui-context`. Public surfaces include UI Context, property registry,
`PropertyRegistration<TValue, TElementData>`, compute context, managed sources,
query/recompute, and unregister lifecycle. The app declares the element shape
and aggregate semantics.

## Lifecycle, inputs, outputs, and failure

Registration creates one managed derived source and optional graph metadata.
Preset/app subscriptions request recompute when canonical dependencies change.
Only the final derived value is pushed. Unregister disposes the source
subscription and metadata. Compute failure is a derived/UI failure and cannot
replace or roll back canonical owner state.

`propertyRegistry.resetRuntime()` is the explicit lifecycle-owner handoff. It
removes derived registrations, releases source subscriptions and completes
owned UI observables without completing caller-owned sources. Cleanup failures
are reported after all attempts; canonical state is untouched.

## Relationships

Scene Tree supplies computed element data; Selection supplies selected ids;
System Context and other owners may provide inputs. Preset owns official
recompute wiring. Design System/app UI consumes the output. Core exposes
registration/query facades.

## Maintained use path

Create Asyra Design with
[`create-asyra-design-app`](../../start/create-design-app.md) and inspect its
property panels. The generated-app extension can add behavior without requiring
a new UI Context registration when no derived panel value is needed.

## Replacement and disabled behavior

Apps can replace a registration or omit UI Context and derive state themselves
through public owner subscriptions. Removing the package must not alter
canonical documents, transactions, rendering, or persistence. Mixed-selection
policy must stay explicit in the replacement.

## Support, migration, and deprecation

Current typed compute contexts accept app-declared element fields intersected
with canonical computed attributes. Migration must preserve derived-only
ownership and cleanup; old mirror-store or polling designs are not supported
compatibility paths.

## Canonical sources and release inventory

- [Package contract](../../../ai/framework/packages/ui-context.md)
- [Package manifest](../../../../packages/ui-context/package.json)
- [Asyra Design case study](../../cases/asyra-design.md)

The root entrypoint, version, and dependencies are manifest-generated and
checked against the release inventory.
