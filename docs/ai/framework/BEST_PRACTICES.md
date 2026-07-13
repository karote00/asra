# Best Practices

This document contains general guidance.
If any item conflicts with `rules/*`, `packages/*`, or `golden-paths/*`, follow those project contracts first.
When a recurring best-practice becomes the project-approved way, move it into `golden-paths/*` and remove/trim it here.

## For Framework Maintainers

1. Prefer registry-based extensibility.
2. Keep APIs minimal and explicit.
3. Keep defaults strong but opt-out possible.
4. Separate validation from presentation.
5. Write load migration strategy before breaking model shape.

## For App Authors

1. Treat `core` as the top-level gateway.
2. Use app-level common APIs for domain logic.
3. Keep UI parsing for UX only; rely on framework validation for correctness.
4. Register aggregates in app-level when domain-specific.
5. Use persistence hooks for versioned migration.

## For Domain Features (Example: Vector Editing)

1. Mode/state belongs in system-context.
2. Data updates go through API helpers with transactions.
3. Render overlays/layers are registered, not hardcoded in app loops.
4. Feature behavior is session-safe and cancellable.
