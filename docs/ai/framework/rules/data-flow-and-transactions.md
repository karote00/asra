# Rule: Data Flow and Transactions

## Data Flow

- Input -> Feature -> API -> State -> Render/UI
- Feature-system is the only runtime owner for execute/session/cancel.
- `interaction-core` is compatibility-only (deprecated), not a second runtime owner.

## Transaction Rule

- APIs that mutate model data should be transaction-bounded.
- Group logically-related mutations in one transaction.

## Validation Rule

- Runtime mutation invalid data must not be committed.
- Load-time invalid data must fallback safely.
