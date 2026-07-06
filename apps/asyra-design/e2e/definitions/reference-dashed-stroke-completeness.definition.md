# Reference Dashed Stroke Completeness

Authority note: this file is non-authoritative reference material for later
E2E/visual review. It must not define current stroke semantics, correctness
gates, inspector owner stages, route conditions, or product output rules.

## Purpose

This reference note records later-phase evidence for **full-path dashed-stroke completeness** on the reference 5-anchor closed vector.

It does **not** verify only the first dash or a few local probes.
It verifies that the renderer paints the dashed inside stroke across the **entire closed path** without segment dropouts, large missing spans, or broad gap leakage.

## Fixture Inputs

- path geometry is built by real UI pen-tool actions
- path closes on the authored first anchor
- stroke width is `10`
- stroke style is `dashed`
- dash length is `30`
- gap length is `40`
- stroke position is `inside`
- stroke join type is `round`
- stroke color is `#d90909`
- stroke opacity is `0.5`
- dash phase begins at the authored path origin

## Viewport Normalization Rule

- the test exits path editing
- clears element selection by clicking blank canvas
- runs `Cmd+1` zoom-fit before capture
- screenshot analysis must use the actual `zoom` and `viewportPosition`

## Oracle Shape

The measurement approach is **path-guided**, not screenshot-golden-based.

The test reconstructs the authored closed path from the vector snapshot and:

1. builds a full-path arc-length traversal for every segment
2. samples points along the entire path at fixed distance steps
3. computes the local inward normal from path direction and authored point order
4. probes the final screenshot on:
   - the expected inside stroke side
   - the outside side
5. compares actual painted coverage against the authored dash/gap pattern

## Derived Observables

The benchmark measures:

- `inside_dash_recall`
  - ratio of expected dash samples that are actually painted
- `inside_gap_leak_rate`
  - ratio of expected gap samples that are incorrectly painted
- `outside_leak_rate`
  - ratio of outside-side samples that are incorrectly painted
- `worst_segment_dash_recall`
  - lowest dash recall among all authored path segments
- `longest_expected_miss_span`
  - longest continuous distance where paint was expected but missing
- `segment_N_dash_recall`
  - per-segment dash completeness metric
- `stable_dash_body_length_span`
  - span of measured full-width coverage runs after filtering out tiny one-sample fragments
  - this is diagnostic only
  - it does **not** yet mean "cap-excluded dash body length"
  - it is currently used to detect obvious screenshot/runtime measurement drift, not to certify authored dash length consistency
- `stable_mesh_dash_body_length_span`
  - runtime-mesh counterpart of the same full-width coverage span
  - diagnostic only
- `expected_cap_excluded_dash_body_length_span`
  - span of measured raster body runs inside the theoretical cap-excluded body window for ambiguity-filtered full dashes
  - the theoretical body window is `[dashStart + strokeWidth / 2, dashEnd - strokeWidth / 2]`
  - `dashStart` / `dashEnd` here are the benchmark's ambiguity-filtered full-dash interval bounds, not raw authored dash token bounds
  - raster body coverage inside this window uses a softer `0.6` cross-section threshold so anti-aliasing does not collapse otherwise full-width body samples
  - diagnostic only
- `expected_cap_excluded_mesh_dash_body_length_span`
  - runtime-mesh counterpart of the same ambiguity-filtered full-dash body window measurement
  - diagnostic only
- `expected_cap_excluded_dash_body_deviation_max`
  - maximum absolute deviation between measured raster body length and theoretical full-dash cap-excluded body length
  - diagnostic only
- `expected_cap_excluded_mesh_dash_body_deviation_max`
  - runtime-mesh counterpart of the same full-dash body deviation metric
  - diagnostic only
- `selected_high_zoom_local_mask_iou`
  - IoU between the selected high-curvature local screenshot and the runtime mesh mask
  - diagnostic only
- `selected_high_zoom_local_overlay_adjusted_mask_iou`
  - IoU after discounting mesh-only pixels whose screenshot color is dominated by edit-state overlay UI
  - diagnostic only
- `selected_vs_deselected_high_zoom_local_mask_iou`
  - IoU between the selected high-curvature local screenshot and the deselected local screenshot
  - diagnostic only
- `deselected_high_curvature_turn_local_mask_iou`
  - IoU between the deselected high-curvature local screenshot and the runtime mesh mask
  - diagnostic only
- `deselected_high_curvature_turn_overlay_adjusted_mask_iou`
  - IoU after discounting mesh-only pixels whose screenshot color is dominated by UI overlay/path chrome
  - diagnostic only

## Ambiguity Filtering Rule

The benchmark excludes samples near:

- dash/gap transition boundaries
- cycle restart boundaries
- sharp segment boundaries / corner neighborhoods

This prevents raster aliasing and join-edge ambiguity from dominating the completeness score.

For full-width coverage reporting, the benchmark also ignores tiny fragment runs that do not look like a stable interior run:

- `sampleCount < 5`
- `bodyLength < 10`

## Pass Criteria

- `inside_dash_recall >= 0.93`
- `inside_gap_leak_rate <= 0.08`
- `outside_leak_rate <= 0.05`
- `worst_segment_dash_recall >= 0.85`
- `longest_expected_miss_span <= 14`
- every `segment_N_dash_recall >= 0.85`

## Known Red-Line Regression Checks

These are currently tracked as report-only signals and should be tightened into hard pass/fail only after the raster-side body-window measurement is shown to be stable across more than the current reference fixture:

- `stable_dash_body_length_span <= 4`
- `expected_cap_excluded_dash_body_length_span <= 4`
- `expected_cap_excluded_dash_body_deviation_max <= 2`
- `expected_cap_excluded_mesh_dash_body_length_span <= 4`
- `expected_cap_excluded_mesh_dash_body_deviation_max <= 2`
- `selected_high_zoom_local_overlay_adjusted_mask_iou >= 0.95`
- `selected_vs_deselected_high_zoom_local_mask_iou >= 0.98`
- `deselected_high_curvature_turn_overlay_adjusted_mask_iou >= 0.93`

## Artifacts

The test writes:

- clipped screenshot of the rendered vector
- text benchmark report
- JSON benchmark report with aggregate and per-segment metrics

## Non-goals

This benchmark does not currently prove:

- exact polygon raster match for the full stroke area
- exact join silhouette correctness at every corner
- exact opacity compositing against all backgrounds

Those require a stronger area-mask oracle and should be layered on top later if needed.

## Related Focused Benchmark

The full-path benchmark must be paired with the single-dash high-curvature-turn benchmark:

- [reference-dashed-stroke-single-dash-high-curvature-turn.definition.md](/Users/asa/Desktop/workspace/asra/apps/asyra-design/e2e/definitions/reference-dashed-stroke-single-dash-high-curvature-turn.definition.md)

Use the focused benchmark when debugging:

- turning direction through a high-curvature inside turn
- end-cap placement near the active turning anchor
- local overdraw / overlap on the selected high-curvature turning dash
