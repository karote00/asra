# Execution Plan: Professional Stroke Engine

## Purpose

This document is the implementation-ready rollout plan for the professional
stroke engine architecture.

It exists so the architecture spec cannot be interpreted as an invitation to
implement arbitrary slices in arbitrary order.

Companion architecture spec:

- `docs/ai/apps/asyra-design/plans/professional-stroke-engine-plan.md`

Canonical algorithm flow contract:

- `docs/ai/apps/asyra-design/plans/professional-stroke-engine-algorithm-flow.md`

Current rollout control documents:

- `docs/ai/apps/asyra-design/plans/stroke-engine-doc-source-of-truth.md`
- `docs/ai/apps/asyra-design/plans/stroke-engine-support-matrix.md`
- `docs/ai/apps/asyra-design/plans/stroke-engine-promotion-ledger.md`
- `docs/ai/apps/asyra-design/plans/stroke-engine-failure-triage.md`
- `docs/ai/apps/asyra-design/plans/stroke-engine-manual-qa-checklist.md`

Companion handoff file for fast resume in a new conversation:

- `docs/ai/apps/asyra-design/plans/professional-stroke-engine-handoff.md`

## Current Execution Focus

The active execution scope is now intentionally narrower than the full
architecture, but it is still a formal product plan.

The current delivery target is Figma-like uniform-width stroke completion for
the supported Asyra Design shape/vector model. The plan may use bounded slices
to reach that target, but the target itself is not a representative-only demo.

Current rollout priority:

- uniform-width stroke only
- `inside` / `outside` / `center`
- `solid` / `dashed`
- `miter` / `bevel` / `round` joins
- `butt` / `square` / `round` caps
- dash pattern and dash offset behavior for the supported uniform-width path
  families
- render / hit-test / export parity for promoted geometry packets

Deferred to future-feature work, not the current execution critical path:

- paint/color expansion beyond already-recorded historical probes, including
  broader gradient-paint rollout
- variable-width product rollout

Interpretation rule:

- existing Phase 6 / Phase 7 notes remain as architecture-compatible backlog
  and historical evidence
- they do not outrank unfinished uniform-width stroke behavior
- downstream slice selection must prefer the next user-facing
  uniform-width stroke blocker first
- "good enough to move downstream" means good enough inside the formal
  uniform-width product target; it must not be used to permanently defer a
  baseline Figma-like stroke behavior that users expect in manual testing

## Execution Rules

1. No phase may bypass the architecture stage boundaries.
2. No phase may introduce mode-specific geometry engines.
3. No phase may use paint to repair geometry.
4. No phase may ship without the listed observability surfaces for the stages
   it enables.
5. If a phase gate turns red, later phases stop.
6. Temporary rollout limits must be declared explicitly in this document.
7. Future features such as gradient expansion and variable width may be
   deferred in rollout, but the data model must stay extensible enough that
   later work does not require a contract reset.
8. Before any scope expansion, the owner must run the mandatory three-question
   self-review:
   - which later phase is blocked if this case is deferred now
   - whether the case would change any externally exposed interface
   - whether the added work exceeds `20%` of the current phase scope
9. If the answer to the first question is "no later phase is blocked", the
   case goes to backlog and downstream work continues.
10. If the answer to the second question is "yes", interface changes must stop
    for explicit approval instead of being decided inside the phase.
11. If the answer to the third question is "more than 20%", expansion must
    stop for approval instead of being absorbed silently into the phase.
12. Every phase optimizes for "good enough to move downstream" rather than
    perfect edge-case coverage; deferred work must be recorded explicitly in
    backlog or blocked lists.
13. Algorithm work must follow the canonical flow contract before runtime
    implementation. If a helper/API sequence changes, update
    `professional-stroke-engine-algorithm-flow.md` before changing code.
14. Stroke work must use `stroke-engine-doc-source-of-truth.md` for document
    routing. Deprecated stroke manuals and legacy inside-dashed plans are not
    implementation authority.

## Verification Rules

These verification rules apply to every phase in this execution plan.

1. Every product-facing supported slice must have at least one visual test that
   runs through the real app/runtime path.
2. Every geometry / legality / ownership / paint algorithm introduced in a
   phase must have unit tests at the package level.
3. Visual tests define what the user must actually see.
4. Unit tests define what the algorithm must actually compute.
5. A phase is not DONE if only one side exists:
   - visual coverage without algorithm coverage is incomplete
   - algorithm coverage without visual coverage is incomplete
6. Visual tests may not rely on mocked stroke pipelines.
7. Unit tests should prefer real geometry helpers and canonical data contracts;
   mocks are only allowed for framework boundaries that are not part of the
   stroke algorithm itself.
8. Stroke testing must be scenario-matrix-first:
   - define scenario families first
   - define unit contracts from those families
   - define visual benchmarks from those families
   - map later regressions back to those families instead of letting bug
     reports become the main test taxonomy
9. Every new rendering or layout feature must ship a Scenario Axis Document
   before algorithm implementation begins.
10. Before a reported rendering issue is classified as a bug, the phase owner
    must check whether the observed result matches the intended product
    semantics for that scenario family.

## Implementation Order Constraints

The implementation order is constrained so later-stage work cannot backfill
missing earlier-stage architecture.

Forbidden order inversions:

- do not implement mesh or shader work before the corresponding final geometry
  contract is passing
- do not implement dashed rendering before the canonical interval allocator is
  passing
- do not implement legality clipping for a slice before ownership rules for that
  slice are passing
- do not implement paint-specific behavior before the geometry packet for that
  slice is canonical
- do not implement exporter-specific geometry before render and hit-test already
  use the same final geometry family

## Temporary Approximation Policy

Allowed temporary limitations:

- feature slices may remain unsupported if explicitly listed in a phase
- debug-only viewers may expose incomplete surfaces before the corresponding
  product slice is promoted

Forbidden temporary approximations:

- temporary ownership logic inside Stage 8 once Phase 4 begins
- temporary legality logic inside Stage 9 once Phase 2 begins
- pair-local repair paths that bypass Stage 7 overlay partition
- product-facing fallback that silently swaps back to legacy geometry for a
  promoted slice

## Phase 0. Foundations And Instrumentation

### Deliverables

- canonical authored stroke model
- canonical path model
- shared tolerance policy
- debug overlays for Stage 2 through Stage 6
- comparison harness for legacy vs new geometry

### Supported

- parsing and normalization only
- no product-facing promotion yet

### Forbidden

- shipping new geometry without the debug viewers
- private epsilon constants inside later stages

### Gate

- invalid stroke inputs normalize or reject deterministically
- tolerance policy is referenced from all geometry stages
- source slice and candidate preview can be visualized

## Phase 1. Uniform Solid Center Geometry

### Deliverables

- `solid + center + uniform width + solid paint`
- path -> placement -> candidate geometry -> final polygons -> mesh loop
- render / hit-test / export parity for the supported slice

### Supported

- open and closed paths
- joins: `miter`, `bevel`
- caps: `butt`, `square`
- Phase 5 shared centerline geometry now also promotes:
  - `round` join on closed center geometry
  - `round` cap on open center geometry

### Unsupported

- constrained legality
- dash patterns
- gradient paint
- variable width

### Gate

- canonical final geometry is the only source for render / hit-test / export
- mesh and polygons agree on golden fixtures
- screenshot-level visual benchmarks verify `rect center miter` keeps the
  outer corner square filled while `rect center bevel` cuts that square away
- no legacy fallback is used on the supported slice

### Current Status

- completed on `2026-04-17`
- promoted product-facing slice:
  - `rect`
  - `oval`
  - `vector`
- explicit non-slice behavior:
  - `frame` does not expose stroke
  - `round` joins / caps remain blocked
  - `dashed`, `inside`, `outside`, gradient paint, and variable width remain
    blocked
- completion notes:
  - authored `capType` now flows through schema, property UI, common APIs, and
    runtime normalization
  - render, hit-test, and export all derive from the same canonical final
    geometry packets
  - screenshot-level visual benchmarks now gate `rect center miter/bevel`
    behavior via `apps/asyra-design/e2e/solid-center-stroke-visual.spec.ts`
  - no legacy stroke runtime is used for the promoted slice

## Phase 2. Constrained Solid Geometry

### Deliverables

- `solid + inside/outside + uniform width + solid paint`
- legality domains
- constrained clipping using exact overflow only

### Supported

- closed non-self-intersecting paths
- joins: `miter`, `bevel`
- caps: `butt`, `square`

### Unsupported

- self-intersecting constrained paths
- gradient paint
- dashed
- variable width

### Gate

- open-path constrained strokes do not enter constrained clipping; authored
  `inside` / `outside` vector strokes render through the center fallback path
- no unconstrained geometry is routed through clipping helpers
- legality clipping preserves non-overflow geometry byte-for-byte
- supported visual benchmarks keep constrained band coverage above the defined
  probe thresholds for:
  - `rect inside/outside bevel`
  - `oval inside bevel`
  - closed non-self-intersecting `vector inside bevel`
- unsupported `round` join / cap constrained slices remain visually absent
- closed constrained `butt` / `square` cap variants stay visually equivalent

### Done Definition

Phase 2 is only DONE when all of the following are true at the same time:

- `apps/asyra-design/e2e/solid-constrained-stroke-visual.spec.ts` is green
- supported visual benchmarks are green for:
  - `rect inside bevel`
  - `rect outside bevel`
  - `rect inside miter`
  - `rect outside miter`
  - `oval inside bevel`
  - `oval outside bevel`
  - `oval inside miter`
  - `oval outside miter`
  - closed non-self-intersecting `vector inside bevel`
  - closed non-self-intersecting `vector outside bevel`
  - closed non-self-intersecting `vector inside miter`
  - closed non-self-intersecting `vector outside miter`
- unsupported visual benchmarks are green for:
  - constrained `round` join remains absent
  - constrained `round` cap remains absent
  - open constrained vector clipping remains absent while authored
    `inside/outside` vector strokes render through centered fallback
  - self-intersecting constrained vector paths remain absent
- closed constrained `butt` / `square` caps remain visually equivalent within
  the benchmark tolerance
- `yarn workspace @asyra/preset test:local` is green
- `yarn react:build` is green

### Current Status

- completed on `2026-04-17`
- promoted product-facing slice:
  - `rect`
  - `oval`
  - closed non-self-intersecting `vector`
- explicit non-slice behavior:
  - open constrained paths are rejected deterministically
  - self-intersecting constrained paths are rejected deterministically
  - `frame` does not expose stroke
  - `round` joins / caps remain blocked
  - `dashed`, gradient paint, and variable width remain blocked
- completion notes:
  - constrained solid geometry now derives from fresh legality-bounded
    polygons instead of any legacy stroke runtime
  - inside / outside render, hit-test, and export all consume the same
    canonical final geometry packets
  - promoted constrained slices do not route through legacy fallback or
    unconstrained clipping helpers
  - screenshot-level visual benchmarks now gate `rect`, `oval`, and closed
    `vector` constrained solid behavior via
    `apps/asyra-design/e2e/solid-constrained-stroke-visual.spec.ts`
  - current closeout validation commands:
    - `yarn workspace @asyra/asyra-design test:e2e e2e/solid-constrained-stroke-visual.spec.ts`
    - `yarn workspace @asyra/preset test:local`
    - `yarn react:build`

## Phase 3. Dashed Center Geometry

### Deliverables

- `dashed + center + uniform width + solid paint`
- dash pattern arrays
- dash offset
- seam-wrap interval continuity
- minimal variable-width probe fixtures on the shared pipeline

### Supported

- open and closed paths
- joins: `miter`, `bevel`
- caps: `butt`, `square`

### Unsupported

- constrained dashed legality
- gradient paint
- constrained round joins / round caps
- variable width

### Gate

- authored dash pattern is preserved through interval allocation
- seam-wrap continuity is deterministic
- dash offset changes do not rebuild unrelated geometry
- variable-width probe fixtures demonstrate that interval slicing, candidate
  band construction, and ownership-precondition data do not assume uniform width

### Done Definition

Phase 3 is only DONE when all of the following are true at the same time:

- `apps/asyra-design/e2e/dashed-center-stroke-visual.spec.ts` is green
- supported visual benchmarks are green for:
  - `rect center dashed` visible/gap probes
  - `rect center dashed` offset shift
  - `rect center dashed miter` corner silhouette
  - `rect center dashed bevel` corner silhouette
  - `oval center dashed` promoted-path coverage
  - closed `vector center dashed` promoted path
  - open `vector center dashed` promoted path
  - open `vector center dashed` `butt/square` cap distinction
  - closed `vector center dashed` `round` join curvature without miter overfill
  - open `vector center dashed` `round` cap terminal curvature without square
    overfill
- unsupported visual benchmarks are green for:
  - constrained dashed stroke remains absent
  - constrained round join / cap slices remain absent from the center dashed
    contract
- `yarn workspace @asyra/preset test:local` is green
- `yarn react:build` is green

### Current Status

- completed on `2026-04-18`
- promoted product-facing slice:
  - `rect`
  - `oval`
  - `vector`
- explicit non-slice behavior:
  - constrained dashed legality remains blocked
  - `round` joins / caps remain blocked
  - gradient paint and variable width remain blocked
- completion notes:
  - authored dashed strokes now normalize through canonical `dashPattern` and
    `dashOffset` data instead of scalar `dash/gap` runtime assumptions
  - center dashed packets now derive from fresh interval allocation and shared
    sliced-frame helpers, with no legacy dashed runtime reuse
  - a full-loop closed dash interval now preserves seam join continuity instead
    of degrading into open caps at the seam
  - offset changes are unit-guarded against rebuilding unrelated dashed packet
    geometry
  - minimal variable-width probe fixtures now verify the shared dashed frame
    slicer preserves asymmetric width probes without uniform-width assumptions
    across:
    - seam-wrap dashed-path slicing
    - acute-join interval slicing
  - minimal variable-width probe fixtures now verify dashed overlap-component
    detection stays deterministic on asymmetric, non-rectangular overlap bands
  - minimal variable-width probe fixtures now verify constrained inside legality
    clipping preserves asymmetric non-overflow geometry byte-for-byte on the
    shared clipping path
  - minimal variable-width probe fixtures now verify constrained outside
    legality clipping preserves asymmetric non-overflow geometry byte-for-byte
    on the shared clipping path
  - screenshot-level visual benchmarks now gate dashed center behavior via
    `apps/asyra-design/e2e/dashed-center-stroke-visual.spec.ts`

## Phase 4A. Overlap And Ownership On Center Dashed Geometry

### Deliverables

- overlap graph
- component extraction
- ownership resolution
- center-mode ownership debug surfaces

### Supported

- `dashed + center + uniform width + solid paint`
- open and closed paths
- joins: `miter`, `bevel`, plus Phase 5 promoted `round`
- caps: `butt`, `square`, plus Phase 5 promoted `round`

### Unsupported

- constrained legality
- self-intersecting ownership hardening
- gradient paint
- variable width

### Gate

- overlap solve is component-local
- ownership tie-breaks are deterministic
- ownership classification rules pass before priority rules run
- bailout preserves preview geometry and never leaks partial corruption
- closeout is locked by:
  - `apps/asyra-design/e2e/center-dashed-overlap-visual.spec.ts`
  - `yarn workspace @asyra/preset test:local`

## Phase 4B. Constrained Ownership And Legality On Solid Geometry

### Deliverables

- ownership-aware legality for constrained solid geometry
- legal owner domain construction in canonical polygon form
- constrained clipping with ownership-enabled legality

### Supported

- `solid + inside/outside + uniform width + solid paint`
- closed non-self-intersecting paths
- joins: `miter`, `bevel`
- caps: `butt`, `square`

### Unsupported

- dashed constrained legality
- self-intersecting constrained paths
- round joins / round caps
- gradient paint
- variable width

### Gate

- legal domains use one canonical polygon form across Stage 3, Stage 7, and
  Stage 9
- only eligible overflow enters clipping helpers
- legality clipping preserves non-overflow geometry byte-for-byte
- current groundwork visual closeout is locked by:
  - `apps/asyra-design/e2e/constrained-solid-legality-visual.spec.ts`
  - `yarn workspace @asyra/preset test:local`
- current groundwork runtime route must pass through the ownership-aware
  legality clipping helper even when the promoted slice results in no-op
  clipping preservation
- multi-network vector constrained ownership diagnostics must merge into one
  graphic-local namespace without deterministic id collisions
- current helper-level clipping support may expand incrementally, but any
  promoted outside clipping sub-slice must declare its complement-domain scope
  explicitly instead of implying full outside-domain clipping
- current outside complement groundwork now includes convex corner-overflow
  partitioning into disjoint sectors; broader non-convex or general owner-domain
  subtraction remains future work
- current ownership-region groundwork now promotes canonical shared overlap
  polygons for two-candidate convex components
- current ownership-region groundwork now also supports exact candidate-set
  regions for convex multi-candidate components in:
  - nested shared-overlap cases
  - partial-overlap cases without a shared all-candidate region
  - deterministic four-candidate chain components
  - deterministic four-candidate branch components
  - mixed-topology multi-polygon candidates composed from convex packet pieces
  - orthogonal non-convex single-polygon candidates after deterministic
    canonical rectangle decomposition
  - non-orthogonal non-convex single-polygon candidates after deterministic
    bounded ear decomposition
  - mixed-topology candidates that include orthogonal non-convex packet pieces
    after that same deterministic canonical rectangle decomposition
  - mixed-topology candidates that include non-orthogonal non-convex packet
    pieces after deterministic bounded ear decomposition
  - mixed-topology candidates that include multiple non-orthogonal non-convex
    packet pieces after deterministic bounded ear decomposition
- current 4B owner-domain clipping support now includes:
  - exact foreign-owned polygon removal
  - convex partial foreign-owned region subtraction that preserves the
    owner-domain remainder
  - orthogonal non-convex packet subtraction after deterministic canonical
    rectangle decomposition, preserving disconnected local remainders
  - non-orthogonal non-convex packet whole-drop when exact foreign-owned
    regions cover the whole non-owner packet after deterministic bounded ear
    decomposition
  - mixed-topology packet subtraction when the non-owner packet includes
    orthogonal non-convex pieces, still bounded by that same canonical
    rectangle decomposition path
  - mixed-topology packet whole-drop when the non-owner packet includes
    non-orthogonal non-convex pieces and exact foreign-owned regions cover all
    packet pieces on that same bounded ear-decomposition path
  - mixed-topology packet subtraction when the non-owner packet includes
    non-orthogonal non-convex pieces, still bounded by that same
    ear-decomposition path
  - mixed-topology packet subtraction when the non-owner packet includes
    multiple non-orthogonal non-convex pieces, still bounded by that same
    ear-decomposition path
  - multi-polygon packets composed entirely of orthogonal non-convex pieces
    when exact foreign-owned regions cover the whole non-owner packet
  broader mixed-topology or general non-convex owner-domain subtraction
  remains future work beyond the bounded orthogonal decomposition slice
- current 4B closeout also requires a real app-path visual benchmark proving
  owner-domain clipping keeps the owner stroke visible while exact
  foreign-owned outside polygons remain absent
- current 4B bounded expansion must stop once the next uncovered family
  requires:
  - broader mixed-topology subtraction beyond the declared bounded paths
  - broader general non-convex owner-domain construction
  - general polygon-boolean semantics
  at that point a new plan or explicit next-phase algorithm is required
  instead of further micro-slice expansion under 4B
- broader algorithm work must now route through:
  - `docs/ai/apps/asyra-design/plans/professional-stroke-engine-algorithm-flow.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-promotion-ledger.md`
- the first promoted broader scenario on that path is nested five-candidate
  exact candidate-set ownership beyond the former four-candidate cap
- the second promoted broader scenario on that path is nested six-candidate
  exact candidate-set ownership beyond the former five-candidate cap
- the third promoted broader scenario on that path is nested seven-candidate
  exact candidate-set ownership beyond the former six-candidate cap
- the fourth promoted broader scenario on that path is nested eight-candidate
  exact candidate-set ownership beyond the former seven-candidate cap
- the fifth promoted broader scenario on that path is nested nine-candidate
  exact candidate-set ownership beyond the former eight-candidate cap
- the sixth promoted broader scenario on that path replaces the artificial
  nested-convex candidate cap with a subset-budget gate, proven by ten nested
  constrained solid components on the same exact candidate-set path
- the seventh promoted broader scenario on that path is mixed-topology
  five-candidate exact candidate-set ownership across disconnected
  multi-polygon sub-packets, with vector-generated app-path visual coverage
  and vector constrained render/export now routed through ownership-clipped
  constrained packets instead of raw constrained packets
- the eighth promoted broader scenario on that path is mixed-topology
  six-candidate exact candidate-set ownership across disconnected
  multi-polygon sub-packets, with vector-generated app-path visual coverage
- the ninth promoted broader scenario on that path is broader mixed-topology
  subtraction that preserves local miter remainders when a bevel owner clips
  disconnected vector-generated sub-packets, with app-path visual coverage on a
  multi-network vector-generated path
- the tenth promoted broader scenario on that path is shape/vector
  equivalence on that broader subtraction family, proving shape-generated and
  vector-generated closed rectangles keep equivalent local miter remainders
  with matching unit and app-path visual coverage
- the eleventh promoted broader scenario on that path extends the broader
  mixed-topology subtraction family to a disconnected vector-generated path
  where one sub-packet is a non-orthogonal non-convex piece, while the local
  miter remainder still remains visible with matching unit and app-path
  visual coverage
- the twelfth promoted broader scenario on that path closes the first Family B
  equivalence gate for non-orthogonal non-convex mixed-topology input, proving
  equivalent vector-generated paths keep deterministic owner-domain
  construction and equivalent local miter remainders with matching unit and
  app-path visual coverage
- the thirteenth promoted broader scenario on that path extends the broader
  mixed-topology subtraction family to vector-generated paths where multiple
  disconnected sub-packets are non-orthogonal non-convex pieces, while the
  local miter remainders still remain visible with matching product-path and
  app-path visual coverage

## Phase 4C. Dashed Constrained Geometry

### Deliverables

- `dashed + inside/outside + uniform width + solid paint`
- overlap graph
- legal owner domain clipping

### Supported

- closed non-self-intersecting paths
- joins: `miter`, `bevel`
- caps: `butt`, `square`

### Unsupported

- self-intersecting constrained paths
- round joins / round caps
- gradient paint
- variable width

### Gate

- overlap solve is component-local
- ownership tie-breaks are deterministic
- bailout preserves preview geometry and never leaks partial corruption
- only eligible overflow enters clipping helpers

### Current Status

- started on `2026-04-21`
- first declared Phase 4C contract now lives in:
  - `docs/ai/apps/asyra-design/plans/dashed-constrained-scenario-matrix.md`
- current helper-level entry slice:
  - full-loop visible constrained dashed intervals on closed paths
  - repeated non-full-loop constrained dashed intervals on valid closed
    legality domains
- helper-level groundwork now exists for:
  - constrained dashed packet derivation on full-loop visible intervals
  - open-path constrained rejection with vector app-path center fallback for
    authored `inside` / `outside`
  - constrained dashed packet derivation for repeated non-full-loop intervals
    on valid closed legality domains
- first promoted product-facing slice now exists for:
  - shape-generated `rect`
  - `position: inside`
  - one full-loop visible constrained dashed interval on a closed path
- next promoted product-facing slice now extends the same Family A path to:
  - shape-generated `rect`
  - `position: outside`
  - one full-loop visible constrained dashed interval on a closed path
- next promoted shape-generated slice now exists for:
  - `oval`
  - `position: inside`
  - `position: outside`
  - one full-loop visible constrained dashed interval on a closed path
- first promoted vector-generated slice now exists for:
  - closed single-network rectangle-equivalent `vector`
  - `position: inside`
  - `position: outside`
  - one full-loop visible constrained dashed interval on a closed path
- first broader vector-generated slice now exists for:
  - closed single-network non-rectangle-equivalent quadrilateral `vector`
  - `position: inside`
  - `position: outside`
  - one full-loop visible constrained dashed interval on a closed path
- first Family D equivalence gate is now closed for:
  - shape-generated `rect`
  - vector-generated closed single-network rectangle-equivalent `vector`
  - matching `inside/outside` full-loop constrained dashed coverage
- first Family B product-facing slice now exists for:
  - shape-generated `rect`
  - `position: inside`
  - `position: outside`
  - one single-edge visible constrained dashed interval on a closed path
- next Family B product-facing slice now exists for:
  - vector-generated closed single-network rectangle-equivalent `vector`
  - `position: inside`
  - `position: outside`
  - one single-edge visible constrained dashed interval on a closed path
- next broader Family B product-facing slice now exists for:
  - vector-generated closed single-network non-rectangle-equivalent
    quadrilateral `vector`
  - `position: inside`
  - `position: outside`
  - one single-edge visible constrained dashed interval on a closed path
- first Family C product-facing slice now exists for:
  - shape-generated `rect`
  - `position: inside`
  - `join: bevel`
  - `join: miter`
  - one corner-spanning visible constrained dashed interval on a closed path
- next bounded Family C product-facing slice now exists for:
  - shape-generated `rect`
  - `position: outside`
  - `join: bevel`
  - `join: miter`
  - one corner-spanning visible constrained dashed interval on a closed path
- first vector-generated Family C product-facing slice now exists for:
  - closed single-network rectangle-equivalent `vector`
  - `position: inside`
  - `join: bevel`
  - `join: miter`
  - one corner-spanning visible constrained dashed interval on a closed path
- next bounded vector-generated Family C product-facing slice now exists for:
  - closed single-network rectangle-equivalent `vector`
  - `position: outside`
  - `join: bevel`
  - `join: miter`
  - one corner-spanning visible constrained dashed interval on a closed path
- first broader vector-generated Family C product-facing slice now exists for:
  - closed single-network non-rectangle-equivalent quadrilateral `vector`
  - `position: inside`
  - `join: bevel`
  - `join: miter`
  - `position: outside`
  - `join: bevel`
  - `join: miter`
  - one corner-spanning visible constrained dashed interval on a closed path
- first Family B and Family D crossover gate is now closed for:
  - shape-generated `rect`
  - vector-generated closed single-network rectangle-equivalent `vector`
  - matching `inside/outside` single-edge constrained dashed coverage
- first Family E blocked-behavior visual gate now exists for:
  - shape-generated `rect`
  - multiple eligible constrained dashed strokes remain visually absent until
    4C ownership is promoted
- next Family E blocked-behavior visual gate now exists for:
  - self-intersecting constrained dashed full-loop `vector`
  - the unsupported exact constrained topology remains visually absent on the
    app path
- third Family E blocked-behavior visual gate now exists for:
  - multi-network constrained dashed `vector`
  - the ownership-blocked topology remains visually absent on the app path
- fourth Family E visual gate is now corrected for:
  - open-path constrained dashed `vector`
  - authored `inside` / `outside` remains stored in scene data
  - the unsupported constrained topology does not enter constrained clipping
  - the app path renders the open stroke as centered fallback instead of
    disappearing
- constrained dashed multi-interval placement now covers:
  - real-created simple closed single-network `vector`
  - closed cubic single-network `vector` when the sampled closed legality
    domain is valid
  - the reported closed star-like single-network `vector` when the sampled
    closed legality domain is valid
  - repeated dashed interval pattern such as `20,20`
  - switching the same stroke row from `center` to authored `inside` /
    `outside`
- product-facing visibility fallback remains limited to:
  - real-created open single-network `vector`
  - repeated dashed interval pattern such as `20,20`
  - switching the same stroke row from `center` to authored `inside` /
    `outside`
  - open-path constrained inside/outside geometry remains unpromoted; the
    fallback is centered visibility only
- first Phase 5 promoted representative now exists for:
  - shape-generated `rect`
  - constrained dashed `full-loop + inside + round join`
  - the bounded app path now renders through the first round-join slice
- next Phase 5 promoted representative now exists for:
  - shape-generated `rect`
  - constrained dashed `full-loop + outside + round join`
  - the bounded app path now renders through the next outside round-join slice
- next vector-generated Phase 5 promoted representative now exists for:
  - closed single-network rectangle-equivalent `vector`
  - constrained dashed `full-loop + outside + round join`
  - the bounded app path now renders through the next vector outside
    round-join slice
- next broader vector-generated Phase 5 promoted representative now exists for:
  - closed single-network non-rectangle-equivalent quadrilateral `vector`
  - constrained dashed `full-loop + outside + round join`
  - the bounded app path now renders through the next broader vector outside
    round-join slice
- next Phase 5 promoted representative now exists for:
  - shape-generated `rect`
  - constrained dashed `corner-spanning + inside + round join`
  - the bounded app path now renders the first legal-turn round-join partial
    dash without dropping the interval
- next Phase 5 promoted representative now exists for:
  - shape-generated `rect`
  - constrained dashed `corner-spanning + outside + round join`
  - the bounded app path now renders the matching exterior legal-turn
    round-join partial dash
- next vector-generated Phase 5 promoted representative now exists for:
  - closed single-network rectangle-equivalent `vector`
  - constrained dashed `corner-spanning + inside + round join`
  - the bounded app path now renders the first vector legal-turn round-join
    partial dash
- next vector-generated Phase 5 promoted representative now exists for:
  - closed single-network rectangle-equivalent `vector`
  - constrained dashed `corner-spanning + outside + round join`
  - the bounded app path now renders the matching vector exterior legal-turn
    round-join partial dash
- next Phase 5 promoted representative now exists for:
  - shape-generated `rect`
  - constrained dashed `single-edge + inside + round cap`
  - the bounded app path now renders through the next round-cap slice
- next Phase 5 promoted representative now exists for:
  - shape-generated `rect`
  - constrained dashed `single-edge + outside + round cap`
  - the bounded app path now renders through the next outside round-cap slice
- next vector-generated Phase 5 promoted representative now exists for:
  - closed single-network rectangle-equivalent `vector`
  - constrained dashed `single-edge + outside + round cap`
  - the bounded app path now renders through the next vector outside round-cap slice
- next broader vector-generated Phase 5 promoted representative now exists for:
  - closed single-network non-rectangle-equivalent quadrilateral `vector`
  - constrained dashed `single-edge + outside + round cap`
  - the bounded app path now renders through the next broader vector outside
    round-cap slice
- first vector-generated Phase 5 promoted representative now exists for:
  - closed single-network rectangle-equivalent `vector`
  - constrained dashed `full-loop + inside + round join`
  - the bounded app path now renders through the first vector round-join slice
- next vector-generated Phase 5 promoted representative now exists for:
  - closed single-network rectangle-equivalent `vector`
  - constrained dashed `single-edge + inside + round cap`
  - the bounded app path now renders through the first vector round-cap slice
- next broader vector-generated Phase 5 promoted representative now exists for:
  - closed single-network non-rectangle-equivalent quadrilateral `vector`
  - constrained dashed `single-edge + inside + round cap`
  - the bounded app path now renders through the first broader vector round-cap slice
- next broader vector-generated Phase 5 promoted representative now exists for:
  - closed single-network non-rectangle-equivalent quadrilateral `vector`
  - constrained dashed `full-loop + inside + round join`
  - the bounded app path now renders through the first broader vector round-join slice
- first Phase 5 Family D equivalence gate is now closed for:
  - shape-generated `rect`
  - closed single-network rectangle-equivalent `vector`
  - matching `full-loop + inside + round join` constrained dashed coverage
- next Phase 5 Family D equivalence gate is now closed for:
  - shape-generated `rect`
  - closed single-network rectangle-equivalent `vector`
  - matching `full-loop + outside + round join` constrained dashed coverage
- next Phase 5 Family D equivalence gate is now closed for:
  - shape-generated `rect`
  - closed single-network rectangle-equivalent `vector`
  - matching `single-edge + inside + round cap` constrained dashed coverage
- next Phase 5 Family D equivalence gate is now closed for:
  - shape-generated `rect`
  - closed single-network rectangle-equivalent `vector`
  - matching `single-edge + outside + round cap` constrained dashed coverage
- first Phase 6 promoted representative now exists for:
  - shape-generated `rect`
  - constrained dashed `full-loop + inside + local-bounds linear gradient paint`
  - the bounded app/runtime path now swaps paint without changing the promoted
    constrained dashed geometry packet
- next Phase 6 promoted representative now exists for:
  - shape-generated `rect`
  - constrained dashed `full-loop + outside + local-bounds linear gradient paint`
  - the bounded app/runtime path now swaps paint without changing the promoted
    outside constrained dashed geometry packet
- next vector-generated Phase 6 promoted representative now exists for:
  - closed single-network rectangle-equivalent `vector`
  - constrained dashed `full-loop + inside + local-bounds linear gradient paint`
  - the bounded app/runtime path now reuses the same constrained dashed
    geometry packet on the first vector-generated gradient slice
- next vector-generated Phase 6 promoted representative now exists for:
  - closed single-network rectangle-equivalent `vector`
  - constrained dashed `full-loop + outside + local-bounds linear gradient paint`
  - the bounded app/runtime path now reuses the same constrained dashed
    geometry packet on the first vector-generated outside-gradient slice
- next broader vector-generated Phase 6 promoted representative now exists for:
  - closed single-network non-rectangle-equivalent quadrilateral `vector`
  - constrained dashed `full-loop + inside + local-bounds linear gradient paint`
  - the bounded app/runtime path now reuses the same constrained dashed
    geometry packet on the first broader vector-generated gradient slice
- next broader vector-generated Phase 6 promoted representative now exists for:
  - closed single-network non-rectangle-equivalent quadrilateral `vector`
  - constrained dashed `full-loop + outside + local-bounds linear gradient paint`
  - the bounded app/runtime path now reuses the same constrained dashed
    geometry packet on the first broader vector-generated outside-gradient slice
- next Phase 6 promoted representative now exists for:
  - shape-generated `rect`
  - constrained dashed `single-edge + inside + local-bounds linear gradient paint`
  - the bounded app/runtime path now swaps paint without changing the promoted
    single-edge constrained dashed geometry packet
- next Phase 6 promoted representative now exists for:
  - shape-generated `rect`
  - constrained dashed `single-edge + outside + local-bounds linear gradient paint`
  - the bounded app/runtime path now swaps paint without changing the promoted
    exterior single-edge constrained dashed geometry packet
- next vector-generated Phase 6 promoted representative now exists for:
  - closed single-network rectangle-equivalent `vector`
  - constrained dashed `single-edge + inside + local-bounds linear gradient paint`
  - the bounded app/runtime path now swaps paint without changing the promoted
    single-edge constrained dashed geometry packet on the first vector-generated
    interval-local gradient slice
- next vector-generated Phase 6 promoted representative now exists for:
  - closed single-network rectangle-equivalent `vector`
  - constrained dashed `single-edge + outside + local-bounds linear gradient paint`
  - the bounded app/runtime path now swaps paint without changing the promoted
    exterior single-edge constrained dashed geometry packet on the first
    vector-generated outside interval-local gradient slice
- next broader vector-generated Phase 6 promoted representative now exists for:
  - closed single-network non-rectangle-equivalent quadrilateral `vector`
  - constrained dashed `single-edge + inside + local-bounds linear gradient paint`
  - the bounded app/runtime path now swaps paint without changing the promoted
    single-edge constrained dashed geometry packet on the first broader
    vector-generated interval-local gradient slice
- next broader vector-generated Phase 6 promoted representative now exists for:
  - closed single-network non-rectangle-equivalent quadrilateral `vector`
  - constrained dashed `single-edge + outside + local-bounds linear gradient paint`
  - the bounded app/runtime path now swaps paint without changing the promoted
    exterior single-edge constrained dashed geometry packet on the first
    broader vector-generated outside interval-local gradient slice
- next Phase 6 promoted representative now exists for:
  - shape-generated `rect`
  - constrained dashed `inside + bevel + corner-spanning + local-bounds linear gradient paint`
  - the bounded app/runtime path now swaps paint without changing the promoted
    corner-spanning constrained dashed geometry packet on the first legal-turn
    gradient slice
- next vector-generated Phase 6 promoted representative now exists for:
  - closed single-network rectangle-equivalent `vector`
  - constrained dashed `inside + bevel + corner-spanning + local-bounds linear gradient paint`
  - the bounded app/runtime path now swaps paint without changing the promoted
    corner-spanning constrained dashed geometry packet on the first vector-generated
    legal-turn gradient slice
- next broader vector-generated Phase 6 promoted representative now exists for:
  - closed single-network non-rectangle-equivalent quadrilateral `vector`
  - constrained dashed `inside + bevel + corner-spanning + local-bounds linear gradient paint`
  - the bounded app/runtime path now swaps paint without changing the promoted
    corner-spanning constrained dashed geometry packet on the first broader
    vector-generated legal-turn gradient slice
- next Phase 6 promoted representative now exists for:
  - shape-generated `rect`
  - constrained dashed `outside + bevel + corner-spanning + local-bounds linear gradient paint`
  - the bounded app/runtime path now swaps paint without changing the promoted
    exterior corner-spanning constrained dashed geometry packet on the first
    outside legal-turn gradient slice
- next vector-generated Phase 6 promoted representative now exists for:
  - closed single-network rectangle-equivalent `vector`
  - constrained dashed `outside + bevel + corner-spanning + local-bounds linear gradient paint`
  - the bounded app/runtime path now swaps paint without changing the promoted
    exterior corner-spanning constrained dashed geometry packet on the first
    vector-generated outside legal-turn gradient slice
  - constrained dashed `outside + bevel + corner-spanning + local-bounds linear gradient paint`
  - the bounded app/runtime path now swaps paint without changing the promoted
    exterior corner-spanning constrained dashed geometry packet on the first
    outside legal-turn gradient slice
- first Phase 6 Family D equivalence gate is now closed for:
  - shape-generated `rect`
  - closed single-network rectangle-equivalent `vector`
  - constrained dashed `full-loop + inside + local-bounds linear gradient paint`
  - the bounded app/runtime path now keeps matching inner-band gradient paint
    coverage on the same promoted geometry packet across the first
    shape/vector Phase 6 source pair
- first product-path unit contract now lives in:
  - `packages/preset/src/__tests__/primitive-shape-constrained-dashed-stroke.test.ts`
- first app-path visual benchmark contract now lives in:
  - `apps/asyra-design/e2e/constrained-dashed-stroke-visual.spec.ts`
  - `apps/asyra-design/e2e/definitions/constrained-dashed-stroke-visual.definition.md`
- explicit non-slice behavior on the current promoted path:
  - corner-spanning constrained dashed intervals beyond the currently promoted
    representatives remain blocked:
    - shape-generated `rect`
      - `inside + bevel`
      - `inside + miter`
      - `outside + bevel`
      - `outside + miter`
    - vector-generated closed single-network rectangle-equivalent `vector`
      - `inside + bevel`
      - `inside + miter`
      - `outside + bevel`
      - `outside + miter`
    - vector-generated closed single-network non-rectangle-equivalent
      quadrilateral `vector`
      - `inside + bevel`
      - `inside + miter`
      - `outside + bevel`
      - `outside + miter`
  - vector-generated and shape-generated non-rect corner-spanning constrained
    dashed intervals beyond the first broader vector-generated
    non-rectangle-equivalent `inside + bevel/miter` plus
    `outside + bevel/miter` representatives remain blocked
  - broader constrained dashed intervals beyond:
    - the shape-generated `rect` single-edge slice
    - the first vector-generated rectangle-equivalent single-edge slice
    - the first broader vector-generated non-rectangle-equivalent single-edge
      slice
    remain blocked
  - round joins / caps beyond the first promoted Phase 5 representatives remain
    blocked:
    - `rect + full-loop + inside + round join`
    - `rect + full-loop + outside + round join`
    - `rect + single-edge + inside + round cap`
    - `rect + single-edge + outside + round cap`
    - `vector rectangle-equivalent + full-loop + inside + round join`
    - `vector rectangle-equivalent + full-loop + outside + round join`
    - `vector rectangle-equivalent + single-edge + inside + round cap`
    - `vector rectangle-equivalent + single-edge + outside + round cap`
    - `broader vector non-rectangle-equivalent + single-edge + inside + round cap`
    - `broader vector non-rectangle-equivalent + single-edge + outside + round cap`
    - `broader vector non-rectangle-equivalent + full-loop + inside + round join`
    - `broader vector non-rectangle-equivalent + full-loop + outside + round join`
  - constrained dashed gradient paint beyond the current promoted Phase 6
    representatives remain blocked:
    - only these representatives are promoted:
      - `rect + full-loop + inside + local-bounds linear gradient paint`
      - `rect + full-loop + outside + local-bounds linear gradient paint`
      - `rect + single-edge + inside + local-bounds linear gradient paint`
      - `rect + single-edge + outside + local-bounds linear gradient paint`
      - `vector rectangle-equivalent + full-loop + inside + local-bounds linear gradient paint`
      - `vector rectangle-equivalent + full-loop + outside + local-bounds linear gradient paint`
      - `vector rectangle-equivalent + single-edge + inside + local-bounds linear gradient paint`
      - `vector rectangle-equivalent + single-edge + outside + local-bounds linear gradient paint`
      - `vector rectangle-equivalent + inside + bevel + corner-spanning + local-bounds linear gradient paint`
      - `broader vector non-rectangle-equivalent + full-loop + inside + local-bounds linear gradient paint`
      - `broader vector non-rectangle-equivalent + full-loop + outside + local-bounds linear gradient paint`
      - `broader vector non-rectangle-equivalent + single-edge + inside + local-bounds linear gradient paint`
      - `broader vector non-rectangle-equivalent + single-edge + outside + local-bounds linear gradient paint`
      - `broader vector non-rectangle-equivalent + inside + bevel + corner-spanning + local-bounds linear gradient paint`
      - `rect + inside + bevel + corner-spanning + local-bounds linear gradient paint`
      - `rect + outside + bevel + corner-spanning + local-bounds linear gradient paint`
    - only the first rectangle-equivalent Phase 6 Family D equivalence gate is closed
    - broader gradient-paint slices beyond these first vector-generated representatives remain blocked
    - corner-spanning constrained dashed gradient paint beyond the first
      promoted `inside/outside + bevel` shape representatives plus the first
      rectangle-equivalent and broader-vector `inside + bevel`
      representatives remains blocked
  - open constrained dashed paths remain blocked
  - multiple eligible constrained dashed strokes remain blocked until 4C
    ownership is promoted
  - multi-network constrained dashed `vector` promotion has not happened yet

## Phase 5. Round Geometry And Visual Fidelity

### Deliverables

- round joins
- round caps
- smooth high-curvature fixture closure
- dense dash fixture closure

### Supported

- all Phase 4 slices plus round joins / caps

### Current Priority

- Phase 5 is the active execution frontier until the uniform-width round /
  dashed matrix is complete enough for manual product testing.
- The center-placement dashed baseline now includes:
  - `center + dashed + round join` on a closed orthogonal vector representative
  - `center + dashed + round cap` on an open vector representative

### Unsupported

- gradient paint
- variable width
- self-intersecting constrained paths

### Gate

- round joins and caps reuse the same ownership and legality architecture
- golden polygon, mesh, and screenshot fixtures pass on the supported matrix
- no corner-family-specific workaround remains

## Phase 6. Gradient Paint (Future Feature For Current Execution)

### Deliverables

- solid and gradient paint over final stroke geometry
- local-bounds and object-space gradient sampling
- paint-only dirty path

### Responsibility Boundary

Stroke geometry remains responsible only for:

- producing the correct visible stroke region for `inside` / `outside` /
  `center`
- enforcing geometry-side constraints such as miter limits and high-curvature
  turn handling
- exposing the geometry-space data required by paint, such as final bounds and
  UV inputs

Gradient paint remains responsible only for:

- applying paint over the final geometry packet
- color evaluation and stop interpolation
- gradient sampling behavior

Forbidden responsibility drift:

- geometry must not own gradient application logic
- geometry must not own color calculation
- geometry must not own gradient sampling policy

### Supported

- all previously promoted geometry slices
- paint kinds: `solid`, `gradient`

### Unsupported

- world-space gradient production enablement
- variable width

### Gate

- paint-only edits do not invalidate geometry caches
- gradient and solid paints share the same geometry packets
- render and export paint parity pass on golden fixtures

## Phase 7. Variable Width (Future Feature For Current Execution)

### Deliverables

- width profile evaluation on source slices
- variable-width band construction
- variable-width ownership and legality

### Supported

- promoted slices from previous phases with width profiles

### Unsupported

- none beyond explicitly listed rollout limits

### Gate

- width profiles do not fork the geometry engine
- interval semantics remain arc-length based
- ownership and clipping remain deterministic under width variation

## Phase 8. Self-Intersection And Hardening

### Deliverables

- constrained legality on self-intersecting closed paths
- finalized fill-rule policy
- exporter parity hardening
- performance benchmark ceilings

### Gate

- self-intersection legality is deterministic under declared fill rule
- fuzz and regression suites pass
- no supported slice falls back to legacy geometry

## Dash Extreme-Case Gates

Required before Phase 3 promotion:

- dash elements below `minIntervalLength` are normalized deterministically
- gap-collapse cases are normalized deterministically
- seam-wrap offset plus short-pattern cases preserve interval ordering

## Miter Boundary Gates

Required before Phase 1 promotion:

- `miterLimit` acceptance uses the canonical miter formula, not a visual proxy
- over-limit miter joins degrade deterministically to bevel behavior
- near-threshold miter joins remain stable across repeated recomputation

Required before Phase 7 promotion:

- variable-width joins use the same miter policy with conservative effective
  half-width evaluation
- variable-width miter acceptance does not fork the join engine into a separate
  path

## Performance Thresholds

The rollout is not complete with qualitative performance language alone.

Required thresholds:

- local stroke edit on a promoted slice:
  - median geometry update cost `<= 4 ms`
  - p95 geometry update cost `<= 8 ms`
- paint-only edit on a promoted slice:
  - median end-to-end update cost `<= 2 ms`
  - must not trigger geometry rebuild
- overlap solve on a promoted slice:
  - component solve complexity must remain component-local
  - single component interval count above `128` must trigger explicit bailout or
    staged degradation, never silent global solve
- dirty interval recomputation:
  - a single local dash edit must not rebuild unrelated intervals on the same
    path

## Ownership Decision Table

### Required Priority Order

1. same-interval primitive merge
2. continuity-preserving same-stroke owner
3. primitive priority:
   - `body`
   - `join`
   - `cap`
4. lower normal distance to source slice
5. lower interval start distance
6. lower authored visible interval index
7. stable interval id

### Required Tests

- same-interval primitive overlap
- adjacent visible interval overlap
- seam-wrap overlap
- cap vs join overlap
- multi-interval equal-distance tie
- traversal-order independence

## Legality Decision Table

### Required Policy

- `center`: no clipping
- `inside`: clip only true overflow against closed interior legality domain
- `outside`: clip only true overflow against closed exterior legality domain

### Required Rejections

- open path `inside` / `outside` constrained clipping, with app-path vector
  render fallback to `center`
- true self-intersecting vector constrained dashed multi-interval placement,
  until the closed fill-rule legality domain is declared and promoted
- constrained path with unstable orientation
- constrained path with invalid fill-rule evaluation

### Required Tests

- closed non-self-intersecting inside
- closed non-self-intersecting outside
- self-intersecting fill-rule cases
- constrained legality bailout
- no-op clipping preservation

## Numerical Robustness Deliverables

Every promoted phase must declare the tolerances it uses from the shared
policy. No local epsilon constants are allowed.

Required test families:

- near-parallel segments
- near-collinear joins
- near-zero segments
- near-zero intervals
- miter-threshold boundary
- over-limit miter spike
- near-threshold miter recomputation stability
- polygon boolean tolerance boundary

## Variable-Width Ownership Invariant Tests

These fixtures must exist before Phase 7 promotion and must begin as probe
fixtures during Phase 3 and Phase 4.

Required fixture families:

- asymmetric width + acute join
- asymmetric width + dashed overlap
- asymmetric width + `inside`
- asymmetric width + `outside`
- asymmetric width + seam-wrap dashed path

Required invariants:

- ownership result remains deterministic under traversal reorder
- ownership tie-break does not fork into a width-specific rule set
- legality clipping does not erase non-overflow geometry under asymmetric width
- variable-width candidate classification remains compatible with `body` /
  `join` / `cap` predicates

## Debug And Observability Deliverables

Each promoted phase must expose the stage viewers required to debug it.

Minimum required tools by rollout end:

- source slice viewer
- candidate primitive viewer
- overlap graph viewer
- ownership region viewer
- legality domain viewer
- final polygon viewer
- mesh wireframe viewer
- bailout logger
- dirty graph inspector

## Golden Test Matrix

Every promoted phase must add the affected combinations to the golden suite.

Core fixture set:

- straight segment
- acute polyline
- obtuse polyline
- smooth cubic
- closed rectangle
- closed circle seam wrap
- star overlap
- dense dash pattern
- wide miter threshold
- near-zero segment
- single-point path

## Phase Regression Lock

Each promotion must preserve all earlier promoted slices.

Required lock rules:

- Phase 3 promotion may not change any passing Phase 1 or Phase 2 snapshots
  without explicit approval and baseline refresh
- Phase 5 promotion may not alter approved `miter` or `bevel` outputs while
  enabling `round`
- Phase 7 promotion may not alter approved uniform-width outputs while enabling
  width profiles
- every promoted phase must run the golden suite for all earlier promoted
  phases, not only its own new fixtures

## Migration Plan

### Rule 1

Promote by supported behavior slice, not by ad hoc bug family.

### Rule 2

When a slice is promoted for rendering, hit-test and export for that same slice
must move together unless explicitly blocked in this document.

### Rule 3

Legacy vs new comparison mode may exist only while the current phase gates are
open. Once a slice is promoted, long-term dual ownership is not allowed.

### Rule 4

Component-local bailout is allowed. Silent fallback to a legacy geometry path on
the same supported slice is not allowed.

## Promoted Behavior Matrix By Phase

| Phase | Promoted combinations |
| --- | --- |
| Phase 1 | `solid + center + solid` |
| Phase 2 | `solid + inside + solid`, `solid + outside + solid` |
| Phase 3 | `dashed + center + solid` |
| Phase 4A | `dashed + center + solid` with overlap and ownership enabled |
| Phase 4B | `solid + inside + solid`, `solid + outside + solid` with ownership-aware legality enabled |
| Phase 4C | `dashed + inside + solid`, `dashed + outside + solid` |
| Phase 5 | same geometry slices as Phase 4 with `round` join / cap enabled |
| Phase 6 | all promoted geometry slices with `gradient` paint |
| Phase 7 | all promoted slices with variable width |
| Phase 8 | self-intersecting constrained closed-path promotion and hardening |

## Final Acceptance

This execution plan is complete only when:

- all phases above have explicit pass/fail gates
- every promoted slice is covered by geometry, render, and performance tests
- debug surfaces exist for every active stage
- no implementation step requires redefinition of the architecture data model
