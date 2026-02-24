# Task Breakdown 004: Add or Update E2E Coverage

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
