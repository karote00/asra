# Center Dashed Overlap / Ownership Scenario Matrix

## Role

This file is the Scenario Axis Document for Phase 4A overlap and ownership on
center dashed geometry under
`docs/ai/apps/asyra-design/rules/scenario-matrix-testing.md`.

## Purpose

This document defines the scenario families that must drive Phase 4A testing.

It exists to prevent overlap / ownership work from collapsing into
sample-specific ownership patches or traversal-order repairs.

This document is a testing contract, not a bug log.

## Scope

Applies to the promoted slice:

- `dashed + center + uniform width + solid paint`
- overlap graph
- component extraction
- ownership resolution
- component-local bailout

Current supported controls:

- joins: `miter`, `bevel`
- caps: `butt`, `square`
- path sources:
  - shape-generated path
  - vector-generated path

Current unsupported controls:

- constrained legality
- self-intersecting ownership hardening
- round joins / round caps
- gradient paint
- variable width promotion

## Scenario Families

### Family A. Non-Overlapping Candidates

Reference geometry:

- two visible dashed candidates with disjoint bounds and disjoint polygons

Required semantics:

- overlap graph emits no edge
- component extraction keeps the candidates in separate singleton components
- ownership resolution is not invoked for cross-candidate competition

Required tests:

- unit:
  - disjoint candidates do not connect in the overlap graph
  - singleton components remain stable under candidate reorder

### Family B. Simple Pair Overlap

Reference geometry:

- two visible dashed candidates with one shared overlap region

Required semantics:

- overlap graph emits one edge
- component extraction produces one connected component
- ownership resolution produces one deterministic owner for the shared region

Required tests:

- unit:
  - one shared overlap produces one connected component
  - traversal reorder does not change component membership
  - interval priority stays deterministic on the shared region

### Family C. Primitive Priority

Reference geometry:

- overlapping candidates where competing primitive kinds differ:
  - `body` vs `join`
  - `join` vs `cap`
  - `cap` vs foreign `body`

Required semantics:

- primitive class is decided before interval tie-break
- `body` beats competing `join` where the region lies on the continuous sweep
- `join` beats competing `cap` at a segment-transition corner
- `cap` may only beat foreign `body` when the region lies inside the cap
  owner's terminal envelope

Required tests:

- unit:
  - `body` beats `join`
  - `join` beats `cap`
  - foreign `cap` cannot steal a body region outside its terminal envelope

### Family D. Interval Priority

Reference geometry:

- one atomic region with multiple candidate owners of the same primitive class

Required semantics:

- lower normal-distance-to-source wins first
- then lower start-distance
- then lower authored visible interval index
- then stable interval id

Required tests:

- unit:
  - lower normal distance wins
  - lower start distance wins when normal distance ties
  - lower authored visible interval index wins when previous metrics tie
  - stable interval id breaks final ties deterministically

### Family E. Shape / Vector Equivalence

Reference geometry:

- one canonical path represented by:
  - shape-generated source
  - vector-generated source

Required semantics:

- overlap graph connectivity must match
- ownership winners must match
- no source-specific ownership branch is allowed

Required tests:

- unit:
  - equivalent candidate packets yield equivalent overlap components
  - equivalent ownership candidates yield equivalent winners

### Family F. Component-Local Bailout

Reference geometry:

- one overlap component whose ownership result cannot be resolved safely

Required semantics:

- bailout is local to the component
- preserved preview geometry is returned for the affected component
- other components continue normally
- no partial ownership corruption is emitted

Required tests:

- unit:
  - bailout records affected interval ids and preserved preview polygons
  - unaffected components remain resolved
  - bailout reason is explicit and deterministic

## Benchmark Rules

Phase 4A visual benchmarks must validate:

- overlap graph / ownership debug surfaces are visible and component-local
- ownership result is stable under supported candidate reorder
- bailout preserves preview geometry without partial clipping
- real packet ownership diagnostics may use interval-level atomic surrogates for
  Phase 4A debug surfaces, but they must remain deterministic and must not
  silently claim legality-domain ownership completeness

## Done Rule For Phase 4A

Phase 4A is not DONE unless:

- the supported overlap / ownership families above are declared explicitly
- unit tests exist for:
  - overlap graph
  - component extraction
  - primitive priority
  - interval priority
  - bailout semantics
- visual tests exist for promoted debug surfaces / bailout behavior
- any new incident is mapped back to one of these families or adds a missing
  family first
