# Module: E2E Coverage

## Location

- `apps/asyra-design/e2e/*`

## Current Suites

- `app.spec.ts`

  - app load/layout smoke

- `tool-switching.spec.ts`

  - keyboard and toolbar tool switching

- `element-creation.spec.ts`

  - rectangle creation flows

- `oval.spec.ts`

  - oval tool behavior

- `selection.spec.ts`

  - select/deselect via canvas and contents panel
  - drag selected element to move

- `delete-element.spec.ts`

  - Delete/Backspace behavior for selected element and path-editing point delete branch

- `properties.spec.ts`

  - property panel visibility/editing

- `viewport-navigation.spec.ts`

  - zoom behavior

- `undo-redo.spec.ts`

  - history behavior

- `pen-tool.spec.ts`

  - pen tool and path-editing core flow
  - drag-to-bezier handle creation
  - curve-handle selection and point-target property visibility

- `collaboration.spec.ts`
  - uses the dedicated `playwright.collaboration.config.ts` composition
  - opens three real app contexts against the public memory-only WebSocket
    reference server
  - covers same-file create/move canonical convergence before pointer-up,
    return-to-origin convergence, different-file room isolation, disconnect,
    and reconnect; unit/integration suites own the exact
    one-synchronous-action publication/send assertions
  - is excluded from ordinary `playwright.config.ts` discovery so the normal
    E2E suite does not require the optional WebSocket reference server

## Contract Notes

- tests rely on stable `data-testid` selectors
- tests assume layout constants for safe canvas click positions
- tests currently use keyboard shortcuts heavily to drive interaction state
- `ASYRA_DESIGN_APP_URL` is the single base URL for ordinary E2E, visual review,
  collaboration E2E, and the Vite server used by those suites
- the collaboration suite may reuse manually started app and WebSocket servers;
  it does not replace the documented two-window manual test

## When Updating Behavior

If you change:

- tool semantics
- path editing flow
- panel visibility logic
- selector attributes

then update E2E tests in the same work.
