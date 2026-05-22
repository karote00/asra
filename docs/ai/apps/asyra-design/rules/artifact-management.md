# Rule: Artifact Management

Asyra Design artifacts must be classified before staging.

## Committed Artifacts

Only commit artifacts that are durable evidence:

- curated product/Figma reference evidence used to define behavior
- small fixtures consumed by tests
- concise diagnostic summaries linked from a plan, inspector, rule, or release decision
- final evidence intentionally stored in an `artifacts/committed/` folder

Committed artifacts must be named by scenario or rule, not by local iteration
number alone, and must be linked from the owning document or test.

## Transient Artifacts

Do not commit local diagnostic artifacts:

- `apps/*/test-results/`
- `apps/*/playwright-report/`
- generated screenshots, videos, traces, crops, and temporary JSON dumps
- repeated local experiment folders such as `*-v1`, `*-latest`, `*-check`, or
  `*-diagnosis`

Write these under ignored folders:

- `docs/ai/apps/<app>/plans/<plan>/artifacts/transient/`
- `docs/ai/apps/<app>/plans/<plan>/artifacts/tmp/`
- `docs/ai/apps/<app>/plans/<plan>/artifacts/local/`
- `docs/ai/apps/<app>/plans/<plan>/artifacts/debug/`

## Git Discipline

- Use a new cleanup commit for artifact mistakes after a commit has been made.
- Do not rewrite local commit history unless the user explicitly asks for it.
- Before committing, inspect `git status --short` and staged artifact paths.
- If an artifact is needed for review but not as durable evidence, keep it
  untracked in the transient folder and summarize the result in the final
  response.
