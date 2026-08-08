---
name: plan-done-closeout
description: Close a completed framework/app plan by updating concise plan state, moving plan records to completed, appending decision history, and enforcing the required pre-merge Changeset record. Use when user says a plan is DONE and asks for closeout.
---

# Skill: plan-done-closeout

## Trigger Signals

Use this skill when requests include:

- "plan is done"
- "close this plan"
- "move done plan to completed"
- "update decision history for this plan"

## Do Not Use When

- Plan implementation is still in progress.
- User explicitly asks to keep plan in active/deferred state.

## Required Inputs

- Target plan identifier/path.
- Scope (`framework` or app path).
- Completion date (or use current date if not provided).
- Pull-request base ref or commit for Changeset validation.
- Optional Changeset skip flag; accept only `changeset-skip:docs-only` or
  `changeset-skip:hotfix`.

## Preflight

1. Confirm plan scope and owner docs (`docs/ai/framework/*` or `docs/ai/apps/*`).
2. Locate active plan entry in `PLANS.md` and detailed plan file path.
3. Locate decision log target (`decisions/releases/unreleased.md` in matching scope).
4. Inspect the complete PR diff against its base and identify every releasable
   public workspace materially changed by the PR.
5. Inspect pending `.changeset/*.md` files, excluding `.changeset/README.md`.

## Deterministic Procedure

1. Update plan state with useful-only information:

- Keep short completion statement.
- Keep one concise outcome summary.
- Keep canonical reference path.

2. Move DONE plan record to completed folder:

- Move/rename detailed plan to `plans/completed/`.
- Ensure active plans list no longer points to non-completed location.
- Keep completion date + final decision + implementation summary + exit criteria.

3. Append decision history entry:

- Add one new dated entry (append-only).
- Capture context, decision, consequences, and related completed-plan path.
- If old interim decision is superseded, state superseded relationship without deleting history.

4. Create the closeout Changeset only after every preceding closeout edit and
   required validation is complete:

- For a PR that materially changes one or more releasable public workspaces,
  create one ordinary pending Changeset covering every affected releasable
  workspace with the semver bump justified by the change.
- For a non-documentation PR that changes no releasable public workspace,
  create one empty Changeset with `yarn changeset --empty` so the update still
  has a closeout record without versioning a private or root workspace.
- Use the canonical `yarn changeset` command. Do not use the exceptional
  all-package Changeset generator for ordinary closeout.
- Review the generated Markdown, then run `yarn changeset status --since
  <base-ref>` and confirm the pending record belongs to the current PR diff.

5. Apply a skip flag only for these explicit exceptions:

- `changeset-skip:docs-only`: allow only when every changed file is
  documentation. Reject the flag if code, tests, configuration, generated
  output, package metadata, or workflow behavior also changed.
- `changeset-skip:hotfix`: allow only for a specifically identified hotfix
  whose Changeset omission the user explicitly authorized. Record the hotfix
  reason and authorization in the closeout output and PR description.
- Treat the two skip flags as mutually exclusive. A skip flag is an exception
  record, not a default for private-app or tooling changes.

6. Enforce the merge gate:

- Do not report the PR as merge-ready and do not merge when the PR has neither
  a pending Changeset nor one valid skip flag.
- Treat a missing, invalid, or unjustified Changeset record as `BLOCKED` even
  when every other closeout check passes.

## Validation Matrix

- `PLANS.md` has no stale active reference to the completed plan file.
- Completed plan file exists in `plans/completed/` and includes completion metadata.
- Decision log has a new append-only entry with correct date and plan link.
- File paths in references resolve.
- PR has a reviewed pending Changeset created after closeout, or exactly one
  valid skip flag with its required evidence.
- `yarn changeset status --since <base-ref>` succeeds when a Changeset is
  required.
- Merge readiness is blocked when the Changeset requirement is unsatisfied.

## Required Output Format

1. `Plan State Updated`
2. `Completed Plan Record`
3. `Decision History Updated`
4. `Changeset Record`
5. `Validation`

## Guardrails

- Keep plan status updates concise; avoid rewriting historical details unrelated to this completion.
- Never edit/delete old decision entries; only append.
- Keep references absolute within repo doc tree (no ambiguous shorthand).
- Never use a Changeset to version root `asyra` or a private workspace merely
  to satisfy this gate; use an empty Changeset when the PR otherwise requires
  a record but has no releasable public workspace.
- Never create the closeout Changeset before the implementation, documentation,
  and required gates are complete.
- Local commits may close completed, validated steps/stages; never push unless
  the user explicitly requests the remote operation. Follow
  `docs/ai/workflows/git-commit-push-policy.md`.

## Failure Policy

If plan file path is missing or ambiguous:

- report the missing path clearly
- add a TODO marker in plan index only if user approves
- stop before writing decision entry to avoid broken references
