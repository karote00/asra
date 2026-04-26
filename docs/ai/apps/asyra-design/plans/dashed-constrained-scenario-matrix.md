# Dashed Constrained Geometry Scenario Matrix

## Role

This file is the Scenario Axis Document for Phase 4C dashed constrained
geometry under `docs/ai/apps/asyra-design/rules/scenario-matrix-testing.md`.

## Purpose

This document defines the scenario families that must drive Phase 4C testing.

It exists to prevent constrained dashed work from collapsing into one-off
inside/outside screenshot fixes or ad hoc clipping repairs without a declared
ownership / legality contract.

This document is a testing contract, not a bug log.

## Scope

Applies to the target slice:

- `dashed + inside/outside + uniform width + solid paint`
- ownership-aware constrained legality
- constrained clipping on supported closed non-self-intersecting paths

Current execution note:

- this scenario matrix remains part of the active uniform-width execution path
- the formal product target is Figma-like uniform-width stroke completion for
  supported Asyra Design shape/vector paths, not a representative-only sample
  matrix
- paint/color expansion, including broader gradient-paint rollout, and
  variable-width rollout are future-feature work for the current plan
- downstream selection should therefore prefer unfinished uniform-width dashed /
  round slices before returning to paint- or width-expansion work

Current supported controls for the uniform-width phase target:

- joins:
  - `miter`
  - `bevel`
  - `round` on the promoted full-loop and corner-spanning Phase 5 paths
- caps:
  - `butt`
  - `square`
  - `round` on the promoted single-edge Phase 5 paths
- path sources:
  - shape-generated path
  - vector-generated path

Current Phase 5 promoted round controls:

- `rect + full-loop + inside + round join`
- `rect + full-loop + outside + round join`
- `rect + corner-spanning + inside + round join`
- `rect + corner-spanning + outside + round join`
- `rect + single-edge + inside + round cap`
- `rect + single-edge + outside + round cap`
- `vector rectangle-equivalent + full-loop + inside + round join`
- `vector rectangle-equivalent + full-loop + outside + round join`
- `vector rectangle-equivalent + corner-spanning + inside + round join`
- `vector rectangle-equivalent + corner-spanning + outside + round join`
- `vector rectangle-equivalent + single-edge + inside + round cap`
- `vector rectangle-equivalent + single-edge + outside + round cap`
- `broader vector non-rectangle-equivalent + single-edge + inside + round cap`
- `broader vector non-rectangle-equivalent + single-edge + outside + round cap`
- `broader vector non-rectangle-equivalent + full-loop + inside + round join`
- `broader vector non-rectangle-equivalent + full-loop + outside + round join`

Current unsupported controls:

- self-intersecting constrained dashed legality
- round joins / caps outside the bounded matrix above are temporary execution
  gaps, not final exclusions from the formal uniform-width target
- gradient paint beyond the current promoted Phase 6 representatives:
  - promoted:
    - `rect + full-loop + inside + local-bounds linear gradient paint`
    - `rect + full-loop + outside + local-bounds linear gradient paint`
    - `rect + single-edge + inside + local-bounds linear gradient paint`
    - `rect + single-edge + outside + local-bounds linear gradient paint`
    - `vector rectangle-equivalent + full-loop + inside + local-bounds linear gradient paint`
    - `vector rectangle-equivalent + full-loop + outside + local-bounds linear gradient paint`
    - `vector rectangle-equivalent + single-edge + inside + local-bounds linear gradient paint`
    - `vector rectangle-equivalent + single-edge + outside + local-bounds linear gradient paint`
    - `broader vector non-rectangle-equivalent + full-loop + inside + local-bounds linear gradient paint`
    - `broader vector non-rectangle-equivalent + full-loop + outside + local-bounds linear gradient paint`
    - `broader vector non-rectangle-equivalent + single-edge + inside + local-bounds linear gradient paint`
    - `broader vector non-rectangle-equivalent + single-edge + outside + local-bounds linear gradient paint`
    - `rect + inside + bevel + corner-spanning + local-bounds linear gradient paint`
    - `rect + outside + bevel + corner-spanning + local-bounds linear gradient paint`
    - `vector rectangle-equivalent + inside + bevel + corner-spanning + local-bounds linear gradient paint`
    - `vector rectangle-equivalent + outside + bevel + corner-spanning + local-bounds linear gradient paint`
    - `broader vector non-rectangle-equivalent + inside + bevel + corner-spanning + local-bounds linear gradient paint`
  - still blocked:
    - broader gradient-paint slices beyond these first vector-generated representatives
    - corner-spanning constrained dashed gradient paint beyond the first promoted
      inside/outside-bevel representatives on `rect`, plus the first
      rectangle-equivalent `vector` inside/outside-bevel representatives and
      the first broader non-rectangle-equivalent `vector` inside-bevel
      representative
- variable width promotion

## Phase-Start Boundary

Phase 4C starts with a deliberately narrow first slice:

- full-loop visible intervals on closed constrained dashed paths

Meaning:

- one visible dashed interval covers the entire closed path
- the geometry contract may initially reuse the constrained solid legality path
- partial constrained dashed interval materialization is not assumed until it is
  promoted explicitly

This narrow first slice is not the whole phase.
It is only the first declared entry point.

## Scenario Families

### Family A. Full-Loop Visible Constrained Dash

Reference geometry:

- one simple closed path
- one visible dash interval covers the whole path

Required semantics:

- constrained dashed routing must preserve one canonical legality-domain path
- render / hit / export must derive from the same full-loop constrained dashed
  packet family
- shape-generated and vector-generated equivalent paths must stay deterministic
- this family may initially reuse constrained solid legality/clipping as long as
  the authored dashed interval is explicitly classified as full-loop visible

Required tests:

- unit:
  - full-loop visible constrained dashed packet derivation
  - open-path constrained rejection with app-path center-placement fallback for
    authored `inside` / `outside` vector strokes
  - simple closed single-network vector repeated-dash constrained
    multi-interval packet routing for authored `inside` / `outside`
  - simple closed cubic single-network vector repeated-dash constrained
    multi-interval packet routing for authored `inside` / `outside` when the
    sampled legality domain is valid
  - repeated non-full-loop interval packet derivation on valid closed legality
    domains
- visual:
  - first promoted shape-generated full-loop visible constrained dashed slice
  - first promoted vector-generated full-loop visible constrained dashed slice
  - real-created open vector repeated-dash app path remains visible after
    switching the same stroke row from `center` to `inside` / `outside`
  - real-created simple closed vector repeated-dash app path moves to
    constrained `inside` / `outside` placement after switching the same stroke
    row from `center`
  - closed cubic vector repeated-dash app path routes through constrained
    `inside` / `outside` placement after switching the same stroke row from
    `center` when the sampled legality domain is valid

### Family B. Single-Edge Visible Interval

Reference geometry:

- one simple closed orthogonal or smooth path
- one visible dashed interval stays within one edge / curve span

Required semantics:

- visible interval remains bounded to the legal owner domain
- no unrelated edges or turns become visible
- ownership / legality does not invent extra faces outside the interval window

Required tests:

- unit:
  - interval-local legality classification
- visual:
  - one promoted `inside`
  - one promoted `outside`

### Family C. Corner-Spanning Visible Interval

Reference geometry:

- one simple closed path
- one visible dashed interval spans a corner / turn while constrained legality
  is active

Required semantics:

- the visible dashed interval keeps the same join silhouette family as the
  supported center-dashed path
- constrained clipping must preserve the legal local remainder and remove only
  true overflow
- ownership must stay component-local and deterministic

Required tests:

- unit:
  - corner-spanning constrained interval classification
  - constrained corner remainder preservation
- visual:
  - one representative `miter`
  - one representative `bevel`

### Family D. Shape / Vector Equivalence

Reference geometry:

- one canonical closed path represented by:
  - shape-generated source
  - vector-generated source

Required semantics:

- legality-domain classification must match
- constrained dashed interval visibility must match
- shape source must not introduce a private constrained-dash branch

Required tests:

- unit:
  - equivalent shape / vector full-loop constrained dash packets
  - equivalent shape / vector round-join full-loop constrained dash packets on
    the first promoted Phase 5 gate
  - equivalent shape / vector outside round-join full-loop constrained dash
    packets on the next promoted Phase 5 gate
  - equivalent shape / vector round-cap single-edge constrained dash packets on
    the next promoted Phase 5 gate
  - equivalent shape / vector outside round-cap single-edge constrained dash
    packets on the next promoted Phase 5 gate
  - equivalent shape / vector full-loop gradient constrained dash packets on
    the first promoted Phase 6 gate
- visual:
  - equivalent shape / vector constrained dash coverage
  - equivalent shape / vector round-join full-loop constrained dash coverage on
    the first promoted Phase 5 gate
  - equivalent shape / vector outside round-join full-loop constrained dash
    coverage on the next promoted Phase 5 gate
  - equivalent shape / vector round-cap single-edge constrained dash coverage on
    the next promoted Phase 5 gate
  - equivalent shape / vector outside round-cap single-edge constrained dash
    coverage on the next promoted Phase 5 gate
  - equivalent shape / vector full-loop gradient constrained dash coverage on
    the first promoted Phase 6 gate

### Family E. Unsupported Slices Must Stay Absent

Reference geometry:

- any promoted path source

Required semantics:

- unsupported self-intersecting constrained dashed full-loop paths remain absent
- true self-intersecting constrained dashed multi-interval legality remains
  unpromoted until the fill-rule domain is declared and tested
- unsupported multi-network constrained dashed paths remain absent
- unsupported round joins / caps beyond the first promoted:
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
  representatives remain absent
- unsupported constrained dashed gradient paint beyond the first promoted Phase
  6 representative remains absent
- unsupported variable-width constrained dashed paths remain absent

Required tests:

- visual:
  - unsupported constrained dashed slices remain absent
