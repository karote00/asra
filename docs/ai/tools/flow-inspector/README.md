# Flow Inspector Tool Context

This folder owns documentation for the project-owned Flow Inspector tool
family.

## Read Order

1. `FLOW_INSPECTOR.md`
2. `PLANS.md`
3. relevant files under `plans/`
4. future tool-specific architecture, workflow, rules, and decision history as
   those contracts are activated

## Scope

Flow Inspector includes a static, read-only architecture viewer and a React
workspace at `tools/flow-inspector/workspace/`. The workspace provides one
sidebar-driven surface for all current-project Inspectors while retaining
direct-open standalone HTML compatibility. The bounded local
[Core Proof](CORE_PROOF.md) at `tools/flow-inspector/control-plane/` adds real
Factory flow verification, snapshot-bound evidence, controlled actions, and a
step board. Full CI comparison, agent execution, and integrations remain in the
phase plans. The static Inspector's schema version 2 contract is unchanged.

The tool may inspect Framework and App contracts, but neither Framework nor an
App may depend on the tool at runtime. Tool publication and versioning remain
independent from Framework package Changesets and publication.

All Inspector data, standalone HTML, and Inspector contract tests are owned by
`tools/flow-inspector/inspectors/`. Framework and App documentation remains the
semantic authority referenced by those artifacts; their `plans/` directories
do not store Inspector implementation artifacts.

## Documentation Structure

- `FLOW_INSPECTOR.md` - current static Inspector contract.
- `PLANS.md` - active, completed, and future Flow Inspector planning index.
- `CORE_PROOF.md` - first bounded dynamic verification contract and completion cases.
- `plans/` - detailed roadmap and active phase plans.
- `plans/completed/` - completed plan records.
- `decisions/releases/` - append-only tool release decision history.
- Future active implementation may add tool-owned `ARCHITECTURE.md`,
  `WORKFLOW.md`, `API_SURFACES.md`, and `rules/` following the established
  Framework/App context pattern.

## Inherited Rules

Flow Inspector work inherits project-wide hard rules under
`docs/ai/framework/rules/*`.
