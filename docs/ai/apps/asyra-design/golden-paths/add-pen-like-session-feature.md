# Golden Path: Add Pen-like Session Feature

## Goal

Implement a continuous interaction feature with start/update/end/cancel semantics.

## Steps

1. Define mode state keys
- add system properties for mode/session state if needed
- add helper APIs in `common-apis/system-context.ts`

2. Define session feature
- `onStart`: validate preconditions and seed session state
- `onUpdate`: apply incremental updates
- `onEnd`: finalize operation

3. Define cancel behavior
- add dedicated cancel feature (escape or other trigger)
- document exact state transitions per cancel press/state

4. Wire hover/selection helpers
- if interaction needs hover state, store it in system state for reuse

5. UI binding
- expose state via providers
- render context-specific panel overlays/fields

6. Verify
- start/update/end all deterministic
- cancel path always returns to valid state
- tool switch interaction is explicitly handled
- undo grouping matches user expectation

## Common Failures

- session state split across local variables and system state
- missing second-order cancel path (first cancel vs full exit)
- no explicit behavior for tool switch during active mode
