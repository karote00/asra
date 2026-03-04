# Plan: UI-Context Store Surface Removal

## Status

- Accepted on March 4, 2026.
- Completed on March 4, 2026.

## Goal

Keep `@asyra/ui-context` focused on UI-property registration/derivation only, and move scene/selection-driven aggregation wiring to preset/app subscriptions.

## Delivered

1. Removed ui-context store exports and store files (`uiContextSceneTreeStore`, `uiContextSelectionStore`).
2. Removed core facade re-exports for ui-context stores.
3. Moved default ui-context aggregation wiring to preset data-channel observers.
4. Added preset-owned `elementDataMap` UI property and publish flow.
5. Updated app provider usage to consume ui-context properties only.
6. Synced framework/app docs and decision history.

## Validation

1. `yarn workspace @asyra/preset build:preset`
2. `yarn workspace @asyra/core build:core`
3. `yarn workspace @asyra/ui-context build:ui-context`
4. `yarn workspace @asyra/preset test:local`
5. `yarn workspace @asyra/core test:local`
6. `yarn workspace @asyra/ui-context test:local`
7. `yarn workspace @asyra/asyra-design react:build`
8. `yarn lint:ci` (warnings-only baseline)

## Exit Criteria Check

1. ui-context package no longer exposes scene/selection stores.
2. Default scene/selection aggregation wiring is preset-owned.
3. App UI provider uses ui-context properties instead of direct sceneTree reads.
