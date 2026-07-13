# App Coding Standards

## Import Boundaries

1. Cross-package imports

- use `@asyra/package-name`

2. Same app imports

- use relative imports

3. Feature boundary

- feature files should primarily use `src/common-apis/*` and app constants/types
- prefer helper imports from `@asyra/core` when facade exports exist
- avoid direct deep package internals in feature handlers

## Interaction Standards

- keep event names in `src/constants/*`
- keep feature names in `src/constants/feature-names.ts` with flattened `FeatureNames`
- keep key combination definitions in `src/config/key-combinations.ts`
- keep feature priorities/exclusivity explicit
- keep cancellation paths explicit for session features

## Mutation Standards

- group related data changes as one intended undo unit
- use app/common APIs for scene/selection/system updates
- avoid ad-hoc mutation logic duplicated across features

## UI/Provider Standards

- property panel inputs parse values before update calls
- providers read derived state from hooks/providers, not raw internals
- keep stable `data-testid` attributes for E2E selectors

## Testability Standards

- interaction-visible behavior should be coverable by E2E
- avoid making behavior depend on fragile DOM structure selectors
- keep tool state observable via stable data attributes when possible
