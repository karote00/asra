# Inside Dashed Stroke Spec Audit

**Date:** 2026-03-28  
**Scope:** `inside` positioned dashed stroke runtime, benchmarks, and process  
**Primary files reviewed:**
- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-flow-first-plan.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-flow-first-plan.md)
- [/Users/asa/Desktop/workspace/asra/packages/preset/src/components/geometry-model.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/components/geometry-model.ts)
- [/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/geometry-model.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/geometry-model.test.ts)
- [/Users/asa/Desktop/workspace/asra/apps/asyra-design/e2e/definitions/reference-dashed-stroke-single-dash-high-curvature-turn.definition.md](/Users/asa/Desktop/workspace/asra/apps/asyra-design/e2e/definitions/reference-dashed-stroke-single-dash-high-curvature-turn.definition.md)
- [/Users/asa/Desktop/workspace/asra/apps/asyra-design/e2e/definitions/reference-dashed-stroke-completeness.definition.md](/Users/asa/Desktop/workspace/asra/apps/asyra-design/e2e/definitions/reference-dashed-stroke-completeness.definition.md)

## Executive Summary

The current work has a valid high-level direction, but the implementation is still failing in the exact place the plan says is most critical: **Step 6, Final-Face Decomposition**.

The main good news is:
- The plan is conceptually sound.
- The runtime has already been simplified meaningfully.
- The benchmarks are strong enough to guide continued work.

The main bad news is:
- The current runtime still does not fully honor the plan's core promise that one authored dash interval becomes one correct non-overlapping rendered dash face.
- Several focused tests are proving local properties, but there is still a gap between those local assertions and the user's real visual failure case.
- The workflow has repeatedly drifted into local debugging because the strongest benchmark is still too local and too permissive around the exact crossing-dash / multi-segment turning-dash scenario.

## 1. Is The Algorithm Following The Spec / Plan?

### Short Answer

**Partially.**

The runtime now follows the **shape of the plan**, but it does not yet fully satisfy the **behavioral contract** of the plan.

### Where It Matches The Plan

These parts are now reasonably aligned with the flow-first plan:

1. **Step 1: Authored path geometry**
   - `buildPathGeometry(...)`
   - `buildVectorGeometryModelPath(...)`
   - `buildPolylineGeometryModelPath(...)`
   - This stage is clean enough and not mixed with dash allocation.

2. **Step 2: Dash interval allocation**
   - `buildDashIntervals(...)`
   - `buildDashedStrokeIntervals(...)`
   - The spec says dash/gap allocation must follow authored centerline arc length. The runtime and tests now do this.

3. **Step 3 / 4: Interval source extraction and boundary generation**
   - `buildInsideDashSliceAtInterval(...)`
   - `resolveInsideDashSourceGeometry(...)`
   - `buildInsideDashBoundariesFromSourceGeometry(...)`
   - The runtime has been simplified so that `inside` now uses only:
     - `exact-cubic`
     - `sampled`
   - This is much closer to the plan and removes prior noisy fallback behavior.

4. **Step 5: Scenario constraints**
   - `resolveInsideDashEdgeConstraints(...)`
   - `applyInsideDashSliceConstraints(...)`
   - `buildInsideDashBoundarySpecs(...)`
   - This is now more clearly isolated than before.

### Where It Does **Not** Yet Match The Plan

The plan says:

> Step 6 must produce final render faces that are non-overlapping, non-self-intersecting, and with explicit ownership of strip vs cap.

This is still the weak point.

Current Step 6 code:
- `buildRawDashBoundarySpecPolygons(...)`
- `applyDashBoundarySpecWedgeConstraints(...)`
- `buildDashBoundarySpecPolygons(...)`
- `mergeOverlappingConvexPolygons(...)`

Problems:
- The runtime still assembles the final face out of boundary-spec-local polygons plus optional bridge polygons.
- This is still a **polygon repair / merge** strategy, not a true **final-face construction** strategy.
- That means the runtime can pass local checks like:
  - no pairwise overlap
  - cap arc close to ideal arc
  - source length close to dash length
  while still failing the actual visual contract:
  - the dash is too short through a turn
  - cap and body look disconnected
  - the crossing dash near the smooth corner looks wrong

### Practical Conclusion

The runtime **is following the plan structurally**, but **not yet behaviorally**.

The code now has the right pipeline boundaries, but Step 6 is still implemented as:

`spec polygons -> clip -> merge`

when the plan really calls for:

`one authored dash interval -> one explicit non-overlapping final-face ownership model`

That difference explains why the project keeps feeling "close" but still visually wrong.

## 2. Did The Earlier Prompt Help?

### Short Answer

**Yes, but only partially.**

The prompt helped most at the **requirements level**, not at the direct implementation level.

### What In The Prompt Was Useful

The following ideas are genuinely useful and align with the plan:

1. **Corner dash synchronization**
   - The prompt correctly pushes toward treating corners as a local fitting problem rather than an accidental side effect.
   - This matches the flow-first plan's distinction between:
     - interval allocation
     - scenario constraints
     - final-face ownership

2. **Closed-path seam elimination**
   - Also useful.
   - It reinforces that seam behavior belongs in interval allocation / cap policy, not as an ad-hoc render fix.

3. **Adaptive fitting as a concept**
   - Useful as a design direction.
   - Especially helpful for recognizing that the renderer may need to preserve a dash at a corner rather than allow a tiny fragment or a visually broken crossing dash.

### What In The Prompt Is Potentially Misleading

Some parts of the prompt are not a drop-in fit for the current contract:

1. **"Dash centered exactly on every corner"**
   - This is an Illustrator-like feature proposal.
   - It is not the same thing as the current contract, which allocates dash/gap along authored centerline arc length with no corner-centric redistribution rule.
   - If implemented now without a deliberate spec change, it would change authored dash semantics.

2. **"Normalize dash/gap so total cycle divides total path length"**
   - Also useful as a feature idea.
   - But this is not a bug fix for the current runtime; it is a different dash allocation policy.
   - It should be considered an optional higher-level mode, not silently folded into the current implementation.

### Final Judgment On The Prompt

The prompt is helpful as:
- a reminder to separate **requirements** from **implementation**
- a reminder that corner behavior and seam behavior need deliberate ownership

The prompt is **not** helpful if used as:
- direct implementation instructions for the current spec
- justification for changing dash allocation semantics without explicitly changing the contract

## 3. Do We Have Tests Supporting The Algorithm And Spec?

### Short Answer

**Yes, but unevenly.**

There is now good test support for:
- authored interval correctness
- source-length correctness
- local high-curvature cap alignment
- full-path completeness

There is still insufficient direct coverage for:
- multi-segment crossing-dash face ownership
- "dash body continuity through a smooth turn"
- edit-state chrome regressions as hard blockers

### Existing Helpful Tests

#### Strong Unit-Level Support

In [/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/geometry-model.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/geometry-model.test.ts):

- `single-dash high-curvature-turn benchmark: keeps the turning dash at full interval length and tight to segment 44 for dash 20 gap 20`
- `single-dash high-curvature-turn benchmark: keeps the terminal cap aligned to the ideal round cap arc for dash 20 gap 20`
- `single-dash high-curvature-turn benchmark: matches the true-offset final face for dash 20 gap 20`
- `single-dash high-curvature-turn benchmark: keeps the end cap disjoint from the main strip for dash 20 gap 20`
- `single-dash high-curvature-turn benchmark: keeps single-ownership and complete coverage across the terminal cap interior for dash 20 gap 20`

These are valuable because they prove:
- exact-cubic adherence
- cap placement
- no obvious overlap
- local ownership in one focused turning case

Also useful:
- `reported sample benchmark: dash 27 gap 20 should produce a dash that crosses point tp-21`
- `reported sample benchmark: runtime crossing dash should stay close to the multi-segment exact-offset candidate around tp-21`
- `full-path dash benchmark: keeps authored full-dash source lengths uniform for dash 20 gap 20`

These confirm:
- the problematic sample is known
- a crossing-dash scenario is recognized
- authored interval length is stable

#### Strong E2E-Level Support

In [/Users/asa/Desktop/workspace/asra/apps/asyra-design/e2e/reference-dashed-stroke-completeness.spec.ts](/Users/asa/Desktop/workspace/asra/apps/asyra-design/e2e/reference-dashed-stroke-completeness.spec.ts):

- full-path completeness metrics
- segment recall
- gap leak / outside leak
- selected vs deselected local diagnostics

In [/Users/asa/Desktop/workspace/asra/apps/asyra-design/e2e/reference-dashed-stroke-rendering.spec.ts](/Users/asa/Desktop/workspace/asra/apps/asyra-design/e2e/reference-dashed-stroke-rendering.spec.ts):

- local canary rendering checks

These are enough to prevent large regressions in:
- path creation fixture
- overall dash visibility
- obvious full-path failures

### Current Test Gaps

This is the key issue.

The tests are strong on:
- **source interval correctness**
- **local single-turn final-face properties**

But weak on:
- **one dash that must span across a smooth corner and still visually look like one dash**

Specifically missing is a hard gate that says:

> For a multi-segment dash crossing a smooth turning anchor, the final rendered face must preserve continuous body ownership across the corner and must not visually shorten before the authored interval ends.

The current reported-sample tests get close, but they are still mostly checking:
- interval bounds
- source length
- similarity to a candidate offset face

They are **not yet a direct visual-continuity oracle** for the exact artifact the user keeps showing.

## Main Findings

### Finding 1

The plan is not the main problem anymore.  
The current plan is actually good enough to continue from.

### Finding 2

The implementation has improved in structure, but Step 6 is still conceptually underpowered.  
It still repairs local polygons instead of owning the final face directly.

### Finding 3

The prompt helped at the requirement level, but must not be used to silently change dash allocation semantics.

### Finding 4

The existing tests are good enough to stop blind debugging, but not yet strong enough to guarantee the exact reported smooth-corner crossing-dash behavior.

### Finding 5

The repeated regressions were not because "there was no benchmark at all".  
They happened because the benchmarks proved many sub-properties, while the most user-visible property was still only indirectly measured.

## Recommended Next Steps

1. **Do not rewrite the plan again.**  
   The current flow-first plan is already the right abstraction.

2. **Stop treating Step 6 as polygon repair.**  
   Reframe it as final-face ownership:
   - body ownership
   - cap ownership
   - corner transition ownership

3. **Add one missing hard benchmark for the reported sample.**  
   A new focused test should assert:
   - the crossing dash near `tp-21` stays a single continuous painted body through the corner neighborhood
   - the body does not visually terminate early before the authored interval end
   - the cap joins the body without a visible seam

4. **Do not adopt Illustrator-style adaptive dash fitting unless the contract changes.**  
   That belongs in a separate feature decision.

5. **Keep edit-state overlay concerns separated.**  
   They are real, but they are not the same as final dash geometry correctness.

## Direct Answers To The User's Three Questions

### 1. Is the algorithm / flow following the spec / plan?

**Structurally yes, behaviorally not fully.**

The pipeline boundaries now resemble the plan, but Step 6 still does not fully satisfy the intended ownership model.

### 2. Did the earlier prompt help?

**Yes, as a requirements reminder.**  
**No, not as direct implementation instructions.**

It helped clarify corner/seam responsibilities, but parts of it imply a different dash allocation policy than the current spec.

### 3. Are there tests helping the algorithm and spec?

**Yes, and they are already useful.**

But there is still one important missing hard gate:
- a direct focused benchmark for the user's actual smooth-corner crossing-dash continuity failure.

