# Inspector Step Execution Rule

Subject to `bounded-task-scope-and-closure.md`, this rule applies when a task
changes or proves an active plan or Inspector step's governed semantics,
owner, handoff, product cases, or DoD. Merely editing an unrelated internal
detail in a file named by an Inspector does not activate this rule, and the
file must not be added to an Inspector boundary solely to authorize that edit.

The purpose is to make spec-driven implementation enforceable. Agents must not
start from intuition, performance pressure, or local code shape when an inspector
flow exists.

For readiness, this rule must be combined with
`inspector-contract-readiness.md`. Implementation edits remain one owner step at
a time, and the decision to start or advance that step must use the current thin
product contract, matching Inspector step and route, formal product cases, and
bounded definition of done.

## Mandatory Execution Order

1. Work on exactly one inspector owner step at a time.
2. Read the product spec clauses and inspector step/route contract before
   proposing or editing code.
3. Produce a Step Execution Card before changing tests, implementation, or docs.
4. Add or strengthen formal tests first for bug fixes, spec mismatches, or
   missing enforcement.
5. Prove the current implementation fails the new or strengthened test when the
   change is a bug fix.
6. Modify only the owner files allowed by the inspector step.
7. Run the focused gates for the step.
8. Run a bounded review checklist before advancing to another step.

Do not batch multiple owner steps into one implementation segment. If the next
required edit belongs to another owner step, stop the segment and write a new
Step Execution Card for that step.

## Step Execution Card

Every implementation segment must begin with a short card containing:

- Owner step or route id.
- Product spec source lines or section names.
- Inspector source lines or step fields.
- Allowed inputs.
- Required outputs.
- Conditions and bypass conditions.
- Allowed contributors.
- Forbidden contributors.
- Implementation boundary.
- Specification references and failure owner.
- Affected product cases and definition-of-done gates.
- Implementation files from the inspector allowlist.
- Focused formal tests and gates.
- Stop conditions for the segment.

The card is the implementation contract for that segment. If the card cannot be
completed because the spec or inspector flow is missing, vague, or conflicting,
stop and repair the contract before implementation.

## Owner Boundary

Each step may consume only the inputs declared by its inspector step or route.
Passing large upstream option bags downstream is not a substitute for an owner
boundary. Downstream helpers must consume completed artifacts, artifact ids,
step signatures, or cache handles owned by their step, not raw data that lets
them rederive upstream semantics.

If a required input is absent from the inspector contract, do not use it by
guessing. Stop and report the missing contract.

## Readiness Vs Implementation Ownership

An active implementation segment may edit only one owner step or route. Its
readiness check must still include every upstream input and downstream consumer
named by that step, plus the product cases and DoD clauses affected by the
change.

Do not advance when the local step looks complete but its public input/output,
route, artifact consumer, forbidden contributor, product case, or failure owner
is missing or contradictory.

## Test-First Requirement

For bug fixes and spec mismatches, formal tests or oracles must be created or
strengthened before production implementation. The test must assert the product
contract, not the patch shape.

Tests must fail on the current behavior unless the task is purely preventive
coverage for an already-correct implementation. If a test cannot be made to fail
for a reported bug, stop and explain the evidence gap.

## Performance And Cache Work

Performance is never a semantic correctness reason. A faster path is allowed only
when it is proven equivalent to the product spec and inspector contract.

Cache is an evidence-driven optional optimization, not a default architectural
requirement. Introduce a step-owned retained candidate only after profiling
identifies a material cost. Before implementation, its bounded optimization
plan and equivalence test must name the retained value, exact key, invalidation,
miss path, and equivalence oracle. `cacheDimensions: []` means the step owns no
such candidate.

When profiling justifies a cache, the Inspector identifies its owning step and
dimensions. The implementation plan and equivalence test may record internal
key, invalidation, and miss-path details without promoting them into product
semantics. Do not add a cache to make a test pass or hide stale output.

## Bounded Review Checklist

Before advancing to another step, verify:

- The change stayed within one owner step or route.
- The changed files are in the inspector implementation allowlist, or the work
  stopped for a boundary update decision.
- The implementation consumes only allowed inputs.
- The affected product behavior, cases, and DoD gates are explicit.
- The implementation produces the declared outputs.
- No forbidden contributor is used.
- No renderer fallback, patch geometry, fixture-specific route, or diagnostic
  repair path was introduced.
- No visible render path consumes diagnostics, helper geometry, debug geometry,
  or evidence-only polygons.
- Any cache is profiling-justified, step-owned, and covered by an exact
  equivalence test; an empty `cacheDimensions` remains cache-free.
- Focused tests and required gates were run, or the unrun gate is reported with
  a concrete reason.

Any P0/P1/P2 review finding, unresolved spec mismatch, or owner-boundary
violation blocks advancement.

## Stop Conditions

Stop implementation and ask for a decision when any of these occurs:

- The product spec and inspector flow conflict.
- The implementation needs behavior not present in the spec.
- The required file is outside the step implementation allowlist.
- A downstream step appears to need upstream raw data to make a semantic
  decision.
- A performance shortcut cannot be proven equivalent.
- The same focused repair fails three times.
- The change would require keeping behavior that does not match the current spec.
