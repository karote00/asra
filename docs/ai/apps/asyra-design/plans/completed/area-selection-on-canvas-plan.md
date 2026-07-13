# Plan: Area Selection On Canvas

## Scope

Enable marquee-style area selection in select mode when the user drags on empty
canvas space.

Behavior targets:

- drag start on empty canvas in select mode begins area selection state
- drag update shows a selection rectangle and tracks workspace bounds
- drag update reflects selection bounds immediately
- drag end selects all elements intersecting the area bounds
- shift-drag toggles membership for elements inside the dragged area
- click-only on empty canvas (no drag) keeps existing deselect behavior
- path editing mode continues to block standard selection behavior

## Completion (2026-03-17)

- outcome: empty-canvas drag now renders a marquee with 30% opacity fill and
  updates selection in real time
- outcome: drag end commits selection from area bounds; shift-drag toggles
  membership against the starting selection
- completed plan: `docs/ai/apps/asyra-design/plans/completed/area-selection-on-canvas-plan.md`

## Steps

1. System state + render overlay

- register app system property for area selection bounds
- add overlay render layer to draw the selection rectangle during drag
- ensure rectangle uses viewport transform to align with workspace

2. Common API boundary

- add element API to resolve element IDs intersecting a workspace bounds
- keep bounds logic reusable for future selection tooling

3. Selection feature behavior

- detect empty-space drag start in select mode
- apply movement threshold before activating area selection state
- update selection set during drag once threshold is passed
- on drag end, select intersecting elements (replace/toggle based on shift)
- preserve existing click-to-deselect behavior when no drag occurs

4. Contract sync

- update selection feature doc + PRD to include area selection
- extend BDD selection scenarios for marquee selection

## Validation

- manual: drag empty canvas to area-select a rectangle and verify selection updates
- manual: shift-drag empty canvas toggles membership against starting selection
- manual: click empty canvas without drag clears selection as before
- manual: path editing mode blocks area selection start
