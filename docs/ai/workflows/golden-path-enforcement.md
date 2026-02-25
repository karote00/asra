# /golden-path-enforcement Workflow

## Intent

Audit and enforce conformance with framework/app golden paths.

## Required Inputs

1. audit scope
2. relevant golden paths
3. allowed exceptions

## Reference Docs

- `docs/ai/framework/golden-paths/*`
- `docs/ai/apps/asyra-design/golden-paths/*`
- `docs/ai/framework/WORKFLOW.md`
- `docs/ai/apps/asyra-design/WORKFLOW.md`

## Execution

1. map implementation against golden paths
2. identify non-conforming points
3. apply targeted fixes in owner boundaries
4. re-check conformance and document exceptions

## Output

Use shared output contract in `docs/ai/workflows/README.md`.
