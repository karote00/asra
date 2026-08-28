# Flow Inspector Control Plane Core Preview Plan

## Status

Approved first delivery target. Implementation has not started.

This plan covers Phase 0 through Phase 2 and ends with an independently
versioned `v0.1.0-preview` headless companion. The preview may ship in the same
release wave as the current Asyra Framework release, but it is optional and
must not block, delay, or alter Framework package publication.

Implementation is fixed at `tools/flow-inspector/control-plane/`. It must not
live under `packages/`, enter the Framework Changesets publication allowlist,
or become a Framework/App runtime dependency. A separate-repository extraction
decision may be made only after preview validation.

Roadmap authority:
[`flow-inspector-workflow-control-plane-roadmap.md`](flow-inspector-workflow-control-plane-roadmap.md).

## Objective

Prove the control-plane value without depending on a Web UI: given panel
configuration, stable evidence mappings, source identity, and observed test
results, provide one deterministic and explainable node state through JSON,
CLI, and API, then allow a human or AI agent to execute only a node's declared
focused test actions through a typed, audited runner.

## Authorized Scope

- product contract, architecture, schema, threat model, and repository layout;
- panel, node, route, evidence, test, mapping, action, actor, result, execution,
  provenance, and audit contracts;
- static configuration and local result storage selected during Phase 0;
- structural validation and stable-id validation;
- many-to-many node/test mapping declared explicitly by configuration;
- result ingestion and basic `passed`, `failed`, `unknown`, and `stale`
  derivation;
- machine-readable JSON, CLI, and local API surfaces;
- typed focused-test actions, timeout, cancellation, confirmation, local-trusted
  capability evaluation, and audit records; and
- one representative Asyra panel used as a consumer proof without coupling the
  Framework runtime to the tool.

## Explicit Exclusions

- Web UI and graphical panel rendering;
- automatic mapping candidate generation or reconciliation;
- rename, move, split, or merge inference;
- complete dependency-aware or cross-panel freshness propagation;
- visual-review execution and screenshot orchestration;
- Git commit, push, release, publish, merge, or deployment actions;
- CI result ingestion unless Phase 0 explicitly selects it as necessary for
  the preview proof;
- Slack, Jira, Linear, GitHub, Teams, or other external adapters;
- team RBAC, remote runners, hosted synchronization, and multi-tenancy; and
- any change to Flow Inspector schema version 2 or its read-only viewer
  contract.

## Phase 0 — Product Contract and Technical Decisions

### Required decisions

- independent package naming, versioning, and publication strategy for the
  fixed `tools/flow-inspector/control-plane/` implementation root;
- product and package names;
- supported Node.js and browser-independent runtime environments;
- configuration, local state, result, artifact-reference, and audit formats;
- stable ids and versioning/migration rules;
- source identity and the intentionally bounded basic freshness oracle;
- local API transport and process lifecycle;
- supported focused-test runner types;
- command allowlist, workspace boundary, environment handling, timeout,
  cancellation, confirmation, and secret-redaction rules; and
- representative valid, empty, invalid, stale, failed, cancelled, timed-out,
  and permission-denied product cases.

### Deliverables

- thin product specification;
- architecture and owner-flow document;
- schema and storage contract;
- local execution threat model;
- exact Inspector for the control-plane service architecture; and
- executable product cases and bounded Definition of Done for Phase 1 and
  Phase 2.

### Exit gate

Do not start implementation until one owner is defined for configuration,
evidence identity, result ingestion, status derivation, action dispatch,
process execution, and audit persistence, and no UI or AI client can bypass the
action registry in the proposed architecture.

## Phase 1 — Registry, Mapping, and State Core

### Required behavior

- validate panel graphs, stable ids, routes, evidence definitions, mappings,
  and action references;
- register tests/evidence independently from panel mappings;
- represent node/test many-to-many relationships including cross-panel links;
- ingest results with revision, branch, action/command, timestamp, actor,
  environment, and artifact-reference provenance;
- derive the same state regardless of which client or panel requests it;
- explain every derived state with its requirements, evidence, provenance, and
  freshness decision;
- isolate unmapped results so they cannot silently alter panel health; and
- persist and reload configuration, observations, derived inputs, and audit
  records deterministically.

### Preview status vocabulary

- `passed`: all required mapped evidence is current and successful;
- `failed`: current required mapped evidence contains a relevant failure;
- `unknown`: required evidence is missing or cannot be resolved; and
- `stale`: previous evidence does not match the bounded source, configuration,
  mapping, action, or environment identity selected in Phase 0.

`needs-review` and richer `blocked` derivation belong to the next plan unless a
Phase 0 product case proves they are necessary to avoid a false `passed` state.

### Exit gate

Formal contract tests must prove deterministic validation, ingestion,
many-to-many propagation, provenance, persistence, and all four preview
statuses, including negative cases that prevent unmapped or stale evidence
from producing `passed`.

## Phase 2 — Machine Interface and Focused Execution

### Required CLI/API capabilities

- list panels;
- return one panel's current state;
- explain one node's state and provenance;
- find nodes affected by a declared file, test, or evidence identity within the
  preview's bounded impact model;
- list a node's required and available actions;
- run one declared focused-test action;
- inspect running, completed, failed, cancelled, and timed-out executions; and
- emit and ingest the resulting evidence through the same core boundary used by
  external results.

Exact command names and API routes are Phase 0 decisions; this plan does not
make illustrative names public API prematurely.

### Action contract

The preview supports focused test execution and may support read-only open-link
or open-artifact actions if the selected runtime can do so without expanding
the trust boundary. Each action declares:

- stable id and type;
- runner and bounded selector;
- required capabilities and risk;
- timeout and cancellation behavior;
- confirmation policy;
- expected evidence and affected nodes; and
- audit requirements.

Raw arbitrary shell strings from panel UI/config, AI requests, or API payloads
are forbidden. The runner resolves only registered actions and validated
arguments inside the selected workspace boundary.

### Exit gate

Formal end-to-end CLI/API tests must prove that a human or AI client can inspect
state, find the required focused test, execute it through the registry, observe
its lifecycle, ingest its result, and receive the same updated state and
explanation. Tests must also prove rejection of unknown actions, unregistered
commands, invalid arguments, insufficient capability, missing confirmation,
timeout, cancellation, and unsafe workspace escape.

## `v0.1.0-preview` Release Contract

The preview may be announced with Asyra Framework only when:

- all Phase 0–2 exit gates pass;
- the tool remains at its fixed implementation root with independent
  versioning and publication boundaries;
- one real Asyra workflow proves node/test mapping and focused execution;
- documentation labels the tool experimental and lists every exclusion;
- Framework packages have no runtime dependency on the preview tool;
- the Framework release can proceed if the preview is absent or delayed;
- clean-consumer installation and the supported Node environment pass;
- security tests prove the registered-action boundary and redaction behavior;
  and
- the exact preview artifact and release action receive the normal explicit
  publication authorization.

## Stop Conditions

- Phase 0 leaves command trust boundary, storage owner, independent publication
  boundary, or basic freshness semantics unresolved.
- A result can become `passed` without current provenance.
- A client can provide a raw executable command instead of a registered action
  id and validated inputs.
- Framework runtime or packages must depend on the preview tool.
- Achieving the preview requires Web UI, mapping inference, external adapters,
  or team permissions that belong to later plans.
- The preview would delay the Framework release rather than ship independently.

## Estimated Duration

- Phase 0: 3–5 focused working days.
- Phase 1: 1–2 weeks after Phase 0 acceptance.
- Phase 2: 1–2 weeks after Phase 1 acceptance.
- Expected total for a public preview: approximately 4–5 weeks, with a
  2–3-week engineering proof possible before release hardening.

Estimates are planning ranges, not delivery commitments.

## References

- [Workflow Control Plane Roadmap](flow-inspector-workflow-control-plane-roadmap.md)
- [Flow Inspector contract](../FLOW_INSPECTOR.md)
- [Framework Workflow](../../../framework/WORKFLOW.md)
- [Inspector contract readiness](../../../framework/rules/inspector-contract-readiness.md)
