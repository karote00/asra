# Golden Path: Add Property Panel Field

## Goal

Add a new editable field in properties panel with correct state flow.

## Steps

1. Register/derive property

- reuse an existing Preset-managed property when its contract already matches
- otherwise extend the responsible official Preset default, or register a
  strictly app-owned property in explicit pre-start app composition

2. Provider hook

- add typed provider hook in `src/providers/*`

3. UI component

- add field component under `src/properties/*`
- parse input (`parseFiniteInputNumber` style or domain parser)
- write via controller/common API

4. Show/hide conditions

- update `src/properties/index.tsx` if visibility depends on mode/selection

5. Verification

- field appears in expected selection/mode state
- update persists visually and in runtime data
- invalid input does not corrupt state
- undo/redo grouping remains expected

## Rule

UI parser/validation is UX-level; final correctness belongs to framework
validation paths.
