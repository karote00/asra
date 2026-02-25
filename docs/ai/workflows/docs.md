# /docs Workflow

## Intent

Create or update documentation contracts.

## Routing

- If implementation drift exists, prefer `/docs-reality-check`.
- If docs are coupled with behavior/API change, run this workflow in same change.

## Required Inputs

1. documentation task
2. scope (framework/app/both)
3. target audience

## Reference Docs

Load by scope:

- framework source-of-truth: `docs/ai/framework/*`
- app source-of-truth: `docs/ai/apps/asyra-design/*`
- docs process anchors:
  - `docs/ai/framework/WORKFLOW.md`
  - `docs/ai/apps/asyra-design/WORKFLOW.md`

## Execution

1. identify contract type to update (API/behavior/ownership/requirements)
2. update only source-of-truth docs that own the contract
3. remove contradictions and stale references
4. validate paths and cross-doc consistency

## Output

Use shared output contract in `docs/ai/workflows/README.md`.
