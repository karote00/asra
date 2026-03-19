# Plan: Repeatable Strokes And Stroke Rendering

## Scope

Implement repeatable element strokes with editable sub-properties and finalize
closed-path stroke rendering semantics for dashed, inside, center, and outside
positions.

Behavior targets:

- each drawable element exposes a repeatable `strokes` computed/property value
- each stroke item supports:
  - `visible`
  - `opacity`
  - `colorFormat`
  - `color`
  - `width`
  - `style`
  - `position`
  - `dash`
  - `gap`
  - `joinType`
  - `miterAngle`
- runtime writes follow schema validation (`valid -> write`, `invalid -> reject`)
- load path falls back deterministically for invalid persisted stroke values
- properties panel includes a `Stroke` section with add/remove/edit controls
- closed-path stroke rendering keeps dash allocation on the original centerline
  and applies position-specific offset/render behavior for `inside`, `center`,
  and `outside`

## Steps

1. Stroke contracts + schema

- add shared stroke type contracts and repeatable list registration
- register stroke schema validators and defaults for load/runtime safety

2. Preset component + UI wiring

- add `strokes` property to drawable components
- aggregate `strokes` in preset ui-context compute
- add properties panel repeatable stroke section and stroke row controls

3. Stroke render behavior

- keep dash interval allocation on the original centerline
- preserve cross-vertex dash continuity
- render `inside` with inward offset + inside clipping
- render `center` as explicit inside/outside halves
- render `outside` with outward offset geometry

4. Tests + docs sync

- add/update unit tests for stroke registration and render behavior
- update properties panel docs and ui-data-flow rules
- validate preset/app build output

## Validation

- `yarn workspace @asyra/preset test:local -- strokes`
- `node ./node_modules/eslint/bin/eslint.js packages/preset/src/components/strokes.ts packages/preset/src/__tests__/strokes.test.ts`
- `yarn react:build`

## Result

Completed on 2026-03-19.

- Added repeatable `strokes` contracts, schema/default registration, preset
  aggregation, and properties-panel stroke editing controls.
- Finalized closed-path stroke rendering so dashed paths stay on the original
  centerline while `inside`, `center`, and `outside` now produce distinct
  position semantics.
- Added stroke renderer regression coverage for cross-corner dashes and
  position-specific closed-path routing.

Final decision:

- Keep repeatable strokes as child-property rows in ui-context and render
  closed-path stroke positions through centerline-first dash allocation plus
  position-specific offset/render routing.

Exit criteria:

- Stroke rows are editable from the properties panel and persist through the
  existing property runtime.
- Closed-path dashed strokes respect `inside`, `center`, and `outside`
  positioning.
- Preset tests and app build pass with the finalized stroke renderer.

Canonical completed-plan path:

- `docs/ai/apps/asyra-design/plans/completed/repeatable-strokes-and-stroke-rendering-plan.md`
