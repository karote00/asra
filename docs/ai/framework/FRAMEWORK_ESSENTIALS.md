# Framework Essentials

## Prime Directive

Asyra is a **deterministic execution kernel for declarative information modeling systems**, not a single product UI.

Any implementation decision must preserve:
- UI independence.
- Engine replaceability.
- Predictable state flow.
- Explicit extension points.

## Core Tenets

1. Framework Core vs App Domain
- Framework packages provide orchestration and primitives.
- App-level defines domain behavior, aggregation, and workflows.

2. Deterministic Data Flow
- Inputs trigger features.
- Features call framework APIs.
- State changes are transaction-bounded.
- Render/UI consume state as derived output.

3. Extension-first Design
- Register components, features, properties, render layers, and schemas.
- Prefer registry-driven expansion over hardcoded branches.

4. Safe by Default
- Runtime updates: valid -> write; invalid -> reject.
- Load path: valid -> write; invalid -> fallback.
- Migration is app-owned; validation safety is framework-owned.

## Current System Position

- `feature-system` is active decision/session runtime.
- `interaction-core` is deprecated and retained for compatibility only.
- `ui-context` is a convenience layer in core startup, not mandatory for custom apps.

## Non-negotiable Constraints

- No Pixi imports outside `@asyra/render`.
- App-level should use `core.xxx`/approved app APIs, not internal package singletons.
- Cross-package imports must use `@asyra/package-name`.

## Implementation Checklist (Every Change)

- confirm ownership boundary first (framework vs app)
- keep runtime flow deterministic
- expose extension via registration, not branching
- preserve load validation/fallback semantics
- update framework docs when contracts change
