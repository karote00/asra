# Rule: Task Iteration Replan

## Scope

This rule applies to every AI-assisted task across framework packages, preset
defaults, reference apps, inspectors, tests, visual review, documentation, and
future apps.

## Core Rule

When a task has multiple failed implementation iterations, or when it exceeds a
user-provided time limit, the agent must stop local patching and perform a task
iteration before continuing.

The iteration remains bounded by `bounded-task-scope-and-closure.md`. Failure
evidence may replace the approach inside the authorized objective, but a task
iteration does not authorize a new repository-wide discovery pass, a new
candidate class, or broader mutation scope.

A task iteration means:

1. Re-audit the active contracts, specs, inspector flow, tests, and current
   implementation state.
2. Identify the first unresolved owner boundary or evidence gap.
3. Write a revised plan that explains which owner step will be handled next,
   which files are in scope, and which gates will prove the result.
4. Map the revised plan to the affected thin product-contract clauses,
   Inspector step/route, executable product cases, and bounded DoD gates.
5. Self-review the revised plan against those authorities and the latest formal
   test evidence.
6. Continue only after the revised plan replaces the stale local patching plan
   and the self-review can no longer identify a concrete plan issue.

This rule applies whether or not an explicit goal tool, checklist, or plan tool
is being used.

## Required Handling

- Treat repeated red tests as evidence that the current plan may be wrong, not
  as a reason to keep adding local fixes.
- Re-check source-of-truth documents before changing implementation when the
  failure suggests a contract gap, owner-boundary gap, or ambiguous expected
  output.
- Re-check the formal tests before editing production code when the failure
  suggests missing or mis-mapped coverage.
- Re-check implementation ownership before changing a downstream step.
- If a user has set a time limit, count the limit against the current plan; when
  it is exceeded, perform a task iteration before continuing.
- After writing the revised plan, review it yourself for missing contracts,
  ambiguous owner boundaries, unbounded files, weak gates, downstream patching,
  or stale assumptions. Revise and review again until no concrete issue remains.
- Limit that review to the failed owner boundary, its direct consumers, the
  evidence that invalidated the prior plan, and the revised fixed gates.
- If the affected work is inspector-backed, apply
  `inspector-contract-readiness.md`: do not resume implementation until the
  active slice has explicit product behavior, public inputs/outputs, owner
  boundaries, executable cases, and DoD gates.

## Forbidden Patterns

- Repeatedly patching one local helper after multiple focused failures without
  re-auditing the owner boundary.
- Treating the original plan as fixed after evidence shows it is incomplete.
- Continuing broad gates when a focused test repeatedly fails for the same
  owner-step reason.
- Replanning only in conversation while leaving the implementation direction
  unchanged.
- Using task iteration to reopen previously classified candidates, switch to an
  unrelated search heuristic, or start a broader cleanup task.
- Starting the next implementation iteration after a task replan while the
  revised plan still has an identified flaw, missing gate, or unresolved
  ownership question.

## Review Checklist

Before continuing after a task iteration, verify:

- [ ] the current source-of-truth contract has been reread or explicitly
      confirmed unchanged
- [ ] the first unresolved owner boundary is named
- [ ] the test that should fail or pass next is named
- [ ] the next implementation files are bounded
- [ ] the revised plan remains inside the authorized mutation scope and fixes
      the discovery methods for the next iteration
- [ ] downstream fixes, fallback output, and patch geometry remain forbidden
- [ ] the old failed plan is replaced by the revised plan
- [ ] the revised plan has been self-reviewed, updated for every concrete issue
      found, and reviewed again until no concrete issue remains
- [ ] for inspector-backed work, the active product clauses, Inspector
      step/route, executable cases, and DoD gates agree
