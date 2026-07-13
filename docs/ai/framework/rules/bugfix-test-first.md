# Rule: Bugfix Test-First Gate

## Scope

This hard rule applies to every bug fix across framework packages, preset
defaults, reference apps, generated app templates, inspectors, visual review,
export, hit testing, and future apps.

## Core Rule

Before changing implementation for a bug, first verify whether existing formal
tests can detect the reported failure.

This is a highest-priority project rule: if the existing tests cannot detect
the failure, implementation work must not be accepted until an official test or
oracle has been added or strengthened to detect it.

- If an existing test fails for the reported bug, use it as the primary
  regression gate.
- If no existing test fails, add or strengthen a formal test or oracle first.
- The new or strengthened test must fail against the current implementation
  before the implementation fix is accepted.
- Manual screenshots, ad-hoc scripts, one-time diagnostics, and visual
  inspection are not substitutes for a formal regression test.

## Required Handling

1. Reproduce or characterize the bug at the correct semantic/product boundary.
2. Run or inspect the existing relevant tests to determine whether they detect
   the bug.
3. If coverage is insufficient, add or strengthen official
   unit/integration/E2E/visual-oracle tests in the owning package or app.
4. Confirm the test fails before modifying implementation, unless the only
   change is to correct a broken test oracle itself; document that exception.
5. Implement the fix at the canonical owner step.
6. Rerun the new or strengthened test and the relevant existing tests.
7. For visual behavior, run app visual review after geometry/unit tests pass.

## Forbidden Patterns

- Fixing implementation first and adding tests only after the fact without
  proving the tests catch the original failure.
- Claiming a bug is fixed because manual visual inspection looks better while
  no formal test can fail on the old behavior.
- Keeping diagnostic scripts outside the formal test suite as the only guard.
- Narrowing assertions to implementation details that do not prove the
  user-visible or contract-visible failure.

## Relationship to No Patch Fixes

This rule is the test gate for `no-patch-fixes.md`: the failing test should
describe the canonical contract, not endorse a downstream patch or fallback.
