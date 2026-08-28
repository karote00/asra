# Flow Inspector Control Plane Evidence and CI Plan

## Status

Deferred until the Static Workspace Preview Plan completes. This plan begins
the dynamic Control Plane and is not part of the static `v0.1.0-preview`
companion release.

## Objective

Make control-plane status robust under test and source evolution, then expose
the same trustworthy state and actions through one workspace-level Web UI.

## Entry Criteria

- Static Workspace Phase 0–2 gates are complete.
- Every current-project Inspector has a stable catalog identity and can be
  loaded through the shared workspace.
- Preview usage has confirmed which active and reusable release Inspectors
  require dynamic evidence and CI enforcement.

## Phase 3 — Evidence, Status, and Reconciliation

- define test/evidence registry and node-evidence mappings;
- ingest provenance-bearing results and derive dynamic node status;
- detect test rename, move, content change, split, merge, missing selector, and
  newly observed evidence;
- produce confidence-bearing mapping candidates without modifying formal
  mappings;
- support explicit accept/reject/reconcile actions with complete audit history;
- add `needs-review` and complete `blocked` derivation;
- propagate evidence changes across every linked node and panel;
- implement the accepted dependency- and configuration-aware freshness model;
  and
- prevent ambiguous, stale, or unmapped observations from producing a trusted
  passed state.

## Phase 4 — CI Enforcement and Dynamic Workspace UI

- add the local service, API/CLI, and dynamic state projection;
- render graph routes, node status, causes, provenance, evidence, artifacts,
  and cross-panel impact in the existing workspace shell;
- provide mapping-candidate review and reconciliation;
- reload configuration and result state without broad automatic test runs; and
- prove that UI, CLI, API, and CI present the same canonical state.

The first UI prioritizes legibility and operational usefulness. Cinematic
visual polish, hosted collaboration, and a plugin marketplace are not required.

## Definition of Done

- formal drift cases cover rename, move, change, split, merge, deletion, and
  unknown evidence;
- candidate generation is deterministic enough to explain and never mutates
  formal intent automatically;
- cross-panel many-to-many propagation is correct;
- opening or switching panels cannot change canonical truth;
- dynamic UI and CI consume the same evidence, freshness, and status authority;
  and
- representative human and AI workflows demonstrate reduced repo discovery
  and unnecessary broad test runs.

## Stop Conditions

- candidate confidence is treated as authorization to change formal mapping.
- UI introduces a second status or action owner.
- watchers continuously rerun broad test suites.
- completion requires Git mutation, CI release gates, or external adapters
  reserved for the next plan.

## Estimated Duration

Approximately 4–7 weeks after the Static Workspace Preview is accepted.

## References

- [Workflow Control Plane Roadmap](flow-inspector-workflow-control-plane-roadmap.md)
- [Static Workspace Preview Plan](completed/flow-inspector-static-workspace-preview-plan.md)
