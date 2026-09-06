# Package: @asyra/feature-system

## Responsibility

Feature registration, execution ordering, exclusivity, session lifecycle, and
programmatic non-transactional task lifecycle.

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
- A programmatic task is a targeted, non-mutating async Feature boundary. It
  owns one Feature-created `AbortSignal`, rejects overlap for the same Feature,
  and never opens a canonical transaction around external wait time.
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
- `cancelPolicy` defaults to `commit-current`; explicit alternatives are
  `rollback` and `feature-defined`
- the public `SessionManager.registerSession(...)` boundary preserves its legacy
  five-argument `(name, feature, priority, exclusive, handler)` form with the
  default commit-current policy; the additive six-argument form accepts an
  explicit policy before the handler
- `feature-defined` requires `onCancel` and must return `rollback` or
  `commit-current`
- a user-driven commit-current interruption receives `onEnd` with
  `detail.cancelled = true`, allowing the normal finalization path to convert
  the current preview into one undoable commit
- explicit rollback, feature-defined cancellation, and forced failure cleanup
  use `onCancel`; definitions without `onCancel` receive `onEnd` as the legacy
  cleanup fallback
- if any participant requests rollback, the complete transaction rolls back

3. Programmatic task lifecycle

- `definition.task(input, { signal })` declares non-transactional async Feature
  work such as provider planning.
- `invokeFeatureTask(name, input, { signal? })` creates a distinct
  Feature-owned signal and forwards optional caller abort into it.
- only one task per Feature may be active; overlapping invocation rejects with
  `FeatureTaskActiveError` and stable `FEATURE_TASK_ACTIVE` code rather than
  creating another queue.
- `cancelFeatureTask(name, reason?)` cooperatively aborts the active signal and
  returns `false` when no task is active.
- settlement removes the caller abort listener and active ownership on success
  or failure.
- programmatic tasks must not mutate canonical state. They prepare detached
  work that a later app-owned transaction boundary may accept and execute.

4. Error behavior

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

5. Registration lifecycle

- `defineFeature(...)` returns its existing `api` plus a `dispose()` handle that
  delegates to `unregisterFeature(name)`.
- `unregisterFeature(name)` returns `false` when the feature is missing and does
  not touch unrelated registrations.
- active one-shot execution, a pending async session start, an active session,
  or an active programmatic task rejects unregister with
  `FeatureUnregisterError` and stable `FEATURE_IN_USE` code before partial
  cleanup.
- successful unregister removes the feature registry entry, pending
  registration, execution handlers, session handlers, input listeners, and
  reactive renderer-event subscription owned by that feature.
- features sharing one trigger keep one transport listener/subscription until
  the final participant is removed.
- when a shared execution/session sequence is already iterating, a participant
  successfully unregistered before its own handler starts is skipped and cannot
  emit a stale side effect from the captured sequence.
- `FeatureDefinition.registration` may declare stable owner metadata and opaque
  graph dependencies. A hard dependency uses `unregister-source`; ordinary app
  features may omit this metadata.
- registration metadata does not change feature priority, exclusivity, session,
  cancel, or execution semantics.

## Explicit Runtime Disposal

- `disposeFeatureSystem(getSnapshot): Promise<void>` is a lifecycle-owner
  boundary, not a Feature command or ordinary cancel. It synchronously closes
  queue/task admission, aborts owned signals, detaches input/render bindings,
  rejects waiting queue operations, and awaits already-started commands, tasks,
  session handlers, and cleanup. Reentrant or repeated calls share completion.
- Active sessions use forced rollback through the ordinary transaction owner,
  even when their user-interruption policy is commit-current. Task rejection
  alone is settlement, not a cleanup failure. Canonical state and history are
  not cleared by Feature System.
- Real handler promises remain tracked after a timeout race rejects. Disposal
  cannot complete until those promises settle. There is no forced Promise
  termination or timeout-success fallback; cleanup failure keeps admission
  closed and rejects disposal. A never-settling handler blocks reconstruction.
- Successful disposal removes definitions, pending registrations and transport
  bindings. `beginFeatureSystemRuntime(): void` starts a clean Feature generation
  only after successful disposal; the Core lifecycle must finish other owner
  cleanup before calling it. The initial generation is already open for
  compatibility. This is not a complete App reset API by itself.
- Queue runners and SessionManagers capture their generation. Retained old
  managers/callbacks reject with `FeatureRuntimeClosedError` and code
  `FEATURE_RUNTIME_CLOSED`; old definition disposal handles cannot unregister
  a same-named successor Feature. Old arbitrary Feature API functions still
  require their App/Core lifetime guard; this boundary is not a code sandbox.
- Ordinary load, destroy, cancellation and unregister do not implicitly invoke
  disposal. Direct App/Core reconstruction integration remains a separate step.

## App-Level Rules

- Keep feature handlers focused on interaction logic.
- Put data mutations in app/common APIs called by feature handlers.
- Avoid direct context singletons in features when API wrapper exists.
- For common app flows, use `defineFeature` / `getFeature` from the `@asyra/core` facade.

## Validation Checklist

- Priority/exclusive behavior is deterministic and explicit for every
  execution, session, and task Feature.
- Switching tools or conflicting actions handles active session correctly.
- Long-running async feature logic does not lock future execution.
- Programmatic task tests prove no canonical transaction, overlap rejection,
  cooperative abort, listener cleanup, and active-unregister protection.
- Tests must distinguish normal end, cancel, rollback, commit-current, handler
  error, and timeout.
- Feature unregister tests must prove pending, execution, session, input, and
  renderer-event resources leave no stale behavior after unregister/redefine.
