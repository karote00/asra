# Solid Constrained Stroke Visual Definition

Authority note: this file is non-authoritative reference material for later
E2E/visual review. It must not define current stroke semantics, correctness
gates, inspector owner stages, route conditions, or product output rules.

This reference note describes later-phase screenshot measurement notes for
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
  - `round`
- Supported caps in this phase:
  - `butt`
  - `square`
  - `round` on closed paths, where terminal cap shape has no visible effect

## Visual Evidence Notes

### Supported constrained solid slices

- `rect inside/outside bevel`
- `rect inside/outside miter`
- `oval inside/outside bevel`
- `oval inside/outside miter`
- closed non-self-intersecting `vector inside/outside bevel`
- closed non-self-intersecting `vector inside/outside miter`
- closed constrained `inside/outside round` joins on formal simple paths
- closed constrained `round` cap equivalence on formal simple paths
- simple open vector placement through the formal unbounded open center product
- open self-intersecting contour placement through constrained domain entries

These formal slices must visibly render the constrained stroke band on the
expected side of the source shape while keeping the opposite side mostly clean.

### Domain-plan excluded slices

- inside dangling spans on open self-intersecting paths
- malformed constrained domains rejected by source/domain validation

These slices must not render a partial constrained stroke band. The only open
path center product is the formal simple-open unbounded case; contour-forming
open paths use constrained domain entries, and dangling outside spans use their
own both-side product entry.

### Closed constrained cap equivalence

On closed constrained shapes, `butt`, `square`, and `round` cap variants must
remain visually equivalent within the benchmark tolerance because terminal cap
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

- formal rectangle / vector benchmarks:
  - required formal-side coverage `> 0.6`
  - opposite-side leak `< 0.12`
  - center `< 0.03`
- formal oval benchmarks:
  - required inside coverage `> 0.45`
  - opposite-side leak `< 0.12`
- domain-plan excluded slices:
  - sampled coverage `< 0.03`
- closed constrained `butt` / `square` equivalence:
  - absolute sampled-band delta `< 0.12`
- closed constrained `butt` / `round` equivalence:
  - absolute sampled-band delta `< 0.12`

## Failure Meaning

- If a formal slice fails the formal-side coverage threshold, the
  constrained band is underfilled or routed through the wrong geometry.
- If the opposite-side leak threshold fails, the legality clipping or placement
  boundary is leaking outside the allowed domain.
- If a domain-plan excluded slice appears, the phase boundary has been broken
  and product-facing constrained geometry is leaking into a non-product slice.
- If the closed-loop cap equivalence fails, closed constrained geometry is
  incorrectly depending on terminal cap behavior.
