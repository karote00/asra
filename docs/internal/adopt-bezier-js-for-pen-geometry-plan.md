# Plan: Adopt `bezier-js` for Pen Geometry

## Status (2026-03-01)

- state: in progress
- completed:
  - dependency added (`bezier-js` + `@types/bezier-js`)
  - adapter boundary added (`apps/asyra-design/src/common-apis/element/bezier-adapter.ts`)
  - cubic segment bounds in `vector-geometry` switched to adapter-backed `bezier-js` bbox
  - curve proximity hit-test support added in `elementApis` and wired to pen double-click path-entry check
- pending:
  - expand adapter-backed operations beyond current bounds/proximity needs when required
  - E2E additions for curve-path proximity entry behavior
  - docs sync in feature/prd/state modules once behavior scope is finalized

## Scope

Adopt `bezier-js` as the geometry engine for pen/path-editing math while preserving current app behavior contracts and API boundaries.

## Steps

1. dependency and adapter boundary
- add `bezier-js` dependency at the owning package/app scope
- create a thin geometry adapter module (app-owned) so feature/render code does not depend on library APIs directly

2. migrate bounded geometry operations
- move cubic segment helpers (extrema/bounds/projection/closest-point style operations) to adapter-backed functions
- keep existing app data contracts (`inHandle`/`outHandle`, point target semantics, subpath rules) unchanged

3. preserve runtime boundaries
- keep all geometry mutations routed through `elementApis`
- keep feature handlers (`pen`, point selection/hover) transaction-safe and library-agnostic

4. compatibility behavior checks
- ensure current first-drag special case behavior remains intact (second point in subpath can auto-compute connected-point handle)
- verify virtual segment rendering uses the same cubic path rule as committed segments

5. tests
- update/add focused unit tests for adapter math outputs used by app logic
- update E2E expectations only where behavior intentionally changes

6. docs sync
- update `features/pen-tool.md`, `modules/state-contracts.md`, and `prd/pen-tool.md` when adapter-backed behavior is finalized
- append rationale in `decisions/releases/unreleased.md` if contract-level behavior or dependency policy changes

## Validation

- `yarn workspace @asyra/asyra-design react:build` passes
- targeted pen-tool E2E paths pass for drag-to-curve, segment rendering, and handle selection/property sync
- no direct `bezier-js` usage in feature handlers or render-layer files outside adapter boundary
