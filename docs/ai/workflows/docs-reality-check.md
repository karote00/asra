# /docs-reality-check Workflow

## Intent

Audit implementation-vs-doc drift and resolve it.

## Required Inputs

1. scope (framework/app/both)
2. code area to verify
3. mode (report-only or report+fix)

## Reference Docs

- `docs/ai/framework/*`
- `docs/ai/apps/asyra-design/*`
- `docs/ai/framework/WORKFLOW.md`
- `docs/ai/apps/asyra-design/WORKFLOW.md`

## Execution

1. map claimed contracts to implementation
2. classify drift by severity
3. apply direct fixes if mode includes fixes
4. validate paths/contracts consistency

## Output

Use shared output contract in `docs/ai/workflows/README.md`.
