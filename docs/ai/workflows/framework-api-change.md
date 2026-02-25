# /framework-api-change Workflow

## Intent

Change framework API surfaces or facade exports.

## Required Inputs

1. target API/scope
2. contract delta
3. compatibility expectation

## Reference Docs

- `docs/ai/framework/API_SURFACES.md`
- `docs/ai/framework/packages/*`
- `docs/ai/framework/CODING_STANDARDS.md`
- `docs/ai/framework/WORKFLOW.md`

## Execution

1. define API contract delta from references
2. confirm ownership and facade impact from references
3. implement minimal API/facade changes
4. run scoped validation from framework workflow
5. sync framework docs that own the changed contract

## Output

Use shared output contract in `docs/ai/workflows/README.md`.
