# /plan-done-closeout Workflow

## Intent

Finalize a DONE plan with deterministic closeout records.

## Required Inputs

1. plan path/name
2. scope (`framework` or app)
3. completion date (optional, defaults to current date)

## Reference Docs

- `docs/ai/framework/PLANS.md` or app plan index
- `docs/ai/framework/plans/completed/README.md`
- `docs/ai/framework/decisions/releases/unreleased.md` (or app counterpart)
- `docs/ai/workflows/README.md`
- `docs/ai/skills/plan-done-closeout/SKILL.md`

## Execution

1. update plan index state with useful-only completion information
2. move/record DONE plan under `plans/completed/` with completion summary
3. append one decision-history entry linking the completed plan
4. validate links/paths and remove stale active-plan references
5. keep release iteration separate from closeout: do not create, inspect,
   validate, or require a pending Changeset
6. do not infer or materialize any Framework, root, private app, create-app
   CLI, or generated-template version from the closeout record
7. when a completed plan owns a release, summarize the already verified public
   result without creating another version, tag, or publication side effect

## Output

Use shared output contract in `docs/ai/workflows/README.md`.
