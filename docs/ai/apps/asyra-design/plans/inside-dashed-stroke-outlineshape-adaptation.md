# Inside Dashed Stroke Outlineshape Adaptation

**Date:** 2026-03-30  
**Purpose:** map `Bezier.js outlineshapes` style representation onto the current `inside dashed stroke` runtime so that gap-local and final-face work can proceed with a better geometry model.

---

## 1. Why This Matters

The current runtime still treats one dash mostly as:

- interval
- boundaries
- final polygons

This is enough for:

- schedule correctness
- source geometry extraction
- wedge legality
- many split-pair cases

But it is still not expressive enough for the remaining gap-local work.

The recent prototypes showed:

- subtracting a local gap window from a **whole dash polygon** is too coarse
- even when subtraction is applied only after accumulating windows, ordinary straight-side dashes can still degrade
- the real unit of ownership is not the whole dash polygon
- the real unit of ownership is the dash's **terminal geometry**

That matches the conceptual direction of `Bezier.js outlineshapes`.

---

## 2. Relevant Bezier.js Idea

`Bezier.js`'s `outlineshapes(...)` does not expose one opaque outline polygon.
Instead it exposes per-shape structure:

- `startcap`
- `forward`
- `endcap`
- `back`

For our purposes, the most important lesson is:

> The outline should be represented as named subregions with explicit roles, not only as one merged polygon.

We do not need to copy Bezier.js literally, but we should adopt the same design principle.

---

## 3. Mapping To Our Runtime

For a single `inside dashed` dash, the closest mapping is:

- `startcap`
  - the round cap at the interval start, if enabled
- `forward`
  - the outer-side forward strip of the dash body
- `endcap`
  - the round cap at the interval end, if enabled
- `back`
  - the inner-side return strip of the dash body

However, our runtime should not emit these as four unrelated curves.  
Instead, it should treat them as four **named face contributors**.

So the adapted representation should be:

- `startTerminalRegion`
- `bodyForwardRegion`
- `bodyBackRegion`
- `endTerminalRegion`

For ordinary convex single-segment dashes, these regions may later collapse to one merged polygon.  
For gap-local and split-pair scenarios, they must remain distinguishable long enough for ownership decisions.

---

## 4. Proposed New Intermediate Model

Add an internal intermediate model for one dash:

```ts
interface DashFaceRegions {
  startDistance: number
  endDistance: number
  boundarySourceKind: 'exact-cubic' | 'sampled'
  touchedSegmentIndices: number[]

  bodyForwardRegion: Vec2[][]
  bodyBackRegion: Vec2[][]
  startTerminalRegion: Vec2[][]
  endTerminalRegion: Vec2[][]

  mergedBodyRegion: Vec2[][]
  mergedFinalRegion: Vec2[][]
}
```

Notes:

- `bodyForwardRegion` and `bodyBackRegion` are not necessarily needed as separately emitted render output.
- They are needed so that:
  - gap-local subtraction
  - split-pair lens decomposition
  - seam decomposition
  can target the right contributor instead of clipping the whole dash.

---

## 5. What Should Change In The Pipeline

Current conceptual flow:

1. allocate interval
2. build source geometry
3. apply constraints
4. build specs
5. build final polygons

Revised flow:

1. allocate interval
2. build source geometry
3. apply constraints
4. build **face regions**
5. run scenario-specific ownership on those regions
6. merge retained regions into final polygons

The key change is Step 4.

We should stop going directly from:

- `specs`
- to merged final polygons

and instead go to:

- named regions
- then retained-region ownership
- then final merge

---

## 6. Why This Helps Gap-Local Work

The current blocker is:

- local gap windows are correct enough
- classifier is correct enough
- but subtraction against the whole dash still damages normal dashes

With the outlineshape-style region model:

- a local gap window can subtract only from:
  - `leading endTerminalRegion`
  - `trailing startTerminalRegion`
- it does **not** need to touch:
  - `bodyForwardRegion`
  - `bodyBackRegion`
  - the opposite terminal

That is the missing granularity.

---

## 7. Why This Helps Split-Pair Work

The `same-corner split pair` work already proved that:

- final-face correctness depends on local decomposition
- the right bridge/lens cannot be discovered by generic polygon merge

The outlineshape-style model helps here too:

- `start/end terminals` remain explicit
- the retained body regions remain explicit
- the bridge/lens region can be introduced as a separate local region
- only after validation do we merge to final polygons

This is consistent with the new algorithm-first direction.

---

## 8. What Should Not Change

This adaptation does **not** mean rewriting the whole system.

The following stages are still valid and should remain:

- dash/gap schedule
- cross-segment interval support
- exact-cubic vs sampled source geometry selection
- wedge legality
- seam-specific scenario classification
- final mesh projection

Only the representation between:

- `spec generation`
- and `final polygon emission`

needs to change.

---

## 9. Immediate Implementation Consequence

The next implementation step should be:

### Step A
Introduce an internal helper that decomposes one dash spec into:

- `startTerminalRegion`
- `bodyForwardRegion`
- `bodyBackRegion`
- `endTerminalRegion`

### Step B
Keep this helper artifact-only first.

Validate on:

- canonical rectangle straight-side pair
- reported local exact-cubic pair
- same-corner split pair

### Step C
Promote only after we prove:

- local gap subtraction can act on terminal regions only
- straight-side dashes keep their normal round-cap symmetry
- split-pair scenarios do not regress

---

## 10. Hard Rules

The following remain forbidden:

- workaround trim patches
- sample-specific logic
- point-specific logic
- postprocess “hide the gap” patches
- whole-dash polygon subtraction for local-gap repair

The adopted principle is:

> If a scenario requires local ownership, introduce a better region model first.

