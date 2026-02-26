# Rule: Generated Artifacts

1. `create-app/*` is generated output
- Do not edit files under `create-app/` directly as part of framework/app implementation work.

2. Source-of-truth first
- Implement changes in source packages/apps (for example `packages/*`, `apps/*`, scripts/templates source).
- Regenerate `create-app/*` via the project generation/release scripts after source changes.

3. PR/Review safety
- If `create-app/*` changes are present, they should be explained as generated sync output.
- Reject manual-only edits in `create-app/*` that are not traceable to source changes.

4. Template sync command (explicit)
- Use `scripts/release-template.js` through root scripts:
  - `yarn release:app --prod=<app-name>`
  - optional: `yarn release:app:verbose --prod=<app-name>`
- Run this when the task explicitly includes template synchronization, or before publishing a new version that must include updated `create-app/*` templates.
- For normal feature/refactor tasks, avoid touching `create-app/*`.
