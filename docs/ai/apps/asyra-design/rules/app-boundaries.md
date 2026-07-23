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

- Official reusable UI/system properties belong to the responsible
  `@asyra/preset` default.
- App-only registrations belong to an explicit pre-start app composition
  module when needed; do not scatter them across feature or UI files.
