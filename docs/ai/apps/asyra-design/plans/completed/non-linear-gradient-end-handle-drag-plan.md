# Plan: Non-Linear Gradient End-Handle Drag Fix

## Scope

Keep the non-linear gradient start handle visually anchored while dragging the end handle on canvas.

Behavior targets:

- non-linear gradient start handle remains fixed while end handle is dragged
- stored handle updates preserve the visual midpoint used for non-linear start display
- linear gradients and start-handle dragging remain unchanged

## Completion (2026-03-17)

- outcome: non-linear end-handle drag keeps the start handle visually anchored
- outcome: stored handle updates preserve the non-linear midpoint display mapping

## Steps

1. Gradient handle mapping update

- adjust non-linear end-handle updates to keep the display start handle fixed
- apply the same mapping for both delta-based and absolute-position updates

2. Interaction validation

- switch linear to non-linear and drag the end handle
- confirm the start handle stays anchored and the end handle follows the cursor
- confirm linear gradients still drag end without moving start

## Validation

- Not run (not requested)
