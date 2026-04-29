# Failure Triage And Self-Review Loop

## Role

This file defines how stroke failures and documentation inconsistencies must be
classified and corrected.

The purpose is to force the stroke-engine work back through one repeatable
decision loop until no unresolved inconsistency remains.

## Failure Classes

### 1. Implementation Bug

Definition:

- the family is already documented as supported
- the helper contract says exact geometry should exist
- runtime output does not match

Required action:

- inspect the earliest stage that produces the wrong result
- fix that stage, not a later cosmetic symptom

### 2. Missing Coverage

Definition:

- the scenario matters, but the active docs do not cover it clearly

Required action:

- update the relevant final-package file first
- then add tests
- then implement

### 3. Product-Semantics Gap

Definition:

- runtime can be made deterministic, but intended product behavior is not yet
  approved

Required action:

- classify the family as `research-gated`, `blocked`, or `blocked-with-diagnostics`
- do not silently upgrade it in code

### 4. Reference-Research Gap

Definition:

- Figma does not document the behavior clearly enough
- captured Figma fixtures are missing or inconsistent
- no peer-product, large-runtime, open standard, or geometry reference has been
  recorded for the proposed behavior

Required action:

- keep the family `research-gated` or `blocked`
- research official Figma docs first
- if Figma docs are missing, capture Figma-visible behavior before looking
  elsewhere
- if Figma still cannot answer the question, research other established
  design-software or design-tool references before looking at general runtime
  behavior
- if design-tool references cannot answer the question, research other
  large-company graphics/runtime references before using algorithm-only
  references
- use robust geometry algorithms to define construction mechanics, not to invent
  product-visible semantics
- write the chosen deterministic rule into the active package
- add tests and decision-history notes before support can be marked supported

### 5. Performance-Contract Failure

Definition:

- the geometry is correct, but the workload breaks the `120fps` target or the
  `60fps` floor

Required action:

- inspect dirty-key over-invalidation
- inspect topology reuse
- inspect interval reuse
- inspect geometry-model reuse
- inspect renderer CPU rebuild behavior

### 6. Documentation-Governance Failure

Definition:

- active docs disagree
- a deleted legacy stroke planning file still exists outside
  `stroke-engine-final/`
- reviewers can no longer tell which authority wins

Required action:

- repair source-of-truth routing before claiming the implementation is stable
- delete the legacy stroke planning file unless it is app decision history or
  the active final analysis report

## Mandatory Self-Review Loop

Run this loop whenever a stroke document or stroke implementation changes:

1. perform cross-doc consistency review
2. verify architecture, active support scope, function contracts, and tests
   still agree
3. verify every changed stage still lists:
   - input/output
   - boundary conditions
   - error cases
   - allowed recoverys
   - forbidden callers/usages
4. verify every changed phase still lists:
   - expected failure classes
   - decision criteria
   - wrong-decision recovery path
5. verify support or blocked state for:
   - open path
   - compound closed paths with holes
   - self-intersection
   - multi-network
6. verify numeric robustness policy still matches arrangement and test oracles
7. verify representation rules still distinguish semantic truth from emission
   batching
8. verify parameter-impact rules still match dirty-key and rerun-stage behavior
9. verify performance text still matches dirty-key and cache contracts
10. verify tests still include concrete input, expected output, and pass rule
11. verify product tests and diagnostics do not infer owner, topology, stroke
    family, support state, or blocked state from `geometryId`; those facts
    must come from typed metadata
12. verify unresolved behavior has a Figma reference, Figma fixture, design-tool
   reference, large-company runtime reference, algorithm reference, or explicit
   `research-gated` status
13. verify miter-limit exceedance is treated as bevel geometry rather than a
   blocked unsupported state
14. verify no legacy stroke plan, support matrix, scenario matrix, support
   ledger, manual QA checklist, handoff, or failure-triage file exists outside
   `stroke-engine-final/`
15. if any mismatch is found, return to the source-of-truth docs first and fix
   them before calling the work complete

## Wrong-Decision Recovery Rule

If a decision later proves wrong:

1. identify the stage or semantic family affected
2. update the active document in this folder first
3. update the tests and benchmarks second
4. only then update implementation
5. rerun the same self-review loop until no inconsistency remains

## Completion Rule

The stroke final package is not complete if any of these are true:

- architecture and tests disagree
- helper contracts omit high-impact constraints
- phase plan omits failure recovery
- performance rules omit dirty-key consequences
- support states for hard topology families are ambiguous
- deleted legacy stroke planning files still exist as separate documents
- reviewers would still need to invent decisions
