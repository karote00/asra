# Framework Decisions

This folder captures decision history separately from planning.

This scope follows the global standard in `docs/ai/decisions/README.md`.

- `PLANS.md` = what we plan to do.
- `plans/completed/*` = what got completed (grouped by category).
- `decisions/releases/*` = why decisions were made, grouped by release timeline.

For release-based decision flow, see `decisions/releases/README.md`.

History in this folder is append-only; prior decision entries are never edited or deleted.

## Why This Matters

Decision history is not just documentation; it is project memory.

1. Regression debugging
- Distinguish intended behavior from accidental regression quickly.

2. Faster code review
- Review against known rationale instead of restarting debates.

3. Safer refactors
- Preserve non-obvious constraints and avoid breaking hidden assumptions.

4. Better onboarding
- New contributors learn how and why the architecture evolved.

5. Conflict resolution
- Team disagreements can reference prior tradeoffs and explicit intent.

6. Higher-quality release notes
- Explain why changes exist, not only what changed.

7. Deprecation and migration clarity
- Track original goals and retirement conditions for old paths.

8. Product and engineering alignment
- Make technical decisions legible to non-implementation stakeholders.

9. Auditability
- Keep a timestamped rationale trail for important architectural choices.

10. Better AI/tooling context
- Assistants and automation can reason from project intent, not only code shape.
