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

## 2026-03-01 - `bezier-js` geometry adoption plan completed and archived

- Context:
  - The near-term app plan for `bezier-js` adoption was executed: dependency integration, adapter boundary, cubic bounds migration, and curve proximity hit-testing wiring.
- Decision:
  - Archive completed `bezier-js` adoption plan:
    - `docs/ai/apps/asyra-design/plans/completed/adopt-bezier-js-for-pen-geometry-plan.md`
  - Remove the completed `bezier-js` item from active near-term planning list.
  - Keep future geometry expansion work in separate active plans (sub-path model, geometry domain model).
- Consequences:
  - Active app plans remain focused on unfinished work only.
  - Completed `bezier-js` adoption remains discoverable through archive + decision history.
- Related Commit(s):
  - `13ee980` (`feat(asyra-design): integrate bezier-js geometry adapter and path proximity checks`)

## 2026-03-01 - Pen editing UX plan completed and archived

- Context:
  - The pen editing UX scope (bezier drag handles, handle selection targets, render consistency, and related panel/doc/test sync) is implemented.
- Decision:
  - Archive completed plan:
    - `docs/ai/apps/asyra-design/plans/completed/pen-bezier-drag-controls-plan.md`
  - Remove the completed pen-editing UX item from active near-term planning list.
- Consequences:
  - Active app plans remain focused on unfinished items.
  - Completed pen-editing UX scope is retained in app completed-plan archive.
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
  - Active plan item for sub-path model is completed and archived as topology-native completion.
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
  - Archive plan:
    - `docs/ai/apps/asyra-design/plans/completed/pen-handle-visibility-neighbor-window-plan.md`
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
  - Archive completed plan:
    - `docs/ai/apps/asyra-design/plans/completed/pen-resume-subpath-from-point-plan.md`
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
  - Re-evaluate hovered target after delete by calling hover feature API via `importFeature(FeatureNames.HOVER_ELEMENT)`.
  - Expand E2E coverage for delete flow regressions and undo-commit quality (including compact drag-create commit assertions).
- Consequences:
  - Delete flow behavior is deterministic for undo/redo and mode boundaries.
  - Hover/selection state is no longer stale after delete.
  - Regression coverage now guards the previously reported delete/undo issues.
- Related Commit(s):
  - `5e3296d` (`feat(asyra-design): finalize delete flow and scene-tree remove contracts`)
