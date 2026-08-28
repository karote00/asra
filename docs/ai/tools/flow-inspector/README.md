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

Flow Inspector currently includes a static, read-only architecture viewer at
`tools/flow-inspector/`. The first integrated workspace will live at
`tools/flow-inspector/workspace/` and provide one sidebar-driven static surface
for current Inspectors. A later control plane will live at
`tools/flow-inspector/control-plane/` and add evidence-backed workflow state,
CI comparison, machine interfaces, and typed actions without changing the
static Inspector's schema version 2 contract.

The tool may inspect Framework and App contracts, but neither Framework nor an
App may depend on the tool at runtime. Tool publication and versioning remain
independent from Framework package Changesets and publication.

## Documentation Structure

- `FLOW_INSPECTOR.md` — current static Inspector contract.
- `PLANS.md` — active and future Flow Inspector planning index.
- `plans/` — detailed roadmap and phase plans.
- Future active implementation may add tool-owned `ARCHITECTURE.md`,
  `WORKFLOW.md`, `API_SURFACES.md`, `rules/`, `decisions/`, and tests following
  the established Framework/App context pattern.

## Inherited Rules

Flow Inspector work inherits project-wide hard rules under
`docs/ai/framework/rules/*`.
