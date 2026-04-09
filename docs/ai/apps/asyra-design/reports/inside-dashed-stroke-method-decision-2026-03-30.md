# Inside Dashed Stroke Method Decision

**Date:** 2026-03-30  
**Scope:** decide whether to keep digging into the current approach or change methods  
**Status:** analysis only

## Executive Summary

The correct decision is:

- **do not restart the entire dashed-stroke pipeline**
- **do change method for final-face construction**

More precisely:

- keep the current approach for:
  - interval allocation
  - source geometry extraction
  - most scenario constraint setup
- change the approach for:
  - `Step 4 -> Step 5`
  - especially `same-corner split pair` final-face decomposition

So the right answer is **hybrid**:

- **continue** the current pipeline where the evidence says it is already correct
- **change method** where the evidence says the current representation cannot express the needed result without fragile clipping

This is not a workaround. It is a change in the owning algorithmic layer.

The practical reading of this decision is:

- keep digging only in layers that still respond to evidence-driven fixes
- change method only in the layer where the current representation has hit a
  hard ceiling

So the next work should not be "more trim-plane tuning." It should be an
intentional representation change in final-face construction.

---

## Question Being Answered

We need to decide between two directions:

1. **Continue digging into the current approach**
   - keep ownership-plane logic as the main tool
   - keep fixing edge cases by adjusting clipping/decomposition around it

2. **Change method**
   - preserve validated early stages
   - replace the current final-face construction strategy with a different abstraction

The decision must be based on evidence already collected, not on intuition.

This report also answers:

- where continuing the current method is still justified
- where it is no longer justified
- what the replacement workflow looks like
- what hard rules keep the new method from turning into another workaround

---

## What Is Already Trusted

These parts already have strong evidence and should not be replaced:

### 1. Dash / Gap Allocation

Trusted findings:

- `intervalLengthSpan = 0`
- `gapLengthSpan = 0`
- start-from-origin behavior is deterministic

Interpretation:

- authored dash/gap scheduling is correct
- this is not where the active bug lives

### 2. Cross-Segment Ownership

Trusted findings:

- the reported smooth-turn crossing dash does cross multiple segments
- the current system can carry one dash interval across segment boundaries

Interpretation:

- we do not need a new interval scheduler
- we do not need a new “cross-segment support” mechanism

### 3. Acute-Angle Longitudinal Length

Trusted findings:

- the first acute-angle dash preserves authored longitudinal length
- acute-angle constraints affect width legality, not the scheduled dash length

Interpretation:

- we should not restart from “dash length is wrong”
- the remaining bug is downstream from interval ownership

### 4. Localized Seam Handling

Recent seam work shows:

- seam is a real local decomposition problem
- treating seam as a normal generic corner ownership problem is wrong

Interpretation:

- the codebase already supports scenario-level decomposition
- changing decomposition strategy for one scenario is acceptable if it is geometric, generalized, and tested

---

## What The Current Method Cannot Express Cleanly

The cleanest remaining non-polluted target is still:

- `worstDashIndex = 25`
- exact-cubic
- touches segments `[2, 3]`
- first clear failure is the first spec’s pre-corner ownership

Current staged metrics say:

- `preConstraintPreCornerSpecCoverageRatio = 1`
- `preCornerRawSpecCoverageRatio = 1`
- `preCornerWedgeSpecCoverageRatio = 1`
- `preCornerSpecCoverageRatio = 0.333333...`

This means:

- raw is correct
- wedge is correct
- ownership is the first stage that breaks the shape

However, deeper diagnostics show something more important:

### Candidate A: Pair Decomposition

Result:

- `coverageRatio = 1`
- `preCornerCoverageRatio = 1`
- `maxRasterCoverage = 2`

Interpretation:

- one trim line can restore coverage
- but it leaves overlap

### Candidate B: Pair Partition

Result:

- `partitionCoverageRatio = 0.814814...`
- `partitionPreCornerCoverageRatio = 1`
- `partitionMaxRasterCoverage = 1`

Interpretation:

- the same trim line can remove overlap
- but it loses too much total coverage

### Candidate C: Merged Single Face

Result:

- `mergedSingleFaceCoverageRatio = 0.567901...`
- `mergedSingleFacePreCornerCoverageRatio = 0.622222...`
- `mergedSingleFaceMaxRasterCoverage = 2`

Interpretation:

- naive single-face merge falls back toward the current bad result

### Candidate D: Naive Three-Region

Definition:

- leading retained region from pair partition
- trailing retained region from pair partition
- bridge region as the full convex intersection of the two original polygons

Result:

- `threeRegionCoverageRatio = 0.814814...`
- `threeRegionPreCornerCoverageRatio = 1`
- `threeRegionMaxRasterCoverage = 2`

Interpretation:

- simply adding the whole intersection as the bridge is still wrong
- it restores neither full coverage nor overlap legality
- so the missing middle region is **not** equal to the full polygon overlap

### Structural Conclusion

The current “two pieces plus ownership planes” model is too weak for this
scenario.

For this split pair:

- a two-polygon decomposition can achieve **coverage**
- or it can achieve **no overlap**
- but not both at once

That means the current method is not just missing a constant or a sign flip.
It is missing a representation for the middle region.

This is the decisive signal that we should **change method instead of digging
deeper into ownership planes**. If the current abstraction were still
adequate, one of the existing two-piece candidates would already achieve both
coverage and legality.

The first three-region prototype adds an additional constraint:

- the bridge/lens region must be constructed as its **own bounded region**
- it cannot simply be "the whole overlap polygon"

---

## Decision

### Continue Digging Only In These Layers

It is still worth continuing the current approach in:

- interval allocation
- source geometry extraction
- exact-cubic vs sampled selection
- wedge legality

Why:

- these layers keep producing stable, green diagnostics
- recent failures consistently appear *after* these steps

### Change Method In These Layers

The method should change in:

- `Step 4: boundary spec construction`
- `Step 5: final-face decomposition`

Why:

- this is where the first unrecoverable representation loss now occurs
- deeper tuning of ownership planes keeps trading one failure for another
### Do Not Change

Do **not** replace:

- interval scheduler
- source geometry extraction
- exact-cubic vs sampled source selection
- general cross-segment support

These are not the source of the active problem.

### Change

Change the method used in:

- `Step 4: boundary spec construction`
- `Step 5: final-face decomposition`

Specifically:

- stop treating the problem as “two specs clipped by ownership planes”
- start treating it as “a local split pair that may require a three-region decomposition”

This is the smallest meaningful change of method.

---

## Recommended New Method

### New Idea

Introduce a **split-pair decomposition** stage for:

- two adjacent specs
- same local corner/split
- no wedge conflict
- preserved authored interval ownership is required

The decomposition should explicitly allow:

1. **leading retained region**
2. **trailing retained region**
3. **bridge/lens region**

The bridge/lens region is the missing part that current ownership-plane logic
cannot represent without either:

- overlap
- or under-coverage

### Why This Is Better

It changes the abstraction from:

- “clip one spec against the other”

to:

- “partition a local union into three legal ownership regions”

That matches the evidence. The diagnostics show the missing shape is not noise.
It is a stable intermediate region.

### What This Is Not

This is **not**:

- a dash-index-specific rule
- a point-id-specific rule
- a postprocess repair after final geometry is already malformed
- a reported-sample-only special case

This **is**:

- a scenario-level decomposition rule
- triggered by geometry contracts already present in the pipeline
- intended to replace an abstraction that is provably too weak

---

## Where To Start The Change

Do **not** start from the scheduler.

Start here:

- [/Users/asa/Desktop/workspace/asra/packages/preset/src/components/geometry-model.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/components/geometry-model.ts)

And specifically around:

- `buildInsideDashBoundarySpecs(...)`
- `buildDashBoundarySpecPolygons(...)`
- the current pair decomposition helper

### Proposed Revised Flow

#### Current

1. allocate intervals
2. build source geometry
3. apply constraints
4. build specs
5. clip specs by ownership planes
6. optionally bridge or merge

#### Revised

1. allocate intervals
2. build source geometry
3. apply constraints
4. build specs
5. detect **split-pair scenario**
6. if detected, run **split-pair decomposition**
   - leading retained region
   - trailing retained region
   - bridge/lens region
7. validate:
   - coverage
   - no overlap
   - no self-intersection
8. fall back to generic path only if scenario does not match

This keeps the old generic path for cases that do not need the new method.

### Workflow Change Relative To Current Practice

Current failure loop:

1. observe a bad dash
2. tune an ownership plane or merge rule
3. re-run tests
4. get a different local regression

Revised workflow:

1. detect the first broken layer with artifacts
2. decide whether the current abstraction is expressive enough
3. if it is not expressive enough, stop tuning and change representation
4. prove the new representation in artifact/test first
5. then connect it to runtime behind scenario-level gates

This is the main process change. We stop treating every failure as a parameter
problem and start treating some failures as a representation problem.

---

## Why Not Keep Digging Into Ownership Planes

Because the evidence now says the current representation hits a ceiling.

If we keep digging the same method, we will most likely oscillate between:

- over-trimming
- overlap
- local bridge repairs

That is exactly the pattern we want to stop.

The pair diagnostics already prove:

- a single trim plane is insufficient
- a generic merged face is insufficient

So further deepening the same method is not the best use of time.

## Hard Rules For The Method Change

To keep this professional and extensible, the replacement must obey:

1. no point-specific or dash-index-specific triggers
2. no after-the-fact postprocess repair
3. no non-dash-layer changes
4. no weakening of acute, seam, or broad-coverage gates
5. no runtime adoption before artifact/test proves:
   - full coverage
   - no overlap
   - no self-intersection

---

## Risks Of Changing Method

### Risk 1: It broadens the decomposition layer

Mitigation:

- keep it scenario-gated
- only trigger on explicit split-pair geometry contracts

### Risk 2: It could regress acute or seam

Mitigation:

- keep existing acute and seam tests as hard gates
- require all three classes to stay green before merging any runtime change

### Risk 3: It could become another workaround

Mitigation:

- do not target point ids or dash indexes
- trigger only from scenario geometry:
  - two specs
  - same-corner split
  - no wedge conflict
  - preserved coverage vs overlap failure pattern

---

## Recommended Next Implementation Order

1. **Keep current runtime stable**
   - do not add more ownership-plane tweaks

2. **Add a runtime-neutral decomposition contract**
   - define the split-pair scenario explicitly

3. **Prototype the three-region decomposition in artifact/test first**
   - confirm:
     - `coverageRatio = 1`
     - `maxRasterCoverage <= 1`
     - `preCornerCoverageRatio = 1`
   - reject any candidate where the bridge is merely the full polygon
     intersection

4. **Only then connect it into runtime**
   - behind the scenario contract
   - with acute + seam + broad-coverage tests all green

5. **Re-run the findings inventory**
   - confirm the new method removes the original failure
   - confirm it does not create a new earlier failure in another stage

---

## Final Recommendation

**Do not restart the pipeline.**

**Do change method at final-face decomposition.**

The right transition point is:

- after source geometry and constraints
- before current ownership-plane-based final-face construction

In short:

- keep the early pipeline
- replace the current “two specs + ownership plane” resolution for this class
  of split pair with a proper decomposition method that can express the missing
  middle region
