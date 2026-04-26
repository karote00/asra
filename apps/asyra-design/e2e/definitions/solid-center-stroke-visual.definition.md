# Solid Center Stroke Visual Definition

This definition file describes the screenshot-level oracle for
`solid-center-stroke-visual.spec.ts`.

## Fixture Scope

- Shape: `rect`
- Stroke style: `solid`
- Stroke position: `center`
- Width: `10`
- Color: bright green (`#00FF00`)
- Supported joins under this benchmark:
  - `miter`
  - `bevel`
  - `round`

## Visual Contract

### Miter

- The center stroke band must remain visible across the top and left samples.
- The fill interior must remain empty at the center probe.
- The outer top-left corner square must remain filled, because the miter join
  keeps the square corner rather than cutting it away.

### Bevel

- The center stroke band must remain visible across the top and left samples.
- The fill interior must remain empty at the center probe.
- The outer top-left corner square must be mostly absent, because the bevel
  join cuts that square corner away with a diagonal edge.

### Round

- The center stroke band must remain visible across the top and left samples.
- The fill interior must remain empty at the center probe.
- The extreme miter-tip probe must remain absent, because the promoted round
  join follows curved corner coverage instead of filling the miter spike.

## Measured Observables

The test measures green-pixel coverage ratios from a screenshot clipped around
the selected rectangle.

- `topBand`: verifies visible center-stroke band at the top edge
- `leftBand`: verifies visible center-stroke band at the left edge
- `center`: verifies the interior fill area remains stroke-free
- `outerCornerSquare`: distinguishes `miter` vs `bevel`
  / `round`
- `miterTip`: verifies `round` does not overfill the miter spike

## Pass Conditions

- `miter`
  - `topBand > 0.6`
  - `leftBand > 0.6`
  - `center < 0.03`
  - `outerCornerSquare > 0.55`
- `bevel`
  - `topBand > 0.6`
  - `leftBand > 0.6`
  - `center < 0.03`
  - `outerCornerSquare < 0.18`
- `round`
  - `topBand > 0.6`
  - `leftBand > 0.6`
  - `center < 0.03`
  - `miterTip < 0.03`

## Failure Meaning

- If `miter` fails the corner-square assertion, the outer corner is being cut
  away or underfilled.
- If `bevel` fails the corner-square assertion, the corner is behaving like a
  square/miter join instead of a bevel cut.
- If either supported join fails the band assertions, the rendered stroke width
  or placement is visually incorrect.
- If `round` fills the miter-tip probe like a miter join, the curved
  corner semantics have regressed.
