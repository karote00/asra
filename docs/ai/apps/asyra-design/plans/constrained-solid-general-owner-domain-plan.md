# Constrained Solid General Owner-Domain Algorithm Plan

## Purpose

This plan defines the next algorithm class after the bounded Phase 4B rollout
for constrained solid ownership and legality.

It exists because Phase 4B may no longer expand through micro-slices once the
remaining unsupported families require broader mixed-topology subtraction,
broader general non-convex owner-domain construction, or general
polygon-boolean semantics.

This plan is the explicit handoff target required by the bounded-expansion stop
rule. It is not another Phase 4B bounded slice.

Companion bounded-work documents:

- `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`
- `docs/ai/apps/asyra-design/plans/constrained-solid-ownership-legality-scenario-matrix.md`

## Role

This document defines the broader algorithm class for:

- mixed-topology owner-domain construction beyond the current bounded
  normalization paths
- general non-convex owner-domain construction for constrained solid geometry
- broader subtraction of foreign-owned regions from final constrained packets

It exists so the next step is explicitly recognized as a new algorithm class
instead of more bounded 4B micro-slices.

## Scope

Applies to the same promoted product-facing slice:

- `solid + inside/outside + uniform width + solid paint`
- closed non-self-intersecting paths
- joins: `miter`, `bevel`
- caps: `butt`, `square`

Current bounded support retained from Phase 4B:

- convex exact candidate-set owner-domain construction
- orthogonal non-convex bounded normalization via canonical rectangle
  decomposition
- simple non-orthogonal non-convex bounded normalization via deterministic ear
  decomposition
- bounded mixed-topology clipping on those declared normalization paths

New algorithm-class work covered by this plan:

- broader mixed-topology owner-domain construction when candidate pieces cannot
  be expressed by the current bounded convex/rectangle/ear paths
- broader mixed-topology subtraction when foreign-owned regions cannot be
  handled by the current bounded exact candidate-set subtraction paths
- broader general non-convex owner-domain construction beyond deterministic
  single-piece normalization
- broader general non-convex subtraction beyond bounded canonical rectangle /
  bounded ear decomposition

Out of scope:

- dashed constrained legality
- round joins / round caps
- gradient paint
- variable width
- self-intersecting constrained paths

## Why A New Plan Is Required

Phase 4B bounded expansion is intentionally limited to one declared algorithm
class. That class includes:

- convex exact candidate-set overlap regions
- orthogonal rectangle normalization
- bounded ear normalization for simple non-orthogonal non-convex polygons

The remaining unsupported families no longer fit inside those assumptions.
Continuing to extend 4B through more bounded slices would blur the
algorithm-class boundary and make the phase look complete while silently
absorbing general boolean work.

This plan therefore treats the remaining work as a new class:

- owner-domain construction on broader mixed topology
- owner-domain subtraction on broader mixed topology
- general non-convex region handling

## Product Semantics Check

Before any broader boolean-style work is classified as a bug fix, the owner
must check whether the observed result is already correct under the current
bounded Phase 4B semantics.

This plan only covers scenarios that are genuinely outside the current bounded
product semantics.

## Scenario Families

### Family A. Mixed-Topology Owner-Domain Beyond Bounded Paths

Reference geometry:

- one constrained packet component whose exact candidate-set owner-domain
  exceeds the former four-candidate bounded frontier
- one constrained packet component containing a mixture of:
  - convex pieces
  - orthogonal non-convex pieces
  - non-orthogonal non-convex pieces
- at least one overlap region that cannot be represented by the current
  bounded normalization paths without surrogate fallback

Required semantics:

- owner-domain construction must remain deterministic
- exact candidate-set regions must remain stable even when the participating
  pieces cannot be normalized by the current bounded rectangle / ear routes
- surrogate full-owner regions may not silently replace the missing owner
  subset

Required tests:

- unit:
  - broader exact candidate-set owner-domain remains deterministic when a
    nested convex component exceeds four candidates
  - broader exact candidate-set owner-domain remains deterministic when a
    nested convex component exceeds five candidates
  - broader exact candidate-set owner-domain remains deterministic when a
    nested convex component exceeds six candidates
  - broader exact candidate-set owner-domain remains deterministic when a
    nested convex component exceeds seven candidates
  - broader exact candidate-set owner-domain remains deterministic when a
    nested convex component exceeds eight candidates
  - general mixed-topology owner-domain construction keeps deterministic exact
    candidate-set regions on the supported broader scenarios

### Family B. General Non-Convex Owner-Domain Construction

Reference geometry:

- one simple non-convex polygon or mixed piece set whose exact candidate-set
  ownership cannot be expressed by the current bounded normalization paths

Required semantics:

- owner-domain construction must stay in canonical polygon form
- subset regions must be stable across equivalent path sources
- construction may not rely on shape-specific branch logic

Required tests:

- unit:
  - broader non-convex owner-domain construction remains deterministic across
    equivalent inputs

### Family C. Broader Mixed-Topology Subtraction

Reference geometry:

- non-owner packets containing broader mixed-topology pieces
- foreign-owned regions intersecting those packets in ways not expressible by
  the bounded exact-subtraction path

Required semantics:

- subtraction must preserve owner-domain remainders
- disconnected remainders must remain stable
- no accidental whole-packet drop may occur when only partial subtraction is
  warranted

Required tests:

- unit:
  - broader mixed-topology subtraction preserves the expected local remainders

### Family D. Shape / Vector Equivalence

Reference geometry:

- one canonical constrained path represented by:
  - shape-generated source
  - vector-generated source
- one broader owner-domain / subtraction scenario from Families A-C

Required semantics:

- broader owner-domain construction must remain source-equivalent
- broader subtraction must remain source-equivalent

Required tests:

- unit:
  - shape-generated and vector-generated sources remain equivalent for the
    promoted broader owner-domain scenarios

### Family E. Visual Product Benchmarks

Reference geometry:

- one selected element on the real app/runtime path
- one promoted broader owner-domain scenario

Required semantics:

- the final constrained stroke must show only the retained owner geometry
- foreign-owned regions must remain absent
- owner-domain clipping may not introduce tears, false holes, or accidental
  full disappearance on the promoted broader scenarios

Required tests:

- visual:
  - the real app/runtime path proves retained owner-domain visibility on each
    promoted broader scenario family

## Required Benchmark Discipline

Benchmarks under this plan must describe:

- the promoted broader scenario family
- the expected retained-owner visible behavior
- the expected absent foreign-owned behavior
- the probe or measurement strategy
- the pass threshold

No screenshot-only benchmark may be added without mapping back to one of the
declared broader scenario families above.

## Execution Constraints

1. Do not retrofit this work back into Phase 4B bounded-closeout language.
2. Do not claim general boolean support unless the scenario family is declared
   here and the matching unit + visual gates exist.
3. Do not ship broader owner-domain subtraction on product paths before the
   corresponding family has:
   - unit coverage
   - visual coverage
   - updated docs contracts
4. Do not use paint or alpha compositing to repair missing owner-domain
   geometry.
5. Do not silently route unsupported broader scenarios back to bounded 4B
   surrogate behavior once a scenario is promoted under this plan.

## Deliverables

The first completion target for this plan is:

- declared broader scenario families
- algorithm-specific unit contracts
- app-path visual benchmarks for the first promoted broader scenario
- runtime routing that uses the new broader owner-domain algorithm class on
  that promoted scenario without falling back to surrogate bounded behavior

## Done Rule

This plan is not DONE unless:

- promoted broader scenario families are explicitly declared
- matching unit tests exist
- matching visual tests exist
- shape/vector equivalence is covered for the promoted broader scenarios
- regressions are mapped back to the declared broader families

## Status

- created on `2026-04-20`
- this plan is now the required continuation path once Phase 4B bounded
  expansion reaches its declared stop condition
- first promoted broader scenario now in progress:
  - deterministic exact candidate-set owner-domain for nested five-candidate
    constrained solid components beyond the former four-candidate cap
  - deterministic exact candidate-set owner-domain for nested six-candidate
    constrained solid components beyond the former five-candidate cap
  - deterministic exact candidate-set owner-domain for nested seven-candidate
    constrained solid components beyond the former six-candidate cap
  - deterministic exact candidate-set owner-domain for nested eight-candidate
    constrained solid components beyond the former seven-candidate cap
  - deterministic exact candidate-set owner-domain for nested nine-candidate
    constrained solid components beyond the former eight-candidate cap
  - exact candidate-set owner-domain on the broader nested-convex path is now
    gated by a subset-budget limit instead of a hard candidate-count cap,
    with ten nested constrained solid components promoted as the first proof
    scenario under that rule
  - deterministic exact candidate-set owner-domain for mixed-topology
    five-candidate constrained solid components across disconnected
    multi-polygon sub-packets, with app-path visual coverage on a
    multi-network vector-generated path
  - deterministic exact candidate-set owner-domain for mixed-topology
    six-candidate constrained solid components across disconnected
    multi-polygon sub-packets, with app-path visual coverage on a
    multi-network vector-generated path
  - deterministic broader mixed-topology subtraction that preserves local
    miter remainders when a bevel owner clips disconnected vector-generated
    sub-packets, with app-path visual coverage on a multi-network vector path
  - shape-generated and vector-generated closed rectangles now keep equivalent
    local miter remainders on that broader subtraction path, with unit and
    app-path visual coverage on the same promoted scenario family
  - mixed-topology broader subtraction now also keeps local miter remainders
    when one disconnected vector-generated sub-packet is a non-orthogonal
    non-convex piece, with unit and app-path visual coverage on that promoted
    subtraction family
  - equivalent vector-generated mixed-topology paths now keep deterministic
    broader owner-domain construction and equivalent local miter remainders
    when one disconnected sub-packet is a non-orthogonal non-convex piece,
    with unit and app-path visual coverage on that promoted scenario family
  - broader mixed-topology subtraction now also keeps local miter remainders
    when multiple disconnected vector-generated sub-packets are
    non-orthogonal non-convex pieces, with product-path and app-path visual
    coverage on that promoted subtraction family
