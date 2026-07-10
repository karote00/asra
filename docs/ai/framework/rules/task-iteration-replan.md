# Rule: Task Iteration Replan

## Scope

This rule applies to every AI-assisted task across framework packages, preset
defaults, reference apps, inspectors, tests, visual review, documentation, and
future apps.

## Core Rule

When a task has multiple failed implementation iterations, or when it exceeds a
user-provided time limit, the agent must stop local patching and perform a task
iteration before continuing.

A task iteration means:

1. Re-audit the active contracts, specs, inspector flow, tests, and current
   implementation state.
2. Identify the first unresolved owner boundary or evidence gap.
3. Write a revised plan that explains which owner stage will be handled next,
   which files are in scope, and which gates will prove the result.
4. Update or reference the closure packet for the affected review segment,
   including contract status, family dataflow status, runtime status, formal
   gates, reopen conditions, and remaining scope.
5. Self-review the revised plan against the review checklist, closure packet,
   and latest evidence.
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
- Re-check implementation ownership before changing a downstream stage.
- If a user has set a time limit, count the limit against the current plan; when
  it is exceeded, perform a task iteration before continuing.
- After writing the revised plan, review it yourself for missing contracts,
  ambiguous owner boundaries, unbounded files, weak gates, downstream patching,
  or stale assumptions. Revise and review again until no concrete issue remains.
- If the affected work is inspector-backed, apply
  `inspector-closure-readiness.md`: do not resume implementation until the
  relevant closure packet has explicit gate evidence, reopen conditions, and
  runtime scope.

## Forbidden Patterns

- Repeatedly patching one local helper after multiple focused failures without
  re-auditing the owner boundary.
- Treating the original plan as fixed after evidence shows it is incomplete.
- Continuing broad gates when a focused test repeatedly fails for the same
  owner-stage reason.
- Replanning only in conversation while leaving the implementation direction
  unchanged.
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
- [ ] downstream fixes, fallback output, and patch geometry remain forbidden
- [ ] the old failed plan is replaced by the revised plan
- [ ] the revised plan has been self-reviewed, updated for every concrete issue
      found, and reviewed again until no concrete issue remains
- [ ] for inspector-backed work, the affected closure packet is explicit about
      contract status, family dataflow status, runtime status, formal gates,
      reopen conditions, and remaining scope
