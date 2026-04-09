# Inside Dashed Stroke Split-Pair Lens Window Rules

**Status:** active design contract  
**Scope:** define `sharedLensWindow` and `bridgeLensRegion` construction rules for
the same-corner split-pair final-face algorithm  
**Runtime changes:** none  
**Purpose:** remove the last geometric ambiguity before runtime implementation of
the split-pair three-region decomposition

## Goal

For a valid `same-corner split pair`, define:

1. how to build the local `sharedLensWindow`
2. how to derive the `bridgeLensRegion` inside that window
3. which assumptions are allowed
4. which constructions are forbidden

This document intentionally narrows scope. It is only about the local lens
construction problem.

---

## Inputs

The lens-window construction stage receives:

- `leadingRawFace`
- `trailingRawFace`
- `cornerAnchor`
- `leadingCornerCrossSection`
- `trailingCornerCrossSection`
- `leadingFarCrossSection`
- `trailingFarCrossSection`
- `cornerBisectorAxis = u`
- `v = perpendicular(u)`
- authored interval window
- pre-corner and post-corner windows
- stroke width

All wedge legality and raw-face legality are assumed to be already resolved.

---

## Core Decision

The lens window must be built from **local cross-section geometry plus a local
corner frame**, not from:

- full polygon intersection
- global polygon bounds
- nearest raster failure samples

So the algorithm must be:

- local
- deterministic
- geometry-derived
- independent of a reported sample

---

## Definitions

## 1. Corner Frame

Construct a local coordinate frame:

- `origin = cornerAnchor`
- `u = normalized corner bisector axis`
- `v = perpendicular(u)`

Required properties:

- `u` points from the corner into the local continuity zone
- `v` splits the two retained sides
- the frame is deterministic for the same geometry

## 2. Corner-Near Envelope

For each raw face, define its corner-near envelope as the subset of the face
that lies between:

- the corner-adjacent cross-section
- and a local forward limit measured in `u`

This creates:

- `leadingCornerEnvelope`
- `trailingCornerEnvelope`

## 3. Shared Lens Window

The shared lens window is the **intersection of the two corner-near envelopes**
after they are restricted by the same local forward limit in `u`.

Important:

- this is not the full polygon intersection
- it is the overlap of two **locally bounded** envelopes

## 4. Bridge Lens Region

The bridge lens region is the portion of the shared lens window that is needed
to preserve continuity between:

- the end of the leading retained region
- the start of the trailing retained region

It must be the **sole owner** of the shared lens window after decomposition.

---

## Lens Window Construction Rules

## Rule 1: The Window Must Be Local

The shared lens window may only use geometry from the immediate split pair.

Forbidden inputs:

- remote dashes
- non-neighbor branches of a self-overlapping path
- global bbox or whole-face overlap

## Rule 2: The Window Must Be Bounded In `u`

The window must be clamped by a forward limit along `u`.

Recommended construction:

- compute the `u` projection of:
  - the leading corner cross-section
  - the trailing corner cross-section
  - the leading far cross-section
  - the trailing far cross-section
- define:
  - `u_min` from the corner-adjacent boundary
  - `u_max` from the smaller forward extent that still preserves continuity

Interpretation:

- the window is allowed to extend enough to connect the split pair
- it is not allowed to grow all the way to the full overlap of the two faces

## Rule 3: The Window Must Be Narrow In `v`

The window must be bounded laterally in `v` by the local cross-section
envelope, not by the full face width.

Recommended construction:

- project both corner-adjacent cross-sections into the local frame
- build the lens window from the overlap of their `v` spans, expanded only as
  needed to preserve continuity

Interpretation:

- the bridge should live where the two faces actually need to share material
- not across the entire width of both faces

## Rule 4: The Window Must Respect Authored Longitudinal Ownership

The lens window may restore continuity, but it may not invent extra authored
length.

So:

- it may fill the continuity deficit created by partitioning
- it may not extend beyond the authored pre/post-corner interval support

## Rule 5: The Window Must Be Convex Or Convex-Decomposable

To keep implementation practical, the lens window should be:

- convex, or
- decomposable into a small deterministic set of convex subregions

This is an implementation constraint, not a geometric truth, but it is
important for deterministic polygon clipping and validation.

---

## Bridge Lens Construction Rules

## Rule 1: Bridge = Local Shared Necessity, Not Full Overlap

The bridge lens region must be computed from the locally bounded lens window.

So:

- `bridgeLensRegion = sharedLensWindow` is allowed only if the window itself is
  already the minimal shared continuity region
- `bridgeLensRegion = fullIntersection(leadingRawFace, trailingRawFace)` is
  forbidden

## Rule 2: Bridge Must Connect Retained Regions

The bridge region must touch both:

- `leadingRetainedRegion`
- `trailingRetainedRegion`

If it touches only one side, it is not a continuity region.

## Rule 3: Bridge Must Replace Overlap, Not Add To Overlap

After partition:

- the retained regions must surrender ownership inside the shared lens window
- the bridge becomes the sole owner there

This prevents:

- overlap-preserving bridge repairs
- cap/body double ownership in the split zone

## Rule 4: Bridge Boundary Must Be Derived From Local Face Boundaries

The bridge boundary may be formed from:

- clipped portions of the leading boundary
- clipped portions of the trailing boundary
- cross-section edges that close the lens region

It may not be formed from:

- arbitrary smoothing curves
- raster-informed fitting
- fixture-specific hand-tuned trims

## Rule 5: Bridge Must Preserve Continuity At The Path-Local Outer Edge

Because current failures are most visible along the outer edge, the bridge must
preserve continuity at the path-local outer edge, not only in the center.

This should be checked explicitly in validation.

---

## Allowed Assumptions

These assumptions are allowed for the first implementation:

1. the split pair is local and only has two specs
2. raw faces are convex or close enough to convex to be clipped deterministically
3. the local lens window can be described in a corner frame `(u, v)`
4. a small number of convex output polygons is acceptable

These assumptions keep the implementation practical without turning it into a
workaround.

---

## Forbidden Constructions

The following are forbidden:

1. full polygon intersection as the bridge
2. global union followed by ad-hoc trimming
3. trim planes tuned to one reported sample
4. postprocess overlap cleanup after region ownership is already wrong
5. using seam-specific logic in non-seam split pairs

---

## Validation Rules

A lens-window construction is acceptable only if the resulting split-pair
decomposition proves all of:

1. `coverageRatio = 1`
2. `preCornerCoverageRatio = 1`
3. `maxRasterCoverage <= 1`
4. no self-intersection
5. bridge region touches both retained regions
6. bridge region stays inside the local lens window
7. no region extends beyond authored interval support

If any of these fail, the lens/window construction is wrong.

---

## Recommended Implementation Order

1. implement local `(u, v)` projection helpers
2. implement corner-near envelope extraction
3. implement `sharedLensWindow` construction
4. implement `bridgeLensRegion` derivation from the bounded window
5. validate in artifact/test
6. only then integrate into runtime

---

## Next Runtime Gate

No runtime implementation should begin until there is an artifact candidate
that proves:

- full coverage
- no overlap
- no self-intersection

for the current `same-corner split pair` target.
