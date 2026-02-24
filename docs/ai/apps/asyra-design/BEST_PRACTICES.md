# App Best Practices

This file is general guidance.
If it conflicts with `rules/*` or `features/*`, follow those first.

## Interaction

1. Keep feature handlers small and predictable.
2. Put reusable mutations in `common-apis`.
3. Prefer explicit state flags over implicit behavior coupling.

## UI

1. Keep panel inputs tolerant to in-progress editing, strict on commit.
2. Use providers/hooks to isolate UI from runtime internals.
3. Keep `data-testid` stable to avoid E2E churn.

## Refactoring

1. Refactor by vertical slice (API -> feature -> UI).
2. Preserve undo grouping intent for each user action.
3. Validate with both E2E and manual checks for complex interactions.
