# Inside Dashed Stroke Legacy Test Triage Plan

**Status:** proposed test-triage plan  
**Date:** 2026-04-01  
**Purpose:** detach the new `global-first` rebuild from the old `local-first`
runtime/test skeleton without losing the useful baseline or historical signals

**Related documents:**

- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-rebuild-plan.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-rebuild-plan.md)
- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-implementation-backlog.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-implementation-backlog.md)
- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-tdd-plan.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-tdd-plan.md)

---

## 1. Why This Plan Exists

The current test suite mixes together three different things:

1. tests that express genuine long-term correctness
2. tests that only validate the current local-first implementation shape
3. tests that are useful only as diagnostics/history

If these stay mixed together, the new global-first algorithm will be forced to
imitate the old runtime structure.

That would recreate the same failure mode:

- old intermediate contracts stay green
- new implementation is dragged back toward old local-first assumptions
- final render still remains wrong

This plan defines how to triage the existing tests before the rebuild begins.

---

## 2. Triage Categories

Every existing inside-dashed-stroke test must be moved into exactly one of
these categories.

### A. Keep As Hard Gate

A test stays in the main blocking suite only if:

- it is still valid for the new global-first pipeline
- it constrains durable correctness
- it does not assume the old local-first repair path

### B. Downgrade To Legacy Diagnostic

A test moves to legacy/diagnostic if:

- it is useful for comparison or debugging
- but it encodes the old pipeline shape
- or it constrains a temporary implementation detail rather than a durable
  correctness rule

These tests may still be runnable, but they must not block the new rebuild.

### C. Remove

A test should be removed if:

- it exists only to preserve old local-first internals
- it validates payload/surface/adoption state that the new algorithm will not
  use
- it would force the new design to imitate obsolete structure

---

## 3. Keep As Hard Gate

These areas should remain blocking.

### 3.1 Schedule / Interval Correctness

Keep tests that constrain:

- monotonic interval ordering
- authored dash length correctness
- authored gap length correctness
- cross-segment interval continuity
- seam adjacency correctness

Reason:

- these are still foundational in the new algorithm
- they belong to `Phase 1: DashIntervalRecord`

### 3.2 True Geometry Correctness

Keep tests that constrain:

- dash body follows the true path slice
- cross-segment dash continuity is preserved
- curve geometry is not replaced with tangent-only approximations
- cap geometry itself is correct for the selected cap mode

Reason:

- these belong to `Phase 2: DashCandidateGeometry`
- they are independent of the old ownership/repair pipeline

### 3.3 Final Render Correctness

Keep tests that constrain:

- final polygons consumed by render
- mesh output correctness
- screenshot-visible cap presence
- screenshot-visible dash/gap correctness

Reason:

- these are still the top-level truth source
- the new pipeline must eventually satisfy them directly

### 3.4 Stable Cross-Segment Continuity Benchmarks

Keep tests whose real value is:

- ensuring a single authored dash remains continuous across multiple segments
- ensuring the dash does not terminate early before the interval ends

Reason:

- this is one of the clearest long-term user-facing requirements

---

## 4. Downgrade To Legacy Diagnostic

These tests are still informative, but they should no longer block the rebuild.

### 4.1 Local-Gap Promotion Tests

Downgrade tests centered on:

- `buildAccumulatedLocalGapRetainedParts(...)`
- promotable local-gap accumulation behavior
- the exact promoted/raw split between `debugParts` and `model.polygons`

Reason:

- the new global-first design does not want local-gap promotion to remain the
  authoritative repair skeleton
- these tests encode the old repair path

### 4.2 Scenario-Owned Facing-Terminal Retention Tests

Downgrade tests centered on:

- `buildAccumulatedScenarioOwnedFacingTerminalRetainedParts(...)`
- scenario-owned split-adjacent retention improvement
- specific scenario-owned retained windows

Reason:

- these are narrow local-first repair tactics
- they may remain useful as historical diagnostics, but not as future gates

### 4.3 Remote-Pollution Runtime Adoption / Payload / Surface Tests

Downgrade tests centered on:

- runtime adoption boundary
- owner-class runtime surface
- runtime surface consumer
- projection preconditions
- projection payload
- projection semantics consumer
- projection output

Reason:

- these tests validate the old remote-pollution runtime layering
- the new algorithm may replace this entire path with component-level overlay
  resolution

### 4.4 Family-Specific Artifact Contracts

Downgrade tests centered on:

- Family A / B / C artifact comparison
- rejected-vs-accepted remote prototype summaries
- gate matrix entries tied to the old remote-pollution ownership path

Reason:

- these are still useful as research artifacts
- they are not durable correctness targets for the new rebuild

### 4.5 Old Wedge/Ownership Intermediate Assertions

Downgrade tests that constrain:

- intermediate wedge stage geometry
- intermediate ownership stage geometry
- old assumptions about where clipping must happen during candidate generation

Reason:

- the rebuild intentionally moves clipping and ownership later
- these tests would re-freeze the old phase order

---

## 5. Remove

These tests should be removed once the new rebuild is active.

### 5.1 Old Structural Contract Tests

Remove tests whose only purpose is to preserve:

- old payload shape
- old adoption-state shape
- old boundary/surface/consumer record structure
- old runtime patch state transitions

Reason:

- those are not correctness properties
- they are implementation-shape preservation

### 5.2 Obsolete Family-Patch Presence Tests

Remove tests that only assert:

- a certain patch path was triggered
- a certain repair family was applied
- a certain intermediate patch emitted exactly the old data shape

Reason:

- the rebuild must be free to replace the old patch skeleton entirely

### 5.3 Tests That Pass While Visible Render Is Still Wrong

Remove or rewrite tests that can pass even when:

- caps are visibly missing
- dash terminals are visibly tangent-driven
- overlap is visibly wrong
- final screenshot is visibly incorrect

Reason:

- these tests are actively misleading at this stage

---

## 6. Suggested Triage By File

This section defines the expected direction by current file, not final exact
line-by-line decisions.

### [/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/geometry-model.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/geometry-model.test.ts)

Keep as hard gate:

- interval monotonicity / authored dash-gap correctness
- true-geometry and cross-segment continuity benchmarks
- cap geometry correctness benchmarks that do not depend on old local-first
  repair plumbing

Downgrade to legacy diagnostic:

- local-gap promotion contracts
- scenario-owned facing-terminal retention contracts
- remote-pollution adoption/payload/projection contracts
- old stage-specific wedge/ownership assertions that enforce the old phase order

Remove:

- tests preserving old runtime layering structure only

### [/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/strokes.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/strokes.test.ts)

Keep as hard gate:

- render-path consumption of final polygons
- final mesh visibility
- final render continuity

Downgrade to legacy diagnostic:

- inside-dashed wedge-only expectations that assume early clipping remains the
  dominant mechanism

Remove:

- tests that exist only to preserve old render-side workarounds

### [/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/full-path-dash-gap-artifact.legacy.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/full-path-dash-gap-artifact.legacy.test.ts)

Keep as hard gate:

- none by default during the rebuild

Downgrade to legacy diagnostic:

- all artifact-family selection and family-comparison outputs
- remote-pollution family contracts
- old gate-matrix summaries

Reason:

- this file is valuable for historical comparison
- but it should not define the new global-first blocking suite
- it should move behind a separate legacy diagnostic entrypoint

### E2E Tests Under [/Users/asa/Desktop/workspace/asra/apps/asyra-design/e2e](/Users/asa/Desktop/workspace/asra/apps/asyra-design/e2e)

Keep as hard gate:

- only final visible correctness

Downgrade to legacy diagnostic:

- completeness metrics that remain diagnostic-only
- any e2e metric that measures coverage span but does not hard-gate visible cap
  correctness

Rewrite:

- add new final visible cap-presence gates
- add new screenshot-visible dash/gap correctness gates

---

## 7. Execution Order

The triage should be done in this order.

### Step 1. Inventory Current Tests

For each existing inside-dashed-stroke test:

- record file
- record test name
- assign category:
  - hard gate
  - legacy diagnostic
  - remove

### Step 2. Introduce New Suite Boundaries

Create explicit suite separation:

- `core-global-first`
- `legacy-diagnostic`
- `final-render-hard-gate`

The exact naming can vary, but the separation must be explicit.

### Step 3. Move Legacy Tests Out Of Blocking Path

Before new implementation begins:

- remove legacy diagnostic tests from the default blocking path

This is the key step that prevents the old skeleton from dominating the rebuild.

### Step 4. Rewrite E2E Expectations

Once new final render is available:

- rewrite e2e to hard-gate visible cap presence and visible dash correctness

---

## 8. Acceptance Criteria For Triage Completion

The triage is complete only if:

1. the default blocking suite no longer requires the old local-first runtime
   layering
2. schedule / true-geometry / final-render tests still remain protected
3. old artifact/family/adoption tests remain available as diagnostics where
   useful
4. the new global-first implementation can begin without being dragged back into
   the old repair skeleton

---

## 9. Immediate Next Action

The first concrete inventory pass is now recorded in:

- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-legacy-test-inventory.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-legacy-test-inventory.md)

Before implementing `DashIntervalRecord`, use that inventory as the working
document for:

- suite separation
- downgrade/removal order
- identifying which hard gates survive into the new `global-first` path
