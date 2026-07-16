# Extendable Preset Plan

## Goal

Enable users to extend preset-provided feature/property behavior without patching framework internals.

If direct extension is not available for a target, users must still have a deterministic fallback path:

- unregister default registration
- redefine with their own implementation

## Context

`@asyra/preset` is the default settings package for framework initialization.
Today, many defaults are register-first and static once applied.
Users need predictable customization points for:

- feature behavior extension
- property definition/runtime extension

without forking preset/framework code.

This plan follows the render-engine boundary so startup can distinguish
engine injection from preset-owned feature/property extension. It provides the
customization contract later consumed by generic preset composition.

## Scope

In scope:

- extension/override contract for preset-owned feature registrations
- extension/override contract for preset-owned property registrations
- deterministic fallback contract (`unregister -> redefine`)
- startup ordering and conflict policy documentation

Out of scope:

- redesigning feature runtime semantics
- redesigning property schema model
- selecting or implementing a concrete render engine
- introducing public `2d`, `3d`, or `hybrid` profiles
- multi-engine or hybrid-runtime composition
- introducing app-specific policy into framework packages

## Target Behavior

1. Extension-first path

- user can register an extension against a preset target by id/name.
- extension runs via explicit strategy (for example `append`, `before`, `after`, `replace`).

2. Deterministic fallback path

- if a target does not expose extension points, user can:
  - unregister preset registration
  - register custom replacement
- behavior is fail-fast on missing targets or duplicate registrations.

3. Ownership clarity

- framework provides registry/runtime primitives.
- preset provides defaults and extension hooks.
- app chooses how to extend/override.

## Proposed Contract Direction

1. Registration metadata

- each preset default registration includes stable key + owner metadata.
- metadata is queryable for diagnostics and override validation.

2. Extension API surface (core-facing)

- add explicit APIs for extension registration by target key.
- keep target access by key/name, not by importing package internals.

3. Override policy

- duplicate-key registration throws by default.
- `replace` requires explicit intent and emits structured result.

4. Lifecycle

- extension registration should happen before preset apply finalization, or through explicit re-init flow.
- unregister must cleanly dispose observers/handlers to avoid stale side effects.

5. Relationship to preset composition

- this plan owns target extension/replacement semantics;
- the later generic preset composition plan owns ordered startup layers;
- neither plan infers product mode from render-engine capabilities.

## Public Contract

This plan adds one bounded registration-extension contract. It does not add a
general preset-layer composer.

1. Framework-neutral primitive

- `@asyra/utils` owns an extension-target registry with stable target keys,
  names, capability kind, supported strategies, queryable owner metadata,
  structured operation results/errors, and lifecycle cleanup handles.
- supported strategies are exactly `before`, `after`, `append`, and `replace`.
- resolution order is `before -> default or one explicit replace -> after ->
append`; the caller-provided extension array order is preserved within each
  strategy bucket.
- a second `replace`, duplicate extension key, missing target, invalid or
  unsupported strategy, apply failure, and cleanup failure fail fast with a
  stable error code and structured details.
- `replace` bypasses the default installer and is never routed through ordinary
  duplicate registration.

2. Preset surface

- `@asyra/preset` exports stable feature/property target constants, detached
  target metadata queries, extension registration types, and the preset
  application result/lifecycle type.
- `applyPreset(core)` remains valid and keeps the existing default behavior.
- the explicit dependency-bundle and custom `renderEngineFactory` overloads
  remain valid; an additive options field accepts ordered extensions.
- one preset application owns its applied cleanup handles, supports target
  unregister by stable key, and disposes owned handles in reverse application
  order.
- property schema/runtime targets support explicit `replace`; the feature
  registration hook supports `before`, `after`, `append`, and `replace` with
  caller array order preserved inside each strategy bucket.
- property definition/schema and property runtime targets are keyed by the
  existing public property type; the feature-registration target is an
  app-owned feature hook and does not move app feature policy into preset.

3. Framework/runtime facade

- Core exposes curated public feature and property define/query/unregister
  operations needed by preset installers and app replacements.
- feature-system keeps existing execution/session semantics and owns cleanup of
  registry entries, pending registrations, execution handlers, session
  handlers, input subscriptions, and reactive-event subscriptions.
- props-manager keeps the current schema model and validation semantics; a
  replacement unregister is rejected while that property type has active
  runtime instances, then removes the owned schema/constructor registrations
  when safe.

4. Deterministic fallback

- when target metadata does not list the requested direct strategy, the formal
  path is `presetApplication.unregisterTarget(stableKey)` followed by app-owned
  redefinition through public Core APIs.
- redefine cannot run after a missing-target, active-usage, or cleanup failure.
- a cleanup failure keeps the target applied for deterministic retry; cleanup
  handles that already completed successfully are not run again.
- no fallback state, duplicate-registration tolerance, or automatic default
  restoration may hide a failed replacement.

## Package Ownership

- `@asyra/utils`: registry, ordering, conflict, result/error, and lifecycle
  primitives.
- `@asyra/feature-system`: feature runtime registration and complete feature
  unregister cleanup.
- `@asyra/props-manager`: property schema/runtime registries, active-usage
  checks, and safe unregister.
- `@asyra/core`: curated public facade only; it does not choose customization
  policy.
- `@asyra/preset`: stable default target manifest, default installers,
  extension hooks, and one application lifetime.
- app/user composition: chooses extend, explicit replace, or fallback
  replacement and owns the custom implementation.

## Product Cases

1. Feature extension registers an app-owned feature through the public preset
   feature target and executes it through unchanged feature runtime semantics.
2. Property extension registers definition/schema or runtime behavior through
   a public property target without importing preset internals.
3. Explicit replace bypasses the target default without producing an ordinary
   duplicate-registration failure.
4. Duplicate extension key, missing target, invalid or unsupported strategy,
   and replace conflict fail fast with stable structured errors.
5. A target without direct extension support completes `unregister -> redefine`
   only after successful cleanup.
6. Feature/property unregister, replacement, apply rollback, and full preset
   disposal leave no observers, handlers, subscriptions, runtime registrations,
   or stale side effects owned by the removed registration.
7. Preset application order is deterministic, while `applyPreset(core)` and
   existing framework-facing APIs remain compatible.
8. No target, strategy, result, or startup path infers a product mode from
   render-engine capability.

## Definition of Done

- stable public target identity, owner metadata, strategies, query APIs,
  results/errors, and fallback APIs are documented and covered by formal tests;
- feature and property extension/replacement tests prove current missing
  behavior first, then pass through public package surfaces;
- ordering and conflict behavior are deterministic under repeated test runs;
- unregister/replacement/apply rollback/disposal cleanup is proven without
  stale effects;
- package boundaries contain no deep cross-package imports and no app policy in
  framework packages;
- affected package tests, the Inspector contract test, relevant Asyra Design
  tests, `yarn test:local`, `yarn lint:ci`, `yarn react:build`, and dependency
  boundary validation pass.

## Inspector Authority

- exact flow data:
  `docs/ai/framework/plans/extendable-preset-flow-inspector.data.cjs`
- interactive viewer:
  `docs/ai/framework/plans/extendable-preset-flow-inspector.html`
- executable contract:
  `docs/ai/framework/plans/extendable-preset-flow-inspector.contract.test.cjs`

Implementation must advance one Inspector owner step at a time. The Inspector
defines architecture ownership and routes; this plan remains the product
behavior authority.

## Implementation Slices

1. Define extension/override data contracts

- target identity
- strategy options
- conflict/error result shape

2. Add registry hooks for feature/property extension points

- feature registration extension hooks
- property definition/runtime extension hooks

3. Implement fallback `unregister -> redefine` orchestration

- validate active usage constraints
- ensure cleanup ownership is deterministic

4. Preset integration

- register default targets with stable metadata
- expose recommended app-level extension sequence

5. Docs and tests

- add framework docs for extension vs replacement flow
- add tests for append/replace/conflict/unregister flows

## Validation

- user can extend one preset feature without touching framework package internals.
- user can extend one preset property registration without touching preset internals.
- unregister + redefine flow works deterministically when extension hook is unavailable.
- conflict/error messages are actionable and stable.

## Risks

1. Extension ordering ambiguity can create non-deterministic behavior.
2. Over-flexible hooks may bypass runtime safety boundaries.
3. Replace flow can break existing scenes if active usage checks are weak.
