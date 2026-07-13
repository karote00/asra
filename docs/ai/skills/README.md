# Skills

This folder is the project source-of-truth for reusable AI skills.

## What A Skill Must Contain

Every `SKILL.md` must define these sections:

1. Trigger Signals
2. Do Not Use When
3. Required Inputs
4. Preflight
5. Deterministic Procedure
6. Validation Matrix
7. Required Output Format
8. Guardrails
9. Failure Policy

Skills should be strict enough that two agents produce nearly the same process/output for the same request.

## Available Skills

- `framework-import-boundary-auditor/SKILL.md`
- `feature-authoring-guard/SKILL.md`
- `transaction-boundary-checker/SKILL.md`
- `constants-registry-manager/SKILL.md`
- `deprecation-lifecycle-enforcer/SKILL.md`
- `render-layer-registration-checker/SKILL.md`
- `app-visual-review-sync/SKILL.md`
- `props-schema-validation-guard/SKILL.md`
- `docs-contract-sync/SKILL.md`
- `plan-done-closeout/SKILL.md`
- `unit-failure-visual-replay/SKILL.md`

## Runtime vs Docs

- This repo folder is documentation and collaboration source-of-truth.
- To run skills in Codex runtime, install/copy to:
  - `~/.codex/skills/<skill-name>/SKILL.md`

## Related Docs

- `docs/ai/framework/*`
- `docs/ai/apps/asyra-design/*`
