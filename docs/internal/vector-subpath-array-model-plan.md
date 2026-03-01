# Plan: Vector Sub-Path Array Model

## Scope

Introduce explicit sub-path grouping for vector anchors by migrating from:
- `anchorPoints: VectorAnchorPoint[]` with `isMove` markers

to:
- `anchorPoints: VectorAnchorPoint[][]` (each child array is one sub-path)

## Steps

1. contract definition and compatibility
- define app-owned canonical model for editing/runtime as `VectorAnchorPoint[][]`
- define compatibility strategy for existing persisted data (read old flat format, normalize to nested format)

2. boundary-first API migration
- update `elementApis` vector helpers to read/write nested sub-paths
- keep feature handlers and UI callers on `elementApis` only (no direct schema branching in features)

3. geometry/render migration
- update vector geometry helpers (bounds/normalization) for nested sub-path iteration
- update vector render strategy and path-editing overlay traversal from flat loop + `isMove` checks to per-subpath loops

4. pen feature migration
- update add-point, connected-point detection, and escape split logic to use subpath index/path index instead of latest `isMove` scan
- preserve existing drag-to-curve behavior and first-point/no-connected-point behavior

5. schema/persistence migration
- update property schema/component parsing for nested anchor-point arrays
- keep load behavior safe for legacy documents and mixed data during transition

6. test migration
- update unit tests for vector component/render-layer/property schema
- update pen E2E paths covering subpath start/split/continue behavior

7. docs sync
- update `features/pen-tool.md`, `prd/pen-tool.md`, `API_SURFACES.md`, and `modules/state-contracts.md` when implementation is complete
- append rationale to `decisions/releases/unreleased.md` after contract change lands

## Validation

- `yarn workspace @asyra/asyra-design react:build` passes
- vector rendering/path-editing behavior remains correct for single and multi-subpath vectors
- escape split/new-subpath behavior passes updated E2E scenarios
- legacy saved data with flat `anchorPoints` still loads safely
