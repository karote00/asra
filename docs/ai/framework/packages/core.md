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
- register UI/system managed properties
- register load/save hooks
- register load diagnostics hooks (with disposer return for app-level unsubscribe)

## Runtime Contracts

1. Startup contract
- initialize core dependencies in deterministic order
- expose ready-to-use top-level APIs after initialization

2. Registration contract
- registration calls should be idempotent where possible
- registration errors should fail fast with clear messages

3. Load/save contract
- load: app migration hooks -> package validation/fallback -> apply state
- `registerLoadHook` pipeline runs for both persistence load and `core.load(...)`
- package validators (`props-manager`, `scene-tree`, `system-context`) run before state apply
- diagnostics hooks receive non-blocking validation warnings after apply
- save: collect package states -> compose persisted payload
- save payload may include optional `systemContext` managed-property snapshot
  - includes only managed properties registered with `runtime: false`

## App-Level Usage Rules

- App should call framework via `core.xxx` and app-level wrappers.
- App should prefer `@asyra/core` helper re-exports (`defineFeature`, `importFeature`, `keyMap`) for common feature/input authoring paths.
- App should not import package internals when core API exists.
- Cross-cutting domain logic belongs in app/common APIs, not core.

## Validation Checklist

- Core initialization works without UI framework assumptions.
- Preset/default registrations are explicit via `@asyra/preset`, not implicit core side effects.
- Load/save flow executes in documented order.
