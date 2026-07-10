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

- Current phase: post-runtime correctness gate audit. The runtime unit gate is
  complete, the reopened typed artifact boundaries are repaired and reverified,
  and closure packets remain contract-closed.
- Current runtime implementation step: none (41/41 verified).
  The runtime ledger contains the complete verified Step 1-41 prefix, and the
  preset TypeScript gate is clean.
- Runtime implementation progress is fail-closed by
  `runtimeImplementationState.verifiedStepIds`: the list must be a contiguous
  prefix from step 1, and `activeStepId` must always equal the first unverified
  runtime step derived from that prefix.
- The source-mutation-ingress review family that contains Step 1 is
  implementation-ready. Product-family co-execution is now
  `family-dataflow-closed`: Step 25-32 semantic owners contribute an
  owner-preserving union consumed only by `apply-legality`, and later stages
  consume `postLegalityProductUnits` instead of raw product units.
- Before product implementation starts or advances, the active step must pass
  the stroke spec whole-flow review group that contains it. The runtime steps
  are implementation ownership slices; they are not isolated correctness proofs.
- Runtime geometry is not considered correct from the 41-step contract suite
  alone. Runtime owners must still be audited in order before later integration,
  formal geometry oracle, E2E, regression, and performance phases.
- The revised inspector graph remains 41 runtime development steps. Step 28 is
  the split-out dash body seam-boundary owner step. `visible-final-result`,
  `app-visual-review`, and optional `runtime-diagnostics` are post-runtime
  validation/evidence methods, not development steps.
- The inspector completion ledger separates contract closure from runtime
  closure. `product-family-coexecution`,
  `legality-final-records-descriptors`, and `output-channels` remain
  implementation-ready with closed family dataflow and pending runtime gates.
  The focused continuous width, dash/gap, and miter-angle gates now pass the
  8.33ms budget. The remaining focused performance blocker is inside-dashed
  point/handle drag: the latest strict anchor case measured resolved geometry at
  2.30ms p95, vector product render at 9.50ms p95, and sustained flush at
  7.717ms average. Resolved geometry, vector average, and sustained flush pass;
  the vector-render tail remains open.
- The Step 34 resolved-packet cache-key segment is complete. Early, full, and
  join-independent aliases now reuse one common basis without removing semantic
  invalidation dimensions; the focused key phase improved from approximately
  0.9ms p95 / 0.221ms average to 0.10ms p95 / 0.0375ms average. Protocol, Step
  34, Step 37 handoff, constrained-product oracle, and preset build gates pass.
  The Step 37 owner-local replacement is complete: aggregate cache misses dropped
  from 44 to 22 for 22 rebuild frames, validated ribbon used/fallback counts
  stayed at 1052/30, and focused final-face/product oracles pass. The full Step 37
  runtime blocker remains because the strict vector p95 is still over budget.
  The Step 29 bounded segment is complete. Canonical join polygons now remain
  reference-identical through legality and descriptor exclusion indexes;
  per-plan bounds, per-polygon-set bounds, and owner join-angle resolution are
  reused without downstream normalization or reconstruction. Protocol plus Step
  29 passed 54 tests, seven focused source-space geometry oracles and the preset
  TypeScript build pass. On port 3001, join-record p95 improved from 1.20ms to
  0.70ms, join-packet p95 from 0.70ms to 0.30ms, raw source-product p95 from
  1.80ms to 0.90ms, and product-assembly p95 from 3.10ms to 1.80ms. The global
  strict gate remains open at resolved geometry p95 2.50ms, vector render p95
  10.00ms, and sustained flush average 8.38ms. Whole-family attribution selects
  Step 37 as the next bounded owner: inside aggregate descriptor materialization
  averages 1.69ms and product-polygon evidence averages 0.99ms. Across three
  real drag targets, the per-path cache recorded 2,081 hits and 1,810 misses;
  warm hit work is approximately 0.010ms per path and miss work approximately
  0.026ms. A collision-checked numeric fast-cache experiment was rejected and
  removed because 508 fast hits still changed product-evidence average from
  0.99ms to 1.00ms and p95 from 1.70ms to 1.80ms. The next bounded review is the
  Step 25 shared ribbon owner and all of its center, inside, outside, and
  doubled-center consumers. The ownership audit found a stale inspector record:
  `dashed-center-ribbon-geometry.ts` is owned by Step 25 but also consumed by
  Step 37. The bounded shared-ribbon repair is complete: duplicate unsuppressed
  outline normalization and allocation-heavy equivalent rail checks are removed;
  four cap/join/suppression fingerprints and ribbon used/fallback counts remain
  unchanged. Product-evidence average improved from 0.99ms to 0.90ms and p95
  from 1.70ms to 1.60ms. The strict gate now measures resolved geometry p95
  2.70ms, vector p95 9.60ms, and sustained flush average 8.08ms, so only vector
  p95 remains open. A new detail-phase attribution pass selects the next owner;
  no additional ribbon change proceeds without new dominant-cost evidence. The
  attribution selects Step 20 shared geometry: source split ranges average
  0.43ms, intersections 0.40ms, planar graph 0.32ms, and boundary contours
  0.13ms. Across 22 rebuild frames, 1,408 of 5,654 traced segments were dirty,
  pair reuse recorded 902 hits and 405 misses, and source-split cache lookup
  missed all 22 frames. The active bounded segment first aggregates per-pair
  diagnostics and splits source-range key/materialization timing; geometry and
  cache semantics remain unchanged until that evidence identifies the owner cost.
  That bounded segment is now verified: protocol plus Step 20 passed 33 tests,
  resolved-geometry regression passed 9 tests, the preset build and focused
  lint pass, and pair totals remain hit 902, miss 405, and consecutive-skip
  5,544. Intersections improved from approximately 0.40ms average / 0.80ms p95
  to 0.3625ms average / 0.50ms p95. Source-split cache-key work is only 0.0125ms
  average; materialization is 0.4083ms average / 0.70ms p95. The strict
  inside-dashed out-control gate remains open at vector-render p95 9.90ms. The
  next bounded segment is a full Step 20 source-split artifact-lifecycle and
  consumer review before any cache-policy or algorithm replacement. That review
  confirms both legal-face and contour passes are required because only the
  legal-face pass emits `filled-face` ranges. The active Step 20 segment now
  attributes cache lookup, setup/role indexing, legal-face construction,
  contour merge, finalization, and cache store while preserving exact range
  output and cache bypass behavior. That attribution is complete: the latest
  route measures legal-face work at 0.2042ms average, contour merge at 0.0917ms,
  cache store at 0.0208ms, and total source-split materialization at 0.3583ms.
  Because legal-face work uniquely owns `filled-face` ranges and the whole
  constrained-dashed packet stage remains 4.5125ms average, no Step 20
  algorithm replacement is selected. The next bounded review covers Step 37
  descriptor materialization together with its Step 27/29 product evidence and
  Step 34/35/36 legality/final-face handoffs before any algorithm change. The
  review finds no duplicate terminal-body slicing on the focused route: all
  1,340 descriptor items are boundary-domain programs and Step 37 path slicing
  is the sole measured slice owner. The active bounded segment therefore
  attributes Step 37 product-polygon cache lookup, manual ribbon, fallback,
  caps, and cache storage before choosing a replacement. Attribution is now
  complete: cache lookup averages 0.1417ms, continuous ribbon 0.2917ms,
  fallback 0.2750ms, middle round caps 0.2000ms, and cache store 0.0125ms. The
  first accepted Step 37 optimization removes only generic cleanup proven
  redundant for analytic cached-unit-semicircle cap points; formal cap
  invariants pass at widths 1, 7.25, and 64, and Step 25/37 plus protocol pass
  58 tests with the cap oracle passing 3 tests. Runtime timing remains within
  noise, so no stable gain is claimed. All 27 expensive ribbon fallbacks are
  `fail-open-invalid-outline`; the next bounded owner is Step 25 segmented
  fallback attribution across source normalization, segment bodies, joins, and
  caps before any fallback algorithm replacement. Step 25 remains the geometry
  owner even when Step 37 invokes the fallback, so no descriptor-local fallback
  implementation will be introduced. Whole-family attribution across every
  solid-center consumer measures segment bodies at about 0.083ms, caps at
  0.167ms, and source-vertex join polygons at 1.625ms average. The next bounded
  owner is Step 29: add a metadata-free no-incident-boundary bevel primitive
  only after point-exact differential parity with the full solver; Step 25 will
  not consume it until that owner gate closes. The owner gate is now closed:
  seven differential cases are point-exact, Step 29/protocol pass 61 tests,
  join/dash plus ordinary-sharp oracles pass 13 tests, and lint/build pass. The
  Step 25 consumer preserves all three complete solid-center polygon
  fingerprints while switching only metadata-free authored bevel calls.
  Focused runtime attribution now separates the remaining join cost:
  metadata-free bevel averages `0.1542ms`, while the no-seam round calls through
  the full solver average `1.4083ms` of the `1.7958ms` join total. Protocol plus
  Step 25/37 pass 62 tests, and the focused 3001 vector measurement is `6.23ms`
  average / `8.70ms` p95. The next bounded owner is Step 29: formally prove a
  distinct metadata-free no-incident-boundary round primitive against the full
  solver before Step 25 may consume it. Canonical Step 29 products and every
  constrained caller continue to use the full solver. Pre-implementation review
  rejected cross/dot sweep shortcuts after they produced point mismatches. The
  accepted candidate preserves the existing sampled-midpoint sweep score,
  materializes only the selected normal-case arc, and retains dual-sweep fallback
  for degenerate or numerically ambiguous cases. It is point-exact across a
  deterministic 92,738-case diagnostic grid and improves a 448-case microbenchmark
  by 68.2%; formal core-arc fingerprints, sampled-midpoint parity, and the focused
  Step 29 gate remain required before production use. That owner gate is now
  closed: six fixed core-arc fingerprints, six sampled-midpoint identities, and
  nineteen authored-round differential cases pass; Step 29 plus protocol pass
  93 tests, four related oracle files pass 20 tests, the production primitive is
  point-exact across the same 92,738-case grid, and focused lint/build pass. The
  Step 25 consumer segment is also complete: only no-seam metadata-free
  authored-round calls use the new primitive, authored miter remains on the full
  solver, complete center-product fingerprints remain unchanged, and protocol
  plus Steps 25/29/37 pass 133 tests. Port 3001 attribution reduces the
  source-vertex join total from `1.7958ms` to `0.8833ms` average, while the
  latest strict route passes resolved geometry p95 and sustained flush average
  but remains open at `9.50ms` vector p95. The next segment is a read-only
  Step 27-41 whole-family dataflow and end-state algorithm review. That review
  rejects typed interval-id parsing as the next optimization because its
  measured subphases are only 0-0.1ms. The selected candidate is one exact
  descriptor-backed composite for eligible same-paint constrained-dashed
  groups: render consumes completed paths, cap/join masks, and legal constraints
  without eager body polygonization, while hit/export project and cache the same
  product only on channel use. Contract and differential gates must close before
  production changes. The candidate is rejected unless it proves zero geometry
  difference, complete identity, conservative bounds, zero automatic drag
  materialization, and strict vector p95 below 8.33ms with margin.
- Inspector-flow integration and formal geometry-oracle work begins
  automatically after the runtime unit gate. Full package regression, E2E, and
  performance remain ordered behind the focused correctness gates defined below.
  Visual review is optional and explicit-request-only.
- Historical closure records are baseline evidence only. They do not close the
  reopened stroke feature work.
- Continuous parameter performance is a post-correctness runtime gate. It exercises
  width, dash/gap, and miter-angle changes through the production
  property/common API path without adding a UI scrubber.

## Execution Rules

1. Use only three stroke task documents:
   - this active plan;
   - the stroke engine spec;
   - the inspector flow data.
2. Before each implementation segment, read the active inspector step contract
   and the referenced stroke engine spec rules.
3. Keep exactly one inspector step active for implementation edits. Later steps
   remain locked until the active step is verified, but step readiness and
   advancement must be reviewed through the whole-flow review group that contains
   the active step.
   During runtime implementation after the runtime unit gate, the active
   step is not manually chosen: it is derived from the contiguous
   `runtimeImplementationState.verifiedStepIds` prefix. Any gap, duplicate,
   active step already in the prefix, or jump beyond the first unverified runtime
   step is a protocol failure.
4. Before any active step implementation iteration or task replan resumes, run
   the stroke engine spec `Whole-Flow Review And Step Grouping Contract`: define
   the required final artifacts, confirm upstream owners and downstream
   consumers, identify route-family co-execution requirements, and prove that no
   downstream step needs raw upstream data, recomputation, renderer repair,
   helper-visible geometry, fallback output, or patch geometry.
   A review group is implementation-ready only when its closure packet has
   closed contract status, closed family dataflow status or `not-applicable`,
   declared cross-family handoff gates, explicit runtime scope, and explicit
   reopen conditions.
5. For the active step, write or update the dedicated unit test before
   implementation. The test may assert only that step's contract: inputs,
   outputs, conditions, bypass conditions, limitations, owner stage,
   contributors, required evidence, and failure reopening behavior.
6. Implement only files listed by the active step lock metadata.
7. For high-risk orchestration steps, `implementationFiles` alone is not enough.
   The inspector step must declare `entryPointKind`, `entryPoint`,
   `implementationFunctions`, `helperAllowlist`, and `orchestrationBoundary`.
   The focused unit test and any refactor segment must enter through that
   boundary and may not treat helper functions as independent owner stages.
8. Every inspector step must have a complete stroke parameter coverage matrix
   entry before implementation. The matrix roles are defined by the stroke
   engine spec and stored in `stroke-flow-inspector.data.js`; a step may consume,
   preserve, dirty-key, cache-key, or emit metadata only for the parameters
   explicitly classified for that step.
9. Do not let downstream stages infer, repair, or substitute output for an
   upstream step.
10. Mark a step verified only after its dedicated unit test, the active
   whole-flow review group check, and the refactor
   protocol validator pass.
11. Continue one runtime inspector step at a time until every runtime inspector
    step in the revised graph is verified, with automatic task replanning when
    the active step reaches the retry limit.
12. Each active inspector step has at most three focused repair attempts. Every
   attempt must name the failing focused gate or contract mismatch, make a
   focused repair, and rerun the focused step gate. If the third attempt still
   fails, keep the same owner step, summarize the blocker, failed gate,
   owner-stage evidence, and attempted repair paths, then automatically perform
   a task replan before the next implementation iteration.
13. Full preset regression is a later phase gate and may be attempted at most
    three times. After each failed attempt, summarize the failing suite,
    assertion, owner stage, and focused repair path before retrying. If the
    third attempt fails, automatically perform a task replan before another
    regression attempt.
14. After every revised runtime inspector-step unit test is verified, record the
    runtime unit gate result and proceed directly to the focused post-runtime
    test-architecture, integration, and formal geometry-oracle phase. Do not run
    E2E or full preset regression before their preceding correctness gates.
    The previous 41-step unit baseline remains historical evidence only.
15. `visible-final-result` and `app-visual-review` are optional
    explicit-request-only validation methods, not runtime implementation steps or
    automatic completion gates. Run them only when the user explicitly asks for
    final screenshots or adds visual review to the requested implementation
    scope. They must not appear in runtime
    `verifiedStepIds`, active-step sequencing, inspector routes, or step-unit
    files. Optional diagnostics may provide non-product evidence, but
    diagnostics are not a development step or required final validation method.
16. E2E starts after the integration and formal geometry-oracle gates are
    meaningful and pass. E2E validates user behavior; it does not define stroke
    engine architecture. Optional visual review does not block E2E.
17. Performance and cleanup start after geometry/product semantics and required
    runtime behavior gates pass. Optional visual review does not block them.
18. Document-only schema/spec audits must follow the fixed document deep audit
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
- Full package regression starts after the stroke correctness gates pass. A
  failing full regression test must not cause a production change unless the
  failure is first reproduced by a current spec/inspector-aligned test.

## Focused Test Execution Policy

- The implementation inner loop runs only the protocol validator, the active
  inspector step unit test, and one required cross-step handoff test when the
  active contract crosses a family boundary.
- Geometry repair runs one mapped oracle file or exact test title first. A
  product-family suite runs only after the focused case passes.
- Integration tests are split by the six whole-flow review families. Formal
  geometry oracles are split into normalization/domain, center product,
  constrained product, dash/cap/join, legality/final-face, and output-channel
  groups.
- Continuous parameter performance is split into width, dash/gap, and
  miter-angle focused gates. Drag performance remains split by its existing
  solid, dashed, open, constrained, and burst scenario files.
- Each continuous parameter gate uses distinct geometry-rebuilding values for at
  least 90% of its frames and reserves at least one repeated value for cache-hit
  evidence. Geometry p95 is calculated only after this minimum sample population
  is present.
- A focused step gate targets five seconds; a focused geometry oracle targets
  fifteen seconds. Any focused test above thirty seconds, or any file covering
  unrelated owner families, requires a split review before more cases are added.
  These timings guide test decomposition and are not correctness assertions.
- `test:stroke-flow:unit`, `test:stroke:new`, the full E2E matrix, any explicitly
  requested visual matrix, and `test:local` run only at their declared phase
  boundaries, not in a step repair inner loop.

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

Agent-run app visual, E2E, drag, and performance gates use the app-specific
visual review URL declared in `apps/asyra-design/.env`
(`ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL`) and pass the same value to
`PLAYWRIGHT_TEST_BASE_URL`. Do not hardcode a localhost port in the gate
contract. If the configured URL points at a user-run server, use that same
runtime or stop and report the environment mismatch. Extra ports are opt-in and
must be shut down after use.

Run the enforced drag gate only after runtime behavior, drag path, render
projection, cache invalidation, or performance-sensitive runtime code is
touched in a verified phase:

```bash
export ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL="$(
  grep '^ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL=' apps/asyra-design/.env |
    cut -d= -f2-
)"
ASYRA_STROKE_DRAG_E2E_ENFORCE_120FPS=1 \
PLAYWRIGHT_TEST_BASE_URL="$ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL" \
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
- whether optional visual inspection was explicitly requested and, if so, its
  status.

## Regression Coverage Policy

`test:stroke:regression` is the stroke regression coverage guard. It does not
replace the later full package regression gate. Its job is to prove that
regression responsibility is distributed across the step-unit, validation,
  integration, formal geometry oracle, app runtime evidence, full-package
  regression, and drag/performance phases. Explicitly requested visual
  validation remains optional evidence outside automatic completion.

Reported cases are regression samples inside the coverage matrix. They may
open or verify matrix coverage, but they must not become standalone
implementation drivers, and they must not produce fixture-specific runtime
branches.
