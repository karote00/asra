# App Essentials

## Prime Directive

Asyra Design is an app-level implementation on top of Asyra framework contracts.

App code should:

- compose framework APIs to deliver design-tool behavior
- keep feature logic deterministic
- keep data mutations behind app/common APIs
- keep UI reactive to state, not authoritative over state

## Core App Tenets

1. Feature-first interactions

- Input events should map to feature handlers.
- Feature ordering and exclusivity should be explicit.

2. API boundary discipline

- Features should call `src/common-apis/*`.
- `common-apis` may coordinate core/context calls.

3. Transaction-safe mutations

- Data-changing paths should be grouped into intended undo units.
- Avoid splitting one user action into multiple unintended commits.

4. UI as derived output

- Providers read from ui-context/system context.
- Property panel writes through controllers/common APIs.

## Current App Runtime Position

- Primary interaction runtime: `@asyra/feature-system`
- Pen/path editing is stateful via system properties.

## Non-Negotiable App Constraints

- Do not bypass feature boundaries by mutating deep package internals inside features.
- Keep event names centralized in `src/constants/*`.
- Keep feature names centralized in `src/constants/feature-names.ts` (`FeatureNames`).
- Keep key combinations centralized in `src/config/key-combinations.ts`.
- Keep reusable mutation/query logic in `src/common-apis/*`.
