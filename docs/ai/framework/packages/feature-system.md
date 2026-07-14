# Package: @asyra/feature-system

## Responsibility

Feature registration, execution ordering, exclusivity, and session lifecycle.

## Current Position

Primary interaction runtime. Handles execute/session sequencing and cancellation behavior.

## Rules

- Feature handlers should mutate state through defined API boundaries, not deep package internals.
- Session updates should remain deterministic and cancellable.
- Priority and exclusivity are explicit per feature.
- Active feature execution should run one-by-one with deterministic ordering.
- Before running next action, current active session must be cancelable.
- Async feature handlers are allowed, but runtime must guard against stuck sessions.
- One interaction queue serializes command, session start/update/end, and cancel
  operations without event coalescing.
- Public `SessionManager` lifecycle entry points and one-shot commands share the
  default transaction owner's interaction queue. Multiple `SessionManager`
  instances may own separate registrations, but they participate in one active
  session runtime: starting a registered session first cancels the current
  active session, including one owned by another manager instance.

## Runtime Contracts

1. Execution
- resolve candidates by trigger/event
- sort by priority deterministically
- apply exclusivity policy before running handlers

2. Session lifecycle
- `start` opens active session context
- `update` runs while session remains active
- `end` finalizes session
- `cancel` aborts active session before conflicting next action
- `cancelPolicy` defaults to `rollback`; explicit alternatives are
  `commit-current` and `feature-defined`
- the public `SessionManager.registerSession(...)` boundary preserves its legacy
  five-argument `(name, feature, priority, exclusive, handler)` form with the
  default rollback policy; the additive six-argument form accepts an explicit
  policy before the handler
- `feature-defined` requires `onCancel` and must return `rollback` or
  `commit-current`
- existing session definitions without `onCancel` receive `onEnd` with
  `detail.cancelled = true` for resource cleanup
- if any participant requests rollback, the complete transaction rolls back

3. Error behavior
- one feature failure should not corrupt runtime state
- handler errors and `FeatureHandlerTimeoutError` always request rollback,
  independently of cancel policy
- timeout aborts the active session `detail.signal` before rollback; async
  handlers must check that signal after awaited work and before any mutation
- abort is cooperative: JavaScript cannot forcibly stop an already-running
  Promise, so a handler that ignores the signal may continue its own code even
  though its transaction has already failed
- every started participant receives cleanup opportunity, then the first actual
  error is rethrown
- one-shot executions use `runTransaction(..., { failureKind: 'handler-error' })`
  and stop lower-priority handlers after the first failure
- the exported `withTransaction(...)` utility commits only after synchronous or
  asynchronous success; throw or rejection requests rollback and rethrows the
  original failure

## App-Level Rules

- Keep feature handlers focused on interaction logic.
- Put data mutations in app/common APIs called by feature handlers.
- Avoid direct context singletons in features when API wrapper exists.
- For common app flows, use `defineFeature` / `getFeature` from the `@asyra/core` facade.

## Validation Checklist

- Priority/exclusive behavior is deterministic.
- Switching tools or conflicting actions handles active session correctly.
- Long-running async feature logic does not lock future execution.
- Tests must distinguish normal end, cancel, rollback, commit-current, handler
  error, and timeout.
