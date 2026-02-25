# /runtime-refactor Workflow

## Intent

Refactor runtime ownership/flow while preserving intended behavior.

## Required Inputs

1. target runtime area
2. preserved invariants
3. compatibility constraints

## Reference Docs

- `docs/ai/framework/ARCHITECTURE.md`
- `docs/ai/framework/design-principles/*`
- `docs/ai/framework/RUNTIME_MATRICES.md`
- `docs/ai/framework/WORKFLOW.md`

## Execution

1. map current vs target ownership from references
2. plan thin migration slices with compatibility
3. implement slices and validate invariants
4. sync runtime/ownership docs

## Output

Use shared output contract in `docs/ai/workflows/README.md`.
