# Package: @asyra/input-system

## Responsibility

Normalize raw keyboard/mouse/pointer input into framework input events.

## Owns

- key-combination mapping
- pointer event normalization (client/workspace conversion hooks if configured)
- event dispatch to runtime consumers
- explicit, instance-owned browser keyboard and pointer listener lifecycle

## Must Not Own

- feature decision policy
- scene-tree mutation logic
- render-layer business behavior
- app context-menu semantics, command eligibility, or menu session state
- unconditional browser context-menu suppression outside a handled app surface

## Rules

- Input-system publishes normalized events; it does not choose business outcomes.
- Key maps should be configurable by app domain.
- Event contracts must stay stable and typed.
- Pointer input can be temporarily blocked when render interaction capture is active.
- App-owned surfaces decide whether a native `contextmenu` event is handled and
  call `preventDefault()` only for that accepted invocation.
- Runtime consumers register listeners with `on(event, callback)` and release
  the same callback with `off(event, callback)`. `off` removes only the requested
  listener, returns `false` when it was not registered, and removes an empty
  event bucket.
- Import and construction must not read `window`/`document` or attach browser
  listeners.
- `attachBrowserHost(host, pointerTarget?)` is the explicit browser activation
  boundary. Keyboard listeners belong to `host`; pointer/wheel listeners belong
  to `pointerTarget`, defaulting to `host`. Repeating the same pair is
  idempotent.
- `switchWatchedElement(element)` derives the element's owning `Window`. A
  target/document switch removes exact prior listeners before attaching the new
  host/target pair.
- `detachBrowserHost()` removes all browser listeners owned by the instance.
  `reset()` preserves the active attachment while clearing transient state;
  `dispose()` detaches and clears transient state.
- Core visual startup retains the typed watched-element event route. DOM-neutral
  import/construction is not a public Headless Core or Core Kernel guarantee.

## Extension Points

- key-combination registration
- input event mapping per app/runtime mode
- optional app-level adapters for host environment differences
- explicit browser host and pointer-target selection

## Facade Note

- `keyMap` is also re-exported by `@asyra/core` for app-level convenience.

## Explicit Runtime Reset

`InputSystem.resetRuntime(): void` is the complete lifecycle handoff after
Feature work is quiescent. It invalidates old browser callbacks, attempts every
owned listener removal, clears timers/transient state and removes input mapping
registrations. Cleanup failure is reported to Core, preventing successful
reconstruction. Other instances are unaffected. Ordinary reset/dispose retain
their attachment semantics; the App must not enumerate private listeners.

## Validation Checklist

- Keyboard shortcuts resolve consistently across supported platforms.
- Pointer down/move/up sequence remains ordered and complete.
- Input event payloads match typed contracts.
- Listener cleanup does not remove other consumers of the same normalized event.
- Node import/construction succeeds with no browser globals.
- Identical attachment is idempotent; same-document and cross-document switches
  remove the exact previous listeners.
- Reset preserves attachment and dispose removes it.
