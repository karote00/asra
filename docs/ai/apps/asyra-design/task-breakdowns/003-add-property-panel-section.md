# Task Breakdown 003: Add Property Panel Section

## Scope

Add a new property section/field in the right panel with correct read/write behavior.

## Steps

1. registration
- add property key registration if needed in `src/registrations/*`

2. provider
- add typed provider hook in `src/providers/*`

3. UI component
- create/update section in `src/properties/*`
- parse and validate input values in UI path

4. write path
- route writes through controllers/common APIs

5. visibility
- update `src/properties/index.tsx` show/hide logic

6. tests
- add/update E2E coverage for display and edit behavior

## Validation

- value is shown in correct context
- valid update applies, invalid update is rejected
