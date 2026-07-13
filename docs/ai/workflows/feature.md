# /feature Workflow

## Intent

Add new behavior/capability.

## Routing

- If framework-facing API/ownership changes are involved, prefer `/framework-api-change`.
- If app behavior only, prefer `/app-feature`.
- Otherwise use this workflow as generic feature entrypoint.

## Required Inputs

1. feature description
2. expected behavior and acceptance criteria
3. scope (framework/app/cross-cutting)

## Reference Docs

Load by scope:

- framework source-of-truth: `docs/ai/framework/*`
- app source-of-truth: `docs/ai/apps/asyra-design/*`
- execution process:
  - `docs/ai/framework/WORKFLOW.md`
  - `docs/ai/apps/asyra-design/WORKFLOW.md`

## Execution

1. define behavior contract from references
2. define ownership boundaries from references
3. implement in thin slices
4. run scoped validation from reference workflows
5. sync docs in same change

## Output

Use shared output contract in `docs/ai/workflows/README.md`.
