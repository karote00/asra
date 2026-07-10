# Inspector Step Execution Rule

This rule applies to every task that touches an active plan, inspector-backed
workflow, stroke/vector product flow, render pipeline, or any implementation
whose correctness is governed by an inspector flow.

The purpose is to make spec-driven implementation enforceable. Agents must not
start from intuition, performance pressure, or local code shape when an inspector
flow exists.

For readiness and closure, this rule must be combined with
`inspector-closure-readiness.md`. Implementation edits remain one owner step at a
time, but the decision to start or advance that step must use the closure packet
and review family that contains the step.

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
- Limitations.
- Allowed contributors.
- Forbidden contributors.
- Required evidence.
- Failure reopening rule.
- Implementation files from the inspector allowlist.
- Focused formal tests and gates.
- Stop conditions for the segment.

The card is the implementation contract for that segment. If the card cannot be
completed because the spec or inspector flow is missing, vague, or conflicting,
stop and repair the contract before implementation.

## Owner Boundary

Each stage may consume only the inputs declared by its inspector step or route.
Passing large upstream option bags downstream is not a substitute for an owner
boundary. Downstream helpers must consume completed artifacts, artifact ids,
stage signatures, or cache handles owned by their step, not raw data that lets
them rederive upstream semantics.

If a required input is absent from the inspector contract, do not use it by
guessing. Stop and report the missing contract.

## Readiness Vs Implementation Ownership

An active implementation segment may edit only one owner step or route. However,
the readiness check for that segment must cover the whole review family and any
cross-family handoffs that feed the active step.

Do not mark a step implementation-ready because its local step contract is
complete if the family dataflow, downstream handoff, artifact lifecycle, or
closure packet is still pending or contradictory.

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

Stage cache keys are stage-owned. A cache key may include only the dimensions
that the product spec assigns to that stage. Do not add unrelated parameters to a
cache key to make a test pass or hide stale output.

Renderer caches, render-entry caches, descriptor caches, geometry caches, and
diagnostic caches must stay channel-separated. Diagnostics, helper geometry,
debug geometry, hit-test evidence, and export evidence must not become visible
render input unless the spec explicitly defines that path as visible product.

## Bounded Review Checklist

Before advancing to another step, verify:

- The change stayed within one owner step or route.
- The changed files are in the inspector implementation allowlist, or the work
  stopped for a boundary update decision.
- The implementation consumes only allowed inputs.
- The containing review family is implementation-ready, or the work is repairing
  the family/closure contract before implementation.
- The implementation produces the required outputs and evidence.
- No forbidden contributor is used.
- No renderer fallback, patch geometry, fixture-specific route, or diagnostic
  repair path was introduced.
- No visible render path consumes diagnostics, helper geometry, debug geometry,
  or evidence-only polygons.
- Cache keys contain only stage-owned dimensions.
- Dirtying and invalidation match the declared stage boundary.
- Focused tests and required gates were run, or the unrun gate is reported with
  a concrete reason.

Any P0/P1/P2 review finding, unresolved spec mismatch, or owner-boundary
violation blocks advancement.

## Stop Conditions

Stop implementation and ask for a decision when any of these occurs:

- The product spec and inspector flow conflict.
- The implementation needs behavior not present in the spec.
- The required file is outside the step implementation allowlist.
- A downstream stage appears to need upstream raw data to make a semantic
  decision.
- A performance shortcut cannot be proven equivalent.
- The same focused repair fails three times.
- The change would require keeping behavior that does not match the current spec.
