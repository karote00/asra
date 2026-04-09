# Inside Dashed Stroke Split-Pair Pseudo Algorithm

**Status:** active design draft  
**Scope:** implementable pseudo-algorithm for `same-corner split pair`
final-face decomposition  
**Runtime changes:** none  
**Purpose:** determine whether the proposed three-region method is truly viable
before runtime implementation

## Goal

Define an implementable algorithm for the scenario:

- `inside + dashed`
- exactly two local specs from the same corner split
- no seam
- no unresolved wedge conflict
- authored interval continuity must pass through the corner

The output must be a legal final-face region set that satisfies:

- `coverageRatio = 1`
- `preCornerCoverageRatio = 1`
- `maxRasterCoverage <= 1`
- no self-intersection

This document is not code. It is the executable-thinking version of the
algorithm.

---

## Problem Restatement

The currently failing class is not caused by:

- dash/gap scheduling
- source extraction
- raw exact-cubic boundaries
- wedge clipping

The current failure happens when two local specs, created by the same corner
split, are converted into final polygons.

Observed candidates prove:

1. **pair decomposition**
   - preserves coverage
   - leaves overlap

2. **pair partition**
   - removes overlap
   - loses too much coverage

3. **merged single face**
   - falls back toward the current bad result

4. **naive three-region**
   - using full polygon intersection as bridge also fails

So the missing algorithm is not "clip differently." It is "construct the
correct middle region."

---

## Scenario Contract

The algorithm applies only if all conditions are true:

1. there are exactly **two** local specs
2. both specs belong to the same local split event
3. neither spec is seam-classified
4. wedge constraints are already resolved and legal
5. the authored interval requires continuity across the split
6. the two specs are adjacent in authored path order

If any of these are false, this algorithm must not run.

---

## Inputs

For each split pair:

- `leadingSpec`
  - `outerBoundary`
  - `innerBoundary`
  - `centerlinePoints`
  - `includeStartCap`
  - `includeEndCap`
- `trailingSpec`
  - `outerBoundary`
  - `innerBoundary`
  - `centerlinePoints`
  - `includeStartCap`
  - `includeEndCap`
- `cornerDistance`
- local corner/tangent context
- stroke width

Derived from earlier stages:

- raw polygons for each spec
- wedge-clipped polygons for each spec
- authored interval window
- pre-corner and post-corner windows

---

## Required Derived Geometry

Before region construction, compute:

1. `leadingRawFace`
2. `trailingRawFace`
3. `cornerAnchor`
   - the split corner point in world space
4. `leadingFarCrossSection`
   - the cross-section opposite the corner on the leading spec
5. `trailingFarCrossSection`
   - the cross-section opposite the corner on the trailing spec
6. `leadingCornerCrossSection`
   - the cross-section nearest the corner on the leading spec
7. `trailingCornerCrossSection`
   - the cross-section nearest the corner on the trailing spec
8. `cornerBisectorAxis`
   - a stable local axis used only for region parameterization
9. `sharedLensWindow`
   - the local region around the corner where the two retained regions would
     otherwise overlap or leave a gap

Important:

- `sharedLensWindow` is a **derived local construction window**
- it is not equal to the entire polygon intersection

---

## Region Model

The final output is exactly three region classes:

1. `leadingRetainedRegion`
2. `trailingRetainedRegion`
3. `bridgeLensRegion`

Not all three must have positive area in every valid case, but the algorithm
must build all three conceptually.

---

## Pseudo Algorithm

## Step 1: Build Legal Raw Faces

For each spec:

1. build its face from:
   - outer boundary
   - inner boundary
   - cap flags
2. ensure wedge legality is already applied
3. reject scenario if either face is degenerate

Output:

- `leadingRawFace`
- `trailingRawFace`

## Step 2: Establish Local Corner Frame

Construct a local frame at the split corner:

1. `origin = cornerAnchor`
2. `u = normalized corner bisector axis`
3. `v = perpendicular(u)`

This frame is only used to describe which parts are:

- before the corner
- after the corner
- inside the local shared lens window

The frame must be deterministic and geometry-derived.

## Step 3: Build Retained Regions Without Solving The Lens Yet

Construct provisional retained regions:

1. `leadingRetainedBase`
   - keep the part of `leadingRawFace` that is longitudinally before the split
   - allow it to enter the local shared lens window

2. `trailingRetainedBase`
   - keep the part of `trailingRawFace` that is longitudinally after the split
   - allow it to enter the local shared lens window

At this point:

- overlap is allowed locally
- under-coverage is allowed locally
- this is still an intermediate state

## Step 4: Define The Shared Lens Window

Construct a bounded local window around the corner using:

- the corner-adjacent cross-sections
- the local bisector frame
- the authored interval continuity requirement

The shared lens window must satisfy:

- it is local to the split
- it contains the region where continuity must be preserved
- it excludes remote intersection area not needed for continuity

This is the key difference from naive full-intersection logic.

## Step 5: Extract Bridge Lens Candidates

From the shared lens window, compute:

1. `leadingLensSlice`
   - the portion of `leadingRawFace` inside the window

2. `trailingLensSlice`
   - the portion of `trailingRawFace` inside the window

3. `bridgeLensCandidate`
   - the bounded continuity region derived from the overlap and boundary
     envelope of these two slices

Constraint:

- `bridgeLensCandidate` must be bounded by local corner geometry, not by the
  full global polygon overlap

## Step 6: Partition Ownership In The Lens Window

Replace the overlap-capable local pieces with an explicit partition:

1. remove the lens-window portion from `leadingRetainedBase`
2. remove the lens-window portion from `trailingRetainedBase`
3. insert `bridgeLensCandidate` as the sole owner of that shared window

Output:

- `leadingRetainedRegion`
- `trailingRetainedRegion`
- `bridgeLensRegion`

## Step 7: Validate Region Set

Run validation:

1. coverage across full interval window
2. coverage across pre-corner window
3. `maxRasterCoverage <= 1`
4. no self-intersection
5. no empty retained region where authored continuity requires material

If validation fails, do not emit polygons.

## Step 8: Emit Final Polygons

Return the non-degenerate subset of:

- `leadingRetainedRegion`
- `trailingRetainedRegion`
- `bridgeLensRegion`

No later postprocess trim is allowed.

---

## What Makes This Different From Existing Candidates

## Difference From Pair Decomposition

Current pair decomposition:

- keeps coverage
- but solves overlap by not solving it

New algorithm:

- treats the overlap zone as a first-class region that must be partitioned

## Difference From Pair Partition

Current pair partition:

- removes overlap by cutting one side too aggressively

New algorithm:

- preserves continuity by explicitly restoring the shared middle region

## Difference From Naive Three-Region

Naive three-region:

- uses the whole polygon intersection as bridge

New algorithm:

- uses only a **bounded local lens window**
- discards remote or over-wide overlap that is not needed for continuity

---

## Feasibility Assessment

## What Looks Feasible

The algorithm is feasible if these conditions hold:

1. we can compute a stable local corner frame
2. we can compute corner-adjacent and far cross-sections deterministically
3. we can define a bounded local lens window without referring to fixture ids
4. we can polygon-clip and polygon-intersect reliably for convex local pieces

Current evidence says these are realistic:

- the current artifact pipeline already computes enough local geometry to
  derive most of them
- the failing scenario is local, not global
- sharp/acute and seam are already being treated as scenario classes

## What Is Still Ambiguous

There are two unresolved design choices:

1. **How exactly to define the shared lens window**
   - by corner-adjacent cross-sections only?
   - by bisector-projected bounds?
   - by a hybrid of both?

2. **How exactly to derive the bridge lens boundary**
   - intersection of lens slices clipped by local frame?
   - envelope built from nearest boundary chains?
   - monotone partition in local `(u, v)` coordinates?

These do not make the method impossible, but they are the key design choices
that must be fixed before runtime code is written.

## Overall Judgment

This method looks **truly viable**, but only if:

- the bridge region is treated as a bounded local construct
- not as full polygon intersection
- and not as a trim artifact

So the method is plausible, but not yet fully specified.

---

## Recommended Next Design Step

Before runtime implementation, write one more short spec:

**`split-pair lens-window construction rules`**

That follow-up should answer only:

1. how to define the local lens window
2. how to derive the bridge boundary inside that window
3. what convexity/monotonicity assumptions are allowed

Only after that should implementation begin.

---

## Unit-Test Mapping

This pseudo-algorithm should map to tests in this order:

1. artifact candidate proves:
   - `coverageRatio = 1`
   - `preCornerCoverageRatio = 1`
   - `maxRasterCoverage <= 1`

2. unit benchmark proves:
   - same-corner split-pair final face preserves authored interval continuity

3. regression gates prove:
   - acute remains green
   - seam remains green
   - broad visible coverage remains green

If any of these fail, the decomposition is not ready.
