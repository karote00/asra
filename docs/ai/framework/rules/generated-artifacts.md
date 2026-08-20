# Rule: Generated Artifacts

1. `create-app/<app>/template` is generated output

- Do not edit files under a generated template directly as part of
  framework/app implementation work.
- The surrounding CLI manifest, executable, tests, and documentation are
  directly maintained CLI source and are not generated-output owners.

2. Source-of-truth first

- Implement changes in source packages/apps or a CLI-owned scaffold source (for
  example `packages/*`, `apps/*`, or `create-app/<app>/source`). A CLI-owned
  scaffold source is not a canonical App or workspace product.
- Regenerate `create-app/<app>/template` via the project generation/release
  scripts after source changes.

3. PR/Review safety

- If `create-app/<app>/template` changes are present, they should be explained
  as generated sync output.
- Reject manual-only edits in a generated template that are not traceable to
  source changes. This restriction does not apply to CLI-owned source above the
  template.

4. Template sync command (explicit)

- Use `scripts/release-template.js` through root scripts:
  - `yarn release:app --prod=<app-name>`
  - optional: `yarn release:app:verbose --prod=<app-name>`
- Verify synchronization without changing the committed template:
  - `yarn release:app:check --prod=<app-name>`
- Run this when the task explicitly includes template synchronization, or
  before publishing a new version that must include updated
  `create-app/<app>/template` content.
- For normal feature/refactor tasks, avoid touching generated template content.
- `release:app:check` generates under project-local `tmp/`, compares file
  contents while excluding build/test outputs and dot-prefixed local runtime
  data directories matching `.*-data`, and removes its temporary output on
  exit.

## Evidence And Test Artifacts

Generated evidence must be classified before it is staged.

### Commit-eligible artifacts

Commit artifacts only when they are part of the durable project record:

- curated reference evidence that documents a product rule
- small, intentionally named fixture data used by automated tests
- concise diagnostic summaries that are referenced by an active plan, inspector, decision record, or release note
- active-plan artifacts placed under an explicit `artifacts/committed/` folder, or legacy tracked artifacts that already exist as decision evidence

Commit-eligible artifacts must be reviewable, bounded in size, and linked from the owning documentation or test.

### Transient artifacts

Do not commit transient artifacts:

- Playwright `test-results/` and `playwright-report/`
- local browser screenshots, videos, traces, and ad hoc debug captures
- app visual review screenshots and metadata unless they are explicitly promoted by an active plan or user request
- repeated iteration folders such as `*-v1`, `*-v2`, `*-latest`, or local diagnosis dumps
- temporary JSON/PNG outputs that are not directly consumed by tests or documentation

Transient outputs should be written under an ignored folder such as:

- `apps/<app>/test-results/`
- `apps/<app>/playwright-report/`
- `docs/ai/apps/<app>/plans/<plan>/artifacts/transient/`
- `docs/ai/apps/<app>/plans/<plan>/artifacts/tmp/`
- `docs/ai/apps/<app>/plans/<plan>/artifacts/local/`
- `docs/ai/apps/<app>/plans/<plan>/artifacts/debug/`

### Git discipline

- Do not rewrite an existing local commit to remove artifacts unless the user explicitly asks for history rewrite.
- Prefer a new cleanup commit when a previously created commit needs artifact correction.
- Before commit, run `git status --short` and inspect staged files for artifact paths.
- If a transient artifact was accidentally staged, unstage and remove or restore it before committing.
