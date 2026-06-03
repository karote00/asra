# Unreleased App Decision History (Asyra Design)

Decision log for app-scoped changes not yet captured in a release snapshot.

Append-only rule: only append new entries at the end; do not edit/delete or insert in the middle. Add superseding entries when decisions change.

## 2026-02-28 - Initialize app decision-history stream

- Context:
  - Decision history process is being standardized across framework and apps.
- Decision:
  - Create app-scoped decision-history files for Asyra Design.
  - Future app contract/runtime/boundary decisions are recorded here.
- Consequences:
  - App rationale can be tracked independently from framework rationale.
  - Cross-cutting decisions can reference both app and framework streams.
- Related Commit(s):
  - `4d0e3a3` (`docs(decisions): establish global decision-history standard`)

## 2026-03-01 - Pen path-editing target model expanded to anchor + handle selection

- Context:
  - Drag-to-bezier path editing needs selectable/editable curve handles, not only anchor points.
  - Property panel contracts needed a stable target model to support anchor/handle coordinate editing.
- Decision:
  - Extend vector point state (`selectedVectorPoint` / `hoveredVectorPoint`) with explicit target semantics: `anchor`, `inHandle`, `outHandle`.
  - Add editable-point hit-testing and handle update APIs in app common-apis.
  - Treat drag-on-connected-point in pen session as bezier handle creation for both connected/new points.
  - Keep connected-point out-handle stable for normal add+drag; only auto-update it while dragging the second point of a subpath when the connected first point has no user handle, using mirrored relation from current left handle (`p1 = p0 - (p2 - p3)`).
- Consequences:
  - Curve controls become first-class selectable targets with property-panel data flow.
  - Pen tool behavior moves closer to professional vector tooling expectations while preserving existing subpath semantics.
- Related Commit(s):
  - `2eafe38` (`feat(asyra-design): stabilize pen bezier flow and sync planning docs`)

## 2026-03-01 - Pen second-point drag switched to figma-style `P1/P2` coefficients

- Context:
  - The initial second-point auto-update formula for connected `P1` produced unstable bezier results during drag.
  - Pen drag must keep default behavior stable (no connected-handle auto update for normal appends) while fixing the first-segment case.
- Decision:
  - Keep the existing gate: only auto-update connected `P1` when dragging the second point of a subpath and the first point has no user-defined handle.
  - Replace the old mirrored `p1 = p0 - (p2 - p3)` calculation with figma-style coefficients:
    - `p2 = B - 0.8 * (M - B)` for new point `inHandle`
    - `p1.x = A.x - 0.334 * (M.x - B.x)`
    - `p1.y = A.y + 0.327 * (B.y - A.y)`
    - new point `outHandle = M`
- Consequences:
  - During first-segment drag, `P1` and `P2` now update per drag frame using stable coefficients.
  - Normal add+drag remains unchanged: connected `P1` is preserved.
- Related Commit(s):
  - `2eafe38` (`feat(asyra-design): stabilize pen bezier flow and sync planning docs`)

## 2026-03-01 - Vector segment rendering now chooses bezier by handle presence

- Context:
  - Path-editing overlay still drew straight anchor-to-anchor segments even when bezier handles existed, producing incorrect visual guidance.
  - Vector render logic depended on point `type` for bezier rendering, which could miss valid curved segments when handles existed.
- Decision:
  - Use handle-presence rule for segment drawing in vector rendering and path-editing overlay:
    - if `prev.outHandle` or `current.inHandle` exists, draw cubic bezier segment
    - otherwise draw straight segment
  - When one handle is missing, use the corresponding anchor position as fallback control point for cubic draw.
- Consequences:
  - Editing and final rendering now match bezier intent without duplicate/contradictory straight segments.
  - Curve display no longer depends on `point.type` classification.
- Related Commit(s):
  - `2eafe38` (`feat(asyra-design): stabilize pen bezier flow and sync planning docs`)

## 2026-03-01 - Pen virtual preview segment aligned with real segment rendering

- Context:
  - While committed segments used handle-based bezier rendering, the pen virtual preview still rendered as straight line only.
  - This mismatch made curve continuation hard to judge before point commit.
- Decision:
  - Apply the same rendering rule to virtual preview segment:
    - if preview start point has `outHandle`, render cubic bezier preview
    - otherwise render straight preview
- Consequences:
  - Pen hover preview now matches final committed segment behavior for curve vs line.
  - Visual editing feedback is consistent between preview and committed path.
- Related Commit(s):
  - `2eafe38` (`feat(asyra-design): stabilize pen bezier flow and sync planning docs`)

## 2026-03-01 - Drag-end selection stays on new anchor (no auto handle selection)

- Context:
  - Auto-selecting the new point out-handle at drag end changed established pen behavior and added unwanted selection jumps.
- Decision:
  - Remove drag-end auto-switch to out-handle.
  - Keep selection on the newly added anchor point after drag completes.
- Consequences:
  - Pen interaction matches previous selection behavior while preserving bezier handle creation.
  - Handle selection remains explicit via normal hover/click selection flow.
- Related Commit(s):
  - `2eafe38` (`feat(asyra-design): stabilize pen bezier flow and sync planning docs`)

## 2026-03-01 - Vector bounds updated to use bezier segment extrema

- Context:
  - Vector bounds were derived from anchor points only, causing incorrect `x/y/width/height` for curved paths.
- Decision:
  - Update vector bounds calculation to evaluate rendered segment geometry:
    - straight segments use endpoint extents
    - cubic bezier segments use derivative roots (extrema) plus endpoints
  - Keep existing subpath split semantics (`isMove` starts a new segment chain).
- Consequences:
  - Curved vectors now produce bounds that follow actual bezier shape extents.
  - Hit/bounds-dependent behaviors align better with rendered curve geometry.
- Related Commit(s):
  - `2eafe38` (`feat(asyra-design): stabilize pen bezier flow and sync planning docs`)

## 2026-03-01 - Compact property-key naming and reuse-first type policy

- Context:
  - Repeated introduction of overlapping local shapes and verbose persisted property keys increases payload size and contract drift risk.
- Decision:
  - Treat compact naming for persisted/high-frequency model keys as default policy.
  - Require reuse-check against existing shared contracts before adding new types/keys.
  - Use longer names only when readability/interoperability requirements justify the cost.
- Consequences:
  - Smaller model payloads and reduced duplication across framework/app contracts.
  - Better consistency in schema evolution and review expectations.
- Related Commit(s):
  - `acc6cc4` (`docs(standards): add compact key naming and reuse-first policy`)

## 2026-03-01 - `bezier-js` geometry adoption finalized

- Context:
  - Curve editing/runtime geometry needed deterministic cubic bounds and proximity behavior backed by a stable geometry library.
- Decision:
  - Integrate `bezier-js` through a geometry adapter boundary.
  - Migrate cubic bounds and curve proximity hit-testing to the adapter-backed geometry path.
  - Keep future geometry expansion work as separate follow-up scope (sub-path model, geometry domain model).
- Consequences:
  - Curve geometry and hit-testing behavior are more consistent and maintainable.
  - Future geometry model expansion remains decoupled from the current runtime path.
- Related Commit(s):
  - `13ee980` (`feat(asyra-design): integrate bezier-js geometry adapter and path proximity checks`)

## 2026-03-01 - Pen editing UX scope finalized

- Context:
  - The pen editing UX scope (bezier drag handles, handle selection targets, render consistency, and related panel/doc/test sync) is implemented.
- Decision:
  - Finalize bezier drag-handle interactions, handle target selection, and render consistency contracts.
  - Keep docs/tests aligned with finalized pen editing interaction behavior.
- Consequences:
  - Pen editing behavior is stable across interaction, render, and panel flows.
  - Regression risk for pen-handle interaction changes is reduced through synchronized docs/tests.
- Related Commit(s):
  - `2eafe38` (`feat(asyra-design): stabilize pen bezier flow and sync planning docs`)

## 2026-03-02 - Vector geometry runtime moved to topology-native model

- Context:
  - Vector editing flow and rendering still depended on runtime conversion between multiple `anchorPoints` shapes.
  - Direct point/segment/network mutation was required for simpler and more deterministic pen/path editing updates.
- Decision:
  - Make `points` / `segments` / `networks` the canonical vector runtime model for Asyra Design.
  - Remove runtime conversion helpers based on `anchorPoints` and subpath marker scanning.
  - Route point add/remove/move/type/handle/close operations through topology-native `elementApis` mutation methods.
  - Keep vector render strategy and vector path-editing overlay driven by topology data directly.
- Consequences:
  - Pen/path editing updates geometry state in one model without conversion churn.
  - Vector bounds/hit/render logic now traverse topology segments/controls directly.
- Related Commit(s):
  - `206285e` (`refactor(vector): switch pen/runtime to topology-native geometry model`)

## 2026-03-02 - Pen curve drag now uses feature-scoped move threshold

- Context:
  - Second-point add+drag could create handles from micro pointer jitter, causing the first segment to become curved even when user intent was a click.
  - App behavior needed per-feature threshold control instead of shared global/default threshold coupling.
- Decision:
  - Add app-owned feature thresholds via `FEATURE_MOVEMENT_THRESHOLD`.
  - Gate pen handle creation/update on `FEATURE_MOVEMENT_THRESHOLD.penCurveDrag` for both drag update and drag end.
  - Keep threshold configuration in app feature flow; do not move it into core/global runtime defaults.
  - Add E2E regression coverage for second-point micro drag staying straight.
- Consequences:
  - Tiny cursor jitter no longer promotes the first segment into a curve.
  - Threshold tuning can differ by feature without changing shared runtime behavior.
- Related Commit(s):
  - `2a8a8e8` (`refactor(vector): formalize topology props and feature-scoped drag thresholds`)

## 2026-03-02 - Pen handle controls render only around selected anchor neighborhood

- Context:
  - Path-editing overlay rendered all handle controls for the entire vector, which added visual noise while editing dense paths.
  - Requested UX is focused local editing visibility around the active anchor.
- Decision:
  - Render handle lines and handle points only for selected-anchor neighborhood in the same subpath (`n-1`, `n`, `n+1`).
  - Keep full anchor rendering and segment/preview rendering behavior unchanged.
- Consequences:
  - Handle editing focus is localized around current selection.
  - Overlay clarity improves without changing curve geometry semantics.
- Related Commit(s):
  - `5933af4` (`feat(pen): show curve handles only around selected anchor neighborhood`)

## 2026-03-02 - Pen split-mode can resume continuation from clicked endpoint anchor

- Context:
  - In split/new-subpath pen mode, clicking an existing anchor immediately created a new point, which prevented explicit continuation control from an existing subpath endpoint.
- Decision:
  - In split/new-subpath mode, clicking an existing anchor selects that anchor without creating a new point on that click.
  - If the clicked anchor is a valid endpoint (`start`/`end`) of an open subpath, resume pen continuation from that endpoint for preview and next append.
- Consequences:
  - Pen subpath continuation is now explicit and endpoint-driven in split mode.
  - Users can resume and append from the intended subpath instead of defaulting to latest-tail behavior.

## 2026-03-02 - Delete-key element removal finalized with undo-safe selection and hover re-evaluation

- Context:
  - Single-element delete by shortcut needed production-safe behavior across undo/redo, path-editing boundaries, and hover/selection state.
  - Recent regressions included redo errors, non-restored selection on undo, and noisy undo commits during drag-create flows.
- Decision:
  - Finalize `Delete` / `Backspace` feature for one selected element with path-editing guard.
  - Keep delete and selection clear in one undoable transaction so undo restores selection with the element.
  - Re-evaluate hovered target after delete by calling hover feature API via `getFeature(FeatureNames.HOVER_ELEMENT)`.
  - Expand E2E coverage for delete flow regressions and undo-commit quality (including compact drag-create commit assertions).
- Consequences:
  - Delete flow behavior is deterministic for undo/redo and mode boundaries.
  - Hover/selection state is no longer stale after delete.
  - Regression coverage now guards the previously reported delete/undo issues.
- Related Commit(s):
  - `5e3296d` (`feat(asyra-design): finalize delete flow and scene-tree remove contracts`)

## 2026-03-02 - Delete key supports anchor-point removal in path-editing mode

- Context:
  - Path-editing mode previously blocked delete entirely, so selected vector anchors could not be removed by shortcut.
  - Topology-native vector data requires deterministic split behavior for interior-point deletion.
- Decision:
  - Extend delete shortcut behavior to remove selected anchor point when:
    - `pathEditingVectorId` is active
    - selected vector point exists on that vector
    - selected target is `anchor`
  - For interior anchor deletion on open subpaths, split into two open subpaths and regenerate affected segment ids.
  - Keep element deletion blocked while path-editing is active and no valid selected anchor is present.
- Consequences:
  - Delete/Backspace now supports point-level editing without leaving path-editing mode.
  - Segment identity for affected split path portions is intentionally regenerated to avoid stale topology references.
  - Existing element-delete shortcut behavior remains unchanged outside path-editing mode.

## 2026-03-03 - SelectionManager channel ownership expanded to vector points and segments

- Context:
  - Element selection already used SelectionManager, but vector point selection still depended on app-owned `selectedVectorPoint` state in system-context.
  - Multi-channel selection architecture required point and segment channels to be first-class and subscribe-driven across app/runtime layers.
- Decision:
  - Move point-selection read/write flow in features and property panel to SelectionManager channels via `selectionApis` (`VECTOR_POINT`, `VECTOR_SEGMENT`).
  - Add canonical encoded ID contracts for vector point/segment selection in app common-apis.
  - Add segment hit-selection foundation in path-editing point-selection flow (`getVectorSegmentAtClientPos` + `selectVectorSegment`).
  - Keep `selectedVectorPoint` as compatibility mirror derived from `vectorPointSelection` via app init subscription bridge.
- Consequences:
  - Selection ownership is now channel-first for element/point/segment while preserving existing UI/render compatibility paths.
  - Path-editing delete logic consumes selected point from selection channel instead of app-owned state.
  - Segment selection channel is wired for follow-up multi-selection UX without changing global channel concurrency behavior.

## 2026-03-03 - Delete shortcut guard is mode-driven and regression-covered

## 2026-04-17 - Professional stroke engine Phase 1 promoted and legacy center-solid runtime removed

- Context:
  - The new stroke engine architecture, execution plan, and legacy-removal plan
    were approved for implementation.
  - The first promoted slice had to be product-facing, use no legacy stroke
    runtime, and keep render / hit-test / export on one canonical final
    geometry family.
- Decision:
  - Promote Phase 1 `solid + center + uniform width + solid paint` for
    `rect`, `oval`, and `vector`.
  - Make `frame` stroke-free instead of treating it as part of the Phase 1
    slice.
  - Remove legacy product-facing stroke runtime modules
    `packages/preset/src/components/strokes.ts` and
    `packages/preset/src/components/geometry-model.ts`.
  - Extract retained stroke foundation into
    `packages/preset/src/components/stroke-render/`.
  - Add authored `capType` as a real runtime-configurable field so Phase 1
    supported caps (`butt`, `square`) are product-addressable rather than
    helper-only.
- Consequences:
  - The app now renders the first supported stroke slice through a fresh engine
    with no legacy fallback.
  - Hover / selection hit areas for primitive shapes are composed from fill and
    stroke instead of being overwritten by stroke-only hit logic.
  - Phase 2 can start from a clean constrained-solid baseline instead of a
    mixed legacy/new runtime path.

## 2026-04-17 - Professional stroke engine Phase 2 promoted for constrained solid geometry

- Context:
  - Phase 1 had already promoted `solid + center + uniform width + solid paint`
    on the fresh stroke engine with no legacy fallback.
  - The next approved execution target was constrained solid geometry:
    `solid + inside/outside + uniform width + solid paint`.
- Decision:
  - Promote Phase 2 constrained solid geometry for:
    - `rect`
    - `oval`
    - closed non-self-intersecting `vector` paths
  - Keep open constrained paths and self-intersecting constrained paths
    rejected deterministically instead of routing them through temporary
    clipping fallbacks.
  - Keep `round` joins / caps, dashed, gradient stroke paint, and variable
    width blocked at this phase boundary.
- Consequences:
  - Inside / outside stroke render, hit-test, and export now all consume the
    same canonical constrained final geometry packets.
  - Rectangle legality preservation is now covered by exact polygon contracts,
    not only bounds assertions.
  - Screenshot-level constrained-solid visual benchmarks now define done for
    supported `rect`, `oval`, and closed `vector` slices, and explicitly gate
    unsupported `round` join / cap behavior.
  - Phase 2 closeout now requires all three gates to stay green together:
    `apps/asyra-design/e2e/solid-constrained-stroke-visual.spec.ts`,
    `yarn workspace @asyra/preset test:local`, and `yarn react:build`.
  - Phase 3 can start from a clean dashed-center baseline without reopening
    constrained-solid fallback logic.

## 2026-04-02 - Inside dashed stroke Phase 2 switched to mature stroker candidate geometry

- Context:
  - Inside dashed stroke had already been reduced to Phase 1 interval allocation only.
  - The approved architecture direction required `dash subpath extraction -> stroke-to-outline` and explicitly rejected returning to polygon stitching / local-first repair paths.
- Decision:
  - Complete Phase 2 on the product path by generating dashed candidate polygons from authored dash subpaths and one open-subpath stroker.
  - Keep Phase 2 focused on candidate generation only:
    - allow overlap
    - allow out-of-range geometry
    - defer ownership / clipping / conflict analysis to later phases
  - Support generic candidate cap modes on the mature stroker path:
    - `none`
    - `square`
    - `round`
  - Keep the product/runtime integration surface minimal:
    - `createDashedGeometryModel(...).model.polygons`
    - `createDashedGeometryModel(...).dashIntervalAllocation`
- Consequences:
  - Dashed render and dashed hit-testing now both consume the same Phase 2 candidate outline polygons.
  - Open-dash round caps now render as half-circles on the mature candidate path.
  - No legacy dashed debug/hit compatibility surfaces are reintroduced.

## 2026-03-21 - Dashed stroke recovery finalized on GeometryModel -> MeshProjection path

- Context:
  - Earlier dashed-stroke recovery work chose the correct geometry-first
    direction but still allowed renderer-path drift and workaround-style
    geometry repair.
  - The reported self-intersecting `inside` dashed sample exposed that single
    outline polygons could collapse visually after projection/triangulation.
- Decision:
  - Treat `GeometryModel` as the canonical dashed-stroke geometry output and
    `MeshProjection` as the Pixi-specific projection layer.
  - Keep dash allocation on authored path distance and generate local subpath
    geometry from authored bezier segments.
  - Replace single dash outline contours with simple non-self-intersecting
    patch polygons (segment quads, join patches, round-cap patches) before mesh
    projection.
  - Route dashed vector rendering and dashed hit-testing through the same
    geometry-derived path instead of mixing correctness between `Graphics`
    stroke commands and post-hoc repair.
- Consequences:
  - Dashed vector geometry is now future-compatible with gradient stroke fill
    and other stroke-derived mesh features.
  - The reported sample is guarded by executable algorithm and projection
    rasterization checks rather than local reasoning alone.
  - Non-dashed stroke modes remain on their previous rendering path until the
    future stroke/gradient expansion plan widens the geometry model scope.

- Context:
  - Delete behavior had risk of coupling to `pathEditingVectorId` presence instead of explicit path-editing mode state.
  - This can produce incorrect blocking/allowing behavior when mode/id state is temporarily out of sync.
- Decision:
  - Treat `pathEditingMode` as the authoritative guard for element delete branching.
  - Keep vector-point delete as a separate higher-priority feature branch for path-editing mode.
  - Add E2E coverage for mode/id mismatch cases:
    - mode `true` + no vector id => delete blocked
    - mode `false` + vector id present => delete allowed
- Consequences:
  - Delete routing follows explicit mode semantics, not implicit id presence checks.
  - Regression coverage now protects this guard boundary from future drift.

## 2026-03-04 - Contents provider reads element rows from ui-context `elementDataMap`

- Context:
  - Contents row rendering previously relied on a ui-context store path that was removed as part of boundary cleanup.
  - App boundary policy requires UI providers to consume `core`/`ui-context` surfaces instead of framework runtime internals.
- Decision:
  - Update `useElementData` provider to read from `ui-context` property `elementDataMap` keyed by element id.
  - Keep `flattenedElementIds` as the list index source and pair it with `elementDataMap` for row lookups.
- Consequences:
  - App provider no longer depends on scene-tree runtime reads for list rows.
  - UI data flow stays consistent with ui-context subscription model.

## 2026-03-06 - Hover/selection overlay unified and geometry-driven across canvas + contents panel

- Context:
  - Hover state was visible in contents panel but not consistently reflected in canvas overlay when hover originated from panel rows.
  - Selection/hover visuals were split between render package built-ins and app-level behavior needs.
  - Delete undo/redo path surfaced a selection-restore regression during overlay migration.
- Decision:
  - Finalize hover/selection overlay as registered app/preset render layer ownership, including both selected and hovered outlines.
  - Make hover outlines geometry-driven for vector/oval/rect, with bounds fallback for unsupported types.
  - Mirror and consume `hoveredElementId` through ui-context/providers and content-panel hover handlers.
  - Restore selection runtime deterministically on undo/redo by applying selection events back into selection channels.
- Consequences:
  - Canvas and contents panel now share one hover source-of-truth (`hoveredElementId`) and visual result.
  - Overlay behavior is app-controlled and no longer tied to render package built-in selection layer behavior.
  - Delete undo/redo selection restoration is stable again under the new overlay architecture.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/hover-state-and-hover-selection-box-plan.md`

## 2026-03-06 - Path-editing vector target hover/selection parity finalized

- Context:
  - Path-editing target feedback needed explicit distinction between hover and selected states for anchors, curve controls, and segments.
  - Segment interactions needed first-class hover/selection parity with existing point-target behavior.
  - During path editing, users requested strict focus on the editing vector only.
- Decision:
  - Finalize path-editing overlay visuals for vector targets with distinct hover and selected states for anchors, handles, and segments.
  - Use deterministic precedence: point target hover/selection overrides segment target when both are near pointer.
  - Restrict hover/selection during path editing to `pathEditingVectorId`; non-editing elements are ignored for hover/selection updates.
  - Add compatibility mirror and runtime states for segment flow (`selectedVectorSegment`, `hoveredVectorSegment`) and sync them through existing selection compatibility wiring.
  - Align vector target outline color with the normal element selection outline color.
- Consequences:
  - Vector editing feedback is consistent and deterministic across point/control/segment targets.
  - Path-editing interactions stay focused on the active vector and avoid accidental cross-element hover/selection changes.
  - E2E coverage now guards segment hover/selection behavior and path-editing lock semantics.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/vector-target-hover-and-selection-plan.md`

## 2026-03-06 - Vector editing E2E coverage plan closed with split/refresh regression guards

- Context:
  - Recent vector path-editing fixes included segment split insertion behavior, handle-follow-on-anchor-move, and refresh-time render consistency.
  - These regressions needed durable coverage in one focused suite tied to the active vector-editing workflow.
- Decision:
  - Close the active E2E coverage plan after expanding `e2e/pen-tool.spec.ts` with:
    - pen/path-editing-only segment ghost insert visibility and click split behavior
    - inserted-point topology assertions (shared split anchor between two segments)
    - anchor-move handle translation assertions
    - refresh regression assertion to keep one render object per vector element id
  - Treat focused `pen-tool` E2E as a required regression gate for vector path-editing changes.
- Consequences:
  - Vector-editing behavior changes now have targeted regression protection for both interaction and reload consistency paths.
  - Plan tracking for this E2E expansion is now moved to completed records with canonical reference.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/e2e-coverage-update-plan.md`

## 2026-03-06 - E2E closeout expanded with hover baseline and select-mode segment targeting

- Context:
  - The earlier same-day E2E closeout emphasized pen split/refresh regressions but did not explicitly capture baseline element-hover assertions.
  - Path-editing segment-target behavior in non-pen mode also needed an explicit regression assertion in addition to pen-mode split flow checks.
- Decision:
  - Extend completed E2E coverage with:
    - `e2e/selection.spec.ts`: direct `hoveredElementId` set/clear checks from canvas hover movement.
    - `e2e/pen-tool.spec.ts`: select-mode segment hover and segment selection checks while path editing is active.
  - Keep this as an append-only superseding closeout note for the same completed plan scope.
- Consequences:
  - Hover-element contract now has direct E2E coverage instead of indirect regression assertions only.
  - Vector segment targeting behavior is protected in both pen and non-pen interaction modes.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/e2e-coverage-update-plan.md`

## 2026-03-06 - Pen hover preview mode model enforces ghost-point/preview mutual exclusivity

- Context:
  - In pen path-editing flow, segment hover could show ghost insert point even while connected append preview segment was active.
  - This created conflicting visual cues for append-vs-split intent.
- Decision:
  - Introduce explicit pen preview intent modes in hover/render flow:
    - `none`
    - `connected-segment-preview`
    - `segment-insert-preview`
  - Allow `hoveredVectorSegmentInsertPoint` only in `segment-insert-preview`.
  - Suppress ghost insert point in `connected-segment-preview`.
- Consequences:
  - Pen hover feedback now deterministically shows one preview intent at a time.
  - Connected append preview and segment split ghost point no longer appear together.
  - Split/new-subpath mode remains the only path where ghost insert point is shown in pen mode.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/pen-hover-preview-state-machine-plan.md`

## 2026-03-06 - Pen split/add boundaries tightened before network editing support

- Context:
  - Pen add flow still allowed ambiguous interior-anchor interaction while network continuation from non-endpoints is not supported yet.
  - After segment split, pen immediately re-entered connected append preview, which blurred split-vs-add intent.
- Decision:
  - In pen mode, allow point hover only for endpoint anchors while connected preview is active.
  - In connected add-preview mode, suppress segment hover and segment insert-preview state.
  - Suppress pen point hover in split-preview mode.
  - Keep split-preview mode active after segment split (`pathEditingStartNewSubpath = true`) until explicit endpoint resume.
  - Ignore pen add-click on non-endpoint anchors in connected add mode.
- Consequences:
  - Pen add mode no longer suggests/accepts non-endpoint continuation paths before network feature support.
  - Segment split now remains a dedicated split action and does not auto-transition into connected append preview.
  - Hover/preview intent is clearer and aligned with current topology capabilities.

## 2026-03-06 - Pen endpoint-click now supports subpath merge and close

- Context:
  - In connected pen add mode, endpoint hover already exposed a continuation ghost segment, but clicking endpoints only selected points and never committed endpoint-to-endpoint connection intent.
  - Users need deterministic endpoint connect behavior for both cross-subpath linking and same-subpath closure.
- Decision:
  - Add topology/common-API endpoint connection flow that:
    - merges two open subpaths when clicking an endpoint on another subpath
    - closes the current open subpath when clicking its opposite endpoint
    - preserves source-subpath orientation during merge; only target reversal is allowed when needed, with in/out handle-role swap to preserve curve geometry
  - Wire pen `onStart` endpoint-click handling in connected mode to call the shared endpoint-connect API instead of creating a new point.
  - Keep split/new-subpath semantics explicit after endpoint-connect commit (merge or close) by setting `pathEditingStartNewSubpath = true`.
- Consequences:
  - Endpoint click in connected pen mode is now a first-class topology mutation rather than a selection-only action.
  - Network data now reflects merge/close intent directly through `networks[*].closed` and rebuilt segment linkage.
  - E2E now guards both merge and close endpoint-click behaviors.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/completed/connect-point-subpath-merge-close-plan.md`

## 2026-03-06 - Closed-subpath handle visibility wraps neighbor window

- Context:
  - After closing a subpath, selecting an endpoint anchor should expose handle controls for `n-1`, `n`, `n+1`.
  - Existing handle-window logic only used linear neighbor indexes and did not wrap at closed-subpath boundaries.
- Decision:
  - Update vector path-editing handle-visibility window to wrap neighbor indices when `subpath.closed=true`.
  - Keep open-subpath behavior unchanged (no wrap).
  - Add a focused preset unit test for closed-path wrap behavior.
- Consequences:
  - Closed-path endpoint selection now shows both adjacent neighbors' handles as expected.
  - Handle visibility behavior is regression-guarded at unit level.

## 2026-03-06 - Connect-point plan closed out and archived to completed records

- Context:
  - Endpoint connect/merge/close behavior and closed-path handle-window regressions are implemented and validated.
  - The corresponding plan record still needed closeout from active planning into completed archive.
- Decision:
  - Mark the connect-point plan as DONE and move it under completed app plans.
  - Keep interim same-day implementation decision entries append-only; closeout adds canonical completed-plan linkage.
- Consequences:
  - `PLANS.md` no longer has a stale active reference for connect-point work.
  - Completed-plan archive now contains final completion metadata, decision, and exit criteria for this scope.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/connect-point-subpath-merge-close-plan.md`

## 2026-03-06 - Select-mode drag now repositions selected element(s) with undo-safe commit

- Context:
  - Canvas interactions lacked direct drag-to-move for selected elements in select mode.
  - Drag-move behavior needed explicit feature ownership separate from selection start/toggle flow.
- Decision:
  - Add app feature `move-elements` on `input.drag` (priority `8`, exclusive) to own selected-element drag sessions.
  - Start move only when drag begins on an already selected element, primary tool is `select`, Shift is not held, and path-editing mode is inactive.
  - Add common-API element position helpers (`getElementPosition`, `setElementPositions`) and route move writes through that boundary.
  - Apply drag-frame updates as `undoable: false`, then finalize drag end as one intended undoable position commit.
- Consequences:
  - Select-mode drag now updates selected element position directly on canvas.
  - Selection/toggle behavior stays deterministic and separate from move ownership.
  - Undo/redo now restores drag-moved positions as one interaction unit.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/drag-element-position-plan.md`

## 2026-03-06 - Drag-move start now allows hovered unlocked element (not only preselected)

- Context:
  - Initial drag-move implementation only started when pointer-down happened on an already selected element.
  - Expected canvas behavior is to drag the element under pointer when it is unlocked, even if it is not preselected.
- Decision:
  - Update `move-elements` start gate to allow hovered unlocked element as drag source.
  - When hovered unlocked element is not in current selection, set selection to that element first (`undoable: false`) and start move session.
  - Keep locked elements blocked from move start and excluded from batch move updates.
- Consequences:
  - Users can drag-move an element directly from pointer hover without preselecting first.
  - Locked elements remain non-draggable in drag-move flow.
  - Selection and move ownership stay centralized in `move-elements` for this pointer-down path.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/drag-element-position-plan.md`

## 2026-03-06 - Drag-start selection switch is now undoable within move action

- Context:
  - Dragging an unselected unlocked element correctly switched selection and moved position, but undo only restored position.
  - Expected undo contract is to restore both moved position and prior selection.
- Decision:
  - Make drag-start auto-selection (when source is unselected unlocked element) undoable inside the same move session commit.
  - Keep drag-frame position updates non-undoable and final move commit undoable.
- Consequences:
  - One undo now restores both the element position and the previous selection state for unselected-target drag moves.
  - Drag session remains compact while preserving expected interaction rollback semantics.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/drag-element-position-plan.md`

## 2026-03-06 - Drag-element reposition plan closed out and archived to completed records

- Context:
  - Drag-to-move implementation and undo/selection regressions are resolved and documented.
  - The drag-element plan still referenced an active-plan path.
- Decision:
  - Mark the drag-element reposition plan as DONE and move it to completed plan records.
  - Keep same-day implementation decisions append-only; add this closeout entry as the canonical completed-plan linkage.
- Consequences:
  - `PLANS.md` no longer references an active drag-element plan.
  - Canonical plan reference for drag-move behavior now points to completed records.
  - Earlier same-day `Related Plan` references to the active path are superseded by the completed path below.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/drag-element-position-plan.md`

## 2026-03-06 - Non-pen path editing now supports drag updates for point targets

- Context:
  - Path-editing non-pen mode supported selecting anchors/handles but did not mutate their positions via pointer drag.
  - Point-target drag needed deterministic undo behavior consistent with other drag interactions.
- Decision:
  - Extend `selectVectorPoint` (`input.drag`, priority `30`, exclusive) with point-target drag session state.
  - Add threshold-gated drag handling (`FEATURE_MOVEMENT_THRESHOLD.moveVectorPoint`) for anchor and handle targets.
  - Apply frame-by-frame point-target updates as `undoable: false`, then commit drag-end final position as one intended undoable action.
  - Extend element common APIs to accept optional mutation options for anchor/handle position updates.
- Consequences:
  - Dragging a selected anchor now updates anchor position directly and translates connected handles with the anchor.
  - Dragging a selected `inHandle`/`outHandle` now updates that handle position while preserving handle-target selection.
  - Point-target drag now preserves compact undo semantics and is covered by pen-tool E2E regression tests.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/drag-vector-point-and-handle-plan.md`

## 2026-03-07 - Repeatable fills property model and properties-panel editing adopted

- Context:
  - The app only supported a single vector `fill` string and fixed hard-coded fills for other shapes.
  - Properties panel `fills/*` UI was placeholder-only and not connected to app runtime writes.
- Decision:
  - Adopt repeatable `fills` model (`fills[]`) backed by typed `fill` child components with schema validation.
  - Register `fill`/`fills` property schemas with runtime/load guard semantics:
    - runtime invalid writes are rejected
    - invalid loaded values fallback to deterministic defaults
  - Add `fills` to drawable component contracts and UI-context aggregate registration.
  - Implement properties-panel fills editor with repeatable rows, visibility toggle, opacity, color format, canonical color write, add/remove, and color picker.
  - Keep vector legacy `fill` property as compatibility fallback for rendering existing saved data.
- Consequences:
  - Element appearance editing is now state-driven and persisted through property components instead of hard-coded render defaults.
  - Multi-selection now receives aggregate `fills` behavior (including mixed sentinel handling).
  - Existing saved vector documents with legacy `fill` continue rendering while new edits use `fills`.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/repeatable-fills-properties-plan.md`

## 2026-03-07 - Fills panel editing constrained by element type and color-picker drag history policy

- Context:
  - Fills editor was shown for all selected element types, including vectors.
  - Color picker changes could create excessive undo history when dragging.
- Decision:
  - Hide fills panel section when selected set includes a vector element.
  - Keep vector `fills` in runtime model/render path, but disallow panel edits for vector selections.
  - Route color-picker drag writes with `undoable: false` to prevent per-drag undo commits, then apply one undoable commit when picker interaction finalizes.
- Consequences:
  - Vector appearance remains data-driven but not editable through current properties panel fills UI.
  - Color picker interactions no longer flood history during drag.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/repeatable-fills-properties-plan.md`

## 2026-03-07 - Fills color picker moved to custom design-system control with picker-owned drag transactions

- Context:
  - Native browser color input coupled undo behavior to browser open/close/change sequencing instead of actual palette drag sessions.
  - Drag interactions need deterministic pointer-owned transaction boundaries: preview opens/closes the picker, palette/slider drags own undo grouping.
- Decision:
  - Replace native fill color input with a custom `@asyra/design-system` color picker using app-owned preview, palette, hue, and alpha controls.
  - Keep preview-block pointer interaction UI-local for picker open/close only.
  - Start one outer transaction on picker palette/slider pointer-down and end it on pointer-up/pointer-cancel, while drag-frame fill writes remain inside that transaction.
- Consequences:
  - One picker drag now maps to one undoable color change commit.
  - Color picker behavior is no longer dependent on browser-native color input event sequencing.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/repeatable-fills-properties-plan.md`

## 2026-03-07 - Gradient fills panel upgraded from metadata display to stop editor

- Context:
  - Gradient fills in the properties panel only exposed type selection and stop/handle counts, which was insufficient for real gradient authoring.
- Decision:
  - Add a panel gradient editor with Figma-style stop strip, stop selection, stop add/remove, stop position editing, and stop color editing through the shared custom color picker.
  - Keep fill-level opacity separate from gradient-stop opacity, matching the existing fill data contract.
- Consequences:
  - Gradient fill authoring is now possible directly in the properties panel instead of being metadata-only.
  - Gradient stop color/position changes are covered by properties E2E.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/repeatable-fills-properties-plan.md`

## 2026-03-09 - Fill common-api no longer decides transaction ownership

- Context:
  - `fillApis.updateFill(...)` was reading runtime transaction depth and conditionally opening/closing transactions as a safety fallback.
  - That mixed behavior policy into a mutation API and relied on internal transaction state.
- Decision:
  - Make `fillApis.updateFill(...)` mutation-only.
  - Move discrete fill transaction ownership into properties-panel UI handlers.
  - Keep color-picker drag transaction ownership in the picker interaction flow.
- Consequences:
  - App/common API no longer inspects transaction internals.
  - Transaction boundaries now live at the UI-behavior layer where the user action is known.

## 2026-03-09 - Color-picker drag uses live non-undoable writes and one finalize commit

- Context:
  - Direct child-property fill editing exposed a drag regression: palette/slider frames were being added into undo history, and gradient-stop render refresh also depended on the correct scene-tree publish channel after committed props writes.
- Decision:
  - Keep preview open/close UI-local.
  - During color-picker and gradient-stop drags, apply live fill writes with `undoable: false`.
  - On drag finalize, replay one undoable fill write before ending the outer transaction.
  - Refresh owner computed `fills` through the committed props bridge, but publish the resulting scene-tree transaction on the scene-tree shared channel instead of inheriting the props shared channel.
- Consequences:
  - Drag sessions produce one undoable color action instead of one commit per frame.
  - Gradient stop edits update both the properties preview and render subscribers consistently.

## 2026-03-09 - Fills panel ownership moved to ui-context compute with row-based contract

- Context:
  - Fills panel state was still partially owned by provider-local effects/subscriptions, even though the selected-fill value is selection-derived UI state.
  - The old contracts/docs also still described vector elements as hiding fills, which no longer matched the implemented properties panel behavior.
- Decision:
  - Make ui-context `fills` the selection-derived source for the properties panel via custom `compute`.
  - Define the current `fills` UI value as `FillRowAttrs[]` for single selection, where each row carries underlying `ids`.
  - Keep non-single selection on top-level `MIX` until row-level multi-selection aggregation/edit fanout is implemented.
  - Keep vector elements editable through the normal fills section in element-properties mode; only vector point editing routes away from the element panel.
- Consequences:
  - `useFills()` / `useFill()` become thin selectors instead of hooks that manage selection changes themselves.
  - Fills panel behavior and docs now align around one owner boundary.
  - The row contract is ready for future multi-selection fanout because each visible row already carries underlying fill ids.

## 2026-03-09 - Single-fill edits now patch child property ids instead of rewriting full fills array

- Context:
  - Per-fill edits were still reading the entire resolved `fills` array, replacing one entry, and writing the full array back through `changeComputedData('fills', ...)`.
- Decision:
  - Keep add/remove on the top-level `fills` list.
  - Route single-fill field edits through direct child-property updates by `fillId`, then refresh the owner element computed `fills` once.
- Consequences:
  - One fill edit no longer requires rebuilding and writing every fill entry.
  - Repeatable child-property patterns now have a cleaner path for future fills/strokes/shadows work.

## 2026-03-09 - Fills panel commits discrete fill edits as their own transactions

- Context:
  - Direct child-property writes fixed the fill-write boundary, but discrete properties-panel edits such as hex-entry, mode toggle, and visibility/opacity changes still needed their own user-action transaction boundary.
- Decision:
  - Let fill common-apis start/end a transaction when no outer transaction is active, while color-picker drag keeps using its explicit outer transaction session.
  - Commit direct fill child-property changes through `core.commitPropertyChanges(...)` with owner metadata so scene-tree recompute follows the committed props bridge.
- Consequences:
  - One discrete fill edit now maps to one undoable action.
  - Drag sessions still stay grouped under their existing outer color-picker transaction.

## 2026-03-09 - Repeatable fills properties finalized on child-property model

- Context:
  - Repeatable fills shipped across preset, render, scene-tree, props-manager, ui-context, and properties-panel flows.
  - The implementation needed a stable ownership rule for fill item edits, color-picker drag transactions, and current computed refresh behavior.
- Decision:
  - Finalize fills as a repeatable child-property model where top-level `fills` owns row membership and each fill item is edited through direct child-property updates by `fillId`.
  - Keep fills panel state owned by ui-context row data.
  - Treat `refreshComputedDataFromProperty(...)` as the current bridge for prop-originated computed refresh until framework property-driven computed sync replaces the broad recompute path.
- Consequences:
  - Single-fill edits no longer rewrite the whole fills array.
  - Color/gradient editing keeps one intended undoable action per drag session.
- Follow-up framework work is now explicitly tracked under `docs/ai/framework/plans/completed/property-driven-computed-sync-plan.md`.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/completed/repeatable-fills-properties-plan.md`

## 2026-03-09 - Active gradient fills use canvas handle overlay editing

- Context:
  - Gradient stop editing existed in the properties panel, but gradient handle geometry was not visible or editable on canvas.
  - The requested UX is closer to professional design tools: panel editing activates direct on-canvas handle manipulation.
- Decision:
  - Add app-owned gradient editing system state (`activeGradientFill`, hovered/selected gradient handle).
  - Register a dedicated gradient-handles render layer for the overlay.
  - Route canvas handle drag through an app feature that updates fill child-property `gradientHandles` directly by `fillId`.
  - Keep drag-frame writes non-undoable and finalize with one intended undoable commit.
- Consequences:
  - Active gradient fills can now be manipulated on canvas without rewriting the whole fills array.
  - Gradient editing now spans panel state, app feature flow, and a dedicated overlay layer under explicit ownership.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/canvas-gradient-handles-plan.md`

## 2026-03-10 - Linear gradient render mapping stabilized in preset

- Context:
  - Linear gradient rendering on canvas was unstable under handle reversal/out-of-bounds and did not consistently respect local-space bounds.
  - Radial gradients still showed incorrect output, so only linear was stabilized in this pass.
- Decision:
  - Map gradient handles into local pixel space before building render gradients.
  - Keep linear gradient stop ordering stable under Pixi's internal flip behavior.
  - Defer radial/other gradient type fixes to the next increment.
- Consequences:
  - Linear gradient rendering on canvas is now consistent with handle geometry.
  - Radial and other gradient types remain pending and tracked under the canvas-gradient-handles plan.

## 2026-03-11 - Canvas gradient handles plan closed out

- Context:
  - Canvas gradient handle editing now has overlay, drag feature flow, and linear gradient render stability for day-to-day editing.
- Decision:
  - Mark the canvas gradient handles plan complete and move it to completed plan records.
  - Track radial and other gradient type rendering as follow-up scope.
- Consequences:
  - Canvas handle editing is treated as finished behavior for linear gradients.
  - Remaining gradient type rendering work proceeds under a new follow-up scope.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/completed/canvas-gradient-handles-plan.md`

## 2026-03-11 - Vector handle modes for path editing

- Context:
  - Handle drag and panel coordinate edits were independent with no way to enforce mirrored angle/length constraints.
- Decision:
  - Add vector handle mode selection (`none`, `mirror-angle`, `mirror-angle-length`) in the point properties panel.
  - Apply handle mode constraints when dragging handles on canvas and when editing handle coordinates in the panel.
- Consequences:
  - Handle behavior now mirrors angle and/or length based on the selected mode while defaulting to independent handles.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/vector-handle-mode-plan.md`

## 2026-03-11 - Vector handle mode plan closeout

- Context:
  - Handle mode behavior shipped and the plan record moved to completed.
- Decision:
  - Close out the vector handle mode plan and reference the completed plan record.
  - Supersedes the plan-path reference in the earlier 2026-03-11 handle mode decision entry.
- Consequences:
  - Plan references now resolve to the completed record.
- Related Plan:
  - `/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/completed/vector-handle-mode-plan.md`

## 2026-03-13 - Vector geometry consistency helper closeout

- Context:
  - Vector edits needed a centralized topology repair + computed-patch path to keep handles, segments, and networks consistent across mutations.
- Decision:
  - Close out the vector geometry consistency helper plan after adding the helper and routing vector mutation commits through the shared patch builder.
- Consequences:
  - Vector edits now use a single topology repair + patch flow for add/move/split/update/remove/connect.
  - The helper can be reused by future modules (for example, animation) without reimplementing geometry consistency logic.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/completed/vector-geometry-consistency-plan.md`

## 2026-03-13 - Create tool resets to Select after shape creation

- Context:
  - Rectangle/oval creation left the primary tool set to a create tool, causing accidental repeated element creation after the initial drag.
- Decision:
  - Switch the primary tool back to Select at the end of the create-element session for rectangle and oval tools.
- Consequences:
  - After a single create action, the canvas returns to selection behavior by default.
  - Users can re-enter shape creation explicitly via toolbar or shortcut when desired.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/completed/auto-switch-to-select-after-create-plan.md`

## 2026-03-13 - Properties panel header and vector UI polish closed out

- Context:
  - Properties panel header/title behavior, vector point controls, and vector icon rendering needed alignment with the new vector topology and panel UI styling.
- Decision:
  - Complete the properties panel header and vector UI polish plan and record the updated UI behavior as app-level scope.
- Consequences:
  - Panel headers now track selection type or path-editing mode with consistent row alignment.
  - Vector point controls and fill header styling align with the updated panel conventions.
  - Vector icon row rendering is stable and no longer reacts to unrelated vector edits.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/completed/properties-panel-header-vector-ui-polish-plan.md`

## 2026-03-13 - Escape key cancel behavior alignment closeout

- Context:
  - Escape previously drove split/new-subpath and tool-switch logic that no longer matched the desired cancel semantics for selection vs path editing.
- Decision:
  - Close out the Escape key cancel behavior plan after aligning Escape to clear vector selection first, exit path editing when no vector selection exists, and clear element selection when not editing.
- Consequences:
  - Escape now follows a single deterministic cancel flow across path-editing and element selection states.
  - No tool switching or geometry edits occur on Escape.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/completed/escape-key-cancel-behavior-plan.md`

## 2026-03-14 - Multi-fill rendering replays shape paths per fill

- Context:
  - Adding multiple fills rendered only the first visible fill because the render path was consumed on the first `fill` call.
  - Visual stacking needed to match the fills list order used in the properties panel.
- Decision:
  - Replay the element path before each additional fill so every fill renders.
  - Keep fill stacking in list order (later fills draw on top).
- Consequences:
  - Solid and gradient fills now composite correctly across multiple fills.
  - Fill list order in the UI corresponds to visual stacking on canvas.
- Related Commit(s):
  - pending

## 2026-03-14 - Vector even-odd fill + editing stability baseline

- Context:
  - Vector fills must respect even-odd semantics for intersecting paths.
  - Path-editing continuation and cancel behaviors needed stability fixes.
- Decision:
  - Adopt even-odd fill semantics for vector rendering.
  - Remove default vector fills so new vectors start empty.
  - Stabilize path-editing preview handle direction, endpoint selection after refresh, and cancel-to-select tool switch.
- Consequences:
  - Self-intersecting paths fill expected odd regions.
  - New vectors do not auto-fill without explicit fill entries.
  - Path editing is more predictable when continuing or canceling edits.
- Related Commit(s):
  - pending

## 2026-03-14 - Vector editing performance remediation closeout

- Context:
  - Vector drag and edit interactions for dense vectors were sluggish (dropping frames) due to heavy even-odd fill recalculations, overlapping rendering paths, and curve flattening during every drag point.
- Decision:
  - Close out the vector editing performance remediation plan after successfully deferring and optimizing real-time geometry changes.
  - Implement geometry caches and defer full fill rebuilds until editing release.
- Consequences:
  - Dense vector point dragging stays responsive at 60 FPS without multi-frame stalls.
  - Correct even-odd fill rendering and subpath behaviors are preserved.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/completed/vector-editing-performance-plan.md`

## 2026-03-15 - Vector ID and Name Synchronization Fix

- Context:
  - Users reported that creating new vector points after a page reload would sometimes affect or overwrite old vector elements.
  - This was caused by ID collisions because `idCounter` and `nameCounter` were not always synchronized with existing data when types were encountered for the first time during load.
- Decision:
  - Modify `idCounter` and `nameCounter` `load` logic to automatically initialize and synchronize counters for any unencountered types.
  - Standardize type-to-prefix mapping in counters to use the registered prefix rather than deriving it from the type string.
  - Ensure `DynamicComponent` uses the component's `type` as the counter key for consistency.
  - Fix child component ID generation in `children-map-property-component` by correctly passing `childIdType`.
- Consequences:
  - Vector point and segment IDs are guaranteed to be unique and correctly prefixed even after page reloads.
  - Counter synchronization is more robust and resilient to initial data loading.
  - ID collisions between new and old elements are prevented.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/vector-id-sync-fix.md`

## 2026-03-15 - Refactor Path Editing Continuation State

- Context:
  - Path editing continuation logic (determining which endpoint to continue from) was manually calculated in the pen tool during every drag start.
  - This duplication led to high computational overhead and inconsistent state management between the pen tool and other vector-editing features.
- Decision:
  - Centralize path editing continuation logic in the `systemContext` with a dedicated property `pathEditingContinuation`.
  - Define a standardized `PathEditingContinuationState` interface in `@asyra/core` and export it as part of the core vector contract.
  - Implement reactive synchronization in a new app-level initialization module that updates the continuation state based on selection, edited vector, and topology changes.
  - Refactor the pen tool to consume the centralized state instead of calculating it internally.
- Consequences:
  - Pen tool implementation is simplified and more performant.
  - Continuation state is now consistently available to the UI and other features through the standard property system.
  - Data flow is more deterministic and follows the framework's reactive principles.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/refactor-path-editing-continuation-state.md`
## 2026-03-15 - Hover detection switched from bounds to render item

- Context:
  - Previously, hover detection used element bounding boxes, preventing selection of elements behind opaque shapes even if the pointer was not over the visible pixels (e.g., in the corner of an Oval's bounds).
- Decision:
  - Leverage `FeatureSystem`'s native support for `render.*` events to implement hover detection.
  - Listen to `render.pointer.hover` and `render.pointer.leave` events in the `hover-element` feature.
  - Remove manual polling and hit-testing logic from `elementApis` for hover detection.
- Consequences:
  - Hover detection is now fully event-driven and geometry-precise (handled by the PixiJS hit-test system).
  - Reduced CPU overhead by removing mouse-move polling for hover checks.
  - Better alignment with the framework's reactive and event-driven architecture.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/completed/hover-on-render-item.md`

## 2026-03-15 - Geometry-accurate element selection and move start

- Context:
  - Element selection and movement start previously relied on bounding box checks in `elementApis`, which often selected the wrong element (e.g., the parent Oval instead of a child nested in its corner).
- Decision:
  - Implement `getElementIdAtClientPos` in the `@asyra/render` package using PixiJS v8's `rootBoundary.hitTest` for geometry-precise detection.
  - Update `elementApis.getElementIdAtClientPos` to leverage this new renderer-level accurate hit testing.
  - Refactor `selection` and `move-elements` features to use the current `hoveredElementId` from the system context as the primary target, falling back to the accurate manual hit test.
- Consequences:
  - Elements can now be selected and moved with pixel precision, ignoring transparent areas or corners of bounding boxes.
  - Interactions correctly prioritize the visually hovered element, even in complex overlapping scenarios.
  - Resolved a `TypeError` regarding `hitTest` by correctly accessing the PixiJS v8 `EventBoundary`.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/select-element-by-hover-target-plan.md`

## 2026-03-16 - ColorPicker state synchronization and editing refinements

- Context:
  - The `ColorPicker` component had several interaction and state synchronization issues:
    - Undo/Redo operations did not always trigger a picker update because emitted values were cached incorrectly.
    - Advanced color formats like HWB, OKLCH, and CSS were non-editable or reverted to HEX immediately upon typing.
    - HSB inputs exhibited value "jumping" during focus/blur cycles.
    - The UI lacked a native eye dropper tool and had inconsistent label/icon colors.
- Decision:
  - Implement a mismatch-detecting cache invalidation strategy in the `ColorPicker` sync effect to ensure Undo/Redo always restores picker state.
  - Standardize emitted color string formatting in `emitChange` to match the active `colorFormat`, preventing guard mismatches that caused draft resets.
  - Add `draftCss` and `draftHsbS` states to handle direct text entry for CSS strings and stable HSB saturation values.
  - Reorganize the picker internal layout to include a native EyeDropper API tool alongside hue and opacity sliders.
  - Standardize all picker UI text and icons to full white and expand the format selector width to 66px.
  - Ensure all internal conversions (HSVA, RGBA, HSLA) are consistent across the app and design system.
- Consequences:
  - `ColorPicker` state is now perfectly synchronized with the application's undo/redo history.
  - All color formats are fully editable, including CSS color strings and advanced formats like OKLCH.
  - The eye dropper provides a professional-grade sampling tool directly integrated into the palette.
  - UI consistency and legibility are improved through standardized styling and spacing.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/color-picker-fix-plan.md`

## 2026-03-16 - ColorPicker generalized with app-level format configuration

- Context:
  - The `ColorPicker` component was tightly coupled to hardcoded color format definitions in the design system, making it difficult for applications to define custom formats or input behaviors.
  - Supporting new formats (e.g., HWB, OKLCH) required changing the design system's core component logic.
  - State management for different color channels (HEX, RGBA, HSLA) was fragmented across multiple local states, leading to synchronization complexities.
- Decision:
  - Refactor `ColorPicker` to accept a `formatDefinitions: ColorFormatDefinition[]` prop, decoupling it from specific format implementations.
  - Move all color format definitions (HEX, RGB, HSL, HSB, HWB, OKLCH, CSS) to the application level (`apps/asyra-design/src/properties/fills/color-picker-config.ts`).
  - Standardize format definitions using a common `ColorFormatDefinition` interface that defines:
    - `toValues(hsva)`: Converts HSVA to an array of string values for inputs.
    - `fromValues(values, current)`: Converts input values back to HSVA.
    - `formatInput(val, index)`: Optional sanitization/formatting logic for each input field.
  - Consolidate individual draft states in `ColorPicker` into a single `draftValues: string[]` array driven by the active format definition.
  - Add native `EyeDropper` API support directly within the picker UI.
  - Export all necessary color utilities (`hsvaToHwb`, `hwbToHsva`, `hsvaToOklch`, `oklchToHsva`) and types from `@asyra/design-system` to support app-level configuration.
- Consequences:
  - `ColorPicker` is now a truly generic and extensible component that can support any color format without internal modifications.
  - Application developers have full control over the available formats, input order, and validation logic.
  - Design system complexity is reduced, and state synchronization is more robust.
  - UI consistency is improved with standardized white icons and text.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/color-picker-generalization-plan.md`

## 2026-03-16 - Non-linear gradient start handle display mapping

- Context:
  - Switching gradient types between linear and non-linear kept the same stored handle data, but the on-canvas start handle did not visually reposition to match expected non-linear editing behavior.
  - This made the gradient start handle feel inconsistent when toggling between linear and non-linear modes.
- Decision:
  - Derive the non-linear start handle display position as the midpoint between stored start/end handles while keeping stored data unchanged.
  - Map start-handle drag updates back to stored data so the visual handle remains aligned with cursor movement under non-linear types.
- Consequences:
  - Gradient type switching now repositions the on-canvas start handle without mutating stored gradient data.
  - Handle hit-testing and drag interactions remain consistent with the displayed handle position.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/non-linear-gradient-handle-display-plan.md`

## 2026-03-17 - Gradient editing drag performance remediation

- Context:
  - Dragging gradient handles/stops on canvas and in the properties panel exhibited visible lag due to per-move geometry recompute and unthrottled writes.
  - Overlay rendering re-parsed stop colors each frame and hover/selection writes were redundant.
- Decision:
  - Throttle gradient drag writes to animation frames and reuse cached geometry during drag.
  - Throttle properties-panel stop drag updates to animation frames.
  - Cache stop color parsing in the overlay render layer and avoid redundant hover/selection system property writes.
  - Add movement thresholds for handle/stop drags to reduce jittery updates.
- Consequences:
  - Gradient dragging is responsive without changing undo semantics (single commit per drag).
  - Overlay visuals remain accurate with reduced per-frame overhead.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/gradient-editing-performance-plan.md`

## 2026-03-17 - Non-linear gradient end-handle drag anchoring

- Context:
  - Non-linear gradients display the start handle at the midpoint between stored handles without mutating stored data.
  - Dragging the end handle updated only the stored end handle, which shifted the display midpoint and made the start handle move unexpectedly.
- Decision:
  - When dragging the non-linear end handle, offset the stored start handle to keep the display midpoint fixed.
  - Apply the same mapping for both delta-based and absolute-position handle updates.
- Consequences:
  - Non-linear end-handle drags keep the start handle visually anchored.
  - Linear gradients and start-handle drag behavior remain unchanged.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/non-linear-gradient-end-handle-drag-plan.md`

## 2026-03-17 - Vector gradient fill updates render immediately during drag

- Context:
  - Gradient-filled vectors regressed in drag responsiveness after even-odd gradient fill rendering was introduced.
  - Skipping even-odd fills during drag broke fill-rule accuracy, so correctness needed to remain intact.
- Decision:
  - Keep even-odd gradient fill rendering active during vector point/handle drag.
  - Rebuild even-odd fills every render while dragging for immediate updates.
  - Reduce drag-time rasterization budget to keep interaction responsive, restoring full quality after drag end.
- Consequences:
  - Fill rule accuracy is preserved during drag with immediate visual updates.
  - Drag-time fill quality is slightly reduced to cap cost, with full-quality rendering after drag end.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/vector-gradient-drag-performance-plan.md`

## 2026-03-17 - Gradient vector hover hit testing aligned to geometry

- Context:
  - Gradient-filled vectors were rendered with a rasterized rectangle for even-odd fills, causing Pixi hit testing to treat the full bounds as interactive.
  - Hover feedback was firing outside of visible fill/stroke geometry, diverging from selection accuracy.
- Decision:
  - Provide a geometry-aware hit area for gradient-filled vectors so hover uses vector fill/stroke geometry rather than the bounding rectangle.
  - Cache flattened segment data to keep hit testing efficient during pointer movement.
- Consequences:
  - Hover/leave events now reflect actual vector geometry for gradient fills.
  - Non-gradient vectors continue to rely on default Pixi hit testing.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/completed/vector-gradient-hover-hit-test-plan.md`

## 2026-03-17 - Gradient vector move drag performance stabilized

- Context:
  - Drag-moving gradient-filled vectors caused visible stalls during continuous drag.
  - The goal was to keep fill correctness while removing stutters.
- Decision:
  - Reuse even-odd gradient fill and hit-area caches when topology and fill data are unchanged.
  - Keep drag-time raster budget suppression without changing final fill fidelity.
- Consequences:
  - Drag movement no longer stalls while gradient fills remain correct during drag.
  - Drag FPS is improved but still below 120 FPS for dense gradients; a separate multi-selection plan tracks the 120 FPS target.
- Related Plan(s):
  - `docs/ai/apps/asyra-design/plans/completed/vector-gradient-move-performance-plan.md`

## 2026-03-17 - Multi-selection behavior parity across content panel and canvas

- Context:
  - Shift-click in the contents panel only toggled a single item and shift-click
    empty canvas cleared selection, which made multi-selection inconsistent.
  - Selection visuals only rendered for single selection.
  - Fills panel treated multi-selection as fully mixed without checking for
    identical fills.
- Decision:
  - Implement shift-range selection in the contents panel without removing
    existing selections.
  - Ignore shift-click on empty canvas to keep the current selection.
  - Render a single bounding selection box around all selected elements.
  - Aggregate fills by matching fill counts and values (including gradient
    stops and handles), otherwise report MIXED.
- Consequences:
  - Multi-selection behavior is consistent across panel and canvas.
  - Selection visuals reflect the full group selection.
  - Fills panel only shows concrete values when all selected fills match.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/multi-selection-elements-plan.md`

## 2026-03-17 - Area selection on canvas

- Context:
  - Dragging on empty canvas cleared selection without any marquee feedback.
  - Users needed a predictable box-select workflow that works with shift toggling.
- Decision:
  - Add an area selection session that renders a marquee overlay and updates
    selection in real time while dragging on empty canvas.
  - Shift-drag toggles membership for elements inside the dragged area.
- Consequences:
  - Box selection now provides immediate visual feedback and selection updates.
  - Shift area selection mirrors the toggle semantics of shift-click.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/area-selection-on-canvas-plan.md`

## 2026-03-17 - Content panel lock/visible toggles with persistent visibility

- Context:
  - The contents panel needed direct lock/visible toggles per element row.
  - Visibility changes were not reflected after reload without render-level support.
- Decision:
  - Add row action toggles for lock/visible that write through common APIs.
  - Apply element `visible` state on render add/update so hidden elements persist across reload.
- Consequences:
  - Lock/visible can be toggled from the contents panel with undo support.
  - Hidden elements remain hidden after reload and do not render on canvas.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/content-panel-lock-visible-toggle-plan.md`

## 2026-03-17 - Canvas selection ignores locked or hidden elements

- Context:
  - Locked or hidden elements should not be targetable by canvas selection or hover state.
- Decision:
  - Filter hover updates and canvas selection (click + area) to ignore locked/hidden elements.
- Consequences:
  - Locked/hidden elements no longer become hover targets or canvas selections.
  - Contents panel selection remains available for administrative changes.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/locked-elements-canvas-selection-plan.md`

## 2026-03-17 - Selection-bounds drag and click ownership

- Context:
  - Dragging inside selection bounds could trigger selection replace/clear even
    when the user intended to move the existing selection.
  - Clicking inside selection bounds without movement needed deterministic
    selection ownership.
- Decision:
  - Treat drag start inside selection bounds as move-elements ownership.
  - If no movement occurs after starting inside selection bounds, select the
    hovered element on mouse up or clear selection when nothing is hovered.
- Consequences:
  - Dragging within the selection box reliably moves the current selection.
  - Clicks inside selection bounds now behave like a direct selection update.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/selection-box-drag-move-plan.md`

## 2026-03-17 - Init organization rules and grouping

- Context:
  - App init folder was growing without clear ownership boundaries.
  - Startup wiring needed a consistent structure for required vs optional init.
- Decision:
  - Group app init modules into `foundation`, `capabilities`, `derived-state`, and `diagnostics`.
  - Document init-category rules and keep startup order explicit in app docs.
- Consequences:
  - Init modules are easier to locate by intent and less likely to mix feature logic.
  - App docs now reflect required vs optional init responsibilities.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/completed/init-reorganization-plan.md`

## 2026-03-19 - Repeatable strokes and closed-path stroke positioning

- Context:
  - The properties panel supported repeatable fills but not repeatable strokes.
  - Closed-path dashed stroke rendering diverged from expected `inside`,
    `center`, and `outside` semantics and needed deterministic behavior.
- Decision:
  - Add repeatable `strokes` contracts, schema registration, ui-context
    aggregation, and properties-panel stroke controls using the same
    child-property ownership model as fills.
  - Keep dash allocation on the original centerline.
  - Render `inside` strokes with inward offset plus inside clipping, render
    `center` strokes as explicit inside/outside halves, and render `outside`
    strokes from outward-offset geometry.
- Consequences:
  - Stroke editing is now first-class in the properties panel with persisted
    repeatable stroke rows.
  - Closed-path stroke positions are visually distinct and match the finalized
    centerline-first rendering rule.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/repeatable-strokes-and-stroke-rendering-plan.md`

## 2026-03-19 - Gradient vector hover hit testing follows rendered stroke geometry

- Context:
  - Gradient-filled vectors use a custom hit area because the rasterized
    even-odd fill path would otherwise hit across the whole bounds.
  - That custom hit area only used a max-width centerline band for strokes, so
    `inside`, `outside`, and dashed stroke variants could miss visibly rendered
    stroke pixels or hit empty space.
- Decision:
  - Build stroke hit geometry from the same offset and dashed stroke rules used
    by vector stroke rendering.
  - Use those rendered stroke segments inside the vector custom hit area
    instead of a single max-width centerline approximation.
- Consequences:
  - Gradient vector hover can target visibly rendered stroke pixels, including
    outside-offset strokes.
  - Dashed stroke gaps no longer count as hover hits in the custom vector hit
    path.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/vector-stroke-hit-test-plan.md`

## 2026-03-19 - Vector stroke hit-test plan closed out

- Context:
  - The vector stroke hit-test implementation is complete and the app plan
    should move from active tracking into the completed archive.
  - The earlier 2026-03-19 decision entry referenced the active-plan path
    before closeout.
- Decision:
  - Close out the app plan and treat the completed-plan record as the canonical
    reference for this work.
  - Supersede the earlier active-plan link with the completed-plan path below.
- Consequences:
  - `PLANS.md` no longer lists this work as in progress.
  - The canonical plan reference for this change is now the completed-plan
    archive entry.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/vector-stroke-hit-test-plan.md`

## 2026-03-19 - Vector hover hit follow-up clarified as hover-only

- Context:
  - The follow-up fix expanded vector hover hit geometry beyond the original
    gradient-only path so self-intersecting non-gradient vectors can resolve
    internal stroke segments.
  - The implementation and docs also needed to stay explicit that this work is
    hover-target correctness, not a separate selection-ownership change.
- Decision:
  - Apply the custom vector hover hit area to the general vector render path,
    not only the gradient raster branch.

## 2026-03-21 - Dashed stroke corners moved to geometry-first rendering

- Context:
  - Closed-path dashed strokes still relied on stroked centerline pieces for
    rendering, which allowed semi-transparent corner-spanning dashes to darken
    from overlap.
  - `inside` dashed corners could also remain inside the overall shape mask
    while escaping the true segment-bounded wedge at acute corners.
  - Future gradient stroke fill needs dashed stroke rendering to behave as
    visible geometry plus paint, not as a stroke-command composition artifact.
- Decision:
  - Replace dashed stroke rendering with explicit visible polygon geometry and
    render those dashed parts through fill semantics.
  - Clip acute `inside` dashed corners against the original segment half-planes
    so the visible geometry stays inside the true wedge.
  - Expose polygon hit primitives for dashed stroke parts and consume the same
    geometry in vector hover hit testing.
- Consequences:
  - Semi-transparent dashed corners preserve authored color without overlap
    darkening.
  - `inside` dashed corners stay within the intended segment-bounded region.
  - Dashed stroke rendering now has one geometry-first model that future
    gradient stroke fill can build on.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/stroke-geometry-first-corner-correctness-plan.md`
  - Treat `hoveredElementId` as the selection gate and frame this work as
    hover-only in plan/docs language.
  - Supersede the earlier active-plan reference with the completed-plan path
    below as the canonical record for the whole change set.
- Consequences:
  - Internal star/self-intersection stroke segments can become hover targets.
  - Render hover remains the single source of truth for pointer targeting, and
    selection continues to consume that hover target.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/vector-stroke-hit-test-plan.md`

## 2026-03-21 - Geometry-first dashed stroke closeout finalized from sample regressions

- Context:
  - The initial geometry-first dashed stroke conversion established the right
    rendering direction, but sample-based regressions still exposed three
    remaining correctness gaps:
    - short dashes on bezier segments could flatten too coarsely and drift at
      both ends
    - closed-path corner-adjacent dashes still lacked enough local context at
      path-start and sharp-corner boundaries
    - translucent dashed polygons needed to render as one filled stroke path to
      avoid repeated alpha darkening across overlapping dash regions
- Decision:
  - Finalize the geometry-first dashed stroke path with:
    - stroke-specific bezier flattening density for stroke polylines
    - dash-part endpoint context plus full closed-path `inside` half-plane
      clipping for corner correctness
    - one filled path per dashed stroke/polyline to preserve authored alpha
      without fallback re-stroking of clipped-away inside dashes
- Consequences:
  - The reported sample corner cases at the third point, the penultimate/last
    segment join, and the closed-path start are covered by renderer regression
    tests.
  - Dashed stroke correctness and translucent overlap behavior now resolve in
    the same geometry-first pipeline that future gradient stroke fill can
    extend.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/stroke-geometry-first-corner-correctness-plan.md`

## 2026-03-21 - Solid dashed stroke projection composes canonical geometry in one fill pass

- Context:
  - `GeometryModel` now emits canonical dashed stroke patch polygons and uses
    local inside-corner constraints to keep acute `inside` dashes within the
    intended wedge.
  - Those patch polygons can still overlap where separate dash regions become
    spatially close, which is acceptable geometry-wise but darkens
    semi-transparent output if the renderer paints each polygon independently.
  - The product requirement is that translucent dashed strokes preserve authored
    color even when geometry patches overlap.
- Decision:
  - Keep `GeometryModel` as the canonical algorithm/hit-test layer.
  - Change `MeshProjection` solid-paint rendering to compose all polygons in a
    single compound fill pass instead of triangulating and alpha-blending each
    polygon independently.
  - Validate geometry correctness and render composition separately:
    - geometry tests use acute-corner oracles on canonical fixtures
    - render tests assert a single fill pass per projection update
- Consequences:
  - `inside` dashed corner correctness remains geometry-driven and testable.
  - Semi-transparent dashed strokes no longer darken from repeated per-polygon
    paint accumulation in the solid projection path.
  - Future gradient stroke fill can reuse the same `GeometryModel` contract
    while introducing its own projection-specific paint path.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-stroke-correctness-recovery-plan.md`

## 2026-03-23 - Dashed stroke corner alpha-union workaround approach rejected

- Context:
  - A plan to use mask-plus-rectangle workarounds for `inside` dashed corner
    rendering was proposed to handle edge cases in corner geometry.
  - App policy prohibits workaround approaches; geometry-first rendering is the
    only valid path forward.
  - The workaround plan included mask composition, fill-rule fallbacks, and
    local rectangle compensation at corners—all runtime patches rather than
    algorithmic correctness.
- Decision:
  - Reject the dashed-stroke-corner-alpha-union (workaround) plan.
  - Supersede it with a comprehensive 2-phase geometry-and-dash-gap completion
    plan that addresses all remaining geometry bugs and gap specifications
    through oracle-driven validation rather than workarounds.
  - Move the rejected workaround plan to the completed-plans archive with a
    REJECTED status record.
- Consequences:
  - Geometry-first rendering remains the single authorized path.
  - No workarounds allowed; all fixes must improve the canonical algorithm.
  - The comprehensive 2-phase plan provides executable oracle gates at both
    geometry and gap layers, preventing workaround temptation from incomplete
    fixes.
- Related Completed Plan:
  - `docs/ai/apps/asyra-design/plans/completed/dashed-stroke-corner-alpha-union-plan.md`

## 2026-03-23 - Geometry-and-dash-gap completion plan adopted with oracle gates

- Context:
  - Dashed stroke rendering is partially implemented but has known bugs in
    5 areas: sharp corner wedge clipping, dash sizing inconsistency, polygon
    connectivity, self-intersection detection, and coverage density.
  - Gap size rules are undefined; gap calculation logic is broken.
  - Future gradient stroke fill is blocked until both geometry and gap layers
    are verified correct through oracle validation.
  - The previous workaround plan was rejected; geometry-first requires a
    systematic 2-phase approach with executable exit gates.
- Decision:
  - Adopt the comprehensive `geometry-and-dash-gap-completion` plan as the
    canonical path forward.
  - Phase 1 (Geometry: Days 1–3):
    - Fix all 5 geometry bugs to satisfy oracle validation:
      1. Dash interval monotonicity (intervals in increasing distance order)
      2. Sharp corner wedge clipping (inside-corner vertices stay within
         segment half-plane bounds)
      3. Polygon connectivity (no duplicate vertices, degenerate edges; min 3
         vertices per polygon)
      4. Self-intersection absence (polygons must not self-cross)
      5. Coverage density (rasterized polygon coverage > 70% of target dash
         length)
    - Expand test fixtures: right-triangle corner case, reported 5-anchor
      sample, edge cases (very short dashes, curved segments)
    - Exit gate checklist: 7 executable validation items covering all oracles
  - Phase 2 (Gap Specification & Implementation: Days 4–5):
    - Define gap size rules with worked examples
    - Implement gap calculation in getDashPattern logic
    - Add gap proportion oracle tests
    - Exit gate checklist: 5 executable implementation + gap-oracle items
  - Blocking rule: Phase 2 only starts after Phase 1 exit gate passes. Gradient
    stroke fill only proceeds after both phases complete. No workarounds
    allowed to skip oracle validation at any phase.
- Consequences:
  - Dashed stroke rendering now has an explicit 2-phase completion roadmap with
    binary oracle gates.
  - No phase proceeds until exit criteria are satisfied; no workarounds allowed.
  - Phase 1 completion unblocks gap implementation and gradient stroke fill
    development.
  - Target sample (5-anchor closed path with inside dashed stroke) is the
    recurring validation fixture for both phases.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/geometry-and-dash-gap-completion.md`

## 2026-04-01 - Inside dashed stroke local-first repair stack downgraded for global-first rebuild

- Context:
  - Inside dashed stroke work accumulated a large local-first repair/runtime
    stack:
    - local-gap promotion
    - scenario-owned facing-terminal retention
    - remote-pollution runtime adoption layering
    - stage-specific wedge/ownership artifact families
  - Visible render correctness stayed wrong even while many intermediate
    contracts passed.
  - The rebuild direction changed to `global-first`:
    - full `dash/gap` interval allocation first
    - full dash candidate generation from true path slices first
    - global overlap/component analysis after all candidates exist
    - ownership/clipping only after full candidate visibility
- Decision:
  - Remove the old local-first artifact family suite from the default blocking
    path.
  - Downgrade old local-gap/scenario-owned/remote-pollution runtime tests to
    legacy diagnostic status.
  - Preserve the historical path in explicit removal/triage documents instead of
    silently deleting that history.
- Consequences:
  - Default blocking tests no longer force the rebuild to preserve the old
    local-first runtime skeleton.
  - Historical diagnostics remain available, but no longer define correctness
    for the rebuild.
  - The rebuild can start from `DashIntervalRecord` and `DashCandidateGeometry`
    without old runtime-adoption layers acting as architectural anchors.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-removal-log.md`
  - `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-legacy-test-inventory.md`
  - `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-rebuild-plan.md`

## 2026-04-01 - Inside dashed stroke local-first runtime stack physically removed

- Context:
  - Bypassing the old inside-dashed local-first runtime stack was not enough,
    because shared helpers and artifact-heavy tests kept reintroducing that
    skeleton into active code.
  - Phase 1 / Phase 2 needed to become the only default product path, not just
    the preferred path.
- Decision:
  - Physically delete the old Phase 3+ local-first runtime execution from
    `packages/preset/src/components/geometry-model.ts`.
  - Delete old inside-dashed artifact-heavy test files instead of preserving
    them as runnable suites.
  - Keep decision history in docs, not as executable runtime authority.
- Consequences:
  - Default inside-dashed rendering now stops at:
    - first-class `dash/gap` interval allocation
    - first-class candidate geometry preview
  - Old `remote-pollution`, `local-gap`, `scenario-owned`, and runtime-adoption
    execution no longer consumes default render/runtime cost.
  - Historical path remains recorded in removal logs and plans, but no longer
    survives as code that can silently affect the product path.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-removal-log.md`
  - `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-implementation-backlog.md`

## 2026-04-02 - Transitional Phase 2 polygon-splicing path deleted before stroker rewrite

- Context:
  - After architecture review sign-off, the active rebuild direction for Phase 2
    became `dash subpath -> stroke-to-outline`.
  - The existing product-facing Phase 2 code was still a polygon-splicing
    candidate preview path rather than a mature stroker.
  - Keeping that transitional Phase 2 path alive would preserve rejected
    behavior and continue to blur the boundary between accepted architecture and
    temporary implementation.
- Decision:
  - Delete the existing Phase 2 candidate preview / polygon stitching code from
    `packages/preset/src/components/geometry-model.ts`.
  - Delete Phase 2 tests that asserted on `DashCandidateGeometry`,
    `DashCandidatePreview`, and candidate polygon stitching behavior.
  - Keep `Phase 1` interval allocation active and expose only empty dashed
    polygons on the default runtime path until the stroker rewrite is ready.
  - Delete dashed-only compatibility surfaces (`hitPolygons`, `debugParts`,
    `GeometryModelDebugPart`) instead of preserving empty placeholders for the
    removed Phase 2 path.
- Consequences:
  - Default dashed rendering no longer produces transitional geometry that could
    be mistaken for accepted architecture.
  - Product-facing dashed output is intentionally empty between the deletion of
    the polygon-splicing Phase 2 path and the introduction of the mature
    stroker rewrite.
  - Dashed hit-testing now reads directly from `model.polygons`; there is no
    separate dashed-only hit/debug surface left to accidentally preserve the
    deleted architecture.
  - Historical context remains in docs, but the rejected Phase 2 path no longer
    survives in executable code or blocking tests.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-implementation-backlog.md`
  - `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-removal-log.md`

## 2026-04-09 - Inside dashed stroke active baseline kept global-first with seam-overlap recovery and clipping still pending

- Context:
  - The current inside-dashed runtime no longer follows the removed
    local-first repair stack, but recent work restored the active product path
    and exposed new seam-overlap regressions at ownership assembly boundaries.
  - The project needs a commit-safe baseline before starting the next clipping
    / cutting pass, while preserving the full decision and plan history that
    led to the current shape.
- Decision:
  - Keep the global-first rebuild documents as active in-progress plans instead
    of closing them out.
  - Accept the current runtime baseline as the pre-clipping commit point:
    ownership-assembly seam overlaps are recovered on the active product path,
    but final clipping / cutting remains unfinished and stays explicitly in
    progress.
  - Preserve the accumulated plan documents as decision history rather than
    pruning them from the repository.
- Consequences:
  - The repository now has a recoverable baseline that can be restored before
    the next clipping / cutting iteration.
  - Global-first Phase 3+ work remains active and must not be misread as
    complete.
  - Historical plan accumulation remains intentional project memory, not stray
    documentation noise.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-rebuild-plan.md`
  - `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-implementation-backlog.md`
  - `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-tdd-plan.md`

## 2026-04-18 - Professional stroke engine Phase 3 dashed center geometry promoted

- Context:
  - Phase 1 (`solid + center`) and Phase 2 (`solid + inside/outside`) were
    already promoted, but dashed center rendering still depended on unfinished
    legacy assumptions and lacked full visual closeout.
  - The execution plan requires every supported slice to ship with both unit
    tests and visual tests through the real app/runtime path.
- Decision:
  - Promote Phase 3 `dashed + center + uniform width + solid paint` for
    supported `rect`, `oval`, and `vector` paths.
  - Adopt canonical authored dashed data as `dashPattern` + `dashOffset` and
    stop relying on scalar `dash/gap` runtime assumptions for the promoted
    slice.
  - Route center dashed rendering through fresh interval allocation,
    shared frame slicing, and fresh final packet generation; do not reuse the
    legacy dashed runtime.
  - Require the screenshot-level gate
    `apps/asyra-design/e2e/dashed-center-stroke-visual.spec.ts` plus
    `yarn workspace @asyra/preset test:local` and `yarn react:build` for
    Phase 3 closeout.
- Consequences:
  - Dashed center rendering now has a product-promoted fresh runtime with
    visual and unit contracts, including offset behavior, open/closed vector
    coverage, supported cap distinctions, unsupported round absence, and seam
    continuity for full-loop closed dash intervals.
  - Phase 4A overlap/ownership work can proceed without reopening legacy
    dashed runtime paths.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-19 - Professional stroke engine Phase 4A overlap and ownership debug surface promoted

- Context:
  - Phase 4A needed to bring overlap graphing, deterministic ownership, and
    bailout visibility onto the real `dashed + center` runtime path before
    constrained legality work could begin.
  - The accepted Phase 4A scope was limited to center-mode overlap/ownership
    debug surfaces and component-local bailout visibility, not full legality
    hardening.
- Decision:
  - Promote Phase 4A overlap/ownership support for the current
    `dashed + center + uniform width + solid paint` matrix.
  - Attach interval metadata to promoted dashed-center packets so overlap and
    ownership diagnostics stay on the same runtime path as the shipped render
    geometry.
  - Ship overlap, ownership, and bailout overlays through the preset
    render-layer registration path behind the explicit
    `__ASYRA_PHASE4A_STROKE_DEBUG__` flag.
  - Require `apps/asyra-design/e2e/center-dashed-overlap-visual.spec.ts` plus
    `yarn workspace @asyra/preset test:local` for Phase 4A closeout.
- Consequences:
  - Phase 4A now has deterministic overlap components, deterministic ownership
    winners for the promoted packet-level debug slice, and component-local
    bailout visualization on the real app/runtime path.
  - Phase 4B constrained ownership and legality work can begin without
    reopening legacy dashed routing or inventing a parallel overlap debug path.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-14 - Inside dashed stroke execution model locked to contract-first global-first pipeline

- Context:
  - The inside-dashed clipping effort repeatedly regressed because runtime work
    was attempted before helper boundaries, scenario permanence, and
    performance/rollback gates were fully specified.
  - Design review is now considered complete enough to stop further
    architecture iteration and resume implementation from the approved
    global-first pipeline.
- Decision:
  - Treat the global-first rebuild, implementation backlog, and TDD plan as the
    locked execution contracts for the remaining inside-dashed work.
  - Keep the pipeline order fixed as:
    - interval
    - candidate
    - overlap graph
    - component
    - partition
    - ownership
    - clipping
    - render
  - Require helper activation to remain explicit:
    - core modeling helpers may define normal phase output
    - ownership helpers may run only on eligible conflict components
    - clipping helpers may run only on eligible overflow fragments
  - Keep candidate preview and other phase debug surfaces debug-only until the
    corresponding phase is fully accepted.
- Consequences:
  - Future implementation work is now judged against a locked contract set
    rather than against evolving heuristic repairs.
  - Further design iteration is no longer the primary work item; execution
    discipline is.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-rebuild-plan.md`
  - `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-implementation-backlog.md`
  - `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-tdd-plan.md`

## 2026-04-14 - Inside dashed final clipping contract locked to overflow-only processing

- Context:
  - Prior clipping attempts widened scope by routing legal geometry through
    ownership/clipping helpers, causing correctness and performance regressions.
  - Review convergence established that seam, acute, high-curvature, and
    segment-transition cases must not become separate runtime legality
    algorithms.
- Decision:
  - Lock the final clipping definition to:
    - `legal_segment_piece_domain(piece)`
    - `legal_owner_domain(dash)`
    - `actual_overflow_fragment = actual geometry - legal_owner_domain`
  - Forbid proxy conditions from acting as primary legality definitions,
    including:
    - touched-segment heuristics by themselves
    - bounds-overlap heuristics by themselves
    - seam/corner radius windows by themselves
    - dash-position identity shortcuts
    - unchanged-signature shortcuts
  - Lock ownership determinism and safety controls to the documented policy:
    - same-dash continuity
    - exclusive preservation
    - centerline support distance
    - authored interval order
    - stable dash id
  - Lock clipping runtime safety to the documented controls:
    - structured benchmark storage inside the repo
    - piece/owner cache and dirty-owner reuse model
    - component-local bailout to candidate-preview passthrough
    - merge/CI enforcement for helper contracts, scenario permanence, and
      performance guards
- Consequences:
  - Final clipping is now contractually defined as overflow-only processing
    rather than as broad phase-wide legality cleanup.
  - Performance, rollback, and enforcement requirements are now part of the
    accepted inside-dashed design contract.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-rebuild-plan.md`
  - `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-implementation-backlog.md`
  - `docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-tdd-plan.md`

## 2026-04-19 - Stroke engine Phase 4 debug surfaces extended on real runtime paths

- Context:
  - Phase 4A overlap/ownership debug work is accepted and Phase 4B groundwork
    is moving from legality-only viewing toward ownership-aware legality on
    constrained solid geometry.
  - The selected-element debug surfaces need to stay attached to the real
    promoted runtime packets so future ownership/clipping work can be judged on
    live geometry instead of helper-only snapshots.
- Decision:
  - Keep Phase 4A accepted with real `dashed + center` overlap/ownership/bailout
    overlays on the selected-element render-layer path.
  - Extend Phase 4B groundwork to include:
    - canonical legality-domain viewer for constrained solid geometry
    - packet-level constrained solid ownership overlay on the same selected
      element path
    - ownership-aware legality clipping helper routing for constrained solid
      packets, with the current promoted slice preserving packets byte-for-byte
      when no overflow is eligible
  - Lock the current groundwork closeout to:
    - `apps/asyra-design/e2e/center-dashed-overlap-visual.spec.ts`
    - `apps/asyra-design/e2e/constrained-solid-legality-visual.spec.ts`
    - `yarn workspace @asyra/preset test:local`
- Consequences:
  - Phase 4 debug inspection now covers both promoted dashed-center overlap work
    and the current constrained-solid legality groundwork on real runtime
    packets.
  - Ownership-aware legality/clipping implementation can build on the same
    debug surfaces without introducing helper-only viewer paths.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/center-dashed-overlap-ownership-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/constrained-solid-ownership-legality-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-19 - Phase 4B vector ownership diagnostics require graphic-local id stability

- Context:
  - Phase 4B groundwork now merges constrained solid legality/ownership
    diagnostics from multiple vector networks onto one selected graphic.
  - Per-network ownership diagnostics reused local ids such as `candidate:0`
    and `component:0`, which caused collisions after graphic-level merge even
    though each network was deterministic in isolation.
- Decision:
  - Treat multi-network vector ownership diagnostics as one graphic-local
    namespace.
  - Re-id merged constrained ownership diagnostics deterministically with a
    network-scoped prefix before attaching them to the runtime graphic.
  - Add package-level tests that fail when candidate/component/region ids
    collide after merge.
- Consequences:
  - Phase 4B ownership/clipping work can build on merged vector diagnostics
    without ambiguous ids.
  - Future ownership-aware clipping and debug overlays no longer depend on
    accidental per-network id separation.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-ownership-legality-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-20 - Phase 4B exact owner-domain groundwork now supports orthogonal non-convex single-polygon candidates

- Problem:
  - Phase 4B exact candidate-set ownership regions already handled convex
    components and mixed-topology candidates built from multiple convex packet
    polygons.
  - That still left a bounded but important gap: a single orthogonal
    non-convex packet polygon could overlap a convex packet, but the ownership
    path collapsed the shared region into one surrogate polygon instead of the
    deterministic exact rectangles implied by the orthogonal shape.
- Decision:
  - Add a bounded normalization step in
    `constrained-solid-ownership-diagnostics.ts`:
    orthogonal non-convex single-polygon candidates are decomposed into
    deterministic canonical rectangles before exact candidate-set intersection
    runs.
  - Keep this explicitly scoped to orthogonal single-polygon candidates;
    broader general non-convex boolean support is still future work.
- Impact:
  - Exact owner-domain regions for orthogonal non-convex packets now remain on
    the same exact-subset path as convex candidates.
  - Clipping can subtract foreign-owned exact regions from convex packets while
    preserving the correct local remainder, instead of relying on surrogate
    whole-polygon ownership.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-ownership-legality-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-20 - Phase 4B clipping now supports orthogonal non-convex packet subtraction in a bounded slice

- Problem:
  - After exact candidate-set ownership regions were available for orthogonal
    non-convex single-polygon candidates, clipping still treated the packet
    polygon as one non-convex minuend.
  - That preserved incorrect non-convex remainders instead of the canonical
    disconnected local sectors implied by the exact shared regions.
- Decision:
  - Reuse the same bounded normalization strategy in
    `constrained-solid-legality-clipping.ts`:
    orthogonal non-convex packet polygons are decomposed into deterministic
    canonical rectangles before foreign-owned exact candidate-set subtraction.
  - Keep this scoped to orthogonal packets only; broader general non-convex
    polygon subtraction remains out of scope.
- Impact:
  - Orthogonal non-convex outside packets can now subtract foreign-owned exact
    regions while preserving disconnected local remainders.
  - This extends the exact-subset owner-domain clipping path without claiming
    general polygon-boolean support.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-ownership-legality-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-20 - Phase 4B exact owner-domain groundwork now covers mixed-topology candidates with orthogonal non-convex packet pieces

- Problem:
  - Phase 4B exact candidate-set ownership regions already covered:
    - convex multi-candidate components
    - mixed-topology candidates built from multiple convex packet polygons
    - orthogonal non-convex single-polygon candidates
  - The remaining bounded gap was the combined case: one mixed-topology
    candidate containing both convex packet polygons and orthogonal non-convex
    packet pieces.
- Decision:
  - Formalize this combination on the same exact candidate-set owner-domain
    path.
  - Reuse the existing orthogonal non-convex canonical rectangle
    decomposition per packet piece rather than introducing broader boolean
    ownership logic.
- Impact:
  - Mixed-topology candidates with orthogonal non-convex pieces now have an
    explicit deterministic ownership contract.
  - This extends the owner-domain groundwork without claiming general
    mixed-topology subtraction or general non-convex clipping support.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-ownership-legality-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-20 - Phase 4B clipping now covers mixed-topology packets whose non-owner packet includes orthogonal non-convex pieces

- Problem:
  - Phase 4B clipping already supported:
    - convex packet subtraction
    - orthogonal non-convex packet subtraction
    - mixed-topology packets composed from convex packet polygons
  - The next bounded gap was the combination of the last two: a mixed-topology
    packet where the non-owner side includes an orthogonal non-convex piece.
- Decision:
  - Keep the clipping path bounded and reuse the same orthogonal canonical
    rectangle decomposition already used for non-convex packet subtraction.
  - Do not expand this into broader mixed-topology boolean subtraction or
    general non-convex polygon support.
- Impact:
  - Mixed-topology packet subtraction now stays on the exact candidate-set
    owner-domain path even when the non-owner packet includes an orthogonal
    non-convex piece.
  - This advances 4B clipping without changing the declared limit that broader
    mixed-topology / general non-convex subtraction is still future work.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-ownership-legality-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-19 - Phase 4B convex outside corner-overflow clipping now partitions complement sectors without overlap

- Context:
  - Helper-level outside clipping already handled convex single-edge overflow,
    but corner overflow still decomposed into overlapping outside polygons.
  - That preserved acceptable opaque output in narrow cases while still
    violating canonical packet structure through duplicate coverage inside the
    same packet.
- Decision:
  - Extend the convex outside complement helper so corner overflow is emitted as
    deterministic disjoint sectors rather than overlapping outside polygons.
  - Keep this scoped to convex canonical boundaries; do not imply broader
    non-convex or general owner-domain subtraction support.
- Consequences:
  - Phase 4B outside groundwork now has a cleaner canonical packet form for
    corner overflow before broader owner-domain subtraction is attempted.
  - This remains a helper-level complement partition slice, not full outside
    complement clipping closeout.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-ownership-legality-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-19 - Phase 4B two-candidate convex ownership components now emit canonical shared overlap regions

- Context:
  - Ownership diagnostics originally emitted surrogate regions by reusing full
    candidate polygons whenever packets overlapped.
  - That was sufficient for early overlays, but it did not satisfy Phase 4B's
    owner-domain intent for simple two-candidate convex overlap components.
- Decision:
  - Promote a bounded ownership-region slice:
    - when a component contains exactly two convex candidates, emit canonical
      shared overlap polygons from their geometric intersections
    - keep multi-candidate components on the existing surrogate fallback for now
- Consequences:
  - Phase 4B now has a more faithful owner-domain basis for simple two-stroke
    convex overlaps without overstating support for general multi-candidate
    region construction.
  - This remains incremental groundwork, not full owner-domain closeout.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-ownership-legality-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-19 - Phase 4B nested convex multi-candidate ownership components now collapse to canonical all-candidate shared regions

- Context:
  - Two-candidate convex overlap components were already upgraded from
    surrogate owner polygons to canonical shared overlap regions.
  - Nested three-stroke outside overlaps still emitted one surrogate region per
    candidate polygon, even when all candidates shared the same common overlap
    corridor.
- Decision:
  - Extend the canonical overlap-region slice so nested convex multi-candidate
    components emit shared all-candidate overlap polygons whenever a common
    intersection exists across the whole component.
  - Keep broader non-nested or mixed-topology multi-candidate ownership-region
    construction as future work.
- Consequences:
  - Phase 4B now has a cleaner owner-domain basis for nested concentric
    constrained solid overlaps before general owner-domain subtraction is
    attempted.
  - This remains incremental groundwork, not final multi-candidate ownership
    closeout.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-ownership-legality-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-19 - Phase 4B clipping helper expanded with explicit outside sub-slice

- Context:
  - Phase 4B constrained packets already route through the ownership-aware
    legality clipping helper, but outside-mode clipping remained an implicit
    no-op with no declared intermediate support boundary.
  - The groundwork needs an explicit small-scope step forward without implying
    that full complement-domain clipping is solved.
- Decision:
  - Keep inside overflow clipping enabled at helper level.
  - Add one declared outside clipping sub-slice at helper level:
    - convex canonical legality boundary
    - single-edge overflow semantics
    - boundary-touching legal outside packets remain unchanged
  - Record this as incremental helper support, not as full promoted outside
    clipping.
- Consequences:
  - Phase 4B can continue advancing clipping semantics in bounded slices rather
    than jumping directly from no-op outside routing to full complement-domain
    clipping.
  - Future outside clipping work must declare broader topology/complement scope
    explicitly before claiming promotion.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-ownership-legality-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-19 - Phase 4B owner-domain clipping entered final packets in a narrow slice

- Context:
  - Phase 4B had legality diagnostics, ownership diagnostics, and helper-level
    overflow clipping, but ownership had not yet changed final constrained
    packets.
  - Full polygon subtraction is still too broad to promote safely in one step.
- Decision:
  - Introduce the first narrow owner-domain clipping slice:
    - if an outside constrained packet polygon is exactly matched by a foreign-
      owned ownership region, drop that polygon from the final packet
    - keep this limited to exact polygon matches; do not imply general polygon
      subtraction yet
- Consequences:
  - Ownership now affects final constrained geometry in a bounded, testable
    way.
  - Phase 4B still does not claim full owner-domain clipping; broader
    subtraction remains future work.
  - A real app-path visual benchmark now locks the visible consequence:
    owner stroke remains visible while exact foreign-owned outside polygons
    remain absent from the final render.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-ownership-legality-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-19 - Phase 4B convex multi-candidate owner domains gained exact subset regions

- Context:
  - Phase 4B ownership diagnostics already emitted canonical shared overlap
    polygons for two-candidate convex components.
  - Nested three-candidate convex components had partial support, but broader
    multi-candidate exact-subset ownership was not yet stated clearly.
  - Clipping could drop exact foreign-owned polygons, but it could not yet
    subtract foreign-owned convex subregions while preserving the owner-domain
    remainder.
- Decision:
  - Promote convex multi-candidate ownership diagnostics to exact
    candidate-set semantics for:
    - nested shared-overlap cases
    - partial-overlap cases without a shared all-candidate region
  - Upgrade constrained outside clipping so convex packets can subtract
    foreign-owned exact candidate-set subregions and preserve the remaining
    owner-domain polygons.
- Consequences:
  - Phase 4B can now express and clip convex owner domains beyond exact
    whole-polygon removal.
  - The same exact-subset path now stays deterministic through four-candidate
    partial-overlap chain and branch components, not only nested
    three-candidate cases.
  - Mixed-topology candidates composed from multiple convex packet polygons
    can now remain on the same exact-subset owner-domain path without
    collapsing back to surrogate full-owner regions.
  - Broader mixed-topology or non-convex owner-domain subtraction remains
    future work and is still out of scope for the current groundwork slice.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-ownership-legality-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-20 - Phase 4B bounded support now covers non-orthogonal non-convex single-polygon owner domains

- Context:
  - Phase 4B already supported convex exact candidate-set regions, orthogonal
    non-convex single-polygon candidates via canonical rectangle decomposition,
    and mixed-topology packets that still stayed on that bounded orthogonal
    path.
  - The remaining bounded single-polygon gap was a simple non-orthogonal
    non-convex packet, which still fell back to the generic surrogate path
    because it could not enter the existing convex intersection/subtraction
    route deterministically.
- Decision:
  - Add deterministic bounded ear decomposition for non-orthogonal simple
    non-convex single polygons so they can enter the same exact candidate-set
    ownership path as convex pieces.
  - Keep the scope narrow:
    - single-polygon non-orthogonal non-convex candidates
    - deterministic convex-triangle decomposition only
    - no claim of general polygon-boolean support
  - Formalize the matching clipping sub-slice only for the bounded case where
    exact foreign-owned regions cover the whole non-owner packet, allowing a
    full packet drop on that same ear-decomposition path.
- Consequences:
  - Phase 4B now formally supports deterministic exact ownership regions for
    bounded non-orthogonal non-convex single polygons.
  - The matching bounded clipping path can now drop a non-owner packet
    wholesale when exact foreign-owned regions cover the entire packet.
  - Broader mixed-topology subtraction and broader general non-convex
    owner-domain construction remain future work.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-ownership-legality-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-20 - Phase 4B bounded support now covers mixed-topology packets with non-orthogonal non-convex pieces

- Context:
  - Phase 4B already had bounded support for:
    - mixed-topology packets with orthogonal non-convex pieces
    - non-orthogonal non-convex single-polygon packets via deterministic
      ear decomposition
  - The remaining nearby gap was the combination of the two: a mixed-topology
    packet containing both convex pieces and non-orthogonal non-convex pieces.
- Decision:
  - Reuse the same bounded ear-decomposition path for non-orthogonal
    non-convex pieces inside a mixed-topology packet.
  - Keep the supported clipping slice narrow:
    - exact candidate-set ownership only
    - whole-packet drop only when exact foreign-owned regions cover all packet
      pieces
    - no claim of broader mixed-topology boolean subtraction
- Consequences:
  - Mixed-topology packets that include non-orthogonal non-convex pieces now
    have deterministic exact ownership regions on the same bounded
    ear-decomposition path.
  - The matching bounded clipping path can now:
    - subtract foreign-owned exact candidate-set regions while preserving
      disconnected owner-domain remainders
    - drop a non-owner mixed-topology packet wholesale when those exact
      foreign-owned regions cover every packet piece
  - Broader mixed-topology subtraction and broader general non-convex
    owner-domain construction remain future work.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-ownership-legality-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-20 - Phase 4B bounded support now covers mixed-topology packets with multiple non-orthogonal non-convex pieces

- Context:
  - Phase 4B already supported mixed-topology packets with a single
    non-orthogonal non-convex piece on the bounded ear-decomposition path.
  - The remaining nearby bounded gap was the same topology class but with
    multiple non-orthogonal non-convex pieces inside one packet.
- Decision:
  - Reuse the same deterministic bounded ear-decomposition path per piece.
  - Promote bounded support for:
    - deterministic exact ownership regions across all packet pieces
    - partial foreign-owned subtraction while preserving disconnected
      owner-domain remainders
  - Keep this explicitly out of general polygon-boolean territory.
- Consequences:
  - Mixed-topology packets with multiple non-orthogonal non-convex pieces now
    stay on the same bounded exact candidate-set owner-domain route.
  - The matching clipping path can now subtract foreign-owned exact
    candidate-set regions while preserving disconnected owner-domain
    remainders across all such packet pieces.
  - Broader mixed-topology subtraction and broader general non-convex
    owner-domain construction remain future work.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-ownership-legality-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-20 - Bounded expansion stop rule adopted for scenario-matrix rollout work

- Context:
  - Bounded slice expansion is useful for safe rollout, but if left unchecked
    it can degrade into endless micro-slice growth without ever declaring the
    algorithm-class boundary explicitly.
  - Phase 4B is already close to the point where the remaining gaps are no
    longer bounded-normalization work and instead point toward broader general
    boolean-style algorithms.
- Decision:
  - Adopt a bounded expansion stop rule at the platform rule level and in the
    Phase 4B scenario/execution docs.
  - Allow bounded expansion only while the next slice still fits the declared
    algorithm class and meaningfully reduces the unsupported scenario frontier.
  - Require a new plan or explicit next-phase algorithm once the remaining
    work crosses into broader mixed-topology subtraction, broader general
    non-convex owner-domain construction, or general polygon-boolean
    semantics.
- Consequences:
  - Future rollout work has an explicit stop condition instead of open-ended
    micro-slice growth.
  - Phase 4B can continue safely up to its declared bounded frontier, but it
    may not silently absorb a new algorithm class.
- Related Plan:
  - `docs/ai/apps/asyra-design/rules/scenario-matrix-testing.md`
  - `docs/ai/apps/asyra-design/plans/constrained-solid-ownership-legality-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-20 - Constrained solid broader owner-domain work split into a new algorithm-class plan

- Context:
  - Phase 4B bounded expansion now has an explicit stop rule.
  - The remaining unsupported constrained solid legality work is no longer a
    bounded extension of the current convex / rectangle-decomposition /
    bounded-ear-decomposition class.
  - Continuing under Phase 4B would blur the boundary between bounded support
    and broader polygon-boolean-class work.
- Decision:
  - Create a new next-phase algorithm plan:
    - `docs/ai/apps/asyra-design/plans/constrained-solid-general-owner-domain-plan.md`
  - Define broader mixed-topology subtraction, broader general non-convex
    owner-domain construction, and broader product-facing visual gates there
    instead of continuing Phase 4B micro-slice expansion.
- Consequences:
  - Phase 4B remains the bounded groundwork and bounded-support plan.
  - Further constrained solid ownership / legality rollout must hand off to
    the new broader algorithm-class plan once the bounded stop condition is
    reached.
  - Future work is now tracked without pretending that broader boolean-class
    support is merely another 4B bounded slice.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-ownership-legality-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/constrained-solid-general-owner-domain-plan.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-20 - First broader constrained-solid owner-domain scenario promoted beyond the former four-candidate cap

- Context:
  - The new broader constrained-solid owner-domain plan had been created, but
    no promoted scenario had yet crossed the former `<=4` exact candidate-set
    boundary in runtime-backed tests.
  - The clearest explicit algorithm boundary in code was the
    `componentCandidates.length <= 4` gate inside constrained solid ownership
    diagnostics.
- Decision:
  - Promote the first broader scenario under the new plan:
    - deterministic exact candidate-set ownership for nested five-candidate
      constrained solid components
  - Keep the expansion narrow:
    - nested convex component
    - exact candidate-set owner-domain only
    - no claim of broader mixed-topology or general polygon-boolean support
- Consequences:
  - The new algorithm-class plan now has a real promoted scenario with both
    unit and app-path visual coverage.
  - The first broader owner-domain slice is no longer only a document stub;
    runtime-backed tests now prove behavior beyond the former four-candidate
    cap.
  - Broader mixed-topology subtraction and broader non-convex owner-domain
    construction remain future work under the same new plan.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-general-owner-domain-plan.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 4C closes the bounded Family C outside representative pair with `rect + outside + miter`

- Context:
  - Phase 4C had already promoted the bounded Family C exterior representative
    for `rect + outside + bevel`.
  - The next smallest uncovered slice in the same algorithm class was the
    matching `rect + outside + miter` representative on the same orthogonal
    corner-spanning fixture.
- Decision:
  - Promote the next bounded Family C constrained dashed product slice for:
    - shape-generated `rect`
    - `position: outside`
    - `join: miter`
    - one corner-spanning visible constrained dashed interval on a closed path
  - Keep this promotion runtime-local to the `rect` path through the same
    constrained dashed helper opt-in pattern.
  - Keep the remaining Family C frontier blocked:
    - vector/oval corner-spanning remains blocked
- Consequences:
  - Phase 4C now closes the current bounded exterior representative pair for
    shape-generated `rect`:
    - `outside + bevel`
    - `outside + miter`
  - This still does not claim that generic non-rect or vector-generated
    corner-spanning ownership is complete.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-26 - Stroke engine plan targets formal Figma-like uniform-width completion

- Context:
  - The product expectation for the current stroke-engine plan is not a
    representative-only demo matrix.
  - Variable width and broader paint/color rollout are intentionally excluded
    from the current execution target, but uniform-width stroke behavior should
    converge toward the baseline users expect from tools such as Figma.
- Decision:
  - Treat the current formal target as Figma-like uniform-width stroke
    completion for supported Asyra Design shape/vector paths.
  - Keep the plan focused on:
    - `inside` / `outside` / `center`
    - `solid` / `dashed`
    - stroke width
    - dash pattern and dash offset
    - `miter` / `bevel` / `round` joins
    - `butt` / `square` / `round` caps
    - render / hit-test / export parity for promoted geometry packets
  - Keep paint/color expansion, including broader gradient rollout, and
    variable-width rollout as future-feature work.
- Consequences:
  - Bounded slices are still the implementation method, but they cannot be used
    to permanently defer a baseline uniform-width stroke behavior.
  - Open gaps in round joins, caps, dash positioning, or constrained placement
    remain active product gaps until completed or explicitly re-scoped by the
    user.
  - The self-review and bounded expansion rules still apply before expanding
    an edge case beyond the declared uniform-width target.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-plan.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-26 - Closed single-network repeated dashed vectors promote from visibility fallback to constrained placement

- Context:
  - Manual testing confirmed that switching a closed vector from `center`
    dashed stroke to `inside` / `outside` no longer disappeared, but the
    visible stroke stayed in the centered position.
  - The plan had incorrectly treated simple closed repeated-dash switching as
    a visibility fallback, while the product expectation is that closed-path
    `inside` / `outside` changes placement.
  - Runtime also had a second gate that discarded constrained dashed packets
    whenever more than one visible interval was produced.
- Decision:
  - Allow multiple constrained dashed packets when they belong to the same
    network and the same stroke row.
  - Keep multi-network / multi-stroke constrained dashed ownership blocked.
  - Promote simple closed single-network repeated dashed vectors to constrained
    `inside` / `outside` placement when the closed legality domain is valid.
  - Keep open-path switching on centered visibility fallback.
  - Keep true self-intersecting fill-rule constrained legality blocked until
    that domain is declared and tested explicitly.
- Consequences:
  - Closed vector repeated dashed `inside` / `outside` no longer silently falls
    back to center when constrained packets are available.
  - Product-path unit tests now assert constrained packet routing, and the
    rectangle representative asserts inside/outside bounds rather than mere
    visibility.
  - App-path visual coverage now checks that the repeated dash lands on the
    correct inside/outside side for a closed rectangle vector.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-26 - Phase 5 promotes corner-spanning round joins for uniform-width constrained dashed rectangles

- Context:
  - Phase 5 had already promoted round joins on full-loop constrained dashed
    strokes and round caps on single-edge constrained dashed strokes.
  - A common manual-testing path still remained blocked: a visible dashed
    interval crossing a rectangle corner while `joinType: round` is selected.
  - Expanding broader equivalence gates first would not unblock that product
    path.
- Decision:
  - Add helper, product-path, and app-path contracts for:
    - shape-generated `rect`
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `corner-spanning + inside + round join`
    - constrained dashed `corner-spanning + outside + round join`
  - Promote the path by allowing the existing corner-spanning legality route to
    accept `round` joins.
  - Add open-interval round-join polygon fan generation to the shared
    solid-center geometry builder so the partial dash emits visible round join
    geometry instead of an empty packet.
  - Keep the scope narrow:
    - uniform-width only
    - shape-generated `rect` and rectangle-equivalent `vector` app-path visual
      representatives only
    - no gradient, variable-width, self-intersecting, or multi-network rollout
- Consequences:
  - The common uniform-width dashed rectangle path now covers:
    - inside/outside placement
    - full-loop round joins
    - single-edge round caps
    - corner-spanning round joins
  - App-path runtime was synchronized in `packages/preset/dist` to avoid
    source/dist drift.
  - Broader non-rectangle-equivalent source equivalence for corner-spanning
    round joins remains backlog unless manual testing exposes a product blocker.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-26 - Phase 5 closes the outside round-cap shape/vector equivalence gate for uniform-width constrained dashed strokes

- Context:
  - Phase 5 had already promoted the bounded `single-edge + outside + round
    cap` constrained dashed product path across:
    - shape-generated `rect`
    - closed single-network rectangle-equivalent `vector`
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
  - The next honest work item was the matching Family D closeout for the
    rectangle-equivalent shape/vector source pair.
- Decision:
  - Add product-path and app-path contracts for:
    - shape-generated `rect`
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `single-edge + outside + round cap`
  - Keep the gate narrow:
    - rectangle-equivalent source pair only
    - uniform-width only
    - single-edge only
    - outside position only
    - round cap only
    - no gradient or variable-width rollout
- Consequences:
  - Phase 5 now has matching Family D evidence for both inside and outside
    round-cap single-edge constrained dashed coverage.
  - The active plan remains focused on the common uniform-width dashed / round
    matrix.
  - Gradient expansion and variable-width product rollout remain future-feature
    work.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-25 - Phase 5 adds the first shape-generated outside round-cap constrained dashed representative on the bounded product path

- Context:
  - Active execution was narrowed to uniform-width stroke completion, with
    `dashed`, `inside` / `outside`, and `round` joins / caps as the next
    user-facing priority.
  - The next missing user-facing slice was not another `inside` closeout, but
    the first honest `outside + round` representative on the shape-generated
    path.
  - `outside + round join` would have required a larger geometry expansion
    because the current bounded helper only promotes inside full-loop round
    joins through a temporary miter-backed path.
  - The narrower and more honest next slice was:
    - shape-generated `rect`
    - constrained dashed `single-edge + outside + round cap`
- Decision:
  - Promote the next Phase 5 representative with helper-level, product-path,
    and app-path contracts for:
    - shape-generated `rect`
    - constrained dashed `single-edge + outside + round cap`
  - Keep this promotion narrow:
    - shape-generated `rect` only
    - `single-edge` only
    - `position: outside` only
    - `cap: round` only
    - no vector-generated `outside + round cap` claim
    - no `outside + round join` claim
- Consequences:
  - Phase 5 now reaches the first user-facing `outside + dashed + round`
    representative on the bounded product path without expanding the geometry
    engine into a broader round-join frontier.
  - This confirms that the existing clipped center-cap path already supports
    the first outside round-cap slice on the shape-generated path.
  - Vector-generated outside round caps and outside round joins remain blocked
    pending later bounded promotion.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`
  - `docs/ai/apps/asyra-design/PLANS.md`

## 2026-04-25 - Uniform-width stroke completion becomes the active rollout priority, while gradient and variable width move to future-feature status

- Context:
  - The execution plan had already accumulated exploratory Phase 6 gradient
    slices and Phase 7 pre-promotion probes.
  - Product priority was then narrowed explicitly:
    - finish uniform-width stroke behavior first
    - prioritize `dashed`, `inside` / `outside`, and `round` joins / caps
    - stop spending the current execution window on gradient expansion or
      variable-width rollout
  - The architecture still needs to remain extensible for later gradient and
    variable-width work, but those phases no longer define the active critical
    path.
- Decision:
  - Re-scope the active rollout to uniform-width stroke completion only.
  - Treat paint/color expansion, including broader gradient rollout, and
    variable-width rollout as future-feature work for the current plan.
  - Keep the already-recorded Phase 6 / Phase 7 notes as historical evidence
    and backlog, but do not let them outrank unfinished user-facing
    uniform-width round / dashed work.
  - Use Figma-like uniform-width stroke behavior as the formal
    slice-selection target:
    - `inside` / `outside` / `center`
    - `solid` / `dashed`
    - dash pattern and dash offset
    - `miter` / `bevel` / `round` joins
    - `butt` / `square` / `round` caps
- Consequences:
  - The plan is now smaller than the full architecture because the active
    frontier no longer includes paint/color expansion or variable-width
    promotion, but it remains a formal uniform-width completion plan.
  - Future scope decisions must prefer unfinished uniform-width user-facing
    blockers before returning to gradient or width expansion.
  - Variable width still requires an extensible contract later, but it is no
    longer a current-phase deliverable.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-plan.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`
  - `docs/ai/apps/asyra-design/PLANS.md`

## 2026-04-25 - Phase 5 adds the first rectangle-equivalent vector outside round-cap constrained dashed representative on the bounded product path

- Context:
  - Active execution now prioritizes uniform-width user-facing stroke
    completion, especially `dashed`, `inside` / `outside`, and `round`.
  - The shape-generated `rect + single-edge + outside + round cap`
    representative had already been promoted.
  - The next honest downstream move was not to widen the family to broader
    vectors or outside round joins, but to carry the same slice onto the first
    rectangle-equivalent vector source frontier.
- Decision:
  - Promote the next Phase 5 representative with helper-level, product-path,
    and app-path contracts for:
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `single-edge + outside + round cap`
  - Keep this promotion narrow:
    - rectangle-equivalent `vector` only
    - `single-edge` only
    - `position: outside` only
    - `cap: round` only
    - no broader non-rectangle-equivalent vector claim
    - no `outside + round join` claim
- Consequences:
  - Phase 5 now extends the first user-facing outside round-cap slice onto the
    first vector-generated source frontier instead of staying on shape-only
    rollout.
  - This confirms that the existing clipped center-cap path already supports
    the first rectangle-equivalent vector outside round-cap slice without a
    new geometry branch.
  - Broader vector outside round caps and outside round joins remain blocked
    pending later bounded promotion.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`
  - `docs/ai/apps/asyra-design/PLANS.md`

## 2026-04-25 - Phase 5 adds the first broader vector outside round-cap constrained dashed representative on the bounded product path

- Context:
  - Uniform-width rollout continues to prioritize user-facing `dashed`,
    `inside` / `outside`, and `round`.
  - The shape-generated and rectangle-equivalent vector
    `single-edge + outside + round cap` representatives were already
    promoted.
  - The next honest downstream move was not to widen into `outside + round
    join`, but to carry the same outside round-cap slice onto the first
    broader non-rectangle-equivalent vector source frontier.
- Decision:
  - Promote the next broader Phase 5 representative with helper-level,
    product-path, and app-path contracts for:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
    - constrained dashed `single-edge + outside + round cap`
  - Keep this promotion narrow:
    - broader non-rectangle-equivalent `vector` only
    - `single-edge` only
    - `position: outside` only
    - `cap: round` only
    - no `outside + round join` claim
    - no broader equivalence gate claim
- Consequences:
  - Phase 5 now carries the outside round-cap slice through the first broader
    vector-generated source frontier instead of stopping at the
    rectangle-equivalent vector pair.
  - This confirms that the same clipped center-cap path remains valid on the
    first broader outside interval without introducing a new geometry branch.
  - `outside + round join` and broader round equivalence gates remain blocked
    pending later bounded promotion.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`
  - `docs/ai/apps/asyra-design/PLANS.md`

## 2026-04-25 - Phase 5 adds the first shape-generated outside round-join constrained dashed representative on the bounded product path

- Context:
  - Uniform-width rollout is still prioritizing user-facing `dashed`,
    `inside` / `outside`, and `round`.
  - Outside round caps had already been promoted across:
    - shape-generated `rect`
    - rectangle-equivalent `vector`
    - broader non-rectangle-equivalent `vector`
  - The next honest missing round slice on the common design-tool matrix was
    not another cap expansion, but the first shape-generated
    `full-loop + outside + round join` representative.
- Decision:
  - Promote the next Phase 5 representative with helper-level, product-path,
    and app-path contracts for:
    - shape-generated `rect`
    - constrained dashed `full-loop + outside + round join`
  - Keep this promotion narrow:
    - shape-generated `rect` only
    - `full-loop` only
    - `position: outside` only
    - `join: round` only
    - no vector-generated outside round-join claim
    - no outside round-join equivalence gate claim
- Consequences:
  - Phase 5 now reaches the first user-facing `outside + dashed + round join`
    representative on the bounded product path.
  - This confirms that the current bounded full-loop round-join path can carry
    the first outside shape slice without introducing a new public interface.
  - Vector-generated outside round joins and broader round equivalence gates
    remain blocked pending later bounded promotion.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`
  - `docs/ai/apps/asyra-design/PLANS.md`

## 2026-04-25 - Phase 5 adds the first rectangle-equivalent vector outside round-join constrained dashed representative on the bounded product path

- Context:
  - Uniform-width rollout continues to prioritize the common design-tool stroke
    matrix over deeper future-feature work.
  - The shape-generated `rect + full-loop + outside + round join`
    representative had already been promoted.
  - The next honest downstream move was not to jump to broader vectors, but to
    carry the same outside round-join slice onto the first
    rectangle-equivalent vector source frontier.
- Decision:
  - Promote the next Phase 5 representative with helper-level, product-path,
    and app-path contracts for:
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `full-loop + outside + round join`
  - Keep this promotion narrow:
    - rectangle-equivalent `vector` only
    - `full-loop` only
    - `position: outside` only
    - `join: round` only
    - no broader vector outside round-join claim
    - no outside round-join equivalence gate claim
- Consequences:
  - Phase 5 now extends the first outside round-join slice onto the first
    vector-generated source frontier instead of stopping at shape-only
    coverage.
  - This confirms that the bounded full-loop round-join path survives the
    first rectangle-equivalent vector outside slice without a new public
    interface or new geometry engine.
  - Broader vector outside round joins and round equivalence gates remain
    blocked pending later bounded promotion.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`
  - `docs/ai/apps/asyra-design/PLANS.md`

## 2026-04-25 - Phase 5 adds the first broader vector outside round-join constrained dashed representative on the bounded product path

- Context:
  - Uniform-width rollout is still converging on the common design-tool stroke
    matrix.
  - Outside round joins had already been promoted on:
    - shape-generated `rect`
    - rectangle-equivalent `vector`
  - The next honest downstream move was not an equivalence gate, but carrying
    the same outside round-join slice onto the first broader
    non-rectangle-equivalent vector source frontier.
- Decision:
  - Promote the next broader Phase 5 representative with helper-level,
    product-path, and app-path contracts for:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
    - constrained dashed `full-loop + outside + round join`
  - Keep this promotion narrow:
    - broader non-rectangle-equivalent `vector` only
    - `full-loop` only
    - `position: outside` only
    - `join: round` only
    - no equivalence gate claim
    - no additional topology expansion claim
- Consequences:
  - Phase 5 now carries the outside round-join slice through the first broader
    vector-generated source frontier instead of stopping at the
    rectangle-equivalent pair.
  - This confirms that the same bounded full-loop round-join path survives the
    first broader outside slice without a new geometry engine.
  - Round-join equivalence gates beyond the existing inside gate remain
    blocked pending later bounded promotion.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`
  - `docs/ai/apps/asyra-design/PLANS.md`

## 2026-04-25 - Stroke rollout adopts mandatory pre-expansion self-review and clarifies gradient responsibility boundaries

- Context:
  - Repeated bounded rollout work had already shown that the real failure mode
    was not missing micro-slices by itself, but expanding the current phase
    without re-checking whether the expansion actually unblocked downstream
    phases.
  - Phase 6 gradient work also needed an explicit responsibility boundary so
    stroke geometry would not start absorbing paint behavior.
- Decision:
  - Make the following self-review mandatory before every edge-case or scope
    expansion:
    - if this case is not handled now, which later phase would be blocked
    - whether handling the case would change any externally exposed interface
    - whether the added work exceeds `20%` of the current phase scope
  - Enforce the resulting discipline:
    - if no later phase is blocked, move the case to backlog and keep moving
      downstream
    - if an externally exposed interface would change, stop for approval
    - if the added work exceeds `20%`, stop for approval
  - Clarify the geometry / paint boundary for gradient stroke work:
    - geometry owns final stroke-region output, geometry-side turn handling,
      and paint inputs such as bounds / UV data
    - gradient paint owns paint application, color evaluation, and sampling
      behavior
    - geometry must not absorb gradient application or color logic
- Consequences:
  - Later work is now explicitly optimized for "good enough to move
    downstream" instead of perfect edge-case completion.
  - Backlog becomes a required and valid output when a case does not block a
    later phase.
  - Phase 6 and later paint work now have a clearer boundary that keeps stroke
    geometry reusable and prevents paint-specific responsibility drift.
- Related Plan:
  - `docs/ai/apps/asyra-design/rules/scenario-matrix-testing.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-plan.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-25 - Phase 7 pre-promotion work adds the first asymmetric-width acute-join probe on the shared dashed slicer

- Context:
  - The new self-review gate showed that continuing to expand Phase 6 gradient
    representatives would not directly block later phases, because gradient is
    now explicitly paint-only.
  - Phase 7 promotion, however, is blocked until the required variable-width
    probe families exist on the shared pipeline.
  - One probe family already existed for asymmetric seam-wrap dashed slicing,
    but the required `asymmetric width + acute join` family was still missing.
- Decision:
  - Add the next smallest Phase 7 pre-promotion probe fixture on the shared
    dashed frame slicer for:
    - asymmetric width
    - one visible interval that crosses an acute join
  - Keep this work narrow:
    - probe fixture only
    - shared slicing helper only
    - no variable-width runtime promotion claim
    - no interface change
- Consequences:
  - Phase 7 preconditions now advance on the geometry side without reopening
    more Phase 6 paint expansion.
  - The shared dashed slicer is now explicitly guarded against assuming uniform
    width across both seam-wrap and acute-join interval slicing.
  - Variable-width runtime promotion, ownership probes, and constrained
    `inside` / `outside` asymmetric-width probes remain future work.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-25 - Phase 7 pre-promotion work adds the first asymmetric-width dashed-overlap probe on the shared overlap graph

- Context:
  - The mandatory self-review showed that more Phase 6 gradient expansion would
    not directly unblock later phases, while Phase 7 is still blocked on its
    required variable-width probe families.
  - After adding seam-wrap and acute-join slicer probes, the next missing
    family in the execution plan was:
    - asymmetric width + dashed overlap
- Decision:
  - Add the next smallest Phase 7 pre-promotion probe fixture on the shared
    center-dashed overlap graph for:
    - asymmetric-width, non-rectangular overlap bands
    - deterministic overlap-component extraction independent of candidate order
  - Keep this work narrow:
    - probe fixture only
    - overlap graph only
    - no variable-width runtime promotion claim
    - no interface change
- Consequences:
  - Phase 7 preconditions now advance on the overlap side without reopening
    more Phase 6 paint work.
  - The shared dashed overlap graph is now explicitly guarded against assuming
    rectangular uniform-width bands when extracting overlap components.
  - Variable-width ownership, constrained `inside` / `outside`, and runtime
    promotion remain future work.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-25 - Phase 7 pre-promotion work adds the first asymmetric-width inside probe on the shared legality path

- Context:
  - The mandatory self-review still pointed to Phase 7 preconditions as the
    real blocker, not further Phase 6 paint expansion.
  - After seam-wrap slicing, acute-join slicing, and dashed-overlap probes,
    the next missing required family in the execution plan was:
    - asymmetric width + `inside`
- Decision:
  - Add the next smallest Phase 7 pre-promotion probe fixture on the shared
    constrained legality path for:
    - asymmetric-width inside geometry
    - no-op legality clipping on non-overflow geometry
  - Keep this work narrow:
    - synthetic probe packet only
    - shared legality-clipping helper only
    - no variable-width runtime promotion claim
    - no interface change
- Consequences:
  - Phase 7 preconditions now advance on the constrained-inside legality side
    without starting variable-width runtime rollout.
  - The shared inside legality path is now explicitly guarded against erasing
    asymmetric non-overflow geometry just because the probe is not a uniform
    band.
  - Asymmetric-width `outside`, ownership/runtime promotion, and wider Phase 7
    rollout remain future work.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-25 - Phase 7 pre-promotion work adds the first asymmetric-width outside probe on the shared legality path

- Context:
  - The mandatory self-review still pointed to Phase 7 preconditions as the
    real blocker, not further Phase 6 paint expansion.
  - After adding seam-wrap, acute-join, dashed-overlap, and asymmetric
    `inside` probes, the next missing required family in the execution plan
    was:
    - asymmetric width + `outside`
- Decision:
  - Add the next smallest Phase 7 pre-promotion probe fixture on the shared
    constrained legality path for:
    - asymmetric-width outside geometry
    - no-op legality clipping on non-overflow geometry
  - Keep this work narrow:
    - synthetic probe packet only
    - shared legality-clipping helper only
    - no variable-width runtime promotion claim
    - no interface change
- Consequences:
  - Phase 7 preconditions now advance on the constrained-outside legality side
    without starting variable-width runtime rollout.
  - The shared outside legality path is now explicitly guarded against erasing
    asymmetric non-overflow geometry just because the probe is not a uniform
    outer band.
  - Variable-width ownership/runtime promotion remains future work.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-24 - Phase 6 adds the first vector-generated outside corner-spanning constrained dashed gradient-paint representative on the bounded product path

- Context:
  - Phase 6 had already promoted:
    - shape-generated `rect + outside + bevel + corner-spanning + local-bounds linear gradient paint`
    - closed single-network rectangle-equivalent `vector + inside + bevel + corner-spanning + local-bounds linear gradient paint`
  - Returning to `miter` on the same shape family would have kept the rollout
    on an already-sufficient geometry branch.
  - The next honest downstream source frontier was:
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `outside + bevel + corner-spanning + local-bounds linear gradient paint`
- Decision:
  - Promote the next vector-generated Phase 6 representative with product-path
    and app-path contracts for:
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `outside + bevel + corner-spanning + local-bounds linear gradient paint`
  - Keep this promotion narrow:
    - rectangle-equivalent `vector` only
    - corner-spanning only
    - `position: outside` only
    - `join: bevel` only
    - local-bounds linear gradient paint only
    - no broader vector-generated `outside` corner-spanning gradient claim
    - no `miter` corner-spanning gradient claim
    - no corner-spanning gradient equivalence gate claim
- Consequences:
  - Phase 6 now moves the exterior legal-turn gradient slice onto the first
    vector-generated source frontier instead of returning to more shape-side
    closure.
  - This confirms that the same paint-only gradient path survives the first
    rectangle-equivalent vector outside corner packet without adding a runtime
    branch.
  - Broader vector-generated `outside`, `miter`, corner-spanning gradient
    equivalence, and gradient-plus-variable-width slices remain blocked.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-24 - Phase 6 adds the first vector-generated single-edge constrained dashed gradient-paint representative

- Context:
  - Phase 6 had already promoted bounded `full-loop` local-bounds linear
    gradient paint on:
    - shape-generated `rect` inside/outside
    - closed single-network rectangle-equivalent `vector` inside/outside
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
      inside/outside
  - Phase 6 had also already promoted the first bounded interval-local
    single-edge gradient slice on:
    - shape-generated `rect`
    - constrained dashed `single-edge + inside + local-bounds linear gradient
      paint`
  - The next honest move was to advance to the next source frontier instead of
    staying on the same shape-generated single-edge slice.
- Decision:
  - Promote the next Phase 6 representative with product-path and app-path
    contracts for:
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `single-edge + inside + local-bounds linear gradient
      paint`
  - Keep this promotion narrow:
    - rectangle-equivalent `vector` only
    - single-edge only
    - `position: inside` only
    - local-bounds linear gradient paint only
    - no broader vector single-edge gradient claim
    - no `outside` single-edge gradient claim
    - no corner-spanning gradient claim
- Consequences:
  - Phase 6 now reaches its first vector-generated interval-local single-edge
    gradient-paint slice instead of returning to the same shape-only frontier.
  - This confirms the existing paint-only gradient path survives the first
    bounded vector-generated single-edge representative without adding a new
    stroke-runtime branch.
  - Broader vector-generated and `outside` single-edge gradient paint,
    corner-spanning gradient paint, broader gradient equivalence gates, and
    gradient-plus-variable-width slices remain blocked.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-24 - Phase 6 adds the first broader vector-generated single-edge constrained dashed gradient-paint representative

- Context:
  - Phase 6 had already promoted bounded `full-loop` local-bounds linear
    gradient paint on:
    - shape-generated `rect` inside/outside
    - closed single-network rectangle-equivalent `vector` inside/outside
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
      inside/outside
  - Phase 6 had also already promoted bounded interval-local single-edge
    gradient paint on:
    - shape-generated `rect`
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `single-edge + inside + local-bounds linear gradient paint`
  - The next honest move was to advance to the next broader source frontier
    instead of stopping on the rectangle-equivalent vector pair.
- Decision:
  - Promote the next broader Phase 6 representative with product-path and
    app-path contracts for:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
    - constrained dashed `single-edge + inside + local-bounds linear gradient
      paint`
  - Keep this promotion narrow:
    - broader non-rectangle-equivalent quadrilateral `vector` only
    - single-edge only
    - `position: inside` only
    - local-bounds linear gradient paint only
    - no `outside` single-edge gradient claim
    - no corner-spanning gradient claim
- Consequences:
  - Phase 6 now reaches its first broader vector-generated interval-local
    single-edge gradient-paint slice instead of stopping on the
    rectangle-equivalent vector source family.
  - This confirms the existing paint-only gradient path survives the first
    broader non-rectangle-equivalent single-edge representative without adding
    a new stroke-runtime branch.
  - `Outside` single-edge gradient paint, corner-spanning gradient paint,
    broader gradient equivalence gates, and gradient-plus-variable-width
    slices remain blocked.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-24 - Phase 6 adds the first outside single-edge constrained dashed gradient-paint representative

- Context:
  - Phase 6 had already promoted bounded single-edge local-bounds linear
    gradient paint on:
    - shape-generated `rect + inside`
    - closed single-network rectangle-equivalent `vector + inside`
    - closed single-network non-rectangle-equivalent quadrilateral `vector + inside`
  - The next honest move was not to close a single-edge gradient equivalence
    gate on the same `inside` family.
  - The next downstream geometry frontier on the same paint-only path was:
    - shape-generated `rect`
    - constrained dashed `single-edge + outside + local-bounds linear gradient paint`
- Decision:
  - Promote the next Phase 6 representative with product-path and app-path
    contracts for:
    - shape-generated `rect`
    - constrained dashed `single-edge + outside + local-bounds linear gradient paint`
  - Keep this promotion narrow:
    - shape-generated `rect` only
    - single-edge only
    - `position: outside` only
    - local-bounds linear gradient paint only
    - no vector-generated `outside` single-edge gradient claim
    - no corner-spanning gradient claim
- Consequences:
  - Phase 6 now reaches its first exterior interval-local single-edge
    gradient-paint slice instead of staying on the same `inside` source family.
  - This confirms the existing paint-only gradient path survives the first
    bounded outside single-edge representative without adding a new stroke-runtime
    branch.
  - Vector-generated `outside` single-edge gradient paint, corner-spanning
    gradient paint, broader gradient equivalence gates, and gradient-plus-
    variable-width slices remain blocked.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-24 - Phase 6 adds the first vector-generated outside single-edge constrained dashed gradient-paint representative

- Context:
  - Phase 6 had already promoted bounded single-edge local-bounds linear
    gradient paint on:
    - shape-generated `rect + inside/outside`
    - closed single-network rectangle-equivalent `vector + inside`
    - closed single-network non-rectangle-equivalent quadrilateral `vector + inside`
  - The next honest move was not to close a single-edge gradient equivalence
    gate on the same source family.
  - The next downstream source frontier on the same exterior interval-local
    paint-only path was:
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `single-edge + outside + local-bounds linear gradient paint`
- Decision:
  - Promote the next Phase 6 representative with product-path and app-path
    contracts for:
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `single-edge + outside + local-bounds linear gradient
      paint`
  - Keep this promotion narrow:
    - rectangle-equivalent `vector` only
    - single-edge only
    - `position: outside` only
    - local-bounds linear gradient paint only
    - no broader vector-generated `outside` single-edge gradient claim
    - no corner-spanning gradient claim
- Consequences:
  - Phase 6 now reaches its first vector-generated exterior interval-local
    single-edge gradient-paint slice instead of stopping on the shape-generated
    outside family.
  - This confirms the existing paint-only gradient path survives the first
    rectangle-equivalent vector outside single-edge representative without
    adding a new stroke-runtime branch.
  - Broader vector-generated `outside` single-edge gradient paint,
    corner-spanning gradient paint, broader gradient equivalence gates, and
    gradient-plus-variable-width slices remain blocked.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-24 - Phase 6 adds the first broader vector-generated outside single-edge constrained dashed gradient-paint representative

- Context:
  - Phase 6 had already promoted bounded single-edge local-bounds linear
    gradient paint on:
    - shape-generated `rect + inside/outside`
    - closed single-network rectangle-equivalent `vector + inside/outside`
    - closed single-network non-rectangle-equivalent quadrilateral `vector + inside`
  - The next honest move was not to stop on the rectangle-equivalent outside
    source family.
  - The next downstream source frontier on the same exterior interval-local
    paint-only path was:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
    - constrained dashed `single-edge + outside + local-bounds linear gradient paint`
- Decision:
  - Promote the next broader Phase 6 representative with product-path and
    app-path contracts for:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
    - constrained dashed `single-edge + outside + local-bounds linear gradient
      paint`
  - Keep this promotion narrow:
    - broader non-rectangle-equivalent quadrilateral `vector` only
    - single-edge only
    - `position: outside` only
    - local-bounds linear gradient paint only
    - no corner-spanning gradient claim
- Consequences:
  - Phase 6 now reaches its first broader vector-generated exterior
    interval-local single-edge gradient-paint slice instead of stopping on the
    rectangle-equivalent outside source family.
  - This confirms the existing paint-only gradient path survives the first
    broader non-rectangle-equivalent outside single-edge representative without
    adding a new stroke-runtime branch.
  - Corner-spanning gradient paint, broader gradient equivalence gates, and
    gradient-plus-variable-width slices remain blocked.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 4C promotes the first vector-generated Family C corner-spanning representative

- Context:
  - Phase 4C had already closed the bounded shape-generated `rect` Family C
    representatives for:
    - `inside + bevel/miter`
    - `outside + bevel/miter`
  - The next smallest uncovered source frontier was not `oval` or broader
    vector topology. It was one explicit closed single-network
    rectangle-equivalent `vector` representative on the same corner-spanning
    family.
  - The initial product unit failed because the vector geometry model emits a
    duplicate seam endpoint on closed loops, which caused the rect-loop
    classifier to reject a rectangle-equivalent vector path.
- Decision:
  - Promote the first vector-generated Family C constrained dashed product
    slice for:
    - closed single-network rectangle-equivalent `vector`
    - `position: inside`
    - `join: bevel`
    - one corner-spanning visible constrained dashed interval on a closed path
  - Fix the helper classifier so a closed loop with a duplicated terminal seam
    point is canonicalized before rectangle-equivalent classification.
  - Keep the rest of this frontier blocked:
    - vector `inside + miter` corner-spanning remains blocked
    - vector `outside` corner-spanning remains blocked
    - broader non-rectangle-equivalent vector corner-spanning remains blocked
- Consequences:
  - Phase 4C now proves the first vector-generated Family C representative on
    the product path without silently widening to generic vector
    corner-spanning support.
  - The classifier fix is an implementation correction, not a scenario-model
    expansion; it aligns vector rectangle-equivalent loops with the already
    declared shape/vector equivalence intent.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 4C closes the bounded vector Family C inside representative pair with `inside + miter`

- Context:
  - Phase 4C had already promoted the first vector-generated Family C
    representative for:
    - closed single-network rectangle-equivalent `vector`
    - `position: inside`
    - `join: bevel`
  - The next smallest uncovered slice in the same source/topology frontier was
    the matching `inside + miter` representative on that same
    rectangle-equivalent vector path.
- Decision:
  - Promote the next bounded vector Family C constrained dashed product slice
    for:
    - closed single-network rectangle-equivalent `vector`
    - `position: inside`
    - `join: miter`
    - one corner-spanning visible constrained dashed interval on a closed path
  - Keep the remaining vector Family C frontier blocked:
    - vector `outside` corner-spanning remains blocked
    - broader non-rectangle-equivalent vector corner-spanning remains blocked
- Consequences:
  - Phase 4C now closes the current vector-generated inside representative pair
    for the rectangle-equivalent Family C path:
    - `inside + bevel`
    - `inside + miter`
  - This still does not claim that generic vector exterior or broader vector
    corner-spanning ownership is complete.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 4C promotes the next bounded vector Family C outside bevel representative

- Context:
  - Phase 4C had already closed the bounded vector-generated Family C inside
    representative pair for the closed single-network rectangle-equivalent
    `vector` path:
    - `inside + bevel`
    - `inside + miter`
  - The next smallest uncovered slice on that same source/topology frontier
    was the matching exterior `outside + bevel` representative.
  - The first app-path failure on this slice was a false negative caused by
    Playwright reusing an older Vite dev server bundle; a fresh `127.0.0.1`
    server confirmed the current runtime already produced the expected packet
    and visual coverage.
- Decision:
  - Promote the next bounded vector Family C constrained dashed product slice
    for:
    - closed single-network rectangle-equivalent `vector`
    - `position: outside`
    - `join: bevel`
    - one corner-spanning visible constrained dashed interval on a closed path
  - Keep the remaining vector Family C frontier blocked:
    - vector `outside + miter` corner-spanning remains blocked
    - broader non-rectangle-equivalent vector corner-spanning remains blocked
- Consequences:
  - Phase 4C now extends the rectangle-equivalent vector Family C product path
    to the first exterior representative without widening to generic vector
    corner-spanning support.
  - The app-path mismatch diagnosis is recorded as server-cache drift, not as a
    constrained dashed runtime regression.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 4C closes the bounded vector Family C outside representative pair with `outside + miter`

- Context:
  - Phase 4C had already promoted the first bounded vector-generated Family C
    exterior representative for the closed single-network rectangle-equivalent
    `vector` path:
    - `outside + bevel`
  - The next smallest uncovered slice on that same source/topology frontier
    was the matching `outside + miter` representative.
- Decision:
  - Promote the next bounded vector Family C constrained dashed product slice
    for:
    - closed single-network rectangle-equivalent `vector`
    - `position: outside`
    - `join: miter`
    - one corner-spanning visible constrained dashed interval on a closed path
  - Keep the remaining vector Family C frontier blocked:
    - broader non-rectangle-equivalent vector corner-spanning remains blocked
- Consequences:
  - Phase 4C now closes the current vector-generated exterior representative
    pair for the rectangle-equivalent Family C path:
    - `outside + bevel`
    - `outside + miter`
  - This still does not claim that broader vector corner-spanning ownership or
    oval corner-spanning promotion is complete.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-21 - Broader mixed-topology subtraction now covers multiple non-orthogonal disconnected pieces

- Context:
  - The broader constrained-solid owner-domain plan already promoted
    mixed-topology subtraction on disconnected vector-generated sub-packets,
    and later extended that family to the case where one disconnected
    sub-packet is a non-orthogonal non-convex piece.
  - A remaining broader-family gap was the same subtraction behavior when
    multiple disconnected sub-packets are non-orthogonal non-convex pieces.
- Decision:
  - Promote a new broader mixed-topology subtraction scenario covering
    multiple disconnected non-orthogonal non-convex pieces on the
    vector-generated product path.
  - Add product-path and app-path benchmarks that require:
    - visible ownership coverage
    - visible primary-owner coverage
    - retained local `miter` remainder coverage on the non-owner stroke
- Consequences:
  - The broader subtraction frontier now expands by scenario family instead of
    repeating candidate-count growth.
  - Mixed-topology subtraction support is wider while still respecting the
    bounded-expansion stop rule already declared for this plan.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-general-owner-domain-plan.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-21 - Phase 4C started with a full-loop constrained dashed helper slice

- Context:
  - Phase 4B bounded groundwork is already committed at its declared stop
    boundary.
  - The next execution target is Phase 4C dashed constrained geometry, but no
    dedicated 4C scenario contract or runtime entry slice existed yet.
- Decision:
  - Start Phase 4C with a new scenario-matrix document dedicated to dashed
    constrained legality and ownership.
  - Promote one deliberately narrow helper-level slice first:
    - full-loop visible constrained dashed intervals on closed paths
  - Keep non-full-loop constrained dashed intervals explicitly blocked on this
    phase-start helper path until a later promoted slice declares them.
- Consequences:
  - Phase 4C now has a formal contract and a real executable entry slice
    without pretending the full product path is already promoted.
  - Further 4C work can now extend from a declared scenario family instead of
    ad hoc absent/present toggles.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-21 - Phase 4C first product promotion is limited to rectangle inside full-loop constrained dashed

- Context:
  - Phase 4C already had a scenario-matrix contract plus a helper-level
    full-loop constrained dashed packet builder.
  - No real product path had been promoted yet, so constrained dashed still
    had no package-level product contract or app-path benchmark.
  - Promoting both `inside` and `outside`, or promoting `vector` together with
    `rect`, would widen the supported frontier without first proving the
    smallest honest product slice.
- Decision:
  - Promote the first Phase 4C product slice only for:
    - shape-generated `rect`
    - `position: inside`
    - one full-loop visible constrained dashed interval on a closed path
  - Keep `outside` blocked on this first promoted path, because the `inside`
    slice stays on the legality-preservation route and does not pretend that
    exterior overflow or broader owner-domain clipping semantics are already
    productized.
  - Add a product-path unit contract and a dedicated app-path visual benchmark
    contract for that exact slice before widening Phase 4C further.
- Consequences:
  - Phase 4C now has its first real product-facing entry point without
    pretending that the whole constrained dashed matrix is already supported.
  - The bounded stop boundary stays explicit:
    - `outside` remains blocked
    - `oval` and `vector` remain unpromoted
    - non-full-loop constrained dashed intervals remain blocked
    - open constrained dashed paths remain blocked
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-21 - Phase 4C next Family A promotion extends rectangle full-loop constrained dashed to outside, while multi-stroke ownership stays blocked

- Context:
  - The first Phase 4C promotion already proved the narrowest honest product
    slice on shape-generated `rect inside` full-loop constrained dashed.
  - The next uncovered gap in the same declared algorithm class was the
    matching `rect outside` full-loop slice.
  - Simply wiring all constrained dashed rectangle strokes through the product
    path would have falsely implied that multiple eligible constrained dashed
    strokes already had 4C ownership/overlap semantics.
- Decision:
  - Promote the next Family A product slice for:
    - shape-generated `rect`
    - `position: outside`
    - one full-loop visible constrained dashed interval on a closed path
  - Narrow the rectangle runtime path so constrained dashed only renders when
    exactly one eligible constrained dashed packet survives the helper path.
  - Keep multiple eligible constrained dashed strokes explicitly blocked until
    Phase 4C ownership is promoted on the real product path.
- Consequences:
  - Phase 4C now covers the first honest `rect inside/outside` pair without
    pretending that broader dashed constrained ownership is already complete.
  - The bounded frontier remains explicit:
    - `oval` and `vector` remain unpromoted
    - non-full-loop constrained dashed intervals remain blocked
    - open constrained dashed paths remain blocked
    - multi-stroke constrained dashed ownership remains blocked
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 4C first vector-generated promotion is limited to a closed single-network rectangle-equivalent full-loop pair

- Context:
  - Phase 4C already had promoted shape-generated `rect inside/outside`
    full-loop constrained dashed slices.
  - The next smallest uncovered gap in the same Family A algorithm class was
    the first vector-generated full-loop constrained dashed slice.
  - Promoting generic multi-network vectors at the same time would have
    overclaimed ownership behavior that Phase 4C still blocks on the product
    path.
- Decision:
  - Promote the first vector-generated Family A slice only for:
    - closed single-network rectangle-equivalent `vector`
    - `position: inside`
    - `position: outside`
    - one full-loop visible constrained dashed interval on a closed path
  - Narrow the vector runtime path so constrained dashed only renders when the
    total eligible constrained dashed packet count across all vector networks
    is exactly one.
  - Keep multi-network constrained dashed vectors explicitly blocked until the
    vector ownership path is promoted.
- Consequences:
  - Phase 4C now covers the first shape/vector promotion pair for the same
    full-loop constrained dashed family without pretending that broader vector
    topology or multi-network ownership is already complete.
  - The bounded frontier remains explicit:
    - `oval` remains unpromoted
    - non-full-loop constrained dashed intervals remain blocked
    - open constrained dashed paths remain blocked
    - multiple eligible constrained dashed strokes remain blocked
    - multi-network constrained dashed vectors remain blocked
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 4C closes the first shape/vector equivalence gate without widening the runtime frontier

- Context:
  - Phase 4C already promoted shape-generated `rect` and the first
    vector-generated closed single-network rectangle-equivalent full-loop
    constrained dashed slices.
  - The next real scenario-family gap was Family D equivalence:
    proving those two sources keep matching product output instead of merely
    coexisting as separate promoted fixtures.
- Decision:
  - Add a package-level equivalence contract that compares shape-generated and
    vector-generated full-loop constrained dashed export packets for both
    `inside` and `outside`.
  - Add app-path visual equivalence benchmarks that compare the same
    shape/vector probe coverage deltas for both `inside` and `outside`.
  - Do not widen runtime support while closing this gate; this is a test/docs
    promotion only.
- Consequences:
  - Phase 4C now has its first explicit Family D equivalence coverage for the
    promoted full-loop constrained dashed path.
  - The supported frontier does not widen past the already promoted `rect` and
    first vector-generated pair.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 4C next shape-generated promotion extends full-loop constrained dashed to oval

- Context:
  - Phase 4C already promoted the first shape-generated `rect` pair plus the
    first vector-generated closed rectangle-equivalent pair on the same
    full-loop constrained dashed path.
  - The next smallest uncovered Family A gap that did not widen the algorithm
    class was the second shape-generated member: `oval`.
- Decision:
  - Promote the next shape-generated full-loop constrained dashed slice for:
    - `oval`
    - `position: inside`
    - `position: outside`
    - one full-loop visible constrained dashed interval on a closed path
  - Keep the same narrow runtime rule used by the current promoted shape path:
    constrained dashed renders only when exactly one eligible packet survives
    the helper path.
- Consequences:
  - Phase 4C now covers both promoted primitive shape families on the current
    full-loop constrained dashed path.
  - The bounded frontier remains explicit:
    - non-full-loop constrained dashed intervals remain blocked
    - open constrained dashed paths remain blocked
    - multiple eligible constrained dashed strokes remain blocked
    - broader vector and multi-network constrained dashed paths remain blocked
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 4C first broader vector-generated promotion extends beyond the rectangle-equivalent fixture

- Context:
  - Phase 4C already promoted:
    - shape-generated `rect`
    - shape-generated `oval`
    - the first vector-generated closed single-network rectangle-equivalent
      fixture
  - The next smallest uncovered vector gap in the same Family A full-loop
    algorithm class was a closed single-network vector that is not
    rectangle-equivalent.
- Decision:
  - Promote the first broader vector-generated full-loop constrained dashed
    slice for:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
    - `position: inside`
    - `position: outside`
    - one full-loop visible constrained dashed interval on a closed path
  - Keep the same runtime frontier:
    - exactly one eligible constrained dashed packet
    - no multi-network promotion
    - no multi-stroke ownership promotion
- Consequences:
  - Phase 4C now proves the current vector product path is not limited only to
    rectangle-equivalent fixtures.
  - The bounded frontier still stays explicit:
    - non-full-loop constrained dashed intervals remain blocked
    - open constrained dashed paths remain blocked
    - multiple eligible constrained dashed strokes remain blocked
    - multi-network constrained dashed vectors remain blocked
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 4C enters Family B with the first promoted single-edge constrained dashed slice

- Context:
  - Phase 4C Family A already had the current bounded frontier:
    - shape-generated `rect` and `oval` full-loop constrained dashed slices
    - vector-generated rectangle-equivalent and first broader non-rectangle-
      equivalent full-loop constrained dashed slices
    - the first Family D shape/vector equivalence gate
  - Staying on that same Family A path any longer would have violated the
    bounded expansion stop rule.
  - The next smallest honest family entry was Family B:
    - shape-generated `rect`
    - one single-edge visible interval on a closed path
- Decision:
  - Promote the first Family B constrained dashed product slice for:
    - shape-generated `rect`
    - `position: inside`
    - `position: outside`
    - one single-edge visible constrained dashed interval on a closed path
  - Implement it by:
    - keeping the helper frontier at exactly one visible interval
    - requiring that the visible interval stays within one source edge
    - materializing a doubled-width center-dashed packet and clipping it back
      to the constrained legality domain
  - Keep the next broader families explicitly blocked:
    - corner-spanning constrained dashed intervals
    - broader non-full-loop constrained dashed intervals
    - open constrained dashed paths
    - multi-stroke ownership / multi-network vector constrained dashed paths
- Consequences:
  - Phase 4C now has its first honest non-full-loop product promotion without
    pretending that Family C corner behavior or broader interval ownership is
    complete.
  - The app-path benchmark had to use a fixture whose perimeter still yields
    exactly one visible interval; otherwise the helper correctly keeps the path
    blocked.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 4C extends Family B to the first vector rectangle-equivalent slice and closes the first Family B/Family D crossover gate

- Context:
  - Phase 4C Family B already had the first promoted shape-generated slice:
    - `rect`
    - `position: inside`
    - `position: outside`
    - one single-edge visible constrained dashed interval
  - The next smallest uncovered slice was not `oval` or corner-spanning
    behavior. It was the same rectangle-equivalent topology represented by a
    vector source.
- Decision:
  - Promote the next Family B constrained dashed product slice for:
    - vector-generated closed single-network rectangle-equivalent `vector`
    - `position: inside`
    - `position: outside`
    - one single-edge visible constrained dashed interval on a closed path
  - Close the first Family B / Family D crossover gate by proving:
    - shape-generated `rect`
    - vector-generated closed single-network rectangle-equivalent `vector`
    - keep matching `inside/outside` single-edge constrained dashed coverage
  - Keep the bounded frontier explicit:
    - shape-generated `oval` single-edge slices are still pending
    - corner-spanning constrained dashed intervals are still blocked
    - broader non-full-loop constrained dashed intervals remain blocked
- Consequences:
  - Phase 4C now proves the same single-edge constrained dashed semantics do
    not depend on a shape-only private product branch.
  - The app-path equivalence gate uses matched `80x40` fixtures so the probe
    compares one canonical perimeter instead of different authored lengths.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 4C extends Family B to the first broader non-rectangle-equivalent vector single-edge slice

- Context:
  - Phase 4C Family B already promoted:
    - shape-generated `rect` single-edge `inside/outside`
    - vector-generated rectangle-equivalent single-edge `inside/outside`
    - the first Family B / Family D crossover gate on the matched
      rectangle-equivalent topology
  - The next smallest uncovered Family B slice was the same broader vector
    topology that had already been promoted on Family A full-loop:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
- Decision:
  - Promote the next broader Family B constrained dashed product slice for:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
    - `position: inside`
    - `position: outside`
    - one single-edge visible constrained dashed interval on a closed path
  - Reuse the same bounded interval fixture as the rectangle-equivalent
    vector slice:
    - one visible interval
    - interval stays on the horizontal top edge
    - no corner-spanning promotion
- Consequences:
  - Phase 4C now proves the current Family B vector path is not restricted to
    rectangle-equivalent topology only.
  - The bounded frontier still stays explicit:
    - corner-spanning constrained dashed intervals remain blocked
    - broader non-full-loop interval families remain blocked
    - there is still no Family B shape/vector equivalence gate for
      non-rectangle-equivalent topology
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 4C enters Family C with the first inside corner-spanning constrained dashed representative pair

- Context:
  - Phase 4C had already exhausted the honest bounded Family B expansions for:
    - shape-generated `rect`
    - vector-generated rectangle-equivalent `vector`
    - vector-generated first broader non-rectangle-equivalent quadrilateral
  - Promoting `oval` single-edge next would have been misleading because the
    current helper semantics classify interval locality by source edges rather
    than curve spans.
  - The next smallest honest move was to enter Family C with one explicit
    corner-spanning representative.
- Decision:
  - Promote the first Family C constrained dashed product slices for:
    - shape-generated `rect`
    - `position: inside`
    - `join: bevel`
    - `join: miter`
    - one corner-spanning visible constrained dashed interval on a closed path
  - Keep this promotion explicitly runtime-local to the `rect` path by adding
    an opt-in on the constrained dashed helper.
  - Keep the rest of Family C blocked:
    - `outside` corner-spanning remains blocked
    - vector/oval corner-spanning remains blocked
- Consequences:
  - Phase 4C now proves the current constrained dashed runtime can preserve an
    inside corner remainder for both supported join silhouettes on the current
    bounded path:
    - `bevel`
    - `miter`
  - The frontier remains honest; this does not claim that generic corner-
    spanning or curve-spanning ownership is complete.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 4C promotes the next bounded Family C outside bevel representative

- Context:
  - Phase 4C had already promoted the first Family C representative pair for
    `rect + inside + bevel/miter`.
  - The next smallest uncovered corner-spanning slice was not `vector`,
    `oval`, or generic outside support; it was one explicit shape-generated
    `rect + outside + bevel` representative on the same orthogonal fixture.
- Decision:
  - Promote the next bounded Family C constrained dashed product slice for:
    - shape-generated `rect`
    - `position: outside`
    - `join: bevel`
    - one corner-spanning visible constrained dashed interval on a closed path
  - Keep this promotion runtime-local to the `rect` path through the same
    constrained dashed helper opt-in pattern.
  - Keep the rest of this frontier blocked:
    - `outside + miter` corner-spanning remains blocked
    - vector/oval corner-spanning remains blocked
- Consequences:
  - Phase 4C now proves the current bounded runtime can preserve one exterior
    corner-spanning remainder for a shape-generated `rect` without claiming
    that generic outside corner-spanning ownership is complete.
  - The bounded Family C frontier remains explicit and testable rather than
    widening silently into broader topology support.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 4C promotes the first broader non-rectangle-equivalent vector Family C representative

- Context:
  - Phase 4C Family C already promoted the bounded orthogonal corner-spanning
    representatives for:
    - shape-generated `rect`
    - vector-generated closed single-network rectangle-equivalent `vector`
  - The next uncovered choice had to stay within the same corner-spanning
    algorithm class.
  - Promoting `oval` here would have been misleading because the current
    bounded helper still classifies Family C by discrete edge/corner ownership
    rather than curve-span semantics, so an oval "corner-spanning"
    representative would have been a product-semantics mismatch.
- Decision:
  - Promote the first broader Family C constrained dashed product slice for:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
    - `position: inside`
    - `join: bevel`
    - one corner-spanning visible constrained dashed interval on a closed path
  - Keep the runtime opt-in narrow on the constrained dashed helper:
    - inside only
    - bevel only
    - one bounded non-rectangle-equivalent quadrilateral loop class
  - Keep the rest of this frontier blocked:
    - broader vector `miter` corner-spanning remains blocked
    - broader vector `outside` corner-spanning remains blocked
    - `oval` corner/curve-spanning remains blocked
- Consequences:
  - Phase 4C now proves the bounded corner-spanning product path is not
    restricted to rectangle-equivalent topology only.
  - The frontier stays honest: this does not claim generic non-rect
    corner-spanning ownership or curve-spanning semantics are complete.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 4C extends the first broader vector Family C slice to the matching inside miter representative

- Context:
  - Phase 4C already promoted the first broader non-rectangle-equivalent
    vector Family C representative for:
    - `position: inside`
    - `join: bevel`
  - The next smallest uncovered move stayed on that same bounded path:
    - same non-rectangle-equivalent quadrilateral loop class
    - same `inside` ownership path
    - matching `miter` join silhouette
  - Jumping to `outside` or `oval` here would have widened either ownership
    scope or semantics class before finishing the current bounded representative
    pair.
- Decision:
  - Promote the matching broader Family C constrained dashed product slice for:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
    - `position: inside`
    - `join: miter`
    - one corner-spanning visible constrained dashed interval on a closed path
  - Keep the helper opt-in narrow on the same bounded loop class:
    - inside only
    - bevel/miter only
    - no outside broader-vector promotion yet
  - Keep the rest of this frontier blocked:
    - broader vector `outside` corner-spanning remains blocked
    - `oval` corner/curve-spanning remains blocked
- Consequences:
  - Phase 4C now closes the first honest broader-vector Family C inside
    representative pair without pretending that broader outside ownership or
    curve-spanning semantics are done.
  - The next step can be evaluated explicitly from a narrower, documented
    frontier instead of re-opening the same inside join family again.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 4C extends the broader vector Family C frontier to the first outside bevel representative

- Context:
  - Phase 4C already closed the broader non-rectangle-equivalent vector
    Family C inside representative pair for:
    - `inside + bevel`
    - `inside + miter`
  - The next smallest uncovered move on that same bounded loop class was not
    `outside + miter` or `oval`; it was the first outside ownership
    representative with the simpler supported join silhouette:
    - `outside + bevel`
  - The only failing signal during implementation was an over-eager slanted
    outside probe point on the product-path unit test; helper-level and
    product-path geometry were already correct, so the issue was a benchmark
    probe mismatch rather than a runtime bug.
- Decision:
  - Promote the next broader Family C constrained dashed product slice for:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
    - `position: outside`
    - `join: bevel`
    - one corner-spanning visible constrained dashed interval on a closed path
  - Keep the helper opt-in narrow on the same bounded loop class:
    - `outside` only for `bevel`
    - no broader-vector `outside + miter` promotion yet
    - no `oval` corner/curve-spanning promotion yet
- Consequences:
  - Phase 4C now proves the broader vector Family C path can preserve the
    first outside corner-spanning remainder without claiming that broader
    outside join coverage is complete.
  - The remaining frontier is narrower and explicit:
    - broader vector `outside + miter`
    - `oval` corner/curve-spanning
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 4C closes the broader vector Family C representative set with the matching outside miter slice

- Context:
  - Phase 4C already promoted the broader non-rectangle-equivalent vector
    Family C representatives for:
    - `inside + bevel`
    - `inside + miter`
    - `outside + bevel`
  - The next smallest uncovered move on the same bounded quadrilateral loop
    class was the matching outside join silhouette:
    - `outside + miter`
  - This slice stayed within the same algorithm class, same topology, and same
    outside ownership path. It did not require any new scenario family.
- Decision:
  - Promote the matching broader Family C constrained dashed product slice for:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
    - `position: outside`
    - `join: miter`
    - one corner-spanning visible constrained dashed interval on a closed path
  - Keep the helper opt-in narrow on the same bounded loop class:
    - no broader-vector topology expansion beyond this quadrilateral class
    - no `oval` corner/curve-spanning promotion
- Consequences:
  - Phase 4C now closes the first honest broader-vector Family C
    representative set without reopening the same family again.
  - The remaining frontier should now be evaluated outside this completed
    broader-vector representative set, rather than continuing to micro-expand
    the same family.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 4C adds the first blocked-behavior app-path gate for multiple eligible constrained dashed strokes

- Context:
  - Phase 4C already had a product-path unit contract proving shape-generated
    `rect` keeps multiple eligible constrained dashed strokes blocked until 4C
    ownership is promoted.
  - After closing the broader vector Family C representative set, the next
    honest move was not another promoted geometry slice. It was to lock one
    explicit Family E blocked frontier on the real app path.
- Decision:
  - Add the first Family E blocked-behavior visual benchmark for:
    - shape-generated `rect`
    - two eligible constrained dashed strokes on the same element
    - expected result: both constrained dashed bands remain visually absent
      until 4C ownership is promoted
  - Reuse the existing product-path unit contract instead of inventing a new
    scenario taxonomy or widening runtime scope.
- Consequences:
  - Phase 4C now has its first explicit app-path absence gate for the
    multiple-eligible ownership frontier.
  - This keeps the phase honest: unsupported multi-stroke ownership is now
    blocked by both product-path and app-path evidence rather than only by a
    unit assertion.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 4C adds the next blocked-behavior app-path gate for self-intersecting constrained dashed vectors

- Context:
  - Phase 4C already had a product-path unit contract proving
    self-intersecting constrained dashed `vector` paths are rejected
    deterministically on the main render path.
  - After locking the first Family E blocked frontier for multiple eligible
    constrained dashed strokes, the next honest move was still not a new
    promoted geometry slice. It was the narrower unsupported-topology frontier
    on the same bounded app path.
- Decision:
  - Add the next Family E blocked-behavior visual benchmark for:
    - one self-intersecting closed constrained dashed `vector`
    - expected result: constrained dashed coverage remains visually absent on
      the app path until that unsupported topology is promoted
  - Reuse the existing product-path unit contract instead of widening runtime
    scope or inventing a new scenario family.
- Consequences:
  - Phase 4C now has a second explicit app-path absence gate for Family E
    blocked behavior.
  - This keeps the phase honest: unsupported self-intersecting topology is now
    blocked by both product-path and app-path evidence rather than only by a
    unit assertion.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 4C adds the third blocked-behavior app-path gate for multi-network constrained dashed vectors

- Context:
  - Phase 4C already had a product-path unit contract proving multi-network
    constrained dashed `vector` paths stay blocked until the vector ownership
    path is promoted.
  - After locking the first two Family E blocked frontiers for
    multiple-eligible and self-intersecting constrained dashed paths, the next
    honest move was still not a new promoted geometry slice. It was the
    disconnected multi-network ownership frontier on the same bounded app path.
- Decision:
  - Add the third Family E blocked-behavior visual benchmark for:
    - one constrained dashed `vector` patched to two disconnected closed
      rectangle networks
    - expected result: constrained dashed coverage remains visually absent on
      both disconnected networks and in the inter-network gap until that
      ownership path is promoted
  - Reuse the existing product-path unit contract instead of widening runtime
    scope or inventing a new scenario family.
- Consequences:
  - Phase 4C now has a third explicit app-path absence gate for Family E
    blocked behavior.
  - This keeps the phase honest: unsupported multi-network ownership is now
    blocked by both product-path and app-path evidence rather than only by a
    unit assertion.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 4C adds the fourth blocked-behavior app-path gate for open-path constrained dashed vectors

- Context:
  - Phase 4C already had a product-path unit contract proving open-path
    constrained dashed `vector` paths are rejected deterministically on the
    main render path.
  - After locking the first three Family E blocked frontiers for
    multiple-eligible, self-intersecting, and multi-network constrained dashed
    paths, the next honest move was still not a new promoted geometry slice.
    It was the simpler open-path topology frontier on the same bounded app
    path.
- Decision:
  - Add the fourth Family E blocked-behavior visual benchmark for:
    - one constrained dashed `vector` patched to an open horizontal line
    - expected result: constrained dashed coverage remains visually absent on
      the authored line span and nearby line-adjacent bands until that
      topology is promoted
  - Reuse the existing product-path unit contract instead of widening runtime
    scope or inventing a new scenario family.
- Consequences:
  - Phase 4C now has a fourth explicit app-path absence gate for Family E
    blocked behavior.
  - This keeps the phase honest: unsupported open-path constrained dashed
    topology is now blocked by both product-path and app-path evidence rather
    than only by a unit assertion.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-26 - Open vector authored inside/outside strokes render through center fallback

- Context:
  - Manual testing showed open `vector` strokes were visible with `center` but
    disappeared when the same stroke row was switched to `inside` or `outside`.
  - Follow-up manual testing showed the same user-facing disappearance on
    simple closed single-network vectors when a repeated dashed pattern such
    as `20,20` was switched from `center` to `inside` / `outside`; the
    constrained dashed helper was correctly not promoting arbitrary
    multi-interval constrained geometry, but the product path should not drop
    visible stroke output.
  - The visual contracts were connected to the app path, but they encoded the
    wrong product semantics by expecting open-path constrained solid/dashed
    vectors to stay absent. The stroke UI manual already states that open paths
    treat placement as `center` regardless of the authored UI value.
- Decision:
  - Keep constrained clipping blocked for open paths.
  - Preserve authored `inside` / `outside` in scene data.
  - Normalize only the open-vector render path to centered placement for solid
    / dashed center stroke packet generation.
  - For simple closed single-network non-self-intersecting vectors, when an
    authored constrained dashed stroke does not enter a promoted constrained
    packet path, render a centered visibility fallback instead of disappearing.
    This does not promote exact constrained multi-interval inside/outside
    geometry.
  - Add no-mock app-path visual contracts that set stroke controls through the
    properties panel, read the stored stroke row, and verify both patched
    topology, real two-point pen-created open vectors, and real pen-created
    closed vectors with repeated dash intervals remain visibly centered.
- Consequences:
  - This fixes the manual disappearing-stroke failure without widening the
    constrained-geometry algorithm class.
  - Self-intersecting and multi-network constrained dashed vectors remain
    absent until their scenario families are explicitly promoted.
  - Round cap / join behavior on open-path center strokes remains a separate
    uniform-width backlog slice.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 5 starts with the first constrained dashed round-join representative on the bounded product path

- Context:
  - Phase 4C had already reached a point where more blocked-behavior gates were
    no longer the main downstream blocker for launch sequencing.
  - The next meaningful move was to start Phase 5 with the narrowest promoted
    round-join representative instead of continuing to widen Family E blocked
    coverage.
  - The narrowest honest move was not `round caps`, because that would couple a
    join-family gap to open-path topology. It was the first closed-path
    representative:
    - shape-generated `rect`
    - constrained dashed `inside + round join`
- Decision:
  - Promote the first Phase 5 representative with matching helper-level,
    product-path, and app-path coverage for:
    - shape-generated `rect`
    - constrained dashed `inside + round join`
    - expected result: constrained dashed coverage now renders on the bounded
      path without altering the already-approved Phase 4 `miter` / `bevel`
      slices
- Consequences:
  - The stroke engine has now moved beyond Phase 4C-only blocked coverage and
    into the first concrete Phase 5 round-join slice.
  - Bounded expansion remains intact: only `rect + full-loop + inside + round
    join` is promoted here; broader round joins and all round caps remain
    future work.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-21 - Broader mixed-topology subtraction now covers a non-orthogonal non-convex disconnected sub-packet

- Context:
  - The broader constrained-solid owner-domain plan already promoted one
    subtraction scenario where a `bevel` owner left local `miter` remainders
    on disconnected vector-generated sub-packets.
  - That benchmark still used only rectangular disconnected pieces, so the
    broader mixed-topology subtraction family was not yet proven on a path
    where one disconnected sub-packet was a non-orthogonal non-convex piece.
- Decision:
  - Promote the next broader mixed-topology subtraction scenario under the
    same algorithm-class plan:
    - one disconnected vector-generated sub-packet is a non-orthogonal
      non-convex piece
    - the `bevel` owner still clips the `miter` non-owner without erasing the
      local remainder completely
    - the scenario is now gated by both product-path export-packet assertions
      and app-path visual coverage
- Consequences:
  - The broader mixed-topology subtraction family is no longer validated only
    on rectangular disconnected pieces.
  - This round did not require a new runtime patch; the existing broader
    subtraction path already satisfied the scenario once the unit and visual
    contracts were promoted and synced.
  - Broader mixed-topology subtraction beyond the currently promoted families,
    and broader general non-convex owner-domain construction, remain future
    work under the same plan.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-general-owner-domain-plan.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-21 - Broader owner-domain plan now has a first Family B equivalence gate for non-orthogonal mixed-topology input

- Context:
  - The broader constrained-solid owner-domain plan already had:
    - a mixed-topology subtraction scenario on a disconnected vector-generated
      path where one sub-packet was a non-orthogonal non-convex piece
    - a Family D equivalence gate on the broader subtraction path for a
      shape-generated rectangle and a vector-generated closed rectangle
  - It still lacked a promoted Family B scenario proving that broader
    non-convex owner-domain construction stays deterministic across equivalent
    vector-generated inputs on the same mixed-topology subtraction family.
- Decision:
  - Promote the first Family B equivalence scenario under the broader
    constrained-solid owner-domain plan:
    - two equivalent vector-generated mixed-topology paths
    - one disconnected sub-packet is a non-orthogonal non-convex piece
    - both must keep deterministic owner-domain construction and equivalent
      local `miter` remainders on the broader subtraction path
    - the scenario is now gated by both product-path packet/region equality
      and app-path visual coverage
- Consequences:
  - The broader owner-domain plan is no longer missing a promoted Family B
    equivalence gate for non-orthogonal non-convex mixed-topology input.
  - This round did not require a new runtime patch; the existing broader
    owner-domain and subtraction path already satisfied the scenario once the
    unit and visual contracts were promoted and synced.
  - Broader mixed-topology subtraction beyond the currently promoted
    scenarios, and broader general non-convex owner-domain construction,
    remain future work under the same plan.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-general-owner-domain-plan.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-21 - Broader nested-convex exact owner-domain path now uses a subset-budget gate instead of a hard candidate cap

- Context:
  - The broader constrained-solid owner-domain plan had already promoted
    nested five through nine-candidate exact candidate-set ownership
    scenarios.
  - Continuing with `10`, `11`, `12` as separate micro-slices would violate
    the bounded-expansion rule we explicitly adopted to avoid infinite
    frontier growth.
- Decision:
  - Replace the artificial hard candidate-count cap on the broader
    nested-convex exact candidate-set path with a **subset-budget gate**.
  - Promote ten nested constrained solid components as the first proof
    scenario under that new gate.
  - The exact path now stays enabled while the total subset count remains
    within the declared budget, instead of requiring one new promotion per
    additional candidate count.
- Consequences:
  - This removes the need to keep extending the same nested-convex family
    through `10`, `11`, `12` as separate status bullets.
  - The broader owner-domain plan now advances by changing the algorithm gate,
    not by continuing an unbounded candidate-count frontier.
  - Broader mixed-topology subtraction and broader general non-convex
    owner-domain construction still remain future work under the same plan.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-general-owner-domain-plan.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-21 - Broader constrained-solid subtraction now has a first shape/vector equivalence gate

- Context:
  - The broader constrained-solid owner-domain plan had already promoted local
    `miter` remainder subtraction on the broader mixed-topology path, but the
    new algorithm-class plan still lacked a declared `Family D` equivalence
    gate.
  - A package-level comparison and app-path benchmark now both showed the same
    promoted subtraction semantics on:
    - one shape-generated closed rectangle
    - one vector-generated closed rectangle
    - `stroke:0` outside `bevel`
    - `stroke:1` outside `miter`
- Decision:
  - Promote the first shape/vector equivalence scenario under the broader
    constrained-solid owner-domain plan:
    - shape-generated and vector-generated closed rectangles must keep
      equivalent local `miter` remainders on the broader subtraction path
    - the scenario is now gated by both package-level export-packet equality
      and app-path visual coverage
- Consequences:
  - The broader owner-domain plan is no longer missing an explicit `Family D`
    gate for its first promoted subtraction family.
  - This round did not require a new runtime patch; the existing broader
    subtraction path already satisfied the equivalence scenario once the unit
    and visual benchmarks were promoted and the docs were synced.
  - Broader mixed-topology subtraction beyond the promoted local-remainder
    scenario, and broader general non-convex owner-domain construction, remain
    future work under the same plan.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-general-owner-domain-plan.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-20 - Broader constrained-solid owner-domain path now extends beyond the former five-candidate cap

- Context:
  - The first broader constrained-solid owner-domain scenario had already
    promoted deterministic exact candidate-set ownership for nested
    five-candidate components.
  - The next explicit algorithm boundary in code was still a hard cap:
    exact candidate-set regions were only built when
    `componentCandidates.length <= 5`.
- Decision:
  - Promote the next broader scenario under the same new algorithm-class plan:
    - deterministic exact candidate-set ownership for nested six-candidate
      constrained solid components
  - Keep the expansion narrow:
    - nested convex component only
    - exact candidate-set owner-domain only
    - no claim of broader mixed-topology or general polygon-boolean support
- Consequences:
  - The broader owner-domain path is now runtime-backed beyond the former
    five-candidate cap with matching unit and app-path visual coverage.
  - The new algorithm-class plan now has two concrete promoted broader
    scenarios instead of a single cap-break.
  - Broader mixed-topology subtraction and broader non-convex owner-domain
    construction still remain future work under the same plan.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-general-owner-domain-plan.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-20 - Broader constrained-solid owner-domain path now extends beyond the former six-candidate cap

- Context:
  - The broader constrained-solid owner-domain path already supported nested
    five-candidate and six-candidate exact candidate-set ownership.
  - The next explicit algorithm boundary in code was still a hard cap:
    exact candidate-set regions were only built when
    `componentCandidates.length <= 6`.
- Decision:
  - Promote the next broader scenario under the same algorithm-class plan:
    - deterministic exact candidate-set ownership for nested seven-candidate
      constrained solid components
  - Keep the expansion narrow:
    - nested convex component only
    - exact candidate-set owner-domain only
    - no claim of broader mixed-topology or general polygon-boolean support
- Consequences:
  - The broader owner-domain path is now runtime-backed beyond the former
    six-candidate cap with matching unit and app-path visual coverage.
  - The new algorithm-class plan now has three concrete promoted broader
    scenarios, all on the same exact candidate-set path.
  - Broader mixed-topology subtraction and broader non-convex owner-domain
    construction still remain future work under the same plan.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-general-owner-domain-plan.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-20 - Broader constrained-solid owner-domain path now extends beyond the former seven-candidate cap

- Context:
  - The broader constrained-solid owner-domain path already supported nested
    five-candidate, six-candidate, and seven-candidate exact candidate-set
    ownership.
  - The next explicit algorithm boundary in code was still a hard cap:
    exact candidate-set regions were only built when
    `componentCandidates.length <= 7`.
- Decision:
  - Promote the next broader scenario under the same algorithm-class plan:
    - deterministic exact candidate-set ownership for nested eight-candidate
      constrained solid components
  - Keep the expansion narrow:
    - nested convex component only
    - exact candidate-set owner-domain only
    - no claim of broader mixed-topology or general polygon-boolean support
- Consequences:
  - The broader owner-domain path is now runtime-backed beyond the former
    seven-candidate cap with matching unit and app-path visual coverage.
  - The new algorithm-class plan now has four concrete promoted broader
    scenarios, all on the same exact candidate-set path.
  - Broader mixed-topology subtraction and broader non-convex owner-domain
    construction still remain future work under the same plan.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-general-owner-domain-plan.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-20 - Broader constrained-solid owner-domain path now extends beyond the former eight-candidate cap

- Context:
  - The broader constrained-solid owner-domain path already supported nested
    five-candidate through eight-candidate exact candidate-set ownership.
  - The next explicit algorithm boundary in code was still a hard cap:
    exact candidate-set regions were only built when
    `componentCandidates.length <= 8`.
- Decision:
  - Promote the next broader scenario under the same algorithm-class plan:
    - deterministic exact candidate-set ownership for nested nine-candidate
      constrained solid components
  - Keep the expansion narrow:
    - nested convex component only
    - exact candidate-set owner-domain only
    - no claim of broader mixed-topology or general polygon-boolean support
- Consequences:
  - The broader owner-domain path is now runtime-backed beyond the former
    eight-candidate cap with matching unit and app-path visual coverage.
  - The new algorithm-class plan now has five concrete promoted broader
    scenarios, all on the same exact candidate-set path.
  - Broader mixed-topology subtraction and broader non-convex owner-domain
    construction still remain future work under the same plan.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-general-owner-domain-plan.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-20 - Broader constrained-solid owner-domain path now includes the first mixed-topology promoted scenario

- Context:
  - The broader constrained-solid owner-domain plan already had nested
    five-through-nine-candidate exact candidate-set scenarios, but they all
    stayed on the same nested convex family.
  - The first real broader-family gap was mixed-topology exact candidate-set
    ownership across disconnected multi-polygon sub-packets.
  - A new mixed-topology five-candidate unit contract exposed two concrete
    issues:
    - `constrained-solid-ownership-diagnostics.ts` still compared polygons by
      fixed start index / winding, so exact-subset subtraction missed
      equivalent superset polygons and emitted impossible subset regions.
    - `vector.ts` still built its final constrained render/export path from
      raw constrained packets, instead of the legality-clipped
      `result.packets`, so a multi-network vector could reintroduce
      foreign-owned geometry that helper-level clipping had already removed.
- Decision:
  - Promote the first mixed-topology broader scenario under the new
    algorithm-class plan:
    - deterministic exact candidate-set ownership for mixed-topology
      five-candidate constrained solid components across disconnected
      multi-polygon sub-packets
    - app-path visual coverage on a multi-network vector-generated path
  - Strengthen polygon equality inside
    `constrained-solid-ownership-diagnostics.ts` to accept equivalent
    polygons across rotation and reversed winding.
  - Route vector constrained render/export packets through the ownership-clipped
    legality result packets instead of raw constrained packets.
- Consequences:
  - The broader owner-domain path is no longer only a nested candidate-count
    frontier; it now has a promoted mixed-topology family with matching unit
    and app-path visual coverage.
  - Mixed-topology exact-subset ownership no longer emits impossible subset
    regions just because two equivalent polygons disagree on start index or
    winding.
  - Multi-network vector constrained solid rendering now stays aligned with
    helper-level legality/ownership clipping on the final render/export path.
  - Broader mixed-topology subtraction and broader general non-convex
    owner-domain construction still remain future work under the same plan.

## 2026-04-21 - Broader constrained-solid owner-domain path now includes the second mixed-topology promoted scenario

- Context:
  - The broader constrained-solid owner-domain plan already had a first
    promoted mixed-topology five-candidate scenario on disconnected
    multi-polygon sub-packets.
  - The next meaningful frontier was not another nested convex count bump; it
    was proving that the same mixed-topology broader family stays deterministic
    when the disconnected sub-packets grow to six candidates on the same
    vector-generated product path.
- Decision:
  - Promote the second mixed-topology broader scenario under the same
    algorithm-class plan:
    - deterministic exact candidate-set ownership for mixed-topology
      six-candidate constrained solid components across disconnected
      multi-polygon sub-packets
    - app-path visual coverage on a multi-network vector-generated path
- Consequences:
  - The broader owner-domain path now has more than one promoted
    mixed-topology scenario, so the new algorithm class is no longer validated
    by a single disconnected-subpacket example.
  - No new runtime patch was required for this promotion; the existing broader
    mixed-topology path already satisfied the six-candidate contract once the
    unit and visual benchmarks were made explicit.
  - Broader mixed-topology subtraction and broader general non-convex
    owner-domain construction still remain future work under the same plan.

## 2026-04-21 - Broader constrained-solid subtraction path now includes retained local miter remainders on mixed-topology vector sub-packets

- Context:
  - The broader constrained-solid owner-domain plan already had mixed-topology
    ownership scenarios on disconnected multi-polygon vector sub-packets, but
    it still lacked an app-path benchmark for the subtraction side where a
    non-owner stroke should remain partially visible rather than disappear
    completely.
  - A package-level probe showed a concrete supported case:
    - `stroke:0` outside `bevel`
    - `stroke:1` outside `miter`
    - two disconnected vector-generated rectangle networks
    - the non-owner `miter` stroke keeps local corner remainders after
      ownership clipping
- Decision:
  - Promote the first broader mixed-topology subtraction scenario under the new
    algorithm-class plan:
    - preserved local `miter` remainders when a `bevel` owner clips
      disconnected vector-generated sub-packets
    - app-path visual coverage on a multi-network vector-generated path
  - Add a matching package-level clipping contract that requires the non-owner
    packets to retain their local remainder polygons instead of dropping to
    zero.
- Consequences:
  - The broader mixed-topology path is now promoted on both sides:
    - exact candidate-set ownership
    - local-remainder subtraction
  - This round did not need a new runtime patch; the existing broader
    mixed-topology clipping path already satisfied the promoted subtraction
    scenario once the unit and visual benchmarks were made explicit.
  - Broader mixed-topology subtraction beyond this declared scenario, and
    broader general non-convex owner-domain construction, still remain future
    work under the same plan.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/constrained-solid-general-owner-domain-plan.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-22 - Phase 5 adds the next constrained dashed round-cap representative on the bounded product path

- Context:
  - Phase 5 had already promoted the first constrained dashed round-join
    representative on the bounded product path:
    - shape-generated `rect`
    - constrained dashed `full-loop + inside + round join`
  - The next narrowest honest move was not broader round joins or broader round
    caps. It was the matching single-edge representative that stays on the
    same bounded shape-generated path without coupling to open-path topology:
    - shape-generated `rect`
    - constrained dashed `single-edge + inside + round cap`
- Decision:
  - Promote the next Phase 5 representative with matching helper-level,
    product-path, and app-path coverage for:
    - shape-generated `rect`
    - constrained dashed `single-edge + inside + round cap`
  - Keep the runtime opt-in narrow:
    - one single-edge visible interval
    - `position: inside`
    - `cap: round`
    - no claim of broader round-cap or broader round-join completion
- Consequences:
  - Phase 5 now has a second concrete promoted slice on the bounded product
    path:
    - `rect + full-loop + inside + round join`
    - `rect + single-edge + inside + round cap`
  - Helper, product-path, and app-path contracts now exist for the first
    round-cap representative without pretending that generic round caps or
    generic round joins are complete.
  - Broader round caps, broader round joins, and later paint/width phases
    remain future work.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-23 - Phase 5 adds the first vector-generated round-join representative on the bounded product path

- Context:
  - Phase 5 had already promoted two narrow shape-generated representatives on
    the bounded product path:
    - `rect + full-loop + inside + round join`
    - `rect + single-edge + inside + round cap`
  - The next narrowest honest move was not another shape-generated `rect`
    variant. That would only micro-expand the same source frontier.
  - The narrower downstream move was the first vector-generated representative
    on the already-proven rectangle-equivalent full-loop family:
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `full-loop + inside + round join`
- Decision:
  - Promote the first vector-generated Phase 5 representative with matching
    helper-level, product-path, and app-path coverage for:
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `full-loop + inside + round join`
  - Keep the runtime opt-in narrow:
    - rectangle-equivalent loop only
    - `position: inside`
    - one full-loop visible interval
    - `join: round`
    - no broader vector round-join or round-cap completion claim
- Consequences:
  - Phase 5 now extends from shape-generated-only representatives to the first
    vector-generated round-join slice on the same bounded product path.
  - Shape/vector parity now exists for the first full-loop round-join
    representative without pretending that broader vector round joins, vector
    round caps, or non-rectangle-equivalent round families are complete.
  - Broader round joins, broader round caps, and later paint/width phases
    remain future work.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-23 - Phase 5 adds the first vector-generated round-cap representative on the bounded product path

- Context:
  - Phase 5 had already promoted the first vector-generated round-join
    representative on the bounded product path:
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `full-loop + inside + round join`
  - The next narrowest honest move was not a broader vector round-join variant
    and not a non-rectangle-equivalent round family. It was the matching cap
    representative on the already-proven rectangle-equivalent single-edge
    family:
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `single-edge + inside + round cap`
- Decision:
  - Promote the next vector-generated Phase 5 representative with matching
    helper-level, product-path, and app-path coverage for:
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `single-edge + inside + round cap`
  - Keep the runtime opt-in narrow:
    - rectangle-equivalent loop only
    - `position: inside`
    - one single-edge visible interval
    - `cap: round`
    - no broader vector round-cap or generic round-family completion claim
- Consequences:
  - Phase 5 now has the first vector-generated representative on both round
    sub-axes of the bounded product path:
    - `full-loop + inside + round join`
    - `single-edge + inside + round cap`
  - Shape/vector parity now extends to the first bounded round-cap
    representative without pretending that broader vector round caps, broader
    vector round joins, or non-rectangle-equivalent round families are
    complete.
  - Broader round joins, broader round caps, and later paint/width phases
    remain future work.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-23 - Phase 5 adds the first broader vector-generated round-cap representative on the bounded product path

- Context:
  - Phase 5 had already promoted the first vector-generated round-cap
    representative on the bounded product path:
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `single-edge + inside + round cap`
  - The next narrowest honest move was not to widen the same
    rectangle-equivalent source frontier. It was to step into the already
    proven broader non-rectangle-equivalent quadrilateral source family while
    staying on the same single-edge round-cap algorithm class:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
    - constrained dashed `single-edge + inside + round cap`
- Decision:
  - Promote the next broader vector-generated Phase 5 representative with
    matching helper-level, product-path, and app-path coverage for:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
    - constrained dashed `single-edge + inside + round cap`
  - Keep the runtime opt-in narrow:
    - first broader single-oblique quadrilateral loop class only
    - `position: inside`
    - one single-edge visible interval
    - `cap: round`
    - no broader round-cap family completion claim
- Consequences:
  - Phase 5 now reaches the first broader vector-generated cap slice instead of
    stalling on rectangle-equivalent variants.
  - The bounded product path now has broader vector evidence on both the
    supported non-round Family B/C frontier and the first round-cap frontier.
  - Broader round joins, broader round caps beyond this first broader vector
    representative, and later paint/width phases remain future work.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-23 - Phase 5 adds the first broader vector-generated round-join representative on the bounded product path

- Context:
  - Phase 5 had already promoted the first broader vector-generated round-cap
    representative on the bounded product path:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
    - constrained dashed `single-edge + inside + round cap`
  - The next narrowest honest move was not to stay on another cap-only variant.
    It was the matching full-loop round-join representative on the same
    broader non-rectangle-equivalent source family:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
    - constrained dashed `full-loop + inside + round join`
- Decision:
  - Promote the next broader vector-generated Phase 5 representative with
    matching helper-level, product-path, and app-path coverage for:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
    - constrained dashed `full-loop + inside + round join`
  - Keep the runtime opt-in narrow:
    - first broader single-oblique quadrilateral loop class only
    - `position: inside`
    - one full-loop visible interval
    - `join: round`
    - no broader round-join family completion claim
- Consequences:
  - Phase 5 now reaches the first broader vector-generated representative on
    both bounded round sub-axes:
    - `single-edge + inside + round cap`
    - `full-loop + inside + round join`
  - This moves the rollout forward on the broader source frontier instead of
    reworking rectangle-equivalent variants.
  - Broader round joins, broader round caps beyond these first broader vector
    representatives, and later paint/width phases remain future work.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-23 - Phase 5 closes the first round-join shape/vector equivalence gate on the bounded product path

- Context:
  - Phase 5 had already promoted the first bounded round-join representative on
    both sides of the shape/vector source split:
    - shape-generated `rect`
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `full-loop + inside + round join`
  - The next higher-value frontier was no longer another narrow round runtime
    slice on the same source family.
  - The more honest next move was to close the first Phase 5 Family D
    equivalence gate on that already-promoted bounded round-join path.
- Decision:
  - Add product-path and app-path equivalence contracts for:
    - shape-generated `rect`
    - closed single-network rectangle-equivalent `vector`
    - matching constrained dashed `full-loop + inside + round join` coverage
  - Keep this gate narrow:
    - full-loop only
    - `position: inside`
    - `join: round`
    - rectangle-equivalent vector only
    - no round-cap equivalence completion claim
    - no broader round equivalence completion claim
- Consequences:
  - Phase 5 now has its first round-join shape/vector equivalence proof on the
    bounded product path instead of only parallel shape-side and vector-side
    promoted representatives.
  - This closes the first bounded round-join crossover gate without pretending
    that round-cap equivalence, broader vector equivalence, or curve-spanning
    round semantics are complete.
  - The next downstream move can advance to a new representative frontier
    instead of reopening the same bounded round-join source pair.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-23 - Phase 5 closes the first round-cap shape/vector equivalence gate on the bounded product path

- Context:
  - After the first bounded round-join crossover gate closed, the next
    downstream move was not to widen broader-vector round reps again.
  - Phase 5 already had the matching bounded round-cap representatives on both
    sides of the shape/vector source split:
    - shape-generated `rect`
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `single-edge + inside + round cap`
  - That made the next honest frontier the matching Phase 5 Family D
    equivalence gate on the same bounded single-edge path.
- Decision:
  - Add product-path and app-path equivalence contracts for:
    - shape-generated `rect`
    - closed single-network rectangle-equivalent `vector`
    - matching constrained dashed `single-edge + inside + round cap` coverage
  - Keep this gate narrow:
    - single-edge only
    - `position: inside`
    - `cap: round`
    - rectangle-equivalent vector only
    - no broader round-cap equivalence completion claim
    - no broader round-family equivalence completion claim
- Consequences:
  - Phase 5 now has the first bounded round-cap shape/vector equivalence proof
    on the same promoted product path that already carried the initial round
    representatives.
  - This lets the rollout move forward without pretending that broader vector
    round-cap equivalence, broader round-join equivalence, or curve-spanning
    round semantics are complete.
  - The next step can move to a new representative frontier instead of staying
    on the same rectangle-equivalent round-cap source pair.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-23 - Phase 6 starts with the first constrained dashed gradient-paint representative on the bounded product path

- Context:
  - Phase 5 had already reached a point where the next valuable move was no
    longer another bounded round-family micro-slice.
  - The narrowest downstream Phase 6 frontier was the first paint-only
    promotion on an already supported constrained dashed geometry path:
    - shape-generated `rect`
    - constrained dashed `full-loop + inside`
    - local-bounds linear gradient paint
  - The first red e2e signal was not a probe mismatch:
    - the selected element computed stroke row already carried `kind: gradient`
      and the authored gradient payload
    - the real app/runtime path still rendered the old solid stroke because the
      benchmark harness had patched computed data without explicitly syncing the
      selected render element, and the inspector does not yet expose
      user-facing stroke-gradient authoring for this slice
- Decision:
  - Promote the first Phase 6 representative with matching helper-level,
    product-path, and app-path contracts for:
    - shape-generated `rect`
    - constrained dashed `full-loop + inside + local-bounds linear gradient paint`
  - Extend the stroke product/property schema so stroke rows preserve:
    - `kind`
    - `gradient`
  - Keep this promotion narrow:
    - shape-generated `rect` only
    - full-loop only
    - `position: inside` only
    - local-bounds linear gradient paint only
    - no vector-generated constrained dashed gradient promotion claim
    - no `outside`, single-edge, or corner-spanning gradient promotion claim
    - no claim that inspector-facing stroke-gradient authoring is complete
- Consequences:
  - Phase 6 now has its first concrete promoted paint slice on top of the
    existing constrained dashed geometry path instead of remaining entirely
    blocked behind Phase 5.
  - This proves that the stroke engine can swap constrained dashed paint from
    solid to gradient without forking geometry ownership/clipping packets.
  - The current app-path benchmark stays honest by explicitly syncing render
    data from the patched computed snapshot, because that harness gap is not
    the same thing as shipping full stroke-gradient editing UI.
  - All broader constrained dashed gradient paint slices remain blocked:
    - vector-generated gradient paint
    - `outside` gradient paint
    - single-edge / corner-spanning gradient paint
    - gradient + variable-width combined slices
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-23 - Phase 6 adds the first vector-generated constrained dashed gradient-paint representative on the bounded product path

- Context:
  - Phase 6 had already promoted the first paint-only slice on the bounded
    shape-generated path:
    - shape-generated `rect`
    - constrained dashed `full-loop + inside + local-bounds linear gradient paint`
  - The next more valuable move was not another `rect`-side paint variant.
    The next honest frontier was the first vector-generated gradient-paint
    representative on an already promoted geometry class:
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `full-loop + inside + local-bounds linear gradient paint`
  - The only failures on the way were contract-level, not runtime regressions:
    - unit initially lacked the same jsdom `canvas.getContext` shim already
      needed by the shape-side Phase 6 contract
    - the first visual oracle incorrectly assumed the vector center should stay
      fill-colored like the `rect` fixture, but this vector fixture has no fill
- Decision:
  - Promote the next Phase 6 representative with product-path and app-path
    contracts for:
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `full-loop + inside + local-bounds linear gradient paint`
  - Keep this promotion narrow:
    - rectangle-equivalent vector only
    - full-loop only
    - `position: inside` only
    - local-bounds linear gradient paint only
    - no broader vector-generated gradient claim
    - no `outside`, single-edge, or corner-spanning gradient claim
- Consequences:
  - Phase 6 now reaches its first vector-generated gradient-paint slice instead
    of stalling on the shape-generated source frontier.
  - This confirms that gradient paint stays paint-only across the first
    shape/vector source split on the constrained dashed full-loop path.
  - Broader vector-generated gradient paint, `outside` gradient paint,
    single-edge gradient paint, corner-spanning gradient paint, and all
    gradient-plus-variable-width slices remain blocked.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-23 - Phase 6 adds the first broader vector-generated constrained dashed gradient-paint representative on the bounded product path

- Context:
  - Phase 6 had already crossed the first shape/vector source boundary for
    constrained dashed gradient paint:
    - shape-generated `rect`
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `full-loop + inside + local-bounds linear gradient paint`
  - The next valuable move was not to go back to another rectangle-equivalent
    or shape-side paint variant.
  - The next honest frontier was the first broader vector-generated gradient
    representative on an already promoted geometry class:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
    - constrained dashed `full-loop + inside + local-bounds linear gradient paint`
- Decision:
  - Promote the next broader vector-generated Phase 6 representative with
    product-path and app-path contracts for:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
    - constrained dashed `full-loop + inside + local-bounds linear gradient paint`
  - Keep this promotion narrow:
    - broader non-rectangle-equivalent quadrilateral vector only
    - full-loop only
    - `position: inside` only
    - local-bounds linear gradient paint only
    - no `outside`, single-edge, or corner-spanning gradient claim
- Consequences:
  - Phase 6 now reaches the first broader vector-generated gradient-paint slice
    instead of stopping at rectangle-equivalent vectors.
  - This confirms that the current paint-only path survives the first broader
    vector source frontier without requiring new runtime branches.
  - `outside` gradient paint, single-edge gradient paint, corner-spanning
    gradient paint, broader equivalence gates, and all gradient-plus-variable-
    width slices remain blocked.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-23 - Phase 6 closes the first gradient shape/vector equivalence gate on the bounded product path

- Context:
  - Phase 6 had already promoted the first bounded gradient-paint source pair
    on the same constrained dashed geometry class:
    - shape-generated `rect`
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `full-loop + inside + local-bounds linear gradient paint`
  - The next honest move was not another gradient geometry variant on the same
    source frontier.
  - The remaining gap on that bounded slice was the matching Phase 6 Family D
    equivalence gate for the first shape/vector source pair.
  - The app-path benchmark could not reuse the old center-leak oracle:
    - the rectangle fixture keeps fill color in its center
    - the vector fixture has no fill, so its center stays absent
- Decision:
  - Add product-path and app-path equivalence contracts for:
    - shape-generated `rect`
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `full-loop + inside + local-bounds linear gradient paint`
  - Keep this gate narrow:
    - rectangle-equivalent source pair only
    - full-loop only
    - `position: inside` only
    - local-bounds linear gradient paint only
    - compare the shared inner-band gradient probes
    - do not claim center-pixel equivalence across mismatched fill semantics
    - no broader vector-generated gradient equivalence claim
    - no `outside`, single-edge, or corner-spanning gradient equivalence claim
- Consequences:
  - Phase 6 now has its first explicit shape/vector gradient equivalence proof
    on the bounded constrained dashed product path.
  - This closes the first Phase 6 Family D checkpoint without pretending that
    broader gradient equivalence, `outside` gradient paint, single-edge
    gradient paint, or corner-spanning gradient paint are complete.
  - The benchmark stays honest by comparing only the shared stroke-band
    gradient probes on the matched `80x40` fixtures, instead of folding the
    rectangle fill center and vector no-fill center into the same oracle.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-23 - Phase 6 adds the first outside constrained dashed gradient-paint representative on the bounded product path

- Context:
  - The first Phase 6 Family D checkpoint had already closed for the bounded
    `inside + full-loop` gradient source pair.
  - The next valuable move was not another equivalence closeout on the same
    bounded inner-band source pair, and it was not yet honest to jump into
    Phase 7 variable width.
  - The next narrowest downstream geometry frontier on the same paint-only path
    was:
    - shape-generated `rect`
    - constrained dashed `full-loop + outside + local-bounds linear gradient paint`
- Decision:
  - Promote the next Phase 6 representative with helper-level, product-path,
    and app-path contracts for:
    - shape-generated `rect`
    - constrained dashed `full-loop + outside + local-bounds linear gradient paint`
  - Keep this promotion narrow:
    - shape-generated `rect` only
    - full-loop only
    - `position: outside` only
    - local-bounds linear gradient paint only
    - no vector-generated `outside` gradient promotion claim
    - no single-edge or corner-spanning gradient claim
- Consequences:
  - Phase 6 now reaches its first `outside` gradient-paint slice instead of
    staying on the same bounded `inside` gradient family.
  - This confirms that the paint-only path also survives the first promoted
    exterior-band geometry slice without changing constrained dashed packet
    ownership/clipping behavior.
  - Vector-generated and broader `outside` gradient paint, single-edge
    gradient paint, corner-spanning gradient paint, and gradient-plus-variable-
    width slices remain blocked.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-24 - Phase 6 adds the first vector-generated outside constrained dashed gradient-paint representative on the bounded product path

- Context:
  - Phase 6 had already promoted:
    - shape-generated `rect + full-loop + outside + local-bounds linear gradient paint`
    - closed single-network rectangle-equivalent `vector + full-loop + inside + local-bounds linear gradient paint`
  - The next honest move was not another bounded `inside` closeout on the same
    source pair.
  - It was also not yet honest to jump into Phase 7 variable width.
  - The next narrowest downstream gradient frontier on the existing paint-only
    path was:
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `full-loop + outside + local-bounds linear gradient paint`
- Decision:
  - Promote the next vector-generated Phase 6 representative with product-path
    and app-path contracts for:
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `full-loop + outside + local-bounds linear gradient paint`
  - Keep this promotion narrow:
    - rectangle-equivalent vector only
    - full-loop only
    - `position: outside` only
    - local-bounds linear gradient paint only
    - no broader non-rectangle-equivalent `outside` gradient claim
    - no single-edge or corner-spanning gradient claim
- Consequences:
  - Phase 6 now reaches the first vector-generated `outside` gradient-paint
    slice instead of staying on the same shape-side exterior-band path.
  - This confirms that the paint-only gradient path survives the first vector
    `outside` source frontier without adding a new runtime branch.
  - Broader non-rectangle-equivalent `outside` gradient paint, single-edge
    gradient paint, corner-spanning gradient paint, and gradient-plus-variable-
    width slices remain blocked.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-24 - Phase 6 adds the first broader vector-generated outside constrained dashed gradient-paint representative on the bounded product path

- Context:
  - Phase 6 had already crossed the first exterior-band gradient source
    frontier:
    - shape-generated `rect + full-loop + outside + local-bounds linear gradient paint`
    - closed single-network rectangle-equivalent `vector + full-loop + outside + local-bounds linear gradient paint`
  - The next honest move was not to return to another `inside` gradient closeout
    on the same bounded source family.
  - It was also not yet honest to jump into Phase 7 variable width.
  - The next narrowest downstream gradient frontier on the same paint-only path
    was:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
    - constrained dashed `full-loop + outside + local-bounds linear gradient paint`
- Decision:
  - Promote the next broader vector-generated Phase 6 representative with
    product-path and app-path contracts for:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
    - constrained dashed `full-loop + outside + local-bounds linear gradient paint`
  - Keep this promotion narrow:
    - broader non-rectangle-equivalent quadrilateral vector only
    - full-loop only
    - `position: outside` only
    - local-bounds linear gradient paint only
    - no `outside` gradient equivalence gate claim
    - no single-edge or corner-spanning gradient claim
- Consequences:
  - Phase 6 now reaches the first broader vector-generated `outside`
    gradient-paint slice instead of stopping at the rectangle-equivalent
    exterior-band path.
  - This confirms that the paint-only gradient path survives the first broader
    non-rectangle-equivalent exterior-band source frontier without adding a new
    runtime branch.
  - Single-edge gradient paint, corner-spanning gradient paint, broader
    gradient equivalence gates, and gradient-plus-variable-width slices remain
    blocked.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-24 - Phase 6 adds the first single-edge constrained dashed gradient-paint representative on the bounded product path

- Context:
  - Phase 6 had already pushed the full-loop gradient source frontier through:
    - shape-generated `rect` inside/outside
    - closed single-network rectangle-equivalent `vector` inside/outside
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
      inside/outside
  - The next honest move was not another full-loop gradient equivalence
    closeout on the same source family.
  - It was also not yet honest to jump into Phase 7 variable width.
  - The next narrowest downstream geometry frontier on the same paint-only path
    was:
    - shape-generated `rect`
    - constrained dashed `single-edge + inside + local-bounds linear gradient paint`
- Decision:
  - Promote the next Phase 6 representative with helper-level, product-path,
    and app-path contracts for:
    - shape-generated `rect`
    - constrained dashed `single-edge + inside + local-bounds linear gradient paint`
  - Keep this promotion narrow:
    - shape-generated `rect` only
    - single-edge only
    - `position: inside` only
    - local-bounds linear gradient paint only
    - no vector-generated single-edge gradient claim
    - no `outside` single-edge gradient claim
    - no corner-spanning gradient claim
- Consequences:
  - Phase 6 now reaches its first single-edge gradient-paint slice instead of
    staying on the same full-loop gradient family.
  - This confirms that the paint-only gradient path also survives the first
    bounded interval-local single-edge geometry slice without changing
    constrained dashed packet ownership/clipping behavior.
  - Vector-generated and `outside` single-edge gradient paint, corner-spanning
    gradient paint, broader gradient equivalence gates, and gradient-plus-
    variable-width slices remain blocked.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-24 - Phase 6 adds the first corner-spanning constrained dashed gradient-paint representative on the bounded product path

- Context:
  - Phase 6 had already pushed constrained dashed gradient paint through:
    - full-loop `inside/outside`
    - single-edge `inside/outside`
    - shape-generated `rect`
    - closed single-network rectangle-equivalent `vector`
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
  - That meant the single-edge gradient family had reached a point where
    further closeout would no longer unblock later work.
  - The next honest downstream geometry frontier on the same paint-only path
    was the first legal-turn interval:
    - shape-generated `rect`
    - constrained dashed `inside + bevel + corner-spanning + local-bounds linear gradient paint`
- Decision:
  - Promote the first corner-spanning Phase 6 representative with helper-level,
    product-path, and app-path contracts for:
    - shape-generated `rect`
    - constrained dashed `inside + bevel + corner-spanning + local-bounds linear gradient paint`
  - Keep this promotion narrow:
    - shape-generated `rect` only
    - corner-spanning only
    - `position: inside` only
    - `join: bevel` only
    - local-bounds linear gradient paint only
    - no vector-generated corner-spanning gradient claim
    - no `miter` corner-spanning gradient claim
    - no `outside` corner-spanning gradient claim
- Consequences:
  - Phase 6 now reaches its first corner-spanning gradient-paint slice instead
    of staying on the already-sufficient single-edge gradient family.
  - This confirms that the paint-only gradient path survives the first legal
    turn on the promoted constrained dashed corner packet without changing
    ownership or legality geometry.
  - Vector-generated, `miter`, and `outside` corner-spanning gradient paint
    slices remain blocked, along with broader gradient equivalence gates and
    gradient-plus-variable-width slices.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-24 - Phase 6 adds the first vector-generated corner-spanning constrained dashed gradient-paint representative on the bounded product path

- Context:
  - Phase 6 had already promoted the first shape-generated legal-turn gradient
    slice:
    - shape-generated `rect + inside + bevel + corner-spanning + local-bounds linear gradient paint`
  - The next honest move was not to stay on the same shape family and close
    out `miter` immediately.
  - The narrower downstream source frontier was:
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `inside + bevel + corner-spanning + local-bounds linear gradient paint`
- Decision:
  - Promote the next vector-generated Phase 6 representative with product-path
    and app-path contracts for:
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `inside + bevel + corner-spanning + local-bounds linear gradient paint`
  - Keep this promotion narrow:
    - rectangle-equivalent `vector` only
    - corner-spanning only
    - `position: inside` only
    - `join: bevel` only
    - local-bounds linear gradient paint only
    - no `miter` corner-spanning gradient claim
    - no `outside` corner-spanning gradient claim
    - no broader non-rectangle-equivalent vector corner-spanning gradient claim
- Consequences:
  - Phase 6 now moves the first corner-spanning gradient slice onto the first
    vector-generated source frontier instead of staying on the same
    shape-generated family.
  - This confirms that the paint-only gradient path survives the first
    rectangle-equivalent vector legal-turn packet without adding a new runtime
    branch.
  - `miter`, `outside`, broader vector corner-spanning gradient slices,
    gradient equivalence gates, and gradient-plus-variable-width slices remain
    blocked.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-24 - Phase 6 adds the first broader vector-generated corner-spanning constrained dashed gradient-paint representative on the bounded product path

- Context:
  - Phase 6 had already promoted:
    - shape-generated `rect + inside + bevel + corner-spanning + local-bounds linear gradient paint`
    - closed single-network rectangle-equivalent `vector + inside + bevel + corner-spanning + local-bounds linear gradient paint`
  - The next honest move was not to return to `miter` on the same source
    family.
  - The narrower downstream source frontier was:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
    - constrained dashed `inside + bevel + corner-spanning + local-bounds linear gradient paint`
- Decision:
  - Promote the next broader vector-generated Phase 6 representative with
    product-path and app-path contracts for:
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
    - constrained dashed `inside + bevel + corner-spanning + local-bounds linear gradient paint`
  - Keep this promotion narrow:
    - broader non-rectangle-equivalent `vector` only
    - corner-spanning only
    - `position: inside` only
    - `join: bevel` only
    - local-bounds linear gradient paint only
    - no `miter` corner-spanning gradient claim
    - no `outside` corner-spanning gradient claim
    - no corner-spanning gradient equivalence gate claim
- Consequences:
  - Phase 6 now pushes the first corner-spanning gradient slice through the
    next broader vector-generated source frontier instead of staying on the
    earlier shape/rectangle-equivalent pair.
  - This confirms that the same paint-only gradient path survives the first
    broader legal-turn packet without adding a runtime branch.
  - `miter`, `outside`, corner-spanning gradient equivalence, and gradient-plus-
    variable-width slices remain blocked.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-24 - Phase 6 adds the first outside corner-spanning constrained dashed gradient-paint representative on the bounded product path

- Context:
  - Phase 6 had already promoted the first corner-spanning gradient source
    frontier for `inside + bevel` across:
    - shape-generated `rect`
    - closed single-network rectangle-equivalent `vector`
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
  - Returning to `inside + miter` would have kept work on the same geometry
    family without moving the gradient rollout to the exterior legal-turn path.
  - The next honest downstream geometry frontier was:
    - shape-generated `rect`
    - constrained dashed `outside + bevel + corner-spanning + local-bounds linear gradient paint`
- Decision:
  - Promote the next Phase 6 representative with helper-level, product-path,
    and app-path contracts for:
    - shape-generated `rect`
    - constrained dashed `outside + bevel + corner-spanning + local-bounds linear gradient paint`
  - Keep this promotion narrow:
    - shape-generated `rect` only
    - corner-spanning only
    - `position: outside` only
    - `join: bevel` only
    - local-bounds linear gradient paint only
    - no `miter` corner-spanning gradient claim
    - no vector-generated `outside` corner-spanning gradient claim
- Consequences:
  - Phase 6 now reaches the first exterior legal-turn gradient slice instead of
    staying on the already-sufficient `inside` corner-spanning family.
  - This confirms that the paint-only gradient path survives the first outside
    corner packet without changing ownership or legality geometry.
  - `miter`, vector-generated `outside` corner-spanning gradient slices,
    corner-spanning gradient equivalence, and gradient-plus-variable-width
    slices remain blocked.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`
## 2026-04-26 - Professional stroke engine execution now has a dedicated handoff file for new conversations and agent transfer

- Context:
  - the active stroke-engine rollout now spans a long execution history with
    repeated source-of-truth updates across:
    - execution plan
    - architecture plan
    - scenario matrix
    - app plans
    - unreleased decision history
  - the user requested a single file that a new conversation or another AI
    agent can read first to know:
    - current execution scope
    - what not to reopen
    - the last green checkpoint
    - the next honest slice
- Decision:
  - add a dedicated handoff file:
    - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-handoff.md`
  - treat it as a resume guide, not a replacement for the existing
    source-of-truth plans
  - keep the handoff file focused on:
    - active rollout scope
    - mandatory expansion discipline
    - latest green baseline
    - next recommended slice
    - known traps such as `src/dist` drift on the preset runtime
- Consequences:
  - future conversations can resume stroke-engine execution from one stable
    entrypoint instead of reconstructing the current state from the full plan
    history
  - other agents now have an explicit file that says what to do next and what
    not to reopen
  - the canonical contract still remains in the execution plan, architecture
    plan, scenario matrix, and app plans
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-handoff.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-26 - Phase 5 closes the outside round-join shape/vector equivalence gate for uniform-width constrained dashed strokes

- Context:
  - Phase 5 had already promoted the bounded `full-loop + outside + round
    join` constrained dashed product path across:
    - shape-generated `rect`
    - closed single-network rectangle-equivalent `vector`
    - closed single-network non-rectangle-equivalent quadrilateral `vector`
  - The next honest work item was not another source expansion, but a Family D
    closeout proving the rectangle-equivalent shape/vector pair stays
    equivalent for the exterior round-join path.
- Decision:
  - Add product-path and app-path contracts for:
    - shape-generated `rect`
    - closed single-network rectangle-equivalent `vector`
    - constrained dashed `full-loop + outside + round join`
  - Keep the gate narrow:
    - rectangle-equivalent source pair only
    - uniform-width only
    - full-loop only
    - outside position only
    - round join only
    - no gradient or variable-width rollout
- Consequences:
  - Phase 5 now has matching Family D evidence for both inside and outside
    round-join full-loop constrained dashed coverage.
  - The current active plan remains focused on uniform-width dashed / round
    completion.
  - Gradient expansion and variable-width product rollout remain future-feature
    work.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-26 - Center-to-constrained dashed vector switching gets explicit app-path visibility guards

- Context:
  - Manual testing reported that a vector with visible `center` dashed stroke
    appeared to disappear after switching the same stroke row to `inside` or
    `outside`, then became visible again when switched back to `center`.
  - Existing app-path coverage already proved the real-created straight open
    vector and simple closed vector paths stayed visible, but it did not cover
    the common repeated-dash switch cycle or a smooth cubic closed-vector
    representative explicitly.
  - A later manual computed-data sample showed the missing case was a closed
    star-like self-intersecting single-network vector with `dashPattern:
    [20,20]`.
- Decision:
  - Add product-path and app-path guards for:
    - real-created open single-network vector
    - real-created simple closed single-network vector
    - simple closed cubic single-network vector
    - the reported closed star-like self-intersecting single-network vector
    - repeated dashed interval pattern such as `20,20`
    - switching the same stroke row from `center` to authored `inside` /
      `outside`
  - Keep open-path switching as a visibility fallback contract only:
    - authored `inside` / `outside` remains in scene data
    - open vectors continue through centered dashed packets because constrained
      open-path semantics are not promoted
    - closed single-network vectors with valid closed legality domains now
      route repeated dashed intervals through constrained dashed packets
    - no new external interface is introduced
- Consequences:
  - The tested app/runtime path no longer depends on a mock or source-only
    assertion for this reported switching flow.
  - Exact constrained open-path, true self-intersecting fill-rule, and
    multi-network dashed geometry remain backlog instead of being promoted by
    this guard.
  - Self-intersecting full-loop constrained dashed absence remains covered;
    repeated multi-interval single-network placement is promoted only when the
    sampled closed legality domain is valid.
  - Chrome DevTools MCP could not be used in this session because the managed
    DevTools browser profile was already locked by an existing process; the
    validation used E2E instead.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-26 - Phase 5 promotes shared center round geometry for uniform-width solid and dashed strokes

- Context:
  - The formal stroke-engine target is now Figma-like uniform-width behavior
    before returning to paint/color or variable-width work.
  - Center dashed round join/cap support depends on the canonical
    `solid-center` polygon builder because dashed intervals reuse the same
    per-interval geometry path.
  - Keeping `solid-center` round joins/caps marked unsupported while enabling
    dashed round geometry would create a false runtime/documentation split.
- Decision:
  - Promote shared centerline round geometry for:
    - `solid + center + round join`
    - `solid + center + round cap`
    - `dashed + center + round join`
    - `dashed + center + round cap`
  - Keep the slice bounded:
    - uniform width only
    - center placement only
    - no paint/color expansion
    - no variable-width rollout
    - constrained `inside` / `outside` round geometry remains owned by the
      constrained dashed/solid matrices
- Consequences:
  - Center dashed no longer treats round join/cap as unsupported.
  - Center solid rectangle visuals now verify round joins as curved corner
    coverage without miter overfill.
  - Open-vector product wiring now verifies round caps as visible terminal
    geometry without square-corner hit coverage.
  - The active plan can continue toward the remaining uniform-width
    inside/outside and constrained round baseline instead of re-entering
    gradient or variable-width work.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-center-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-26 - Stroke engine rollout adds a canonical algorithm flow contract

- Context:
  - The professional stroke engine plan had phase gates and scenario matrices,
    but it did not yet have one canonical step-by-step flow contract mapping
    shape/vector render strategies to packet builders, geometry helpers,
    clipping helpers, render, hit-test, and export outputs.
  - Without that document, future work could keep fixing local visual failures
    without first proving the helper/API sequence and ownership boundary.
- Decision:
  - Add `docs/ai/apps/asyra-design/plans/professional-stroke-engine-algorithm-flow.md`
    as the canonical algorithm-flow contract for the current rollout.
  - Require stroke algorithm changes to update that flow first when helper/API
    sequencing changes.
  - Keep render, hit-test, and export parity anchored on the same
    `SolidCenterStrokeResolvedPacket[]` contract.
- Consequences:
  - Future stroke work must start from scenario family plus flow ownership,
    not screenshot-specific patching.
  - Older stroke manuals remain useful historical references but cannot
    override the professional stroke engine flow contract during this rollout.
  - This does not change runtime behavior by itself; it constrains future
    implementation order and review criteria.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-algorithm-flow.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-26 - Stroke engine rollout adds source-of-truth control docs and retires stale stroke docs

- Context:
  - The professional stroke engine rollout now needs stable development
    controls beyond phase plans:
    - support status
    - temporary promotion flags
    - failure triage
    - manual QA
    - document source-of-truth routing
  - Older stroke manuals and legacy inside-dashed plans can mislead future
    agents because they describe superseded flow, runtime, or priorities.
- Decision:
  - Add current rollout control documents:
    - `docs/ai/apps/asyra-design/plans/stroke-engine-doc-source-of-truth.md`
    - `docs/ai/apps/asyra-design/plans/stroke-engine-support-matrix.md`
    - `docs/ai/apps/asyra-design/plans/stroke-engine-promotion-ledger.md`
    - `docs/ai/apps/asyra-design/plans/stroke-engine-failure-triage.md`
    - `docs/ai/apps/asyra-design/plans/stroke-engine-manual-qa-checklist.md`
  - Retire non-decision-history legacy stroke documents from active authority.
  - Keep decision history append-only; superseded decisions remain in place.
- Consequences:
  - Future stroke work should route through the new source-of-truth document
    before inspecting old search results.
  - Support questions should be answered from the support matrix, not from
    memory or older manual pages.
  - Promotion flags must be tracked in the promotion ledger until replaced by a
    general owner/domain classifier.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-doc-source-of-truth.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-support-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## 2026-04-27 - Constrained dashed promotion topology moves behind classifiers

- Context:
  - The constrained dashed packet builder had accumulated separate bounded
    promotion checks for full-loop round joins, single-edge round caps, and
    corner-spanning joins across rectangle-equivalent and first broader vector
    sources.
  - Adding another source-specific flag would violate the promotion ledger stop
    rule because the current blocker is duplicated topology ownership, not one
    missing representative.
- Decision:
  - Add `classifyConstrainedDashedSource(points, closed)` for the currently
    distinguishable product-path source topology.
  - Add `classifyConstrainedDashedInterval(points, closed, interval, stroke, options)`
    to centralize the existing promotion option checks for:
    - full-loop round joins
    - single-edge round caps
    - corner-spanning joins
  - Keep the existing promotion option names as compatibility opt-ins for the
    current rectangle/oval/vector render strategies.
- Consequences:
  - Packet-building runtime branches must consume classifier output instead of
    duplicating source/interval topology checks.
  - This is a structural refactor, not a new product-surface promotion.
  - Ownership classification and legality-status outputs remain pending before
    constrained dashed can be treated as fully generalized.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-algorithm-flow.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-promotion-ledger.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-support-matrix.md`

## 2026-04-27 - Sampled smooth constrained dashed full-loop round joins are supported

- Context:
  - The constrained dashed matrix supported oval full-loop `inside` /
    `outside` baseline geometry, but the support matrix still treated oval
    round joins as partial.
  - Oval paths are sampled smooth closed loops, so full-loop round joins can be
    accepted without promoting sharp arbitrary vector round joins.
- Decision:
  - Allow `classifyConstrainedDashedInterval` to accept full-loop round joins
    on sampled smooth closed loops.
  - Keep sharp sampled-simple closed loops unpromoted for round joins.
  - Add product-path unit and visual contracts for oval `inside` / `outside`
    constrained dashed full-loop round joins.
- Consequences:
  - `oval` constrained dashed `inside/outside + full-loop + round join` now
    renders through the real app path.
  - This is not arbitrary-vector round-join promotion.
  - The next Figma-like geometry work should still treat sharp joins as their
    own bounded family.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-support-matrix.md`

## 2026-04-27 - Constrained dashed runtime status becomes explicit

- Context:
  - Constrained dashed product wiring needed one place to distinguish exact
    constrained geometry from center fallback and unsupported blocked cases.
  - Before this change, rectangle/oval/vector wiring still inferred that state
    from candidate packet counts and local fallback conditions.
- Decision:
  - Add `classifyConstrainedDashedRuntimeStatus(input)` in
    `packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts`.
  - Return explicit statuses:
    - `accepted`
    - `fallback-to-center`
    - `blocked`
  - Include source topology and ownership classification in the result.
  - Route rectangle, oval, and vector constrained dashed product wiring through
    this status classifier before accepting packets or allowing center
    fallback.
- Consequences:
  - Open-path `inside` / `outside` constrained dashed remains center visibility
    fallback, not exact constrained geometry.
  - Closed-path center fallback must be explicit and bounded.
  - Blocked constrained dashed cases are no longer hidden behind packet-count
    checks.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-algorithm-flow.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-promotion-ledger.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-support-matrix.md`

## 2026-04-27 - Constrained dashed packet ownership moves behind a classifier

- Context:
  - Rectangle and oval constrained dashed wiring accepted candidates only when
    exactly one packet was produced.
  - Vector constrained dashed wiring had its own owner parsing logic based on
    `geometryId`.
  - That split meant repeated visible intervals from one stroke could be
    blocked by packet count, while vector ownership semantics lived outside
    the packet classifier path.
- Decision:
  - Add `classifyConstrainedDashedOwnership(packets)` in
    `packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts`.
  - Accept candidate packets when all constrained dashed packets resolve to one
    owner key.
  - Block no-packet, unparseable-owner, and multiple-owner candidate sets.
  - Route rectangle, oval, and vector constrained dashed product wiring through
    the same ownership classifier.
- Consequences:
  - Repeated constrained dashed intervals from one stroke can render through
    the app path.
  - Multiple constrained dashed stroke owners and multi-network owners remain
    blocked until explicitly promoted.
  - Ownership classification is centralized, but final legality status output
    remains pending.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-algorithm-flow.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-promotion-ledger.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-support-matrix.md`

## 2026-04-27 - Promoted constrained round joins use bounded round geometry

- Context:
  - Phase 5 promotes uniform-width round behavior for supported constrained
    stroke paths.
  - Some constrained dashed full-loop round representatives still reused miter
    geometry as a temporary proxy, which created the wrong product contract
    and could preserve miter spikes where round joins were requested.
  - Manual testing needs supported `inside` / `outside` round joins to be
    visibly correct before broader stroke QA starts.
- Decision:
  - Promote closed constrained solid `round` joins on supported simple paths
    through bounded arc geometry and legality clipping.
  - Treat closed-path `round` caps as terminal no-ops equivalent to other
    closed-loop cap variants.
  - Route promoted constrained dashed full-loop round joins through the same
    constrained round geometry path instead of substituting miter geometry.
  - Keep open-path exact `inside` / `outside` constrained semantics blocked;
    open vectors may still use explicit center visibility fallback.
  - Keep self-intersecting exact constrained legality unpromoted while
    preserving the existing repeated-dash visibility path for reported closed
    star vectors.
- Consequences:
  - Supported closed `solid + inside/outside + round join` paths now have
    product-path unit and visual contracts.
  - Promoted `dashed + full-loop + inside/outside + round join` paths no
    longer rely on miter proxy bounds.
  - Runtime round arc subdivision remains bounded to preserve the `120fps`
    target and `60fps` floor.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-algorithm-flow.md`
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-support-matrix.md`

## 2026-04-27 - Unpromoted sampled repeated dashed intervals stop using doubled-width constrained clipping

- Context:
  - Manual testing found that a closed star-like vector with repeated dashed `inside` / `outside` stroke rendered at roughly double the authored width.
  - The constrained dashed non-full-loop path generated center geometry with `stroke.width * 2` and then relied on constrained clipping.
  - That clipping contract is only valid for promoted source/interval families; sampled star-like intervals had no promoted exact constrained topology.
- Decision:
  - Gate constrained dashed non-full-loop packet generation behind the interval classifier.
  - Keep rectangle-equivalent and first promoted broader simple closed single-edge / corner-spanning families on the constrained path.
  - Keep unpromoted sampled closed non-full-loop intervals, including cubic/star-like vectors, on explicit authored-width center fallback instead of entering doubled-width constrained clipping.
  - Keep self-intersecting exact constrained dashed semantics blocked until fill-rule topology is promoted.
- Consequences:
  - Unsupported star-like repeated dashed `inside` / `outside` vectors remain visible without doubling the stroke width.
  - This is not exact Figma-like inside/outside placement for arbitrary sampled paths; that remains a future promoted topology.
  - The guard prevents a false-success constrained rendering path from masking missing topology coverage during manual QA.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-support-matrix.md`

## 2026-04-28 - Deleted legacy stroke plan files after final package promotion

- Context:
  - The final stroke package is now the only active stroke-engine planning
    authority.
  - Keeping earlier rollout plans, support matrices, scenario matrices,
    promotion ledgers, manual QA checklists, handoff notes, and failure-triage
    files made search results ambiguous and let reviewers treat old assumptions
    as current implementation contracts.
- Decision:
  - Delete legacy stroke planning files outside
    `docs/ai/apps/asyra-design/plans/stroke-engine-final/`.
  - Keep historical reasoning only in app decision history and the final
    analysis report.
  - Update `PLANS.md`, source-of-truth routing, migration rules, phase gates,
    and self-review rules so future stroke docs cannot recreate a second
    archive authority.
- Consequences:
  - Reviewers and implementers have one active stroke entrypoint.
  - Deleted legacy plan names may remain in this append-only decision history,
    but they are no longer valid file references for current behavior.
  - Any still-relevant legacy rationale must be restated in the final package
    before it can affect implementation.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/source-of-truth.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/migration-and-archive-plan.md`
  - `docs/ai/apps/asyra-design/reports/stroke-engine-final-analysis-report.md`

## 2026-04-28 - Closed stroke Phase 1 typed packet and dirty-key foundation

- Context:
  - The final stroke plan requires typed packet metadata and explicit dirty
    keys before shared topology work starts.
  - A pure dirty-key helper was insufficient because runtime packets did not
    yet emit revision sets from real stroke inputs.
  - Constrained dashed packets still had one owner fallback path derived from
    cache-prefix structure, which could recreate the same ambiguity as parsing
    semantic fields from `geometryId`.
- Decision:
  - Add stroke packet revision sets derived from source path points, stroke
    spec, interval allocation, topology classification, ownership metadata,
    legality metadata, paint payload, and preview/exact mode.
  - Preserve revision sets through render, hit-test, export, and debug metadata
    packet families.
  - Integrate `computeStrokeDirtyKeys` into the stroke render cache so cached
    entries record which stages were dirtied by the latest packet revision
    comparison.
  - Require constrained dashed owner identity to come from typed metadata; shape
    callers now pass explicit owner prefixes, and helper fallback no longer
    parses cache prefixes.
- Consequences:
  - Phase 1 can close without claiming Phase 2 shared topology exists yet.
  - Future Phase 2 work can replace the current revision signatures with
    canonical `PathTopologyModel` revisions without changing packet consumers.
  - Product-visible geometry is unchanged; this is a contract and invalidation
    foundation change.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/phase-execution-plan.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/performance-and-dirty-graph.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/function-contracts.md`

## 2026-04-28 - Closed stroke Phase 2 shared PathTopologyModel foundation

- Context:
  - The final stroke plan requires one canonical path-topology object per
    source/network revision before exact one-sided geometry can be promoted.
  - Shape and vector stroke packet helpers still had private topology or
    path-length decisions, which made interval allocation and support
    classification harder to reason about across render, hit-test, export, and
    diagnostics.
  - Compound closed support cannot be promoted if shell/hole behavior is
    inferred from contour orientation alone.
- Decision:
  - Add a shared `PathTopologyModel` builder with stable source/network ids,
    topology family, canonical arc-length basis, contours, legal-domain
    descriptors, and intersection metadata.
  - Route rectangle, oval, and vector render strategies through one shared
    topology object and pass it into center, constrained solid, constrained
    dashed, diagnostics, render, hit-test, and export packet construction.
  - Move dashed interval allocation to topology length and closure state through
    `allocateDashedIntervalsForTopology`.
  - Add compound legal-domain classification based on containment depth, with a
    regression fixture proving same-orientation nested rectangles still classify
    as shell plus hole.
  - Expose a vector path-topology model counter alongside the existing path
    geometry model counter.
- Consequences:
  - Phase 2 can close with shared topology and topology-driven interval
    allocation in place.
  - Packet helpers may keep compatibility fallbacks that self-build topology
    only when older callers do not supply it; render strategies are required to
    supply the shared topology object.
  - Exact high-curvature, acute-corner, and miter one-sided geometry remain
    Phase 3/4 work; Phase 2 only establishes the reusable topology foundation.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/phase-execution-plan.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/target-architecture.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/geometry-pipeline.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/performance-and-dirty-graph.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/function-contracts.md`

## 2026-04-28 - Closed stroke Phase 3 final one-sided solid geometry slice

- Context:
  - The final stroke plan requires constrained solid `inside` / `outside`
    geometry to be selected-side geometry, not doubled-width center geometry
    clipped after the fact.
  - Closed inside bevel joins still reused miter geometry, and miter-limit
    exceedance needed to be asserted as supported bevel resolution rather than
    fallback behavior.
  - Constrained solid packets needed typed contour and legal-domain metadata so
    render, hit-test, and export could preserve the same semantic packet truth.
- Decision:
  - Keep constrained solid off the doubled-width center-band product route.
  - Build closed inside constrained solid from selected-side candidates clipped
    to the source legal domain.
  - Emit explicit bevel join geometry for closed inside bevel joins and for
    miter-limit exceedance.
  - Preserve exact supported runtime metadata for miter-limit bevel resolution.
  - Keep compact exact outside miter/bevel emission where adjacent selected-side
    body faces do not overlap; outside round remains on explicit one-sided arc
    construction.
  - Add typed `contourId`, `legalDomainId`, `sourceTopology`, and
    `topologyFamily` metadata to constrained solid packets and verify parity
    through render, hit-test, and export packet derivation.
- Consequences:
  - Phase 3 can close for the promoted simple constrained solid family.
  - High-curvature candidate self-overlap, true self-intersection, and broader
    arrangement promotion remain governed by later exact-correct gates.
  - Phase 4 can reuse the constrained solid full-loop geometry path for dashed
    exact support without inheriting a doubled-width constrained solid route.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/phase-execution-plan.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/exact-correct-path-algorithm.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/geometry-pipeline.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/function-contracts.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-04-28 - Closed stroke Phase 4 final one-sided dashed geometry slice

- Context:
  - The final stroke plan requires constrained dashed `inside` / `outside`
    support to allocate intervals before geometry and build selected-side
    interval geometry, not widened center packets.
  - Full-loop constrained dashed support already reused constrained solid
    geometry, but interval-local packets needed stronger metadata parity and
    proof that accepted product packets carry topology/legal-domain identity.
  - Runtime accepted/blocked/fallback decisions must remain typed and must not
    infer support from packet ids.
- Decision:
  - Keep full-loop constrained dashed slices on the exact constrained solid
    selected-side geometry path.
  - Keep promoted non-full-loop constrained dashed slices on interval-first
    one-sided construction from the visible source fragment.
  - Keep closed inside interval-local legality clipping on the one-sided
    candidate, not on a doubled-width center packet.
  - Add constrained dashed contour, legal-domain, source-topology,
    topology-family, and interval-topology metadata to full-loop and
    interval-local packets.
  - Verify constrained dashed render, hit-test, and export metadata parity after
    accepted runtime metadata is attached.
- Consequences:
  - Phase 4 can close for promoted constrained dashed slices.
  - Unsupported seam-wrapping, multi-corner, self-intersecting, and
    overlap-heavy exact dashed families remain gated for arrangement and
    ownership hardening.
  - Phase 5 can focus on face partition, ownership, legality, and robustness
    without carrying a widened-center dashed product route.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/phase-execution-plan.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/exact-correct-path-algorithm.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/geometry-pipeline.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/function-contracts.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-04-28 - Stroke Phase 5 arrangement and ownership hardening

- Context:
  - The final stroke plan requires overlap-heavy constrained geometry to pass
    through explicit arrangement faces before ownership and legality.
  - Previous diagnostics exposed owned regions but did not make the arrangement
    policy or per-face partition method first-class.
  - Legality clipping must subtract foreign-owned face regions, not packet
    groups, to avoid duplicate overlap layers.
- Decision:
  - Add an explicit constrained solid arrangement policy named
    `bounded-convex-subset-arrangement`.
  - Publish numeric robustness settings for epsilon, rounding factor,
    max exact subset count, zero-area threshold, tangential-touch handling, and
    coincident-edge dedupe.
  - Emit typed `arrangementFaces` before compatibility `ownedRegions`.
  - Mark exact face regions with
    `partitionMethod: "exact-subset-intersection"` and budget fallback regions
    with `partitionMethod: "fallback-overlap-polygon"`.
  - Route constrained solid legality clipping through foreign-owned
    arrangement faces instead of foreign-owned packet groups.
- Consequences:
  - Phase 5 closes for the current constrained solid overlap/legality slice.
  - `ownedRegions` remain available as compatibility diagnostics, but
    arrangement faces are the stronger ownership input.
  - Broader self-intersection and multi-network semantics remain gated until
    their exact arrangement rules and fixtures are promoted.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/phase-execution-plan.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/geometry-pipeline.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/function-contracts.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/target-architecture.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-04-28 - Stroke Phase 6 open-path exact constrained semantics

- Context:
  - The final stroke plan requires promoted open-path `inside` / `outside`
    strokes to be exact one-sided geometry, not center fallback visibility.
  - Simple open constrained solid and dashed geometry existed, but solid
    packet/runtime tests needed stronger proof that center/native packets are
    replaced by exact constrained packets during parameter changes.
  - Open self-intersecting constrained paths must remain blocked instead of
    silently rendering center fallback.
- Decision:
  - Close Phase 6 for the promoted simple open constrained solid/dashed slice.
  - Keep open constrained solid on selected-side segment, join, and cap
    construction with exact accepted metadata.
  - Keep open constrained dashed on interval-first selected-side geometry with
    accepted open runtime diagnostics.
  - Add solid open center-to-constrained transition coverage so packet family
    and hit geometry change from native center to exact constrained output.
  - Keep open self-intersecting constrained solid/dashed paths blocked with no
    visible fallback packets.
- Consequences:
  - Simple open constrained solid/dashed support is distinguishable from center
    fallback in render, hit-test, export, and diagnostics.
  - Broader open self-intersecting and ambiguous-turn semantics remain gated
    until their arrangement/face rules are promoted.
  - Phase 7 can focus on self-intersection and overlapping multi-network
    semantics rather than simple open-path exactness.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/phase-execution-plan.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/geometry-pipeline.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/function-contracts.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/target-architecture.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-04-28 - Stroke Phase 7 self-intersection and multi-network gating

- Context:
  - The final stroke plan requires exact self-intersection and overlapping
    multi-network support only after face semantics and ownership rules are
    defined.
  - Disjoint multi-network constrained dashed support is already accepted
    through typed per-network ownership diagnostics.
  - Overlapping or boundary-touching networks can require shared-face
    ownership arbitration that is not yet promoted.
- Decision:
  - Close Phase 7 as a gating phase, not as a broad support promotion.
  - Keep self-intersecting constrained solid/dashed paths blocked or
    research-gated.
  - Keep disjoint multi-network constrained dashed vectors accepted per typed
    network owner.
  - Block overlapping or boundary-touching multi-network constrained solid and
    constrained dashed exact packets before product emission.
  - Emit blocked runtime diagnostics for overlapping multi-network constrained
    dashed attempts with zero candidate packets.
- Consequences:
  - Unsupported exact families are no longer allowed to look supported through
    plausible duplicate rendering or fallback visibility.
  - Multi-network overlap ownership remains a future promotion that must define
    face-level ownership before exact support can be claimed.
  - Phase 8 can evaluate performance only against supported or explicitly
    blocked semantic families.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/active-support-scope.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/phase-execution-plan.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/topology-and-product-semantics.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-04-28 - Stroke Phase 8 baseline animation performance contract

- Context:
  - The final stroke plan requires performance targets to be executable gates,
    not aspirational documentation.
  - Current supported CPU geometry slices need a declared baseline benchmark
    before broader animation work can be evaluated honestly.
  - Browser/GPU product performance still requires a separate declared browser
    benchmark suite.
- Decision:
  - Add `packages/preset/src/__tests__/stroke-performance-contract.test.ts` as
    the baseline CPU geometry benchmark suite.
  - Measure 100 moving open points, one high-curvature cubic edit loop, and one
    disjoint multi-network update path across 300 frames.
  - Use 20 warmup frames, average fps `>= 120`, and p95 frame time `<= 16.67ms`
    as the current pass rule.
  - Assert one topology build per network per frame on the multi-network
    workload.
- Consequences:
  - Phase 8 can close for the declared CPU geometry baseline.
  - The benchmark does not claim browser GPU or full product animation
    performance; those require additional declared workloads.
  - Future performance failures must inspect dirty keys, topology reuse,
    interval reuse, and renderer CPU rebuild before changing semantics.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/performance-and-dirty-graph.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/phase-execution-plan.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-04-28 - Removed constrained dashed center fallback and added solid blocked diagnostics

- Context:
  - Final stroke routing must not let unsupported constrained `inside` /
    `outside` cases look supported through legacy center fallback packets.
  - Users switching from center to inside/outside could see a silent
    disappearance because solid constrained unsupported cases emitted no
    product packets and no runtime reason.
  - Existing tests still treated center fallback as a valid migration path for
    reported dashed star/cubic fixtures, which conflicted with the final
    source-of-truth.
- Decision:
  - Remove vector constrained dashed center fallback emission for unsupported
    constrained dashed cases.
  - Remove fallback provenance fields from active stroke packet metadata and
    dirty-key inputs.
  - Add constrained solid runtime diagnostics with typed `accepted` / `blocked`
    status and explicit reasons such as `self-intersecting-blocked`,
    `overlapping-multi-network-blocked`, and `no-packets`.
  - Update tests so unsupported constrained dashed star/cubic fixtures are
    blocked with diagnostics instead of rendered through dashed-center packets.
- Consequences:
  - Unsupported constrained paths may still emit no product geometry, but they
    no longer disappear without a typed runtime reason.
  - Center stroke remains a native `center` alignment feature, not a fallback
    substitute for constrained `inside` / `outside` support.
  - Full product visibility for arbitrary inside/outside paths still requires
    implementing the remaining exact one-sided arrangement families rather than
    reintroducing fallback visibility.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/source-of-truth.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/runtime-data-representation.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-04-28 - Enforced final stroke routing without legacy constrained substitutes

- Context:
  - Final stroke implementation must prefer the new source-of-truth over old
    helper-level opt-ins, fallback counters, and migration compatibility flags.
  - Unsupported constrained paths need typed blocked diagnostics, not
    substitute geometry that makes product support ambiguous.
  - Self-intersecting and degenerate topology must remain visible as typed
    topology state instead of being collapsed into sampled simple-closed
    diagnostics.
- Decision:
  - Remove constrained dashed helper promotion option flags from the active API
    and route support strictly from topology, interval classification, and
    typed ownership.
  - Remove `fallbackCount` and fallback provenance from active constrained
    dashed diagnostics.
  - Add explicit dashed blocked reason `overlapping-multi-network-blocked`.
  - Preserve dashed `self-intersecting` and `degenerate` topology as typed
    metadata and report them as `unsupported-topology`.
  - Update active plans, BDD wording, and tests so blocked constrained paths
    cannot be described as supported through center-derived substitute geometry.
- Consequences:
  - Inside/outside constrained strokes now have only two valid runtime outcomes:
    accepted exact constrained geometry, or typed blocked diagnostics.
  - Remaining unsupported exact families must be implemented through the final
    one-sided/arrangement plan; they cannot be made visible by reusing old
    center-derived paths.
  - Reviewers can audit unsupported visibility by scanning for removed fallback
    contracts and by checking runtime diagnostics.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/source-of-truth.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/active-support-scope.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/runtime-data-representation.md`

## 2026-04-28 - Accepted interval-local self-intersecting dashed visibility

- Context:
  - Runtime inspection showed that reported self-intersecting repeated dashed
    `inside` / `outside` vectors still disappeared because candidate packet
    construction was blocked before any one-sided interval geometry could be
    emitted.
  - The blocked tests asserted absence as success, which hid the product issue
    even though users need at least visible interval-local geometry for common
    repeated dashed edits.
  - The final plan still forbids center-derived fallback geometry; visibility
    must come from authored source intervals and selected-side faces.
- Decision:
  - Allow closed self-intersecting constrained dashed non-full-loop intervals to
    emit direct interval-local one-sided packets.
  - Keep self-intersecting full-loop constrained solid/dashed semantics gated
    until face-arrangement ownership is implemented.
  - Keep packet metadata explicit with `sourceTopology: "self-intersecting"` so
    reviewers do not mistake interval-local visibility for completed full-loop
    exact ownership.
  - Render stroke mesh after fill/path drawing in primitive and vector render
    strategies so resolved stroke geometry remains the top visible product
    geometry.
- Consequences:
  - Reported repeated dashed self-intersecting vectors no longer disappear when
    switched to constrained `inside` / `outside`.
  - This is not a center fallback and does not claim full Figma-like
    self-intersection arrangement support.
  - Full-loop self-intersecting support and overlapping multi-network ownership
    remain separate exactness gates.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/active-support-scope.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/geometry-pipeline.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/topology-and-product-semantics.md`

## 2026-04-28 - Demoted compound product stroke support to gated

- Context:
  - The active support table implied compound closed legal-domain product stroke support was available when explicit legal-region / winding-rule metadata exists.
  - The runtime currently has a containment-depth legal-domain classification helper and regression fixture, but render / hit-test / export packets do not yet consume multi-contour legal domains as product stroke geometry.
  - Claiming product support from classification-only metadata would let implementers skip the exact compound packet path.
- Decision:
  - Keep compound closed legal-domain classification as supported topology metadata.
  - Demote compound closed product stroke geometry with holes to research-gated until product packets consume multi-contour legal domains directly.
  - Update active support, topology semantics, phase notes, and benchmark case wording so no document claims compound product support prematurely.
- Consequences:
  - Current supported-now claims match the implementation surface.
  - Compound hole behavior remains a future exactness gate instead of a hidden false-positive support claim.
  - Reviewers must reject any compound product stroke support claim that lacks render / hit-test / export packet parity over the declared legal domain.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/active-support-scope.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/topology-and-product-semantics.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-04-28 - Promoted basic compound-hole constrained solid slice

- Context:
  - The Figma reference fixture for compound closed paths shows inside stroke behavior is defined against the legal filled region, not raw contour orientation.
  - The outer shell must inset for inside stroke, while the hole contour must invert the selected side so stroke geometry expands into the filled region around the hole.
  - The previous runtime had containment-depth classification but still blocked all overlapping multi-network constrained solid packets.
- Decision:
  - Promote only the basic constrained solid compound slice: exactly one simple closed shell plus one simple closed hole in a containment-only vector.
  - Keep compound dashed, nested ownership chains, intersecting contours, shared edges, and overlapping multi-network ownership blocked or research-gated.
  - Emit one shared compound legal-domain id through render, hit-test, and export packets for the promoted solid slice.
  - Invert authored inside/outside position for the hole contour before building one-sided geometry.
- Consequences:
  - The Q6 donut-like Figma reference behavior now has a product-path implementation and regression coverage.
  - Q5 nested ownership remains blocked by an explicit regression so the basic compound slice cannot accidentally promote nested chains.
  - Compound dashed remains blocked by overlapping-network diagnostics until a dashed legal-domain implementation is explicitly added.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/active-support-scope.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/topology-and-product-semantics.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-04-28 - Promoted Q4/Q5/Q8 Figma SVG fixture slices

- Context:
  - User-supplied Figma SVG exports for Q4, Q5, and Q8 were available after
    MCP quota was exhausted.
  - Q4 outlined SVG showed overlapping solid strokes resolve into compound
    filled geometry and overlapping dashed strokes resolve into filled dash
    subpaths, so source-bounds overlap cannot remain an automatic product
    blocker.
  - Q5 outlined SVG showed nested compound output with containment-depth
    alternation, supporting parity-based shell/hole role assignment.
  - Q8 original/outlined SVGs define a concrete performance fixture family.
- Decision:
  - Promote overlapping simple closed multi-network constrained solid/dashed
    visibility to supported product behavior when typed packets and diagnostics
    are emitted.
  - Promote containment-depth compound constrained solid/dashed vectors,
    including nested parity chains, with odd-depth contours inverting the
    selected constrained side.
  - Add the Q8 reference workload to the CPU performance contract.
  - Keep exact boolean-union minimization for overlapping solid export packets
    as a later optimization, not a visibility blocker.
- Consequences:
  - Inside/outside strokes no longer disappear solely because source bounds
    overlap.
  - Compound dashed and nested containment chains now have product-path
    render/hit/export regression coverage.
  - The supported performance benchmark now covers a denser Figma-derived
    source family.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/active-support-scope.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/reference-research-findings.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-04-28 - Promoted typed-owner constrained dashed multi-stroke diagnostics

- Context:
  - After Q4/Q5/Q8 promotion, the remaining constrained dashed blocker was not
    geometry construction but ownership classification.
  - The runtime still treated multiple parsed owner keys as
    `blocked/multiple-owners`, causing multiple constrained dashed stroke
    layers on one source to disappear even though every packet carried typed
    metadata.
  - The runtime also still exposed old blocked reason names from earlier
    overlap/open-path gating work.
- Decision:
  - Accept multiple constrained dashed owners when every packet carries typed
    owner metadata.
  - Use runtime reason `typed-owners` for accepted multi-layer constrained
    dashed output.
  - Replace stale product-path reason names with explicit unsupported or
    no-candidate reasons.
  - Attach candidate arrangement diagnostics to constrained dashed runtime
    diagnostics so Q4/Q5 and multi-stroke slices expose candidates, overlap
    edges, components, and owned regions when available.
- Consequences:
  - Multiple inside/outside constrained dashed stroke layers no longer disappear
    solely because more than one `strokeId` exists.
  - Disjoint and overlapping multi-network constrained dashed slices keep typed
    accepted diagnostics while arrangement metadata remains inspectable.
  - Legacy blocked reason names remain only in historical decision entries and
    must not be reintroduced into product code.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/active-support-scope.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/target-architecture.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-04-29 - Active reaffirmation for self-intersecting constrained dashed blocking

- Context:
  - This entry is appended after the historical 2026-04-28 promotions so the
    active state is unambiguous without rewriting decision history.
  - The 2026-04-29 reported larger curved self-intersecting vector demonstrated
    that constrained dashed local-side packets are unsafe as product render
    geometry.
- Decision:
  - The active product rule is: self-intersecting constrained dashed
    `inside/outside` strokes are blocked until exact arrangement, legal-domain
    face ownership, and overlap collapse are implemented.
  - Historical local-side constrained dashed promotions remain archived context
    only and must not be used as active implementation authority.
- Consequences:
  - Renderer, hit-test, export, docs, and tests must all treat this slice as
    unsupported/blocked instead of partially rendered.
  - The next implementation slice for this family must start from the final
    stroke-engine plan's arrangement/ownership stages, not from doubled-width
    clipping or local-side interval packet rendering.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/active-support-scope.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/geometry-pipeline.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-04-29 - Blocked self-intersecting constrained dashed product geometry until exact arrangement exists

- Context:
  - A larger user-reported closed self-intersecting curved vector with
    `inside` dashed stroke exposed that local-side constrained dashed packets
    are not safe product geometry.
  - The emitted red dash packets were segment-local strips that ignored the
    final legal face domain at intersections and could overdraw with opacity.
  - The issue is not just overlap; it also affects paint application, hit-test,
    export parity, first-interval visibility, and future image/gradient stroke
    paints.
  - The earlier 2026-04-28 local-side promotion is preserved as historical
    context, but it is no longer the active product decision for constrained
    dashed self-intersecting paths.
- Decision:
  - Block closed and open self-intersecting constrained dashed `inside/outside`
    product packets until exact planar arrangement, face ownership, legality
    clipping, and duplicate/overlap collapse are implemented.
  - Keep constrained solid self-intersecting local-side candidates as a separate
    supported slice, because they do not allocate repeated dash intervals or
    paint multiple interval faces over the same unresolved legal domain.
  - Treat `dashPattern` and `dashOffset` as the only canonical runtime dash
    fields; legacy `dash` / `gap` fields must not drive runtime geometry.
  - Treat stroke color as a paint/fill payload attached after canonical
    geometry; `kind` remains only a compatibility field until the persisted
    stroke payload schema is migrated.
- Consequences:
  - The reported self-intersecting inside dashed figure no longer renders wrong
    red packets; it is blocked consistently with typed diagnostics.
  - Simple and non-self-intersecting constrained dashed strokes continue using
    the supported one-sided geometry path.
  - Exact Figma-like self-intersecting constrained dashed rendering now has a
    clear prerequisite instead of relying on local-side heuristic packets.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/active-support-scope.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/geometry-pipeline.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/reference-research-findings.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/runtime-data-representation.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-04-28 - Cleared remaining active legacy stroke naming and stale report wording

- Context:
  - The final stroke implementation must not leave searchable active artifacts
    that imply the old stroke engine remains available.
  - The shared interval-frame helper had already replaced the old
    `dashed-center-stroke-frames` helper, but the test filename still used the
    removed helper name.
  - The final analysis report is a baseline assessment, but some wording still
    read as if old reset-time risks were current runtime facts.
- Decision:
  - Rename the interval slicing test to
    `packages/preset/src/__tests__/stroke-interval-frames.test.ts`.
  - Keep the test coverage but align the suite name with the shared runtime
    helper.
  - Clarify the final analysis report as a reset-time risk baseline and route
    current authority to the final spec package.
  - Preserve old rollout references only in append-only decision history,
    final-package deletion rules, and report context.
- Consequences:
  - Active code and tests no longer reference the deleted
    `dashed-center-stroke-frames` helper.
  - Reviewers should not infer current runtime state from reset-time risk
    wording in the report.
  - Decision history remains append-only and continues to preserve historical
    rollout references.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/source-of-truth.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/migration-and-archive-plan.md`
  - `docs/ai/apps/asyra-design/reports/stroke-engine-final-analysis-report.md`

## 2026-04-28 - Hardened tangential overlap diagnostics and dash offset normalization tests

- Context:
  - The final stroke spec requires arrangement robustness to treat tangential
    touch as boundary adjacency, not as a zero-area ownership face.
  - Constrained solid ownership diagnostics declared this policy but lacked an
    explicit tangential-touch fixture.
  - Center dashed overlap diagnostics are diagnostic-only, but false owned
    regions can still mislead QA and reviewers.
  - Dash offset normalization is a required test group and negative offsets must
    resolve to the equivalent positive pattern-cycle position.
- Decision:
  - Require constrained solid ownership diagnostics to emit no arrangement face
    or owned region for edge-touch and point-touch fixtures.
  - Keep tangential candidates connected in the diagnostic graph while
    suppressing zero-area ownership output.
  - Apply the same positive-area overlap guard to center dashed ownership
    diagnostics so bounds-only adjacency cannot become an owned region.
  - Add a negative dash-offset interval allocation regression.
- Consequences:
  - Tangential adjacency remains inspectable without producing duplicate or
    zero-area semantic faces.
  - Center dashed debug overlays no longer imply ownership where only boundary
    contact exists.
  - Dash interval allocation has direct coverage for negative offset
    normalization.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/geometry-pipeline.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-04-28 - Added intra-candidate self-overlap arrangement diagnostics

- Context:
  - The self-intersecting local-side candidate path emitted multiple polygons
    inside a single candidate.
  - Ownership diagnostics previously emitted owned regions only for overlap
    between different candidates, leaving single-candidate self-overlap as a
    diagnostics blind spot.
  - Full legal-domain face arrangement still requires future reference-backed
    ownership and duplicate-collapse rules.
- Decision:
  - Add an `intra-candidate-intersection` arrangement face partition method.
  - Emit positive-area intersections between polygons inside the same candidate
    as arrangement faces and owned regions.
  - Keep the resulting regions scoped to the same candidate id and owner stroke
    id; do not reinterpret them as final legal-domain faces.
- Consequences:
  - Closed self-intersecting constrained solid/dashed candidates now expose
    candidate-local overlap faces in diagnostics.
  - Future face ownership work has observable intermediate geometry instead of
    having to rediscover candidate-local overlaps from packet polygons.
  - Product render visibility remains unchanged; this is a diagnostics and
    arrangement-foundation slice.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/target-architecture.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-04-28 - Added duplicate polygon normalization before packet emission

- Context:
  - Self-intersecting local-side candidates can contain multiple polygons inside
    one resolved packet.
  - Full partial-overlap boolean collapse is not ready, but exact duplicate
    polygons can create unnecessary overdraw and duplicated export/hit data.
  - Render / hit-test / export must still derive from the same resolved
    geometry family and must not lose reference stability when no normalization
    is needed.
- Decision:
  - Add resolved stroke packet geometry normalization for duplicate polygon
    signatures.
  - Treat forward and reversed point order as the same polygon signature.
  - Apply normalization before render entry, hit packet, and export packet
    emission.
  - Preserve original geometry references when no duplicate polygon exists.
- Consequences:
  - Exact duplicate overdraw is removed from render / hit-test / export.
  - Partial-overlap subtraction and full boolean union remain future slices.
  - Existing render / hit / export parity remains intact for packets without
    duplicate polygons.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/target-architecture.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-04-28 - Promoted round self-intersecting constrained dashed local-side visibility

- Context:
  - The previous self-intersecting local-side promotion kept round full-loop
    constrained dashed joins gated.
  - The constrained solid local-side builder already produces deterministic
    round join faces for closed self-intersecting paths.
  - Keeping dashed round joins blocked would preserve a disappearance path even
    though the geometry source is available.
- Decision:
  - Accept closed self-intersecting constrained dashed full-loop round joins as
    local-side candidate visibility.
  - Preserve `sourceTopology = self-intersecting` and avoid claiming completed
    legal-domain face arrangement.
- Consequences:
  - Closed bow-tie constrained dashed strokes with round joins no longer
    disappear.
  - Full Figma-like face ownership, duplicate collapse, and overlap removal for
    self-intersections remain future arrangement work.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/active-support-scope.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/target-architecture.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-04-28 - Promoted closed self-intersecting constrained solid local-side candidates

- Context:
  - Closed self-intersecting constrained solid paths were blocked at the
    geometry-builder entry point because closed constrained solid required
    `isSimpleClosedPolygon`.
  - This caused the full stroke to disappear even though the engine can build
    deterministic one-sided segment and join faces directly from the authored
    local side.
  - Full legal-domain face ownership for self-intersections is still a larger
    arrangement problem and should not be claimed by this slice.
- Decision:
  - Promote closed self-intersecting constrained solid paths to local-side
    candidate visibility.
  - Keep `sourceTopology` and `topologyFamily` as `self-intersecting` in packet
    metadata and runtime diagnostics.
  - Do not clip inside self-intersecting candidates to the raw source boundary,
    because the source boundary is not a simple legal region.
  - Promote supported non-round self-intersecting constrained dashed full-loop
    strokes through the same local-side candidate geometry.
  - Keep round-join self-intersecting constrained dashed full-loop and full
    legal-domain face semantics research-gated.
- Consequences:
  - Closed bow-tie constrained solid and non-round full-loop dashed strokes no
    longer disappear on the product render path.
  - The promoted slice is deterministic and test-covered, but it is explicitly
    not the final Figma-like self-intersection face arrangement.
  - Future arrangement work must replace or refine these local-side candidates
    only after reference-backed face ownership rules are available.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/active-support-scope.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/target-architecture.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-04-29 - Final active reaffirmation for self-intersecting constrained dashed blocking

- Context:
  - This entry is appended after all historical 2026-04-28 promotions so the
    active state is unambiguous without rewriting earlier decision history.
  - The 2026-04-29 larger curved self-intersecting vector showed that
    constrained dashed local-side packets are unsafe product geometry.
- Decision:
  - The active rule is: self-intersecting constrained dashed `inside/outside`
    strokes are blocked until exact arrangement, legal-domain face ownership,
    and overlap collapse are implemented.
  - Historical local-side constrained dashed promotions remain decision history
    only and must not be used as current implementation authority.
- Consequences:
  - Renderer, hit-test, export, docs, and tests must treat this slice as
    unsupported/blocked instead of partially rendered.
  - The next implementation slice for this family must start from the final
    stroke-engine plan's arrangement/ownership stages, not doubled-width
    clipping or local-side interval packet rendering.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/active-support-scope.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/geometry-pipeline.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-04-29 - Replaced self-intersecting constrained dashed blocking with local-side approximation visibility

- Context:
  - Product review rejected both disappearance and center fallback for authored
    `inside/outside` strokes.
  - If a user selects `inside` or `outside`, the product render path must keep
    the constrained side even when exact self-intersection face arrangement is
    not implemented.
  - Center fallback changes the user's requested stroke semantics and is not an
    acceptable safety path.
- Decision:
  - Emit self-intersecting constrained dashed `inside/outside` strokes as
    local-side approximation product geometry.
  - Mark those packets with `geometryFamily: "constrained-dashed"`,
    `sourceTopology: "self-intersecting"`, and
    `resolutionStatus: "local-side-approximation"`.
  - Keep exact legal-domain face arrangement, duplicate collapse, and overlap
    semantics as future exactness work.
  - Forbid center-derived substitute packets for authored constrained strokes.
- Consequences:
  - Self-intersecting dashed `inside/outside` strokes stay visible instead of
    disappearing.
  - Render, hit-test, and export preserve the authored constrained stroke
    family and expose approximation status through typed metadata.
  - Tests must assert constrained local-side geometry, not blocked output and
    not center fallback.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/active-support-scope.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/geometry-pipeline.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/runtime-data-representation.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-04-29 - Removed stroke visibility blockers that acted like hidden fallbacks

- Context:
  - A follow-up audit checked for fallback behavior that changes or erases the
    user's authored stroke parameters.
  - The active product rule is that authored `style`, `position`, `join`, `cap`,
    `dashPattern`, and `dashOffset` must be rendered on their own semantic path.
  - Miter-limit exceedance remains the one accepted join fallback, because the
    user-facing behavior matches Figma's bevel-like limit handling.
- Decision:
  - Keep sharp sampled full-loop constrained dashed round joins visible through
    selected-side constrained geometry instead of blocking them.
  - Keep seam-wrapping constrained dashed intervals visible and preserve
    `wrapsSeam` metadata instead of dropping the authored dash interval.
  - Keep open non-simple constrained solid strokes visible as local-side
    approximation packets, matching the constrained dashed visibility policy.
  - Do not introduce center fallback or parameter rewriting for these cases.
- Consequences:
  - More edge cases may show approximation artifacts, but users see the stroke
    they asked for instead of losing the whole stroke.
  - Exact reference parity for these slices remains future work, but runtime
    packets now expose approximation status where applicable.
  - Tests now assert visible constrained packets for these cases.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/active-support-scope.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/function-contracts.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-04-29 - Open path stroke alignment is center-equivalent

- Context:
  - Product review clarified that open paths have no inside/outside domain from
    the user's point of view.
  - Changing an open path from `center` to `inside` or `outside` must not move
    the stroke, remove the stroke, or enter a constrained geometry fallback.
  - Earlier local-side open-path decisions remain historical context, but they
    no longer describe the active product behavior.
- Decision:
  - Treat authored `inside` and `outside` stroke positions on open paths as
    center-equivalent for render, hit-test, and export.
  - Preserve the authored UI value in stroke data, but normalize the per-network
    geometry input to `center` before product packet construction.
  - Do not emit constrained solid or constrained dashed runtime diagnostics for
    open paths solely because the authored position is `inside` or `outside`.
- Consequences:
  - Open solid strokes emit `solid-center` packets with
    `resolutionStatus: "native-center"` and
    `runtimeStatus: "not-applicable"`.
  - Open dashed strokes emit `dashed-center` packets with
    `resolutionStatus: "native-center"` and
    `runtimeStatus: "not-applicable"`.
  - Position changes on open paths must not dirty constrained geometry families;
    they only affect authored state unless another geometry-affecting parameter
    also changes.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/active-support-scope.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/geometry-pipeline.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/topology-and-product-semantics.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-04-29 - Applied official Figma stroke reference findings to active contracts

- Context:
  - Figma official documentation defines `strokeAlign` containment semantics,
    documents line-default center behavior, and states SVG export only supports
    center strokes while preserving inside/outside appearance through
    simplification.
  - Figma node APIs expose `strokeGeometry` as center-based regardless of
    `strokeAlign`; outline-style geometry is the appropriate visual reference
    for constrained appearance.
  - Figma REST exposes `strokeMiterAngle` with default `28.96` degrees, which
    maps to SVG miter limit `4`.
- Decision:
  - Keep Asyra's active open-path product contract center-equivalent for
    authored `inside` / `outside`; this is an explicit product simplification,
    not a fallback.
  - Treat center stroke packets as analogous to Figma's center-based
    `strokeGeometry` view, not as proof of closed constrained appearance.
  - Normalize authored `miterAngle` into SVG-style `miterLimit` with
    `miterLimit = 1 / sin(miterAngle / 2)`.
  - Treat `miterAngle = 0` as infinite miter limit instead of resetting to the
    default `28.96` degree threshold.
- Consequences:
  - Closed constrained strokes still require resolved one-sided or arrangement
    geometry for product appearance.
  - Open paths remain center-equivalent in render, hit-test, and export.
  - Miter threshold normalization now has explicit edge-case coverage for `0`,
    `28.96`, and `180` degrees.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/reference-research-findings.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/runtime-data-representation.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/topology-and-product-semantics.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-05-04 - Promote self-intersecting inside solid to exact arranged visual collapse

- Context:
  - The reported vector-6 self-intersecting closed star with inside solid stroke
    exposed a false completion standard: global E2E could pass while authored
    segments disappeared or overlap opacity returned in local crops.
  - The previous active docs still required self-intersecting constrained solid
    to remain a local-side candidate family even after exact arrangement became
    available, which conflicted with the current source-of-truth plan requiring
    one final geometry family for render, hit-test, and export.
- Decision:
  - Promote self-intersecting constrained solid full-loop candidates through
    exact arrangement for the current product slice.
  - Preserve typed one-sided per-source-segment candidates and do not use source
    self-intersections as clipping boundaries.
  - Collapse same-visual overlap into one final visual layer while preserving
    owner/source-span metadata for downstream projection.
  - Keep constrained dashed self-intersecting exact promotion gated; dashed
    interval ownership and legal-domain clipping still require a separate exact
    oracle.
- Consequences:
  - Reported vector-6 inside solid must keep all five authored segments visible
    in global visual tests and in local crops for five endpoints, five
    self-intersections, and authored segment bodies.
  - Red alpha overlap in the same visual packet must not become darker than one
    product layer.
  - Future claims of completion for this slice require the visual artifacts to
    be inspected, not only E2E command success.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/active-support-scope.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/geometry-pipeline.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/target-architecture.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/testing-and-benchmark-spec.md`

## 2026-05-31 - Stroke rule authority narrowed after inside solid Figma mismatch

- Context:
  - Current app screenshots show grid/vector-network self-intersecting inside
    solid rendering does not match Figma: internal shared edges render as
    independent full-width strips and internal pentagon corners do not follow
    `strokeJoin` / `strokeMiterLimit`.
  - Prior stroke docs and reports preserved mutually conflicting rules,
    including direct one-sided solid geometry and completed-matrix claims.
- Decision:
  - Treat old one-sided solid docs, completed plan copies, BDD feature text, and
    the stroke final analysis report as wrong or stale for current rules.
  - Keep current stroke rules only in:
    `docs/ai/apps/asyra-design/PLANS.md`,
    `docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md`, and
    `docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js`.
  - Keep `stroke-flow-inspector.html` only as a non-authoritative viewer shell.
  - Record wrong decisions only in decision history. Do not preserve wrong
    specification files as tombstones, completed copies, reports, or BDD
    features.
- Consequences:
  - Solid inside/outside rule authority is Figma-style doubled authored center
    stroke plus filled-region or exterior mask, not direct one-sided solid
    visible geometry.
  - The stroke engine remains reopened until implementation probes and reviewed
    screenshots prove Figma parity.
  - Decision history can contain obsolete decisions, but active docs cannot use
    them as rule sources.

## 2026-06-03 - Inside dashed constrained strokes use doubled center-dashed mask geometry

- Context:
  - App screenshots for self-intersecting inside dashed strokes showed dash
    silhouettes that differed from the Figma reference even when split-range
    interval allocation, inside residue, and overdraw checks passed.
  - Historical dashed entries still described one-sided constrained dashed
    visible geometry. Those entries conflicted with the current Figma parity
    target.
- Decision:
  - Constrained `inside` dashed visible product geometry is the authored center
    dashed stroke built at `stroke.width * 2`, preserving authored dash
    allocation, cap, join, and miter limit, clipped by the inside filled-region
    mask.
  - Split source ranges still own dash allocation: each cut range keeps half-dash
    terminals at both ends with evenly distributed middle gaps.
  - Direct one-sided ribbons, local-side fallback strips, and diagnostic
    derivation fragments are not product-visible geometry for inside dashed
    strokes.
- Consequences:
  - Unit tests must compare actual inside dashed product polygons against a
    doubled center-dashed clipped reference, not only inside residue or gap
    visibility.
  - Empty inside clips are illegal fragments and must be dropped, not replaced
    by fallback geometry.
  - Older one-sided dashed decision-history entries are superseded for current
    active rules.
