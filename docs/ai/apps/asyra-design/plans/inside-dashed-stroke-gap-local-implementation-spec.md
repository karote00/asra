# Inside Dashed Stroke Gap-Local Implementation Spec

**Status:** active implementation spec  
**Scope:** `inside + dashed` local gap ownership and terminal coexistence  
**Purpose:** consolidate the accepted direction for the next runtime implementation pass, combining the current project findings with external design suggestions into one geometry-first contract

## Goal

Define one implementation-ready algorithm for the remaining gap-local problem:

- two adjacent authored dash windows define one authored gap window
- their terminal body/cap geometry must coexist without erasing authored gap ownership
- remote non-neighbor overlap must be detected and excluded from local repair

This document is the adopted version of the current direction.

It intentionally rejects:

- workaround logic
- sample-specific logic
- point-specific logic
- postprocess cap trimming as a generic repair strategy

---

## What This Spec Assumes Is Already Stable

The following stages are treated as reliable inputs, not active rewrite targets:

1. authored dash/gap schedule
2. cross-segment dash support
3. exact-cubic vs sampled source geometry selection
4. wedge legality
5. seam-specific decomposition
6. same-corner split-pair decomposition

So this spec does **not** redefine the earlier pipeline.

It only defines what happens after those stages, for a **true local adjacent gap pair**.

---

## Core Decision

The adopted implementation direction is:

1. classify a gap as:
   - local adjacent pair
   - remote pollution
   - scenario-owned gap
2. only local adjacent pairs are allowed into the gap-local repair algorithm
3. build a bounded local 2D gap window using:
   - authored gap interval for longitudinal ownership
   - sampled local terminal cross-sections for 2D bounds
4. subtract that gap-owned local window from the neighboring terminal regions
5. keep only retained regions that remain connected to their owning dash
6. reject the result if validation fails

This is the adopted direction because it preserves:

- authored schedule as canonical
- local geometry as the source of 2D legality
- explicit region ownership
- separation between local bugs and global self-overlap pollution

---

## Why This Version Was Chosen

Two external suggestion sets were reviewed and merged with the current internal findings.

### Accepted from both suggestions

- add a local gap classifier
- separate local gap bugs from remote pollution
- use a local gap window / retained-region subtraction model
- do not use generic cap trim
- do not use cap-only suppression as the primary strategy

### Kept from current internal work

- 2D legality cannot be built from authored interval alone
- the gap window must use sampled local geometry, not only abstract interval slicing
- classifier cannot depend only on already-emitted final faces
- subtraction results must be filtered by ownership connectivity
- the same no-workaround standard used for split-pair must remain active here

### Explicitly rejected

- generic `polygonSubtract` without connectivity/legality checks
- full-polygon intersection as a shared gap bridge
- local repair on remote-pollution cases
- any rule that would degrade healthy round-cap cases just to improve one bad gap

---

## Scenario Classes

## Class A: Local Adjacent Pair

A gap is local if:

- the authored neighboring pair is known:
  - leading dash `i`
  - trailing dash `i + 1`
- the relevant local terminal geometry comes only from those two dashes
- no non-neighbor dash materially projects into the same local 2D gap window

Only this class is eligible for gap-local repair.

## Class B: Remote Pollution

A gap is remote-polluted if:

- one or more non-neighbor dashes also project into the same local 2D gap window

This class is **not** repaired by local gap logic.

Instead:

- record diagnostics
- return `null` from local gap repair
- let a later global overlap strategy handle it

## Class C: Scenario-Owned Gap

A gap is scenario-owned if one or both neighboring dashes are already produced by:

- seam-specific decomposition
- split-pair same-corner decomposition
- another explicit scenario family that claims terminal ownership

Gap-local repair is allowed only if that scenario exports terminal geometry that
is valid for additional local trimming.

Otherwise it must decline to repair.

---

## Inputs

For one authored gap `[gapStartDistance, gapEndDistance]`, the algorithm receives:

- leading dash terminal candidate
  - body boundaries
  - cap eligibility
  - final-face scenario metadata
- trailing dash terminal candidate
  - body boundaries
  - cap eligibility
  - final-face scenario metadata
- authored gap interval
  - start
  - end
  - length
- local path geometry
  - enough to sample terminal cross-sections near the gap
- current final polygons or equivalent spatial diagnostics
  - only for overlap classification
  - not as the sole basis of gap ownership

---

## Classification Rules

Classification must happen before any local repair.

## Rule 1: Locality Is Not Determined By Schedule Alone

Even if two dashes are adjacent in authored schedule order, the gap is not
automatically local.

Reason:

- a non-neighbor dash may still project into the same 2D window

## Rule 2: Locality Must Be Established In 2D

The classifier must examine:

- neighboring terminal candidates
- local 2D gap window
- non-neighbor intruders into that same window

It must not rely only on:

- dash indices
- authored interval adjacency

## Rule 3: Classification May Consult Final Geometry, But Not Depend Only On It

Allowed:

- using current final polygons to detect foreign intruders

Not allowed:

- defining gap legality only from whatever current final output happens to be

Reason:

- current final output may itself still contain bugs

## Promotion Gate

`local-adjacent-pair` is a necessary condition, but it is not yet sufficient to
promote gap-local subtraction into production runtime.

The current adopted promotion distinction is:

### Promotable Local Gap

This is the class we want to repair later in production runtime.

Required characteristics:

- classifier returns `local-adjacent-pair`
- the local window is not the simple canonical straight-side case
- terminal cross-sections show forward/backward intrusion into the authored gap
  window

Practical indicator:

- `localGapWindowVertexCount > 4`
  **or**
- `leadingEndCrossSectionForwardExtent + trailingStartCrossSectionBackwardExtent`
  is materially greater than epsilon

### Round-Cap Canonical Gap

This class is intentionally **not** promoted into runtime repair.

Characteristics:

- classifier returns `local-adjacent-pair`
- local window reduces to a simple quadrilateral
- both terminal cross-sections remain orthogonal to the gap axis
- the visible gap reduction comes from ordinary symmetric round caps, not from
  pathological ownership loss

Current rule:

- treat this class as healthy round-cap behavior
- do not apply retained-region subtraction

This distinction exists because recent prototypes proved that forcing strict gap
preservation onto healthy straight-side round-cap pairs degrades them into body
rectangles.

---

## Local Gap Window Construction

## Rule 1: Longitudinal Ownership Comes From The Authored Gap

The local gap window must be longitudinally anchored by:

- `gapStartDistance`
- `gapEndDistance`

This preserves authored schedule as canonical.

## Rule 2: 2D Bounds Come From Sampled Local Terminal Geometry

The 2D window must use sampled local geometry from:

- a non-degenerate near-gap cross-section from the leading side
- a non-degenerate near-gap cross-section from the trailing side
- one additional supporting cross-section on each side, slightly inside the
  owning dash

This mirrors the lesson from the split-pair fix:

- abstract interval ownership is not enough
- local sampled geometry is required to build bounded legal windows

## Rule 3: The Window Must Stay Local

The local gap window must not be built from:

- global bbox
- full polygon intersection
- raster failure masks
- remote geometry

It must remain a local bounded construction around the two neighboring
terminals.

---

## Retained-Region Construction

The final local solution uses three owners conceptually:

1. leading retained region
2. trailing retained region
3. gap-owned local window

Important:

- the gap-owned local window is **not emitted as stroke geometry**
- it exists to define what must stay empty

## Rule 1: Caps Are Part Of Terminal Regions

Caps are not separate owners.

Instead:

- cap geometry is part of the leading or trailing terminal candidate
- it survives only if it remains outside the gap-owned local window

## Rule 2: Retained Regions Come From Subtraction

For each neighboring terminal:

- subtract the gap-owned local window
- keep the geometry that remains outside the local gap window

## Rule 3: Only Connected Owning Pieces Survive

After subtraction:

- keep only retained pieces that remain connected to their owning dash body

Discard:

- disconnected fragments
- floating patches
- tiny leftovers that do not belong to the owning dash’s terminal continuity

This is required to avoid boolean-style garbage output becoming de facto
workaround geometry.

---

## Validation Rules

Any local gap repair result must satisfy all of:

1. no self-intersection
2. no overlap
3. local gap clear ratio improves relative to prior final output
4. neighboring dash coverage remains valid
5. no sample-specific behavior is introduced

If any fail:

- the algorithm must return `null`
- it must not degrade to a weaker heuristic

---

## Required Runtime Structure

The implementation should be split into three explicit pieces.

## 1. `classifyLocalGap(...)`

Responsibility:

- decide whether the current gap is:
  - local
  - remote-pollution
  - scenario-owned / not locally repairable

## 2. `buildLocalGapWindow(...)`

Responsibility:

- create the bounded 2D gap-owned window using:
  - authored interval ownership
  - local sampled cross-sections

## 3. `buildLocalGapRetainedRegions(...)`

Responsibility:

- subtract the local gap window from leading/trailing terminal candidates
- keep only valid connected retained pieces
- emit final local pair result

This split is deliberate:

- classification
- geometry construction
- ownership emission

must remain separate to preserve debuggability and testability.

---

## Test Mapping

The next test additions should mirror the runtime split.

## Artifact-Level

1. local gap classifier artifact
   - show local neighboring pair
   - show intruders
   - show whether the case is local or remote

2. local gap window artifact
   - show authored gap interval
   - show local sampled cross-sections
   - show final 2D gap-owned window

3. retained-region artifact
   - show leading terminal before/after subtraction
   - show trailing terminal before/after subtraction

## Unit-Level

1. local classifier does not misclassify remote-polluted windows as local
2. local gap window stays bounded and local
3. retained regions preserve neighboring dash coverage
4. retained regions keep gap window clear
5. overlap remains `<= 1`

---

## Immediate Next Implementation Order

1. add `classifyLocalGap(...)`
2. add a pure artifact/debug path for classifier output
3. add `buildLocalGapWindow(...)`
4. validate on true local cases only
5. add `buildLocalGapRetainedRegions(...)`
6. promote to runtime only after artifact validation is stable

---

## Hard Constraints

The implementation must not:

- special-case point ids
- special-case dash indices
- trim caps generically everywhere
- silently hide remote pollution with local subtraction
- emit disconnected boolean scraps as final geometry

If a candidate needs any of those, it is not the adopted algorithm.
