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
  - should: update system-context state through managed-property APIs rather than framework-level key-specific events

- package internals
  - can: enforce invariants and validation semantics
  - must not: assume app UI framework

- framework event layer
  - can: define transport/event contracts for shared framework domains
  - must not: hardcode preset/app-specific system-context key mappings

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

## Extension Author Matrix

- feature author
  - can: register feature behavior through explicit triggers, priority, exclusivity, and execution/session lifecycle
  - must: call app/common APIs or core facade APIs for mutation/query work
  - must not: mutate package internals or create a parallel decision runtime

- preset author
  - can: provide default components, properties, schemas, selections, features, events, render layers, and startup wiring
  - must: keep defaults optional, movable, and replaceable
  - must not: make app-domain behavior a hidden framework dependency

- app/product author
  - can: compose core and presets, define app features, shortcuts, events, schemas, render layers, and domain workflows
  - should: replace preset behavior through documented unregister/redefine or override flows
  - must not: patch preset/framework internals for app-specific policy

- render extension author
  - can: register render layers, interaction targets, handlers, and engine abstractions
  - must: keep render derived from state/system inputs
  - must not: make render engine state the source of truth for domain logic

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
