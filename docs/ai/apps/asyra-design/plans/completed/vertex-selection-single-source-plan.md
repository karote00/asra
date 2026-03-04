# Plan: Vertex Selection as Single Source of Truth

> Superseded by `docs/ai/apps/asyra-design/plans/completed/selection-manager-multi-channel-plan.md`.
> Keep this file for historical context only.

## Goal

Move vector point selection from app-owned system-context state to framework `SelectionManager` (`SELECTION_TYPES.VERTEX`) so selection ownership is unified:
- element selection -> `SelectionManager`
- vertex selection -> `SelectionManager`

`system-context`, `render`, and `ui-context` should react to selection changes instead of owning separate selected-point state.

## Why This Change

- Current behavior is split:
  - element selection uses `SelectionManager`
  - vector point selection uses `selectedVectorPoint` in system-context
- Split ownership increases drift risk between render/UI/feature behavior.
- `SelectionManager` was originally designed as unified selection ownership.

## Scope

In scope:
- add framework/runtime path for vertex selection events and APIs
- update selection subscribe process to support `SELECTION_TYPES.VERTEX`
- migrate app vector-point selection writes from system-context to selection APIs
- keep behavior parity for path editing, delete key, and property panel

Out of scope:
- multi-vertex editing UX expansion
- redesign of hover state ownership (`hoveredVectorPoint`) unless required for parity

## Target Architecture

1. Selection ownership
- `SelectionManager` is source-of-truth for selected element IDs and selected vertex IDs.

2. App state usage
- `pathEditingVectorId` remains in system-context (mode/session state).
- selected vector point UI state is derived from `vertexSelection` + vector topology lookup (or temporary compatibility mirror during migration).

3. Event flow
- input/feature -> `core.selectVertices(...)`
- reactive-events -> selection subscribes -> `SelectionManager(VERTEX)`
- ui-context/render subscribe and update `vertexSelection`-driven views

## Implementation Slices

1. Reactive events + core API surface
- Add vertex selection publish/subscribe events (at minimum `selectVertices`; optional `deselectVertices` if needed).
- Add core API wrapper similar to `selectElements`.
- Extend core selection API typings.

2. Selection package subscribe process
- Add vertex subscribe initialization alongside existing element subscribe.
- Ensure transaction updates are emitted for vertex selection changes.
- If needed, generalize `BaseSelection.addChange(...)` so action/event/owner are not hardcoded to element selection.

3. App migration (safe two-step)
- Step A (compatibility bridge):
  - features write vertex selection via selection API
  - keep `selectedVectorPoint` mirrored from vertex selection so existing UI/render paths keep working
- Step B (cleanup):
  - make property panel/render layer read derived selected vertex data from `vertexSelection`
  - remove direct selected-point ownership from system-context where no longer needed

4. Data contract for vertex IDs
- Define canonical vertex selection ID encoding for anchor/handle targets, e.g.:
  - `${elementId}:${pointId}:${target}`
- Add parse/format helpers in app/common-apis to avoid ad-hoc string handling.

5. Docs + contract sync
- Update:
  - `docs/ai/framework/packages/selection.md`
  - `docs/ai/apps/asyra-design/modules/state-contracts.md`
  - `docs/ai/apps/asyra-design/API_SURFACES.md`
  - relevant feature docs (`pen-tool`, `delete-element`)

## Validation

1. Functional parity
- select anchor/handle in path editing updates property panel and overlay correctly
- delete selected vertex still works with same mode guards
- escape/tool-switch semantics unchanged

2. Runtime/state
- `vertexSelection` updates in ui-context/render are deterministic
- no stale `selectedVectorPoint` references during transition

3. Regression checks
- targeted E2E:
  - pen point/handle selection
  - delete selected point
  - path-editing enter/exit + selection retention

## Risks

1. Action/event mismatch
- Current selection internals are element-biased; partial migration can silently drop vertex updates.

2. ID encoding drift
- Without centralized format/parse helpers, target decoding bugs can break handle selection.

3. Transitional dual-write complexity
- Bridge period can create conflicting state if not explicitly ordered.

## Exit Criteria

- Features no longer write `selectedVectorPoint` as source-of-truth.
- Vertex selection mutations go through selection API path.
- UI/render selected-vertex behavior is driven by `SelectionManager` state.
- Existing vector editing E2E scenarios pass with no behavior regression.
