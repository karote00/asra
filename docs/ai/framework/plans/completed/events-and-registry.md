# Completed Plans: Events and Registry

## 1. Preset event-definition registration and reactive-events cleanup

- Completed on February 27, 2026.
- Preset now registers event definitions (name + generated publish/subscribe helpers) through core/reactive-events.
- Removed unused request-response event flows and deprecated interaction-core reactive-event wiring.
- Reference: `docs/ai/framework/audits/framework-audit.md`

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

## 4. User-action completion event after transaction undo-commit

- Completed on February 28, 2026.
- `DataTransact.commitUndo()` now publishes a deterministic `userActionCompleted` event when one non-empty action unit is finalized.
- App-facing event subscription is exposed through `core.subscribeEvent(...)`.
- Reference: `docs/ai/framework/plans/completed/user-action-completion-event-plan.md`

## 5. Event boundary alignment: reactive-events canonical, preset registration-only

- Completed on February 28, 2026.
- Common framework event names are now sourced from `@asyra/reactive-events` `EventTypes`.
- `preset` is reduced to registration/bootstrap behavior and no longer duplicates framework event-name declarations.
- Removed obsolete commented-out render event placeholders in `@asyra/reactive-events`.
- Reference: `packages/preset/src/events/preset-event-names.ts`, `packages/reactive-events/src/types.ts`
