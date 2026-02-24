# Builtin Registry Consolidation Plan (Core-Owned)

## Context

Some builtin registrations (including YJS-related registration/setup) are currently initialized in package-local paths (for example factory-level setup).
This spreads bootstrap ownership and makes framework initialization harder to reason about.

## Goal

Move builtin registration ownership to `@asyra/core` so all framework builtin registrations are coordinated in one place.

## Principle

- Core owns framework bootstrap orchestration.
- Domain packages expose registration functions, but do not self-own global builtin bootstrap policy.
- App-level should not need to know where builtin registrations are scattered.

## Scope

In scope:
- identify all current builtin registrations (including YJS setup-related registration points)
- move bootstrap invocation path into core startup
- keep package-level registration functions callable by core

Out of scope (phase 1):
- changing runtime behavior semantics
- removing YJS usage itself
- redesigning transaction model

## Target Shape

1. Package-level export
- each package provides explicit `registerBuiltinXxx(...)` API

2. Core bootstrap
- core calls all builtin registration APIs in deterministic order during initialization

3. Ownership clarity
- docs show `core` as builtin registry owner
- package docs describe only what they expose, not global bootstrap ownership

## Implementation Phases

### Phase 1: Inventory
- list every builtin register/setup call across packages
- classify by owner package and dependency order

### Phase 2: Extract and Expose
- ensure each package has explicit registration export(s)
- remove implicit module-level registration side effects where possible

### Phase 3: Core Wiring
- add centralized builtin registration pipeline in core initialization
- enforce deterministic ordering and idempotent behavior

### Phase 4: Validation
- verify startup behavior remains equivalent
- verify registration can be called once safely
- verify no missing registration paths after consolidation

## Risks

1. Startup order regression if dependency ordering is wrong.
2. Duplicate registration if old package-local side effects remain.
3. Hidden runtime dependency on import side effects.

## Success Criteria

- builtin registration entrypoint is centralized in core
- package-local hidden bootstrap is removed or explicitly marked
- startup remains deterministic and behavior-equivalent
- docs clearly reflect core-owned builtin registration policy
