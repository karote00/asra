# Framework Notes

## UI-Agnostic Core Boundary

- The framework core must remain UI-agnostic to support any UI layer (React, Vue, AngularJS, etc.).
- UI hooks (e.g., `useProperty`) live in the app/UI layer, not in `@asyra/ui-context`.
- Core owns initialization and registration APIs (e.g., `registerUIProperty`) but does not expose UI-layer utilities.
