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

## Framework Extension Contract

Asyra Design follows the framework extensible runtime guarantees in `docs/ai/framework/design-principles/extensible-runtime-guarantees.md`.
Asyra Design also follows the framework pre-release legacy removal rule in `docs/ai/framework/rules/pre-release-legacy-removal.md`: app-specific unreleased flows must be upgraded or deleted, not kept as product fallbacks.

App features should prove their own behavior through `src/common-apis/*` and core facade APIs without depending on unrelated framework or preset internals.

Preset-provided behavior may be used as the default, but app-specific workflow changes should be implemented as app-owned features, app-owned common APIs, or documented preset extension/replacement flows.

## Non-Negotiable App Constraints

- Do not bypass feature boundaries by mutating deep package internals inside features.
- Keep event names centralized in `src/constants/*`.
- Keep feature names centralized in `src/constants/feature-names.ts` (`FeatureNames`).
- Keep key combinations centralized in `src/config/key-combinations.ts`.
- Keep reusable mutation/query logic in `src/common-apis/*`.
- Do not preserve stale app workflow, render, or property-panel paths as compatibility behavior unless they are released public contracts.
