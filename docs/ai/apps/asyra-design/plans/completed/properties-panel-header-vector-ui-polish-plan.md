# Plan: Properties Panel Header and Vector UI Polish

## Scope

Polish properties panel header/title display, vector point controls UI, and content panel vector icon rendering to align with updated vector topology and panel styling.

## Completion (2026-03-13)

- outcome: properties panel header now reflects selection type, aligns with row padding, and uses updated typography/hover styling
- outcome: vector point controls use icon rows with consistent row height and selection styling
- outcome: vector shape icon rendering uses ui-property cache to avoid unrelated vector updates and initializes on load
- outcome: fill header row styling and numeric/hex inputs align with panel formatting

## Steps

1. Panel header/title alignment
- update header label sourcing and styling to match selection and row grid

2. Vector point UI polish
- swap select menus for icon rows and align icon sizing/selection styles

3. Vector icon caching
- compute and store per-element vector icon paths in ui-context
- subscribe by element id for stable row rendering

4. Fill and numeric input formatting
- align fill header row text and hover styling
- normalize numeric and hex entry display formatting

## Validation

- manual: verify properties panel header aligns with other rows
- manual: verify vector point controls and fill header render and hover correctly

## Exit Criteria

- header title reflects selection type or vector path editing mode
- vector point controls render as icon rows with correct selection affordance
- vector icon paths are stable and do not update on unrelated vector edits
- fill row and numeric input formatting match panel conventions
