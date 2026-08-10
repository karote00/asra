# `@asyra/feature-system`

Deterministic Feature registration, priority/exclusivity, interaction sessions,
commands, cancellation, and non-mutating programmatic tasks.

## Owns

- Feature definitions, trigger resolution, priority, and exclusivity
- one serialized interaction queue and active session lifecycle
- start/update/end/cancel ordering and cancellation policy
- one active non-mutating programmatic task per Feature with abort ownership

## Does not own

Raw environment listeners, app command meaning, canonical package mutation,
transaction history, model-provider orchestration, or UI presentation.

## Compose when

Compose it when several inputs or commands need deterministic arbitration, a
continuous session, or cancellable external planning work. Do not use a
programmatic task for canonical mutation and do not create an app-local session
queue beside the shared interaction runtime.

## Public entrypoints and prerequisites

Use `@asyra/feature-system`. Public surfaces include Feature definition/query,
`SessionManager`, session handlers, `invokeFeatureTask(...)`,
`cancelFeatureTask(...)`, stable Feature task errors, and Feature API exposure.
Canonical sessions require a configured transaction owner and app mutation API.

## Lifecycle, inputs, outputs, and failure

A command or session enters the serialized interaction queue. A session starts,
updates while active, then ends or cancels before conflicting work. Cancellation
defaults to `commit-current`; explicit policies are `rollback` and
`feature-defined`. Handler errors and timeouts enter forced cleanup. A
programmatic task receives one Feature-owned abort signal, rejects overlap, and
releases ownership on settlement.

## Relationships

Input System and UI adapters provide intent. Factory owns the transaction
opened around canonical session work. AI Runtime can run inside a Feature-owned
programmatic lifecycle before a later accepted action enters one transaction.
Core exposes public Feature registration and APIs.

## Maintained use path

Run `yarn examples:run feature-session-undo` and follow
[Build a transaction-safe Feature](../../build/feature-session.md). The
app-retrieval example shows a registered Feature API as the only mutation path.

## Replacement and disabled behavior

Apps may define or unregister Features during open composition and replace
their own handlers through declared registration lifecycle. When a Feature is
absent or its condition does not match, the intent performs no hidden fallback
mutation. Disabling a Feature must release its active session/task.

## Support, migration, and deprecation

The legacy five-argument `registerSession(...)` form remains compatible with
default commit-current policy; the six-argument form adds explicit policy.
Migration should make cancellation explicit and keep programmatic tasks
non-mutating. Deep package internals are not supported APIs.

## Canonical sources and release inventory

- [Package contract](../../../ai/framework/packages/feature-system.md)
- [Package manifest](../../../../packages/feature-system/package.json)
- [Executable session example](../../../examples/feature-session-undo.mjs)

The root entrypoint, version, and dependencies are generated from the manifest
and checked against the release inventory.
