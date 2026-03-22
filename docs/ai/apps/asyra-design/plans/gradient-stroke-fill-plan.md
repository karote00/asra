# Plan: Gradient Stroke Fill

## Scope

Add gradient stroke fill so strokes can use the same authored gradient model as
fills: the gradient is defined in the element's local bounds space, and the
visible stroke samples that gradient according to each fragment's relative
position within that space.

This plan assumes the stroke renderer has already moved onto a
geometry-first path for the bugged dashed-corner cases. It does not change the
user-visible gradient editing model unless the existing fill model proves
insufficient for stroke use.

## Goal

Support stroke rendering where:

- the stroke has a visible region geometry
- that geometry is filled with a bounds-space gradient style
- the result matches the same spatial expectation users already have for
  gradient fills

In practice, this means a stroke should not own a separate "follow the path"
gradient system. It should consume the same local-space gradient style model
used by fills unless a later product decision explicitly introduces path-space
stroke gradients.

## Why This Must Build on Geometry-First

Gradient stroke fill is a poor fit for a `stroke(...)`-command-first renderer:

- `stroke(...)` describes centerlines plus width, not an explicit fillable area
- offscreen flattening can help composition, but it does not define exact
  geometry boundaries
- `inside` and dashed corner correctness still depend on exact shape limits

Geometry-first solves this cleanly:

- compute the visible stroke region once
- apply a `RenderFillStyle` over that region
- reuse the same local/bounds-space gradient mapping model already used by
  fill rendering

## User-Facing Behavior Target

For a stroke with gradient fill:

- gradient coordinates are interpreted in the element's local bounds space
- visible stroke pixels sample color from that same space
- `inside`, `center`, `outside`, and dashed stroke variants all use the same
  gradient field; only the visible geometry changes
- corner correctness and alpha correctness remain unchanged from the solid
  geometry-first stroke path

## Architectural Direction

Introduce a render path where stroke appearance is split into two layers:

1. Geometry

- exact visible stroke region
- position-aware and dash-aware
- shared with hit testing when accuracy matters

2. Paint

- solid color or `RenderFillStyle`
- gradient style reuses `createRenderGradientFillStyle(...)`
- local-space mapping stays consistent with existing fill rendering

This keeps paint concerns separate from geometry concerns.

## Data and API Considerations

1. Stroke property model

- decide whether stroke entries gain a `kind` plus gradient payload mirroring
  fill entries, or whether stroke paint is modeled through a shared paint
  contract
- preserve backward compatibility for existing solid-color strokes

2. Render abstraction

- allow stroke rendering to consume either a solid stroke paint or a
  `RenderFillStyle`
- avoid introducing Pixi-only paint types outside the render boundary

3. Bounds source of truth

- define exactly which local bounds the stroke gradient uses
- keep that rule stable across fill and stroke so editing is predictable

## Phased Work

1. Contract design

- define the persisted stroke gradient shape
- define how stroke gradient data maps to render paint inputs

2. Renderer integration

- route gradient-capable strokes through the geometry-first fill path
- ensure all supported stroke positions and dashed parts sample the same local
  gradient field

3. UI and editing

- expose gradient stroke controls after render contracts are stable
- reuse existing gradient preview and handle patterns wherever possible

4. Regression coverage

- solid strokes remain unchanged when no gradient is authored
- gradient stroke matches bounds-space expectations on rectangles and vectors
- dashed and `inside` cases keep the same corrected geometry boundaries

## Dependencies

- depends on the geometry-first stroke rendering direction being in place for
  the corrected dashed-corner path
- should reuse the existing gradient fill render abstraction instead of
  creating a second gradient engine

## Verification

- renderer tests for local-space gradient sampling on stroke geometry
- regression tests for `inside`, `center`, `outside`, and dashed variants
- manual checks comparing fill and stroke gradient alignment on the same bounds
- property/UI checks once authoring controls are added

## Exit Criteria

- strokes can render with bounds-space gradients through the main renderer
- gradient stroke paint is applied over exact visible stroke geometry
- corrected dashed/inside geometry behavior remains intact
- stroke and fill gradient mapping rules are consistent and documented
