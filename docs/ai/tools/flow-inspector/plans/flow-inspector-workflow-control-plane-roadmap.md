# Flow Inspector Workflow Control Plane Roadmap

## Status

Approved long-term roadmap. This file owns the cross-phase product direction
and boundaries; it is not the execution plan for an individual phase and does
not change the existing Flow Inspector schema or viewer contract.

The first delivery target is a static `v0.1.0-preview` workspace after Phase 2.
It integrates current-project Inspectors behind one sidebar and shared viewer
without execution state, CI comparison, machine interfaces, or actions. It may
accompany the current Asyra Framework release wave, but it is optional,
independently versioned, and never blocks Framework package publication. The
bounded execution plan is:
[`flow-inspector-static-workspace-preview-plan.md`](completed/flow-inspector-static-workspace-preview-plan.md).

The preview implementation root is fixed at `tools/flow-inspector/workspace/`.
The later dynamic product is separately rooted at
`tools/flow-inspector/control-plane/`. Both are tool-owned and remain outside
`packages/` and the Framework Changesets publication allowlist. After preview
validation, extraction to a separate repository remains an explicit future
decision.

The current static contract remains authoritative for architecture inspection:
[`../FLOW_INSPECTOR.md`](../FLOW_INSPECTOR.md). That contract intentionally
excludes execution state, test paths, locks, and closure state. This future plan
adds a separate workflow control-plane layer that may reference static
Inspector targets and steps through stable identifiers without turning the
architecture map into an execution ledger.

## Product Objective

Build an AI-native workflow verification dashboard for humans, AI agents, and
local or CI automation. The product is not merely a UML viewer or CI report. It
is a control plane in which each panel represents a governed feature, system,
or delivery flow and each node exposes the current evidence-backed state,
applicable work, precise validation actions, failures, and next routes.

The product should reduce repeated repository scans and unnecessary full-suite
runs. A user or agent should be able to inspect persisted, provenance-bearing
state first, identify the affected nodes and evidence, and run only the actions
declared for those nodes.

## Product Boundaries

### Static architecture contract

The existing Flow Inspector continues to own read-only architecture facts:

- owners, inputs, outputs, routes, predicates, artifacts, invariants, and
  acceptance contracts;
- target-owned semantic references and failure ownership; and
- generic rendering and structural validation independent of runtime state.

It does not own pass/fail status, action execution, test mapping, task progress,
permissions, notifications, or audit history.

### Workflow control plane

The future product owns dynamic operational concerns:

- panels and operational nodes linked to stable Inspector target/step ids when
  an architecture contract exists;
- evidence registry, test registry, node-evidence mapping, result ingestion,
  freshness, and derived node status;
- typed actions, execution lifecycle, permissions, confirmations, artifacts,
  and audit events;
- machine-readable API, JSON, and CLI surfaces; and
- a local UI and optional external-system adapters.

A control-plane panel may also represent a workflow that has no Flow Inspector
architecture target. It must not fabricate architecture ownership in order to
gain operational features.

## Core Product Model

### 1. Panel graph

- Each panel governs one feature, system, task family, or delivery flow.
- Nodes have stable ids, types, descriptions, prerequisites, and supported
  actions.
- Directed routes may move forward, branch, converge, terminate, or return to
  an earlier node when an explicit condition fails.
- Graph state describes operational progress; it must not redefine product
  semantics or architecture ownership.
- A workspace-level service loads multiple panels. The architecture must not
  require one server or watcher per panel.

### 2. Evidence graph

- Tests, visual reviews, logs, screenshots, profiles, artifacts, manual
  confirmations, and CI results are typed evidence.
- Nodes and evidence have a many-to-many relationship. One node may require
  several tests, and one test may affect several nodes across panels.
- Test and evidence results are workspace events, not properties of whichever
  panel happens to be open in the UI.
- A panel is a projection of the global evidence store plus its declared
  mappings and freshness policy.
- Every usable result records provenance such as source revision, branch,
  command/action, timestamp, actor, environment, and artifact references.

### 3. Registries and mappings

The model separates identity, intent, and observation:

- the test/evidence registry gives each runnable or ingestible item a stable
  identity and selector;
- panel links declare which evidence protects or informs which nodes and the
  link role, such as required, primary, regression signal, or advisory;
- observation state records what the latest runner actually discovered and
  executed; and
- mapping candidates record probable rename, move, split, merge, or newly
  observed relationships without silently rewriting declared intent.

Test files do not need to know about panels. Panel owners own their evidence
requirements and links; test owners own stable registry identity and runnable
selectors; tooling validates both sides.

Formal mappings cannot be changed automatically from a low-confidence guess.
Human or AI acceptance is an explicit action with before/after values, actor,
reason, confidence, and audit identity. Unmapped observations remain isolated
as unmapped evidence or candidates and cannot silently affect panel health.

### 4. Derived node status

Node status is derived from declared requirements, current mappings, evidence
freshness, route conditions, and execution results. It is not a manually
maintained green/red flag.

The minimum status vocabulary is:

- `passed`: all required evidence is current and successful;
- `failed`: current required evidence contains a relevant failure;
- `stale`: previously valid evidence is no longer trustworthy for the current
  source, configuration, mapping, or dependency state;
- `unknown`: required evidence has not been observed or cannot be resolved;
- `needs-review`: mapping drift, ambiguous evidence, or an explicit review gate
  prevents a trusted conclusion; and
- `blocked`: a prerequisite, permission, dependency, or route condition
  prevents the node from advancing.

Every status response must explain why it was derived and identify the
evidence, source identity, and policy involved. A passed status without current
provenance is not valid.

### 5. Typed action registry

Nodes expose actions through stable action ids and typed registry entries, not
arbitrary shell strings embedded in UI configuration. Initial action families
may include:

- focused test or evidence execution;
- opening a source, specification, link, result, or artifact;
- synchronized visual review;
- notification and external-tool synchronization;
- mapping candidate accept/reject/reconcile;
- Git diff or review preparation; and
- explicitly protected commit, push, release, or deployment gates.

Every action declares its type, inputs, runner, risk level, required
capabilities, timeout, cancellation behavior, confirmation policy, expected
outputs, affected panels/nodes, and audit requirements. Dangerous external or
Git mutations retain their own explicit authorization boundaries; a panel
button does not constitute advance authorization.

Action execution produces evidence and audit events through the same ingestion
boundary as CLI or CI execution. UI and AI clients call the registry contract;
neither may bypass it to execute arbitrary commands.

### 6. Mapping reconciliation

Result ingestion compares observed evidence identity with the formal registry
and links. Rename, move, content change, split, merge, missing selector, or
unknown test observations produce status updates and mapping candidates.

Reconciliation may run after evidence execution, during validation, at task
closeout, before a protected Git/release action, in CI, or through an explicit
UI/CLI action. Candidate generation may be automatic; formal mapping mutation
must be explicit and auditable.

### 7. Integrations

Slack, Jira, Linear, GitHub, Teams, email, CI providers, and similar systems are
adapters, not panel truth owners. They may receive events and return auxiliary
delivery or task-link state, but canonical node status remains derived from the
control plane's evidence and mapping contracts.

Outbound integration uses an outbox with retry, deduplication, delivery state,
and audit history. Secrets are referenced indirectly and never stored in panel
configuration or result payloads.

### 8. AI and human surfaces

The stable machine-facing surface is at least as important as the graphical
surface. API/JSON/CLI contracts should support:

- get workspace or panel state;
- explain one node's status and provenance;
- find affected nodes for changed files, tests, or evidence;
- list required or recommended actions;
- run a declared node action and observe its lifecycle;
- submit or ingest evidence; and
- inspect and resolve mapping candidates.

The UI presents the graph, current status, causes, provenance, available
actions, execution progress, artifacts, and cross-panel impact. It must not
derive different truth merely because a different panel is open.

## Permission-Shaped Architecture

Version 1 may assume a single trusted local user, but it must not assume the
absence of permissions. Every action, event, and result must be shaped for
future policy enforcement with actor identity and type, source, capabilities
used, confirmation record, secret references used, and audit id.

The execution path remains:

```text
request action
-> resolve actor
-> evaluate capabilities and risk
-> resolve connector secret references when applicable
-> obtain required confirmation
-> execute through the registered runner
-> ingest evidence and status effects
-> append audit event
```

Version 1 may use `local-trusted` policy while retaining this path. A future
team version may add RBAC, shared workspaces, data visibility, remote runners,
and organization connector policies without replacing action or evidence
identity.

## Freshness and State Rules

Freshness policy must be designed before a passed state can be trusted. Inputs
may include source revision, relevant file ownership, dependency changes,
action configuration, test content fingerprints, panel configuration, mapping
version, runner environment, and artifact identity.

The service reads persisted config, result, mapping, artifact metadata, and
bounded source-control state by default. It does not continuously rerun tests.
Tests and visual reviews run only through explicit actions, CLI, CI, or another
declared automation trigger.

## Proposed Product Surfaces

- **Config/schema:** panels, nodes, routes, evidence registry, links, actions,
  policies, connectors, and stable Inspector references.
- **State store:** observations, results, derived status inputs, candidates,
  execution records, artifacts, outbox entries, and audit events.
- **Core service:** validation, ingestion, reconciliation, freshness, status
  derivation, action dispatch, and event publication.
- **CLI/API:** deterministic machine-facing inspection and execution contract.
- **Workspace dev server:** one local process serving multiple panels and live
  result updates.
- **Web UI:** graph exploration, explanation, focused actions, review, and
  artifact access.
- **Adapters:** optional CI, source-control, task-tool, and communication
  integrations outside the core truth model.

## Version 1 Scope

Version 1 should prove the control-plane value with:

- panel graph configuration and conditional routes;
- stable node, evidence, test, command, and action ids;
- test registry and node-test many-to-many links;
- result ingestion with provenance;
- freshness and derived statuses;
- mapping drift detection and candidate reconciliation;
- focused test, open-link, visual-review, and review actions through the typed
  registry;
- machine-readable CLI/API/JSON;
- one workspace-level local service and a functional status/action UI;
- local-trusted capability checks, confirmation boundaries, and audit log; and
- validation for broken ids, stale selectors, missing required evidence, and
  unsafe action declarations.

Version 1 does not require complete team RBAC, hosted multi-tenancy, a plugin
marketplace, arbitrary workflow automation, or every external integration.

## Version 2 Candidates

- team accounts, roles, workspace policies, and data visibility;
- remote and organization-managed runners;
- shared review and approval workflows;
- production-grade task, source-control, CI, and communication adapters;
- organization secret and connector lifecycle management;
- hosted synchronization and retention policies; and
- richer cross-panel portfolio and total-release views.

## Delivery Sequence

Implementation is split into three independently closable plans:

1. **Static Workspace Preview Plan — Phase 0 through Phase 2**
   - current-project Inspector inventory and catalog contract;
   - one static workspace shell with sidebar, search, dynamic routing, deep
     links, and selected-target isolation; and
   - complete static integration while preserving standalone HTML entries.
   - Release target: independently versioned static `v0.1.0-preview` optional
     companion to the current Asyra Framework release wave.
2. **Evidence, Reconciliation, and CI Plan — future Control Plane**
   - test/evidence mapping, result ingestion, provenance, freshness, dynamic
     status, mapping reconciliation, and cross-panel propagation; and
   - API/CLI, dynamic workspace projection, and gradual CI enforcement.
3. **Actions, Delivery, and Integrations Plan — future Control Plane**
   - typed test, visual, Git, and delivery actions with permission, execution,
     confirmation, and audit boundaries; and
   - outbox-based external adapters, security hardening, and team readiness.

The second plan starts only after the Static Workspace acceptance gates pass.
The third starts only after dynamic evidence, reconciliation, and CI truth are
proven. Completing or activating a later plan must not silently expand an
earlier plan.

## Required Activation Decisions

Before dynamic Control Plane implementation begins, decide:

- the product/package name, supported runtime environments, and persistence
  backend;
- which panel nodes link directly to Flow Inspector steps and which remain
  operational-only;
- the exact freshness oracle and changed-file/dependency impact model for v1;
- the initial action types and which actions are intentionally unsupported;
- local process and trust boundaries for command execution;
- the minimum visual-review integration and artifact retention contract; and
- whether CI ingestion is required for v1 or follows the local proof.

## Activation Prerequisites

- the static `tools/flow-inspector/workspace/` and dynamic
  `tools/flow-inspector/control-plane/` ownership boundary remains intact;
- a fresh bounded implementation plan based on the chosen repository's current
  state;
- a product specification with supported, boundary, invalid, stale, and
  permission-denied cases;
- an exact architecture Inspector for the new service itself, without placing
  operational status inside Flow Inspector schema version 2;
- formal contract tests for schema validation, mapping, freshness, status
  derivation, action authorization, and audit behavior; and
- threat modeling for local command execution, secrets, artifacts, and future
  external adapters.

## Stop Conditions

- UI or AI clients can execute arbitrary shell commands outside the action
  registry.
- A passed state can be produced without current provenance.
- Mapping guesses can silently change formal links or panel health.
- Opening a panel changes the evidence or status truth being reported.
- External task or communication tools become the canonical state owner.
- The implementation mixes static Inspector architecture semantics with
  dynamic execution state in schema version 2.
- A dangerous Git, release, deployment, or connector action bypasses explicit
  authorization, confirmation, secret, or audit boundaries.
- The proposed watcher or server model reruns broad validation continuously and
  defeats the product's resource-saving objective.

## Future Definition of Done

A binding Definition of Done must be written after activation decisions. At a
minimum, v1 must prove:

- deterministic schema validation and graph routing;
- correct many-to-many evidence propagation across nodes and panels;
- trustworthy freshness, stale, unknown, needs-review, blocked, failed, and
  passed derivation with explainable provenance;
- safe focused execution exclusively through typed registered actions;
- deterministic candidate generation and explicit mapping reconciliation;
- equivalent truth through UI, CLI, API, and result ingestion paths;
- local-trusted permission flow with confirmations and complete audit events;
- isolated adapter failure with reliable outbox behavior for any shipped
  integration; and
- measurable reduction in unnecessary repository discovery or broad test runs
  for representative AI and human workflows.

## References

- [Static Workspace Preview Plan](completed/flow-inspector-static-workspace-preview-plan.md)
- [Evidence and CI Plan](flow-inspector-control-plane-evidence-and-ci-plan.md)
- [Actions and Integrations Plan](flow-inspector-control-plane-actions-and-integrations-plan.md)
- [Flow Inspector contract](../FLOW_INSPECTOR.md)
- [Framework Architecture](../../../framework/ARCHITECTURE.md)
- [Framework Workflow](../../../framework/WORKFLOW.md)
- [Bounded task scope and closure](../../../framework/rules/bounded-task-scope-and-closure.md)
- [Inspector contract readiness](../../../framework/rules/inspector-contract-readiness.md)
