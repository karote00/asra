# Plan: Pen Hover Preview State Machine

## Scope

Fix pen path-editing hover preview behavior so ghost insert point and connected ghost segment are mutually exclusive, using an app-level state-machine-style mode model.

## Behavior Contract

1. When pen is active and a connected preview segment is currently available, hovering segments must not show ghost insert point.
2. Ghost insert point is only available in split-like hover mode where there is no connected preview segment.
3. Anchor/handle hover still takes precedence over segment hover.
4. Existing non-pen segment hover/selection behavior in path-editing mode remains unchanged.

## State Model

Introduce explicit preview intent modes in pen hover flow:

- `none`
- `connected-segment-preview`
- `segment-insert-preview`

Mode derives from current pen/path-editing state (`primaryTool`, `pathEditingStartNewSubpath`, selected anchor continuity) and controls whether `hoveredVectorSegmentInsertPoint` is allowed.

## Steps

1. add app-level pen preview mode resolver
- derive mode from path-editing state and selected/hovered context
- avoid ad-hoc repeated condition trees

2. integrate hover feature
- use resolver in `hoverVectorPointCursorFeature`
- only write `hoveredVectorSegmentInsertPoint` in `segment-insert-preview`

3. align render behavior
- ensure ghost point visibility gates against connected preview mode

4. tests + docs sync
- add/adjust E2E coverage for pen mode segment hover while connected preview is active
- sync pen feature docs and BDD behavior notes

## Validation

- focused E2E on `e2e/pen-tool.spec.ts` scenarios for segment hover/insert preview behavior
- app build sanity check for touched app package

## Exit Criteria

- no ghost insert point appears while connected pen preview segment is active
- ghost insert point appears in pen mode only when connected preview is unavailable
- existing select-mode segment hover/selection path-editing behavior remains green

## Result

Completed on 2026-03-06.

- Added explicit pen preview intent modes (`none`, `connected-segment-preview`, `segment-insert-preview`) in pen hover flow and used them to gate `hoveredVectorSegmentInsertPoint`.
- Updated vector path-editing render layer to use matching preview mode semantics so ghost insert point only renders in insert-preview mode.
- Updated `e2e/pen-tool.spec.ts` to assert:
  - connected preview mode hides ghost insert point
  - split/new-subpath mode shows ghost insert point
- Synced feature, BDD, and state-contract docs for the new visibility contract.

Exit validation:
- `yarn workspace @asyra/asyra-design test:e2e e2e/pen-tool.spec.ts`
- `yarn workspace @asyra/asyra-design react:build`

Canonical completed-plan path:
- `docs/ai/apps/asyra-design/plans/completed/pen-hover-preview-state-machine-plan.md`
