# /geometry-clipping-bugfix Workflow

## Intent

Fix geometry/clipping regressions with rule-boundary TDD, explicit helper gating, and visual/performance validation.

## Use When

- dashed stroke clipping is incorrect
- geometry ownership/cutting regresses after a fix
- sharp corner / seam / high-curvature / segment-transition geometry changes are in scope
- a geometry bug keeps reappearing because local fixes are not constrained tightly enough

## Routing

- Treat this as app-specific work for `asyra-design` unless the issue is proven framework-generic.
- Combine with `/bugfix` for the normal bugfix path.
- Combine with `/docs-reality-check` when implementation and geometry contracts drift.

## Required Inputs

1. reproduction sample or screenshot
2. expected visible behavior
3. preserved invariants
4. performance expectation or benchmark budget

## Reference Docs

- `docs/ai/framework/README.md`
- `docs/ai/framework/FRAMEWORK_ESSENTIALS.md`
- `docs/ai/framework/CODING_STANDARDS.md`
- `docs/ai/apps/asyra-design/WORKFLOW.md`
- `docs/ai/apps/asyra-design/rules/testing-contracts.md`
- `docs/ai/apps/asyra-design/rules/geometry-clipping-regression-contract.md`

## Execution

1. Analyze the first corrupted stage, not only the final screenshot.
2. Write tests before implementation:
   - one direct behavior test for the visible regression
   - one rule-boundary test for helper entry conditions
   - one non-regression test for the nearest already-fixed hotspot
   - one performance guard if runtime cost changed
3. Define success in the test names and expectations before coding.
4. Limit scope:
   - every helper must have explicit entry conditions
   - no blanket phase-wide processing
   - no sample-id, dash-index, or screenshot-position special cases
5. Implement at the first stage that actually corrupts geometry.
6. Re-run rule tests, render-level tests, visual tests, and performance checks.
7. If visual validation still fails, loop back to step 1 automatically. Do not stop at a partially wired state.

## Output

Use shared output contract in `docs/ai/workflows/README.md`.
