# Stroke Engine Final Spec Package

## Role

This folder is the active source-of-truth package for the final stroke-engine
design in Asyra Design.

It exists for one reason:

- to define one final, geometry-first stroke system that can support a
  professional, Figma-like design tool while remaining suitable for open-source
  contribution and long-term extension

This package replaces the earlier stroke rollout documents as the active
authority for stroke-engine direction.

## Core Principles

- geometry is resolved before paint
- fill, stroke, and shadow all attach paint to canonical geometry
- `inside` and `outside` are one-sided geometry modes, not clipped center bands
- basic design-tool support is allowed to ship before every extreme topology
  family is solved, but it must label unsupported edge cases honestly
- render, hit-test, export, diagnostics, and animation all use the same
  resolved geometry family
- all high-cost work must respect a `120fps` interaction target and a `60fps`
  product floor
- every decision must be explicit enough that another engineer or AI agent can
  implement it without inventing missing semantics

## Basic Baseline

The first implementation target is not every Figma edge case.

The basic design-tool baseline may implement:

- simple closed single-contour paths
- compound closed paths with explicit legal-region / winding-rule metadata only
  after product render / hit-test / export packets consume the multi-contour
  legal domain directly
- simple open paths without self-intersection
- solid strokes on supported topology
- dashed strokes only where interval-local one-sided geometry is explicitly
  implemented and tested
- `center`, `inside`, and `outside` alignment
- miter, bevel, and round joins
- none, round, and square caps
- render / hit-test / export parity for the supported slice

The basic baseline must not claim exact support for:

- self-intersecting source paths
- multi-network overlap ownership
- nested ownership chains beyond explicit legal-region holes
- high-curvature self-overlap that requires arrangement correctness not yet
  implemented
- decorated caps such as arrows, diamonds, circles, or triangles
- any family without tests and explicit support status

## Read Order

1. `source-of-truth.md`
2. `target-architecture.md`
3. `geometry-pipeline.md`
4. `inside-outside-one-sided-geometry.md`
5. `exact-correct-path-algorithm.md`
6. `reference-research-findings.md`
7. `runtime-data-representation.md`
8. `active-support-scope.md`
9. `topology-and-product-semantics.md`
10. `function-contracts.md`
11. `parameter-impact-matrix.md`
12. `performance-and-dirty-graph.md`
13. `testing-and-benchmark-spec.md`
14. `failure-triage-and-self-review-loop.md`
15. `phase-execution-plan.md`
16. `migration-and-archive-plan.md`

## Document Map

- `source-of-truth.md`
  - routing, active authority, and legacy-deletion policy
- `target-architecture.md`
  - final architecture, data model, packet model, and output parity
- `geometry-pipeline.md`
  - canonical stage flow and stage responsibilities
- `inside-outside-one-sided-geometry.md`
  - the formal one-sided geometry method for constrained stroke modes
- `exact-correct-path-algorithm.md`
  - exact-correct path algorithm contract for high curvature, acute corners,
    miter behavior, overlap, and self-intersection support gates
- `reference-research-findings.md`
  - Figma-first research findings and peer product/runtime/algorithm references
    for unresolved behavior
- `runtime-data-representation.md`
  - canonical runtime representations, zero-copy/view rules, and semantic vs
    emission packet split
- `active-support-scope.md`
  - current support contract versus end-state goal versus migration roadmap
- `topology-and-product-semantics.md`
  - supported, research-gated, blocked, and blocked semantics
- `function-contracts.md`
  - implementation contracts for core helpers and packet emitters
- `parameter-impact-matrix.md`
  - parameter-change rerun logic, likely failure stages, and concrete geometry
    decision trace for one authored path
- `performance-and-dirty-graph.md`
  - performance budgets, dirty keys, cache boundaries, and preview rules
- `phase-execution-plan.md`
  - the execution sequence from current runtime to final runtime; roadmap only,
    not the current support contract
- `testing-and-benchmark-spec.md`
  - unit, visual, performance, animation, and semantic-capture test contracts
- `failure-triage-and-self-review-loop.md`
  - failure classification and required self-audit loops
- `migration-and-archive-plan.md`
  - how older stroke docs are deleted and how future updates must route

## Scope

This package covers:

- stroke geometry
- stroke legality
- stroke ownership
- stroke topology semantics
- stroke render/hit/export parity
- stroke dirty-graph and performance discipline
- stroke testing, failure triage, and migration governance

This package does not define final fill or shadow algorithms directly, but it
does define the shared geometry-first rule they must follow.
