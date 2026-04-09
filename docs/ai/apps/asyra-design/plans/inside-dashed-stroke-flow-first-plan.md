# Plan: Inside Dashed Stroke Flow-First Recovery

**Status:** IN PROGRESS (2026-03-28)  
**Category:** Stroke Rendering Infrastructure  
**Scope:** `inside` positioned dashed strokes on vectors and shape paths  
**Method:** Requirements-first, flow-first, benchmark-driven

---

## Why This Plan Exists

The current codebase already has substantial dashed-stroke infrastructure, but
recent debugging showed that continuing to patch visible failures case-by-case
creates too much local complexity. The better approach is to restate the
pipeline from first principles, define what each step is responsible for, and
only allow scenario-specific branching when the scenario is genuinely different
in geometry.

This plan does **not** assume the existing implementation is wrong. It exists to
give the implementation a stable contract and a clear sequence of ownership.

---

## Core Principle

`inside` dashed stroke rendering must be treated as:

1. an **authored path**
2. a sequence of **dash intervals along authored arc length**
3. a per-interval conversion into **final non-overlapping render faces**
4. a pure **mesh projection/render** step

No step may rely on point-specific fixes such as “point 5”, “first dash”, or
other fixture-specific special cases.

---

## Non-Negotiable Rules

1. Dash length and gap length are allocated along the **authored path
   centerline arc length**, not along the outer edge, inner edge, or a raster
   approximation.
2. `inside`, `center`, and `outside` are **stroke-position semantics**, not
   separate rendering systems.
3. High curvature, acute corners, smooth joins, and path endpoints are
   **scenarios**, not ad-hoc exceptions. Different scenarios may need different
   calculations, but they must still fit into the same pipeline.
4. Final render faces must be **non-overlapping** and **non-self-intersecting**
   before triangulation.
5. Edit-state overlays must not be used to “fix” or explain final render
   geometry.

---

## Flow Contract

### Step 1: Build Authored Path Geometry

**Goal:** Establish the only source-of-truth path.

**Input:**
- vector network or per-shape path data

**Output:**
- `PathGeometry`

**Requirements:**
- preserve cubic segments as cubic segments whenever available
- preserve path order and closure
- provide stable arc-length queries

**Allowed scenarios:**
- line segment
- cubic segment
- closed path
- open path

**Not allowed here:**
- dash allocation
- stroke-width decisions
- cap or join generation

---

### Step 2: Allocate Dash Intervals

**Goal:** Decide where dash bodies and gaps exist on the authored centerline.

**Input:**
- `PathGeometry`
- stroke `dash`
- stroke `gap`
- path closure

**Output:**
- monotonic dash intervals in path-distance space

**Requirements:**
- intervals are defined on authored centerline arc length
- path closure handling is deterministic
- seam behavior is explicit

**Allowed scenarios:**
- open path
- closed path
- seam-wrapping last interval on closed paths

**Not allowed here:**
- offset geometry
- cap generation
- polygon generation

---

### Step 3: Extract Interval Source Geometry

**Goal:** Turn one dash interval into the exact authored subpath it occupies.

**Input:**
- one dash interval
- `PathGeometry`

**Output:**
- source points / sub-segment geometry for that interval

**Requirements:**
- if interval lies inside a single cubic, preserve exact cubic semantics
- if interval spans multiple segments, preserve the ordered continuation
- source geometry length must remain consistent with interval length

**Allowed scenarios:**
- single line slice
- single cubic slice
- multi-segment slice

**Not allowed here:**
- clipping to corners
- cap ownership
- triangulation

---

### Step 4: Build Stroke Boundaries

**Goal:** Convert the dash’s source geometry into stroke-band boundaries.

**Input:**
- interval source geometry
- stroke width
- stroke position

**Output:**
- `StrokeBandBoundaries`

**Requirements:**
- `inside` / `center` / `outside` only change offset semantics
- boundaries must stay tied to the authored geometry
- high-curvature cubic slices must not collapse or drift

**Allowed scenarios:**
- exact cubic boundary generation
- sampled boundary generation when exact cubic is unavailable or invalid

**Not allowed here:**
- polygon overlap ownership
- final face decomposition

---

### Step 5: Apply Scenario Constraints

**Goal:** Restrict a dash to the legally visible region for its scenario.

**Input:**
- boundaries
- path topology
- stroke position
- local turn/corner metadata

**Output:**
- constrained boundaries or wedge-constrained polygon specs

**Requirements:**
- this step is where scenarios diverge
- divergence must be scenario-based, not fixture-based

**Allowed scenarios:**
- sharp corner
- acute inside corner
- smooth high-curvature turn
- endpoint / seam

**Examples of legitimate differences:**
- a sharp acute inside corner may need wedge clipping
- a smooth high-curvature turn may need a different validity test than a sharp
  corner
- a seam on a closed path may suppress a cap

**Not allowed here:**
- point-specific fixes
- index-specific fixes like “first dash only”

---

### Step 6: Final-Face Decomposition

**Goal:** Produce the actual render faces for a single dash.

**Input:**
- constrained boundaries
- cap/join ownership

**Output:**
- one or more final polygons that together represent the dash

**Requirements:**
- no self-intersection
- no double ownership of the same painted area
- cap and strip ownership is explicit
- output must be suitable for triangulation without visual darkening from
  overlap

**Allowed scenarios:**
- single valid polygon
- multiple polygons that are disjoint and together form one dash

**This is the critical step for current bugs:**
- turning dash “going backwards”
- cap silhouette drift
- internal seam visible inside the dash
- darkened regions from overlap

---

### Step 7: Triangulation and Mesh Projection

**Goal:** Render the final faces exactly once.

**Input:**
- final polygons
- paint

**Output:**
- mesh projection

**Requirements:**
- triangulation must preserve polygon ownership
- projection reuse must avoid per-frame rebuild churn
- render layer must not reinterpret geometry semantics

**Not allowed here:**
- geometry correction
- scenario-specific clipping

---

### Step 8: Edit-State Overlay

**Goal:** Visual editing aids only.

**Input:**
- final rendered shape state
- editing/selection/hover state

**Output:**
- non-authoritative chrome only

**Requirements:**
- must not reinterpret stroke geometry
- must not cover or “explain” final render defects
- if visible, must be diagnosable separately from final mesh

---

## Current Runtime Mapping

This section maps the current implementation to the flow above. It is not a
claim that the current implementation is final; it exists to make refactoring
targets explicit.

### Step 1: Build Authored Path Geometry

- `buildPathGeometry(...)`
- `buildVectorGeometryModelPath(...)`
- `buildPolylineGeometryModelPath(...)`

Current status:
- good ownership
- already separated from dash allocation and render projection

### Step 2: Allocate Dash Intervals

- `buildDashIntervals(...)`
- `buildDashedStrokeIntervals(...)`

Current status:
- good ownership
- arc-length allocation is already isolated enough to benchmark independently

### Step 3: Extract Interval Source Geometry

- `resolveSinglePathSegmentSlice(...)`
- `samplePathInterval(...)`
- `buildInsideCubicSliceBoundaries(...)`
- `buildInsideSampledSliceBoundaries(...)`
- `resolveInsideDashBoundarySource(...)`
- `buildInsideDashSlices(...)`

Current status:
- partly mixed with Step 4 because boundary generation still happens while
  extracting interval-local geometry
- acceptable for now, but this is a future cleanup target

### Step 4: Build Stroke Boundaries

- `buildInsideCubicSliceBoundaries(...)`
- `buildInsideSampledSliceBoundaries(...)`
- `buildCenteredStrokeBandBoundaries(...)`

Current status:
- runtime now only uses `exact-cubic` or `sampled`
- remaining responsibility is clearer, but Step 3 and Step 4 still share some
  helper boundaries

### Step 5: Apply Scenario Constraints

- `buildPathCornerConstraints(...)`
- `resolveInsideDashEdgeConstraints(...)`
- `applyInsideDashSliceConstraints(...)`
- `buildInsideDashBoundarySpecs(...)`

Current status:
- this is the main scenario-specific stage
- runtime should keep this step focused on legal visibility constraints only

### Step 6: Final-Face Decomposition

- `buildDashBoundarySpecPolygons(...)`
- `mergeOverlappingConvexPolygons(...)`

Current status:
- this is the critical bug-bearing stage for overlap, silhouette drift, and
  turning-dash regressions
- must remain separate from Step 5 so scenario constraints and polygon
  ownership do not get mixed together

### Step 7: Triangulation and Mesh Projection

- `createGeometryModelFromPolygons(...)`
- `fillStrokePolygonsWithMesh(...)`
- mesh projection reuse/update path in `strokes.ts`

Current status:
- stable enough for current benchmarks
- no geometry semantics should be moved back into this stage

### Step 8: Edit-State Overlay

- `vector-path-editing-render-layer.ts`
- selection/hover overlay layers

Current status:
- should be benchmarked separately from final render
- any visible seam in edit state must be proven to come from overlay, not from
  stroke geometry, before changing runtime geometry

**Requirements:**
- overlays must never masquerade as stroke geometry
- overlays must be measurable separately in benchmarks
- selected-state chrome must not be mistaken for stroke failure

---

## Benchmark Map

### Focused Geometry Benchmark

File:
- `/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/geometry-model.test.ts`

Purpose:
- single-dash high-curvature turn
- cap alignment
- exact-cubic adherence
- final-face ownership

### Full-Path Visual Benchmark

Files:
- `/Users/asa/Desktop/workspace/asra/apps/asyra-design/e2e/reference-dashed-stroke-rendering.spec.ts`
- `/Users/asa/Desktop/workspace/asra/apps/asyra-design/e2e/reference-dashed-stroke-completeness.spec.ts`

Purpose:
- fixture stability
- full-path completeness
- local selected/deselected diagnostics
- cap-excluded body-length consistency

### Edit-State Overlay Benchmark

Purpose:
- separate visible overlay mismatch from actual mesh mismatch

Key metrics already in use:
- local IoU
- overlay-adjusted IoU
- overlay occlusion ratio

---

## Implementation Order

### Phase A: Runtime Simplification

Goal:
- remove dead branches and invalid fallback concepts without changing behavior

Exit criteria:
- focused geometry benchmark green
- rendering/completeness e2e green

### Phase B: Boundary Correctness

Goal:
- make interval source geometry and stroke boundaries faithful to authored path

Exit criteria:
- full-dash source lengths stable
- exact-cubic slices remain exact where expected

### Phase C: Scenario Constraints

Goal:
- express corner/turn/endpoint logic as scenario contracts

Exit criteria:
- no fixture-specific logic remains
- acute vs smooth vs seam behavior is benchmarked

### Phase D: Final-Face Decomposition

Goal:
- eliminate overlap, internal seams, reversed turns, and cap ownership bugs

Exit criteria:
- no internal visible seams in focused benchmark
- `maxRasterCoverage <= 1`
- terminal cap ownership metrics green

### Phase E: Projection and Overlay Hygiene

Goal:
- confirm render and edit-state layers do not reintroduce false artifacts

Exit criteria:
- projection reuse stable
- selected-state overlay metrics acceptable

---

## What Counts as a Legitimate Scenario Branch

Allowed:
- single cubic vs multi-segment source extraction
- sharp corner vs smooth turn constraint application
- seam vs non-seam cap decision
- exact boundary generation vs sampled boundary generation

Not allowed:
- point-specific fixes
- index-based fixes (`first dash`, `second dash`, `point 5`)
- benchmark-specific coordinate hacks

---

## Immediate Next Work

1. Keep runtime on the simplified model:
   - `inside = exact-cubic | sampled`
2. Continue removing dead complexity only when benchmark-neutral
3. Spend the next functional work on:
   - **Step 6: Final-Face Decomposition**
   - specifically the remaining internal seam / ownership issue visible during
     high-curvature turns

---

## Success Condition

This plan is complete when:
- the dashed stroke pipeline can be explained step-by-step without referring to
  fixture-specific fixes
- every visible dashed artifact can be mapped to one pipeline step
- focused benchmark and full-path benchmark both stay green while runtime code
  gets simpler, not more branch-heavy
