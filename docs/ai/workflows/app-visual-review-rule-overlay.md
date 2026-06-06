# App Visual Review Rule Overlay

This document defines the shared app visual review contract for all Asyra apps and future visual features.

## Purpose

An app visual review is not a screenshot gallery and not a visual smoke test. A visual review is a rule-complete oracle rendered on top of the real app frame.

For any feature state being claimed as visually correct, the review artifact must prove the feature rules in one synchronized frame. If a rule is not represented and evaluated in that frame, the review is incomplete.

## Required Artifact

Every app visual review must produce a single-frame rule overlay artifact for each reviewed state.

The artifact must be built from:

1. The real app-rendered frame.
2. Runtime model data captured from the same frame.
3. A deterministic oracle derived from the model data and feature contract.
4. In-frame overlays that show expected geometry, forbidden geometry, probes, and failures.
5. Machine-readable metrics generated from the same pixels and same runtime snapshot.

Standalone renderers, helper canvases, isolated geometry demos, and screenshot-only attachments are not sufficient.

## Single-Frame Rule

For a single visual state, all relevant rules must be judged against the same captured app frame.

The overlay must include, in the same image:

- actual app pixels;
- model reference geometry;
- expected visible regions;
- forbidden regions;
- positive probes;
- negative probes;
- edge-case probes;
- failure markers;
- a compact legend or encoded marker scheme.

If the feature has multiple required states, such as before/after, hover/edit, animation frames, drag start/drag move/drag end, undo/redo, or responsive viewports, each state requires its own complete single-frame overlay. A passing overlay for one state cannot prove another state.

## Runtime Parity

Before generating the overlay, the review must assert that the runtime state matches the reviewed feature state.

The captured metadata must include all fields that affect rendering or interaction for the feature. Examples:

- object id or selected target id;
- geometry and transforms;
- styling and paint fields;
- visibility and opacity;
- feature mode, interaction mode, and selected/hovered/editing state;
- viewport, zoom, device scale factor, and scroll position;
- app route and base URL;
- runtime data hash or canonical snapshot.

If runtime parity cannot be asserted, the screenshot may be described as visual-only evidence, but it cannot be used to claim correctness.

## Rule Inventory

Before writing or running the visual review, list the complete rule inventory for the feature.

The inventory must include:

- positive rules: where pixels or UI state must appear;
- negative rules: where pixels or UI state must not appear;
- boundary rules: exact edges, caps, joins, masks, constraints, clips, hit areas, or terminal states;
- provenance rules: whether output must be traceable to source data, ids, intervals, components, or transactions;
- state rules: selected, hovered, focused, editing, disabled, hidden, undo/redo, loading, or error states;
- edge cases: high curvature, self-intersection, overlap, empty state, no-fill/no-content, viewport scaling, zoom, device pixel ratio, clipped containers, and repeated instances;
- regression risks: known ways the feature has previously looked plausible while being wrong.

Any omitted applicable rule makes the review incomplete.

## Overlay Layers

A complete overlay should use stable, high-contrast layers. The exact colors may vary by app, but the meanings must be unambiguous.

- Model reference: canonical model geometry or expected layout reference.
- Expected visible region: area where the feature must render.
- Forbidden region: area where the feature must not render.
- Expected gap/empty region: area that must remain unpainted or inactive.
- Boundary or terminal region: caps, joins, endpoints, constraints, or edge ownership.
- Positive probes: sampled points or regions that must pass.
- Negative probes: sampled points or regions that must fail if painted/active.
- Failure markers: missing expected output, wrong-side output, forbidden leak, gap leak, drift, overdraw, duplicate output, clipping error, z-order error, stale state, or timing mismatch.

The overlay must not hide the actual pixels being judged. Use transparency, outlines, or offset markers when necessary.

## Pixel and Geometry Oracle

Visual correctness must be derived from both model-space geometry and screen-space pixels.

The oracle must:

1. Convert runtime model data to expected screen-space geometry using the same viewport/zoom captured from the app.
2. Sample actual app pixels or rendered DOM/canvas output.
3. Test expected output and forbidden output independently.
4. Report per-source/per-component results, not only aggregate totals.
5. Fail on dominance inversion, where output exists but appears mostly in the forbidden region.
6. Fail on plausible-but-wrong output, such as mirrored side, shifted geometry, partial segment dropout, wrong mask side, wrong cap/join, or overdraw.

Human visual inspection may catch additional issues, but it must not replace the oracle.

## Metrics

Every overlay must have machine-readable metrics generated from the same frame.

Required metric categories:

- recall: expected output present;
- precision/leak: forbidden output absent;
- gap/empty correctness: expected empty areas remain empty;
- per-source coverage: each source segment/component/region independently checked;
- drift: model reference versus actual output alignment;
- overlap/duplication: unexpected darker pixels, double-render, repeated output, or z-order collision;
- boundary correctness: caps, joins, edges, clips, masks, terminals, or constraints;
- state correctness: selected/hover/edit/focus/disabled/hidden states match expected runtime state.

Thresholds must be documented per feature. A zero-tolerance rule must use zero or a named raster tolerance, not an implicit visual judgment.

## Pass Criteria

An app visual review passes only when all of the following are true:

1. The live app base URL and runtime state are synchronized.
2. The rule inventory is complete for the claimed feature state.
3. The single-frame overlay contains all expected and forbidden rule layers.
4. The automated oracle passes every positive, negative, boundary, state, and edge-case rule.
5. The agent inspects the overlay and confirms the marked output matches the rule results.
6. The final report names the screenshot path, metadata path, metrics summary, and remaining differences.

If any rule fails, the visual review fails even if the plain screenshot looks plausible.

## Failure Categories

Visual review tests should classify failures using stable names:

- `missing_expected_output`
- `wrong_side_output`
- `forbidden_region_leak`
- `gap_leak`
- `boundary_missing`
- `boundary_excess`
- `terminal_missing`
- `join_or_corner_mismatch`
- `clip_or_mask_mismatch`
- `model_render_drift`
- `overdraw_or_double_render`
- `source_dropout`
- `z_order_mismatch`
- `stale_runtime_state`
- `interaction_state_mismatch`

Reports should include counts and sample coordinates for each category.

## Agent Reporting Contract

A final completion report for visual work must distinguish:

- `E2E passed`: automated tests passed.
- `rule overlay passed`: the single-frame rule overlay oracle passed.
- `agent visual inspection passed`: the agent inspected the overlay and found no visible mismatch.

Never claim visual correctness from `E2E passed` alone.

The report must include:

- base URL;
- command;
- reviewed state;
- screenshot path;
- metadata path;
- metric summary;
- inspected rules;
- remaining differences or risks.

