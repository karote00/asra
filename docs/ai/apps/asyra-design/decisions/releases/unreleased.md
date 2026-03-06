# Unreleased App Decision History (Asyra Design)

Decision log for app-scoped changes not yet captured in a release snapshot.

Append-only rule: do not edit/delete prior entries; add superseding entries when decisions change.

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
