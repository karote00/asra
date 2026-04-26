# Solid Constrained Stroke Visual Definition

This definition file describes the screenshot-level oracle for
`solid-constrained-stroke-visual.spec.ts`.

## Fixture Scope

- Shapes:
  - `rect`
  - `oval`
  - `vector`
- Stroke style: `solid`
- Stroke positions:
  - `inside`
  - `outside`
- Width:
  - `10` for rectangle benchmarks
  - `8` for oval / vector benchmarks
- Color: bright green (`#00FF00`)
- Supported joins in this phase:
  - `miter`
  - `bevel`
- Unsupported joins in this phase:
  - `round`
- Supported caps in this phase:
  - `butt`
  - `square`
- Unsupported caps in this phase:
  - `round`

## Visual Contract

### Supported constrained solid slices

- `rect inside/outside bevel`
- `rect inside/outside miter`
- `oval inside/outside bevel`
- `oval inside/outside miter`
- closed non-self-intersecting `vector inside/outside bevel`
- closed non-self-intersecting `vector inside/outside miter`
- open `vector inside/outside` authored placement through centered fallback

These supported slices must visibly render the constrained stroke band on the
expected side of the source shape while keeping the opposite side mostly clean.

### Unsupported or rejected constrained slices

- constrained `round` join
- constrained `round` cap
- open constrained vector clipping
- self-intersecting constrained vector paths

These slices must not render a partial constrained stroke band. Open vectors
are the exception at the product render layer: authored `inside` / `outside`
must stay stored, but visible stroke placement falls back to centered rendering.

### Closed constrained cap equivalence

On closed constrained shapes, `butt` and `square` cap variants must remain
visually equivalent within the benchmark tolerance because terminal cap
semantics should not change a closed loop result.

## Measured Observables

The test measures green-pixel coverage ratios from a screenshot clipped around
the selected element.

- `topInside` / `leftInside`
  - verify the constrained band is visible on the inner side
- `topOutside` / `leftOutside`
  - verify the constrained band is visible on the outer side
- `center`
  - verify the fill interior is not being replaced by stroke

## Pass Conditions

- supported rectangle / vector benchmarks:
  - required supported-side coverage `> 0.6`
  - opposite-side leak `< 0.12`
  - center `< 0.03`
- supported oval benchmarks:
  - required inside coverage `> 0.45`
  - opposite-side leak `< 0.12`
- unsupported / rejected slices:
  - sampled coverage `< 0.03`
- closed constrained `butt` / `square` equivalence:
  - absolute sampled-band delta `< 0.12`

## Failure Meaning

- If a supported slice fails the supported-side coverage threshold, the
  constrained band is underfilled or routed through the wrong geometry.
- If the opposite-side leak threshold fails, the legality clipping or placement
  boundary is leaking outside the allowed domain.
- If an unsupported or rejected slice appears, the phase boundary has been
  broken and product-facing constrained geometry is leaking into a blocked
  slice.
- If the closed-loop cap equivalence fails, closed constrained geometry is
  incorrectly depending on terminal cap behavior.
