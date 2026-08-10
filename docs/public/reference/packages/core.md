# `@asyra/core`

Strict public composition facade and lifecycle coordinator for current Asyra
Framework capabilities.

## Owns

- composition closure, startup ordering, readiness, and teardown coordination
- curated package facades for registration, canonical operations, load/save,
  input, rendering, optional Collaboration, and diagnostics
- one pre-start render-engine provider and an engine-neutral default adapter
- origin-neutral coordination of already validated canonical changes

## Does not own

App-domain rules, UI presentation, concrete engine resources, collaboration
wire policy, persistence backend policy, permissions, or the proposed future
Core Kernel.

## Compose when

Use Core for the supported public Framework composition and for app extensions
that cross canonical package owners. A lower-level package test may intentionally
compose its owner directly. Do not treat the current no-provider compatibility
branch as a public server/headless lifecycle.

## Public entrypoints and prerequisites

- `@asyra/core` — default singleton, `Core` class, concrete facade, and curated
  helpers
- `@asyra/core/contracts` — side-effect-free public contracts for consumers and
  independent backends
- `@asyra/core/canvas-pipeline-debugger` — opt-in visual diagnostics facade

Current visual startup requires the browser/Core host contract and a provider
for visual output. Registration occurs before the first `core.start(...)`.

## Lifecycle, inputs, outputs, and failure

Startup closes/validates composition, prepares optional Collaboration,
initializes the renderer/provider, activates input when a canvas exists,
initializes observers, loads canonical data, initializes Features, activates
Collaboration, then publishes readiness. Provider, engine, renderer, load,
Feature, or collaboration activation failure prevents false ready and tears
down owned work. Post-start registration/replacement fails explicitly.

## Relationships

Core coordinates Factory, Feature System, Input, Persistence, Props, Reactive
Events, Render, Scene Tree, Selection, System Context, UI Context, and Utils
through their owner APIs. Preset installs through the strict
`CorePresetInstallAPIs` subset. App and package extensions use public facades,
not Core's internal dependency container.

## Maintained use path

Run `yarn examples:run core-information-model`. Then choose
[official 2D Preset](../../start/preset-2d.md) or
[custom composition](../../start/custom-composition.md).

## Replacement and disabled behavior

Consumers may use the default shared singleton or construct a `Core` with the
intended package instances. Providers, renderer, persistence sources, hooks,
and optional Collaboration are replaceable through declared pre-start APIs.
Without a render provider, only Core's narrow existing no-canvas compatibility
path applies; it is not a no-dependency Headless contract.

## Support, migration, and deprecation

Current support is the browser/Core composition. `CoreBasicAPIs` and
`CoreExtensionAPIs` form the concrete facade; `@asyra/core/contracts` is the
safe contract-only subpath. The future Core Kernel is unscheduled. Migration
must not bypass public facades or assume multiple isolated runtimes without
formal proof.

## Canonical sources and release inventory

- [Package contract](../../../ai/framework/packages/core.md)
- [Package manifest](../../../../packages/core/package.json)
- [Current runtime roadmap](../../learn/runtime-boundaries-roadmap.md)

Version and all three public entrypoints are generated from the package
manifest. The documentation gate verifies this guide against the current
release package set.
