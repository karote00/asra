# Golden Path: Add Input Shortcut + Feature

## Goal

Add a new keyboard shortcut that triggers app behavior via feature-system.

## Steps

1. Define event constant
- add event in `src/constants.ts` (`InputSystemEvents`)

2. Register key combination
- add combo and callback in `src/config/key-combinations.ts`
- update key/system snapshot state if needed in callback

3. Define feature
- create or update feature file under `src/features/*`
- set trigger, priority, exclusivity
- keep behavior behind common APIs

4. Register feature
- import feature module in `src/features/index.ts`

5. Verify
- shortcut fires expected behavior
- conflicts with existing shortcuts are resolved
- behavior deterministic with existing priorities/exclusivity

## Common Failures

- key mapping exists but feature trigger string mismatch
- feature registered but not imported in features index
- shortcut mutates state directly without API boundary
