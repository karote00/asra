# Framework Runtime Matrices

Use these matrices for deterministic ownership and flow decisions.

## Runtime Owner Matrix

- input normalization owner: `@asyra/input-system`
- execution/session/cancel owner: `@asyra/feature-system`
- entity graph owner: `@asyra/scene-tree`
- property component owner: `@asyra/props-manager`
- selection owner: `@asyra/selection`
- app/system mode owner: `@asyra/system-context`
- render engine owner: `@asyra/render`
- derived UI state owner: `@asyra/ui-context` (optional)

## Mutation Boundary Matrix

- feature handlers
  - can: call API boundaries
  - must not: mutate package internals directly

- app/common APIs
  - can: orchestrate transactions and package calls
  - must not: bypass validation contracts

- package internals
  - can: enforce invariants and validation semantics
  - must not: assume app UI framework

## Validation Semantics Matrix

- runtime set/update
  - valid: write
  - invalid: reject

- load value with default
  - valid: write
  - invalid: fallback to default

- load value without default
  - valid: write
  - invalid: keep initialized safe value

## Flow Matrix (Canonical)

1. input-system emits normalized event
2. feature-system executes feature handlers
3. handlers call mutation/query APIs
4. APIs mutate framework state in transaction boundary
5. render reacts to state change
6. ui-context recomputes derived properties
7. app UI consumes derived values

## Compatibility Matrix

- builtin defaults
  - status: optional
  - usage: convenience
  - extraction readiness: should stay movable
