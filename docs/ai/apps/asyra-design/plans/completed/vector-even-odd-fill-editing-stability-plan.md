# Plan: Vector Even-Odd Fill + Editing Stability

## Status

- Completed: 2026-03-14
- Outcome: Vector fill now respects even-odd semantics for self-intersections, default vector fills start empty, and path-editing interactions are stabilized (preview handle direction + endpoint selection + cancel-to-select).
- Canonical: `docs/ai/apps/asyra-design/plans/completed/vector-even-odd-fill-editing-stability-plan.md`

## Goal

Deliver correct even-odd fill behavior for vectors with intersections while stabilizing path-editing interaction edge cases.

## Context

Vector rendering previously relied on open-path fill behavior that did not support even-odd semantics for intersecting paths. Path editing also showed a few UX inconsistencies around preview handles, endpoint selection, and cancel behavior. This plan targets correct fill semantics and predictable editing UX.

## Scope

In scope:
- even-odd fill semantics for intersecting vector paths
- fill rendering for closed regions created by intersections
- remove default fills for new vectors
- fix path-editing preview handle direction
- ensure endpoint selection works after refresh
- cancel path editing returns to select tool

Out of scope:
- performance scalability for very dense vectors (follow-up plan)
- changes to pen tool UX beyond the identified stability fixes

## Target Behavior

1. Even-odd fill semantics
- self-intersecting vectors fill only odd regions
- star-shaped paths render with unfilled center as expected

2. Editing stability
- preview segment uses correct handle direction for endpoint continuation
- endpoint selection allows continued path edits after refresh
- canceling path edit mode restores select tool

3. Default fills
- newly created vectors start with empty fills

## Implementation Slices

1. Vector fill rule update
- compute even-odd fill regions for intersecting paths

2. Default fill update
- remove default fills from new vector elements

3. Editing stability fixes
- correct preview handle direction on endpoint continuation
- ensure endpoint selection logic supports pen continuation after reload
- switch to select tool when canceling path editing

## Success Criteria

- Even-odd fill renders correctly for intersecting vectors.
- New vectors start with no fill until explicitly added.
- Path editing continuation and cancel behaviors are predictable.

## Risks

1. Fill correctness on dense intersections may still need performance tuning.
2. Editing stability fixes must not regress selection or hover behavior.
