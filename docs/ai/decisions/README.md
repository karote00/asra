# Global Decision History Standard

This directory defines one decision-history standard for the whole repo.

## Scope Model

Decision history is tracked per scope:

1. Framework scope
- `docs/ai/framework/decisions/releases/*`

2. App scope
- `docs/ai/apps/<app>/decisions/releases/*`

3. Cross-cutting scope (repo-wide)
- `docs/ai/decisions/releases/*`
- Use when a decision affects both framework and app(s), or multiple apps.

## Lifecycle

1. During development
- Append entries to `unreleased.md` in the correct scope.

2. At release cut
- Copy/move scope `unreleased.md` to a release snapshot file (for example `vX.Y.Z.md`).
- Clear `unreleased.md` for next-cycle entries.

## History Contract

Decision history is append-only.

- Do not edit or delete previously recorded entries.
- If a decision changes, add a new entry that supersedes the old one and references it.
- Released snapshot files are immutable.

## Date Contract

- Use actual decision dates when known.
- For historical backfill, infer from related commit dates and mark as inferred.
- Bootstrap exception: before the first commit of a new scope stream, entries may be reordered by actual date for clean initial history.

## Decision Quality Bar (Short)

Record a decision when at least one is true:

1. Changes architecture/ownership/runtime boundary.
2. Introduces or removes public API contracts.
3. Alters transaction, persistence, event, or validation semantics.
4. Creates migration/deprecation impact.
5. Resolves a tradeoff likely to be revisited.

Do not record:

1. Formatting/rename-only/lint-only changes.
2. Local mechanical changes with no contract impact.

When in doubt, add a short entry.
