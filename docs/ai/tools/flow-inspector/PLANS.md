Never record completed plans here.

# Flow Inspector Plans

This file tracks active and future work for the Flow Inspector tool family.
The product direction was revised on 2026-09-07: materialize a Plan as concrete
implementation steps and executable flow contracts to manage human and AI
development risk. Open-source usefulness, reproducibility, and controlled
delegation are the success criteria.

## Active Target

No active implementation target. This revision updates planning only. Dynamic
Control Plane implementation remains deferred until a bounded activation
selects the proof flows, product specification, exact architecture Inspector,
behavioral cases, owner boundaries, runner/CI policy, and required gates.

## Next Implementation Candidate

1. [Contract Verification and CI Plan](plans/flow-inspector-control-plane-evidence-and-ci-plan.md)
   - Phase 3: two related real flows, preflight checks, behavioral conformance,
     negative proofs, and minimal controlled actions with attributable evidence.
   - Phase 4: an operational step board, common API/CLI, contract evolution,
     mandatory all-flow CI within the declared supported set, and shared viewing.
   - First checkpoint: a shared-owner change breaks a retained flow, the real
     gate rejects it at the correct step, and a conforming correction passes.

## Dependent Implementation Candidate

2. [Agent Execution and Integrations Plan](plans/flow-inspector-control-plane-actions-and-integrations-plan.md)
   - Phase 5: enforceable agent task scope, capabilities, resource limits,
     progress checks, stopping, recovery, and handoff.
   - Phase 6: small-team operations, selected ticket/PR integrations, hardening,
     and reproducible open-source adoption.
   - Entry depends on the preceding conformance/action/CI foundation, not on
     agent controls or integrations that this plan has yet to implement.

Both existing plan filenames remain stable. No schema, runtime, package,
dependency, license, or publication change is implied by the planning revision.

## Roadmap and Baseline References

- [Workflow Control Plane Roadmap](plans/flow-inspector-workflow-control-plane-roadmap.md)
  owns cross-phase direction, boundaries, activation decisions, and provisional
  effort ranges. The phase plans own their delivery cases and DoD.
- [Static Workspace 0.2.0 record](plans/completed/flow-inspector-static-workspace-0.2.0-closure-plan.md)
  records the completed Phase 0-2 baseline; its static-only contract remains
  unchanged.
