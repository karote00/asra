# Package: @asyra/ui-context

## Responsibility

Derived UI-property registration and aggregation runtime.

## Position in Framework

- Part of default framework runtime experience.
- Not mandatory for custom app consumers.

## Rules

- Derived-only: does not own canonical model state.
- Aggregation logic may be framework-default or app-custom.
- Mixed selections should be handled with explicit aggregate policies.
- Register UI properties only when UI needs them.
- `ui-context` does not own scene-tree/selection mirror stores.
- Recompute triggers come from preset/app subscriptions, not polling.

## App Flexibility

Apps can bypass ui-context and compute their own derived state from framework subscriptions.

`PropertyComputeContext<TElementData>.elements` intersects an app-declared
element shape with canonical `ComputedAttrs`, so a UI-property compute callback
can consume custom fields without an unsafe cast. A typed
`PropertyRegistration<TValue, TElementData>` remains assignable through the
default Core UI-property facade. UI Context stays derived-only: the app
registration explicitly owns aggregate, mixed, empty, and selection behavior;
the framework creates no automatic control, formatter, or field mapping.

## Runtime Contracts

1. Registration

- app/framework registers compute functions for UI properties
- each property has one managed observable source in ui-context
- `PropertyRegistration.registration` may declare owner metadata and opaque
  dependencies for Core graph coordination; ordinary app UI properties may
  omit it
- unregister disposes the property's managed `source$` subscription and removes
  registry/filter metadata

2. Recompute

- recompute when subscribed model/system dependencies change
- push only final derived values for UI consumption

3. Isolation

- ui-context can be removed/replaced without changing domain state ownership

## Validation Checklist

- Derived values update after selection/system/data changes.
- Multi-selection aggregation returns expected `MIX` behavior when configured.
- UI panels do not depend on raw package internals when ui-context property exists.
