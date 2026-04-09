# Inside Dashed Stroke Findings Inventory

**Date:** 2026-03-29  
**Scope:** `inside` dashed stroke bug review after unit-first matrix expansion  
**Status:** Analysis only. No new runtime fix is proposed in this document.

## Goal

Collect the currently known findings before continuing implementation work, so the next repair pass can distinguish:

- proven-correct stages
- local failure stages
- likely root causes
- likely amplifiers

This document is intentionally organized by pipeline stage rather than by one reported dash.

## Reviewed Artifacts

### Runtime

- [geometry-model.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/components/geometry-model.ts)
- [strokes.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/components/strokes.ts)

### Unit / Integration

- [geometry-model.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/geometry-model.test.ts)
- [strokes.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/strokes.test.ts)

### Debug Artifacts

- [crossing-dash-artifact.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/crossing-dash-artifact.test.ts)
- [full-path-dash-gap-artifact.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/full-path-dash-gap-artifact.test.ts)
- [reported-sample-dash-gap-metrics.json](/Users/asa/Desktop/workspace/asra/packages/preset/test-results/full-path-dash-gap-artifacts/reported-sample-dash-gap-metrics.json)

## Pipeline Stages

The runtime can be read as:

1. Dash/gap interval allocation on authored path arc length
2. Interval to source geometry extraction
3. Scenario split/constraint application
4. Boundary spec construction
5. Final visible face construction
6. Mesh projection / rendering

## Findings By Stage

### Stage 1: Interval Allocation

**Status:** trusted

**Evidence**

- The reported-sample full-path benchmarks show:
  - `firstDashStartDistance = 0`
  - `intervalLengthSpan = 0`
  - `gapLengthSpan = 0`
- The first acute-angle benchmarks show:
  - authored dash interval preserved
  - source length preserved

**Conclusion**

Dash/gap allocation itself is not the main bug. The system is assigning dash and gap windows according to the authored settings.

### Stage 2: Cross-Segment Ownership

**Status:** trusted

**Evidence**

- The reported smooth-turn crossing benchmark proves the highlighted dash crosses the turning anchor.
- The crossing dash artifact and benchmarks show:
  - touched segments span multiple segments
  - source length remains close to authored dash length

**Conclusion**

The runtime already supports cross-segment dashes. The main bug is not "the dash stops at the point because segment crossing is unsupported."

### Stage 3: Source Geometry / Body-Only Ownership

**Status:** mixed

**Findings**

1. **First acute-angle dash longitudinal ownership is correct**
   - Body-only no-cap coverage across the authored dash interval is green.
   - Acute-angle width compression does not appear to shorten the dash along path length.

2. **Reported-sample worst dash body-only coverage is wrong**
   - In the full-path artifact suite:
     - `worstDashIndex = 25`
     - `startDistance = 1175`
     - `endDistance = 1202`
     - `touchedSegmentIndices = [2, 3]`
     - `boundarySourceKind = "exact-cubic"`
   - Measured body-only coverage:
     - `bodyOnlyCoverageRatio = 0.185...`

3. **The sharp-corner worst dash is already wrong before cap integration**
   - Pre-corner body coverage is partial.
   - Post-corner body coverage drops to zero in the body-only breakdown.

**Conclusion**

There is at least one class of bug where the body-only face is already wrong before the cap starts to matter. This is strongest around sharp/acute local constraints.

### Stage 4: Constraint Application

**Status:** likely problematic

**Current Signals**

- `inside` dashed acute/right-triangle wedge benchmark currently fails.
- `strokes.test.ts` sharp wedge clipping benchmark currently fails.
- The reported-sample broad visible coverage benchmark currently fails because render path coverage becomes much larger than source expectation.

**Interpretation**

The most likely problematic area is the interaction among:

- split constraints
- wedge constraints
- ownership constraints

This is the first stage where longitudinal body ownership can be incorrectly altered by logic that should only constrain the legal rendered area around a corner.

**Concrete Suspicion**

Constraint logic intended to bound the visible wedge is still affecting body continuity too aggressively around sharp/acute transitions.

### Stage 5: Final Visible Face

**Status:** definitely problematic, but not the only problem

**Findings**

1. For the smooth-turn crossing dash near `tp-21`:
   - body-only ownership exists
   - final visible face diverges from body-only shape
   - final face often looks shorter because cap/final-face ownership takes over too early

2. For the reported-sample worst dash:
   - `finalCoverageRatio = 0.617...`
   - `missingFromFinalRatio = 0`
   - `extraFinalRatio = 0.7`

**Interpretation**

The final face is not merely missing body area. In some cases it expands into the body window and partially hides the underlying body-only error. So final-face decomposition is still wrong, but it is sometimes acting as a visual mask over earlier body-only defects rather than being the original cause.

### Stage 6: Mesh / Projection

**Status:** not primary

**Evidence**

- Mesh reuse/update tests and related projection work have already been stabilized.
- Current dash failures are reproducible at polygon/coverage level before they need renderer-specific explanations.

**Conclusion**

Do not spend time in mesh projection until Stage 3 to Stage 5 are stable again.

## Current Regression Inventory

These are the currently active unit-level regressions that matter for dash correctness:

1. [geometry-model.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/geometry-model.test.ts)
   - `keeps inside dashed geometry within acute corners on a right triangle`
   - Symptom: polygon still violates acute wedge at the sharp/acute corner.

2. [strokes.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/strokes.test.ts)
   - `clips inside dashed corner geometry to the true segment wedge`
   - Symptom: rendered polygon still extends outside the true wedge.

3. [geometry-model.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/geometry-model.test.ts)
   - `keeps dashed intervals monotonic and produces broad visible coverage for the reported sample`
   - Symptom: `renderLength` is much larger than expected relative to `sourceLength`, which indicates final rendered continuity is distorting the intended geometry.

4. [geometry-model.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/geometry-model.test.ts)
   - `closed-seam benchmark: inside dashed seam-crossing dash keeps full interval ownership on a closed seam square sample`
   - Symptom: seam-crossing sampled dash still decomposes into overlapping polygons.

## Closed Seam Local Findings

### Confirmed Current Shape

For the closed seam square sample, the active failing seam dash is:

- `touchedSegmentIndices = [0, 3]`
- `intervalLength = 12`
- `sourceLength = 12`
- `boundarySourceKind = "sampled"`
- `includeStartCap = false`
- `includeEndCap = false`

The current final polygons are:

1. pre-seam triangle
2. post-seam rectangle
3. bridge triangle

and the benchmark sees:

- `rasterCoverage = 3`
- `preSeamBodyCoverageRatio = 0.729166...`
- `preSeamFinalCoverageRatio = 0.8125`
- `postSeamBodyCoverageRatio` and `postSeamFinalCoverageRatio` are healthy

### Layered Artifact Comparison

The seam artifact suite now writes:

- `seam-dash-raw.svg`
- `seam-dash-wedge.svg`
- `seam-dash-ownership.svg`
- `seam-dash-body-only-no-caps.svg`
- `seam-dash-final.svg`

The current layer-by-layer comparison is:

1. **Raw**
   - two healthy quads
   - pre-seam quad: `0,8 -> 0,0 -> 10,0 -> 10,8`
   - post-seam quad: `0,0 -> 4,0 -> 4,10 -> 0,10`

2. **Wedge**
   - identical to raw
   - so wedge clipping is not the first seam-local corruption

3. **Ownership**
   - the pre-seam quad is clipped to a triangle:
     - `8,8 -> 0,8 -> 0,0`
   - the post-seam quad remains intact
   - this is the first stage where seam-local coverage is materially lost

4. **Body-only no caps**

## Full-Path Gap Local Findings

### Confirmed Current Shape

For the reported sample full-path artifact suite:

- `intervalLengthSpan = 0`
- `gapLengthSpan = 0`
- `minDashCoverageRatio = 0.567901...`
- `minFinalDashCoverageRatio = 1`
- `minGapClearRatio = 0.533333...`
- `minFinalGapClearRatio = 0.066666...`

This means:

- authored dash and gap scheduling is still trusted
- the previous worst dash is now healthy at the **final** face level
- the currently active issue has shifted to **gap clearance**

### Layered Artifact Comparison

The full-path artifact suite now writes:

- `reported-sample-worst-gap-window.svg`
- `reported-sample-worst-gap-final-window.svg`
- `reported-sample-worst-gap-final-vs-body.svg`

The current metrics show:

- `worstGapIndex = 15`
- `worstFinalGapIndex = 5`
- `worstGapClearRatio = 0.533333...`
- `worstFinalGapClearRatio = 0.066666...`
- `worstGapNeighbors = [15, 16]`
- `worstFinalGapNeighbors = [5, 6]`

### Interpretation

The gap issue is **worse at the final visible face level than at the body-only no-cap level**.

That narrows the likely cause:

- the remaining active defect is not allocation
- it is not the previously fixed non-seam post-corner ownership regression
- it is most likely caused by **cap integration / end-face expansion into gap windows**

### Cap Contribution Split

For the current worst final gap:

- `clearRatioWithAllCaps = 0.066666...`
- `leadingNoEndCapClearRatio = 0.300000...`
- `trailingNoStartCapClearRatio = 0.283333...`
- `bothNoCapsClearRatio = 0.516666...`
- `leadingBodyOnlyClearRatio = 0.516666...`
- `trailingBodyOnlyClearRatio = 0.516666...`

This means:

- both neighboring caps contribute to the final gap intrusion
- neither side alone explains the whole failure
- removing both caps brings the gap back close to the body-only diagnostic level
- the remaining no-cap intrusion is symmetric; neither neighboring dash body dominates on its own

So the active issue is not a single bad dash body anymore. It is **two-sided cap expansion into the gap window**.

### Working Conclusion

At this point:

- dash longitudinal scheduling is trusted
- the active dash-coverage defect for the previous worst dash has been repaired at final-face level
- the next priority defect is **final gap intrusion**, which should be analyzed as:
  1. body-only gap clearance
  2. final gap clearance
  3. cap-local contribution
   - the merged no-cap helper produces a single polygon:
     - `0,8 -> 0,0 -> 4,0 -> 4,10 -> 0,10 -> 10,0 -> 10,8`
   - this is useful diagnostically, but it is not yet a trustworthy final seam decomposition primitive

5. **Final**
   - ownership polygons plus one bridge triangle:
     - `0,0 -> 0,10 -> 5,5`
   - this bridge compensates for the seam-local ownership cut, but causes overlap rather than a valid seam closure

### What This Means

- The seam problem is **pre-seam local**
- The seam problem is **not** interval allocation
- The seam problem is **not** post-seam ownership
- The seam problem is caused by the combination of:
  - `owner: "prev"` seam ownership on the pre-seam slice
  - bridge polygon insertion
  - lack of a valid non-overlapping seam-specific decomposition
- the first confirmed corruption stage is **ownership**, not wedge clipping
- the current bridge triangle is a compensating patch over already-broken ownership, not the original cause

## Smooth-Turn Local Findings

### Layered Artifact Comparison

The smooth-turn crossing artifact suite now writes:

- `crossing-dash-raw.svg`
- `crossing-dash-wedge.svg`
- `crossing-dash-ownership.svg`
- `crossing-dash-body-only-no-caps.svg`
- `crossing-dash-final-face.svg`

The current smooth-turn crossing dash at `tp-21` reports:

- `startDistance = 1645`
- `endDistance = 1672`
- `touchedSegmentIndices = [3, 4]`
- `boundarySourceKind = "exact-cubic"`
- `includeStartCap = true`
- `includeEndCap = true`

and the layered polygon counts are:

- `rawPolygonCount = 1`
- `wedgePolygonCount = 1`
- `ownershipPolygonCount = 1`
- `polygonCount = 1`
- `bodyOnlyPolygonCount = 1`

### What The Layers Currently Show

1. **Raw**
   - single polygon
   - `314` vertices

2. **Wedge**
   - identical polygon count and vertex count to raw
   - no smooth-turn wedge clipping is being applied

3. **Ownership**
   - identical polygon count and vertex count to wedge/raw
   - ownership is not splitting or clipping this crossing dash

4. **Final**
   - identical polygon count and vertex count to ownership/raw/wedge
   - no extra bridge or decomposition stage is altering the smooth-turn dash body

5. **Body-only no caps**
   - single polygon
   - `253` vertices
   - this differs from final only because caps are omitted

### What This Means

- For the current reproduced `tp-21` sample, the first four stages are already aligned:
  - raw
  - wedge
  - ownership
  - final
- So the smooth-turn case is **not currently showing the same kind of layered corruption** as:
  - sharp/acute corner failures
  - closed seam failures
- The remaining visible difference in the artifact output is the expected `cap vs no-cap` difference, not a separate ownership split
- This makes the smooth-turn issue lower priority than:
  - sharp/acute wedge correctness
  - closed seam local ownership

In short:

- `tp-21` smooth-turn is **not the current first-failure stage**
- the dominant active failures still come from:
  - sharp/acute constraint interaction
  - seam-local ownership/decomposition

## Full-Path Worst-Dash Local Findings

### Current Worst Dash

From the full-path artifact suite, the current worst dash is:

- `worstDashIndex = 25`
- `startDistance = 1175`
- `endDistance = 1202`
- `touchedSegmentIndices = [2, 3]`
- `boundarySourceKind = "exact-cubic"`

### Layered Artifact Comparison

The full-path artifact suite now writes these additional files:

- `reported-sample-worst-dash-pre-constraint.svg`
- `reported-sample-worst-dash-raw.svg`
- `reported-sample-worst-dash-wedge.svg`
- `reported-sample-worst-dash-ownership.svg`
- `reported-sample-worst-dash-final-vs-body.svg`

The current layer counts are:

- `preConstraintPolygonCount = 2`
- `rawPolygonCount = 2`
- `wedgePolygonCount = 2`
- `ownershipPolygonCount = 2`
- `finalPolygonCount = 2`
- `bodyOnlyPolygonCount = 1`

### What The Metrics Say

The key divergence is:

- `preConstraintPreCornerSpecCoverageRatio = 1`
- `preCornerRawSpecCoverageRatio = 1`
- `preCornerWedgeSpecCoverageRatio = 1`
- `preCornerSpecCoverageRatio = 1`
- `preConstraintPostCornerSpecCoverageRatio = 1`
- `postCornerRawSpecCoverageRatio = 1`
- `postCornerWedgeSpecCoverageRatio = 1`
- `postCornerSpecCoverageRatio = 0.166666...`

and at the final rendered layer:

- `preCornerFinalCoverageRatio = 1`
- `postCornerFinalCoverageRatio = 0.533333...`
- `finalEdgeCoverageRatio = 0.962962...`
- `missingFinalEdgeDistances = [1191.5]`

while the body-only helper shows:

- `bodyOnlyCoverageRatio = 0.567901...`
- `bodyOnlyEdgeCoverageRatio = 0.185185...`

### What This Means

- The worst full-path dash is **not** first failing at:
  - pre-constraint
  - raw polygon construction
  - wedge clipping
- The first confirmed degradation now appears at:
  - **post-corner ownership/spec polygon stage**
- The body-only no-cap helper is still a useful diagnostic, but it is **not** the only failing stage anymore.
- The current active local failure is:
  - the post-corner spec with `ownershipOwners = ["next"]`
  - which drops post-corner coverage from `1` to `0.166666...`
  - and leaves the final face still partially missing post-corner coverage

In short:

- allocation is still correct
- pre-corner is healthy
- the sharp-corner worst-dash problem is now concentrated in the
  **post-corner ownership / final-face stage**, not in wedge clipping or allocation

### Runtime Experiments Already Tried

These were tested and then reverted because they did not produce an acceptable result:

1. **Remove seam ownership and union constrained polygons**
   - improved seam coverage
   - but produced overlap and damaged acute-corner correctness

2. **Use previous/next cross-section style seam trim planes**
   - either had no effect or damaged acute-corner correctness
   - did not produce a stable seam-only fix

3. **Use merged boundaries to rebuild seam face directly**
   - did not replace the current seam polygons with a valid decomposition
   - in some variants it also disturbed acute-corner behavior

### Current Best Seam Hypothesis

The seam case should probably not reuse general corner ownership semantics.

More specifically:

- the current `owner: "prev"` bisector-style seam split is too aggressive
- the bridge triangle is compensating for a seam-local partition that is already wrong
- the likely missing primitive is a **seam-specific non-overlapping decomposition**
  for sampled inside slices, rather than another variation of corner clipping

### Seam Work Rule

Until a seam-specific decomposition is ready:

- do **not** weaken acute/sharp wedge correctness to help seam
- do **not** modify non-dash layers
- do **not** treat seam as a generic corner-ownership case in analysis

## What Has Been Ruled Out

The following are no longer good primary-cause candidates:

- "dash/gap interval schedule is globally wrong"
- "cross-segment dashes are unsupported"
- "acute angle legitimately shortens dash length along path direction"
- "the tp-21 dash is only wrong because caps exist"
- "the problem is mainly in non-dash layers such as selection/hover/path-editing overlay"

## Gap-Local Cap Findings

### Active Worst Final Gap Classification

The currently active worst final gap is now classified more precisely as:

- `worstFinalGapIndex = 5`
- neighboring dash indices: `[5, 6]`
- both neighboring dashes are `boundarySourceKind = "exact-cubic"`
- both neighboring dashes touch exactly one segment:
  - leading: `touchedSegmentIndices = [0]`
  - trailing: `touchedSegmentIndices = [0]`
- both neighboring dashes still have their facing caps enabled:
  - leading: `includeEndCap = true`
  - trailing: `includeStartCap = true`
- both neighboring dashes have no split or wedge constraints:
  - `splitConstraintDistances = []`
  - `wedgeConstraintDistances = []`

This means the active final-gap defect is **not** currently tied to:

- segment crossing
- seam handling
- sharp/acute split ownership
- wedge clipping

It is currently best described as:

**same-segment exact-cubic adjacent-dash cap intrusion**

### Current Cap Contribution Evidence

The strongest current evidence remains:

- `clearRatioWithAllCaps = 0.0667`
- `leadingNoEndCapClearRatio = 0.3000`
- `trailingNoStartCapClearRatio = 0.2833`
- `bothNoCapsClearRatio = 0.5167`
- `bothCapsOnlyClearRatio = 0.0667`

So the active worst final gap is still explained primarily by the two facing caps together, not by dash/gap allocation.

### Rejected First Repair Direction

A first runtime experiment was attempted for pairwise gap-local cap ownership:

- detect a local adjacent-cap conflict
- trim or remove the two facing caps

That direction was **rejected and reverted** because:

1. the first trigger logic did **not** improve the active worst final gap
2. a broader trigger immediately conflicted with the existing high-curvature cap benchmark

So the next repair pass should **not** start from:

- generic exact-cubic cap suppression
- generic local cap-sampling thresholds alone

The next useful discriminator must explain why:

- the active worst final gap is bad
- while the high-curvature cap benchmark still represents a locally valid round-cap case

## Root Cause Candidates

### Candidate A: Constraint stage is over-cutting or mis-owning sharp/acute body regions

**Strength:** high

Why:

- acute wedge tests are red
- sharp wedge stroke test is red
- worst reported-sample dash loses body-only coverage after the corner

### Candidate B: Final-face decomposition is hiding and amplifying earlier body errors

**Strength:** high

Why:

- smooth-turn final face does not stay aligned with body-only face
- worst dash final face has large `extraFinalRatio`

### Candidate C: Closed-seam sampled inside slices need a separate valid decomposition path

**Strength:** medium-high

Why:

- seam-specific benchmark is still independently red
- seam polygons become self-intersecting even when interval/source lengths are correct

## Combined Interpretation

The evidence does **not** support a single isolated bug.

The current best explanation is:

1. Stage 1 and Stage 2 are mostly correct.
2. Stage 3 to Stage 4 introduce local body ownership loss around sharp/acute transitions.
3. Stage 5 sometimes further distorts the result, either by:
   - covering missing body with extra face
   - or taking ownership too early near end-side transitions
4. Closed-seam inside sampled slices likely need their own valid final-face treatment.

So the visual failures are likely caused by **multiple local geometry stages combining**, not by one global schedule mistake.

## Recommended Next Repair Order

1. **Restore sharp/acute wedge correctness first**
   - Fix:
     - right-triangle acute wedge benchmark
     - true-segment wedge stroke benchmark
   - Reason:
     - these are the strongest evidence that constraint logic is currently corrupting legal body shape

2. **Then fix the reported-sample broad visible coverage regression**
   - Reason:
     - this benchmark captures the larger "looks wrong everywhere" effect after wedge/ownership mistakes spread into final render continuity

3. **Then isolate closed-seam inside sampled decomposition**
   - Reason:
     - seam is a real bug, but it is sufficiently distinct that solving it first risks more broad regressions

4. **Only after 1 to 3 are green, return to smooth-turn cap/body final-face polish**
   - Reason:
     - otherwise cap integration debugging will continue to mask earlier body-only issues

## Action Rule For Next Pass

For the next coding pass:

- Do not touch non-dash layers.
- Do not revisit global dash allocation.
- Do not use reported-sample-specific hacks.
- Treat every change as belonging to exactly one of:
  - constraint application
  - body ownership
  - final-face decomposition
  - seam decomposition

If a change attempts to solve more than one of those at once, it is likely too broad.

## Gap Pair Comparator Findings

The active worst final gap has now been compared against a healthy comparator
pair with the same high-level shape class:

- same-segment
- exact-cubic on both sides
- facing round caps enabled
- no split constraints
- no wedge constraints

The latest metrics show:

- Active worst pair:
  - `clearRatioWithAllCaps = 0.0667`
  - `bothNoCapsClearRatio = 0.5167`
  - `centerGapDistance = 19.9432`
  - `leadingEndCapForwardExtent = 4.9955`
  - `trailingStartCapBackwardExtent = 4.9999`
  - `remainingAxisGap = 9.9478`
- Healthy comparator pair:
  - `clearRatioWithAllCaps = 0.5833`
  - `bothNoCapsClearRatio = 1`
  - `centerGapDistance = 20.6380`
  - `leadingEndCapForwardExtent = 4.9981`
  - `trailingStartCapBackwardExtent = 4.9964`
  - `remainingAxisGap = 10.6436`

This rules out several earlier suspicions:

- Not a dash/gap schedule problem
- Not a cap size problem
- Not primarily a cap direction problem
- Not explained by split or wedge constraints for the active worst pair

The important result is that the cap geometry itself is nearly identical between
the bad pair and the healthy pair. The meaningful difference is:

- the healthy pair becomes fully clean when both caps are removed
- the active worst pair still only reaches `0.5167` gap clear even in the
  no-cap diagnostic

So the active worst final gap is **cap-dominated, but not cap-only**. The next
production attempt should target the coexistence between adjacent same-segment
band faces and their terminal caps, not a generic cap-trim rule and not cap
orientation.

## Critical Gap Isolation Finding

The active worst final gap has now been isolated further. The latest artifact
metrics show:

- `otherPolygonsOnlyClearRatio = 0.5167`
- `neighborPairOnlyClearRatio = 0.5333`
- `neighborPairNoCapsOnlyClearRatio = 1`

This means the current active worst final gap is **not** caused by the local
same-segment pair alone.

What is happening instead:

1. The local neighboring pair (`dashIndex 5` and `6`) is only bad when their
   caps are included.
2. Once those caps are removed, the local pair becomes fully clean.
3. A separate non-neighbor dash still intrudes into the same gap window:
   - `dashIndex = 28`
   - `boundarySourceKind = exact-cubic`
   - `touchedSegmentIndices = [3]`
   - `intrusionRatio = 0.4833`

So the active worst final gap is actually a **compound overlap**:

- local facing caps on segment `0`
- plus a remote dash on segment `3` occupying the same spatial window

This changes the repair priority:

- do **not** start by changing generic local cap semantics
- do **not** start by trimming same-segment cap pairs
- first isolate why a remote dash can legally project into that gap window
  without violating the current final-face rules

In short: the current active worst gap is not a pure local gap-policy bug. It
is a broader final-face overlap problem involving at least one non-neighbor
dash.

### True Local Gap Target

Once non-neighbor overlap is separated out, the true local worst final gap is:

- `worstLocalFinalGapIndex = 25`
- `startDistance = 1202`
- `endDistance = 1222`
- `gapLength = 20`

Its neighboring dashes are:

- leading dash `25`
  - `boundarySourceKind = exact-cubic`
  - `touchedSegmentIndices = [2, 3]`
- trailing dash `26`
  - `boundarySourceKind = exact-cubic`
  - `touchedSegmentIndices = [3]`

This matters because the true local gap target sits immediately after the same
cross-segment dash that was previously identified as the worst broad dash/body
case. So the next local repair should focus on:

- the transition between dash `25` and gap `25`
- the end-cap/start-cap coexistence between dash `25` and dash `26`
- not the previously reported `worstFinalGapIndex = 5`, which is polluted by a
  remote contributor on segment `3`

### Local Gap Pair Breakdown

After isolating the local pair around `gap 25`, the latest metrics are:

- `clearRatioWithAllCaps = 0.266666...`
- `leadingNoEndCapClearRatio = 0.266666...`
- `trailingNoStartCapClearRatio = 0.5`
- `bothNoCapsClearRatio = 0.5`
- `leadingBodyOnlyClearRatio = 0.5`
- `trailingBodyOnlyClearRatio = 1`
- `leadingCapOnlyClearRatio = 0.766666...`
- `trailingCapOnlyClearRatio = 0.766666...`
- `bothCapsOnlyClearRatio = 0.533333...`

This shows the local pair is **not symmetric**:

- the trailing dash body is effectively clean by itself
- the leading dash body still contributes local intrusion
- removing only the leading end cap does not improve the gap
- removing the trailing start cap already restores the pair to the same state
  as removing both caps

So the active local target is not "trim both caps equally". It is:

- the terminal side of leading `dash 25`
- how that cross-segment dash exits into `gap 25`
- and how its terminal face coexists with the following same-segment dash

### Local Cross-Section Check

For this same local pair:

- `centerGapDistance = 19.971492...`
- `leadingEndCrossSectionForwardExtent = 0.014942...`
- `trailingStartCrossSectionBackwardExtent = 0.013525...`
- `remainingAxisGap = 19.943024...`

So the immediate end cross-sections are still nearly ideal. The local collapse
is happening later, in terminal face/cap geometry, not in the end cross-section
placement itself.

### Revised Gap Conclusions

After the successful non-smooth end-split ownership fix landed in
`geometry-model.ts`, the earlier `gap 25` local target is no longer the active
local failure.

The current active global/local gap picture is now:

- `worstFinalGapIndex = 5`
  - still the worst global final gap
  - but it remains polluted by a non-neighbor contributor
- `worstLocalFinalGapIndex = 8`
  - now the true local pair
  - leading dash `8` touches segment `[0]`
  - trailing dash `9` touches segments `[0, 1]`

For this local pair, the latest metrics are:

- `clearRatioWithAllCaps = 0.466666...`
- `leadingNoEndCapClearRatio = 0.75`
- `trailingNoStartCapClearRatio = 0.716666...`
- `bothNoCapsClearRatio = 1`
- `leadingBodyOnlyClearRatio = 1`
- `trailingBodyOnlyClearRatio = 1`
- `bothCapsOnlyClearRatio = 0.466666...`

And for the healthy same-segment comparison pair:

- `clearRatioWithAllCaps = 0.583333...`
- `bothNoCapsClearRatio = 1`
- `bothCapsOnlyClearRatio = 0.583333...`

This changes the interpretation:

- the current local pair is a **pure cap-only** visible-gap reduction
- both neighboring bodies are clean
- the local pair is only modestly worse than a healthy same-segment exact-cubic
  pair
- so this no longer looks like a high-priority local body-ownership defect

In other words:

- local `gap 8` is now much closer to "normal round-cap visible gap shrink"
  than to the earlier `gap 25` ownership bug
- the stronger remaining issue is still the **remote contributor** that
  overlaps `gap 5`

### Remote Contributor Breakdown

The current strongest non-neighbor overlap is:

- `dashIndex = 28`
- `intrusionRatio = 0.483333...`
- `startDistance = 1316`
- `endDistance = 1343`
- `touchedSegmentIndices = [3]`
- `boundarySourceKind = exact-cubic`

New diagnostics show:

- `bodyOnlyClearRatio = 0.833333...`
- `capOnlyClearRatio = 0.683333...`

So `dash 28` is not a pure-cap artifact. It contributes through:

- a smaller but real body-only intrusion
- plus additional cap intrusion

Additional staged diagnostics now show:

- `preConstraintPolygonCount = 1`
- `rawPolygonCount = 1`
- `wedgePolygonCount = 1`
- `ownershipPolygonCount = 1`
- `ownershipOwners = []`
- `wedgeConstraintDistances = []`

So `dash 28` is **not** a case where:

- wedge clipping changed the shape
- ownership changed the shape
- final-face decomposition changed the shape

It is a single unconstrained exact-cubic dash whose visible geometry is already
present at the raw/body level.

This changes the interpretation again:

- the active global `gap 5` metric is not a good driver for local cap or
  final-face fixes
- if `dash 28` is truly wrong, the first broken stage would be raw/body
  generation for a single-segment exact-cubic dash
- if `dash 28` is actually expected, then `gap 5` is simply a bad global metric
  because it mixes distinct path branches in a self-overlapping spatial window

So the next useful repair target is no longer a generic local cap policy. The
next useful decision is:

- determine whether `dash 28` is an expected self-overlap projection
- or a raw/body exact-cubic geometry bug

The current artifact strongly suggests the first option. The
`reported-sample-worst-gap-remote-contributor-body.svg` artifact shows `dash 28`
crossing the highlighted `gap 5` spatial window because the reported sample is
itself self-overlapping in 2D. In that view:

- the highlighted `gap 5` lives on one branch of the path
- `dash 28` belongs to another branch
- the overlap is already present in the remote dash **body-only** geometry

So `gap 5` is now best treated as a **self-overlap-polluted global metric**, not
as a clean local gap-policy defect.

### Worst Dash 25: Pair-Decomposition Diagnostics

After excluding the polluted `gap 5` metric, the cleanest remaining target is
still:

- `worstDashIndex = 25`
- `boundarySourceKind = exact-cubic`
- `touchedSegmentIndices = [2, 3]`

The current staged metrics are:

- `preConstraintPreCornerSpecCoverageRatio = 1`
- `preCornerRawSpecCoverageRatio = 1`
- `preCornerWedgeSpecCoverageRatio = 1`
- `preCornerSpecCoverageRatio = 0.333333...`

So the first broken stage is still **pre-corner ownership on the first spec**.

I then tested three artifact-only candidates, without changing runtime:

1. `pair decomposition`
   - trim the leading polygon by the trailing far cross-section
   - result:
     - `coverageRatio = 1`
     - `preCornerCoverageRatio = 1`
     - `maxRasterCoverage = 2`

2. `pair decomposition + mergeOverlappingConvexPolygons`
   - result:
     - `mergedCoverageRatio = 1`
     - `mergedPreCornerCoverageRatio = 1`
     - `mergedMaxRasterCoverage = 2`

3. `pair partition`
   - clip the leading polygon to one side of the trim plane and the trailing
     polygon to the other side
   - result:
     - `partitionCoverageRatio = 0.814814...`
     - `partitionPreCornerCoverageRatio = 1`
     - `partitionMaxRasterCoverage = 1`

This gives a strong structural conclusion:

- a single trim line can recover full coverage **or** remove overlap
- but, for this pair, a two-polygon solution cannot do both at once

That means the remaining missing rule is not a local patch to `owner: prev`, and
not a generic cap/body trim. The missing rule is a **same-corner split-pair
decomposition** that can represent:

- the leading retained region
- the trailing retained region
- and a third, non-overlapping bridge/lens region between them

In other words:

- `worstDash 25` no longer looks like a simple ownership-plane bug
- it looks like the current system lacks a generalized decomposition for
  `two specs + no wedge + sharp corner + preserved coverage + no overlap`
