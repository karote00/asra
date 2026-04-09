# Plan: Inside Dashed Stroke Priority Recovery

**Status:** IN PROGRESS (2026-03-28)  
**Scope:** `inside` positioned dashed stroke runtime, unit benchmarks, integration benchmarks, and reference e2e guards  
**Primary runtime:** [/Users/asa/Desktop/workspace/asra/packages/preset/src/components/geometry-model.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/components/geometry-model.ts)  
**Supporting plan:** [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-flow-first-plan.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-flow-first-plan.md)

---

## Why This Plan Exists

The current flow-first plan correctly describes the pipeline, but work still
drifts into symptom-chasing because the next execution order is not explicit
enough.

This plan adds:

- strict priority
- scenario matrix ownership
- test-layer ownership
- exit criteria per phase

The goal is simple:

**finish one part at a time, verify it thoroughly, then move on.**

---

## Core Rule

No new functional runtime change is allowed unless:

1. the targeted scenario is named
2. the expected owner step is named
3. the validating test layer is named
4. the exit gate for that phase is known in advance

This is how we stop oscillating between:

- screenshot debugging
- local patches
- regressions in adjacent behavior

---

## Priority Order

The work must proceed in this order:

1. **Scenario Matrix**
2. **Unit Geometry Contracts**
3. **Final-Face Ownership**
4. **Projection / Render Stability**
5. **Edit-State Overlay Hygiene**
6. **Only then broader optimization or feature expansion**

Do not skip forward just because a later symptom looks more visible.

---

## Scenario Matrix

This matrix is not exhaustive, but it is the minimum required coverage map.

### Axis A: Stroke Position

- `center`
- `inside`
- `outside`

### Axis B: Stroke Style

- `solid`
- `dashed`

### Axis C: Source Geometry

- straight segment
- low-curvature cubic
- high-curvature cubic
- multi-segment interval

### Axis D: Topology

- open path
- closed path

### Axis E: Local Scenario

- no corner
- smooth turn
- sharp corner
- acute inside corner
- seam-crossing closed-path interval

### Required High-Priority Cross Products

These are the scenarios that must be directly covered before considering the
inside dashed runtime "stable enough":

1. `inside + dashed + single high-curvature cubic + closed + smooth turn`
2. `inside + dashed + multi-segment interval + closed + smooth turn`
3. `inside + dashed + acute inside corner`
4. `inside + dashed + seam-crossing interval on closed path`
5. `center + dashed + seam-crossing interval`
6. `outside + dashed + sharp corner`
7. `inside + solid + high-curvature cubic`

These are not optional because they map directly to the failures already seen.

---

## Test Ownership By Layer

### Layer 1: Unit Geometry Tests

**Primary file:** [/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/geometry-model.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/geometry-model.test.ts)

This layer owns:

- dash interval allocation along authored centerline
- source length correctness
- boundary-source selection correctness
- curve adherence
- cap alignment
- overlap / self-intersection
- final-face ownership
- crossing-dash continuity for local scenarios

This layer must answer:

- Is the geometry mathematically correct?
- Is the final-face decomposition legal?

This layer must **not** depend on:

- edit-state overlay
- DOM timing
- Playwright input shell

### Layer 2: Integration / Projection Tests

**Primary files:** runtime-projection tests and stroke render tests

This layer owns:

- polygon -> triangulation -> mesh correctness
- projection reuse / cache correctness
- alpha composition ownership
- render-time reuse stability

This layer must answer:

- Does the renderer preserve the already-correct geometry?

### Layer 3: Reference E2E

**Primary files:**
- [/Users/asa/Desktop/workspace/asra/apps/asyra-design/e2e/reference-dashed-stroke-rendering.spec.ts](/Users/asa/Desktop/workspace/asra/apps/asyra-design/e2e/reference-dashed-stroke-rendering.spec.ts)
- [/Users/asa/Desktop/workspace/asra/apps/asyra-design/e2e/reference-dashed-stroke-completeness.spec.ts](/Users/asa/Desktop/workspace/asra/apps/asyra-design/e2e/reference-dashed-stroke-completeness.spec.ts)

This layer owns:

- fixture correctness
- end-to-end rendering sanity
- selected/deselected overlay diagnostics
- full-path completeness

This layer must answer:

- Does the app, through real UI actions, still render the benchmark fixture correctly?

This layer must **not** be the main geometry debugger.

---

## Phase Plan

### Phase 0: Freeze The Problem Correctly

**Goal**
- Stop debugging from screenshots alone.

**Required outputs**
- one named benchmark per high-priority scenario
- one owning test layer per benchmark

**Exit gate**
- every currently-known bug is mapped to:
  - scenario
  - plan step
  - owning test

### Phase 1: Interval And Source Geometry Contracts

**Goal**
- prove that authored dash intervals and source subpaths are stable

**Scope**
- Step 1
- Step 2
- Step 3

**Tests required**
- unit only

**Must prove**
- dash/gap allocation uses authored centerline arc length
- source subpath length tracks interval length
- multi-segment intervals remain monotonic
- seam wrapping is deterministic

**Exit gate**
- all high-priority scenarios have unit tests for interval/source correctness
- no failing benchmark is allowed to proceed to Step 4/5 blame before Step 1-3 are green

### Phase 2: Boundary Generation Correctness

**Goal**
- prove the stroke boundaries stay tied to authored geometry

**Scope**
- Step 4

**Tests required**
- unit only

**Must prove**
- exact-cubic stays exact where available
- sampled path stays within tolerance where exact-cubic is not available
- boundaries do not drift on high curvature
- inside/center/outside semantics are only offset semantics, not separate render systems

**Exit gate**
- curve-adherence metrics green for all high-priority scenarios

### Phase 3: Scenario Constraint Correctness

**Goal**
- apply legal visibility rules without point-specific logic

**Scope**
- Step 5

**Tests required**
- unit only

**Must prove**
- sharp corner handling is separate from smooth turn handling
- seam logic is separate from endpoint logic
- no logic mentions:
  - `first dash`
  - `point 5`
  - fixture-specific ids

**Exit gate**
- all scenario branches are named by geometry/topology, not by sample-specific identity

### Phase 4: Final-Face Ownership

**Goal**
- this is the primary bug-bearing phase

**Scope**
- Step 6

**Tests required**
- unit
- targeted integration

**Must prove**
- strip ownership is explicit
- cap ownership is explicit
- transition ownership across turns is explicit
- no self-intersection
- no double ownership
- no visible internal seams caused by final-face assembly

**Mandatory scenario gates**
- high-curvature single-dash turn
- multi-segment crossing dash near smooth corner
- acute inside corner terminal dash

**Exit gate**
- `maxRasterCoverage <= 1`
- no overlap-based darkening
- crossing dash continuity benchmark green

### Phase 5: Projection Stability

**Goal**
- confirm render system preserves the geometry exactly once

**Scope**
- Step 7

**Tests required**
- integration
- selected targeted unit tests for cache/projection reuse

**Must prove**
- mesh reuse works
- no per-frame rebuild churn
- no projection-induced geometry reinterpretation

**Exit gate**
- projection/cache benchmarks green
- app startup / interaction not regressed

### Phase 6: Edit-State Overlay Hygiene

**Goal**
- prevent overlay chrome from being confused with stroke defects

**Scope**
- Step 8

**Tests required**
- e2e diagnostics
- overlay-specific unit coverage where possible

**Must prove**
- overlay mismatch can be measured separately
- selected-state seams do not masquerade as dash bugs

**Exit gate**
- overlay-adjusted local metrics stable
- any remaining defect is attributable to geometry, not chrome

---

## Immediate Priorities

The next active work should follow this order exactly:

1. **Add a hard benchmark for the reported smooth-corner crossing dash**
   - not just source-length or candidate similarity
   - must directly assert continuous body ownership through the corner neighborhood

2. **Finish Phase 4 for that scenario**
   - no more Step 5 tweaking until Step 6 ownership is explicit

3. **Only after that, revisit broader body-length consistency and remaining local polish**

---

## What To Avoid

Do not do any of the following:

1. fix a screenshot-only symptom without first naming the owning scenario
2. change dash allocation semantics just because Illustrator does it differently
3. push e2e to prove local geometry that should be covered by unit tests
4. accept “close enough visually” when the owning benchmark is still weak
5. reintroduce fallback branches that were removed by runtime simplification

---

## Success Condition

This plan is done when:

1. every high-priority scenario has:
   - a named benchmark
   - an owning layer
   - a clear exit gate
2. Step 6 final-face ownership is no longer the recurring failure source
3. inside dashed stroke behavior can be explained without:
   - fixture-specific logic
   - point-specific logic
   - screenshot-by-screenshot debugging

