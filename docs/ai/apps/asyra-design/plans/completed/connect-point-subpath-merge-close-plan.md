# Plan: Connect Endpoints In Pen Add Mode

## Scope

When pen add mode has a connected preview segment (`pathEditingStartNewSubpath=false`), clicking an endpoint anchor should connect the active continuation endpoint to that clicked endpoint.

Behavior targets:
- clicking endpoint on another subpath merges both subpaths into one open subpath
- clicking opposite endpoint of the same subpath closes that subpath and marks closed topology/network state

## Steps

1. Topology mutation API
- add topology-level endpoint connect operation for:
  - open-subpath merge across two networks
  - close-current-subpath for opposite endpoints in same network
- expose app common API wrapper in `elementApis`

2. Pen feature behavior update
- in pen session start, for connected mode + clicked endpoint anchor:
  - resolve current continuation endpoint (selected endpoint or fallback tail endpoint)
  - connect current endpoint to clicked endpoint via new common API
  - keep deterministic state updates (`selectedVectorPoint`, segment hover state, split/new-subpath flag)

3. Regression coverage
- add E2E for:
  - connecting across subpaths merges to one network
  - clicking opposite endpoint closes network and updates closed references

4. Contract docs
- update pen feature contract and BDD scenarios
- update app API surface contract
- append app decision rationale in unreleased decision log

## Validation

- `yarn workspace @asyra/asyra-design react:build` passes
- `yarn workspace @asyra/asyra-design test:e2e e2e/pen-tool.spec.ts --workers=1` passes

## Result

Completed on 2026-03-06.

- Implemented endpoint-connect topology mutation for pen add mode with deterministic merge/close outcomes in vector `networks`.
- Updated pen feature behavior so endpoint-connect commit enters split/new-subpath mode, preventing automatic connected ghost-segment continuation.
- Preserved source-subpath curve behavior during merge by keeping source orientation stable and swapping target handle roles only when target reversal is required.
- Fixed closed-subpath selected-endpoint handle visibility so `n-1`, `n`, and `n+1` all show via wrapped neighbor-window logic.
- Added regression coverage in:
  - `apps/asyra-design/e2e/pen-tool.spec.ts` (merge/close interaction flow)
  - `packages/preset/src/__tests__/vector-path-editing-render-layer.test.ts` (closed-path handle-window wrapping)
- Synced app contracts and decision history for pen/connect behavior updates.

Final decision:
- Keep endpoint-connect behavior deterministic and bounded to endpoint-only continuation in pen mode while retaining explicit split-mode re-entry after connect commits.

Exit criteria:
- `yarn workspace @asyra/preset test:local` passes.
- `yarn workspace @asyra/asyra-design react:build` passes.
- `yarn workspace @asyra/asyra-design test:e2e e2e/pen-tool.spec.ts --workers=1` passes.

Canonical completed-plan path:
- `docs/ai/apps/asyra-design/plans/completed/connect-point-subpath-merge-close-plan.md`
