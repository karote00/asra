# Flow Inspector Control Plane Contract Verification and CI Plan

## Status and Objective

Deferred implementation candidate, revised on 2026-09-07. Static Workspace
`v0.2.0` is complete; activation now depends on the decisions and readiness
below, not on unfinished static work. This revision authorizes no runtime or
CI changes by itself. The existing filename is retained for incoming links.

Prove that a concrete implementation Plan can be checked before work, verified
against real behavior, and retained as a mandatory regression contract. Deliver
a usable step board with test and CI actions after the core proof. The
[roadmap](flow-inspector-workflow-control-plane-roadmap.md) owns product
direction, lifecycle semantics, risk boundaries, and effort assumptions.

## Entry Criteria and Bounded Scope

- Retain the completed static workspace, schema version 2, stable target/step
  identities, and standalone compatibility.
- Select one repository, two related real flows, one shared implementation
  owner, one test runner, and one CI provider. Identify actual behavioral tests
  separately from Inspector structure or prose checks.
- Write the thin Control Plane product specification and exact architecture
  Inspector, including positive, negative, empty, invalid, conditional,
  provenance, and permission cases. Confirm owner boundaries before code.
- Decide the proof's persistence, snapshot attribution, expected-case discovery,
  result ordering, minimal action policy, recovery, and required aggregate gate.
- Freeze each implementation owner slice and its formal gates. Existing
  in-scope CI or test-wrapper defects require a failing regression before a
  correction; unrelated repository cleanup is excluded.

The implementation root is `tools/flow-inspector/control-plane/`. Direct
product-owned behavioral adapters and tests belong with their semantic owners;
the bounded activation names those paths explicitly. The UI may reuse the
existing shell through a separately contracted dynamic surface. Do not make
the static viewer own task state or product runtimes depend on the tool.

The slices below sequence delivery work. Activation must map each implementation
segment to one exact Inspector owner; a slice heading is not a multi-owner
implementation allowance.

## Phase 3 - Core Contract Proof

### Slice 1 - Concrete steps and preflight

Represent each selected step's implementation responsibility, inputs, outputs,
owner, consumers, conditions, bypasses, failure owner, and completion evidence.
Reference target authorities instead of copying them into panel configuration.
Separate work dependencies, runtime routes, reuse, and evidence links.

Check missing producers, incompatible handoffs, conflicting responsibilities,
and conditional paths before admitting dependent work. Unresolved predicates
or feasibility assumptions require a bounded proof; they cannot be marked
ready by an AI guess. Readiness permits implementation whose completion tests
are not yet green. It does not permit contradictory or undefined contracts.

### Slice 2 - Actual behavior and negative proofs

Use product-owned adapters to exercise the existing runtime and observe public
boundaries. Prove required outcomes and interactions, including forbidden
effects and failure routes. Existing tests may discharge requirements when
their assertions actually protect the contract. Add missing formal cases
before any bug-fix implementation.

For the selected shared owner, demonstrate a valid baseline, a violation that
breaks a consumer flow, correct owner attribution, and a conforming correction.
Formal negative cases cover omitted required behavior, corrupt handoff,
premature publication, forbidden branching, and incomplete compensation where
applicable. State which cases apply to the chosen flows and justify any
inapplicable case before activation. No mock graph execution may substitute
for the actual product. Preserve the cases for later regression.

### Slice 3 - Minimal action and evidence foundation

Build the common action request, actor/capability check, registered runner,
timeout/cancel/settlement, artifact capture, and audit path needed by this
proof. Initial actions execute selected tests, read results, prepare a diff,
and explicitly accept or reject mapping changes under policy. They do not
admit autonomous source-writing agents or external delivery mutations.

Ingest results with source snapshot, contract and mapping versions, scenario,
configuration, runner environment, execution attempt, actor, and artifact
identity. Validate actual discovery against required cases. Handle duplicates,
late results, interrupted writes, and restart without fabricating completion.
Distinguish work progress, execution state, conformance, and delivery state.

Proof checkpoint: a shared-owner violation must fail a real flow gate and
explain the affected step; a missing result or unauthorized action must also
fail safely. Review adapter effort and execution cost here before widening UI
or integration work.

## Phase 4 - Usable Board and Mandatory CI

### Slice 4 - Versions, mappings, and retained obligations

Retain delivered contract versions while a draft evolves under the same flow
identity. Show scope/output changes and affected consumers. Compare removals
against the accepted baseline so deleting a required step, test, or mapping
cannot silently remove protection. Define retirement separately from deletion.

Implement deterministic candidates for rename, move, content change, split,
merge, deletion, missing selector, and unknown evidence. Candidate acceptance
checks authorization and current version, records before/after values and
reason, and invalidates affected conclusions. Lower confidence or unresolved
identity prevents trusted pass; do not require sophisticated heuristic matching
to close the phase when an explicit unresolved result is correct.

### Slice 5 - All-flow aggregate and shared truth

Extend the Phase 3 result format with CI ingestion here. Wire a required aggregate
for every currently supported flow obligation in the activated repository
scope, including retained completed flows. A trial onboarding only the two
proof flows must label that coverage explicitly; it cannot claim the whole
repository is protected. Broader onboarding is a separately bounded migration.

Compare expected cases, observed discovery, execution, outcomes, and provenance.
Necessary missing, skipped, cancelled, timed-out, zero-match, unresolved, and
failed results prevent acceptance. Check the actual test outcome even when an
outer script masks its failure. Verify the provider's required-check and merge
revision behavior; do not infer enforcement from workflow YAML alone.

Use the accepted base to protect the supported set and gate policy from silent
weakening in a candidate change. Keep runner credentials outside candidate
code. Deduplicate equivalent executions and preserve applicable expensive-gate
guards and checkpoints. Focused local feedback remains available; broad tests
are not continuously driven by watchers. Complete the minimal recovery and
bounded process cleanup before claiming this gate reliable.

### Slice 6 - In-board actions and a reproducible trial

Expose the same state and actions through the API, CLI, and one workspace UI.
Step cards provide test/CI launch, execution progress, artifact and error
inspection, and retry through the established action owner. Results return to
the initiating card. Mapping review is an explicit action through that owner.

Provide manager views of goal, current capability, remaining concrete work,
blockers, and potential versus confirmed downstream impact. A shared read view
or exported verified snapshot identifies its team baseline and observation time.
It does not mix developer dirty-worktree results with delivered state. Full
shared editing and accounts are not required here.

Ship a reproducible local example of success, intentional contract violation,
CI rejection, and correction, with the supported boundary visible. Document
how existing tests connect to the example. No paid service or AI provider is
required to understand and run this core demonstration.

## Definition of Done

- The selected flows contain concrete judgeable implementation steps and
  preflight rejects the declared invalid handoffs and missing prerequisites.
- Real runtime cases prove outcomes and required interactions; intentional
  violations fail the expected gate and identify the canonical owner step.
- One shared-owner change demonstrates cross-flow regression and recovery;
  potential impact is not mislabeled as confirmed failure.
- Missing/zero-match/skipped/partial results cannot pass, even behind a
  successful wrapper. Mandatory CI behavior is verified for the selected
  protected source/integration revision and reported scope.
- Results from different dirty worktrees, changed in-flight source, mismatched
  contract versions, or late old attempts do not overwrite current truth.
- Duplicate ingestion and interruption between state/audit writes are safe;
  restart cannot turn incomplete execution into success.
- Contract or mapping changes invalidate the appropriate evidence. Removal of
  required obligations is visible and subject to accepted-baseline policy.
- Drift cases cover rename, move, content change, split, merge, deletion, and
  unknown observations without automatic formal mapping mutation.
- All linked nodes receive evidence updates; panel switching has no effect on
  truth. UI, CLI, API, and CI produce equivalent explanations.
- Cards can execute tests and CI, inspect failures, and retry within their
  declared permissions. Denied actions produce no unauthorized effects.
- The example can be reproduced by another user and the shared baseline is
  understandable without manually reconstructing ticket history.
- The bounded static compatibility gates remain green. No future agent,
  connector, or commercial capability is required for closure.

## Exclusions and Stop Conditions

Autonomous source-writing agents, token-budget enforcement, bidirectional
ticket/PR mutations, protected delivery actions, full team accounts, hosted
tenancy, and additional provider families belong to later work. The common
action policy, minimal audit, strict CI ingestion, and recovery required above
are not deferred to that work.

Stop the affected slice if a static/prose check substitutes for behavior,
the product is simulated instead of exercised, scope or policy weakens itself,
an ambiguous/absent result can pass, provider status substitutes for required
case outcomes, or the milestone requires mutation outside its accepted owners.
Replan within scope after repeated failed implementation iterations.

## Effort and Next Activation

Use the roadmap's low-confidence ranges: 2-4 engineering person-weeks for the
core proof and another 6-10 for the operational trial under its stated
assumptions. Record actual adapter and test execution costs at the Phase 3
checkpoint. Existing Inspector count is not an estimate of behavioral coverage.

The next plan may begin once this plan's conformance, controlled action,
versioned evidence, and mandatory CI foundation are proven. Agent containment
and ticket synchronization are outputs of that next plan, not its prerequisites.

## References

- [Workflow Control Plane Roadmap](flow-inspector-workflow-control-plane-roadmap.md)
- [Agent Execution and Integrations Plan](flow-inspector-control-plane-actions-and-integrations-plan.md)
- [Static Workspace 0.2.0 Closure Plan](completed/flow-inspector-static-workspace-0.2.0-closure-plan.md)
- [Flow Inspector contract](../FLOW_INSPECTOR.md)
