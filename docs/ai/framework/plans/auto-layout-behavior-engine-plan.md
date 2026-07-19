# Auto-Layout Behavior Engine Plan

## Status

Post-release Roadmap, lowest-priority family.

Auto-layout is an advanced optional Preset capability for design-tool products.
It is not required for the first Asyra Framework release and must not become a
Core, Scene Tree, Render, or app UI assumption.

Before implementation begins, write the thin supported behavior contract and
matching Inspector owner flow. This record intentionally does not settle layout
algorithms while the work remains deferred.

## Goal

Provide official Preset-owned auto-layout defaults that orchestrate generic
framework property, hierarchy, transaction, and projection APIs without making
the framework kernel design-tool-specific.

## Ownership Direction

- Scene Tree remains the canonical entity hierarchy owner and does not decide
  layout policy.
- Props Manager owns validated property values and unit-aware schemas, not
  layout algorithms.
- Preset owns the optional official auto-layout behavior, default property
  definitions, observers/features, and deterministic recomputation route.
- Render consumes completed computed geometry and never performs canonical
  layout.
- Apps own panels, controls, handles, previews, authoring UX, and replacement or
  extension of Preset layout behavior.

## Prerequisite Roadmap Work

- deterministic value/unit conversion with parent/layout context;
- unit-aware property model;
- mixed-value and mixed-unit UI aggregation helpers where useful;
- stable Group hierarchy behavior from Framework Release Gate 3;
- profiling and exact layout equivalence evidence before retaining caches.

The unit and UI helper work is tracked by
`unit-conversion-and-ui-aggregation-plan.md` and remains preparatory; it does not
by itself implement an auto-layout engine.

## Deferred Scope Direction

When this Roadmap family is picked up, its product contract must decide at least:

- supported container/layout modes and axis behavior;
- padding, gap, alignment, distribution, sizing, min/max, and nested-layout
  semantics;
- fixed, content-sized, fill, percentage, mixed-unit, empty, invalid, and
  overflow cases;
- child order and Group/container interaction;
- transaction, undo/redo, load/save, collaboration, and instance behavior;
- Preset extension/replacement boundaries and app-owned UI behavior;
- Render/hit/export equivalence for completed computed geometry.

## Non-Goals While Deferred

- no placeholder or partial auto-layout profile in Preset;
- no Core or Scene Tree branch that assumes design-tool layout semantics;
- no UI-only calculation as canonical data authority;
- no Render fallback geometry, fixture-specific layout, or cache-driven product
  correction;
- no change to the first framework release scope.

## Pickup Condition

Begin only after all framework release gates close and product priority selects
Auto-layout over the other post-release Roadmap families. At pickup, replace
this direction record with an implementation-ready product contract and exact
Inspector before editing production code.
