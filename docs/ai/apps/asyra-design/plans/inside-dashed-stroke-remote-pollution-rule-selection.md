# Inside Dashed Stroke Remote-Pollution Rule Selection

**Status:** active rule-selection spec  
**Scope:** choosing the next rule family for the active remote-pollution line  
**Purpose:** decide what to solve first before any runtime ownership work

## Current Decision

The current selected route is:

- `overlap-owner-first`

This is the next rule problem to solve.

It is selected before any geometry-derived branch-priority rule.

---

## Why This Route Wins

Current artifact contracts already establish two things.

### 1. Excluding overlap is worse than retaining overlap

The current explicit self-overlap decomposition family shows:

- retaining overlap stays aligned with the source contributor union
- excluding overlap regresses contributor-union fidelity

So the overlap region cannot be treated as disposable noise.

### 2. Priority policies are not selectable from current geometry

The current active remote case also shows:

- `neighboring-priority` is artifact-viable
- `remote-priority` is artifact-viable
- both remain geometrically indistinguishable on current artifact metrics

So current geometry comparison does not justify choosing one branch-priority
rule over the other.

That means the project should not spend its next step trying to pick a
priority-based owner from the current data.

---

## What “Overlap Owner First” Means

The next rule question is:

- what is the semantic meaning of the shared overlap region

This must be answered before any runtime ownership implementation.

The overlap region could eventually be treated as one of:

1. retained shared region
2. explicitly excluded region
3. region assigned to one branch by a later validated policy

The current line does **not** yet choose among those outcomes.

It only says:

- the overlap region is real
- it cannot be silently discarded
- it cannot yet be uniquely assigned by current geometry-derived evidence

---

## Why Priority Rule First Is Not Selected

`priority-rule-first` is not the current route because:

- the current active remote case does not produce a unique winner between
  `neighboring-priority` and `remote-priority`
- a priority rule chosen now would be under-justified
- under-justified branch priority would violate the current no-workaround
  standard

So priority-based ownership remains a later route, not the current next step.

---

## Immediate Consequence

Until an overlap-owner rule is written:

- Family B may remain artifact-ready
- remote-pollution remains diagnostic-only in runtime
- runtime promotion must continue to be rejected

---

## Exit Criteria For This Rule-Selection Step

This step is complete only when a new spec answers:

- what the shared overlap region means
- which outcomes are allowed for it
- which outcomes are explicitly forbidden
- why that reading is compatible with current gate matrix rules

Only after that should any runtime ownership prototype be considered.
