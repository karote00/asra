# Generic Preset Composition Plan

## Status and Dependencies

Near-term, after:

1. the render-engine boundary provides explicit concrete-engine injection; and
2. the extendable-preset contract defines deterministic extension and
   replacement behavior.

This plan does not introduce public `2d`, `3d`, or `hybrid` profile names.
Official render-mode profiles remain trigger-gated in
`preset-2d-3d-init-profile-plan.md`.

## Goal

Make preset startup deterministic and composable without coupling framework
bootstrap to a dimension label or to a concrete render engine.

Target composition:

`shared preset defaults -> concrete-engine factory/injection -> optional capability bundles -> app customizations`

## Product Contract

Supported behavior:

- `applyPreset(core)` keeps its current compatibility behavior and installs the
  default Pixi-backed startup wiring.
- Apps can explicitly supply startup composition inputs through a typed preset
  surface after the render-engine injection contract is available.
- Each layer has one owner and a deterministic application order.
- Duplicate targets fail fast unless the extendable-preset contract explicitly
  authorizes replacement.
- Failed composition does not report a ready runtime or silently leave an
  accepted partial profile.
- Diagnostics identify the concrete engine and applied registration groups;
  they do not infer a `2d`, `3d`, or `hybrid` product mode.

Unsupported behavior:

- selecting an official render-mode profile that has no concrete runtime;
- treating engine capabilities as app-domain feature ownership;
- importing concrete engine internals into preset or non-render packages;
- using empty bundles, fallback output, or no-op registrations to simulate
  unsupported capabilities.

## Ownership and Composition Layers

1. Shared preset defaults

- Owner: `@asyra/preset`.
- Contains framework-wide optional defaults that are independent from a
  concrete engine and app domain.

2. Concrete-engine bootstrap

- Abstract contract owner: `@asyra/render-engine`.
- Adapter/orchestration consumer: `@asyra/render`.
- Concrete implementation owner: the selected engine package, with
  `@asyra/render-engine-pixi` as the default.
- Preset constructs the selected engine instance or factory and injects it into
  `@asyra/render`; it does not become the engine runtime owner.

3. Optional capability bundles

- Owner: the package that defines the capability contract.
- Bundles are explicit and independently selectable; they are not inferred from
  a dimension label.

4. App customizations

- Owner: app code.
- Uses the extendable-preset extension path or deterministic
  `unregister -> redefine` fallback.

Preset coordinates application order but does not become the runtime owner of
any registration it installs.

## Scope

In scope:

- typed composition input and result contracts;
- deterministic layer and registration ordering;
- backward-compatible default application;
- duplicate, missing-target, replacement, and partial-failure behavior;
- instance-local composition and diagnostics;
- integration with the engine-injection and extendable-preset contracts;
- documentation and formal tests.

Out of scope:

- extracting the Pixi engine or defining the engine adapter;
- implementing a production 3D engine;
- multi-engine surface, camera, coordinate, hit-test, or input coordination;
- official `2d`, `3d`, or `hybrid` profiles;
- app-domain feature bundles.

## Architecture Flow

1. App supplies Core plus optional typed composition input.
2. Preset resolves the compatibility-safe default composition when input is
   omitted.
3. Preset validates concrete-engine bootstrap availability.
4. Preset applies shared defaults.
5. Preset constructs the selected concrete engine and injects it into
   `@asyra/render`, which consumes only the `@asyra/render-engine` contract.
6. Preset applies explicitly requested capability bundles.
7. Preset applies app-owned customization operations through the approved
   extension/replacement contract.
8. Preset validates the completed registration set and publishes instance-local
   diagnostics.
9. Core proceeds to runtime-ready only after successful completion.

Before implementation, an Inspector flow must define each step's owner, input,
output, bypass conditions, allowed and forbidden contributors, failure owner,
and cleanup responsibility.

## Implementation Slices

1. Product contract and Inspector

- lock supported composition layers, public behavior, failure semantics, and
  instance boundaries;
- add executable product cases before production changes.

2. Compatibility extraction

- describe and test the complete observable behavior of `applyPreset(core)`;
- extract its registration groups without changing current startup behavior.

3. Typed composition

- add the minimum composition surface needed to accept an engine factory,
  capability bundles, and app customization;
- keep the abstract contract and injection semantics owned by the render-engine
  boundary while app/preset selection remains explicit.

4. Validation and diagnostics

- enforce ordering, duplicate, missing-target, partial-failure, and
  instance-isolation contracts;
- report the selected engine and applied groups.

5. Documentation and integration verification

- update preset, core startup, render, render-engine, concrete-engine, and app
  bootstrap documentation;
- verify Asyra Design remains behaviorally identical through the default path.

## Product Cases

- omitted composition preserves current Asyra Design startup behavior;
- explicit default engine composition produces the same registration result;
- shared defaults apply exactly once;
- app customization runs after engine and capability bundles;
- duplicate registration fails before runtime-ready;
- explicit replacement follows the extendable-preset contract;
- unknown engine bootstrap or capability bundle fails with an actionable error;
- a failed layer does not publish successful completion diagnostics;
- separate Core/preset instances do not share composition state;
- no public render-mode profile is inferred from engine capabilities.

## Definition of Done

- the compatibility path is behaviorally unchanged;
- composition order and failure ownership are executable contracts, not only
  documentation;
- engine selection uses the abstract render-engine boundary;
- app customization uses the explicit extension/replacement contract;
- no concrete engine internals or app-domain policy leak into preset;
- no placeholder render-mode profiles exist;
- package tests, affected app E2E, build, lint, and live startup verification
  pass.

## Risks

1. Composition may duplicate registry semantics.

- Keep registration conflict ownership in the registries and use preset only
  for ordered orchestration.

2. Engine bootstrap may absorb app-domain defaults.

- Restrict engine contributions to the abstract engine contract and
  render-specific registrations.

3. Partial failure may leave subscriptions active.

- Define per-layer disposal/cleanup ownership before implementation and test
  failure after each applied layer.
