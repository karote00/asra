# /app-feature Workflow

## Intent

Implement app-level feature behavior.

## Required Inputs

1. feature goal
2. behavior acceptance criteria
3. trigger/input path

## Reference Docs

- `docs/ai/apps/asyra-design/APP_ESSENTIALS.md`
- `docs/ai/apps/asyra-design/API_SURFACES.md`
- `docs/ai/apps/asyra-design/rules/*`
- `docs/ai/apps/asyra-design/features/*`
- `docs/ai/apps/asyra-design/WORKFLOW.md`

## Execution

1. derive behavior contract from app docs
2. implement through app boundaries from app workflow
3. validate behavior via scoped checks
4. sync app docs that own the behavior contract

## Output

Use shared output contract in `docs/ai/workflows/README.md`.
