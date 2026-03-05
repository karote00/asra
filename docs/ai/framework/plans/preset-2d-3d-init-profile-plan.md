# Preset 2D/3D Init Profile Plan

## Goal

Provide explicit preset init profiles so users can bootstrap quickly for 2D or 3D products without patching framework internals.

Target developer experience:
- pick profile (`2d`, `3d`, or `hybrid`)
- apply preset
- customize only what is domain-specific

## Context

The framework already treats preset as optional bootstrap wiring and keeps runtime ownership in framework packages.
To improve adoption speed, preset should provide first-class init profiles that package default registrations by product mode.

This plan keeps ownership boundaries:
- framework packages own runtime behavior/state
- preset owns optional default registration bundles
- app code owns domain behavior and override choices

## Scope

In scope:
- profile contract for preset initialization (`2d`, `3d`, `hybrid`)
- deterministic registration ordering across shared/profile/app layers
- extension-first customization path for profile-owned registrations
- deterministic fallback path (`unregister -> redefine`) when extension hooks are unavailable
- docs/tests for profile behavior and compatibility

Out of scope:
- introducing render-engine-specific logic outside `@asyra/render`
- moving app-domain runtime ownership into preset
- redesigning feature-system or props-manager core semantics

## Target Behavior

1. Profile-based initialization
- app can call preset with an explicit profile
- profile controls default bundles for features, properties, schemas, render layers, and input wiring

2. Backward-compatible default path
- existing `applyPreset(core)` behavior remains stable
- omitted profile resolves to a compatibility-safe default profile

3. Deterministic composition order
- shared preset defaults -> selected profile defaults -> app customizations
- duplicate registrations fail fast unless explicit replace policy is used

4. Explicit customization model
- extension-first API for known preset targets
- fallback replacement path remains available and documented

## Proposed Contract Direction

1. API shape
- keep `applyPreset(core)` compatibility
- support options-based initialization (for example: `applyPreset(core, { profile: "2d" })`)
- expose stable profile identifiers/types from `@asyra/preset`

2. Profile module boundaries
- `shared` profile module for defaults common to all profiles
- `2d` profile module for 2D-centric defaults
- `3d` profile module for 3D-centric defaults
- `hybrid` profile module for mixed-mode defaults and profile-bridge wiring

3. Extension and override policy
- profile-owned targets publish stable keys/metadata for extension lookup
- extension strategy is explicit (`before`, `after`, `append`, `replace` as applicable)
- replacement remains deterministic via unregister/redefine

4. Validation and diagnostics
- actionable errors for unknown profile, missing target, or duplicate registration
- diagnostics report selected profile and applied registration groups

## Implementation Slices

1. Profile contract + exports
- define preset profile constants/types
- add option shape to preset init surface with compatibility defaulting

2. Registration bundle extraction
- separate current defaults into shared and 2D profile modules
- keep runtime behavior identical for current default path

3. 3D + hybrid preset bundles
- add 3D and hybrid registration bundles with explicit boundaries
- ensure no cross-layer ownership leakage

4. Customization hooks + fallback flow
- add extension registration path for profile targets
- document and test unregister/redefine fallback

5. Verification and docs sync
- test profile selection, ordering, conflict behavior, and compatibility
- update framework API/package docs for new preset init contract

## Success Criteria

- user can initialize with `2d`, `3d`, or `hybrid` profile using a documented preset surface
- `applyPreset(core)` remains backward-compatible
- profile customization works via explicit extension path or deterministic fallback
- ownership boundaries in framework docs remain consistent and clear

## Risks

1. Profile drift and duplicate defaults
- mitigate by centralizing shared defaults and enforcing profile composition rules

2. Extension ordering ambiguity
- mitigate by explicit strategy semantics and deterministic application order

3. Compatibility regression in existing apps
- mitigate with compatibility default profile, regression tests, and staged rollout
