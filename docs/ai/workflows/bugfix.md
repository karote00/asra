# /bugfix Workflow

## Intent

Fix incorrect behavior with minimal safe change and prevent regression.

## Routing

- If bug is a docs/code contract mismatch, combine with `/docs-reality-check`.
- If bug exposes runtime ownership problem, combine with `/runtime-refactor` as needed.
- If bug is geometry/clipping related, combine with `/geometry-clipping-bugfix`.

## Required Inputs

1. bug statement
2. reproduction steps
3. expected behavior
4. scope (framework/app/cross-cutting)

## Reference Docs

Load by scope:

- framework source-of-truth: `docs/ai/framework/*`
- app source-of-truth: `docs/ai/apps/asyra-design/*`
- execution process:
  - `docs/ai/framework/WORKFLOW.md`
  - `docs/ai/apps/asyra-design/WORKFLOW.md`

## Execution

1. reproduce and capture baseline
2. derive expected contract from references
3. apply minimal fix at correct owner boundary
4. validate reproduction is fixed and adjacent behavior is stable
5. sync docs if behavior contract changed

## Output

Use shared output contract in `docs/ai/workflows/README.md`.
