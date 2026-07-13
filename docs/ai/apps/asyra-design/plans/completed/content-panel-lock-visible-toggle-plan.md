# Plan: Content Panel Lock/Visible Toggles

## Scope

Enable lock and visibility toggles on each element row in the contents panel.
The row icons should reflect current state and allow click-to-toggle updates
with proper undo grouping and UI sync.

## Completion (2026-03-17)

- outcome: content panel row actions toggle lock/visible with transaction-safe updates
- outcome: visibility changes update render state and persist across reload
- completed plan: `docs/ai/apps/asyra-design/plans/completed/content-panel-lock-visible-toggle-plan.md`

## Steps

1. Add common-API helpers
- implement `elementApis.setElementLock(...)` and `elementApis.setElementVisible(...)`
- wrap updates in a single transaction and commit scene-tree changes

2. Add controller helpers
- expose `toggleElementLock(...)` and `toggleElementVisible(...)` for UI usage
- ensure controllers call common APIs (no direct scene-tree mutation in UI)

3. Wire contents panel UI
- make lock/visible icons clickable
- prevent row selection click when toggles are used
- keep data-testid hooks for reliable interaction testing

## Validation

- manual: click lock/visible icons in contents panel and confirm
  - icon state toggles immediately
  - canvas visibility/interaction updates reflect the new state
  - undo/redo restores the previous lock/visible state
