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

## Execution Features

Execution features must define behavior for:
- run condition (when to execute vs return `null`)
- one-pass side effects/result payload
- conflict expectations with other features (priority/exclusive impact)
- idempotency expectations for repeated trigger events

## Mutation Rule

- Keep data mutations behind common-apis/controllers.
- Avoid direct state singleton mutation in multiple places.

## Conflict Rule

- If a feature conflicts with active interaction mode, return `null` early.
- If a feature cancels another flow, make cancellation explicit and state-safe.

## Tool/Mode Rule

- Tool switching behavior must define path-editing impact explicitly.
- Escape/cancel behavior must define exact state transitions.
