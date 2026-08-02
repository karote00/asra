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

- `group-interaction.spec.ts`

  - visible Group/Ungroup controls and standard shortcut route
  - nested Layers projection, collapse, undo/redo, save/load, geometry, and
    Scene Tree/Render identity preservation

- `layer-tree-reparent-reorder.spec.ts`

  - visible Layers pointer reorder and cross-Group reparent
  - collapsed Group reveal, workspace drop, multi-sibling order, cancel,
    undo/redo, save/load, geometry, and identity preservation

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

- `conversational-ai.spec.ts`

  - required-file startup, server-prepared response consumption, attachment,
    vectorization, confirmation, failure, partial-result, history, and
    persistence behavior
  - the 7,112-element balanced correctness case is a change-aware heavy gate,
    excluded unless CI or the caller sets
    `RUN_BALANCED_AI_CORRECTNESS=1`
  - `yarn workspace @asyra/asyra-design
    test:e2e:balanced-ai-correctness` runs that heavy case explicitly with one
    worker

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
- `APP_URL` is the single base URL for ordinary E2E, visual review,
  collaboration E2E, and the Vite server used by those suites
- ordinary and collaboration E2E run the DEV app runtime after the workspace
  build, but use imported test access and the fixed document diagnostic
  service. Human DevTools globals are not an E2E API; production
  bundle/exclusion behavior stays in separate package and build gates
- pull-request and manual CI use two workers, line reporting, no retry, and stop
  after the first product failure; scheduled CI retains one retry and completes
  the suite without the first-failure cap
- CI runs the dense-vector Render timing budget first with one isolated worker,
  then excludes that file while parallelizing the remaining functional suite;
  the formal timing thresholds are not relaxed to absorb runner contention
- pull-request CI resolves the balanced AI heavy gate from the exact
  base-to-head changed paths in
  `scripts/balanced-ai-correctness-scope.mjs`; unrelated changes and scheduled
  runs exclude it, while workflow dispatch exposes an explicit opt-in
- a missing pull-request base or head revision fails scope resolution instead
  of silently skipping the balanced AI heavy gate
- the bounded 12-frame profile uses the lower sample quantile for p50/p95 and
  retains a separate max assertion, preventing p95 from degenerating into the
  same single-sample oracle while preserving every formal threshold
- superseded runs for the same pull request or ref are cancelled, and both E2E
  jobs install only the configured Chromium browser
- the 7,076-element two-actor Agent recording remains the explicit
  `RUN_AI_CRDT_VIDEO=1` resource gate and is not materialized by
  default ordinary or collaboration CI
- the collaboration suite may reuse manually started app and WebSocket servers;
  it does not replace the documented two-window manual test

## When Updating Behavior

If you change:

- tool semantics
- path editing flow
- panel visibility logic
- selector attributes

then update E2E tests in the same work.
