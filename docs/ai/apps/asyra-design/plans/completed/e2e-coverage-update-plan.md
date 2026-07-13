# Plan: Add or Update E2E Coverage

## Scope

Update test coverage for changed app behavior.

## Steps

1. locate impacted suites
- check `e2e/*.spec.ts` for existing scenario overlap

2. selector contract
- ensure required `data-testid`/`data-active`/state selectors exist

3. update tests
- add or modify scenarios with stable helper usage from `e2e/test-utils.ts`

4. run tests
- run focused suite(s)
- run broader suite when cross-cutting behavior changed

5. document
- update related BDD/feature docs when behavior changed

## Validation

- test reliably reproduces intended behavior
- no brittle selectors tied to incidental DOM details

## Result

Completed on 2026-03-06.

- Expanded vector-editing E2E coverage in `e2e/pen-tool.spec.ts` for segment insert/split behavior, path-editing guards, anchor-handle translation, and refresh-related render regressions.
- Added regression coverage that ensures one render object per vector element id after page refresh and path-editing re-entry.
- Added direct element-hover state coverage in `e2e/selection.spec.ts` to assert `hoveredElementId` set/clear behavior from canvas mouse movement.
- Added non-pen segment hover/selection coverage in `e2e/pen-tool.spec.ts` to assert select-mode segment targeting while path editing remains active.
- Synced behavior/API docs for the updated pen/path-editing contracts covered by these tests.

Final decision:
- Keep `pen-tool.spec.ts` as the focused regression gate for vector path-editing interactions and refresh consistency.

Exit criteria:
- `yarn workspace @asyra/asyra-design test:e2e e2e/selection.spec.ts e2e/pen-tool.spec.ts` passes.
- Updated app docs reflect the tested behavior contracts.

Canonical completed-plan path:
- `docs/ai/apps/asyra-design/plans/completed/e2e-coverage-update-plan.md`
