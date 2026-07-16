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
