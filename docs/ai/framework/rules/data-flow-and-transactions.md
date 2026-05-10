# Rule: Data Flow and Transactions

## Data Flow

- Input -> Feature -> API -> State -> Render/UI
- Feature-system is the only runtime owner for execute/session/cancel.
- Features must mutate or query framework state through app/common APIs or core facade APIs.
- Feature behavior should stay bounded to its trigger, priority/exclusive policy, and execution/session lifecycle.

## Event Ownership Rule

- Framework event contracts must stay domain-agnostic and must not assume app/preset-specific system-context keys.
- System-context key updates should use managed-property APIs (`core.setSystemProperty` / `core.getSystemProperty`) unless an app/preset explicitly defines its own event contract.

## Transaction Rule

- APIs that mutate model data should be transaction-bounded.
- Group logically-related mutations in one transaction.
- One intended user action should create one intended undo commit.
- Session updates may use non-undoable interim writes, but the final committed state must be grouped deliberately.
- Cross-store mutations must be coordinated through API boundaries that preserve scene-tree, props-manager, selection, and render consistency.

## Validation Rule

- Runtime mutation invalid data must not be committed.
- Load-time invalid data must fallback safely.
