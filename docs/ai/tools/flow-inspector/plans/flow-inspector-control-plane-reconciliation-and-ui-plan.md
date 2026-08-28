# Flow Inspector Control Plane Reconciliation and UI Plan

## Status

Deferred until the Core Preview Plan completes. This plan covers Phase 3 and
Phase 4 and is not part of the `v0.1.0-preview` companion release.

## Objective

Make control-plane status robust under test and source evolution, then expose
the same trustworthy state and actions through one workspace-level Web UI.

## Entry Criteria

- Phase 0–2 Core Preview gates are complete.
- JSON, CLI, and API expose one deterministic state truth.
- Focused actions are typed, bounded, permission-shaped, and audited.
- Preview usage has produced real mapping-drift and freshness cases to specify.

## Phase 3 — Reconciliation and Complete Freshness

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

## Phase 4 — Workspace Server and Web UI

- run one local workspace service for multiple panels;
- render graph routes, node status, causes, provenance, evidence, artifacts,
  execution progress, and cross-panel impact;
- expose only registry-backed actions;
- provide mapping-candidate review and reconciliation;
- reload configuration and result state without broad automatic test runs; and
- prove that UI, CLI, and API present the same canonical state.

The first UI prioritizes legibility and operational usefulness. Cinematic
visual polish, hosted collaboration, and a plugin marketplace are not required.

## Definition of Done

- formal drift cases cover rename, move, change, split, merge, deletion, and
  unknown evidence;
- candidate generation is deterministic enough to explain and never mutates
  formal intent automatically;
- cross-panel many-to-many propagation is correct;
- opening or switching panels cannot change canonical truth;
- UI actions use the same action registry, permission checks, execution
  lifecycle, ingestion, and audit path as CLI/API; and
- representative human and AI workflows demonstrate reduced repo discovery
  and unnecessary broad test runs.

## Stop Conditions

- candidate confidence is treated as authorization to change formal mapping.
- UI introduces a second status or action owner.
- watchers continuously rerun broad test suites.
- completion requires Git mutation, CI release gates, or external adapters
  reserved for the next plan.

## Estimated Duration

Approximately 3–5 weeks after the Core Preview is accepted.

## References

- [Workflow Control Plane Roadmap](flow-inspector-workflow-control-plane-roadmap.md)
- [Phase 0–2 Core Preview Plan](flow-inspector-control-plane-core-preview-plan.md)
