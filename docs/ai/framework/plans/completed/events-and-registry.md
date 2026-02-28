# Completed Plans: Events and Registry

## 1. Preset event-definition registration and reactive-events cleanup

- Completed on February 27, 2026.
- Preset now registers event definitions (name + generated publish/subscribe helpers) through core/reactive-events.
- Removed unused request-response event flows and deprecated interaction-core reactive-event wiring.
- Reference: `docs/internal/framework-audit.md`

## 2. Reactive-events register/base-registry verification

- Completed on February 27, 2026.
- Verified `eventRegistry.register(...)` is implemented in `@asyra/reactive-events` and persists registrations via shared `@asyra/utils` `MapRegistry`.
- Confirmed no separate base `register(...)` helper is consumed from `@asyra/utils` for event registration.
- Reference: `packages/reactive-events/src/event-registry.ts`, `packages/utils/src/registry/map-registry.ts`

## 3. Shared registry register-contract adoption

- Completed on February 27, 2026.
- Added `MapRegistry.register(...)` as the shared registration primitive with strict no-duplicate-key behavior (duplicate registrations throw).
- Migrated map-like package registries to use explicit duplicate error messages while preserving package APIs.
- Reference: `packages/utils/src/registry/map-registry.ts`
