# Package: @asyra/system-context

## Responsibility

Own global runtime state for modes and interaction/system flags.

## Owns

- primary tool state
- viewport/system numeric state (for example zoom)
- interaction mode flags (for example path-editing mode id)
- managed property observables for framework/app consumers

## Must Not Own

- entity graph data
- property component data
- UI framework binding logic
- reactive-event subscribe wiring for default event-to-property mappings

## Rules

- System-context values should be deterministic and serializable where needed.
- Registration of managed properties should be explicit.
- App can register custom managed properties through core-exposed API.
- System-context emits state; render/ui consume derived results.

## Extension Points

- register managed property with initial value
- read managed property observable
- set managed property value through API path
- load managed property snapshot with registration/type guards
- validate a managed property snapshot without mutating runtime state, then
  apply the complete owner-issued artifact through a separate owner API;
  fabricated/foreign/reused artifacts fail before mutation and the apply stage
  does not rerun validators
- save managed property snapshot for persistence
- control persistence per property via registration option:
  - `runtime: true` (default) => runtime-only, not persisted
  - `runtime: false` => persisted by core save/load

## Explicit Runtime Reset

`SystemContext.resetRuntime(): void` delegates to its managed-property owner
after quiescence: retire registrations and validation artifacts, then attempt
every observable completion. Cleanup failure blocks successful reconstruction.
Contexts with independent state are unaffected. Normal load/set/unregister
validation semantics are unchanged; Apps use Core lifecycle orchestration.

## Validation Checklist

- Managed property registration is idempotent and stable.
- Same property key has one consistent value source.
- State changes propagate to subscribers predictably.
- Runtime set rejects values that fail the managed-property validator.
- Load ignores unregistered or invalid managed-property values and keeps initialized safe defaults.
- Core can obtain the complete managed-property validation result before any
  package state apply begins; applying that result remains System Context-owned
  and does not repeat validation after other package apply begins. Artifact
  identity and managed-property registration identity are instance-bound.
