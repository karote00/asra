# Rule: Feature Authoring

## Required Definition Fields

For each feature, define clearly:

- trigger event name
- priority
- exclusive mode
- execution vs session lifecycle usage

## Session Features

Session features must define behavior for:

- start condition
- update behavior
- end behavior
- cancel/conflict behavior
- `cancelPolicy` (`commit-current` by default, `rollback`, or
  `feature-defined`)
- user-driven interruption runs `onEnd` with `detail.cancelled = true` so the
  current preview becomes one undoable commit
- `onCancel` owns runtime-only cleanup for explicit rollback or forced failure;
  canonical rollback remains Factory journal ownership

## Execution Features

Execution features must define behavior for:

- run condition (when to execute vs return `null`)
- one-pass side effects/result payload
- conflict expectations with other features (priority/exclusive impact)
- idempotency expectations for repeated trigger events
- execution failure behavior; one-shot handlers are transaction-wrapped and
  lower-priority handlers do not run after the first failure

## Programmatic Task Features

Use `definition.task` only for targeted non-mutating async work that must remain
under Feature System cancellation ownership without holding a canonical
transaction open.

Task Features must define:

- a typed programmatic trigger through `invokeFeatureTask(...)`
- explicit priority and exclusive metadata
- provider-disabled or otherwise unavailable behavior before external work
- cooperative abort behavior through the Feature-owned `signal`
- overlap behavior; the same active Feature rejects a second invocation instead
  of creating another queue
- a later, explicit app transaction/common-API boundary for every accepted
  canonical mutation

## Mutation Rule

- Keep data mutations behind common-apis/controllers.
- Avoid direct state singleton mutation in multiple places.

## Conflict Rule

- If a feature conflicts with active interaction mode, return `null` early.
- If a feature cancels another flow, make cancellation explicit and state-safe.
- Handler errors and timeouts always roll back, regardless of cancel policy.
- Async session handlers receive `detail.signal`; after every awaited operation,
  check `signal.aborted` before invoking a common API or mutating runtime state.
  Timeout cancellation is cooperative and cannot forcibly stop an ignored
  Promise.
- `feature-defined` cancellation must implement `onCancel` and return
  `rollback` or `commit-current`.

## Tool/Mode Rule

- Tool switching behavior must define path-editing impact explicitly.
- Escape/cancel behavior must define exact state transitions.
