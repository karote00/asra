Never record completed plans here.

# Flow Inspector Plans

This file tracks active and future work for the Flow Inspector tool family.

## Active Target

1. Static Workspace `v0.1.0-preview` — Phase 0 through Phase 2

- Implement under `tools/flow-inspector/workspace/`, never under
  `packages/`.
- Integrate every current-project Inspector into one static workspace with a
  sidebar, search, dynamic routing, deep links, and a shared main viewer.
- Preserve existing schema version 2 target data and standalone HTML entries.
- Execution state, CI comparison, CLI/API, and command/action buttons are
  explicitly deferred to the future Control Plane.
- Ship only as an independently versioned optional companion in the current
  Asyra Framework release wave. It must not block or delay Framework package
  publication.
- Plan:
  `docs/ai/tools/flow-inspector/plans/flow-inspector-static-workspace-preview-plan.md`.

## Deferred Plans

1. Dynamic evidence, reconciliation, and CI — future Control Plane

- Plan:
  `docs/ai/tools/flow-inspector/plans/flow-inspector-control-plane-evidence-and-ci-plan.md`.

2. Actions, delivery, and integrations — future Control Plane

- Plan:
  `docs/ai/tools/flow-inspector/plans/flow-inspector-control-plane-actions-and-integrations-plan.md`.

## Roadmap Authority

- `docs/ai/tools/flow-inspector/plans/flow-inspector-workflow-control-plane-roadmap.md`.
