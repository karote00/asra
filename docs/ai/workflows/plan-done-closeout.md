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
- `docs/ai/framework/rules/release-version-topology.md`
- `.changeset/config.json`

## Execution

1. update plan index state with useful-only completion information
2. move/record DONE plan under `plans/completed/` with completion summary
3. append one decision-history entry linking the completed plan
4. validate links/paths and remove stale active-plan references
5. after every other closeout edit and gate passes, create and review the one
   required Changeset record; release entries may contain only fixed-allowlist
   Framework packages under `packages/*`, while root, private app, create-app
   CLI, generated-template, and other changes use an empty Changeset; then run
   `yarn changeset status --since <base-ref>`
6. block merge readiness when the Changeset is absent unless the PR carries
   exactly one valid `changeset-skip:docs-only` or
   `changeset-skip:hotfix` flag under the skill's exception contract
7. never infer or materialize a root or create-app CLI version from the
   closeout record; those owners follow the manual authorization and ordering
   contract in `release-version-topology.md`

## Output

Use shared output contract in `docs/ai/workflows/README.md`.
