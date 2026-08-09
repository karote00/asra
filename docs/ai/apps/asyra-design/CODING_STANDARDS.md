# App Coding Standards

## Import Boundaries

1. Cross-package imports

- use `@asyra/package-name`

2. Same app imports

- use relative imports

3. Feature boundary

- feature files should primarily use `src/common-apis/*` and app constants/types
- use `@asyra/core` or the App Core context for framework runtime/lifecycle
  capabilities; never use `core.deps` as an App API
- Factory, Feature System, Input System, Reactive Events, and Render package
  singletons are Core-owned App boundaries; add a Core facade when one is
  missing instead of importing the singleton
- direct `@asyra/collaboration` use is limited to independently composed
  Provider/wire/transport policy; register its runtime lifecycle with Core
- avoid direct deep package internals in feature handlers

4. Backend boundary

- backend and socket-server production code import only Node/third-party
  infrastructure and App-owned protocol modules
- no backend source or backend bundle may import an `@asyra/*` package,
  including type-only imports
- framework publication/event conversion belongs to the frontend adapter, and
  remote apply returns through a Core facade

Authority: `rules/app-boundaries.md`.

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
