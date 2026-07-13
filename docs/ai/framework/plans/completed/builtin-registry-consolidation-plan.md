# Builtin Decoupling and Preset Migration Plan

## Status

Completed on February 26, 2026.

## Context

Asyra is now a framework. Kernel packages should not ship opinionated builtins as implicit defaults because consumer needs differ by app/runtime.

Current progress:
- package-local builtin ownership cleanup is already in progress.
- core transitional orchestration path exists and can be used as migration source.
- reactive-events audit: no builtin registration side effects were found; it remains event-contract infrastructure.

Current registration-side-effect inventory (to be cleaned in direct cutover scope):
- factory: `initFactorySubscribe()`
- input-system: `initInputSystemSubscribe()`
- props-manager: `initPropXSubscribes()`
- scene-tree: `initSceneTreeSubscribes()`
- selection: `initSelectionSubscribes()`
- render: `initDataContexts()`
- interaction-core (deprecated): `initInteractionCoreSubscribes()`

## End-State Goal

1. Kernel packages (`props-manager`, `scene-tree`, `render`, etc.)
- no builtin defaults and no module-load side-effect registration.
- only primitives, registries, and explicit registration APIs.

2. Core (`@asyra/core`)
- framework lifecycle and orchestration only.
- no hardcoded opinionated builtin payload by default.

3. Preset package(s) (future)
- optional preset package `@asyra/preset` provides bundled defaults.
- app decides explicitly which preset(s) to apply.

## Architecture Principle

- Framework kernel must stay app-agnostic.
- Default UX/data behavior should be opt-in, not hidden.
- Backward compatibility is not a goal for this migration phase.

## Scope

In scope:
- implement final-state path directly from current state
- create `@asyra/preset` from current core transitional builtins
- remove implicit core builtin auto-registration

Out of scope:
- redesigning transaction semantics
- changing CRDT model
- changing feature-system runtime authority

## Target Shape

### Transitional (short-term)

- package exposes `registerXxx(...)`
- core calls builtins in deterministic order while extraction is in progress

### Final (framework-first)

- package exposes `registerXxx(...)`
- core does not auto-apply opinionated builtins
- preset package applies builtins through explicit app call

## Implementation Phases (Direct Final-State)

Prerequisite status:
- Phase 1/2 style cleanup work is sufficiently in place for direct cutover.
- Do not spend additional cycles on transitional hardening beyond what is required for the final path.

### Phase 3: Preset Package Introduction

- create `@asyra/preset`
- move current core builtins into preset package
- expose one explicit apply API:
  - `applyPreset(core)` or `core.applyPreset(preset)`

Exit criteria:
- app can run by applying preset explicitly
- preset has tests proving registration and startup equivalence

### Phase 4: Direct Cutover

- remove implicit core builtin auto-registration
- keep core/preset contract stable

Exit criteria:
- core has no opinionated builtin payload by default
- preset-based startup is official default path

## Risks

1. startup order regressions when moving registrations into preset package
2. hidden coupling where runtime currently depends on implicit core side effects
3. incomplete app bootstrap updates after core implicit builtins are removed

## Mitigation

- maintain deterministic registration order tests
- add idempotency assertions for register APIs
- run cross-package startup verification after each phase
- provide explicit bootstrap docs for preset-based startup

## Success Criteria

- kernel packages are builtin-free
- core is orchestration-first and policy-light
- default behavior is provided by optional `@asyra/preset`
- core startup requires explicit preset apply for opinionated defaults
