# Inside Dashed Stroke Status

**Date:** 2026-03-30  
**Scope:** current runtime implementation status, verified progress, and remaining blocked issues for `inside` dashed stroke

## Purpose

This document is a practical status summary of:

- what has already been implemented in production runtime
- what has been validated by unit/artifact/build checks
- what is still unresolved
- where the current blockers are

This is intentionally not a plan file and not an AI-internal report.

---

## Runtime Areas In Scope

Primary runtime files:

- [/Users/asa/Desktop/workspace/asra/packages/preset/src/components/geometry-model.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/components/geometry-model.ts)
- [/Users/asa/Desktop/workspace/asra/packages/preset/src/components/strokes.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/components/strokes.ts)

Primary validation files:

- [/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/geometry-model.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/geometry-model.test.ts)
- [/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/strokes.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/strokes.test.ts)
- [/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/full-path-dash-gap-artifact.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/full-path-dash-gap-artifact.test.ts)
- [/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/crossing-dash-artifact.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/crossing-dash-artifact.test.ts)
- [/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/seam-dash-artifact.test.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/seam-dash-artifact.test.ts)

---

## What Is Already Implemented

## 1. Dash / Gap Schedule Is Stable

Implemented and verified:

- dash/gap interval allocation from authored path origin
- cross-segment dash scheduling
- full-path monotonic interval ordering

Current verified behavior:

- full authored dash intervals remain consistent
- full authored gap intervals remain consistent
- schedule is no longer treated as the primary bug source

This means the pipeline now reliably answers:

- where each dash starts
- where each dash ends
- where each gap starts
- where each gap ends

without using per-sample logic.

## 2. Cross-Segment Dash Support Exists

Implemented and verified:

- dashes can cross segment boundaries
- this applies to both ordinary transitions and more complex reported-sample cases

Current verified behavior:

- the system does not incorrectly stop dashes at every point boundary
- multi-segment dash ownership is supported in the scheduling/source-geometry stages

## 3. Acute / Sharp Constraint Stage Was Brought Back Under Control

Implemented and verified:

- wedge correctness for inside dashed stroke
- true-segment wedge clipping
- acute/right-triangle legality recovery

Current verified behavior:

- acute/sharp corner legality is no longer being treated as a free-form workaround area
- the constraint stage is no longer the dominant global source of breakage it was earlier

## 4. Closed Seam Has Its Own Decomposition Path

Implemented and verified:

- seam was separated from generic corner logic
- seam now uses seam-specific decomposition rather than generic sharp-corner ownership

Current verified behavior:

- seam is no longer handled as an ordinary ownership trim case
- seam-specific artifact/debug path exists for inspection

## 5. Same-Corner Split Pair Now Uses a Better Final-Face Method

Implemented in production runtime:

- `same-corner split pair` no longer relies only on the older two-piece ownership trim path
- runtime now uses a local sampled lens-window ownership approach for this scenario

What changed conceptually:

- old approach:
  - trim one side
  - keep the other
  - hope overlap or undercoverage disappears
- current approach:
  - build local retained regions
  - derive a local lens window from nearby sampled boundary geometry
  - emit a no-overlap final result that preserves authored coverage

Current verified behavior:

- the main reported-sample split-pair dash now reaches full final coverage
- pre-corner and post-corner final coverage are both restored
- this was the first production implementation that simultaneously achieved:
  - full coverage
  - no missing final ownership
  - no overlap in the candidate decomposition family

## 6. Artifact-Based Diagnostics Are Now Strong

Implemented:

- artifact generation for:
  - crossing dash
  - seam dash
  - full-path dash/gap coverage
- multi-layer comparison outputs such as:
  - pre-constraint
  - raw
  - wedge
  - ownership
  - body-only no caps
  - final

Current value:

- problems can now be classified by stage instead of only by screenshot
- this makes it possible to distinguish:
  - schedule bugs
  - source geometry bugs
  - wedge/constraint bugs
  - final-face bugs
- remote-overlap pollution

## 7. Dash Face Regions Debug Representation Exists

Implemented and verified:

- each debug dash part now exposes explicit face-region groups:
  - `bodyRegion`
  - `startTerminalRegion`
  - `endTerminalRegion`
  - `mergedFinalRegion`
- the canonical rectangle mid-side test now hard-gates that free-side dashes still expose non-empty body and both terminal regions
- artifact output now writes region-level SVGs and metrics for:
  - the reported-sample worst dash
  - the reported-sample local adjacent gap pair
  - the canonical rectangle local gap pair

Current value:

- body vs terminal ownership can now be inspected directly
- local-gap and terminal-owned diagnostics no longer need to infer everything from one merged polygon
- this gives a safer base for the next runtime step: terminal-owned region emission/subtraction instead of whole-dash trimming

## 8. Gap-Local Promotion Is Now Active For A Narrow Scenario Class

Implemented in production runtime:

- `classifyLocalGapPromotionEligibility(...)` now uses a narrower gate:
  - `local-adjacent-pair`
  - same-segment adjacent pair
  - single-face pair
  - non-canonical local window
  - low internal terminal turn on both participating dashes
- only that narrower class is allowed into accumulated terminal-owned retained subtraction
- promotion is applied to:
  - `model.polygons`
  - `hitPolygons`
- promotion is intentionally **not** written back into `debugParts`

Current verified behavior:

- the reported-sample true local pair now preserves its authored gap in production output
- the high-curvature canary no longer misclassifies its terminal-adjacent pair as promotable
- canonical straight-side round-cap pairs remain excluded from promotion
- debug inspection stays on raw baseline geometry, while render output uses promoted polygons where eligible

There are now also integration-style contract tests for this path:

- the promotable reported-sample gap is preserved by:
  - `model.polygons`
  - `hitPolygons`
- the same promotable gap remains visibly under-cleared in raw `debugParts`
- accumulated promotion applies only to:
  - `promotable-local-gap`
- and explicitly excludes:
  - `remote-pollution`
  - `scenario-owned-gap`

Additional production-emit integration contracts now also exist for:

- `same-corner split pair`
  - `model.polygons`
  - `hitPolygons`
  both keep full authored coverage through the repaired pre/post-corner windows
- `closed seam`
  - `model.polygons`
  - `hitPolygons`
  both keep healthy pre/post-seam final coverage
- `remote-pollution`
  - `model.polygons`
  - `hitPolygons`
  both stay aligned on the active remote gap, keep that gap unresolved, and do
  not enter local-gap promotion

---

## What Has Been Verified

The following checks were run successfully on the current implementation:

- `yarn workspace @asyra/preset test:local src/__tests__/geometry-model.test.ts src/__tests__/strokes.test.ts`
- `WRITE_FULL_PATH_DASH_GAP_ARTIFACTS=1 yarn workspace @asyra/preset test:local src/__tests__/full-path-dash-gap-artifact.test.ts`
- `yarn eslint /Users/asa/Desktop/workspace/asra/packages/preset/src/components/geometry-model.ts /Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/geometry-model.test.ts /Users/asa/Desktop/workspace/asra/packages/preset/src/__tests__/full-path-dash-gap-artifact.test.ts`
- `yarn react:build`

Current verified outcome:

- `geometry-model + strokes`: passing
- artifact test: passing
- lint: clean
- build: passing

---

## What Is No Longer Considered The Main Problem

These were investigated and are no longer considered the primary root cause:

- global dash/gap interval allocation
- lack of cross-segment dash support
- generic “dash stops at the point” explanation
- non-dash overlay layers
- generic cap orientation as the main answer
- simple pairwise cap trim as a general fix

---

## Current Remaining Problems

## 1. Remote Pollution Cases Still Exist

What is already known:

- some global worst-gap cases are not purely local
- some are polluted by remote non-neighbor dashes
- therefore local gap policy must not try to repair global self-overlap cases

What is still missing:

- a cleaner way to detect remote self-overlap pollution
- a separate scenario-level strategy for those cases

Some visually bad “gap” cases are not local adjacent-gap bugs at all.

In those cases:

- a non-neighbor dash projects into the same 2D space
- the gap looks broken
- but a local cap/body rule would be the wrong fix

## 2. Body-Only Diagnostics Still Diverge From Final Face In Some Cases

For some reported samples:

- `body-only` is still not a legal final answer
- final-face now compensates correctly in the repaired split-pair case
- the closed-seam pre-window case is now also in this category:
  - pre-seam `final` coverage is healthy
  - pre-seam `body-only / ownership` still under-cover

This is acceptable for now, but it means:

- body-only diagnostics remain useful for debugging
- they are not always a correctness target by themselves

## 4. Performance Is Still Poor In Path Editing

Known issue outside the current dash-correctness priority:

- dragging vector elements is laggy
- manipulating vector points/handles in path editing mode is laggy
- zoom/pan during path editing is laggy

This has been intentionally deprioritized for now.

Current stance:

- first finish dash correctness
- optimize performance afterward

---

## Current Blockers

## Blocker A: Narrow Gap-Local Promotion Exists, But Only For One Safe Scenario Class

There is now algorithm-first documentation, an artifact-side prototype, and a
production promotion path for a **narrow** local-gap scenario class:

- local gap classification
- local gap window construction
- retained-region subtraction
- terminal-owned subtraction using explicit dash face regions

What is already true in runtime:

- `promotable-local-gap` is active for:
  - `model.polygons`
  - `hitPolygons`
- `debugParts` intentionally remain on raw baseline geometry for diagnostics
- the reported-sample true local pair now preserves its authored gap in
  production output
- the high-curvature canary no longer misclassifies its terminal-adjacent pair
- canonical straight-side round-cap pairs remain excluded

What the prototyping work proved:

- simply moving from whole-dash subtraction to `faceRegions`-aware terminal subtraction is not enough
- even when subtraction is limited to terminal-owned geometry, canonical straight-side round-cap pairs still degrade into body-dominant rectangles
- the remaining blocker is therefore not just implementation granularity
- it is a contract question about how much authored gap preservation is allowed to override ordinary round-cap symmetry on healthy straight-side pairs

Current implication:

- `DashFaceRegions` is now a useful debug representation
- but it is not, by itself, a complete general gap-local runtime answer

Recent validated distinction:

- reported-sample `exact-cubic` local pair can now be classified as
  `promotable-local-gap`
- canonical straight-side round-cap pair can now be classified as
  `round-cap-canonical-gap`

This means runtime no longer has to guess whether every `local-adjacent-pair`
should be repaired.

The current gap taxonomy is now covered by core tests:

- `promotable-local-gap`
- `remote-pollution`
- `scenario-owned-gap`

There is now also a shared runtime-side helper for this taxonomy:

- `classifyGapRepairPath(...)`

It packages:

- local gap classification
- promotion eligibility
- the resulting repair path

This keeps runtime helpers, artifact harnesses, and core tests aligned on one
decision contract instead of reconstructing the same logic separately.

This matters because the runtime no longer has to treat every visually bad gap
as the same family. The three classes are now explicitly separated:

- `promotable-local-gap`
  - eligible for the current narrow production repair
- `remote-pollution`
  - explicitly excluded from local-gap promotion
- `scenario-owned-gap`
  - explicitly excluded from local-gap promotion because the gap is owned by a
    higher-order geometric scenario rather than a simple adjacent-pair conflict

The latest promotion work also established a hard limit:

- `same-segment + exact-cubic + adjacent-unconstrained-pair` is still too broad
- even `classifier = local-adjacent-pair` is still not sufficient by itself

That gate is not sufficient, because it also captures many healthy round-cap
pairs on ordinary segments and reduces canary completeness. Canonical
straight-side rectangle pairs and reported-sample local pairs now both classify
as `local-adjacent-pair`, and both can produce retained-region clear ratio `1`
in artifact space, but only the reported-sample pair is safe to promote. The
current runtime therefore uses a narrower scenario gate:

- same-segment adjacent pair
- single-face pair
- non-canonical local window
- low internal terminal turn on both participating dashes

There is also a second structural limit now confirmed:

- pairwise promotion cannot mutate `debugParts` in sequence

When the runtime applies retained subtraction pair-by-pair, a middle dash that
participates in two neighboring gaps gets clipped twice. That is what caused
canonical rectangle mid-side dashes to collapse to empty polygons during the
last promotion experiment. The next runtime attempt therefore must change data
flow, not just classifier thresholds:

- first collect all eligible local gap windows
- then apply terminal subtraction once per dash from the original geometry

There is now a third concrete limit:

- even accumulated subtraction across all local gap windows is still too coarse

An artifact-only prototype was added to test this explicitly. It confirms:

- reported local exact-cubic pair: retained clear ratio can be restored to `1`
- canonical rectangle local sampled pair: retained clear ratio can also be
  restored to `1`
- but applying those windows to whole-dash polygons still leaves canonical
  mid-side dashes with empty final polygons

This means the next algorithm change cannot stay at whole-dash polygon level.
The subtraction granularity must move down to terminal-owned geometry:

- subtract only from the participating terminal region
- do not subtract from the full body polygon of the dash

An artifact-only terminal-owned prototype has now also been tested. It improves
the earlier whole-dash subtraction failure, but it exposes a new design limit:

- local gap clear ratio can be restored to `1`
- canonical rectangle mid-side dashes no longer collapse to empty polygons
- but some of them degrade to plain body rectangles with `4` vertices, meaning
  both facing round caps are effectively removed

This means the next question is no longer only geometric legality. It is now a
contract question:

- should strict gap preservation win
- or should standard round-cap symmetry win on ordinary straight-side pairs

That question is resolved for the current narrow runtime class:

- `promotable-local-gap` may preserve the authored gap
- `round-cap-canonical-gap` must preserve ordinary straight-side round-cap
  symmetry

What remains blocked is broader promotion beyond that narrow class.

Relevant document:

- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-gap-local-cap-pseudo-algorithm.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-gap-local-cap-pseudo-algorithm.md)

What this means:

- the runtime now contains a finished **narrow** local-gap algorithm
- but it does not yet contain a broader generalized local-gap solution

## Blocker B: Remote Pollution Is Now The Main Correctness Blocker

A major source of wasted time earlier was mixing these two classes:

- true local neighboring-dash gap failure
- remote non-neighbor intrusion into the same spatial window

This separation is now partially enforced by tests and artifact contracts:

- the reported-sample global worst gap is hard-gated as `remote-pollution`
- `geometry-model.test.ts` now also hard-gates that the worst global reported
  gap is classified as `remote-pollution` and excluded from local-gap
  promotion
- `geometry-model.test.ts` also hard-gates that the worst local-looking
  non-remote gap is classified as `scenario-owned-gap` and excluded from
  local-gap promotion
- `full-path-dash-gap-artifact.test.ts` now also hard-gates the current family
  decision for the active remote case:
  - `decision = diagnostic-only`
  - no local-gap widening
  - no generic branch-priority repair
- it must retain at least one non-neighbor contributor
- the current known remote contributor is `dashIndex = 28`
- that contributor already intrudes at:
  - `body-only`
  - `cap-only`
  - `raw`
  - `wedge`
  - `ownership`

Current implication:

- the active global worst-gap case is **not** a local cap/body coexistence bug
- local gap repair must never try to “fix” it
- remote pollution now needs its own algorithm-first path
- branch-level artifact decomposition now exists for:
  - neighboring pair
  - remote contributor
  - all contributors in the same window
- an artifact-only `explicit self-overlap decomposition` candidate now also
  exists for the active remote case:
  - neighboring window polygons: `2`
  - remote window polygons: `1`
  - overlap polygons: `1`
  - recomposed `maxRasterCoverage = 1`
- that explicit decomposition family is now also treated as:
  - `artifact-ready`
  only when it preserves:
  - neighboring-exclusive region
  - remote-exclusive region
  - shared overlap region
  and its recomposed contributor union matches the source contributor union in
  the local window without raster overcoverage
- current family decision is to keep remote pollution diagnostic-only unless a
  product rule later requires deterministic self-overlap ownership
- `artifact-ready` is explicitly **not** the same as `runtime-ready`

Related interpretation standard:

- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-correctness-standards.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-correctness-standards.md)
- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-remote-pollution-active-snapshot.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-remote-pollution-active-snapshot.md)

Primary generated artifact for this active remote case:

- `packages/preset/artifacts/full-path-dash-gap/reported-sample-remote-pollution-active.json`

## Blocker C: The Remaining Work Must Stay Algorithm-First

The current implementation has finally reached a stable method for one hard
scenario class (`same-corner split pair`).

The next stage must keep the same discipline:

- write the rule
- validate the decomposition family
- only then implement runtime

If future work falls back to ad-hoc debug-driven trimming, it will likely undo
the progress already made.

---

## Current Recommended Next Step

The next step should be:

1. define the remote-pollution scenario contract
2. formalize how remote contributors are detected without relying only on buggy
   final output
3. decide whether remote pollution belongs to:
   - global overlap ownership
   - branch-order priority
   - or explicit self-overlap decomposition
4. keep local-gap repair restricted to `promotable-local-gap`
5. do not widen local-gap promotion until remote pollution has its own path

This should happen in dash runtime only, without touching:

- selection layers
- hover layers
- path editing layers
- unrelated render overlays

---

## Working Rule Going Forward

The project should continue using these rules:

- no workaround
- no sample-specific logic
- no point-specific logic
- no postprocess patch just to hide visible defects
- only scenario-level, geometry-derived rules

That standard must remain active for all future gap-local and remote-overlap work.
