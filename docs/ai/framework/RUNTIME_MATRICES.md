# Framework Runtime Matrices

Use these matrices for deterministic ownership and flow decisions.

## Runtime Owner Matrix

- input normalization owner: `@asyra/input-system`
- execution/session/cancel owner: `@asyra/feature-system`
- entity graph owner: `@asyra/scene-tree`
- property component owner: `@asyra/props-manager`
- selection owner: `@asyra/selection`
- app/system mode owner: `@asyra/system-context`
- render orchestration/adapter owner: `@asyra/render`
- abstract render-engine contract owner: `@asyra/render-engine`
- default concrete Pixi runtime owner: `@asyra/render-engine-pixi`
- default engine selection owner: `@asyra/preset`
- derived UI state owner: `@asyra/ui-context` (optional)
- transaction boundary depth/rollback-only owner: `@asyra/reactive-events`
- reversible journal/validation/history/shared-settlement owner: `@asyra/factory`
- commit persistence acknowledgement owner: injected `@asyra/core` + provider

## Mutation Boundary Matrix

- feature handlers

  - can: call API boundaries
  - must not: mutate package internals directly

- app/common APIs

  - can: orchestrate transactions and package calls
  - should: use `runTransaction` for finite work and manual boundaries only for
    interactions spanning multiple input events
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

  - can: maintain the fixed official default catalog, module installers, private prerequisites, and preset-owned `2D` provider policy
  - must: keep defaults independently selectable and profile-independent
  - must not: own engine instances/resources or add implicit singleton fallback
  - must not: make app-domain behavior a hidden framework dependency

- app/product author

  - can: compose core and presets, define app features, shortcuts, events, schemas, render layers, and domain workflows
  - can: select preset profile `CUSTOM` and bind a contract-compatible custom render-engine provider through Core before startup
  - should: replace preset behavior through documented unregister/redefine or override flows
  - must not: patch preset/framework internals for app-specific policy

- render extension author
  - can: register render layers, interaction targets, and handlers through
    `@asyra/render`
  - can: implement a custom engine through `@asyra/render-engine` without
    importing render internals
  - must: keep render derived from state/system inputs
  - must not: make render engine state the source of truth for domain logic

## Flow Matrix (Canonical)

Intent path:

1. a human, machine, UI, automation, AI, device, or external command emits an intent
2. adapters normalize the intent when required
3. feature-system executes feature handlers
4. handlers call mutation/query APIs
5. APIs mutate authoritative framework state in a transaction boundary
6. Factory validates commit or reverses the rollbackable journal
7. render/ui-context and other projections react to state
8. committed outcomes enter Core's serial persistence queue

State-application path:

1. load, undo/redo replay, or future remote change input arrives
2. app migration/conflict/origin checks run as applicable
3. every affected package owner completes validation/fallback before apply
4. apply APIs update the authoritative state owner
5. render/ui-context and other projections react to state

Load-specific ordering:

1. Core receives direct or provider data
2. instance-local app load hooks complete
3. Props Manager, Scene Tree, and System Context validation results complete
4. Core returns each complete owner-issued one-shot artifact to its package
   apply facade without validator replay
5. Core emits detached diagnostics observations

## Compatibility Matrix

- builtin defaults

  - status: optional
  - usage: convenience
  - extraction readiness: should stay movable

- `PixiJSRenderer` export from `@asyra/render`
  - status: deprecated compatibility alias
  - replacement: `RenderAdapter`
  - guarantee: same Core-facing lifecycle during the migration window
