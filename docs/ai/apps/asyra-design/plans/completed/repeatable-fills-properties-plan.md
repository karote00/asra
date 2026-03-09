# Plan: Repeatable Fills Properties

## Scope

Implement repeatable element fills with editable sub-properties and properties-panel UI controls.

Behavior targets:

- each drawable element exposes a `fills` computed/property value
- `fills` is repeatable (`fills[]`) and each entry is a typed fill item
- each fill item supports:
  - `defaultColorFormat`
  - `colorFormat`
  - `color`
  - `opacity` (fill-only opacity)
  - `visible`
  - optional gradient metadata (`gradientStops`, `gradientHandles`, and related fields)
- runtime writes follow schema validation (`valid -> write`, `invalid -> reject`)
- load path falls back deterministically for invalid persisted fill values
- properties panel includes a `Fills` section with add/remove/edit controls and color picker

## Steps

1. Fill contracts + schema

- add shared fill type contracts (item + gradient metadata)
- add property component registration for fill item and fill list
- register schema validators and defaults for load/runtime safety

2. Preset component wiring

- add `fills` property to drawable component definitions (`rect`, `oval`, `frame`, `vector`)
- keep existing stroke behavior; route fill render color from visible fill entries

3. App UI/state wiring

- register `fills` as a custom computed UI property in preset UI registration
- keep selection-derived fills ownership in ui-context and make provider hooks thin selectors over ui-context `fills`
- add properties panel fills section and repeatable fill row controls
- add design-system color picker + color-format editing path that persists canonical `color` in `defaultColorFormat`
- keep color drag undo semantics bounded by picker-owned pointer sessions (one drag => one undo commit)

4. Tests + docs sync

- update/add unit tests for preset/property registration and render behavior
- update/add E2E for properties panel fills edit behavior
- sync app contract docs and release decision notes

## Validation

- `yarn workspace @asyra/preset test:local`
- `yarn workspace @asyra/asyra-design react:build`
- `yarn workspace @asyra/asyra-design test:e2e e2e/properties.spec.ts --workers=1`

## Result

Completed on 2026-03-09.

- Added repeatable `fills` contracts, schema/default registration, and preset wiring for drawable elements.
- Added properties-panel fills UI with add/remove, solid/gradient editing, and a design-system color picker that keeps drag updates grouped into one undoable action.
- Switched single-fill editing to patch child property ids directly by `fillId`, while keeping fills panel ownership in ui-context row data.
- Synced docs across app/framework surfaces and captured follow-up framework planning for property-driven computed sync.

Final decision:
- Keep `fills` as a repeatable child-property model with direct child updates for item edits, while treating broad property-to-computed refresh as a temporary bridge until framework property-driven computed sync lands.

Exit criteria:
- `yarn workspace @asyra/asyra-design react:build` passes.
- `yarn workspace @asyra/asyra-design test:e2e e2e/properties.spec.ts --workers=1` passes.
- Updated app/framework docs reflect the finalized fills behavior and boundaries.

Canonical completed-plan path:
- `docs/ai/apps/asyra-design/plans/completed/repeatable-fills-properties-plan.md`
