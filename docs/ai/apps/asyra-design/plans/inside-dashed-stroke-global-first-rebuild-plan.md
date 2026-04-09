# Inside Dashed Stroke Global-First Rebuild Plan

**Status:** active rebuild plan; Phase 1 completed and product-integrated, Phase 2 completed and product-integrated, Phase 3 pending  
**Date:** 2026-04-01  
**Scope:** replace the current local-first inside dashed stroke pipeline with a
global-first pipeline that:

- keeps authored dash/gap lengths correct
- generates caps as part of full dash candidate geometry
- resolves overlap only after all dash candidates are known
- supports `no cap`, `square cap`, and `round cap`

## Current Progress

Completed:

- Step 2 baseline interval allocation is now first-class via
  `DashIntervalAllocation`
- dash/gap interval allocation is no longer inferred only from `debugParts`
- Step 3 `dash subpath -> stroke-to-outline` is now the active Phase 2 path
- candidate preview is now product-facing through
  `createDashedGeometryModel(...).model.polygons`
- generic stroker cap modes now exist on the candidate path:
  - `none`
  - `square`
  - `round`
- candidate geometry follows true interval subpaths instead of local tangent
  projection
- product render and hit-testing now both consume the Phase 2 candidate outline
  result directly

Pending:

- Step 4 overlap graph
- Step 5 conflict components
- Step 6 overlay partition
- Step 7 ownership resolution
- Step 8 final inside clipping
- Step 9 final render polygons on the new pipeline

Current in-progress note:

- the current runtime baseline has recovered the reported ownership-assembly seam
  overlaps without reverting to the removed local-first repair stack
- global overlap/ownership flow is active enough to support the current product
  render path, but final clipping/cutting work is still unfinished and remains
  the next active step

## Product Integration Rule

This rebuild no longer follows a "finish all phases, then switch" strategy.

From this point on:

- every completed phase must have a product-facing integration surface
- every phase must expose the exact output that the phase is responsible for
- product integration may be partial or intentionally ugly
- later phases must not be faked by keeping old final geometry in place

Meaning:

- Phase 1 integrates as first-class runtime data
- Phase 2 integrates as the currently rendered pure candidate preview
- Phase 3 integrates as first-class overlap graph / conflict-component output
- Phase 4 integrates as ownership-resolved geometry
- Phase 5 integrates as final legal inside-clipped render output

---

## 1. Problem Statement

The current implementation drifted into a `local-first` model:

1. generate one dash / one slice
2. decide cap inclusion locally
3. apply local wedge / ownership / repair logic
4. hope the final global result is correct

This is the wrong shape for the problem.

Inside dashed stroke correctness depends on **global dash interactions**:

- one dash can overlap another dash that is not locally adjacent
- multiple dashes can form one conflict component
- cap correctness depends on the true dash geometry, not only local tangent
- clipping and ownership cannot be correct before all candidate dashes are known

The rebuild must therefore switch to a `global-first` pipeline.

---

## 2. Required High-Level Pipeline

The rebuild must follow this order.

### Step 1. Start From Full Vector Geometry

- input is the full path
- build one canonical path model:
  - segments
  - total arc length
  - per-segment tangent / normal
  - closed seam information

This step does **not**:

- generate caps
- clip geometry
- resolve overlaps
- assign ownership

### Step 2. Build Full `dash/gap` Interval Allocation

Along the full path arc length, compute the complete interval allocation:

- `dash interval 0`
- `gap interval 0`
- `dash interval 1`
- ...

Each dash record must include:

- `startDistance`
- `endDistance`
- authored adjacent neighbors
- touched segments
- whether the interval crosses segment boundaries

This step outputs **interval allocation**, not polygons.

Product-facing integration requirement:

- the interval allocation must be first-class on the runtime result
- downstream render stages may read it directly
- no later stage may infer interval ownership only from `debugParts`

### Step 3. Generate Full Dash Candidate Geometry

For every dash interval, generate the full candidate geometry **before**
conflict handling.

This step must follow a `dash subpath stroker` model, not a polygon-splicing
model.

Each candidate must include:

- source dash subpath
- stroked outline path
- start terminal
- end terminal
- cap mode

Cap mode must be generic:

- `no cap`
- `square cap`
- `round cap`

Rules for this step:

- do not clip for overlap
- do not clip for ownership
- do not early-trim because of acute corners
- do not suppress terminals because another dash might later conflict
- do not define the product render as `body polygons + cap polygons` stitched
  ad hoc

Implementation rule:

- derive one open `dash subpath` from the authored interval
- run a generic `stroke-to-outline` builder on that subpath
- let cap and join geometry be part of the outline result
- tessellation or triangulation happens only after the outline path exists

This implies:

- `round cap` on an open dash is a half-circle
- `square cap` is a terminal rectangle extension
- `no cap` keeps a flat terminal cross-section
- only zero-length dash intervals may degenerate into a full circle

The output of this step is a list of complete dash candidates.

Product-facing integration requirement:

- Phase 2 must expose a pure candidate render surface
- this surface is allowed to show overlap and out-of-range geometry
- this surface must be render-visible so cap shape, dash length, gap spacing,
  and curve-following behavior can be inspected on the actual product path
- the candidate render surface must come from the outline result itself, not
  from body/cap decomposition fallbacks

### Step 4. Build Global Overlap Graph

Only after all dash candidates exist:

1. detect candidate overlap using spatial indexing / bbox filtering
2. confirm overlap with polygon intersection
3. build an overlap graph

Graph model:

- node = one dash candidate
- edge = two dash candidates overlap

### Step 5. Split Into Conflict Components

Overlap must be solved per connected component, not per pair.

Example:

- `A` overlaps `B`
- `B` overlaps `C`
- `C` overlaps `D`

This is not three independent pair problems.

It is one conflict component:

- `{A, B, C, D}`

Each conflict component must be solved as one unit.

### Step 6. Perform Overlay Partition

Within each conflict component, perform boolean-style overlay partition.

Important:

- the core idea is **not** plain `union`
- the core idea is `overlay / partition`

The purpose is to split space into non-overlapping atomic regions where each
region has a known `coverage set`.

Examples:

- `{A}`
- `{B}`
- `{A, B}`
- `{B, C, D}`

This preserves ownership information that plain union would erase.

### Step 7. Resolve Ownership / Conflict Per Atomic Region

For each atomic region, apply a clear ownership policy.

Minimum categories:

- `exclusive region`
  - covered by exactly one dash
  - preserve directly
- `same-dash continuity region`
  - one authored dash spanning multiple segments
  - preserve continuity first
- `multi-dash conflict region`
  - covered by multiple distinct dashes
  - resolve by explicit policy

This step must decide:

- preserve as exclusive
- preserve as shared
- assign to a specific owner
- clip away

### Step 8. Apply Final Inside-Range Clipping

Only after ownership is resolved:

- clip against final inside shape limits
- apply final seam / corner legality clipping

This step is intentionally late.

It must not be mixed into candidate generation, or dash length and cap shape
will be corrupted before global conflict resolution is even possible.

### Step 9. Emit Final Render Polygons

The final render layer must consume only the final resolved polygons.

Render correctness must be judged against:

- final polygons
- final mesh output
- actual screenshot output

Not against intermediate debug geometry.

Until Step 9 is complete, the product may intentionally render an earlier phase
surface. That is acceptable only if the rendered surface exactly matches the
currently completed phase contract.

---

## 3. Core Algorithm Principle For Conflict Resolution

The rebuild must adopt this rule:

> A dash is not allowed to declare conflict resolution while it is still being
> generated in isolation.

Why:

- while generating `A`, the system may not yet know `B`, `C`, or `D`
- pairwise early trimming causes order pollution
- later conflict decisions then operate on already-mutated geometry

Therefore:

- `candidate generation` and `conflict resolution` must be separate phases
- conflict resolution requires full candidate visibility

---

## 4. True Segment Geometry Rule

This is a hard rebuild rule.

### The Problem

Some current candidate faces are effectively constructed from tangent
projection.

That causes dash geometry to extend along a local tangent approximation rather
than follow the true segment geometry, especially near:

- high curvature
- acute turns
- short dashes near segment ends
- multi-segment terminal spans

But this is not only a terminal problem.

The same mistake is invalid across the whole dash:

- body construction must not be treated as a tangent-projected strip
- terminal construction must not be treated as a tangent-projected cap host
- cross-segment continuity must not be approximated by chaining local tangent
  guesses

### Required Rule

All dash candidate geometry must be derived from the **true path slice**
corresponding to the dash interval, not from tangent projection.

### Required Construction

For each dash interval:

1. slice the true path into the exact sub-curve / sub-polyline for that interval
2. generate cross-sections from the true local curve frame along the interval
3. derive body boundaries from the true interval geometry
4. derive terminal cross-sections from the same true interval geometry
5. attach cap geometry to those terminal cross-sections

### Explicit Non-Rule

The system must not:

- treat the dash body as a tangent-projected strip
- treat the terminal dash as a straight strip plus decorative cap
- let local tangent approximation decide the dash face direction
- replace any part of the true interval geometry with a tangent-only
  approximation

In short:

- body geometry comes from the true path slice
- terminal geometry comes from the true path slice
- cap closes the terminal
- cap does not define the dash body direction

---

## 5. Data Structures

The rebuild should introduce explicit phase data.

### A. `DashIntervalRecord`

- dash id
- `startDistance`
- `endDistance`
- adjacent dash ids
- touched segment indices
- cap mode

### B. Internal Dash Subpath Geometry

- source subpath points
- source tangents
- offset centerline points
- cap mode
- final outline polygons

### C. `OverlapGraph`

- nodes = dash ids
- edges = candidate overlap relations

### D. `ConflictComponent`

- component id
- member dash ids
- component bbox
- candidate polygons

### E. `AtomicRegion`

- region polygon
- coverage set
- component id

### F. `OwnershipResolutionResult`

- retained regions
- clipped regions
- shared regions
- final owner assignment per region

---

## 6. Phases

### Phase 1. Rebuild Interval Allocation

Goal:

- stabilize `dash/gap` interval allocation

Output:

- `DashIntervalRecord[]`

No overlap logic here.

### Phase 2. Rebuild Candidate Geometry

Goal:

- generate full candidates with generic cap support

Output:

- candidate outline polygons rendered through
  `createDashedGeometryModel(...).model.polygons`

This phase must be visually inspectable before any clipping or ownership.

### Phase 3. Global Overlap Detection

Goal:

- build `OverlapGraph`
- extract `ConflictComponent[]`

### Phase 4. Overlay Partition

Goal:

- partition each component into `AtomicRegion[]`

### Phase 5. Ownership Resolution

Goal:

- resolve conflicts per atomic region

### Phase 6. Final Clipping

Goal:

- apply final inside legality after ownership is known

### Phase 7. Render Hard Gates

Goal:

- make final render correctness the true top-level oracle

Hard gates should target:

- final mesh
- final screenshot
- final visible dash terminal shape
- final visible dash/gap lengths

Not only intermediate debug stages.

---

## 7. What Must Be De-Emphasized Or Disabled

The rebuild should stop treating these as the main production path:

1. single-dash local ownership decisions during candidate generation
2. cap inclusion/exclusion decisions tied to early local clipping
3. local runtime patches as the primary repair mechanism
4. middle-layer adoption / payload / projection contracts as the primary source
   of correctness
5. any test that can pass while the visible rendered dash terminals are still
   obviously wrong

These may remain as diagnostics, but not as the main algorithm skeleton.

---

## 8. First Visual Milestone

The first milestone is intentionally narrow:

1. generate complete full-path dash candidates
2. render them with the selected cap mode
3. do **not** yet solve overlap
4. do **not** yet apply final inside clipping

What must be visibly correct at this milestone:

- dash/gap authored lengths
- cross-segment continuity
- terminal geometry follows the true segment / sub-curve
- selected cap mode is actually visible

Only after this milestone is visually correct should overlap resolution begin.

---

## 9. Success Criteria

This rebuild is only successful if all of the following become true:

1. authored dash/gap lengths remain correct in the final visible result
2. caps are generated consistently for the chosen cap mode
3. terminal geometry follows true interval geometry, not tangent-only
4. overlap is resolved using full-component information
5. final screenshot correctness agrees with final mesh correctness

If a future implementation satisfies internal contracts but still fails these
five visible conditions, the rebuild should be considered incomplete.
