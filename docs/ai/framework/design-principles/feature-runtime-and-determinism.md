# Principle: Feature Runtime and Determinism

## Intent

Keep user-action execution deterministic with one runtime owner.

## Why

- feature composition is the main extension mechanism in apps
- deterministic ordering is required for stable behavior and debugging
- session cancellation must be predictable when inputs conflict

## Decisions Implied

- `@asyra/feature-system` is runtime owner for execute/session/cancel
- priority and exclusivity are explicit per feature
- active session cancellation happens before conflicting next action

## Anti-Patterns

- parallel decision runtimes for the same user action
- implicit ordering based on registration side effects
- unbounded async behavior without cancellation guardrails

## Design Check

Before merging:
1. Is runtime owner still singular?
2. Is ordering explicit and reproducible?
3. Can active session be canceled safely before next conflicting action?
