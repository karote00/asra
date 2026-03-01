# Plan: Vector Geometry Domain Model

## Context

Current vector editing behavior stores geometry directly on element computed data and applies tool-specific logic across feature/render/property layers.

As pen/path editing grows, complexity increases around:
- point management (anchors + in/out handles)
- segment-level behavior (line/cubic, continuity)
- network-level behavior (multi-subpath, closed path semantics)

## Goal

Evaluate a dedicated geometry domain model (`Geometry`) that becomes the canonical runtime shape for vector path operations, while preserving app/common API boundaries.

## Candidate Scope

1. Point model
- unified point representation for anchor and handle coordinates/metadata

2. Segment model
- explicit segment objects linking adjacent points with line/cubic semantics

3. Network model
- explicit path network/subpath ownership, including closed-loop state

4. Adapter boundaries
- conversion between persisted element data shape and runtime geometry model
- keep feature handlers and render layers reading geometry through adapter APIs

## Non-Goals (Now)

- No immediate implementation commitment
- No persistence format rewrite in current pen-tool delivery scope

## Risks

1. Over-architecting before near-term pen behavior stabilizes
2. Migration complexity across render, property schema, and E2E contracts
3. Potential performance overhead if model conversion is not incremental

## Entry Criteria (When to Start)

Start only after near-term pen-tool behavior and subpath model direction are stable, and current geometry hotspots are clearly identified.

## Success Criteria

1. Geometry responsibilities are centralized and testable.
2. Pen/path-editing feature code becomes simpler (less cross-layer geometry branching).
3. Render/property behavior remains contract-compatible through adapter boundaries.
