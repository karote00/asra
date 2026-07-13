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
- initialize core dependencies in deterministic order
- expose ready-to-use top-level APIs after initialization

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
- core may observe transaction completion for autosave, but a runtime commit is
  not the same as persistence durability
- automatic failure rollback and persistence acknowledgement are deferred; core
  must not claim those guarantees before the transaction atomicity plan lands

## App-Level Usage Rules

- App should call framework via `core.xxx` and app-level wrappers.
- App should prefer `@asyra/core` helper re-exports (`defineFeature`, `getFeature`, `keyMap`) for common feature/input authoring paths.
- App should not import package internals when core API exists.
- Preset/app code should consume render abstractions through `core.xxx` when core exposes them, rather than importing `@asyra/render` directly.
- Child-property edits that must refresh computed/render state should go through core props bridge APIs (`updatePropertyById` + `commitPropertyChanges`) with owner metadata rather than rewriting parent computed arrays in app code.
- Core/scene-tree bridge rule: scene-tree recompute should react to committed props transactions, not be manually duplicated in app handlers.
- Cross-cutting domain logic belongs in app/common APIs, not core.

## Validation Checklist

- Core initialization works without UI framework assumptions.
- Preset/default registrations are explicit via `@asyra/preset`, not implicit core side effects.
- Load/save flow executes in documented order.
