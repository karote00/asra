# Plan: Vector Point/Control/Segment Hover and Selection Visuals

## Scope

Implement and align visual state behavior for vector-editing targets so users can clearly distinguish:
- hover selection state
- normal selection state

Targeted vector targets:
- anchor points
- curve controls (`inHandle`/`outHandle`)
- segments (line/cubic)

Out of scope:
- marquee/lasso multi-target UX expansion
- non-vector element hover/selection visuals

## Steps

1. Target-state contract and precedence
- define/confirm canonical target identity for point/control/segment hover and selection paths
- define deterministic precedence rules when hover and selection overlap on the same target
- keep ownership boundaries explicit (`feature-system` writes via app/common APIs; render/UI consume derived state)

2. Hover detection and event wiring
- extend path-editing hover hit-test flow to resolve anchor/control/segment targets
- publish hover target updates through app-approved state path (no deep package mutations)
- keep mode/tool guards deterministic (path-editing only where applicable)

3. Selection behavior parity
- ensure click selection can target anchor/control/segment consistently with hover targeting
- keep selection channel writes transaction-safe and undo-friendly
- ensure selection clear/replace behavior remains deterministic when switching tools/modes

4. Overlay rendering for both states
- extend vector editing overlay layer to render both hover and normal selection visuals for point/control/segment targets
- keep styling consistent and distinguishable (stroke/size/alpha) without regressing existing element-level overlays
- preserve compatibility with existing vector topology and bezier geometry rendering

5. Verification and docs sync
- add/update E2E/manual checks for:
  - hover vs selected anchor visibility
  - hover vs selected curve-control visibility
  - hover vs selected segment visibility
  - overlap precedence behavior
- update app docs contracts that change (`features/*`, `modules/state-contracts.md`, and `PLANS.md`)

## Validation

- hover and normal selection are visibly distinct for anchor/control/segment targets
- hover-to-select transition does not flicker or lose target identity
- path-editing interactions remain deterministic and transaction-safe
- `yarn workspace @asyra/asyra-design react:build` passes
- targeted vector-editing checks (E2E/manual) pass

## Result

Completed on 2026-03-06.

- Added distinct hover and selected visuals for vector anchors, curve controls, and segments in path-editing overlay.
- Enforced deterministic point-over-segment hover/selection precedence for vector-editing targets.
- Restricted path-editing hover/selection to current `pathEditingVectorId` vector and blocked non-editing element hover/selection.
- Added compatibility mirror state for `selectedVectorSegment` and explicit runtime hover state for `hoveredVectorSegment`.
- Synced behavior docs and added focused `pen-tool` E2E scenarios for segment interaction and path-editing lock behavior.

Canonical completed-plan path:
- `docs/ai/apps/asyra-design/plans/completed/vector-target-hover-and-selection-plan.md`
