# Plan: Block Canvas Selection for Locked Elements

## Scope

Prevent locked elements from being selected via canvas click or area selection.
Contents panel selection remains unchanged.

## Completion (2026-03-17)

- outcome: locked/hidden elements no longer set hover target state
- outcome: canvas click and area selection ignore locked/hidden elements
- completed plan: `docs/ai/apps/asyra-design/plans/completed/locked-elements-canvas-selection-plan.md`

## Steps

1. Update selection feature
- ignore hovered locked/hidden elements during click selection
- filter locked/hidden elements out of area selection results

2. Sync docs
- update selection feature and PRD behavior to mention locked exclusion

## Validation

- manual: click locked/hidden element on canvas does not change selection
- manual: area selection excludes locked/hidden elements
- manual: unlocked elements still selectable via click/area selection
