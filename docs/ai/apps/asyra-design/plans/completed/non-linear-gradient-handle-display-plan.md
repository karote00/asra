# Plan: Non-Linear Gradient Start Handle Display

## Scope

Adjust the on-canvas start handle display when switching gradient types without mutating stored gradient data.

Behavior targets:

- switching from linear to non-linear shows the start handle at the midpoint between stored start/end
- switching from non-linear to linear shows the stored start handle position again
- handle hit-testing and dragging stays aligned with the displayed handle while preserving stored data

## Completion (2026-03-16)

- outcome: non-linear gradients render the start handle at the midpoint of stored handles without data mutation
- outcome: start-handle drag and hit-testing respect the display mapping while keeping stored coordinates intact

## Steps

1. Handle mapping helpers

- derive display start handle from stored handles for non-linear types
- derive stored handle positions from display updates for non-linear types

2. Geometry integration

- apply display mapping to gradient handle geometry for render and hit-testing
- keep end handle rendering unchanged

3. Interaction validation

- confirm handle drag and stop projection remain consistent after type switching

## Validation

- Not run (not requested)
