# Constrained Solid Ownership / Legality Scenario Matrix

## Role

This file is the Scenario Axis Document for Phase 4B constrained ownership and
legality on solid geometry under
`docs/ai/apps/asyra-design/rules/scenario-matrix-testing.md`.

## Purpose

This document defines the scenario families that must drive Phase 4B testing.

It exists to prevent constrained legality work from collapsing into
shape-specific clipping patches or polygon-boolean repairs without a declared
ownership/legality contract.

This document is a testing contract, not a bug log.

## Scope

Applies to the promoted slice:

- `solid + inside/outside + uniform width + solid paint`
- canonical legality-domain construction
- ownership-aware legality diagnostics
- constrained clipping on supported closed non-self-intersecting paths

Current supported controls:

- joins: `miter`, `bevel`
- caps: `butt`, `square`
- path sources:
  - shape-generated path
  - vector-generated path

Current unsupported controls:

- constrained dashed legality
- self-intersecting constrained ownership hardening
- round joins / round caps
- gradient paint
- variable width promotion

## Scenario Families

### Family A. Canonical Closed Legality Domain

Reference geometry:

- one simple closed path with stable winding

Required semantics:

- legality-domain construction emits one canonical polygon boundary
- fill-rule is explicit and stable
- inside/outside semantics reuse the same canonical boundary, not source-specific
  helper shapes

Required tests:

- unit:
  - canonical legality boundary is stable for a simple rectangle
  - shape-generated and vector-generated equivalent paths yield identical
    legality domains

### Family B. Deterministic Constrained Eligibility

Reference geometry:

- open path
- self-intersecting closed path
- supported simple closed path

Required semantics:

- open paths reject constrained legality deterministically, while
  product-facing vector render falls back to centered placement for authored
  `inside` / `outside`
- self-intersecting paths reject constrained legality deterministically for the
  currently supported slice
- supported simple closed paths build legality diagnostics successfully

Required tests:

- unit:
  - open path returns no legality domain
  - open vector authored `inside` / `outside` remains visible through centered
    fallback on the render path
  - self-intersecting path returns no legality domain
  - supported closed path returns one legality domain

### Family C. Non-Overflow Preservation

Reference geometry:

- supported constrained solid packets whose geometry is already within the
  current inside/outside legal domain

Required semantics:

- legality diagnostics may classify but must not mutate or drop non-overflow
  geometry
- packet geometry ids stay stable
- non-overflow geometry remains byte-for-byte identical through legality
  diagnostics
- supported packets currently route through the legality-clipping helper even
  when `eligibleOverflowGeometryIds` is empty
- no-op clipping preservation must keep packet object identity and polygon
  references stable for the current promoted slice
- exact-region-cover and partial foreign-owned region subtraction may clip
  convex outside packets while preserving the remaining owner-domain polygons
- orthogonal non-convex outside packets may also subtract foreign-owned exact
  candidate-set regions after deterministic canonical rectangle decomposition,
  while preserving disconnected local remainders
- non-orthogonal non-convex outside packets may also subtract foreign-owned
  exact candidate-set regions after deterministic bounded ear decomposition,
  while preserving disconnected local remainders
- mixed-topology outside packets that include orthogonal non-convex pieces may
  subtract foreign-owned exact candidate-set regions on that same bounded
  canonical-rectangle path while preserving disconnected local remainders
- mixed-topology outside packets that include non-orthogonal non-convex pieces
  may:
  - subtract foreign-owned exact candidate-set regions while preserving
    disconnected owner-domain remainders
  - drop the whole non-owner packet when those exact foreign-owned regions
    cover all packet pieces
  on that same bounded ear-decomposition path
- mixed-topology outside packets that include multiple non-orthogonal
  non-convex pieces may subtract foreign-owned exact candidate-set regions
  while preserving disconnected owner-domain remainders on that same bounded
  ear-decomposition path
- multi-polygon outside packets composed entirely of orthogonal non-convex
  pieces may be dropped wholesale when exact foreign-owned regions cover the
  whole packet on that same bounded canonical-rectangle path

Required tests:

- unit:
  - legality diagnostics preserve packet geometry ids and bounds
  - legality diagnostics do not rewrite packet polygons
  - legality clipping preserves packets byte-for-byte when no overflow is
    eligible
  - inside overflow clips against the canonical legality boundary while
    preserving geometry identity
  - outside single-edge overflow clips against the canonical legality boundary
    complement for convex domains while preserving geometry identity
  - outside corner overflow on convex domains partitions into disjoint
    complement sectors instead of overlapping outside polygons
  - exact foreign-owned outside polygons are dropped from final packets when
    ownership diagnostics mark them as non-owner regions
  - partial foreign-owned outside regions subtract from convex packets using
    exact candidate-set ownership regions while preserving the owner-domain
    remainder
  - partial foreign-owned outside regions subtract from orthogonal non-convex
    packets after canonical rectangle decomposition while preserving
    disconnected local remainders
  - exact foreign-owned outside regions drop non-orthogonal non-convex packets
    wholesale after deterministic bounded ear decomposition when the whole
    non-owner packet is covered
  - partial foreign-owned outside regions subtract from mixed-topology packets
    that include orthogonal non-convex pieces while preserving disconnected
    local remainders
  - mixed-topology outside packets that include non-orthogonal non-convex
    pieces are dropped wholesale when exact foreign-owned regions cover the
    whole non-owner packet on the bounded ear-decomposition path
  - mixed-topology outside packets that include non-orthogonal non-convex
    pieces subtract foreign-owned exact candidate-set regions while preserving
    disconnected owner-domain remainders on that same bounded
    ear-decomposition path
  - mixed-topology outside packets that include multiple non-orthogonal
    non-convex pieces subtract foreign-owned exact candidate-set regions while
    preserving disconnected owner-domain remainders on that same bounded
    ear-decomposition path
  - multi-polygon outside packets composed entirely of orthogonal non-convex
    pieces are dropped wholesale when exact foreign-owned regions cover the
    whole packet

### Family D. Shape / Vector Equivalence

Reference geometry:

- one canonical closed orthogonal or smooth path represented by:
  - shape-generated source
  - vector-generated source

Required semantics:

- legality-domain boundary must match
- inside/outside classification must match
- source type may not introduce a private legality branch
- multi-network vector sources must merge legality/ownership diagnostics into
  one graphic-local namespace without candidate/component/region id collisions
- for two-candidate convex overlap components, ownership regions must be
  emitted as canonical shared overlap polygons rather than surrogate full
  owner polygons
- for convex multi-candidate overlap components, ownership regions must emit
  exact candidate-set polygons:
  - nested components may emit shared all-candidate overlap regions plus
    lower-cardinality remainder bands
  - partial-overlap components without a shared all-candidate region may emit
    exact pairwise regions only
  - the current convex exact-subset builder is expected to stay deterministic
    at least through four-candidate chain and branch components
- mixed-topology candidates that contain multiple convex packet polygons may
  still participate in the same exact candidate-set owner-domain model, as
  long as the resulting subset intersections remain convex and deterministic
- orthogonal non-convex single-polygon candidates may participate in the same
  exact candidate-set owner-domain model only after they are decomposed into
  deterministic canonical rectangles; this is a bounded normalization step,
  not general non-convex polygon-boolean support
- non-orthogonal non-convex single-polygon candidates may participate in the
  same exact candidate-set owner-domain model only after deterministic bounded
  ear decomposition into convex triangles; this is a bounded normalization
  step, not general non-convex polygon-boolean support
- mixed-topology candidates may also include orthogonal non-convex packet
  pieces on that same exact candidate-set path, as long as each non-convex
  piece is first normalized into deterministic canonical rectangles
- mixed-topology candidates may also include non-orthogonal non-convex packet
  pieces on that same exact candidate-set path, as long as each such piece is
  first normalized into deterministic bounded ear-decomposition triangles
- mixed-topology candidates may include multiple non-orthogonal non-convex
  packet pieces on that same exact candidate-set path, as long as every such
  piece is first normalized into deterministic bounded ear-decomposition
  triangles

Required tests:

- unit:
  - equivalent rect/vector domains are equal
  - equivalent oval/vector domains are equal within sampling tolerance
  - multi-network vector constrained ownership diagnostics keep deterministic
    unique ids after merge
  - two-candidate convex overlap components emit canonical shared ownership
    regions
  - nested convex multi-candidate overlap components emit exact
    candidate-set ownership regions
  - partial-overlap convex multi-candidate components emit exact pairwise
    ownership regions without inventing a shared all-candidate region
  - four-candidate convex partial-overlap chains keep deterministic exact
    pairwise ownership regions
  - four-candidate convex branch components keep deterministic exact
    candidate-set ownership regions across branch and triple-overlap subsets
  - mixed-topology multi-polygon candidates keep deterministic exact
    ownership regions across disconnected sub-packets
  - orthogonal non-convex single-polygon candidates keep deterministic exact
    ownership regions after canonical rectangle decomposition
  - non-orthogonal non-convex single-polygon candidates keep deterministic
    exact ownership regions after bounded ear decomposition
  - mixed-topology candidates that contain orthogonal non-convex pieces keep
    deterministic exact ownership regions across all packet pieces
  - mixed-topology candidates that contain non-orthogonal non-convex pieces
    keep deterministic exact ownership regions across all packet pieces on the
    bounded ear-decomposition path
  - mixed-topology candidates that contain multiple non-orthogonal non-convex
    pieces keep deterministic exact ownership regions across all packet pieces
    on that same bounded ear-decomposition path

### Family E. Debug Surface / Viewer

Reference geometry:

- one selected element on the real app/runtime path
- one supported constrained stroke slice
- one selected element with overlapping supported constrained solid strokes

Required semantics:

- legality-domain debug surface is visible only when the explicit Phase 4B
  debug flag is enabled
- inside/outside overlays remain component-local to the selected element
- diagnostics come from the promoted constrained-solid runtime path, not from a
  mocked legality helper
- ownership overlay is visible only when overlapping supported constrained
  solid packets exist on the selected element
- ownership overlay remains component-local and deterministic under the current
  packet-level surrogate region model

Required tests:

- visual:
  - inside legality overlay appears
  - outside legality overlay appears
  - ownership overlay appears for overlapping constrained solid strokes
  - exact foreign-owned outside polygons remain visually absent from the final
    render path while the owner stroke remains visible
  - overlay disappears when the debug flag is disabled

## Benchmark Rules

Phase 4B visual benchmarks must validate:

- legality-domain overlay visibility for supported constrained solid slices
- inside/outside overlays remain distinct
- ownership overlay visibility for overlapping constrained solid slices
- owner-domain clipping keeps the owner stroke visible while foreign-owned
  exact-match outside polygons remain visually absent
- debug-disabled mode shows no legality overlay

## Bounded Expansion Stop Rule For Phase 4B

Phase 4B may continue to expand only while new support remains on one of these
declared bounded normalization paths:

- convex exact candidate-set owner-domain construction
- orthogonal canonical rectangle decomposition
- bounded ear decomposition for simple non-orthogonal non-convex polygons

Phase 4B bounded expansion must stop when the next uncovered scenario requires:

- broader mixed-topology subtraction that cannot be expressed on those paths
- broader general non-convex owner-domain construction
- general polygon-boolean semantics

At that point the work must move to a new plan or explicit next-phase
algorithm, rather than continuing to add more micro-slices under Phase 4B.

Current handoff target:

- `docs/ai/apps/asyra-design/plans/professional-stroke-engine-algorithm-flow.md`
- `docs/ai/apps/asyra-design/plans/stroke-engine-promotion-ledger.md`

## Done Rule For Phase 4B Groundwork

This groundwork slice is not DONE unless:

- the supported legality families above are declared explicitly
- unit tests exist for canonical legality-domain construction and deterministic
  constrained eligibility
- visual tests exist for the legality-domain debug surface on the real app path
- supported constrained packets are routed through the legality-clipping helper
  and preserve byte-for-byte identity when no overflow is eligible
- current helper-level clipping support is explicit:
  - inside overflow clipping is enabled
  - outside clipping is currently limited to convex canonical boundaries with
    single-edge and corner-overflow disjoint-sector semantics
  - exact foreign-owned outside polygons may be removed from final packets when
    ownership diagnostics identify a different owner stroke for that full
    polygon
  - convex outside packets may also subtract foreign-owned exact candidate-set
    regions while preserving the remaining owner-domain polygons
  - orthogonal non-convex outside packets may also subtract foreign-owned
    exact candidate-set regions after canonical rectangle decomposition while
    preserving disconnected local remainders
  - mixed-topology outside packets that include orthogonal non-convex pieces
    may also subtract foreign-owned exact candidate-set regions on that same
    bounded canonical-rectangle path while preserving disconnected local
    remainders
  - multi-polygon outside packets composed entirely of orthogonal non-convex
    pieces may also be dropped wholesale when exact foreign-owned regions
    cover the whole packet on that same bounded canonical-rectangle path
  - mixed-topology packets with multiple convex polygons may subtract
    foreign-owned exact candidate-set regions independently per polygon while
    preserving disconnected owner-domain remainders
  - two-candidate convex overlap components currently use canonical shared
    overlap regions
  - convex multi-candidate overlap components currently support exact
    candidate-set ownership regions for:
    - nested cases
    - partial-overlap cases
    - four-candidate chain components
    - four-candidate branch components
    - mixed-topology multi-polygon candidate components
    - orthogonal non-convex single-polygon candidate components after
      canonical rectangle decomposition
    broader mixed-topology, non-convex, or larger combinatorial owner-domain
    construction remains future work
- any new incident is mapped back to one of these families or adds a missing
  family first
