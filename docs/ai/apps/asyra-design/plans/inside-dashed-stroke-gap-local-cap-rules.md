# Rules: Inside Dashed Stroke Gap-Local Cap Ownership

**Date:** 2026-03-30  
**Status:** Draft rules for implementation and review  
**Scope:** `inside` positioned dashed stroke, specifically the local interaction between adjacent dash caps and the authored gap window  
**Runtime targets:**  
- [/Users/asa/Desktop/workspace/asra/packages/preset/src/components/geometry-model.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/components/geometry-model.ts)  
- [/Users/asa/Desktop/workspace/asra/packages/preset/src/components/strokes.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/components/strokes.ts)

---

## Why This Rule Exists

Current findings show:

- authored `dash/gap` scheduling is correct
- cross-segment ownership is correct
- the previous worst dash body coverage issue was repaired at final-face level
- the currently active defect is **final gap intrusion**

The strongest current evidence is:

- `minGapClearRatio = 0.533333...`
- `minFinalGapClearRatio = 0.066666...`
- removing both neighboring caps brings the same worst gap back to `0.516666...`
- `bothCapsOnlyClearRatio = 0.066666...`

So the next rule set must define:

- what a gap window is
- what a cap is allowed to occupy
- what is not allowed to enter the gap

This document does **not** define a finished implementation. It defines the contract the implementation must satisfy.

---

## Definitions

### 1. Authored Dash Window

For a dash interval `[dashStart, dashEnd]`, the authored dash window is the arc-length interval assigned by the dash scheduler.

This window is:

- determined only by authored path arc length
- independent of corner type
- independent of cap presence

### 2. Authored Gap Window

For two consecutive authored dash windows:

- dash A: `[aStart, aEnd]`
- dash B: `[bStart, bEnd]`

the authored gap window is `[aEnd, bStart]`.

This window is:

- determined only by authored path arc length
- independent of corner type
- independent of cap presence

### 3. Body

The dash body is the no-cap longitudinal portion of a dash.

It is responsible for:

- occupying the authored dash window
- preserving longitudinal dash length

It is **not** responsible for:

- visually rounding the start/end terminal shape

### 4. Cap

A cap is the terminal round extension applied to the start or end of a dash.

It is responsible for:

- local end-shape polish
- terminal closure of the stroke band

It is **not** responsible for:

- extending authored dash length
- consuming authored gap ownership

### 5. Final Visible Face

The final visible face is the polygon set actually rendered for a dash after:

- body construction
- constraint application
- cap integration
- final-face decomposition

---

## Core Ownership Rules

### Rule A: Dash/Gap Scheduling Is Authoritative

The authored dash and gap windows are the source of truth.

No later stage may reinterpret:

- dash length
- gap length
- dash start/end ordering

Final-face logic may change local visible shape, but not authored interval ownership.

### Rule B: Gap Ownership Belongs to the Gap

The authored gap window is owned by the gap.

This means:

- neighboring dash bodies may approach the gap boundary
- neighboring caps may touch the boundary
- but the gap window itself must remain a gap-owned region

Any intrusion into the gap must be explicitly justified by a local geometric rule, not by convenience of polygon merge.

### Rule C: Caps Are Local Terminal Shapes, Not Interval Extensions

Round caps may round the dash terminal silhouette, but they must not behave like:

- extra dash length
- general-purpose bridge geometry
- overlap patches

If a cap is needed to hide a broken body/decomposition, that is a bug in body/final-face ownership, not valid cap behavior.

### Rule D: Adjacent Caps Must Be Evaluated Together

For a gap between dash A and dash B:

- dash A end cap
- dash B start cap

must be evaluated as a pair, not independently.

Reason:

- the active defect is two-sided
- single-sided cap suppression does not recover the gap
- both caps together can erase the gap even when each side alone looks locally plausible

So cap legality near a gap is a **pairwise** question.

### Rule E: Gap-Local Rules Must Be Local

The legality of a cap near a gap must be decided from:

- the two neighboring dash windows
- their shared gap window
- their local source geometry

It must **not** depend on:

- point ids
- fixture-specific point order
- global path index hacks
- screenshot-tuned constants

---

## Allowed Geometry Effects

These are acceptable effects of local geometry:

### Allowed 1: Width Compression

Acute / sharp / inside geometry may reduce visible width.

This is acceptable because it changes transverse valid area, not authored longitudinal ownership.

### Allowed 2: Boundary Clipping

Corner wedge logic may clip polygons so they stay inside legal inside-stroke territory.

This is acceptable if it:

- preserves authored interval ownership as much as possible
- does not convert width-only constraints into longitudinal shortening

### Allowed 3: Cap Trimming

A cap may be trimmed/clipped locally if it would otherwise invade authored gap ownership.

This is acceptable because cap is decorative terminal geometry, not authored interval geometry.

---

## Disallowed Effects

### Disallowed 1: Cap-Driven Gap Erasure

Two neighboring caps may not jointly erase most of an authored gap window.

If `bothCapsOnly` reproduces the same gap failure as the final face, that is a failure of gap-local cap ownership.

### Disallowed 2: Cap Used As Bridge Geometry

A cap may not serve as a general bridge that compensates for:

- body discontinuity
- broken ownership clipping
- broken final-face decomposition

### Disallowed 3: Width Rule Reinterpreted As Length Rule

Corner or inside-width clipping must not shorten the dash longitudinally unless the authored interval itself has changed.

### Disallowed 4: Sample-Specific Policy

No runtime rule may mention:

- `tp-21`
- `point 5`
- “first dash”
- “worst gap index 5”

Scenario is allowed. Sample identity is not.

---

## Required Scenario-Level Policy

The next implementation pass should define cap legality by scenario, not by sample.

At minimum, it must distinguish:

1. `inside + dashed + adjacent-dash gap + exact-cubic`
2. `inside + dashed + adjacent-dash gap + sampled`
3. `inside + dashed + gap next to sharp/acute constraint`
4. `inside + dashed + seam gap`

The current active problem is in category 1.

---

## Required Test Contracts

Before runtime is considered correct, these contracts must hold.

### Contract 1: Allocation Invariance

- `intervalLengthSpan = 0`
- `gapLengthSpan = 0`

### Contract 2: Final Dash Coverage

For full dashes in the reported sample:

- final dash coverage must stay aligned with authored dash windows

### Contract 3: Final Gap Clearance

For the reported sample:

- final gap clearance must not collapse primarily because of neighboring caps

This should be tested by comparing:

- `clearRatioWithAllCaps`
- `leadingNoEndCapClearRatio`
- `trailingNoStartCapClearRatio`
- `bothNoCapsClearRatio`
- `leadingCapOnlyClearRatio`
- `trailingCapOnlyClearRatio`
- `bothCapsOnlyClearRatio`

### Contract 4: Pairwise Cap Non-Domination

The pair of neighboring caps must not dominate the gap window more than the body-only baseline.

Informally:

- the gap may get locally tighter after cap integration
- but cap integration must not become the primary owner of the gap

---

## Working Implementation Direction

The next runtime repair should be treated as:

**gap-local cap ownership / clipping**

not as:

- a dash allocation rewrite
- a seam rewrite
- a generic merged-polygon rewrite
- a cap-direction rewrite

The likely shape of the solution is:

1. identify neighboring dash pair for a gap
2. evaluate their cap-only intrusion into the authored gap window
3. clip or limit caps against a gap-local legality rule
4. preserve the dash body and allocation unchanged

---

## Exit Criteria

This rule set is considered satisfied only when:

1. `full-path-dash-gap-artifact` shows the active worst final gap is no longer cap-dominated
2. no allocation benchmark regresses
3. no high-curvature single-dash cap benchmark regresses
4. no seam benchmark regresses

Until then, any change that merely hides the gap problem visually without improving gap-local ownership is not an acceptable fix.
