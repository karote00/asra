# Release Decision History

This directory records framework decisions by release version.

Global history governance is defined in `docs/ai/decisions/README.md`.

## Files

1. `unreleased.md`
- Ongoing decision log for work not yet released.

2. `vX.Y.Z.md`
- Decision history snapshot for a released version.

## Lifecycle

1. During development:
- append decisions to `unreleased.md`.

2. When a plan is done:
- move the plan item into `docs/ai/framework/plans/completed/*`.
- add or update corresponding decision entry in `unreleased.md`.

3. At release cut:
- copy/move `unreleased.md` into `vX.Y.Z.md`.
- clear `unreleased.md` for next-cycle development.

## Immutability Rule (History Contract)

Decision history is append-only.

- Do not edit or delete previously recorded decision entries.
- Do not rewrite older rationale to match newer understanding.
- If context changes or a prior decision is wrong, add a new decision entry that supersedes the earlier one.
- In the new entry, reference the superseded entry by date/title and explain why the change was made.
- Released decision files (`vX.Y.Z.md`) are immutable snapshots and must not be modified.

## Entry Template

- Date
- Title
- Context
- Decision
- Consequences
- Related Plan
- Related Commit(s)

## Decision Quality Bar (Short)

Record a decision when at least one of the following is true:

1. Changes architecture, ownership, or runtime boundaries.
2. Introduces/removes public API contracts.
3. Alters transaction, persistence, event, or validation semantics.
4. Creates meaningful migration or deprecation impact.
5. Resolves a tradeoff that future contributors are likely to revisit.

Do not record as a decision when:

1. Change is purely mechanical (formatting, rename-only, lint-only).
2. Change is local with no contract or behavior impact.
3. Commit message/status updates carry enough context and no rationale is needed.

When uncertain:

1. Add a short entry with minimal context.
2. Prefer concise recording over omission if it may affect future reasoning.
