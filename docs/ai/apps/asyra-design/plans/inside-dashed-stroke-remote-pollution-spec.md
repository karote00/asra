# Inside Dashed Stroke Remote-Pollution Spec

**Status:** active implementation spec  
**Scope:** `inside + dashed` remote non-neighbor overlap into authored gap
windows  
**Purpose:** define the next algorithm-first path after narrow local-gap
promotion, with explicit separation between local neighboring-gap repair and
global self-overlap pollution

## Goal

Define one scenario-level contract for cases where:

- the authored neighboring pair is not the sole owner of the visible 2D gap
  window
- one or more non-neighbor dashes project into the same local 2D space
- the visible gap therefore looks “filled”, but local cap/body repair would be
  the wrong answer

This document intentionally treats remote pollution as a separate geometry
problem, not as a failed version of local gap coexistence.

Related standard:

- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-correctness-standards.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-correctness-standards.md)
- [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-gate-matrix.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-gate-matrix.md)

That document defines the working separation between:

- production correctness standards
- artifact-only viability standards
- diagnostic signals

This spec should be interpreted using that separation.

---

## What This Spec Assumes Is Already Stable

The following are treated as stable enough to build on:

1. authored dash/gap schedule
2. cross-segment dash support
3. exact-cubic vs sampled source selection
4. wedge legality
5. seam-specific decomposition
6. same-corner split-pair decomposition
7. narrow `promotable-local-gap` production promotion

So this spec does **not** redefine the local-gap algorithm.

It starts where the current classifier already says:

- this gap is **not** a true local neighboring-gap bug
- this gap is **remote-pollution**

---

## Current Known Case

The current reported-sample global worst gap is already hard-gated as
`remote-pollution`.

Known facts from the current artifact contract:

- the neighboring pair alone is not the dominant problem
- a non-neighbor remote contributor exists
- the currently known contributor is:
  - `dashIndex = 28`
  - `boundarySourceKind = exact-cubic`
  - `touchedSegmentIndices = [3]`
- that contributor already intrudes at:
  - `body-only`
  - `cap-only`
  - `raw`
  - `wedge`
  - `ownership`

This means remote pollution is not introduced only by late cap integration.

It is already present in the remote dash’s own legitimate emitted geometry.

---

## Core Decision

Remote pollution must not be repaired by local neighboring-gap rules.

Therefore:

1. `local gap repair` and `remote pollution handling` remain separate paths
2. remote pollution must be classified before any local retained subtraction is
   considered
3. remote pollution requires a global or branch-aware ownership strategy
4. no local cap/body trimming rule may be allowed to “fix” remote cases

---

## Scenario Definition

A gap is `remote-pollution` when all of the following are true:

1. an authored neighboring pair exists for that gap
2. a local 2D gap window can be constructed
3. one or more non-neighbor dash faces materially intrude into that same local
   2D window
4. the intrusion remains visible even after excluding the neighboring pair

The last condition matters because schedule adjacency alone is not enough to
prove ownership of a 2D region.

---

## Non-Goals

This spec does **not** define:

- a local cap trimming rule
- a new local gap promotion gate
- a workaround that hides remote overlap by shrinking the neighboring pair
- a raster-only patch

If a proposal depends on any of those, it is the wrong path.

---

## Required Inputs

For one authored gap window, remote-pollution analysis may use:

- the authored neighboring pair
- the local 2D gap window
- all emitted dash faces intersecting that local window
- per-dash stage diagnostics where available:
  - pre-constraint
  - raw
  - wedge
  - ownership
  - final
- segment / branch provenance:
  - touched segment indices
  - source kind
  - scenario family metadata

---

## Classification Contract

Remote-pollution classification must satisfy:

1. it may consult emitted final polygons
2. it must not rely only on emitted final polygons
3. it must also consult per-dash staged geometry where available
4. it must identify the contributing non-neighbor dash ids

Minimum artifact hard gates:

- `classification = remote-pollution`
- `remoteContributorCount > 0`
- at least one explicit non-neighbor contributor id is recorded

Current reported-sample hard gate:

- contributor list contains `dashIndex = 28`

---

## Geometry Meaning

Remote pollution is best understood as:

- a gap that is locally well-defined in schedule space
- but not isolated in screen-space / stroke-space

This can happen when:

- the path self-overlaps
- another branch runs through the same 2D window
- a non-neighbor dash from another branch legitimately occupies that region

That means the problem is not “neighbor terminals coexist badly”.

It is:

- “multiple authored branches legitimately compete for the same 2D region”

---

## Candidate Solution Families

Only the following solution families are worth exploring:

### Family A: Global Overlap Ownership

Define a higher-level ownership rule for self-overlap windows, for example:

- branch-order priority
- longitudinal priority
- scenario priority

Pros:

- matches the fact that multiple branches occupy the same space

Risk:

- can become workaround-like if priority is not geometry-derived

### Family B: Explicit Self-Overlap Decomposition

Treat the overlap window as its own scenario family and explicitly decompose:

- branch A retained region
- branch B retained region
- shared or excluded overlap region

Pros:

- most geometry-honest

Risk:

- higher implementation cost

### Family C: Authoritative Branch Projection Rule

Choose one branch as authoritative inside the overlap window based on a
geometry-derived projection rule.

Pros:

- simpler than full decomposition

Risk:

- must be demonstrably geometry-derived, not sample-specific

---

## Immediate Rejections

The following are explicitly rejected:

- using local neighboring-gap repair on remote-pollution cases
- generic cap trim
- generic whole-dash shrink
- sample-specific branch priority
- point-specific exclusions
- raster patching after final-face emission

---

## Recommended Next Step

The next implementation step should be artifact-first:

1. build a `remote-pollution artifact` view for the reported sample
2. output all contributing branches in one local window
3. compare:
   - neighboring pair only
   - remote contributor only
   - all contributors together
4. decide whether Family A, B, or C is actually viable

Only after that should runtime work begin.

Current interpretation of that step:

- Family A and Family C may still be compared as rejected prototype families
- Family B may become `artifact-ready`
- but `artifact-ready` does **not** mean `runtime-ready`

Runtime work remains blocked until there is an explicit ownership contract for:

- neighboring-exclusive region
- remote-exclusive region
- overlap region

and for how that ownership generalizes beyond the active reported sample.

Current reject reading:

Even if Family B is artifact-ready, runtime promotion must still be rejected
when:

- the family decision remains `diagnostic-only`
- the decomposition still needs an ownership rule for the overlap region
- multiple contributor families remain simultaneously active in the same window

Artifact decomposition quality is necessary, but not sufficient.

---

## Validation Requirements

Any future runtime solution for remote pollution must prove:

1. it does not alter `promotable-local-gap` behavior
2. it does not regress canonical straight-side round-cap pairs
3. it does not regress high-curvature canaries
4. it records or preserves contributor identity for debugging
5. it does not introduce overlap by hiding one bug with another
6. it defines an explicit runtime rule for:
   - neighboring-exclusive region
   - remote-exclusive region
   - shared overlap region
7. it explains why that rule is valid when multiple contributor families remain
   active in the same local window

---

## Working Rule

Until a remote-pollution family is selected:

- local-gap promotion stays narrow
- remote-pollution stays diagnostic-only
- no generic widening of local repair is allowed

Until a runtime ownership rule is chosen, the current accepted reading is:

- Family B may continue to harden as an artifact decomposition contract
- contributor identity must remain preserved for diagnostics
- stage metrics such as `body-only`, `cap-only`, `raw`, `wedge`, and
  `ownership` remain diagnostic signals, not standalone final targets
