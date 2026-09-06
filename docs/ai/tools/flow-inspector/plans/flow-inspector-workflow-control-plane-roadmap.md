# Flow Inspector Workflow Control Plane Roadmap

## Status and Authority

Product direction revised on 2026-09-07 following the owner's risk-management
and open-source objectives. This roadmap owns cross-phase direction and
boundaries. The two phase plans own delivery scope and acceptance milestones.
Updating these plans does not activate implementation or claim that the future
Control Plane is already available.

Static Workspace `v0.2.0` Phase 2 completed on 2026-08-29. Its read-only schema,
standalone HTML compatibility, independent versioning, and optional Framework
release relationship remain unchanged. See the
[completed static plan](completed/flow-inspector-static-workspace-0.2.0-closure-plan.md).

The static workspace remains at `tools/flow-inspector/workspace/`; the dynamic
service belongs at `tools/flow-inspector/control-plane/`. Neither becomes a
Framework or App runtime dependency or enters the Framework Changesets
publication allowlist. Repository extraction and publication remain explicit
future release decisions.

## Product Objective

Materialize a Plan as a flow that humans and AI agents can inspect, act within,
and verify. The primary outcome is controlled development risk: a team can
delegate bounded work while detecting incompatible plans, scope drift,
unproductive execution, and damage to previously delivered capabilities.

The product promise spans the complete lifecycle:

- before implementation, check whether concrete responsibilities and handoffs
  can satisfy the declared goal;
- during implementation, expose progress and constrain actions, changes, and
  resource use to the accepted task;
- before delivery, require evidence that actual behavior conforms to the flow;
- after delivery, retain the contract and continuously protect supported
  capabilities through regression gates; and
- when requirements change, expose affected steps and contracts before
  accepting the new scope.

Managers use the board to understand the goal, available capability, remaining
work, blockers, and downstream impact. Developers and agents use the same step
cards to obtain implementation boundaries, run checks, inspect failures, and
perform supported lifecycle actions. Their completion standard is the same;
their capabilities may differ according to explicit policy.

The intended distribution is open source for individuals and companies to try,
use, and extend. Success is useful risk reduction, understandable guarantees,
and affordable adoption and maintenance. Payment willingness and monetization
are not activation or acceptance gates. Licensing, packaging, and publication
are separate release work, not implied by this planning revision.

## Product and Architecture Boundaries

The materialized Plan is a connected product experience, with distinct owners:

| Concern                                                                  | Authority                                         |
| ------------------------------------------------------------------------ | ------------------------------------------------- |
| Goal, supported behavior, scope, and completion conditions               | Target-owned product specification                |
| Step responsibilities, routes, inputs, outputs, and failure ownership    | Target architecture Inspector                     |
| Whether actual behavior satisfies those contracts                        | Target-owned formal tests and behavioral adapters |
| Task execution, permissions, budgets, evidence, status, and integrations | Tool-owned Control Plane                          |
| Display and machine access                                               | UI, API, and CLI projections of those authorities |

The current [static contract](../FLOW_INSPECTOR.md) remains schema version 2.
Do not add test paths, execution status, permissions, budgets, or run history
to it. The Control Plane references stable target and step identities and
versioned contract sources. The same card may display architecture and work
state without duplicating ownership or making the static viewer executable.

Existing product runtimes perform product behavior. Test-side adapters observe
their public boundaries; the Control Plane does not reimplement the product or
require production packages to import the tool. A workflow without an
architecture Inspector may be represented operationally, but must not claim
architecture or behavioral conformance without the corresponding contract and
proof. Existing legacy Inspectors remain visibly distinct during adoption.

## Flow and Step Model

### Concrete work with a stable goal

A flow has a stable identity, a goal and beneficiary, a responsible owner,
accepted scope, completion conditions, and explicit versions. It can describe
a feature, a system capability, or a delivery workflow. Relevance to its goal
alone does not authorize adding work to the current scope.

Each step card represents a concrete implementation responsibility with a
judgeable outcome. A stage heading containing unrelated tickets is not a
substitute for a step. A card identifies:

- its semantic owner and assigned human or agent;
- inputs, their producers, preconditions, and permitted bypasses;
- behavior to implement and the allowed implementation boundary;
- required outputs, consumers, forbidden behavior, and failure ownership;
- completion conditions and the formal evidence that proves them; and
- available actions, current work, and relevant execution limits.

The granularity is the smallest useful responsibility whose handoff and outcome
can be judged, not every internal function. Tickets may link to a step, but do
not define its product semantics. Views may group steps for readability without
losing their individual implementation contracts.

### Relationships and feasibility

Relationships distinguish implementation prerequisites, runtime handoffs,
shared capabilities, and shared evidence. A runtime loop is not automatically
a work-scheduling dependency cycle. Routes define conditional connectivity;
visual order alone does not determine execution.

Preflight checks detect missing producers, incompatible handoffs, conflicting
owners, unhandled failure or bypass routes, and unsatisfied prerequisites where
these are formally expressible. Concurrent interactions use declared causal
constraints rather than one assumed total event order. Unresolved feasibility,
performance, or external-system assumptions remain visible and require a
bounded experiment or review before dependent work can advance.

An upstream change identifies potentially affected consumers. A potentially
affected flow, a confirmed failing flow, and blocked implementation work are
different conclusions and must explain their evidence. Shared test membership
alone does not prove a runtime dependency.

### Progress, conformance, and delivery

Keep separate dimensions for work progress, behavioral verification, execution
lifecycle, dependency blockage, and delivery availability. A passing test does
not imply that a PR is merged or a capability is deployed. Counts of completed
cards do not alone establish that a flow is usable.

Verification retains `passed`, `failed`, `stale`, `unknown`, `needs-review`, and
`blocked` with explicit reasons and provenance. A flow passes only when every
applicable required condition has current successful evidence. Before coding,
the product specification must define aggregation for conflicting states,
conditional branches, empty requirements, retries, skipped or partial results,
and simultaneous failure and blockage. Preserve all relevant causes; a display
precedence rule must not hide a failure or turn an unverified result into pass.

Managers and developers read the same selected source and contract version.
Draft work, a delivered baseline, and current deployed availability must remain
distinguishable, with observation times and unresolved evidence shown.

## Executable Contract Verification

The central guarantee is implementation conformance to the flow, not merely
that a list of associated tests ran. Three complementary layers are required:

1. Structural validation checks identities, ownership, routes, and artifact
   compatibility in the declared model.
2. Behavioral tests exercise the real product and check completion conditions,
   boundary inputs, invalid inputs, and failure outcomes.
3. Boundary observations prove required interactions, handoffs, causal order,
   and forbidden effects when final output alone cannot prove the contract.

Prose matching, file existence, successful mock output, or emitting a step name
is insufficient behavioral evidence. Natural-language conditions do not become
reliable predicates automatically. Target owners supply bounded executable
cases and independent expected outcomes using existing test runners where
appropriate. Do not generate both expected and actual behavior from the same
implementation logic, or simulate the declared graph in place of exercising
the product.

The first proof must deliberately violate representative contracts: omit a
required step, corrupt a handoff, publish too early, take a forbidden branch,
or leave a rollback incomplete. The corresponding real behavioral gate must
fail and identify the responsible step. Keep these negative proofs in formal
project-owned tests. Focused fault injection or mutation checks may support
this proof without requiring a new third-party testing package.

Existing tests may be reused when they prove the actual contract. Add missing
interaction cases instead of duplicating equivalent tests. Code coverage alone
cannot waive required behavioral proof. Guarantees apply to declared supported
behavior, cases, environments, and observation boundaries; the UI must expose
unverified portions rather than claim exhaustive proof of arbitrary behavior.

## Evidence, Versions, and CI Enforcement

### Evidence identity and ingestion

Test/evidence identities, executable selectors, node mappings, and observed
results remain separate. Test owners own selectors and observations; target
owners own requirements. Links may be required, primary, regression signals,
or advisory, with many-to-many propagation across flows.

A result binds to the repository and actual source snapshot, contract version,
mapping version, scenario and selector, relevant configuration and dependencies,
runner environment, execution attempt, actor, and immutable artifact identity.
A commit and branch name alone cannot identify two different dirty worktrees.
Source changes during execution invalidate attribution unless the run uses an
isolated immutable snapshot. Old successes remain historical evidence.

Ingestion must validate provenance, deduplicate deliveries, handle out-of-order
attempts, and prevent a late old success from replacing a newer relevant
failure. Results, accepted mapping changes, and their audit records must remain
consistent across crashes. Incomplete writes and unresolved execution outcomes
cannot produce pass. Minimal recovery is part of the first evidence owner;
large-workspace optimization follows profiling later.

Rename, move, split, merge, deletion, changed content, and unknown observations
produce explainable mapping candidates. Acceptance is explicit, authorized,
version-checked, and auditable; confidence does not authorize a mutation.
Changing a mapping invalidates dependent conclusions. Unmapped evidence cannot
silently contribute to passing a flow.

### Evolving and retaining flows

Retain immutable delivered contract versions and validation records while new
work evolves under the same flow identity. Additions, removals, splits, merges,
and changed outputs must show changed obligations and affected consumers before
acceptance. A requirement change is distinct from a fix that restores existing
behavior, and is subject to its own scope authority.

Compare the proposed contract and required-case set against the accepted base.
Deleting a step, test, selector, or mapping must not silently shrink regression
protection. An agent cannot authorize its own scope expansion or weaken its
completion policy to obtain a green result. Approved revisions invalidate or
reverify affected evidence; unrelated valid evidence may remain applicable only
under a proven equivalence policy.

All completed flows remain available historically. Every currently supported
delivered contract participates in regression, including completed work outside
the task at hand. Explicit retirement preserves history and records why a
contract leaves the supported set. Historical versions are not all assumed to
be simultaneously supported on the current source.

### All-flow delivery gate

CI ingestion and a mandatory all-flow aggregate check belong to the first
usable Control Plane, not a later integration-only phase. The aggregate checks
the entire declared supported set at protected delivery checkpoints. Focused
step runs provide development feedback but cannot substitute for this gate.

The gate compares expected cases with actual discovery, execution, and verdicts
on the intended source or integration revision. Missing results, zero matched
required tests, accidental skips, cancellation, timeout, invalid provenance,
unresolved required mappings, and failed assertions all prevent acceptance.
Do not trust only shell exit codes, a provider's green job, or a skipped check.
Required aggregate execution and repository protection must be verified for
the selected CI provider, including combined changes when that is required.

The verifier and authorization policy used to admit a change must not be
silently weakened by that same change. Isolate candidate code from service
credentials and evaluate contract or gate-policy changes against the accepted
base and its authorization rules. CI failure means repair the implementation
or explicitly revise the requirement; it never automatically approves either.

All-flow means every applicable supported flow obligation, not unlimited
enumeration of every input and interleaving. Define supported scenarios and
environment coverage explicitly. Deduplicate equivalent executions under the
same inputs; honor required expensive gates at their defined checkpoints.
Watchers update state without continuously rerunning broad suites. Selecting
only changed tests is an optimization that cannot silently omit required flows.

## Bounded Human and Agent Execution

Every admitted task binds a flow version and owner step to its goal, mutation
scope, prerequisites, expected outputs, permitted actions, actor capabilities,
validation requirements, resource limits, and stop conditions. Readiness to
begin implementation differs from having already passed completion tests.

The common execution path is:

```text
select contract version and concrete step
-> check readiness and affected boundaries
-> bind task scope, actor, capabilities, and budgets
-> obtain any required authorization
-> execute through controlled tools and runners
-> observe progress, resource use, and boundary violations
-> stop, replan, or hand off when limits or prerequisites fail
-> verify actual behavior and the required supported-flow regression set
-> accept an authorized delivery and retain its evidence
```

Typed actions declare inputs, runner, effects, capabilities, timeout,
cancellation, outputs, and audit requirements. UI, CLI, and agents invoke the
same service contract. Scope enforcement must cover actual filesystem, process,
network, and credential access through the supported runner. A prompt, an
allowlist displayed on a card, or a post-run diff alone is not enforcement.
Unrestricted agent tools outside that boundary cannot be advertised as a
controlled execution mode. Repository and connector content is input data, not
authority to grant permissions.

Budgets may cover elapsed time, tokens, tool calls, attempts, and concurrency.
They accumulate across retries and handoffs. Unsupported or unavailable usage
measurement must be explicit; do not claim a hard token bound from missing
telemetry. Stop admission before the next operation exceeds its allowance and
define cancellation bounds for in-flight operations. Agent progress means
reviewable artifacts and completed checks, not self-reported completion,
changed-line counts, or token consumption.

Repeated failure, stalled progress, changed assumptions, scope expansion, or
budget exhaustion triggers bounded replanning or a human handoff. Preserve
partial work, failures, consumed budget, and next required decisions. Stopping
must settle owned processes before success, cleanup, or restart is claimed.
Recovery acts only on task-owned changes; external side effects need explicit
compensation or human resolution and cannot be assumed rollbackable.

Trust is task-specific evidence plus enforceable boundaries and explicit
policy. Past success does not grant an agent unrestricted authority. Higher
autonomy may be allowed for reversible work with adequate protection, while
commit, push, release, deployment, and external communication retain their
applicable authorization boundaries. Standing authorization remains reusable
within its scope; repeated confirmation is not a substitute for enforcement.

## Board, Machine Surfaces, and Integrations

One workspace service owns evidence and state for all panels. UI, API, and CLI
support step context, contract differences, affected flows, status explanation,
available actions, execution progress, budgets, artifacts, and handoff state.
Opening a panel never changes canonical truth. UI updates should subscribe to
affected state rather than rebuild every panel on every event.

Cards provide test and CI actions with progress, results, failure explanation,
and retry in the board. Supported ticket and PR operations also return their
outcomes to the originating step. Links remain useful for unsupported actions,
but link-only navigation does not satisfy an in-board action's acceptance.

Ticket providers may own assignment and ticket workflow fields; Git providers
own PR facts; runners own execution observations. The Control Plane derives
flow conformance from registered evidence. Define field ownership and incoming
updates, stale data, deletion, permission loss, and concurrent edits explicitly.
Ticket completion never overrides failing behavioral evidence.

Outbound operations use durable outbox entries, bounded retries, deduplication,
and observable delivery state. Avoid synchronization loops and duplicate
external effects. Secrets are indirect references and are redacted from logs,
public state, and artifacts. Connector failure is shown as an integration or
required-evidence problem; it cannot fabricate a product pass or failure.

Early shared viewing must identify the same team baseline and observation time.
Full team accounts, remote execution, hosted tenancy, and enterprise policy can
follow separately. The local proof must not be marketed as complete team
coordination or containment of processes it does not control.

## Delivery Sequence and Effort

| Delivery  | Owning plan                           | Required result                                                                                    |
| --------- | ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Phase 0-2 | Completed static plan                 | Read-only workspace and preserved standalone entries                                               |
| Phase 3   | Contract Verification and CI Plan     | Two related flows, real conformance checks, negative proofs, and minimal controlled actions        |
| Phase 4   | Contract Verification and CI Plan     | Usable board, common API/CLI, versioned evidence, mandatory CI aggregate, and shared baseline view |
| Phase 5   | Agent Execution and Integrations Plan | A bounded agent task with enforced scope, budgets, stopping, recovery, and handoff                 |
| Phase 6   | Agent Execution and Integrations Plan | Small-team use, selected ticket/PR integration, and reproducible open-source adoption              |

Minimal action authorization, runner lifecycle, audit, CI ingestion, and crash
consistency are implemented in Phase 3-4. Phase 5 extends that foundation; its
entry criteria cannot depend on agent controls that it has yet to build.
Phase 6 hardens and expands proven controls rather than first introducing them.

The preliminary estimate is 2-4 engineering person-weeks for the core proof,
another 6-10 for an operational trial, and another 8-14 for a bounded agent and
small-team trial. These are low-confidence planning ranges, not calendar
commitments. The agent runner's actual containment and telemetry capabilities
must be measured before retaining the last range. Assumptions are a familiar
TypeScript codebase, one repository, existing test runners, one CI provider,
one agent backend, and one ticket provider. Full existing-flow onboarding,
additional languages/providers, hosted tenancy, and enterprise capabilities
are excluded. Re-estimate after Phase 3 from observed integration and test cost.

Separate platform cost, per-flow behavioral-adapter cost, and ongoing CI and
connector cost. Do not infer migration effort from the number of existing
cards or from passing static contract tests. Prior estimates of 4-7 weeks per
deferred plan are superseded by this staged, assumption-bound estimate.

## Activation Decisions and Readiness

Before the first implementation owner slice, select and document:

- a thin product specification, exact Control Plane architecture Inspector,
  supported cases, bounded DoD, and owner implementation boundaries;
- two related real flows and the smallest shared owner that can demonstrate a
  cross-flow regression, including their existing behavioral test entry points;
- supported runtime, persistence, source snapshot, artifact retention, and
  result ordering contracts for the local proof;
- the first test runner and CI provider, supported scenarios, required-case
  discovery, aggregate gate wiring, and accepted-baseline policy;
- initial typed actions, capability enforcement, cancellation and recovery
  boundaries, with autonomous source-writing agents excluded until Phase 5; and
- measurable workspace scale and latency/resource budgets for each checkpoint.

Later activation selects the agent backend, enforceable budgets and tool
boundary, shared access model, ticket operations, and open-source packaging.
Decide persisted identities and compatibility before introducing producers.
Read the applicable Inspector before each implementation segment, work one
owner at a time, and test-first every behavioral mismatch. Do not create
readiness ledgers or extra assertion registries to substitute for executable
product cases. Activation records a bounded task; it does not authorize all
future integrations, runtime changes, dependencies, or publication.

## Acceptance and Stop Conditions

Phase plans provide the executable acceptance cases. The overall product must
demonstrate preflight detection, controlled task execution, real conformance,
supported-flow regression, versioned change, and reproducible adoption.
Measure manual intervention, rework, escaped regressions, ineffective resource
consumption, and contract-maintenance effort on representative tasks. A
baseline and a fixed observation period are required before claiming savings.

Stop the affected delivery if any of these remains possible:

- a prose check or associated-test list is presented as behavioral proof;
- a necessary step contradiction is hidden or unverified behavior is shown
  delivered;
- an actor can expand scope, weaken its gate, or escape the declared controls;
- missing, skipped, stale, or incorrectly attributed evidence produces pass;
- removing obligations silently shrinks the supported regression set;
- retries or handoffs reset budgets, or stopped work continues untracked;
- a UI or connector becomes a second conformance owner;
- dynamic state leaks into schema version 2 or product runtimes depend on the
  Control Plane; or
- completing the milestone requires unbounded scope beyond its phase contract.

## References

- [Static Workspace 0.2.0 Closure Plan](completed/flow-inspector-static-workspace-0.2.0-closure-plan.md)
- [Contract Verification and CI Plan](flow-inspector-control-plane-evidence-and-ci-plan.md)
- [Agent Execution and Integrations Plan](flow-inspector-control-plane-actions-and-integrations-plan.md)
- [Flow Inspector contract](../FLOW_INSPECTOR.md)
- [Static Workspace contract](../STATIC_WORKSPACE.md)
- [Framework Architecture](../../../framework/ARCHITECTURE.md)
- [Framework Workflow](../../../framework/WORKFLOW.md)
- [Bounded task scope and closure](../../../framework/rules/bounded-task-scope-and-closure.md)
- [Inspector contract readiness](../../../framework/rules/inspector-contract-readiness.md)
- [Inspector step execution](../../../framework/rules/inspector-step-execution.md)
