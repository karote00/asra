# Completed Plan: System-Context Event-to-Property Update Ownership

## Completed On

- March 5, 2026.

## Final Decision

1. `@asyra/system-context` is storage/validation only for managed properties.
2. `@asyra/system-context` does not own reactive-event subscriptions.
3. Framework-level `@asyra/reactive-events` does not own system-context-specific event channels.
4. System-context updates should flow through managed-property APIs (`core.setSystemProperty` / `core.getSystemProperty`), with preset/app free to define optional domain events externally.

## Implementation Summary

1. Removed internal reactive-events subscription bootstrap from `@asyra/system-context`.
2. Removed framework system-context event channels from `@asyra/reactive-events` (`updateMouseState`, `updateKeyState`, `updateHoveredElementId`).
3. Removed preset compatibility subscription wiring that depended on those framework event channels.
4. Updated package contracts and API-surface docs to reflect the final ownership boundary.

## Exit Criteria Check

1. One explicit owner for event-to-system property mutation routing:
   - managed-property writers (`core`/app APIs) own routing.
2. `@asyra/system-context` boundary matches storage-only role.
3. Framework event surface no longer assumes specific system-context keys.
4. Extension/override path remains preset/app-driven via explicit event registration and managed-property APIs.
