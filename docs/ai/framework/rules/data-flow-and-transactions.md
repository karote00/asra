# Rule: Data Flow and Transactions

## Data Flow

- Input -> Feature -> API -> State -> Render/UI
- Feature-system is the only runtime owner for execute/session/cancel.

## Event Ownership Rule

- Framework event contracts must stay domain-agnostic and must not assume app/preset-specific system-context keys.
- System-context key updates should use managed-property APIs (`core.setSystemProperty` / `core.getSystemProperty`) unless an app/preset explicitly defines its own event contract.

## Transaction Rule

- APIs that mutate model data should be transaction-bounded.
- Group logically-related mutations in one transaction.

## Validation Rule

- Runtime mutation invalid data must not be committed.
- Load-time invalid data must fallback safely.
