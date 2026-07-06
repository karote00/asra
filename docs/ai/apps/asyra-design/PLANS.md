Never record completed plans here.

# App Plans

## In Progress

### Stroke Engine Refactor Execution Plan

Goal: execute the stroke engine refactor through the inspector-flow-first
greenfield process until the runtime implementation matches the stroke engine
spec and inspector flow.

This file is an execution plan only. It does not define stroke geometry, dash,
join, cap, descriptor, channel, cache, visual-review, or performance semantics.
Those contracts live in:

- Stroke engine spec:
  `docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md`.
- Inspector flow:
  `docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js`.

The stroke engine spec is the semantic source of truth. The inspector flow is
the executable route and step contract. This active plan records the current
task objective, execution constraints, gate order, retry limits, and reporting
requirements.

## Current Status

- Current phase: runtime implementation audit/refactor after the 41-runtime-step unit
  checkpoint.
- The 41 runtime inspector-step unit suite remains verified. The unit lock state stays
  in `currentExecutionState`; runtime implementation progress is tracked
  separately by `stroke-flow-inspector.data.js`
  `runtimeImplementationState.activeStepId`.
- Current runtime implementation step: read from
  `stroke-flow-inspector.data.js` `runtimeImplementationState.activeStepId`.
- Runtime implementation progress is fail-closed by
  `runtimeImplementationState.verifiedStepIds`: the list must be a contiguous
  prefix from step 1, and `activeStepId` must always equal the first unverified
  runtime step derived from that prefix.
- Product implementation starts only from that runtime active inspector step.
- Runtime geometry is not considered correct from the 41-runtime-step unit suite alone.
  The current phase keeps only spec/inspector-aligned stroke tests in the gate
  set, establishes the inspector-flow integration suite, and maintains the formal
  geometry oracle suite before any production geometry repair resumes.
- Full package regression, E2E, visual review, and performance gates remain
  locked until the new integration and geometry-oracle gates are meaningful and
  the user approves the next phase.
- Historical closure records are baseline evidence only. They do not close the
  reopened stroke feature work.

## Execution Rules

1. Use only three stroke task documents:
   - this active plan;
   - the stroke engine spec;
   - the inspector flow data.
2. Before each implementation segment, read the active inspector step contract
   and the referenced stroke engine spec rules.
3. Keep exactly one inspector step active. Later steps remain locked until the
   active step is verified.
   During runtime implementation after the unit-complete checkpoint, the active
   step is not manually chosen: it is derived from the contiguous
   `runtimeImplementationState.verifiedStepIds` prefix. Any gap, duplicate,
   active step already in the prefix, or jump beyond the first unverified runtime
   step is a protocol failure.
4. For the active step, write or update the dedicated unit test before
   implementation. The test may assert only that step's contract: inputs,
   outputs, conditions, bypass conditions, limitations, owner stage,
   contributors, required evidence, and failure reopening behavior.
5. Implement only files listed by the active step lock metadata.
6. For high-risk orchestration steps, `implementationFiles` alone is not enough.
   The inspector step must declare `entryPointKind`, `entryPoint`,
   `implementationFunctions`, `helperAllowlist`, and `orchestrationBoundary`.
   The focused unit test and any refactor segment must enter through that
   boundary and may not treat helper functions as independent owner stages.
7. Every inspector step must have a complete stroke parameter coverage matrix
   entry before implementation. The matrix roles are defined by the stroke
   engine spec and stored in `stroke-flow-inspector.data.js`; a step may consume,
   preserve, dirty-key, cache-key, or emit metadata only for the parameters
   explicitly classified for that step.
8. Do not let downstream stages infer, repair, or substitute output for an
   upstream step.
9. Mark a step verified only after its dedicated unit test and the refactor
   protocol validator pass.
10. Continue one runtime inspector step at a time until all 41 runtime steps are
    verified, unless the active step reaches the retry stop condition.
11. Each active inspector step has at most three focused repair attempts. Every
   attempt must name the failing focused gate or contract mismatch, make a
   focused repair, and rerun the focused step gate. If the third attempt still
   fails, stop at that step, keep the inspector lock there, summarize the
   blocker, failed gate, owner-stage evidence, and attempted repair paths, then
   notify the user when the host environment supports it.
12. Full preset regression is a later phase gate and may be attempted at most
    three times. After each failed attempt, summarize the failing suite,
    assertion, owner stage, and focused repair path before retrying. If the
    third attempt fails, stop immediately and notify the user for discussion.
13. After all 41 runtime inspector-step unit tests are verified, stop at a
    unit-complete checkpoint and report the step-suite result. Do not run full
    integration, E2E, visual review, or full preset regression until the user
    approves a separate test-plan refactor phase.
14. `visible-final-result` is a post-runtime validation gate, not a runtime
    implementation step. It is validated after runtime diagnostics and current
    visual evidence are available; it must not appear in runtime
    `verifiedStepIds` or active-step sequencing.
15. E2E and visual review remain future-phase gates. E2E validates user
    behavior; it does not define stroke engine architecture.
16. Performance and cleanup work remain blocked until geometry/product
    semantics pass and the user has inspected the visual result.
17. Document-only schema/spec audits must follow the fixed document deep audit
    matrix in the stroke engine spec. New concerns found during an audit are
    recorded as deferred matrix extensions; they must not become surprise focus
    areas in the same pass.

## Stroke Test Conformance Policy

- A stroke test may remain in the gate set only when it maps to the current
  stroke engine spec, inspector step or route, owner stage, artifact channel, and
  expected output shape.
- Tests that assert retired behavior, depend on stale helpers, or cannot identify
  their governing spec and inspector route must be removed or rewritten before
  they can participate in stroke correctness gates.
- Do not repair production code solely to satisfy an unmapped or stale stroke
  test while an inspector-step refactor is active.
- Full package regression remains locked until the stroke correctness gates pass
  and the user explicitly approves the full-regression phase. A failing full
  regression test must not cause a production change unless the failure is first
  reproduced by a current spec/inspector-aligned test.

## Required Gates

Protocol validator:

```bash
yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts --reporter=verbose
```

Syntax/doc gate:

```bash
node --check docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js
```

Step gate template:

```bash
yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/<active-step-test>.test.ts --reporter=verbose
```

New stroke unit gate:

```bash
yarn workspace @asyra/preset test:stroke-flow:unit
```

New inspector-flow integration gate:

```bash
yarn workspace @asyra/preset test:stroke-flow:integration
```

New formal geometry oracle gate:

```bash
yarn workspace @asyra/preset test:stroke-geometry:oracle
```

New stroke regression coverage gate:

```bash
yarn workspace @asyra/preset test:stroke:regression
```

Combined stroke gate:

```bash
yarn workspace @asyra/preset test:stroke:new
```

Full preset regression, later phase only:

```bash
yarn workspace @asyra/preset test:local
```

Touched-surface gates, as needed after the relevant phase:

```bash
yarn workspace @asyra/render test:local
yarn workspace @asyra/asyra-design react:build
yarn lint:ci
```

Agent-run app visual, E2E, drag, and performance gates use
`http://localhost:3001`. `http://localhost:3000` is reserved for user-run
sessions. Extra ports are opt-in and must be shut down after use.

Run the enforced drag gate only after runtime behavior, drag path, render
projection, cache invalidation, or performance-sensitive runtime code is
touched in a verified phase:

```bash
ASYRA_STROKE_DRAG_E2E_ENFORCE_120FPS=1 \
ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL=http://localhost:3001 \
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3001 \
yarn workspace @asyra/asyra-design test:e2e \
  e2e/stroke-drag-render-performance-solid.spec.ts \
  e2e/stroke-drag-render-performance-open-solid.spec.ts \
  e2e/stroke-drag-render-performance-center-dashed.spec.ts \
  e2e/stroke-drag-render-performance-open-center-dashed.spec.ts \
  e2e/stroke-drag-render-performance-inside-dashed.spec.ts \
  e2e/stroke-drag-render-performance-open-inside-dashed.spec.ts \
  e2e/stroke-drag-render-performance-outside-dashed.spec.ts \
  e2e/stroke-drag-render-performance-open-outside-dashed.spec.ts \
  e2e/stroke-drag-render-performance-burst.spec.ts \
  --reporter=line
```

## Completion Report

Every implementation or documentation segment must report:

- active inspector step or document phase;
- implementation files changed;
- tests or protocol checks added or changed;
- gates run and results;
- gates not run and why;
- deferred post-runtime gates;
- whether user visual inspection is still required.

## Regression Coverage Policy

`test:stroke:regression` is the stroke regression coverage guard. It does not
replace the later full package regression gate. Its job is to prove that
regression responsibility is distributed across the step-unit, validation,
integration, formal geometry oracle, app runtime evidence, visual validation,
full-package regression, and drag/performance phases.

Reported cases are regression samples inside the coverage matrix. They may
open or verify matrix coverage, but they must not become standalone
implementation drivers, and they must not produce fixture-specific runtime
branches.
