# /refactor Workflow

## Intent

Improve structure/maintainability/performance while preserving intended behavior.

## Routing

- If runtime ownership/architecture shifts significantly, consider `/runtime-refactor`.
- If only app feature behavior changes, prefer `/app-feature`.

## Required Inputs

1. refactor goal
2. behavior invariants to preserve
3. scope (framework/app/cross-cutting)

## Reference Docs

Load by scope:

- framework source-of-truth: `docs/ai/framework/*`
- app source-of-truth: `docs/ai/apps/asyra-design/*`
- execution process:
  - `docs/ai/framework/WORKFLOW.md`
  - `docs/ai/apps/asyra-design/WORKFLOW.md`

## Execution

1. define preserved contracts/invariants from references
2. map current ownership and boundaries from references
3. apply thin, reversible slices
4. run scoped regression validation from reference workflows
5. sync docs if contracts or ownership changed

## Output

Use shared output contract in `docs/ai/workflows/README.md`.
