# Register projections without changing ownership

Canonical information and visual output are separate owners. Render observes
canonical changes, projects them through registered strategies and layers, and
delegates engine work through the public render-engine contract. A concrete
engine never becomes the owner of document geometry, domain meaning, or app
behavior.

This boundary lets one information model appear as a canvas, list, detail view,
analytics panel, export, or another projection. The projections may differ,
but accepted product intent still reaches the same canonical owners.

## Registration

Register component definitions, render strategies, render layers, interaction
targets, and UI properties while composition is open. Core exposes curated
public registration facades; the owning package retains lifecycle and
validation.

Registration should fail explicitly when an id is duplicated or ownership is
invalid. Do not silently replace a strategy because two extensions chose the
same id. Use the declared unregister or replacement path while composition
still permits it.

## Projection ownership

A projection may decide how canonical information looks and how engine input
is normalized into a Framework target. It may cache provider-owned resources
needed to draw that output. It may not become the only copy of product state,
decide whether a domain command is valid, or mutate another owner directly.

App Features decide what an accepted interaction means. Canonical packages
settle the resulting state. Projection layers then render that state. Keeping
those steps separate allows the same intent to work through a canvas, another
UI, automation, collaboration, or an AI action without creating competing
sources of truth.

## Provider boundary

`@asyra/render-engine` defines an engine-neutral provider contract. The
official `@asyra/render-engine-pixi` package is one optional implementation
selected by the current Preset `2D` profile. Concrete SDK objects, contexts,
resources, and handles remain inside their provider boundary.

Choosing or replacing a provider is not an ordinary app-domain extension. It
changes the lower-level Framework composition and therefore belongs in
Customize. Follow the
[custom render-boundary guide](../build/render-boundary.md) for the copyable
provider setup, lifecycle, capability checks, failure behavior, and cleanup
proof.

## Failure and absence

Missing capabilities, invalid engines, initialization failure, and cleanup
failure remain visible. They must not silently fall back to Pixi or another
provider. Direct `Render.init()` without a provider throws the declared
missing-provider error. Core's narrower no-provider compatibility path is part
of the current browser-shaped startup and is not public Headless support.

## What to validate

At the conceptual boundary, verify that:

- canonical create, update, remove, load, replay, undo, and redo remain owned
  outside the concrete engine;
- projections receive canonical changes rather than inventing a second model;
- interactions return normalized semantic targets before Features interpret
  intent;
- provider resources do not enter document state or Core contracts; and
- provider absence and failure stay explicit.

These checks prove that output can change without moving product authority into
the renderer.

## Canonical sources

- [Render contract](../../ai/framework/packages/render.md)
- [Render Engine contract](../../ai/framework/packages/render-engine.md)
- [Replace the default engine](../../ai/framework/golden-paths/replace-render-engine.md)

## Next

- [Customize a render boundary](../build/render-boundary.md)
- [Read the Render Engine reference](../reference/packages/render-engine.md)
