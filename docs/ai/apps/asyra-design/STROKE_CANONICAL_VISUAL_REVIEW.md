# Stroke Canonical Visual Review

This document extends `docs/ai/workflows/app-visual-review-rule-overlay.md` for Asyra Design stroke rendering.

The stroke canonical visual review is the app-level review contract for the 18 canonical stroke groups and related stroke regressions.

## Canonical Matrix

The 18 canonical groups are:

Solid stroke:

1. `solid inside miter`
2. `solid inside bevel`
3. `solid inside round`
4. `solid center miter`
5. `solid center bevel`
6. `solid center round`
7. `solid outside miter`
8. `solid outside bevel`
9. `solid outside round`

Dashed stroke:

10. `dashed inside butt`
11. `dashed inside square`
12. `dashed inside round`
13. `dashed center butt`
14. `dashed center square`
15. `dashed center round`
16. `dashed outside butt`
17. `dashed outside square`
18. `dashed outside round`

Each group must remain independently runnable as an E2E visual spec. The groups may share helpers, but they must not be collapsed into one long spec that hides the failing group.

## Required Single-Frame Overlay

Every stroke canonical app visual review must generate a single-frame rule overlay for the reviewed case.

The same image must show:

- actual app-rendered stroke pixels;
- canonical model source path;
- fill/even-odd legal domain when the path is closed or self-intersecting;
- centerline and stroke width reference;
- expected visible stroke region;
- forbidden stroke region;
- dash/gap intervals for dashed cases;
- terminal/cap probes for dashed cases and open-path cases;
- join/corner probes for solid cases and source-join cases;
- overlap/overdraw probes;
- failure markers for every rule violation.

The plain screenshot may be attached, but it is not the review artifact. The review artifact is the overlay plus metrics.

## Shared Stroke Rules

All 18 groups must verify these rules:

1. Runtime data parity

- The selected/reviewed element id must match the screenshot.
- Runtime `points`, `segments`, `networks`, fills, strokes, transform, visibility, opacity, zoom, viewport, and coordinate space must be captured.
- The overlay model source path must be derived from runtime data, not from a fixture drawn by hand after capture.

2. Source-path adherence

- The rendered stroke must follow the authored source path.
- Every source segment must have independent coverage metrics.
- A full-path aggregate pass is not enough if any segment fails.

3. Position correctness

- `inside` must render only on the legal inside side/domain.
- `outside` must render only on the exterior/outside side/domain.
- `center` must straddle the source path with expected coverage on both sides.
- Wrong-side dominance fails even if total red coverage is high.

4. Forbidden-region correctness

- Expected empty regions must stay empty.
- Outside leaks, inside leaks, gap leaks, mask leaks, and opposite-side leaks must be independently measured.

5. Boundary correctness

- Caps, joins, corners, terminals, and clipped edges must match the authored stroke fields.
- Boundary probes must be shown in the overlay.

6. Overlap correctness

- Same-paint overlaps must not create unexpected darker/double-alpha output.
- Self-intersections and joins must remain bounded by the expected legal domain.

7. Projection correctness

- Render, hit, and export projection must preserve stroke semantics.
- Rendering may cache or union geometry only if the visible result and provenance remain rule-correct.

## Solid Group Rules

Solid cases use authored center stroke geometry plus mask/position semantics.

For `solid inside *`:

- The expected visible region is the inside half of the doubled authored center stroke clipped by the filled/even-odd inside domain.
- Exterior probes must be unpainted.
- Joins must match `miter`, `bevel`, or `round`.
- Miter limits must be respected.
- No diagnostic strip or helper polygon may become product-visible geometry.

For `solid center *`:

- The expected visible region straddles the source path.
- Inside and outside side probes must both have coverage where the source path is visible.
- Joins must match the authored join.
- There must be no unexpected clipping to only one side.

For `solid outside *`:

- The expected visible region is the outside half of the doubled authored center stroke clipped to the exterior legal domain.
- Inside-domain probes must be unpainted except for documented raster tolerance.
- Joins must match `miter`, `bevel`, or `round`.
- Self-intersection interior leaks fail.

## Dashed Shared Rules

Dashed cases use Asyra dash interval ownership.

All dashed groups must verify:

- center dashed cases allocate dash/gap phase along the authored source path;
- constrained inside/outside self-intersection cases allocate visible dash/gap records per source split range;
- split-range start/end terminals must be half-dash records when the split range is long enough;
- split-range middle dash records must keep the authored dash length;
- split-range gaps must remain positive and evenly distributed within the split range;
- round and square caps must be included when measuring visual gap readability; after cap footprint, redistributed split-range gaps must not be much smaller than the configured gap;
- the current Asyra readability floor is `configuredGap * 0.6` after cap footprint, so a configured gap of `20` must not collapse into visual gaps below roughly `12`;
- if a split range cannot keep terminal half-dashes plus a legible cap-aware gap, it may collapse to a single `start-end` visible dash instead of squeezing multiple dash groups together;
- every source segment has dash recall and gap leak metrics;
- expected dash samples are painted;
- expected gap samples are unpainted;
- terminal/cap footprints match `butt`, `square`, or `round`;
- dash intervals preserve provenance through render projection;
- split ranges preserve terminal metadata;
- no broad segment dropout is allowed;
- no unexpected double-alpha overdraw is allowed.

## Dashed Inside Rules

`dashed inside butt`, `dashed inside square`, and `dashed inside round` are high-risk groups and must use the strictest overlay.

The rule is:

1. Derive source split ranges from the authored source path and even-odd legal domain.
2. For self-intersections, split the source path into split ranges.
3. Keep half-dash terminals at split-range cut ends.
4. Build Asyra doubled center dashed stroke geometry using `stroke.width * 2`.
5. Preserve authored `capType`, `joinType`, and `miterLimit`.
6. Clip the visible product to the inside filled/even-odd legal domain.
7. Drop empty clipped fragments.
8. Do not replace dropped fragments with one-sided ribbons, local-side strips, or diagnostic helper geometry.

The overlay must show:

- source path centerline;
- expected inside side/domain;
- forbidden outside side/domain;
- dash and gap intervals;
- split-range boundaries;
- terminal/cap footprints;
- expected inside dash samples;
- forbidden outside samples;
- forbidden gap samples;
- missing-dash markers;
- wrong-side markers;
- gap-leak markers;
- overdraw markers.

Required metrics:

- `inside_dash_recall` overall and per source segment;
- `worst_segment_dash_recall`;
- `inside_gap_leak_rate`;
- `outside_leak_rate`;
- `wrong_side_dominance`;
- `terminal_recall`;
- `split_terminal_recall`;
- `double_alpha_rate`;
- `model_render_drift`.

Passing means red dash pixels are on the expected inside legal region. A screenshot where dashes exist but mostly appear outside the centerline/domain fails.

No-fill inside dashed remains inside dashed. Lack of visible fill must not remove the implicit inside domain or make the stroke fall back to outside/center behavior.

## Dashed Center Rules

For `dashed center *`:

- Dash/gap intervals are allocated along the authored source path.
- The visible region straddles the centerline.
- Inside and outside samples should both have expected dash coverage.
- Gap samples on both sides must remain empty.
- Cap footprints must match `butt`, `square`, or `round`.
- There must be no inside-only or outside-only collapse unless the geometry is clipped by a documented path/open-domain rule.

## Dashed Outside Rules

For `dashed outside *`:

- Dash/gap intervals are allocated from the Asyra split-range rule for constrained self-intersections.
- Source path identity must still be preserved for segment ownership and projection.
- Visible geometry must be on the exterior/outside legal side.
- Filled-face or inside-domain probes must be unpainted.
- Boundary-domain dash bodies must be join-independent.
- Authored source-vertex joins may have join-specific packets, but boundary split terminals must remain cap-owned.
- Cap footprints must match `butt`, `square`, or `round`.

## Self-Intersecting Fixture Rules

The self-check pentagram fixture is an Asyra rule-derived matrix, not a product-packet smoke test.

For every reviewed stroke case, the visual oracle must derive expected probes from:

- the runtime authored source path;
- the source segment order and source split ranges;
- the closed even-odd legal domain;
- the requested stroke position;
- the requested stroke style, cap, join, width, dash pattern, and dash offset.

The oracle must not use emitted product packets as the only source of truth. Product packets can explain provenance and render ownership, but missing output at an expected source split, source vertex, or self-intersection is a failure.

For the pentagram fixture, each overlay must classify all self-intersection split boundaries and all authored source vertices:

- `center` cases must verify the stroke straddles the authored path at every source segment, source vertex, and self-intersection split.
- `inside` cases must verify only the inside legal domain is painted at every source segment, source vertex, and self-intersection split.
- `outside` cases must verify only the exterior legal domain is painted at every source segment, source vertex, and self-intersection split.
- `solid` cases must verify continuous expected coverage and the authored join footprint at the source-derived join locations.
- `dashed` cases must verify Asyra split-range dash/gap allocation, split-range terminals, cap footprints, and join behavior at the same source-derived locations.

For dashed self-intersections, passing requires both presence and absence checks:

- expected dash probes at each source split range, source-derived visible split, and authored vertex must be painted according to the split-range interval records;
- expected gap probes within each split range must remain unpainted;
- expected source-join probes must not disappear merely because no product join packet was emitted;
- forbidden inside/outside probes must remain unpainted according to the reviewed stroke position;
- endpoint, source-vertex, and split-terminal style must match the authored cap/join fields;
- broad source segment or self-intersection dropout fails even when aggregate coverage is high.

The overlay must therefore include product-packet probes and source-derived probes. A product-packet-only overlay is incomplete for self-intersecting stroke review.

## Required Failure Markers

Stroke overlays must use stable marker categories:

- `missing_dash`
- `source_segment_dropout`
- `inside_gap_leak`
- `outside_leak`
- `wrong_side_dash`
- `terminal_missing`
- `split_terminal_missing`
- `cap_footprint_mismatch`
- `join_footprint_mismatch`
- `source_derived_probe_missing`
- `legal_domain_leak`
- `model_render_drift`
- `double_alpha_overdraw`
- `unexpected_union_or_collapse`
- `lost_interval_provenance`

Each marker must include source segment id/index or interval id when available.

## Minimum App Visual Review Commands

For broad stroke correctness claims:

```bash
ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL=http://localhost:3000 \
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 \
yarn workspace @asyra/asyra-design test:e2e "e2e/stroke-canonical-.*\\.spec\\.ts" --reporter=line
```

For inside dashed regressions, also run focused app-created self-check coverage:

```bash
ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL=http://localhost:3000 \
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 \
yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-dashed-visual.spec.ts e2e/vector-render-invariants.spec.ts e2e/reference-dashed-stroke-completeness.spec.ts --reporter=line
```

These commands are not enough by themselves. The generated rule overlay artifact must also pass and be inspected.

## Completion Contract

Before reporting stroke visual correctness:

1. Run the relevant canonical group specs.
2. Generate a rule overlay for the affected group/state.
3. Verify every rule listed in this document in that one overlay.
4. Inspect the overlay manually and compare it to the metrics.
5. Report the overlay path, metadata path, failed marker count, and remaining differences.

If the overlay does not include a rule, the review is incomplete. If any marker is present, the review fails.
