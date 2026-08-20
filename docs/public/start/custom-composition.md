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

## Where this runs

Custom composition belongs to the browser application's bootstrap module. It
constructs one isolated owner graph, registers app capabilities while
composition is open, and hands the resulting Core instance to the app startup.

## Implementation

This is the minimal current public composition shape without Preset. Add only
the optional provider boundaries your product uses:

```ts
import { Core } from '@asyra/core'
import { Factory } from '@asyra/factory'
import { InputSystem } from '@asyra/input-system'
import { PropsManager } from '@asyra/props-manager'
import { Render } from '@asyra/render'
import { SceneTree } from '@asyra/scene-tree'
import { SelectionManager } from '@asyra/selection'
import systemContext from '@asyra/system-context'

const factory = new Factory()
const props = new PropsManager()
const render = new Render()
const sceneTree = new SceneTree(props)
const selection = new SelectionManager()
const inputSystem = new InputSystem()

export const core = new Core({
  factory,
  inputSystem,
  props,
  render,
  sceneTree,
  selection,
  systemContext
})
```

Keep shared owners shared: `SceneTree` receives the same Props Manager instance
that Core receives. Collaboration and AI do not appear unless the app
explicitly composes their adapters.

## Flow

1. Construct one instance for each current Framework owner.
2. Pass those owners to Core through public package entrypoints.
3. Register app schemas, Features, projections, and optional providers.
4. Attach the browser host required by the chosen input and visual path.
5. Call `core.start(...)` once, then wait for readiness before product work.
6. Dispose the composition from the app lifecycle that created it.

## Expected result

The app receives one Core facade coordinating its selected owners. Uncomposed
Collaboration and AI systems perform no work. A render-engine provider exists
only when the app selected one. Duplicate registration, invalid composition,
startup failure, and post-start mutation remain explicit errors rather than
silent fallback behavior.

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
- [Core package guide](../reference/packages/core.md)

## Next

- [Learn information models](../learn/information-models.md)
- [Build a custom schema](../build/custom-schema.md)
