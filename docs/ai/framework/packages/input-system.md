# Package: @asyra/input-system

## Responsibility

Normalize raw keyboard/mouse/pointer input into framework input events.

## Owns

- key-combination mapping
- pointer event normalization (client/workspace conversion hooks if configured)
- event dispatch to runtime consumers

## Must Not Own

- feature decision policy
- scene-tree mutation logic
- render-layer business behavior

## Rules

- Input-system publishes normalized events; it does not choose business outcomes.
- Key maps should be configurable by app domain.
- Event contracts must stay stable and typed.
- Pointer input can be temporarily blocked when render interaction capture is active.
- Runtime consumers register listeners with `on(event, callback)` and release
  the same callback with `off(event, callback)`. `off` removes only the requested
  listener, returns `false` when it was not registered, and removes an empty
  event bucket.

## Extension Points

- key-combination registration
- input event mapping per app/runtime mode
- optional app-level adapters for host environment differences

## Facade Note

- `keyMap` is also re-exported by `@asyra/core` for app-level convenience.

## Validation Checklist

- Keyboard shortcuts resolve consistently across supported platforms.
- Pointer down/move/up sequence remains ordered and complete.
- Input event payloads match typed contracts.
- Listener cleanup does not remove other consumers of the same normalized event.
