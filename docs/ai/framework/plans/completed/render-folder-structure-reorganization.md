# Plan: Render Folder Structure Reorganization

## Status

- Accepted on March 4, 2026.
- Completed on March 4, 2026.
- Delivered:
  - Consolidated render layer modules under `packages/render/src/layers/{scene,selection,viewport}`.
  - Consolidated render registry modules under `packages/render/src/registries`.
  - Updated render package internals and tests to the new folder layout while keeping `@asyra/render` external exports stable.
  - Verified with render package tests and app TypeScript compile checks.

## Goal

Reorganize `@asyra/render` source folders so runtime, layer modules, and registries are grouped by role, reducing path ambiguity and making future render extension work easier.

## Agreed Direction

1. Keep public exports/API names stable from `@asyra/render`.
2. Consolidate layer implementations under one `layers/*` tree.
3. Group registry implementations under `registries/*`.
4. Apply import path updates with no runtime behavior change.

## Scope

1. Internal file/folder layout of `packages/render/src`.
2. Internal import rewrites and test import rewrites.
3. No feature behavior changes and no cross-package API contract change.

## Implementation Steps

1. Move `render-layer`, `selection-layer`, `viewport-layer` under `layers/scene|selection|viewport`.
2. Move registry modules under `registries/*`.
3. Rewrite internal imports to new paths.
4. Keep package barrel exports unchanged for external callers.
5. Run `@asyra/render` tests and app typecheck.
6. Follow-up cleanup for any remaining naming/path inconsistencies.

## Exit Criteria

1. Layer files live under `packages/render/src/layers/*` only.
2. Registry files live under `packages/render/src/registries/*` only.
3. `@asyra/render` tests pass and app compile checks pass.
4. No external API break from folder reorganization.
