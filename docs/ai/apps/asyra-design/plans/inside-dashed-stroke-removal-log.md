# Inside Dashed Stroke Removal Log

**Status:** active removal/de-emphasis log  
**Date:** 2026-04-01  
**Purpose:** record removed, downgraded, or de-authorized inside-dashed-stroke
paths during the switch from the old `local-first` runtime skeleton to the new
`global-first` rebuild

**Related documents:**

- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-rebuild-plan.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-rebuild-plan.md)
- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-implementation-backlog.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-implementation-backlog.md)
- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-legacy-test-triage-plan.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-legacy-test-triage-plan.md)
- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-legacy-test-inventory.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-legacy-test-inventory.md)

---

## 1. Why This Log Exists

The inside-dashed-stroke work did not move in a straight line.

We implemented and validated multiple `local-first` ownership, promotion, and
runtime-adoption layers before concluding that the algorithm skeleton itself
was wrong for the problem.

Those steps still need to be recorded because they were:

- real implementation decisions
- real test contracts
- real production-adjacent runtime paths

This log records what is being removed from mainline authority, what is merely
being downgraded to legacy diagnostic, and what is expected to be deleted later.

---

## 2. Removed From Default Blocking Path

These items are no longer authoritative blockers for the rebuild.

### 2.1 Artifact Family Comparison Suite

Current status:

- removed from `@asyra/preset` test tree
- no longer preserved as a runnable suite

Concrete change:

- deleted
  `packages/preset/src/__tests__/full-path-dash-gap-artifact.legacy.test.ts`
- deleted old artifact-heavy follow-up suites:
  - `packages/preset/src/__tests__/crossing-dash-artifact.test.ts`
  - `packages/preset/src/__tests__/seam-dash-artifact.test.ts`

Reason:

- this suite preserved the old local-first artifact skeleton too strongly
- its decision history now lives in docs, not runnable blocking code

### 2.2 Old Local-First Cases Inside Blocking Test Files

Current status:

- removed from default blocking execution
- removed instead of being kept behind a legacy runtime flag

Concrete change:

- old local-first assertions were deleted or replaced with new Phase 1 / Phase 2
  tests
- default suite now contains only the new global-first interval/candidate gates

Reason:

- these cases encoded old assumptions about:
  - local-gap promotion
  - scenario-owned facing-terminal retention
  - remote-pollution runtime adoption layering
  - early wedge clipping
  - smooth-turn and split-pair local repair outcomes

### 2.3 Old Phase 3+ Runtime Execution Removed From Default Product Path

Current status:

- removed from default `createDashedGeometryModel(...)` execution
- no longer executed on the default path

Concrete change:

- default product execution now stops after:
  - `dashIntervalAllocation`
  - empty `model.polygons`
- old Phase 3+ runtime adoption / ownership execution was physically deleted
- transitional Phase 2 candidate preview / polygon stitching execution was also
  physically deleted
- dashed-only compatibility surfaces were deleted from the runtime result:
  - `hitPolygons`
  - `debugParts`
  - `GeometryModelDebugPart`
- dashed hit-testing now reads directly from `model.polygons`

Reason:

- Phase 2 product integration must not continue paying the execution cost of
  old local-first overlap / ownership layers
- the old Phase 3+ layers were no longer authoritative for the rendered output
- the transitional Phase 2 polygon-splicing path was explicitly rejected and
  must not survive as a hidden fallback

---

## 3. Downgraded To Legacy Diagnostic

These items remain in decision history and planning docs, but no longer define
the rebuild in code.

### 3.1 Local-Gap Promotion Path

Downgraded areas:

- accumulated local-gap retained-parts expectations
- promotable-local-gap integration contracts
- local-gap restoration benchmarks

Why downgraded:

- the new rebuild does not want local-gap promotion to remain the main repair
  skeleton

### 3.2 Scenario-Owned Facing-Terminal Retention Path

Downgraded areas:

- scenario-owned split-adjacent improvement benchmarks
- scenario-owned-gap repair-path assertions
- local phase-order assumptions tied to that path

Why downgraded:

- these were narrow local-first tactics, not durable top-level correctness

### 3.3 Remote-Pollution Runtime Adoption Stack

Downgraded and deleted runtime areas:

- runtime adoption boundary
- owner-class runtime surface
- runtime surface consumer
- owner projection preconditions
- owner projection payload
- owner projection semantics consumer
- owner projection output

Why downgraded:

- this stack represented a real branch of work
- but it was built on the wrong local-first skeleton
- the new rebuild resolves overlap at component level after full candidate
  generation, so this layering is no longer the target architecture

### 3.4 Early Wedge / Ownership / Split-Pair Repair Shape

Downgraded areas:

- acute-corner wedge assertions
- smooth-turn local single-polygon assertions
- split-pair-specific final coverage assertions as a primary runtime skeleton

Why downgraded:

- the rebuild explicitly moves overlap and ownership later
- these tests assumed the old phase order

---

## 4. Expected Future Removal

These items are still present, but are expected to be removed after the
`global-first` path becomes the only production path.

### 4.1 Transitional Debug Shapes Inside `geometry-model.ts`

Expected future removal:

- none in the active dashed runtime path
- the previous dashed debug compatibility surfaces were already removed from
  code

### 4.2 Historical Decision Records In Docs

Expected future removal:

- none from docs right now
- historical entries remain intentionally as decision history

### 4.3 Stage-Specific Artifact Outputs

Expected future removal:

- raw / wedge / ownership artifact outputs that only exist to explain the old
  stage order

Possible later reuse:

- some body-only candidate views may be harvested as debug-only aids for
  `Phase 2: DashCandidateGeometry`
- but not in the deleted local-first artifact structure

---

## 5. What This Log Does Not Claim

This log does not claim that all of the downgraded work was pointless.

Some of it was useful because it proved:

- the current correctness stack was validating the wrong things
- conflict resolution cannot be trusted when done during isolated dash
  generation
- visible render correctness and intermediate contracts had drifted apart

That historical value is exactly why the path changes are being recorded here
instead of silently discarded.

---

## 6. Current Command Surfaces

- default blocking path:
  `yarn workspace @asyra/preset test:local`
- legacy diagnostic path:
  `yarn workspace @asyra/preset test:legacy-diagnostic`

Current interpretation:

- default path protects the smaller set of surviving hard gates
- legacy path preserves historical diagnostics, including known old-path
  failures

---

## 7. Decision-History Sync Note

The removal and downgrade decisions recorded here should also be summarized in
append-only decision history.

Primary target:

- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/decisions/releases/unreleased.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/decisions/releases/unreleased.md)

This log exists so the later `unreleased.md` entry can reference a stable
removal record instead of trying to reconstruct the path from memory.
