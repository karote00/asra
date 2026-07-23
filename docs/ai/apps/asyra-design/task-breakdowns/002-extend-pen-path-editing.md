# Task Breakdown 002: Extend Pen Path Editing

## Scope

Add/adjust one path-editing behavior (state transition, point behavior, or exit semantics).

## Steps

1. behavior spec
- update `features/pen-tool.md` contract first

2. feature change
- update relevant handlers in `src/features/pen-tool/feature.ts`

3. state model
- update `common-apis/system-context.ts` helpers if needed

4. geometry writes
- ensure vector updates route through `elementApis` mutation helpers

5. panel impact
- update point/layout panel visibility behavior if needed

6. tests
- update `e2e/pen-tool.spec.ts` and/or related suites
- do manual sanity check for cancel/tool-switch edge cases

## Validation

- enter/update/cancel/exit paths match contract
- no path-editing stale state remains after exit
