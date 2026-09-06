# Flow Inspector Control Plane Agent Execution and Integrations Plan

## Status and Objective

Deferred until the
[Contract Verification and CI Plan](flow-inspector-control-plane-evidence-and-ci-plan.md)
completes. Revised on 2026-09-07; the existing filename remains stable. This
plan extends an implemented action, evidence, and CI foundation rather than
requiring its own future agent controls to exist at entry.

Enable a human to delegate a concrete step to an AI agent with enforceable
scope and resource limits, observable progress, and trustworthy delivery.
Extend the same board to small-team work and selected ticket/PR operations.
The [roadmap](flow-inspector-workflow-control-plane-roadmap.md) owns risk,
contract, versioning, and open-source product direction.

## Entry Criteria and Scope

- Real behavioral conformance, negative proofs, cross-flow regression, and the
  selected required CI aggregate have passed the preceding plan's gates.
- UI, CLI, and API already use one typed action owner with capability checks,
  bounded runner lifecycle, provenance, basic audit, and crash-safe ingestion.
- Flow versions, accepted-baseline protection, mapping review, and the
  supported regression set are operational within the declared trial scope.
- For Phase 5, select one agent backend and its tool/process interface.
- Before Phase 6, select the shared workspace access model and one ticket
  provider with explicit initial operations. Those decisions do not block the
  earlier agent proof.
- Before agent execution, define the exact containment, usage measurement,
  cancellation, recovery, and handoff contract, supported adversarial cases,
  and owner implementation boundary. Unknown capabilities remain unsupported.

The Control Plane stays tool-owned and independent of product runtimes.
Provider adapters live outside its conformance authority. Existing standing
authorization applies within its recorded scope; this plan does not authorize
publication, secret changes, package installation, or unrestricted tool use.

The slices below sequence delivery work. Activation must map each implementation
segment to one exact Inspector owner; a slice heading is not a multi-owner
implementation allowance.

## Phase 5 - Bounded Agent Execution

### Slice 1 - Task admission and enforceable capabilities

Bind a task to one concrete owner step, flow version, source baseline, objective,
allowed mutations, input/output contract, required validation, capabilities,
budgets, and stop conditions. Read upstream and downstream contracts before
admission. Independent steps may run concurrently only with declared resource
and mutation-conflict rules; overlapping writes cannot rely on last-writer wins.

Integrate the selected agent through controlled tools and runners. Enforce file,
process, network, and secret access at the actual execution boundary, and
verify candidate writes against scope. Include path traversal, symlink escape,
unregistered commands, and indirect process/network effects in the supported
boundary tests. A prompt or post-run diff alone is insufficient containment.

Bind permission to the task, actor, action, source, and current policy. Existing
success history does not grant broader capabilities automatically. Repository,
ticket, log, and model content cannot authorize new scope or change the gate.
An agent may propose a contract revision, but accepting a revision that expands
its own assignment or weakens its required proof needs the designated separate
authority. Candidate test execution must not inherit control-plane secrets.

### Slice 2 - Resource limits, progress, and stopping

Enforce the selected elapsed-time, tool-call, attempt, and concurrency limits.
For token or cost limits, document the backend's measurement fidelity and
maximum in-flight exposure. A backend with unavailable usage cannot advertise
hard token enforcement; use an explicitly bounded supported mode or do not
admit a task requiring that guarantee.

Persist cumulative consumption across retries, restarts, and handoffs. Check
admission before each operation; define bounded cancellation for active work.
Progress records reference reviewable changes, produced artifacts, or completed
checks. Self-reported completion and repeated equivalent edits are not proof
of progress.

Repeated failure, stalled progress, incompatible assumptions, proposed scope
expansion, permission revocation, or exhausted budget stops further admission.
Replanning remains inside the task contract; a material expansion requires a
decision from the scope owner. Do not reset a budget by creating another run.
Human and AI work use the same conformance and delivery standard.

### Slice 3 - Recovery, handoff, and accepted delivery

Cancellation and timeout must stop or settle owned child processes. Preserve
partial changes, evidence, failures, consumed budget, and unresolved external
effects. Recovery must not overwrite unrelated user changes or another task's
work. Define task-owned rollback separately from external compensation;
uncertain external effects require reconciliation before retry.

Provide a handoff that lets a human or successor agent continue from the same
contract, source, remaining budget, and known evidence without repeating broad
discovery. Abandoned and failed tasks remain distinguishable from completed
work. A resumed task revalidates changed inputs and permissions.

Completion invokes the preceding plan's verifier and applicable all-flow CI
gate on the intended delivery revision. A model assertion, passing focused
test, or finished tool call cannot mark the task delivered. Commit, push,
release, deployment, and external communication remain separate typed actions
with their applicable authorization and audit requirements.

Agent checkpoint: delegate a real bounded task, observe autonomous progress,
reject an out-of-scope action and a behavioral regression, exercise a resource
stop and handoff, then accept a conforming result without losing existing flow
protection. Preserve these as formal cases plus a reproducible demonstration.

## Phase 6 - Team Board, Integrations, and Open-Source Adoption

### Slice 4 - Shared context and everyday lifecycle operations

Extend the preceding plan's shared baseline view with the selected access model,
responsibility assignment, and supported team operations. Managers inspect the
goal, available capability, remaining work, blockers, and impact; developers
inspect the concrete step and its actions. Different views must refer to the
same contract/source version and expose last observation and stale state.

Choose a small explicit ticket/PR operation set before implementation, such as
linking a ticket, reading/updating its state, inspecting a PR and CI result,
and requesting a supported review action. Supported operations execute from a
card and report progress, result, and failure there. Unsupported operations may
link out. A collection of external links cannot close the supported action DoD.

Specify field ownership, inbound updates, versions, conflict policy, deleted
tickets, and permission loss. External ticket edits may update work fields;
they cannot silently rewrite a flow contract or turn failed verification green.
Technical ownership and team assignment remain distinct. Do not require full
enterprise accounts or real-time graph co-editing to prove small-team use.

### Slice 5 - Reliable adapters and runtime hardening

Use the existing typed action and audit boundary for adapters. Outbound work
has durable outbox identity, deduplication, bounded retries, and reconciliation
for uncertain completion. Incoming updates include source identity and version
handling to avoid stale overwrite and synchronization loops. Test partial
success, duplicate callbacks, reordered delivery, offline recovery, and crash
after an external effect but before local acknowledgement.

Resolve secrets indirectly; redact config, results, logs, and artifacts.
Connector failure remains visible without becoming a second conformance owner.
Required external evidence that is unavailable cannot satisfy a completion
condition. CI ingestion already exists; this slice adds selected provider
conveniences rather than delaying core CI correctness until now.

Profile supported graph size, history volume, concurrent tasks, subscriptions,
artifact storage, watchers, and cleanup. Fix measured bottlenecks while
preserving truth and the preceding phases' recovery guarantees. Apply retention
rules that preserve delivered contract and verdict history while making any
expired detailed artifact explicit. No hidden broad test loop is acceptable.

### Slice 6 - Reproducible open-source use

Provide installation and a local example whose core verification requires no
paid service. Include a controllable demonstration agent for deterministic
boundary tests and separately exercise the selected real agent backend before
claiming that integration supported. External credentials and provider charges,
when applicable, are explicit optional integration requirements.

Document how users define a concrete flow, connect existing behavioral tests,
add boundary observations, run CI, and extend actions/adapters. Show successful
work, an intentional violation, a budget stop, and a recoverable handoff.
Explain supported guarantees and unverified boundaries in the product itself.

Check the selected license, distribution, contribution instructions, dependency
obligations, and publication scope before an explicitly authorized open-source
release. Individuals and companies should be able to understand and extend
the risk-control mechanisms. Payment willingness is not an acceptance gate.

## Definition of Done

- A real agent completes a scoped step under the same executable contract and
  regression policy as a human; task completion is backed by actual evidence.
- Unsupported tool paths and tested scope, filesystem, process, network, and
  secret violations are denied before their prohibited effects occur.
- Missing usage telemetry never produces a false hard-budget claim. Applicable
  limits stop admission and bounded cancellation settles active owned work.
- Retry, restart, and handoff preserve cumulative consumption; repeated failure
  or no progress cannot create an unbounded task loop.
- A contract/gate weakening proposal cannot authorize itself. Revoked or stale
  capabilities cannot execute a protected action.
- Partial work can be inspected and resumed or recovered without damaging
  unrelated changes. External uncertainty is reconciled before replay.
- A shared-owner regression identifies affected retained flows and prevents
  delivery until conformance or an authorized requirement revision is proven.
- Supported ticket/PR actions work from the card, including inbound edits,
  conflict, deletion, permission loss, retry, and partial-failure cases.
- Repeated callbacks and crashes do not duplicate external effects or erase
  audit history. Secrets are absent from ordinary logs and public artifacts.
- Manager, developer, API, and agent views agree on the selected baseline and
  expose work progress separately from verification and delivered capability.
- Another user can reproduce the example and its negative cases. Measured
  supervision, rework, resource use, and maintenance effort are reported against
  a defined baseline without requiring a commercial adoption target.
- Performance, process cleanup, restart, and retention gates pass at the
  explicitly supported scale. Existing static compatibility remains intact.

## Exclusions and Stop Conditions

Multiple agent backends, additional ticket/CI vendors, arbitrary workflow
automation, remote runner fleets, enterprise RBAC, hosted multi-tenancy, and
unrestricted autonomous publication require separate scope decisions.

Stop the affected slice when enforcement depends only on agent obedience, an
external tool can bypass the task boundary, resource measurement cannot support
the promised limit, cancellation leaves uncontrolled work, scope can expand
without its owner, missing evidence is treated as success, or an integration
must weaken credentials, authorization, or conformance rules to operate.

## Effort and Closure

The roadmap provisionally allocates another 8-14 engineering person-weeks for
this bounded agent and small-team trial. Re-estimate after Phase 3 and before
agent activation using the chosen backend's containment, telemetry, and
cancellation capabilities. Adapter count and per-flow behavioral work are
separate cost drivers; full existing-flow migration is excluded.

Phase 5 and Phase 6 have separate checkpoints. Close the accepted bounded
trial without adding unselected providers or team features. Public release is
a later explicit operation after the selected open-source readiness work.

## References

- [Workflow Control Plane Roadmap](flow-inspector-workflow-control-plane-roadmap.md)
- [Contract Verification and CI Plan](flow-inspector-control-plane-evidence-and-ci-plan.md)
- [Flow Inspector contract](../FLOW_INSPECTOR.md)
