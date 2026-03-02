# Plan: Delete Key Support For Single Selected Vector Point

## Scope

Support keyboard point deletion for path-editing workflow in Asyra Design:
- `Delete` / `Backspace` removes one selected anchor point in path-editing mode
- interior open-subpath deletion splits into two subpaths with regenerated segment ids
- clear point/segment selection channels after deletion
- keep element deletion blocked while path-editing mode is active

## Steps

1. feature split and priority routing
- keep element delete and point delete as separate features
- ensure point-delete branch has higher priority in path-editing mode

2. topology mutation contract
- remove point through `elementApis.removeVectorAnchorPoint(...)`
- rebuild topology and computed `points` / `segments` / `networks` through vector topology APIs

3. selection/state cleanup
- clear `vectorPointSelection` and `vectorSegmentSelection` channels
- clear compatibility point state (`selectedVectorPoint`, `hoveredVectorPoint`)
- keep selected element on the edited vector

4. regression coverage
- add E2E for:
  - interior anchor delete split behavior
  - segment id regeneration on split
  - path-editing mode delete block (element delete no-op)

## Validation

- `yarn workspace @asyra/asyra-design test:e2e e2e/delete-element.spec.ts --workers=1` passes
- `yarn workspace @asyra/asyra-design react:build` passes

## Result

Completed on 2026-03-03.

- point deletion via shortcut is available in path-editing mode
- interior-point delete split behavior is covered by E2E
- mode-based delete guard behavior is covered by E2E
