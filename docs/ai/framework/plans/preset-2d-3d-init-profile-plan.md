# 3D and Hybrid Preset Profile Activation Plan

## Status

Deferred and prerequisite-gated.

The public profile vocabulary is owned by the active Preset Profile and
Selectable Defaults plan:

- `2D`: available, preset-owned Pixi provider;
- `CUSTOM`: available, no preset-owned provider;
- `3D`: known but unavailable;
- `HYBRID`: known but unavailable.

This plan no longer decides identifiers or associates defaults with profiles.
It governs only the future transition of `3D` or `HYBRID` from unavailable to
available.

## Non-Negotiable Separation

Profile selection controls only preset-owned render-engine provider policy.
The independent `defaults` option controls official preset module installation.
Activating a profile must not implicitly add, remove, or filter defaults.

Catalog metadata for unavailable profiles must not import, dynamically load,
bundle, instantiate, or simulate an engine.

## 3D Activation Prerequisites

- a supported production 3D engine or supported external adapter implementing
  `@asyra/render-engine`;
- canonical camera, viewport, geometry, material, surface, hit-test,
  interaction, selection, and input contracts;
- load, undo/redo, persistence, local shared-channel, failure, cleanup, and
  instance-isolation cases;
- explicit capability failure behavior with no Pixi or placeholder fallback;
- app-level evidence demonstrating a complete production use case.

A fake contract-test engine does not qualify as the official provider.

## Hybrid Activation Prerequisites

- every participating engine satisfies the abstract engine contract;
- one explicit single- or multi-engine composition model;
- surface/render-order and resource-lifecycle ownership;
- camera, viewport, and coordinate conversion ownership;
- hit-test, selection, interaction, and input-routing ownership;
- deterministic failure cleanup across participating runtimes;
- convergence rules for state projected into more than one engine;
- formal product cases proving the full coordinated route.

Hybrid is not implemented by concatenating 2D and 3D defaults or providers.

## Activation Work

For one profile at a time:

1. Write the product contract and matching Inspector owner flow.
2. Add the concrete provider package through the abstract boundary without
   changing preset defaults selection.
3. Change only that profile catalog entry from `available: false` to
   `available: true` and set its preset-owned diagnostic engine id.
4. Add integration, failure, cleanup, instance-isolation, and real app cases.
5. Update package/app docs and run package, root, dependency, live, and visual
   gates.

## Product Cases

- unavailable `3D`/`HYBRID` fails before defaults or provider mutation;
- activation changes availability and provider policy only;
- omitted, empty, and explicit defaults resolve identically before and after a
  profile availability change;
- unsupported engine capabilities fail explicitly with no fallback surface;
- app customizations remain app-owned and run before Core startup;
- separate Core instances share no provider or engine resources.

## Definition of Done Per Activation

- every prerequisite has formal implementation evidence;
- the provider is production-capable, not a placeholder;
- profile/default independence remains formally tested;
- current `2D` and `CUSTOM` behavior remains compatible;
- affected package/app/Inspector, root, build, lint, dependency, live, and
  synchronized visual gates pass.
