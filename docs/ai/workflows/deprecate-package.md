# /deprecate-package Workflow

## Intent

Deprecate a package/API with explicit compatibility and replacement path.

## Required Inputs

1. target package/API
2. replacement owner/path
3. deprecation scope

## Reference Docs

- `docs/ai/framework/rules/deprecation-lifecycle.md`
- `docs/ai/framework/API_SURFACES.md`
- `docs/ai/framework/packages/*`
- `docs/ai/framework/WORKFLOW.md`

## Execution

1. derive deprecation contract from rules
2. implement markers and compatibility handling
3. block new ownership in deprecated path
4. sync deprecation status docs

## Output

Use shared output contract in `docs/ai/workflows/README.md`.
