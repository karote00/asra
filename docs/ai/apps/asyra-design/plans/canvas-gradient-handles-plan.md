# Plan: Canvas Gradient Handles Editing

## Scope

Add on-canvas gradient handle visualization and manipulation for active gradient fills.

Behavior targets:

- users can see gradient handles on canvas for the active gradient fill
- users can drag gradient handles on canvas to update gradient geometry
- handle visuals feel intentional and Figma-like
- drag updates stay grouped into one intended undoable action
- overlay registration stays behind the render-layer contract

## Status (2026-03-10)

- completed: linear gradient render path stabilized (local-space mapping + stop ordering), plus unit coverage in preset gradient tests
- in progress: radial gradient render mapping (handle semantics + render transform)
- remaining: support other gradient types on canvas (angular/diamond) after radial is stable

## Steps

1. Gradient editing state

- add app-owned system state for active gradient fill and hovered/selected gradient handle
- make properties-panel gradient editing activate/deactivate that state explicitly

2. Render layer

- register a dedicated gradient-handles render layer
- draw gradient line + handles from current fill gradient data using render-side transforms
- keep engine-specific code inside render abstractions only

3. Interaction feature

- add hover + drag feature flow for gradient handles on canvas
- resolve handle hit-testing from current render geometry
- update fill child-property gradient handles directly by `fillId`
- keep drag-frame writes non-undoable and finalize with one intended undoable commit

4. Docs + validation

- update app behavior docs for the new canvas editing path
- validate build and focused interaction coverage/manual checks

## Validation

- `yarn workspace @asyra/asyra-design react:build`
- focused interaction validation for properties-panel gradient editing + canvas handle drag
