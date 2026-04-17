# Execution Plan: Professional Stroke Engine

## Purpose

This document is the implementation-ready rollout plan for the professional
stroke engine architecture.

It exists so the architecture spec cannot be interpreted as an invitation to
implement arbitrary slices in arbitrary order.

Companion architecture spec:

- `docs/ai/apps/asyra-design/plans/professional-stroke-engine-plan.md`

## Execution Rules

1. No phase may bypass the architecture stage boundaries.
2. No phase may introduce mode-specific geometry engines.
3. No phase may use paint to repair geometry.
4. No phase may ship without the listed observability surfaces for the stages
   it enables.
5. If a phase gate turns red, later phases stop.
6. Temporary rollout limits must be declared explicitly in this document.
7. Variable width may be deferred in rollout, but the data model may not be
   rewritten later to make room for it.

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

### Unsupported

- constrained legality
- dash patterns
- gradient paint
- round joins / round caps
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

- open-path constrained strokes are rejected deterministically
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
  - open constrained vector paths remain absent
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
- round joins / round caps
- variable width

### Gate

- authored dash pattern is preserved through interval allocation
- seam-wrap continuity is deterministic
- dash offset changes do not rebuild unrelated geometry
- variable-width probe fixtures demonstrate that interval slicing, candidate
  band construction, and ownership-precondition data do not assume uniform width

## Phase 4A. Overlap And Ownership On Center Dashed Geometry

### Deliverables

- overlap graph
- component extraction
- ownership resolution
- center-mode ownership debug surfaces

### Supported

- `dashed + center + uniform width + solid paint`
- open and closed paths
- joins: `miter`, `bevel`
- caps: `butt`, `square`

### Unsupported

- constrained legality
- self-intersecting ownership hardening
- round joins / round caps
- gradient paint
- variable width

### Gate

- overlap solve is component-local
- ownership tie-breaks are deterministic
- ownership classification rules pass before priority rules run
- bailout preserves preview geometry and never leaks partial corruption

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

## Phase 5. Round Geometry And Visual Fidelity

### Deliverables

- round joins
- round caps
- smooth high-curvature fixture closure
- dense dash fixture closure

### Supported

- all Phase 4 slices plus round joins / caps

### Unsupported

- gradient paint
- variable width
- self-intersecting constrained paths

### Gate

- round joins and caps reuse the same ownership and legality architecture
- golden polygon, mesh, and screenshot fixtures pass on the supported matrix
- no corner-family-specific workaround remains

## Phase 6. Gradient Paint

### Deliverables

- solid and gradient paint over final stroke geometry
- local-bounds and object-space gradient sampling
- paint-only dirty path

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

## Phase 7. Variable Width

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

- open path `inside`
- open path `outside`
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
