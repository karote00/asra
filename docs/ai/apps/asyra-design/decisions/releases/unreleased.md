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
