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
- Preset provides optional official defaults and preset profile policy only
  (not app-domain owner, not framework-runtime owner).

2. Deterministic Data Flow

- Any product intent from a human, machine, UI, automation, AI, device, or
  external command source enters through a feature.
- Features call framework APIs.
- State changes are transaction-bounded.
- Render/UI and other projections consume authoritative state as derived
  output.
- Load, undo/redo replay, and future remote synchronization are state-apply
  paths, not new product intents; they use migration/validation/apply contracts
  instead of inventing parallel feature decisions.

3. Extension-first Design

- Register components, features, properties, render layers, and schemas.
- Prefer registry-driven expansion over hardcoded branches.

4. Safe by Default

- Runtime updates: valid -> write; invalid -> reject.
- Load path: valid -> write; invalid -> fallback.
- Migration is app-owned; validation safety is framework-owned.

## Extensible Runtime Guarantees

Asyra products should be assembled from framework runtime contracts, preset defaults, and app-owned feature behavior.

The framework guarantees:

- feature isolation: features define bounded behavior and mutate state through API boundaries
- transaction grouping: one intended user action maps to one intended undo commit
- local failure atomicity: failed, validation-rejected, or explicitly
  rollback-cancelled transactions reverse their rollbackable journal without
  creating undo/redo history
- explicit durability: runtime commit and persistence acknowledgement are
  separate observable states
- schema safety: invalid runtime writes are rejected and invalid load values fall back deterministically
- preset replaceability: defaults are optional, movable, and replaceable by product owners
- render boundary safety: render is an output/interaction bridge, not a data authority
- engine replaceability: render orchestration consumes the abstract
  `@asyra/render-engine` contract; preset binds the official `2D` provider
  through Core, while apps bind custom providers only with profile `CUSTOM`

## Current System Position

- `feature-system` is active decision/session runtime.
- `ui-context` is a convenience layer in core startup, not mandatory for custom apps.
- `render` is the active framework adapter/orchestration package;
  `render-engine` owns its abstract contract, and `render-engine-pixi` is the
  default concrete implementation selected by preset.
- The default package exports provide shared singleton instances for convenience;
  exported classes allow consumers to own selected package instances without
  requiring an all-or-nothing runtime container.
- Current transactions provide action grouping, undo/redo replay, automatic
  local rollback, synchronous commit validation, explicit cancel policies, and
  optional shared-channel delivery. This is application-layer ACID-inspired
  behavior; it does not claim database serializable isolation or distributed
  transaction guarantees.

## Non-negotiable Constraints

- No Pixi imports outside `@asyra/render-engine-pixi`.
- `@asyra/render` and concrete engines meet only through
  `@asyra/render-engine`; they must not import one another.
- App-level should use `core.xxx`/approved app APIs, not internal package singletons.
- Cross-package imports must use `@asyra/package-name`.
- `create-app/*` is generated output; do not hand-edit it directly.
- Pre-release legacy behavior must be upgraded or deleted; do not keep unreleased old flows as product fallbacks. See `rules/pre-release-legacy-removal.md`.

## Implementation Checklist (Every Change)

- confirm ownership boundary first (framework vs app)
- run ownership triage: user customization vs preset default vs framework runtime owner
- if placed in preset, confirm it is optional default wiring that helps users start quickly
- keep engine selection in composition and engine execution behind the
  abstract contract
- keep runtime flow deterministic
- expose extension via registration, not branching
- preserve load validation/fallback semantics
- remove stale pre-release branches instead of keeping them as compatibility fallbacks
- update framework docs when contracts change
