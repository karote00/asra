# Plan: Pen Bezier Drag Controls

## Scope

Add drag-to-curve behavior for pen point creation and make curve control handles first-class selectable/editable targets.

## Steps

1. pen session behavior
- extend `src/features/pen-tool/index.ts` `pen` session:
  - `onStart`: keep point creation behavior and record new point + connected point context
  - `onUpdate`: when connected point exists, update both connected/new point handles from drag vector
  - first point of a subpath must skip handle creation on drag

2. point target model
- extend selected/hovered vector point state with `target` (`anchor`, `inHandle`, `outHandle`)
- wire hover/select features to use editable point hit-testing (anchors + handles)

3. geometry API boundary
- add/update `elementApis` helpers for:
  - editable point hit-testing
  - anchor point type updates (`sharp`/`smooth`)
  - handle coordinate updates per anchor target (`inHandle`/`outHandle`)
- keep all geometry mutations behind common API helpers

4. render-layer visuals
- update vector path editing overlay in `packages/preset/src/render-layers/vector-path-editing-render-layer.ts`
- draw control lines + handle diamonds
- handle style:
  - same size/fill color as anchor points
  - white 1px stroke
  - selected state uses same blue outline as selected anchor points

5. properties panel
- update `src/properties/vector-point.tsx`:
  - show selected target (`anchor`/`in`/`out` handle)
  - show/edit X/Y for selected target
  - expose anchor point type control (`sharp`/`smooth`) for professional editing flow

6. tests and docs
- extend `e2e/pen-tool.spec.ts` for:
  - drag-to-curve handle creation
  - first-subpath drag no-handle behavior
  - handle selection + property panel target visibility
- sync `features/pen-tool.md`, `bdd-features/pen-tool.feature`, `prd/pen-tool.md`, and API/state docs

## Validation

- pen drag creates Bezier handles only when a connected point exists
- handle targets are hover/select-able in path-editing mode
- property panel reflects selected target data and edits apply to anchor/handle correctly
- app build and pen-tool E2E suite pass
