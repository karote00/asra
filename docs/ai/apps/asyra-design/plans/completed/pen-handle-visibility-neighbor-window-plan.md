# Plan: Pen Handle Visibility Neighbor Window

## Scope

When path-editing with Pen tool, stop rendering every handle in the full vector.
Render handle controls only around the currently selected anchor point:
- `n-1` anchor handles
- `n` anchor handles
- `n+1` anchor handles

This applies to handle lines and handle diamonds in the path-editing overlay.

## Steps

1. render-layer selection window
- in vector path-editing overlay, resolve selected anchor location in subpath order
- build visible anchor id window: previous/current/next within that subpath
- if no selected anchor is active, render no handle controls

2. handle drawing filter
- restrict handle lines rendering to visible anchor id window
- restrict handle point rendering to visible anchor id window
- keep anchor point rendering unchanged for all anchors

3. interaction safety check
- ensure selected handle outline still appears when selected handle belongs to visible window
- ensure segment rendering and preview rendering remain unchanged

4. docs and verification
- update pen feature doc for visibility behavior
- run app build and pen-tool E2E

## Validation

- `yarn workspace @asyra/asyra-design react:build` passes
- `yarn workspace @asyra/asyra-design test:e2e e2e/pen-tool.spec.ts --workers=1` passes

## Result

Completed on 2026-03-02.

- path-editing overlay now renders handle controls only for selected-anchor neighborhood (`n-1`, `n`, `n+1`) in the same subpath
- when no anchor is selected, handle controls are hidden
- anchor rendering, segment rendering, and pen preview rendering remain unchanged
