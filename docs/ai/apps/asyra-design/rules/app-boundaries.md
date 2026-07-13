# Rule: App Boundaries

## Feature Boundary

- Features should orchestrate behavior, not own low-level data internals.
- Reusable logic belongs in `src/common-apis/*`.

## API Boundary

- UI components and feature handlers should prefer controllers/common APIs for writes.
- Keep write paths centralized to reduce duplicate mutation logic.

## Framework Boundary

- Use framework APIs via core/context wrappers provided in app architecture.
- Avoid introducing new deep package internal dependencies in app code.

## Registry Boundary

- App-specific UI/system property registrations belong in `src/registrations/*`.
- Do not scatter property registrations across random feature files.
