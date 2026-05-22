# Stroke Engine Artifacts

This folder is split by artifact intent.

## Commit-eligible

Use `artifacts/committed/` for durable evidence only:

- curated reference evidence used to define a Figma-like rule
- small fixture data required by automated tests
- concise summaries linked from the active inspector, README, or decision history
- final review evidence that is intentionally kept as part of the plan record

Files in `committed/` must be small enough to review and must be referenced by
the owning document or test. Do not put repeated iteration dumps here.

Legacy files already tracked directly under `artifacts/` are historical
evidence. Do not move or rewrite them just to adopt this folder split unless the
plan explicitly calls for archival cleanup.

## Not Commit-eligible

Use `artifacts/transient/` for local diagnostic output:

- Playwright copies
- local screenshots and crops
- temporary metadata JSON
- repeated fix/check folders
- manual visual-debug outputs

`artifacts/transient/` is ignored by Git. Anything generated there should be
treated as disposable unless it is later curated, renamed, moved to
`artifacts/committed/`, and linked from the active plan or a test.

## Commit Rule

Before committing stroke work:

1. run `git status --short`
2. inspect staged files for `artifacts/`
3. keep only source, tests, active docs, and curated `artifacts/committed/`
4. leave transient artifacts untracked/ignored
5. use a new cleanup commit if artifact correction is needed after a commit;
   do not rewrite commit history unless explicitly requested
