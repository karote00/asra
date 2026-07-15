# Package: @asyra/core

## Responsibility

System orchestrator and lifecycle coordinator.

## Owns

- framework startup and dependency wiring
- renderer/persistence integration entrypoints
- load/save hooks
- high-level API surface for apps
- curated facade re-exports for high-value helpers
- top-level registration entrypoints for framework extension
- request API composition across packages

## Must Not Own

- app-specific domain rules
- UI rendering details
- engine-specific graphics primitives
- concrete render-engine selection, capability inspection, or resources

## Extension Points

- register component definitions
- register render layers
- register render interaction targets + handlers
- register render YJS change observers (`name + channel + onChange`)
- register UI/system managed properties
- register load/save hooks
- register load diagnostics hooks (with disposer return for app-level unsubscribe)

## API Tier Contract

- `CoreBasicAPIs` are concrete, always-available core facade methods and must not rely on optional registration checks.
- `CoreExtensionAPIs` are concrete registration/bridge APIs exposed by core for package/preset/app extensions.
- `CoreConcreteAPIs = CoreBasicAPIs + CoreExtensionAPIs`.
- `CorePresetInstallAPIs` is the strict preset-facing subset used by `@asyra/preset` bootstrapping.

## Instance Contract

- The package exports a default `core` instance for the common shared-runtime
  path and exports the `Core` class for consumer-owned composition.
- Consumers may isolate only the package instances they need; an all-package
  runtime container is not required.
- A custom `Core` instance must receive and consistently use the intended
  package instances and instance-bound subscription wiring.
- Default singleton imports intentionally share state and subscriptions.

## Runtime Contracts

1. Startup contract

- app configures an engine-neutral `IRenderer` (normally `RenderAdapter`) before
  calling `start(...)`
- call the configured renderer exactly once with the host container and
  engine-neutral `RenderOptions`
- complete renderer/engine initialization before data-channel observers,
  persistence load, Feature initialization, and ready publication
- reject missing renderer or renderer/engine initialization failure without
  initializing later phases or publishing false ready
- remain unaware of concrete engine instances, capabilities, and resources

2. Registration contract

- registration calls should be idempotent where possible
- registration errors should fail fast with clear messages
- data-channel observer registration resolves shared data by channel name, not raw YJS object instances
- default shared data-channel registration lifecycle is preset-owned (core/factory provide APIs only)

3. Load/save contract

- load: app migration hooks -> package validation/fallback -> apply state
- `registerLoadHook` pipeline runs for both persistence load and `core.load(...)`
- package validators (`props-manager`, `scene-tree`, `system-context`) run before state apply
- diagnostics hooks receive non-blocking validation warnings after apply
- save: collect package states -> compose persisted payload
- save payload may include optional `systemContext` managed-property snapshot
  - includes only managed properties registered with `runtime: false`

4. Transaction status contract

- each Core subscribes to the Factory instance injected into that Core, not to a
  global end-transaction event
- committed action, undo, and redo capture their provider and CoreRawData
  snapshot when the committed status arrives; provider writes then enter one
  serial persistence queue
- the captured snapshot is deeply detached before queueing; later mutations to
  nested runtime arrays/objects and references retained by save hooks cannot
  change queued provider input
- queued work writes the detached snapshot and never re-reads later committed
  state or an active uncommitted preview
- missing provider reports `persistence-skipped`; successful save reports
  `persisted`; provider failure reports `persistence-failed`
- discarded, rolled-back, and rollback-failed outcomes never request save
- persistence failure does not roll back committed runtime state and does not
  block later queued saves; Core provides no automatic retry policy

5. Selection transaction contract

- Core selection APIs record the reversible change and apply canonical
  SelectionManager state before the transaction boundary closes, so Factory
  validators observe the final selection rather than a delayed shared projection
- selection boundaries and replay use the Factory injected into that Core; the
  Factory's instance-local replay handler restores the injected SelectionManager
  for rollback, undo, and redo without requiring preset installation
- registration-driven selection channels install that replay owner and an
  explicit selection inverter for their actual event name before their first
  mutation; custom channels are not limited to preset selection event names
- consumer-owned Factory/Selection pairs do not replay selection into the
  default runtime or another custom runtime
- selection shared channels project canonical state to Render/UI; they do not
  own a second delayed canonical selection value

## App-Level Usage Rules

- App should call framework via `core.xxx` and app-level wrappers.
- App should prefer `@asyra/core` helper re-exports (`defineFeature`, `getFeature`, `keyMap`) for common feature/input authoring paths.
- App should not import package internals when core API exists.
- Preset/app code should consume render abstractions through `core.xxx` when
  Core exposes them. App bootstrap may import public `RenderAdapter` from
  `@asyra/render` because Core accepts, but does not construct, `IRenderer`.
- Child-property edits that must refresh computed/render state should go through core props bridge APIs (`updatePropertyById` + `commitPropertyChanges`) with owner metadata rather than rewriting parent computed arrays in app code.
- Core/scene-tree bridge rule: scene-tree recompute should react to committed props transactions, not be manually duplicated in app handlers.
- Cross-cutting domain logic belongs in app/common APIs, not core.

## Validation Checklist

- Core initialization works without UI framework assumptions.
- Renderer/engine failure does not initialize observers/features or publish
  ready.
- Core source contains no Pixi or concrete engine dependency.
- Preset/default registrations are explicit via `@asyra/preset`, not implicit core side effects.
- Load/save flow executes in documented order.
