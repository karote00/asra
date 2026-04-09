# Inside Dashed Stroke Algorithm-First Spec

**Date:** 2026-03-30  
**Scope:** analyze whether to keep digging or change method, and define an algorithm-first spec for the full stroke pipeline  
**Status:** analysis/spec only  
**Runtime changes:** none

## Executive Summary

The correct direction is:

- **do not restart the whole stroke pipeline**
- **do not keep tuning the current final-face logic**
- **do replace the final-face algorithm with a stronger scenario-level decomposition**

The current pipeline is usable up to the point where final polygons are
constructed. The main instability is not in dash scheduling or segment
extraction. It is in the representation used to convert constrained boundaries
into the final visible face.

So the right approach is:

1. keep the early pipeline
2. formally define the final-face algorithm
3. implement that algorithm once
4. validate it against the existing sharp/acute/seam/smooth/full-path matrix

This is the point where work should become **algorithm-first**, not
debug-first.

---

## Question Being Answered

We need a concrete answer to two related questions:

1. Should we keep digging into the current method?
2. If not, where should the method change start, and how should the workflow
   change?

This document answers both, and also audits the whole stroke pipeline to judge
which parts are truly viable and which parts are structurally unstable.

---

## Current Stroke Pipeline

The current stroke rendering path can be read as:

1. normalize stroke inputs
2. allocate dash/gap intervals on authored path arc length
3. extract interval-local source geometry
4. apply scenario constraints
5. build boundary specs
6. convert specs to final polygons
7. triangulate/project mesh

In the current codebase, the relevant owners are:

- [geometry-model.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/components/geometry-model.ts)
  - interval allocation
  - source extraction
  - constraint setup
  - boundary spec construction
  - final polygon construction
- [strokes.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/components/strokes.ts)
  - stroke source orchestration
  - solid stroke polygon generation
  - mesh projection fill path

At runtime:

- [createDashedGeometryModel(...)](/Users/asa/Desktop/workspace/asra/packages/preset/src/components/geometry-model.ts#L3784)
  loops over intervals and delegates to `resolveDashSliceResolution(...)`
- [renderStrokeSources(...)](/Users/asa/Desktop/workspace/asra/packages/preset/src/components/strokes.ts#L1667)
  turns the resulting polygons into mesh-backed render output

---

## Viability Audit By Stage

## 1. Stroke Input / Scheduling

**Status:** viable

What it does:

- converts stroke attrs into renderable stroke config
- allocates dash/gap windows from the authored path origin

Why it is trusted:

- full-path artifact metrics show `intervalLengthSpan = 0`
- full-path artifact metrics show `gapLengthSpan = 0`
- first acute-angle tests prove authored longitudinal dash length is preserved

Decision:

- keep this stage
- do not redesign dash scheduling

## 2. Interval-Local Source Geometry

**Status:** viable

What it does:

- converts interval windows into source geometry
- supports both `exact-cubic` and `sampled`
- supports multi-segment intervals

Why it is trusted:

- crossing-dash tests prove intervals can cross segment boundaries
- source lengths remain aligned with authored interval lengths
- smooth-turn crossing ownership exists before final-face construction

Decision:

- keep this stage
- do not redesign cross-segment support

## 3. Scenario Constraint Setup

**Status:** mostly viable, but must stay narrow

What it does:

- recognizes split constraints
- recognizes wedge constraints
- passes ownership intent into spec construction

What is already good:

- acute wedge legality can be enforced
- seam can be recognized as a distinct local scenario
- split constraints can isolate pre-corner / post-corner windows

What is risky:

- this stage becomes unstable if it starts deciding final visible ownership
- ownership metadata is currently overloaded and too close to final geometry

Decision:

- keep this stage, but keep its job narrow
- it should declare constraints, not solve final geometry

## 4. Boundary Spec Construction

**Status:** partially viable, but needs redesign boundary

What it does today:

- packages boundaries with:
  - cap flags
  - ownership constraints
  - wedge constraints
  - `allowMergedSingleFace`

Why this stage is the transition point:

- this is where final-face intent first becomes explicit
- this is also where the current representation starts losing expressive power

Decision:

- keep the idea of scenario-tagged specs
- change how specs are later consumed into polygons

## 5. Final-Face Construction

**Status:** not viable as currently represented

What it does today:

- clips polygons by ownership planes
- optionally merges or bridges
- tries to express local correctness with:
  - two retained pieces
  - bridge patches
  - single-face merge

Why it is not viable:

- for `worstDashIndex = 25`, diagnostics show:
  - raw is correct
  - wedge is correct
  - ownership is the first broken layer
- current candidates prove a hard ceiling:
  - pair decomposition gives full coverage but overlap
  - pair partition gives legality but under-coverage
  - merged single face falls back toward the current bad result
- a naive three-region candidate with `bridge = full intersection` also fails

Decision:

- replace this stage's representation
- do not keep tuning trim planes

## 6. Mesh Projection

**Status:** viable, not the active source of geometry bugs

What it does:

- converts polygons into renderable mesh
- caches and updates projections

Why it is trusted:

- current failures are reproducible before projection
- polygon-level metrics explain the bugs without renderer-specific theories

Decision:

- keep this stage
- do not spend time here until final-face geometry is corrected

---

## Method Decision

### Continue Digging Here

It is still valid to keep the current method in:

- interval allocation
- source geometry extraction
- exact-cubic vs sampled selection
- wedge legality
- mesh projection

These layers remain stable and evidence-driven.

### Change Method Here

The method must change in:

- boundary-spec to polygon conversion
- same-corner split-pair final-face construction
- local cap/body coexistence where final-face ownership depends on a local
  region partition

This is where the current abstraction is no longer expressive enough.

### Why Not Keep Digging Into The Same Logic

Because the current method now oscillates between:

- over-trimming
- overlap
- local bridge repairs
- regressions in other scenarios

That is not a missing constant. It is a representation limit.

---

## Required Algorithmic Model

The algorithm must explicitly separate:

1. **authored interval ownership**
2. **scenario legality constraints**
3. **final visible region decomposition**

These must no longer be conflated.

### Invariant 1: Schedule Is Canonical

The authored dash/gap schedule is the only source of longitudinal ownership.

Implications:

- no later stage may reinterpret dash length
- acute/sharp constraints may affect legal width, not scheduled interval length
- caps are terminal shapes, not interval extenders

### Invariant 2: Constraints Declare, Final-Face Solves

Constraint setup may declare:

- split
- wedge
- seam
- smooth turn
- local cap presence

But it may not solve final visible ownership by trim-plane heuristics alone.

### Invariant 3: Final Face Must Be Region-Based

Final-face construction must operate on explicit **regions**, not only on
per-spec clipping.

For a same-corner split pair, the minimum expressive model is:

1. leading retained region
2. trailing retained region
3. bridge/lens region

The bridge/lens region is not automatically:

- the whole polygon intersection
- a generic merged face
- a trim artifact

It must be constructed as its own legal region.

---

## Proposed Revised Flow

## Current

1. allocate intervals
2. build source geometry
3. apply constraints
4. build specs
5. clip specs by ownership planes
6. optionally bridge or merge

## Revised

1. allocate intervals
2. build source geometry
3. apply constraints
4. build specs
5. detect scenario class
6. choose decomposition family
7. build explicit retained/bridge regions
8. validate coverage + legality
9. emit final polygons

### Scenario Classes

The revised algorithm should at minimum distinguish:

- generic single-spec dash
- smooth-turn crossing dash
- seam pair
- same-corner split pair
- gap-local neighboring cap/body coexistence
- self-overlap polluted global view

Not all of these need the same decomposition family.

### Decomposition Families

#### Generic

Use the current generic path only when:

- one spec is sufficient
- or multiple specs remain legal under simple union without overlap/coverage loss

#### Seam Pair

Use seam-specific decomposition where pre/post seam must remain continuous
without being treated as a generic corner.

#### Same-Corner Split Pair

Use a three-region decomposition:

- leading retained
- trailing retained
- bridge/lens

This is the active new method.

---

## Whole-Stroke Reliability Rules

If the stroke system is to be "real usable" and avoid weird behavior, the
pipeline must obey these rules globally:

### Rule 1: Longitudinal Ownership Must Never Be Lost By Width Legality

Acute or inside corner legality may narrow the rendered band, but may not
silently shorten the authored dash interval.

### Rule 2: Final-Face Construction Must Never Invent Schedule

No final-face step may:

- extend one dash into the next gap to "look nicer"
- consume gap ownership by cap overlap without an explicit local rule
- use bridge geometry as implicit interval continuation

### Rule 3: Scenario Rules Must Be Geometric, Not Fixture-Specific

Allowed:

- two-spec split pair
- seam pair
- same-segment adjacent facing caps

Forbidden:

- point-id-specific branches
- dash-index-specific branches
- reported-sample-only patches

### Rule 4: Early-Stage Trust Must Be Preserved

If a fix for final-face decomposition breaks:

- allocation correctness
- acute wedge legality
- seam continuity
- broad visible coverage

then the fix is wrong, even if it helps one dash.

### Rule 5: Self-Overlap Must Be Distinguished From Local Gap Bugs

Some full-path gap windows are polluted by remote geometry from another branch
of the same self-overlapping path. These cannot be treated as local cap bugs.

So the algorithm and tests must distinguish:

- local neighboring-gap legality
- global 2D overlap pollution

---

## Recommended Next Workflow

This is the process change relative to the last week.

### Old Loop

1. see a bad dash
2. tweak ownership/cap/merge logic
3. rerun tests
4. observe a different local regression

### New Loop

1. write the target algorithm
2. define scenario contracts
3. validate the representation in artifact/test first
4. adopt into runtime only after the representation proves out
5. rerun the full findings inventory

This reduces wasted iteration because it stops treating representation failures
as parameter failures.

---

## Immediate Next Implementation Target

The next implementation should **not** be a runtime tweak.

It should be:

1. define the `same-corner split-pair three-region` contract precisely
2. prototype the region construction in artifact/test
3. reject prototypes that:
   - recover coverage by overlap
   - remove overlap by losing coverage
   - use full polygon intersection as the bridge

The artifact prototype must prove:

- `coverageRatio = 1`
- `preCornerCoverageRatio = 1`
- `maxRasterCoverage <= 1`
- no self-intersection

Only then should runtime integration begin.

---

## Final Recommendation

**Do not restart the stroke pipeline.**

**Do not keep deepening ownership-plane tuning.**

**Do switch to an algorithm-first, region-based final-face method.**

The change starts:

- after source geometry
- after constraint declaration
- before current final polygon construction

In one sentence:

**Keep the pipeline that is already trusted, and replace the final-face
representation with a scenario-level region decomposition that is strong enough
to express sharp/acute/seam cases without workaround logic.**
