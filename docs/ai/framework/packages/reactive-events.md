# Package: @asyra/reactive-events

## Responsibility

Provide typed cross-package event communication.

## Owns

- event type definitions
- publish/subscribe APIs
- typed payload contracts for shared events
- render pointer event contracts (`render.pointer.*`, `render.pointer.capture.*`)
- public transaction boundary depth and nested rollback-only state
- synchronous transaction-owner bridge used by the default Factory
- synchronous state-owner apply acknowledgement and transaction replay context

## Must Not Own

- domain policy decisions
- package-internal state machines
- app UI state

## Rules

- Cross-package communication should use typed events or core request APIs.
- Event names and payloads are framework contracts.
- Avoid ad-hoc untyped payloads for core event channels.
- Event registration storage should use shared `@asyra/utils` registry primitives (`MapRegistry`) instead of duplicating registry infrastructure.
- Framework-level event modules must not encode preset/app-specific system-context key mappings.
- Preset/app may register their own domain events through event registration APIs when opinionated behavior is needed.

## Extension Points

- add event module namespaces for new domains
- add typed publish/subscribe helpers for new event families
- register app/preset custom events via `eventRegistry.register(event)` where `event` can be a name string or an `EventDefinition`
- keep `eventRegistry.register(event)` as the reactive-events owned registration API; `@asyra/utils` provides storage primitives, not a separate event-level `register(...)` API
- duplicate event registrations are rejected (event names must be unique)

## Transaction Boundary Contract

- `startTransaction()` opens or nests a transaction for the currently resolved
  `TransactionOwner`; only that owner's outer boundary is forwarded.
- `endTransaction(options?)` defaults to commit.
- `rollbackTransaction(failure?)` requests rollback; any nested rollback latches
  the complete outer transaction for that same owner as rollback-only.
- `runTransaction(callback, options?)` supports synchronous and asynchronous
  callbacks, commits success, rolls back thrown/rejected work, and rethrows the
  original failure when rollback succeeds.
- `options.failureKind` classifies callback failure; the default is `explicit`.
- End/rollback at depth zero is a no-op and emits no phantom boundary.
- Owner finalization is synchronous so validation and rollback failures reach
  the caller instead of being swallowed by observer delivery.
- Canonical replay/apply owners use `subscribeToSynchronousEvent(...)`; an apply
  exception reaches Factory synchronously and can become `rollback-failed`.
  Ordinary RxJS subscribers remain observation/diagnostic consumers and are not
  canonical mutation acknowledgements.
- `SceneTreeEventTypes.UPDATE_COMPUTED_DATA` carries an explicit
  `owner: 'raw' | 'computed'` replay provenance field. The computed publisher
  supplies `computed`; canonical subscribers route only by the declared owner
  and reject missing or invalid provenance instead of inferring it from a key or
  current state.
- A synchronous owner is acknowledged as applied when it returns `void`/`true`;
  it returns `false` when the requested write is a semantic no-op. If it mutates
  canonical state and then must throw, it calls
  `acknowledgeTransactionReplayApplied()` before throwing; a throw before that
  acknowledgement is treated as pre-apply failure and receives no restoration
  plan.
- Replay failure acknowledgement is scoped by `runInTransactionReplayMode(...)`;
  `isTransactionReplayApplied()` exposes the current replay context to the
  Factory replay engine, while
  `wasTransactionReplayApplied(error)` lets Factory distinguish pre-apply from
  applied-then-failed without replacing the original thrown error.
- `runWithTransactionOwner(...)` temporarily scopes replay boundary calls to a
  consumer-owned Factory. It does not replace the registered default owner or
  share the default owner's active depth/rollback latch.
- `TransactionEventTypes.TRANSACTION_STATUS_CHANGED` is the centralized status
  event contract; event observers are diagnostics, not the transaction owner.

## Validation Checklist

- Publisher and subscriber payload types stay aligned.
- Event contracts are versioned/deprecated deliberately.
- Removing an event has migration notes in docs.
