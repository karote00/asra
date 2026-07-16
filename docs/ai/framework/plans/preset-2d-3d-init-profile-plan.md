# Official 2D/3D/Hybrid Preset Profiles Plan

## Status

Deferred and prerequisite-gated.

Do not expose an official render-mode profile until the corresponding concrete
runtime, canonical default bundles, and formal integration cases exist. This
plan must not be used to create empty, placeholder, or capability-incomplete
profiles.

## Why This Is Deferred

Asyra is an abstract render framework. The framework can be complete and
engine-replaceable while shipping Pixi as its only default concrete engine.
Users may provide their own engine through the render-engine boundary.

A public profile is a product promise, not only a registration label:

- `2d` promises a supported 2D engine and coherent 2D defaults;
- `3d` promises a supported 3D engine and coherent 3D defaults;
- `hybrid` promises explicit coordination between its participating render
  runtimes, coordinate systems, cameras, hit testing, selection, and input.

Publishing these names before those capabilities exist would misrepresent
framework support and prematurely constrain the engine abstraction.

## Prerequisites

All profiles require:

1. the render-engine boundary and explicit engine injection;
2. deterministic generic preset composition;
3. the extendable-preset extension/replacement contract;
4. engine and bundle diagnostics;
5. formal compatibility, failure, and instance-isolation tests.

Additional profile prerequisites:

### Official 2D profile

- a supported concrete 2D engine;
- canonical 2D feature, property, schema, render-layer, and input bundles;
- a demonstrated product need for an explicit profile beyond the existing
  compatibility-safe `applyPreset(core)` default.

The existing Pixi-backed default may be organized internally as a 2D-capable
bundle without publishing a `profile: '2d'` selector.

### Official 3D profile

- a supported production 3D engine or supported external adapter;
- canonical 3D camera, viewport, geometry, material, render-layer, selection,
  and input contracts;
- load, undo/redo, persistence, and local shared-channel integration cases;
- explicit unsupported-capability behavior.

A fake or contract-test engine used to prove adapter replaceability does not
qualify as an official 3D engine.

### Official hybrid profile

- every participating concrete engine satisfies the engine boundary;
- an explicit single-engine or multi-engine composition model;
- surface and render-order ownership;
- camera, viewport, and coordinate-space conversion ownership;
- hit-test, selection, and input-routing ownership;
- resource lifecycle and failure cleanup across participating runtimes;
- convergence rules for state projected into more than one engine.

Hybrid is not implemented by concatenating 2D and 3D registration bundles.

## Goal After Prerequisites Exist

Provide official, usable render-mode profiles that package supported engine and
framework defaults without moving runtime or app-domain ownership into preset.

Target developer experience:

- choose a supported official profile;
- apply preset through the generic composition contract;
- customize app-domain behavior through explicit extension/replacement paths;
- receive a deterministic failure when required capabilities are unavailable.

## Ownership

- `@asyra/render-engine` owns the abstract engine contract.
- `@asyra/render` owns framework adaptation and render orchestration.
- Concrete engine packages own engine implementation and render-specific
  bootstrap.
- `@asyra/preset` selects and injects the default concrete engine.
- Framework packages own runtime behavior and authoritative state.
- Preset owns optional default bundle coordination.
- Apps own domain features, product policy, and customization choices.

A profile may reference these owners but must not absorb their runtime
responsibilities.

## Scope After Activation

In scope:

- stable profile identifiers only for profiles whose prerequisites pass;
- mapping an official profile to supported concrete-engine and canonical
  default bundles;
- validation of required capabilities and registration groups;
- deterministic integration with generic preset composition;
- actionable diagnostics and unsupported-profile failures;
- compatibility, extension, replacement, and instance-isolation tests;
- documentation that distinguishes framework abstraction from officially
  shipped engines.

Out of scope:

- defining the render-engine adapter;
- generic preset composition;
- using a profile to select app-domain business behavior;
- silently degrading an unsupported profile;
- treating an empty bundle as a supported mode;
- claiming parity between engines without formal product cases.

## Eventual Contract Direction

An options-based surface such as `applyPreset(core, { profile: '2d' })` remains
only a possible direction. The final public API must be decided from the
available engines and generic composition contract when this plan is activated.

The API must satisfy:

- omitted options preserve the compatibility-safe default path;
- only supported official profiles are exported;
- unknown or unavailable profiles fail with actionable diagnostics;
- profile selection does not bypass explicit engine capability validation;
- app customization runs after profile-owned default bundles;
- duplicate and replacement behavior follows the extendable-preset contract.

## Activation Triggers

Activate only the profile whose trigger is satisfied:

- `2d`: explicit profile selection provides demonstrated value beyond the
  existing default and the supported 2D bundle is stable.
- `3d`: a supported production 3D engine and canonical 3D bundles exist.
- `hybrid`: the multi-engine or hybrid-runtime architecture is implemented and
  formally verified.

The profiles do not need to activate together. Their identifiers must not be
reserved as supported public values before activation.

## Implementation Slices After Activation

1. Product contract and Inspector

- define supported behavior, profile owner handoffs, negative cases, and
  bounded definition of done for the activated profile only.

2. Concrete bundle inventory

- identify the supported engine and canonical defaults;
- reject app-domain or capability-incomplete contributors.

3. Generic composition integration

- map the activated profile to existing engine/bootstrap/capability inputs;
- do not create a parallel startup pipeline.

4. Validation and diagnostics

- verify engine availability, required capabilities, duplicate/replacement
  behavior, failure cleanup, and instance isolation.

5. App verification and documentation

- prove a real app can use the profile through normal load, interaction,
  undo/redo, persistence, and render flows;
- document supported and unsupported behavior without parity claims.

## Product Cases After Activation

- selecting the profile installs its supported engine and canonical bundles;
- omitted options preserve existing default startup;
- missing engine or capability fails before runtime-ready;
- no partial profile is reported as successfully applied;
- app customization remains app-owned and applies deterministically;
- separate instances do not share profile state;
- unsupported official profile names are not exported;
- engine swap does not require changes in non-render packages.

## Definition of Done

For each activated profile:

- every prerequisite is backed by implementation and formal tests;
- a real concrete engine, not a placeholder, owns rendering;
- canonical defaults exist for the advertised mode;
- the profile reuses generic preset composition and engine injection;
- failure and unsupported-capability behavior are deterministic;
- current app behavior remains compatible unless explicitly versioned;
- package tests, affected app E2E, build, lint, and live visual verification
  pass;
- documentation states exactly which engines and capabilities are supported.

## Risks

1. Marketing labels may outrun runtime capability.

- Keep every profile trigger-gated and export only supported identifiers.

2. Profiles may absorb app-domain behavior.

- Limit profiles to engine and framework default bundles; keep product policy in
  apps.

3. Hybrid may be mistaken for bundle concatenation.

- Require an explicit coordination architecture before activation.

4. Profile APIs may constrain future engines.

- Finalize public selectors only after concrete adapters and generic
  composition provide evidence for the contract.
