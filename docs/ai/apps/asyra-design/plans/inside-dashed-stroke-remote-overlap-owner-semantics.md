# Inside Dashed Stroke Remote Overlap Owner Semantics

**Status:** active rule contract  
**Scope:** semantic meaning of the shared overlap region in active
`remote-pollution` cases  
**Purpose:** define what is currently allowed and forbidden before any runtime
ownership implementation

## Current State

The current state of the shared overlap region is:

- `owner-unresolved`

This is intentional.

The overlap region is already proven to be geometrically real, but its runtime
owner semantics are not yet selected.

---

## What Is Already Known

Current artifact work establishes:

1. explicit self-overlap decomposition is artifact-ready
2. excluding overlap regresses contributor-union fidelity
3. neighboring-priority and remote-priority remain geometrically
   indistinguishable on current artifact metrics

Therefore the next unresolved question is not:

- whether the overlap exists

It is:

- what the overlap is allowed to mean

---

## Allowed Directions

The current line allows only these next-step directions:

### A. Define Explicit Overlap Owner Semantics

The project may define a dedicated semantic contract for the shared overlap
region.

This is the current preferred route.

### B. Defer Branch Priority Until It Is Geometry-Derived

The project may postpone any neighboring-vs-remote priority decision until a
future rule proves why one branch should win.

This is allowed because current geometry alone does not yet justify that choice.

---

## Forbidden Directions

The following are currently forbidden.

### A. Delete Overlap Without An Owner Rule

The overlap region may not be silently removed.

Reason:

- excluding overlap already regresses contributor-union fidelity

### B. Pick Neighboring Priority From Current Geometry Alone

This is forbidden because current artifact geometry does not uniquely justify
that branch priority.

### C. Pick Remote Priority From Current Geometry Alone

This is forbidden for the same reason.

Current geometry comparison does not produce a unique winner between the two
priority rules.

---

## Working Rule

Until a stronger ownership rule exists:

- the overlap region must be treated as semantically unresolved
- runtime promotion must remain rejected
- the next rule work should solve overlap-owner semantics before branch-priority
  selection

This is the current owner-semantics contract for the active remote line.

---

## First Candidate

The first explicit overlap-owner candidate is:

- `retained-shared-region`

Current meaning:

- keep the shared overlap region present in artifact decomposition
- treat that shared region as intentionally retained rather than silently
  deleted
- do not yet assign it to neighboring or remote ownership

Current status:

- `artifact-compatible`
- `not runtime-eligible`

Why it is artifact-compatible:

- it preserves shared overlap geometry
- it preserves contributor-union fidelity better than excluding overlap

Why it is not runtime-eligible yet:

- the shared-region owner is still unresolved
- runtime promotion is still rejected by the current ownership contract

So the current line is:

- keep `retained-shared-region` as the leading overlap-owner candidate
- do not promote it into runtime ownership until explicit owner semantics are
  defined

Current selection summary:

- `selectedCandidate = retained-shared-region`

Why this candidate is currently selected:

- it is artifact-compatible
- it best preserves contributor-union fidelity among current overlap-owner
  directions
- the current rule selection already prefers overlap-owner-first
- priority policies remain underdetermined by current geometry

## Admissibility Contract

`retained-shared-region` is currently admissible only as an artifact candidate.

Artifact admissibility currently requires all of the following:

- shared overlap geometry is preserved
- contributor-union fidelity is preserved
- current rule selection still prefers this candidate

Runtime promotion must still be rejected when any of the following remain true:

- the shared-region owner is still unresolved
- explicit owner semantics are still required
- the current runtime contract still rejects promotion

So the current contract is intentionally split:

- `artifact-admissible`
- `runtime-rejected`

## Owner Obligations

Before `retained-shared-region` can become a runtime owner rule, the following
owner-side obligations must remain explicit:

- define shared-region owner semantics
- preserve shared overlap geometry
- preserve contributor-union fidelity
- avoid geometry-only priority assignment
- keep neighboring-exclusive and remote-exclusive regions intact

Current state:

- only `define shared-region owner semantics` is still unsatisfied
- the other obligations are already guarded at the artifact level

This means the blocker is now narrow:

- not missing geometry
- not missing decomposition
- missing explicit owner semantics

## Runtime Readiness

Current readiness state:

- `runtimeReady = false`

Current ready signals:

- shared overlap geometry is preserved
- contributor-union fidelity is preserved
- geometry-only priority assignment remains forbidden
- neighboring-exclusive and remote-exclusive regions remain intact
- artifact admissibility is established

Current blockers:

- shared-region owner is still unresolved
- explicit owner semantics are still required
- current runtime contract still rejects promotion

So the line is now fully narrowed to one missing class of rule:

- explicit owner semantics for the retained shared region

## First Explicit Rule Shape

The first explicit owner-semantics proposal is now:

- `retained-shared-region-v1`

This proposal is intentionally:

- `proposed-not-adopted`

Its semantic shape is:

- neighboring-exclusive region stays neighboring-owned
- remote-exclusive region stays remote-owned
- shared overlap stays a shared non-exclusive retained region

The proposal explicitly forbids these runtime projections:

- collapse overlap into neighboring priority
- collapse overlap into remote priority
- delete overlap during runtime projection

So this is now the current rule-level picture:

- we no longer only know that owner semantics are missing
- we now know the first acceptable shape of that owner semantics
- adoption still remains blocked until the current runtime blockers are cleared

## Adoption Contract

`retained-shared-region-v1` is still:

- `not adoptable`

The adoption contract now requires all of the following guarantees:

- explicit shared-region owner semantics
- deterministic shared-region runtime projection
- no implicit priority fallback
- preserved three-region partition
- preserved contributor union at runtime

Current state:

- `no implicit priority fallback` is already guarded by the proposal
- `preserved three-region partition` is already guarded by artifact decomposition
- `preserved contributor union at runtime` is provisionally supported by the artifact contract
- `explicit shared-region owner semantics` is still missing
- `deterministic shared-region runtime projection` now has a proposal, but it is
  not yet adopted

So the adoption blockers are now very narrow:

- projection rule is proposed but not adopted
- binding rule is proposed but not adopted
- owner class is proposed but not adopted
- runtime surface consumer still defers owner projection

At this point, the runtime surface itself is already declared for conditional
consumption.

That is the remaining gap between the current proposal and any future runtime adoption.

## Owner Projection Preconditions

The first owner-projection precondition input is now treated as:

- `retained-shared-region-projection-input-v1`

Its current state is:

- `projection-ready-but-adoption-blocked`

Current ready conditions:

- runtime surface is declared
- local gap window precondition is declared
- remote contributor precondition is declared
- shared owner-class id is declared
- shared ownership kind is declared

Current blockers:

- projection rule is proposed but not adopted
- binding rule is proposed but not adopted
- owner class is proposed but not adopted

This means the active remote case is now ready to enter owner projection as an
input contract, but still cannot run owner projection semantics in production.

## Owner Projection Payload

The first owner-projection payload is now treated as:

- `retained-shared-region-projection-payload-v1`

Its current state is:

- `payload-ready-for-application`

Its declared payload shape is:

- neighboring-exclusive -> shared-overlap -> remote-exclusive
- preserve decomposition boundaries without priority collapse

This means the active remote case can now produce a projection payload
contract, and production can hand that payload to the explicit
self-overlap-decomposition runtime path.

## Owner Projection Semantics Consumer

The first owner-projection semantics consumer is now treated as:

- `retained-shared-region-projection-semantics-v1`

Its current state is:

- `consumed-and-applied`

Current semantics state:

- the projection payload is consumed
- projection semantics apply explicit self-overlap decomposition
- the active remote case now emits projection application output

This means the active remote case has now entered a production-facing projection
semantics stage, and the stage now applies retained-shared-region projection in
production for eligible remote cases.

## Owner Projection Output

The first owner-projection output contract is now treated as:

- `retained-shared-region-projection-output-v1`

Its current state is:

- `output-applied`

Declared output shape:

- neighboring-exclusive + shared-overlap + remote-exclusive

This means the active remote case now has a declared projection output
contract, and production now applies that output through the explicit
self-overlap-decomposition runtime path.

## Deterministic Projection Rule

The first deterministic projection rule is now:

- `retained-shared-region-projection-v1`

This rule is intentionally:

- `proposed-not-adopted`

Its projection shape is:

- neighboring-exclusive projects as neighboring-exclusive owned
- shared overlap projects as a shared non-exclusive region
- remote-exclusive projects as remote-exclusive owned
- projection order is fixed as:
  `neighboring-exclusive -> shared-overlap -> remote-exclusive`
- decomposition boundaries must be preserved without priority collapse

The proposal explicitly forbids:

- merging shared overlap into neighboring-exclusive
- merging shared overlap into remote-exclusive
- deleting shared overlap during projection

Current blockers:

- projection rule is proposed but not adopted
- binding rule is proposed but not adopted

## Shared Region Binding Rule

The first shared-region owner binding rule is now:

- `retained-shared-region-binding-v1`

This rule is intentionally:

- `proposed-not-adopted`

Its binding shape is:

- neighboring-exclusive binds to `neighboring-exclusive-owner`
- shared overlap binds to `shared-overlap-owner-class`
- remote-exclusive binds to `remote-exclusive-owner`

The proposal explicitly forbids:

- binding shared overlap to neighboring-exclusive-owner
- binding shared overlap to remote-exclusive-owner
- leaving shared overlap owner implicit

Current blockers:

- binding rule is proposed but not adopted
- owner class is proposed but not adopted

## Shared Overlap Owner Class

The first shared overlap owner class is now:

- `shared-overlap-owner-class-v1`

This class is intentionally:

- `proposed-not-adopted`

Its semantic role is:

- `shared-non-exclusive-owner-class`

Allowed responsibilities:

- retain shared overlap as an explicit shared region
- preserve non-exclusive shared membership
- require explicit owner-class declaration

Forbidden responsibilities:

- collapse shared region into neighboring-exclusive owner
- collapse shared region into remote-exclusive owner
- allow implicit shared owner resolution

Current blockers:

- owner class is proposed but not adopted

## Owner Class Runtime Surface

The first owner-class runtime surface is now:

- `shared-overlap-owner-runtime-surface-v1`

This surface is intentionally:

- `declared-conditional-consumer`

Its shape is:

- `ownerClassId`
- `ownershipKind`
- `gapIndex`
- `trailingIndex`
- `remoteContributorCount`
- `localGapWindowPresent`

Forbidden fields:

- `priorityWinner`
- `exclusiveOwnerIndex`

Current blockers:

- projection rule is proposed but not adopted
- binding rule is proposed but not adopted
- owner class is proposed but not adopted
- runtime surface consumer still defers owner projection

## Runtime Adoption Boundary

Production now declares a runtime adoption boundary for active
`remote-pollution` gaps.

Current boundary meaning:

- active remote-pollution gaps are surfaced as runtime-adoption candidates
- all current candidates remain blocked
- runtime ownership still does not change

Current runtime blockers are:

- projection rule is proposed but not adopted
- binding rule is proposed but not adopted
- owner class is proposed but not adopted
- runtime surface consumer still defers owner projection

So the production line has now started the runtime path in a narrow way:

- runtime can see the boundary
- runtime declares the owner-class surface
- runtime consumes the declared surface through a conditional consumer
- current active remote cases are deferred before owner projection
- runtime still cannot cross the boundary
