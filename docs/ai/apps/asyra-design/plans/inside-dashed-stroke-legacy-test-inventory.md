# Inside Dashed Stroke Legacy Test Inventory

**Status:** updated after physical removal pass  
**Date:** 2026-04-01  
**Purpose:** perform the first concrete test triage pass before the
`global-first` rebuild starts

**Related documents:**

- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-rebuild-plan.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-rebuild-plan.md)
- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-implementation-backlog.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-implementation-backlog.md)
- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-tdd-plan.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-tdd-plan.md)
- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-legacy-test-triage-plan.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-legacy-test-triage-plan.md)
- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-removal-log.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-removal-log.md)

---

## 1. Inventory Goal

This inventory does not try to preserve the current `local-first` runtime
shape.

It classifies the current tests by rebuild value:

- `keep as hard gate`
- `downgrade to legacy diagnostic`
- `remove after migration`

`keep as hard gate` means the correctness intent survives the rebuild, even if
the exact assertion surface must later be rewritten against new outputs.

---

## 2. File-Level Summary

### Current Split Status

Already implemented:

- `full-path-dash-gap-artifact.legacy.test.ts` deleted
- `crossing-dash-artifact.test.ts` deleted
- `seam-dash-artifact.test.ts` deleted
- default `@asyra/preset` test scripts returned to normal `vitest run`
- `geometry-model.test.ts` rewritten as Phase 1 / Phase 2 hard-gate file
- `strokes.test.ts` no longer carries old inside-dashed local-first assertions

Current command surfaces:

- default blocking path:
  `yarn workspace @asyra/preset test:local`

Current observed state:

- default `geometry-model.test.ts` passes as Phase 1 / Phase 2 suite
- default `strokes.test.ts` passes
- no dedicated legacy inside-dashed runnable suite remains in package tests

---

### `packages/preset/src/__tests__/geometry-model.test.ts`

- Keep as hard gate:
  - interval allocation
  - authored dash/gap stability
  - true-geometry and cap correctness
  - seam continuity
  - final polygon validity
- Downgrade to legacy diagnostic:
  - local-gap promotion
  - scenario-owned retention
  - remote-pollution adoption and ownership layers
  - wedge-phase and split-pair phase-order assumptions
- Remove after migration:
  - runtime adoption boundary / surface / payload / semantics contract shape

### `packages/preset/src/__tests__/strokes.test.ts`

- Keep as hard gate:
  - render-path consumption of final dashed polygons
  - final hit geometry generation for dashed parts
  - basic dashed rendering on straight, corner, and bezier paths
- Downgrade to legacy diagnostic:
  - smooth-turn local-polygon expectation tied to old local-first behavior
  - true-segment wedge clipping expectation tied to early clipping
- Remove after migration:
  - none immediately

### `packages/preset/src/__tests__/full-path-dash-gap-artifact.legacy.test.ts`

- Keep as hard gate:
  - none during rebuild
- Downgrade to legacy diagnostic:
  - historical value preserved only in docs and old artifact outputs
- Remove after migration:
  - already removed from runnable test tree

### `apps/asyra-design/e2e/reference-dashed-stroke-rendering.spec.ts`

- Keep as hard gate:
  - final visible dashed render correctness, but only after rewrite
- Downgrade to legacy diagnostic:
  - current first-dash / inside-probe / mesh-coverage benchmark
- Remove after migration:
  - current benchmark report as authoritative hard gate

### `apps/asyra-design/e2e/reference-dashed-stroke-completeness.spec.ts`

- Keep as hard gate:
  - none in current form
- Downgrade to legacy diagnostic:
  - all four current completeness scenarios
- Remove after migration:
  - any metric still marked `diagnostic only`

---

## 3. `geometry-model.test.ts` Initial Triage

### 3.1 Keep As Hard Gate

These tests still constrain durable correctness and align with the new
`global-first` phases.

- `4692` `keeps dashed intervals monotonic and produces broad visible coverage for the reported sample`
- `4955` `anchors closed inside dash intervals at the authored path origin`
- `5015` `anchors the current reference canary sample at path origin with the authored dash-gap pattern`
- `5057` `preserves full-path inside dash completeness on the current reference canary sample`
- `5159` `retains canary dash completeness after polygon triangulation`
- `5260` `retains full-path inside dash completeness on the current reference sample for dash 25 gap 20`
- `5335` `retains full-path inside dash completeness on the current reference sample for dash 20 gap 20`
- `5410` `keeps the first curved dash attached to the authored path origin for dash 25 gap 20`
- `5466` `keeps the first curved dash attached to the authored path origin for dash 20 gap 20`
- `5550` `first acute-angle benchmark: preserves authored dash interval and source length for dash 20 gap 20`
- `5584` `first acute-angle benchmark: body-only no-cap face keeps longitudinal coverage across the authored dash interval for dash 20 gap 20`
- `5852` `keeps mid-side inside dashes symmetrically round-capped on a canonical rectangle for dash 25 gap 20`
- `5971` `oracle 1: keeps dashed intervals monotonic on right triangle`
- `6032` `oracle 1: keeps dashed intervals monotonic on reported sample`
- `6214` `oracle 3: validates polygon connectivity for all dashed polygons`
- `6279` `oracle 4: validates no self-intersection for all dashed polygons`
- `6352` `oracle 5: validates coverage density for reported sample`
- `6544` `phase2: computes valid dash/gap specification from user input`
- `6571` `phase2: validates gap proportions on right triangle`
- `6639` `phase2: validates gap proportions on reported sample`
- `6837` `phase2: validates dash-gap ratio consistency on reported sample`
- `7081` `single-dash high-curvature-turn benchmark: keeps the terminal cap aligned to the ideal round cap arc for dash 20 gap 20`
- `7099` `single-dash high-curvature-turn benchmark: matches the true-offset final face for dash 20 gap 20`
- `8082` `single-dash high-curvature-turn benchmark: keeps the end cap disjoint from the main strip for dash 20 gap 20`
- `8104` `single-dash high-curvature-turn benchmark: keeps single-ownership and complete coverage across the terminal cap interior for dash 20 gap 20`
- `8467` `closed-seam benchmark: inside dashed seam-crossing dash keeps full interval ownership on a closed seam square sample`
- `8522` `closed-seam benchmark: inside dashed seam-crossing dash keeps pre-seam final coverage on a closed seam square sample`
- `8581` `closed-seam benchmark: inside dashed seam-crossing dash keeps post-seam body and final coverage on a closed seam square sample`
- `8611` `closed-seam integration contract: production polygons and hit polygons keep pre/post seam final coverage on a closed seam square sample`
- `8679` `closed-seam benchmark: centered dashed seam-crossing dash stays continuous across the seam on a closed seam square sample`
- `8738` `full-path dash benchmark: keeps authored full-dash source lengths uniform for dash 20 gap 20`
- `8790` `full-path dash benchmark: keeps reported-sample dash intervals and gaps uniform from path origin for dash 27 gap 20`
- `8919` `full-path dash benchmark: prefers exact-cubic boundary sources for full dashes contained within a single cubic segment`
- `8951` `full-path dash benchmark: keeps inside boundary sources on the current reference sample within exact-cubic or sampled`

### 3.2 Downgrade To Legacy Diagnostic

These tests are informative, but they lock the suite to the old local-first
phase order or old family-specific repair structure.

- `5522` `keeps the first acute-corner dash as non-overlapping valid polygons for dash 20 gap 20`
- `5637` `keeps acute-corner dash polygons inside the authored corner wedges for dash 20 gap 20`
- `5758` `keeps high-curvature turning-dash polygons valid and inside the authored wedge for dash 20 gap 20`
- `7029` `keeps inside dash boundaries tight to the authored geometry for dash 20 gap 20`
- `7157` `single-dash high-curvature-turn benchmark: does not classify terminal-adjacent pairs as promotable local gaps for dash 20 gap 20`
- `7198` `reported sample benchmark: accumulated local-gap retained parts restore the promotable local pair gap window`
- `7323` `reported sample benchmark: classifies the worst global gap as remote pollution and excludes it from local-gap promotion`
- `7363` `reported sample benchmark: classifies the worst local-looking gap as scenario-owned-gap and excludes it from local-gap promotion`
- `7401` `reported sample benchmark: scenario-owned split-adjacent gap improves after scenario-owned facing-terminal retention`
- `7458` `reported sample integration contract: accumulated promotion applies only to promotable local gaps and excludes remote and scenario-owned gaps`
- `7504` `reported sample integration contract: production polygons and hit polygons keep the remote-pollution gap unresolved while excluding local-gap promotion`
- `7577` `reported sample integration contract: remote-pollution remains diagnostic-only after accumulated local-gap promotion and keeps non-neighbor intrusion evidence`
- `8058` `single-dash high-curvature-turn benchmark: accumulated local-gap retained parts do not promote the terminal-adjacent pairs`
- `8117` `reported sample benchmark: crossing dash preserves full interval ownership through the tp-21 smooth turn`
- `8200` `reported sample benchmark: runtime crossing dash should stay close to the multi-segment exact-offset candidate around tp-21`
- `8255` `reported sample benchmark: crossing dash keeps high local body coverage through the tp-21 smooth-corner neighborhood`
- `8279` `reported sample benchmark: crossing dash keeps full-width body ownership across tp-21 before the terminal cap begins`
- `8296` `reported sample benchmark: crossing dash body without caps still crosses tp-21 with full body ownership`
- `8340` `reported sample benchmark: crossing dash does not treat the tp-21 smooth turn as a wedge-clipped corner`
- `8377` `reported sample benchmark: crossing dash keeps continuous terminal-cap coverage through the tp-21 smooth turn`
- `8430` `reported sample benchmark: crossing dash resolves to a single continuous final face through the tp-21 smooth turn`
- `8706` `sharp-corner benchmark: outside dashed corner-crossing dash keeps valid ownership on a sharp square corner sample`
- `8828` `full-path dash benchmark: worst reported-sample dash final face keeps full authored coverage through the split pair for dash 27 gap 20`
- `8840` `reported sample integration contract: production polygons and hit polygons keep full authored coverage through the split pair for dash 27 gap 20`
- `8891` `full-path dash benchmark: worst reported-sample dash keeps pre-corner final coverage through the segment-2 body window for dash 27 gap 20`
- `8905` `full-path dash benchmark: worst reported-sample dash keeps post-corner final coverage through the segment-3 body window for dash 27 gap 20`

### 3.3 Remove After Migration

These tests encode the old runtime-adoption layering rather than durable dashed
stroke correctness.

- `7668` `reported sample runtime adoption boundary: production declares remote-pollution gaps as blocked runtime candidates before any ownership adoption`
- `7726` `reported sample runtime owner-class surface: production declares shared-overlap owner-class entries but keeps them blocked`
- `7784` `reported sample runtime surface consumer: production conditionally defers shared-overlap runtime-surface entries before any owner projection is adopted`
- `7838` `reported sample owner projection preconditions: production declares active deferred remote gaps as projection-ready inputs before owner projection adoption`
- `7906` `reported sample owner projection payload: production builds a runtime-ready projection payload for active ready remote gaps`
- `7954` `reported sample owner projection semantics consumer: production applies explicit self-overlap projection semantics for active ready remote gaps`

---

## 4. `strokes.test.ts` Initial Triage

### 4.1 Keep As Hard Gate

- `598` `renders one filled geometry for a straight dashed part`
- `635` `renders one filled geometry for a dashed part spanning a corner`
- `679` `keeps short dashed parts on bezier curves sampled with intermediate points`
- `1050` `builds polygon hit geometry for dashed parts`

### 4.2 Downgrade To Legacy Diagnostic

- `778` `inside dashed smooth-turn integration: runtime keeps one local polygon across the tp-21 turn neighborhood`
- `1088` `clips inside dashed corner geometry to the true segment wedge`

Reason:

- `778` constrains the old runtime path around one local smooth-turn result
- `1088` explicitly preserves early wedge clipping as a primary mechanism

### 4.3 Keep Unrelated To Rebuild Scope

These tests are not inside-dashed rebuild gates, but they also should not be
rewritten as part of this work.

- `732` `inside solid high-curvature characterization: runtime emits finite non-empty polygons on a closed cubic sample`
- `755` `inside solid high-curvature characterization: runtime emits simple non-degenerate polygons on a closed cubic sample`
- `820` `inside solid high-curvature baseline: runtime still escapes the authored closed shape on a closed cubic sample`
- `855` `offsets closed stroke centerlines for inside and outside positions`
- `904` `renders centered closed strokes as a single mesh projection`
- `937` `reuses mesh projections when the rendered stroke geometry and paint are unchanged`
- `966` `updates an existing mesh projection when only the paint changes`
- `1021` `builds hit segments from the rendered outside stroke geometry`

---

## 5. `full-path-dash-gap-artifact.legacy.test.ts` Initial Triage

### 5.1 Downgrade Entire File To Legacy Diagnostic

This file should not remain in the blocking rebuild path.

The file currently mixes:

- body-only no-cap artifact generation
- stage-by-stage pre-constraint / raw / wedge / ownership artifact outputs
- corner candidate comparisons
- remote-pollution family prototype comparison
- gate matrix summaries
- runtime adoption and projection summaries

These are useful as historical artifacts and comparison tools, but they encode
the old local-first skeleton too deeply to block the new rebuild.

### 5.2 Remove After Migration

The following sections are especially likely to become obsolete:

- `remote-pollution` family A/B/C selection logic
- runtime adoption boundary / surface / payload / semantics / output summaries
- gate matrix entries preserving old adoption-state layering

The body-only artifact views may still be worth harvesting later as a debug aid
for `Phase 2: DashCandidateGeometry`, but not in this file's current shape.

---

## 6. E2E Initial Triage

### 6.1 `reference-dashed-stroke-rendering.spec.ts`

Current test:

- `1665` `renders the dashed stroke with the expected first dash, gap, inside placement, and color`

Current classification:

- downgrade to legacy diagnostic in its current form

Reason:

- it primarily checks first-run alignment, inside/outside probes, color, and
  mesh existence
- it does not hard-gate global visible cap presence
- it does not hard-gate full-path visible dash correctness

Future direction:

- rewrite as a `final-render-hard-gate`
- assert visible round-cap presence on rendered terminals
- assert visible dash/gap correctness across the whole path

### 6.2 `reference-dashed-stroke-completeness.spec.ts`

Current tests:

- `4394` `renders the dashed stroke across the full reference path without segment dropouts`
- `4409` `renders the dashed stroke across the full reference path for dash 25 gap 20 without segment dropouts`
- `4424` `renders the dashed stroke across the full reference path for dash 20 gap 20 without segment dropouts`
- `4439` `keeps the dashed stroke stable when transitioning from dash 30 gap 40 to dash 20 gap 20`

Current classification:

- downgrade all four to legacy diagnostic in their current form

Reason:

- the current hard gates are:
  - `insideRecall`
  - `gapLeakRate`
  - `outsideLeakRate`
  - `worstSegmentDashRecall`
  - `longestExpectedMissSpan`
- the current cap/body span metrics are explicitly marked `diagnostic only`
- the suite can pass while visible cap correctness is still obviously wrong

Future direction:

- keep the artifact generation and raster/mesh comparison utilities
- replace the current pass criteria with visible final-render criteria

---

## 7. Immediate Execution Order

1. Move `full-path-dash-gap-artifact.legacy.test.ts` out of the blocking rebuild path
   first.
   Current action:
   move it to `full-path-dash-gap-artifact.legacy.test.ts` and run it only via
   `yarn workspace @asyra/preset test:legacy-diagnostic`.
2. Split `geometry-model.test.ts` into:
   - `global-first hard gates`
   - `legacy diagnostics`
3. Split `strokes.test.ts` so the dashed hard gates stay small and render-level.
4. Downgrade current dashed e2e tests to diagnostic until visible-cap and
   visible-final-shape gates exist.
5. Only after that start `Phase 1: DashIntervalRecord`.

---

## 8. Inventory Exit Criteria

This inventory is complete enough to start the rebuild only if:

1. old runtime-adoption and family-comparison tests are no longer blocking
2. interval / true-geometry / cap / final-render correctness still remain
   protected
3. e2e no longer pretends to certify final visible correctness while only
   checking proxy metrics
4. the rebuild can start without the old `local-first` runtime skeleton pulling
   it back
