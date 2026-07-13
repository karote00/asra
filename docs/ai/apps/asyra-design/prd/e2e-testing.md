# PRD: E2E Testing

## Problem

App interaction behavior is complex and regression-prone without stable end-to-end coverage.

## Goals

- protect core user workflows
- keep selectors stable and maintainable
- support fast confidence checks after refactors

## Current Coverage Areas

- app load/layout
- tool switching
- rectangle/oval creation
- selection
- delete behavior
- property editing
- viewport zoom
- undo/redo
- pen/path editing core flow

## Functional Requirements

1. E2E selectors should rely on stable `data-testid` or equivalent attributes.
2. Tests should cover keyboard and UI trigger paths where both are user-facing.
3. Core interaction regressions should be detectable in CI/local workflow.
4. Test utils should provide reusable canvas coordinate helpers.

## Non-Functional Requirements

- tests should be deterministic enough for repeated runs
- suites should stay maintainable when UI layout evolves

## Success Criteria

- existing suites in `apps/asyra-design/e2e/*.spec.ts` pass
- failures provide actionable diagnostics

## References

- `apps/asyra-design/e2e/*`
- `apps/asyra-design/e2e/test-utils.ts`
