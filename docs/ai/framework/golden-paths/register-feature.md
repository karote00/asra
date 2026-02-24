# Golden Path: Register a Feature

## Preconditions

- User action trigger is clearly defined (mouse/key/shortcut/custom event).
- Feature scope is interaction logic, not direct data-store ownership.

## Steps

1. Define feature contract
- trigger event(s)
- priority
- exclusive behavior
- execution vs session usage

2. Implement handler lifecycle
- `execute` for short, immediate actions
- `start/update/end/cancel` for continuous interactions

3. Call app/common APIs from feature handlers
- keep mutations behind APIs
- avoid direct package singleton manipulation

4. Wire cancellation and conflicts
- ensure active session can be canceled before conflicting action
- define tool-switch behavior explicitly

5. Register and activate feature
- register through framework/app registration flow
- ensure it participates in deterministic ordering

## Verification Checklist

- Same trigger always resolves same feature ordering.
- Exclusive features block competing handlers as designed.
- Cancel path leaves runtime in valid state.
- Undo/redo grouping is correct for the interaction.

## Common Failure Cases

- Feature writes directly to context/store without API boundaries.
- Session never ends/cancels under some paths.
- Priority/exclusive settings produce nondeterministic behavior.
