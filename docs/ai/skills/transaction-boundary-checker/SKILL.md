---
name: transaction-boundary-checker
description: Enforce one intended user action to one intended undo commit by auditing write timelines and transaction boundaries. Use when requests mention undo split/missing commits or transaction regressions.
---

# Skill: transaction-boundary-checker

## Trigger Signals

Use this skill when requests include:

- "undo/redo split"
- "multiple commits"
- "transaction"
- "one action one commit"

## Do Not Use When

- Request has no model mutations.
- Request is read-only query optimization.

## Required Inputs

- Action flow under investigation.
- Mutating APIs/features in scope.
- Rule source:
  - `docs/ai/framework/rules/data-flow-and-transactions.md`

## Preflight

1. Map each write call in the action path.
2. Mark where transaction starts/ends today.
3. Capture current expected undo behavior from docs or user note.

## Deterministic Procedure

1. Build mutation timeline for one user action.
2. Detect violations:

- writes before `startTransaction`
- writes after `endTransaction`
- accidental nested action splits

3. Move boundaries to match intended action unit.
4. Keep mutation operations inside app/common API boundary.
5. Ensure session-driven actions do not fragment commits unintentionally.

## Validation Matrix

- One intended user action => one intended commit.
- Undo reverses full action, not partial slices.
- Redo restores full action.

## Required Output Format

1. `Write Timeline`

- ordered list of writes per action

2. `Boundary Fix`

- old boundary vs new boundary

3. `Validation`

- manual/automated undo-redo checks

4. `Residual Risks`

- edge cases not covered yet

## Guardrails

- Do not add transaction wrappers in random UI handlers.
- Prefer central mutation APIs for boundary ownership.
- Local commits may close completed, validated steps/stages; never push unless
  the user explicitly requests the remote operation. Follow
  `docs/ai/workflows/git-commit-push-policy.md`.

## Failure Policy

If action unit is ambiguous:

- keep behavior stable
- provide 2 boundary options with concrete undo outcomes
