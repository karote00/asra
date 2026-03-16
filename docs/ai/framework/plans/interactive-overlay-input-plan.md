# Plan: Interactive Overlay Input Bridge

## Goal

Provide a framework-level, easy-to-use interaction workflow for render overlays
(handles/stops/anchors) that delivers deterministic hit testing, pointer capture,
and `render.*` events without leaking engine primitives outside `@asyra/render`.

## Context

Interactive overlays (gradient handles, vector points, guides) currently rely on
app-side geometry hit tests and standard input events. This creates performance
pressure and drag conflicts (overlay drag vs element drag). The framework already
supports render-layer registration and an interaction handler registry, but there
is no unified, render-owned input bridge that app features can opt into with
minimal setup.

## Scope

In scope:
- render-side interaction target model and hit-test plumbing
- render -> core event bridge for `render.*` input events
- pointer capture policy that prevents underlying element drag when overlay is active
- core-level API surface for registering overlay interaction targets
- documentation and starter examples for app authors

Out of scope:
- app-specific edit logic (e.g., gradient math, vector tool behavior)
- property panel interaction wiring
- changes to persistence or schema

## Target Behavior

1. Render layers can register interactive targets with stable ids and metadata
   (type, z-index, capture policy).
2. Render engine emits `render.pointerdown/move/up` (and hover) events with target
   ids + coordinate data that are engine-agnostic.
3. Pointer capture prevents element dragging when an overlay target is active.
4. `defineFeature` can opt into `render.*` events via a documented bridge without
   per-app Pixi bindings.
5. Common hit-test helpers (point, circle, segment, polyline) are available and
   cached to avoid per-move geometry recompute.

## Implementation Slices

1. Render interaction target model
- Add target descriptor (`id`, `type`, `zIndex`, `bounds`, `hitTest`, `capture`) to
  `@asyra/render` interaction registry.
- Provide helper target factories for common overlay shapes with cached geometry.

2. Render event bridge
- Route render input through a core-owned bridge that emits typed `render.*` events
  via `@asyra/reactive-events`.
- Normalize coordinate data (canvas/world/local) through the render adapter.

3. Pointer capture policy
- Implement capture tracking in render layer manager or interaction registry.
- Ensure active capture cancels or suppresses element drag in the standard input flow.

4. Core API surface
- Expose `core.registerRenderInteractionTargets(...)` (or equivalent) as a facade
  so app/preset code can register overlay targets without touching `@asyra/render`.
- Provide `core.registerRenderInteractionHandler(...)` for feature-level bridging.

5. App-level ergonomics
- Document a minimal example for an overlay feature using `render.*` events.
- Provide guidance on target lifecycle (register/update/unregister) and z-order.

6. Validation + tests
- Add tests for capture precedence vs element drag.
- Add render interaction target hit-test coverage (bounds + shape helpers).
- Verify no Pixi imports outside `@asyra/render`.

## Risks

1. Event order conflicts with existing input system may cause unexpected tool states.
2. Capture logic could block unrelated interactions if mis-scoped.
3. Poor invalidation of cached geometry could cause stale hit tests.

## Success Criteria

- Overlay handle drag works without moving the element underneath.
- App authors can implement overlay interaction with minimal boilerplate.
- Render engine remains isolated; no engine primitives leak to core/app.
- Performance improves by avoiding per-move heavy geometry hit tests.
