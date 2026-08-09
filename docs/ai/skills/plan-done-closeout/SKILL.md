---
name: plan-done-closeout
description: Close a completed framework/app plan by updating concise plan state, moving plan records to completed, and appending decision history. Use when user says a plan is DONE and asks for closeout.
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

## Preflight

1. Confirm plan scope and owner docs (`docs/ai/framework/*` or `docs/ai/apps/*`).
2. Locate active plan entry in `PLANS.md` and detailed plan file path.
3. Locate decision log target (`decisions/releases/unreleased.md` in matching scope).
4. Confirm the plan's required completion evidence and final decision.

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

4. Keep release iteration separate from closeout:

- Do not create, inspect, validate, or require a pending Changeset during
  closeout.
- A feature branch may have created, materialized, consumed, and published
  multiple Changesets while it was being refined and tested. Closeout must not
  manufacture another release record or patch solely because those Changesets
  are no longer pending.
- Do not bump or infer any Framework, root, private app, CLI, or generated
  template version during closeout.
- When the completed plan owns a release, record the already verified public
  result in the completion summary without reopening the release workflow.

## Validation Matrix

- `PLANS.md` has no stale active reference to the completed plan file.
- Completed plan file exists in `plans/completed/` and includes completion metadata.
- Decision log has a new append-only entry with correct date and plan link.
- File paths in references resolve.
- Closeout creates no Changeset, version bump, tag, or publication side effect.

## Required Output Format

1. `Plan State Updated`
2. `Completed Plan Record`
3. `Decision History Updated`
4. `Release Boundary`
5. `Validation`

## Guardrails

- Keep plan status updates concise; avoid rewriting historical details unrelated to this completion.
- Never edit/delete old decision entries; only append.
- Keep references absolute within repo doc tree (no ambiguous shorthand).
- Never use closeout as authority to create a Changeset, change a version,
  create a tag, or publish a package.
- Local commits may close completed, validated steps/stages; never push unless
  the user explicitly requests the remote operation. Follow
  `docs/ai/workflows/git-commit-push-policy.md`.

## Failure Policy

If plan file path is missing or ambiguous:

- report the missing path clearly
- add a TODO marker in plan index only if user approves
- stop before writing decision entry to avoid broken references
