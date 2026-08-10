# Compose only the infrastructure you need

Use a custom composition when your product needs Framework infrastructure but
does not want the complete official design-tool baseline. Start from Core,
define your app-owned information, and compose only the capabilities your
runtime actually uses.

This is the general Asyra path for whiteboards, BIM, VR, simulations, and other
domain products. The Framework supplies owner boundaries and coordination; it
does not know the domain rules that make your product correct.

## Current composition boundary

The current public `@asyra/core` facade coordinates browser/Core startup and
imports the present Framework graph. It can complete its existing no-canvas
compatibility branch when the default renderer lacks a provider, but that is
not a public Headless Core lifecycle or a no-Render dependency guarantee.

For non-visible and machine-facing products, read the
[runtime roadmap](../learn/runtime-boundaries-roadmap.md) before choosing an
architecture. Do not invent `createHeadlessCore()` or a Core Kernel package.

## Begin with information

Run the maintained model-only proof:

```shell
yarn examples:run core-information-model
```

The example registers an app-owned status model and updates it through the
current Core facade while Collaboration and AI remain uncomposed and no engine
provider is selected. It proves optional capability absence in a supported
artifact test; it does not claim a separately supported server runtime.

## Choose capabilities explicitly

- Use `@asyra/props-manager` and Core registration for app-owned property
  definitions and validation.
- Use `@asyra/scene-tree` for canonical hierarchy, not for app-specific group
  semantics.
- Use `@asyra/feature-system` and `@asyra/factory` for intent sessions and one
  transaction per intended action.
- Use `@asyra/render` plus an `@asyra/render-engine` provider when information
  needs a visual projection.
- Add `@asyra/persistence`, `@asyra/collaboration`, or
  `@asyra/ai-agent-runtime` only when the app owns their adapters and policy.
- Use `@asyra/preset` selectively when an official default helps; custom and
  Preset capabilities can coexist through their declared registration rules.

Core is the public composition facade. Do not reach into dependency containers
or package-private source, and do not make one package call another package's
owner through a relative import. Use public facades and typed communication.

## Validate the boundary

Prove the exact composition you claim:

- import only public package entrypoints;
- confirm optional packages perform no work when absent;
- verify duplicate and post-start registration fail explicitly;
- verify canonical write, rollback, undo/redo, and load paths;
- test the selected host environment; and
- use clean-consumer artifacts before describing the composition as supported.

## Canonical sources

- [Framework architecture](../../ai/framework/ARCHITECTURE.md)
- [Core package contract](../../ai/framework/packages/core.md)
- [Maintained composition helper](../../examples/create-core-composition.mjs)

## Next

- [Learn information models](../learn/information-models.md)
- [Build a custom schema](../build/custom-schema.md)
