# Flow Inspector Static Workspace Preview Plan

## Status

Approved first delivery target. Implementation has not started.

This plan covers Phase 0 through Phase 2 and ends with a static
`v0.1.0-preview` workspace that may accompany the current Asyra Framework
release wave. It is optional and must not block, delay, or alter Framework
package publication.

Implementation is fixed at `tools/flow-inspector/workspace/`. The future
dynamic Control Plane remains separately owned by
`tools/flow-inspector/control-plane/`. Neither tool belongs under `packages/`,
enters the Framework Changesets publication allowlist, or becomes a
Framework/App runtime dependency.

Roadmap authority:
[`flow-inspector-workflow-control-plane-roadmap.md`](flow-inspector-workflow-control-plane-roadmap.md).

## Objective

Unify every Inspector that still governs the current project into one static,
directly openable workspace. A user selects an Inspector from a sidebar and the
shared main view switches to that target while preserving stable routes, deep
links, the existing schema version 2 architecture contract, and every target's
standalone HTML entry.

This preview is a discovery and navigation surface. It does not own execution
state, test results, CI policy, commands, or actions.

## Authorized Scope

- define the exact current-project Inspector inventory and exclusions;
- define a catalog containing discovery and navigation metadata only;
- group current Inspectors by Framework, App, and Release ownership;
- add one static workspace HTML shell with a sidebar and shared main view;
- support sidebar selection, search, group collapse, dynamic routing, direct
  deep links, reload restoration, and missing-target errors;
- load only the selected target's existing schema version 2 data;
- reuse the generic Flow Inspector renderer without copying target semantics;
- keep every existing standalone Inspector HTML entry directly openable;
- validate catalog completeness, stable ids, paths, grouping, routing, data
  isolation, and renderer synchronization; and
- package the static workspace as an independently versioned optional preview.

## Explicit Exclusions

- pass, fail, stale, unknown, blocked, or needs-review execution status;
- test/evidence registry and node-test mapping;
- result ingestion, provenance, freshness, or execution history;
- CI Control Plane comparison or blocking policy;
- machine API or CLI;
- command, action, test, visual-review, Git, release, or deployment buttons;
- process runners, permissions, confirmations, secrets, or audit log;
- mapping candidates, reconciliation, or cross-panel status propagation;
- Slack, Jira, Linear, GitHub, Teams, or other external adapters;
- team RBAC, remote runners, hosted synchronization, and multi-tenancy; and
- any execution field added to Flow Inspector schema version 2.

## Current-Project Inventory Rule

The workspace includes Inspectors that still govern current source,
architecture, an active plan, or a reusable release workflow. It excludes
completed historical executions, replaced contracts, retired targets, and
closure snapshots that no longer govern current work.

An Inspector cannot be included or excluded by filename convention alone. The
Phase 0 inventory must classify each discovered target once with its current
authority and reason. Completed historical records that still contain a living
contract must first move that living contract to a current specification,
rule, active Inspector, or reusable workflow owner; history must not remain the
only current authority.

## Catalog Contract

The catalog owns discovery metadata only:

- stable `targetId` matching the target Inspector's `target.id`;
- human-readable title;
- owner group and optional App/Release subgroup;
- target data entry path;
- standalone HTML path; and
- optional ordering and search labels.

It must not duplicate lanes, steps, routes, artifacts, invariants, acceptance
contracts, or product semantics from target data. The selected Inspector data
remains the sole architecture authority.

The catalog may be explicitly authored or deterministically generated. Phase 0
must choose one owner and provide a formal completeness oracle so a current
Inspector cannot be silently omitted.

## Phase 0 — Inventory and Static Contract

### Required decisions

- exact current-project inclusion and historical exclusion rules;
- catalog owner, format, generation/authoring flow, and ordering rules;
- supported direct-open browser environments;
- stable workspace route and deep-link format;
- selected-target script loading and global-data cleanup boundary;
- static asset and relative-path resolution strategy; and
- preview artifact and independent versioning strategy.

### Deliverables

- frozen current Inspector inventory with inclusion/exclusion reasons;
- static workspace product contract and architecture;
- catalog schema and completeness contract;
- routing and selected-target lifecycle contract;
- representative valid, empty, duplicate-id, missing-path, stale-catalog,
  direct-link, reload, and rapid-switch product cases; and
- exact Inspector for the workspace architecture before implementation.

### Exit gate

Do not start the workspace implementation until the catalog has one owner, the
current-project completeness oracle is executable, selected target data cannot
leak into the next selection, and standalone entries remain independent.

## Phase 1 — Static Workspace Shell

### Required behavior

- render one sidebar from catalog summaries;
- group entries under Framework, Apps, and Release;
- show selection and allow title/label search;
- navigate through one dynamic target route rather than target-specific router
  implementations;
- restore the selected target after reload through the route;
- load and render only the selected Inspector's data;
- dispose or replace the previous target data before rendering the next one;
- preserve the shared viewer's flow canvas, filters, links, route arrows, and
  detail panel; and
- show explicit catalog, target-load, route, and not-found errors without
  fabricating data.

The sidebar contains no dynamic execution-status icons in this preview. It may
show static ownership, target kind, or lifecycle classification only when that
metadata comes from the catalog contract.

### Exit gate

Formal browser/DOM tests must prove sidebar rendering, grouping, search,
selection, deep linking, reload restoration, rapid switching, target isolation,
error handling, and shared-renderer behavior across Framework, App, and Release
representatives.

## Phase 2 — Complete Static Integration and Preview Release

### Required behavior

- register every Inspector included by the Phase 0 current-project inventory;
- prove every catalog `targetId` matches loaded Inspector data;
- prove every data path and standalone HTML path exists;
- prove each standalone entry remains directly openable and renderer
  synchronized;
- prove switching across the complete catalog does not retain the previous
  target's title, graph, links, filters, or detail state;
- provide an Overview entry that lists the static inventory without claiming
  runtime health; and
- produce the independently versioned static preview artifact and usage docs.

### Exit gate

The complete catalog and all standalone entries pass structural, path,
direct-open, router, target-isolation, and renderer-synchronization gates. No
dynamic Control Plane capability is claimed or required.

## `v0.1.0-preview` Release Contract

The static preview may be announced with Asyra Framework only when:

- all Phase 0–2 exit gates pass;
- implementation remains under `tools/flow-inspector/workspace/`;
- the catalog includes every current-project Inspector and excludes historical
  records according to the frozen rule;
- Framework, App, and reusable Release Inspectors are represented;
- all existing standalone Inspector entries continue to work;
- documentation labels the preview static and lists every dynamic exclusion;
- Framework packages have no runtime dependency on the workspace;
- Framework publication can proceed if the preview is absent or delayed; and
- the exact preview artifact and release action receive normal explicit
  publication authorization.

## Stop Conditions

- inventory completeness depends only on an unvalidated manual list;
- catalog metadata becomes a second authority for target steps or routes;
- switching targets leaks previous Inspector data or presentation state;
- direct-open standalone entries must be removed or require a local server;
- implementation requires execution status, test mapping, CI, CLI/API, action
  buttons, permissions, or other future Control Plane concerns;
- Framework runtime or packages must depend on the workspace; or
- the preview would delay Framework release rather than ship independently.

## Estimated Duration

- Phase 0: 2–3 focused working days.
- Phase 1: 3–5 focused working days.
- Phase 2: 3–5 focused working days, depending on current inventory corrections.
- Expected total: approximately 2–3 weeks including preview hardening.

Estimates are planning ranges, not delivery commitments.

## References

- [Workflow Control Plane Roadmap](flow-inspector-workflow-control-plane-roadmap.md)
- [Flow Inspector contract](../FLOW_INSPECTOR.md)
- [Framework Workflow](../../../framework/WORKFLOW.md)
- [Inspector contract readiness](../../../framework/rules/inspector-contract-readiness.md)
