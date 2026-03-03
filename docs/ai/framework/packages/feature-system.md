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

3. Error behavior
- one feature failure should not corrupt runtime state
- runtime should isolate/report feature errors clearly

## App-Level Rules

- Keep feature handlers focused on interaction logic.
- Put data mutations in app/common APIs called by feature handlers.
- Avoid direct context singletons in features when API wrapper exists.
- For common app flows, use `defineFeature` / `getFeature` from the `@asyra/core` facade.

## Validation Checklist

- Priority/exclusive behavior is deterministic.
- Switching tools or conflicting actions handles active session correctly.
- Long-running async feature logic does not lock future execution.
