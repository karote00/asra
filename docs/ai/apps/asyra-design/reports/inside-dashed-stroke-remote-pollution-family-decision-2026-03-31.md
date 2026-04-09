# Inside Dashed Stroke Remote-Pollution Family Decision

**Date:** 2026-03-31  
**Scope:** choose the next algorithm family for `inside + dashed`
remote-pollution cases

## Purpose

Use the current branch-level artifact evidence to decide whether the next
runtime step should be:

1. `global overlap ownership`
2. `explicit self-overlap decomposition`
3. `authoritative branch projection`
4. or no immediate runtime repair at all

This decision is based on current hard gates and artifact outputs, not on
ad-hoc visual preference.

---

## Current Evidence

From:

- [/Users/asa/Desktop/workspace/asra/packages/preset/test-results/full-path-dash-gap-artifacts/reported-sample-dash-gap-metrics.json](/Users/asa/Desktop/workspace/asra/packages/preset/test-results/full-path-dash-gap-artifacts/reported-sample-dash-gap-metrics.json)
- [/Users/asa/Desktop/workspace/asra/packages/preset/test-results/full-path-dash-gap-artifacts/reported-sample-worst-gap-branch-face-regions.svg](/Users/asa/Desktop/workspace/asra/packages/preset/test-results/full-path-dash-gap-artifacts/reported-sample-worst-gap-branch-face-regions.svg)

Key facts:

- the reported-sample global worst gap is classified as `remote-pollution`
- the neighboring pair alone is not the dominant problem:
  - `neighborPairOnlyClearRatio = 0.5333`
  - `neighborPairNoCapsOnlyClearRatio = 1`
- the remote contributor alone already materially intrudes:
  - `dashIndex = 28`
  - `intrusionRatio = 0.4833`
  - `bodyOnlyClearRatio = 0.8333`
  - `capOnlyClearRatio = 0.6833`
- the remote contributor is already present at:
  - `raw`
  - `wedge`
  - `ownership`
- the remote contributor has:
  - `rawPolygonCount = 1`
  - `wedgePolygonCount = 1`
  - `ownershipPolygonCount = 1`
  - `ownershipOwners = []`

This means:

- remote pollution is not caused by local gap-local promotion
- remote pollution is not caused by a bad ownership trim on the neighboring pair
- remote pollution is not introduced late by cap integration alone

It is already a valid, single-face, non-neighbor dash branch entering the same
2D window.

---

## What This Implies Geometrically

The current active remote-pollution case is not a “bad local gap”.

It is:

- one authored neighboring gap window
- plus one separate authored dash branch from elsewhere on the same path
- both legitimately occupying the same 2D region

So the conflict is no longer:

- neighbor terminal A vs neighbor terminal B

It is:

- local neighboring ownership
- vs global self-overlap from another branch

That is a different problem family.

---

## Family Evaluation

## 1. Global Overlap Ownership

Idea:

- choose a priority rule in overlap windows
- one branch wins visibility

Pros:

- implementation could be relatively cheap

Cons:

- current evidence does not provide a geometry-derived reason why dash `28`
  should lose to gap `5`
- any fixed priority here risks becoming policy-by-accident
- this is the most likely family to drift toward workaround behavior

Decision:

- **not recommended as the next step**

## 2. Explicit Self-Overlap Decomposition

Idea:

- treat the overlap window as its own scenario family
- explicitly decompose:
  - neighboring retained region
  - remote branch retained region
  - overlap exclusion or shared region

Pros:

- geometry-honest
- consistent with the successful split-pair and seam work
- does not require pretending remote overlap is a local cap bug

Cons:

- highest implementation cost
- still requires a product rule for how shared overlap should be treated

Decision:

- **best geometry-first candidate if product requires a runtime fix**

## 3. Authoritative Branch Projection Rule

Idea:

- choose one branch as authoritative in the overlap window using a
  geometry-derived rule

Pros:

- simpler than full decomposition

Cons:

- current evidence does not yet expose a stable geometry-derived tie-breaker
- likely to collapse back into arbitrary branch priority

Decision:

- **not recommended yet**

## 4. No Immediate Runtime Repair

Idea:

- keep remote pollution classified and excluded from local-gap correctness
  repair
- do not yet add a runtime ownership policy for self-overlap

Pros:

- matches current evidence
- avoids forcing a fake local solution onto a global overlap problem
- preserves the current no-workaround standard

Cons:

- the visual issue remains for self-overlapping paths

Decision:

- **recommended current stance**

---

## Final Decision

The current evidence does **not** justify an immediate runtime repair for
remote pollution.

Recommended position now:

1. keep `remote-pollution` as a separately classified scenario
2. exclude it from local-gap repair and local-gap correctness claims
3. do not introduce a global branch-priority rule yet
4. only start runtime work if product explicitly decides that self-overlap
   windows need deterministic branch ownership

If that product-level rule is later required, the recommended family is:

- **explicit self-overlap decomposition**

not:

- generic global priority
- local cap trimming
- local gap promotion widening

---

## Practical Next Step

The next runtime effort should **not** target remote pollution yet.

The correct immediate next step is:

1. keep remote-pollution diagnostics active
2. keep local-gap promotion narrow
3. move to the next still-actionable correctness gap in `inside + dashed`
4. only reopen remote pollution if a product rule is added for self-overlap
   windows
