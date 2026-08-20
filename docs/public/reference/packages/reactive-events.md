# `@asyra/reactive-events`

Typed cross-package communication, transaction-owner routing, persistence
signals, and cooperative settlement primitives.

## Owns

- typed event definitions, registration, publication, and subscription
- package-neutral event constants and payload contracts
- transaction-owner registration/override and replay-safe routing
- reusable cooperative host-yield/paint policy for large ordered work

## Does not own

Canonical package state, app command policy, a second transaction journal,
renderer output, provider networking, or app-specific scheduling budgets.

## Compose when

Framework packages use Reactive Events when typed communication is required
without direct package ownership calls. Apps usually consume Core/common
facades instead of publishing low-level owner events. Do not use events to hide
an invalid cross-package mutation or to duplicate canonical state.

## Public entrypoints and prerequisites

Use `@asyra/reactive-events`. Public surfaces include the event bus, typed
event/subscribe/publish contracts, transaction-owner helpers, persistence and
package event modules, and cooperative rendering utilities. Register definitions
before use and release exact callbacks with their corresponding unsubscribe.

## Lifecycle, inputs, outputs, and failure

Registration establishes stable typed routes. Publication synchronously or
asynchronously reaches declared subscribers according to the route contract.
Transaction replay resolves the registered active owner. Invalid registration,
duplicate definitions, missing owner, subscriber failure, or failed cooperative
settlement remains explicit; it must not be converted into a successful no-op.

## Relationships

Factory owns the real transaction journal and uses the registered transaction
owner for replay. Props, Scene Tree, Input, Render, and other packages own their
state while communicating through typed routes. Core coordinates package
facades so consumers rarely need low-level events.

## Maintained use path

The [Feature session guide](../../build/feature-session.md)
demonstrates Factory replay through current public boundaries. Read
[transactions and durability](../../learn/transactions-and-durability.md)
before adding a new event route.

## Replacement and disabled behavior

An app may replace its own adapter/subscriber but cannot replace another
package's canonical owner through an event. Optional package subscribers are
absent when that package is not composed. A missing subscriber must not trigger
a direct-import fallback.

## Support, migration, and deprecation

Current contracts use typed registered routes and one transaction owner.
Migration must preserve event identity, ordered batches, owner routing, and
cleanup. Legacy or removed event strings must follow a documented deprecation
lifecycle; private event modules are not public API.

## Canonical sources and release inventory

- [Package contract](../../../ai/framework/packages/reactive-events.md)
- [Package manifest](../../../../packages/reactive-events/package.json)
- [Factory relationship](../../../ai/framework/packages/factory.md)

The root entrypoint, version, and dependencies are manifest-generated and
checked against the release package set.
