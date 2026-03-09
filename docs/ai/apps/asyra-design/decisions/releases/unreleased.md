# Unreleased App Decision History (Asyra Design)

Decision log for app-scoped changes not yet captured in a release snapshot.

Append-only rule: do not edit/delete prior entries; add superseding entries when decisions change.

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
  - Follow-up framework work is now explicitly tracked under `docs/ai/framework/plans/property-driven-computed-sync-plan.md`.
- Related Plan:
  - `docs/ai/apps/asyra-design/plans/completed/repeatable-fills-properties-plan.md`
