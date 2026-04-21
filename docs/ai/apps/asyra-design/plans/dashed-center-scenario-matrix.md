# Dashed Center Geometry Scenario Matrix

## Role

This file is the Scenario Axis Document for Phase 3 dashed center geometry
under `docs/ai/apps/asyra-design/rules/scenario-matrix-testing.md`.

## Purpose

This document defines the scenario families that must drive Phase 3 dashed
center geometry testing.

It exists to prevent the dashed-center test suite from collapsing into
incident-by-incident screenshot regressions.

This document is a testing contract, not a bug log.

## Scope

Applies to the promoted slice:

- `dashed + center + uniform width + solid paint`

Current supported controls:

- joins: `miter`, `bevel`
- caps: `butt`, `square`
- shapes/path sources:
  - `rect`
  - `oval`
  - `vector`

Current unsupported controls:

- constrained dashed legality
- `round` join
- `round` cap
- gradient paint
- variable width promotion

## Scenario Families

### Family A. Straight Open Path

Reference shape:

- `A -> B`

Required semantics:

- visible/gap alternation follows authored pattern order
- `dashOffset` shifts the pattern deterministically
- `butt` and `square` remain visually distinguishable

Required tests:

- unit:
  - interval allocation on open paths
  - cap semantics on open paths
- visual:
  - open vector visible/gap probes
  - open vector `butt/square` distinction

### Family B. Straight Closed Seam-Wrap

Reference shape:

- closed loop whose seam is at the authored start point

Required semantics:

- seam-wrap remains deterministic
- first/last visible interval continuity is stable
- full-loop visible dash intervals keep seam continuity instead of degrading
  into open caps

Required tests:

- unit:
  - seam-wrap interval allocation
  - full-loop visible dash continuity
- visual:
  - closed dashed rectangle/oval/vector seam continuity probes

### Family C. Right-Angle Turn

Reference geometry:

- canonical closed orthogonal path turn

Reference fixtures:

- shape-generated rectangle
- vector-generated orthogonal path

Required semantics:

- if a visible dash spans the corner, the dash must remain one continuous face
- `miter` must keep the outer corner square filled
- `bevel` must cut the outer corner square away and replace it with a diagonal
  corner silhouette
- if a visible dash spans the corner by only a very short post-turn remainder,
  the turn corridor must still remain visibly continuous and must not introduce
  an outer-corner triangular cut artifact
- corner continuity must not depend on whether the path came from a shape or a
  vector
- when one closed orthogonal path has multiple corners with different interval
  relations, the expected behavior must be classified by geometry plus interval
  relation, not by shape name
- shape names are fixtures only; the family remains geometric/topological
- when two orthogonal corners have different post-turn visible remainders, their
  incoming-edge bridge coverage may differ; correctness is determined by the
  local interval remainder, not by corner symmetry

Required tests:

- unit:
  - corner-spanning visible interval detection
  - packet topology for `miter`
  - packet topology for `bevel`
  - short-carryover corner-spanning packet topology for `miter`
  - remainder-dependent short-carryover bridge semantics across orthogonal
    corners with different post-turn carryover
  - shape/vector equivalence for the same path
  - closed orthogonal path corner-by-corner comparison on one canonical path
- visual:
  - rectangle corner-spanning `miter`
  - rectangle corner-spanning `bevel`
  - rectangle short-carryover corner-spanning `miter`
  - rectangle exact screenshot-parameter short-carryover bridge semantics
    (`top-right` absent, `bottom-right` present for the canonical `[27,20]`
    orthogonal path)
  - vector corner-spanning `miter`
  - vector corner-spanning `bevel`
  - vector short-carryover corner-spanning `miter`
  - closed orthogonal path corner-by-corner continuity on one canonical path

### Family D. Acute-Angle Turn

Reference shape:

- `A -> B -> C`
- `∠ABC < 90°`

Reference subfamilies:

- open path with `A` as start, `C` as end
- closed path with `B` participating in the seam

Required semantics:

- a visible dash that spans the turn must follow the turn continuously
- a gap that spans the turn must remain a gap through the turn
- `miter` and `bevel` must produce their own correct corner silhouettes
- closed-path seam behavior must remain deterministic when the seam and the
  angle interact

Required tests:

- unit:
  - `[20,10]` acute-angle open path
  - `[27,13]` acute-angle open path
  - dash-spans-corner vs gap-spans-corner classification
  - closed acute-angle seam-wrap variants
- visual:
  - one `miter` acute-angle representative
  - one `bevel` acute-angle representative

### Family E. Obtuse-Angle Turn

Reference shape:

- `A -> B -> C`
- `∠ABC > 90°`

Required semantics:

- dash continuity through the corner must remain stable
- the join silhouette still follows the selected join family
- no false gap or detached corner face appears

Required tests:

- unit:
  - corner-spanning visible interval continuity
- visual:
  - one representative `miter`
  - one representative `bevel`

### Family F. Smooth High-Curvature Turn

Reference shape:

- closed or open smooth curve whose local curvature is high enough that one
  visible dash spans a turning region instead of a straight region

Required semantics:

- the dash remains continuous through the turn
- no local notch or missing band appears where the dash crosses the high
  curvature region

Required tests:

- unit:
  - interval slicing remains continuous through the curved region
- visual:
  - one promoted `oval` or smooth-vector representative

### Family G. Unsupported Slices Must Stay Absent

Reference shape:

- any promoted path source

Required semantics:

- unsupported dashed constrained slices remain absent
- unsupported dashed `round` join remains absent
- unsupported dashed `round` cap remains absent

Required tests:

- unit:
  - unsupported slice packet builders emit no packets
- visual:
  - absence benchmarks for all unsupported promoted-path cases

## Pattern Set Policy

Incident-specific numbers are not the primary test structure.

The required pattern families are:

- baseline:
  - `[20,10]`
- corner-span probe:
  - choose values that make one visible dash span a target corner
- gap-span probe:
  - choose values that make one gap span a target corner
- seam-wrap probe:
  - choose values and offset that force visible continuity across the seam

When a bug report provides a number set such as `[27,13]`, it must be mapped to
one of the families above instead of becoming a one-off test category.

## Benchmark Rules

Visual benchmarks must measure scenario semantics directly.

Allowed benchmark categories:

- edge visible/gap probes
- corner continuity probes
- join silhouette probes
- seam-wrap continuity probes
- unsupported absence probes
- shape/vector equivalence probes

Forbidden benchmark categories:

- arbitrary full-image comparisons without scenario semantics
- one screenshot per bug report with no scenario-family mapping

## Current Gap Assessment

Implemented in the current hardening pass:

1. Family C right-angle turn
   - unit:
     - corner-spanning `miter`
     - corner-spanning `bevel`
     - bevel cut-away topology
     - shape/vector equivalence probes
   - visual:
     - rectangle `miter`
     - rectangle `bevel`
     - closed vector `bevel`
2. Family D acute-angle turn
   - unit:
     - `[20,10]` open-path turn allocation
     - `[27,13]` gap-spans-corner allocation
     - `[40,10]` `miter` continuity
     - `[40,10]` `bevel` continuity
     - `[27,13]` corner absence when the gap spans the turn
   - visual:
     - open vector `miter`
     - open vector `bevel`
     - open vector gap-spans-corner absence

Remaining highest-value missing coverage is:

1. Family B closed seam-wrap interactions that also cross a corner
2. Family E obtuse-angle representatives
3. Family F smooth high-curvature representatives
4. unsupported absence on additional shape/vector equivalence subfamilies
