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

## Extension Points

- key-combination registration
- input event mapping per app/runtime mode
- optional app-level adapters for host environment differences

## Validation Checklist

- Keyboard shortcuts resolve consistently across supported platforms.
- Pointer down/move/up sequence remains ordered and complete.
- Input event payloads match typed contracts.
