# Constrained Solid Legality Debug Surface

## Scope

This benchmark validates the first visible Phase 4B legality-domain viewer on
the real app/runtime path.

Current benchmark scope:

- selected single rectangle
- one `solid + inside` stroke
- one `solid + outside` stroke
- legality-domain debug overlay
- overlapping `solid + outside` strokes
- ownership debug overlay
- overlapping `solid + outside` strokes with distinct colors on the final
  product path
- five nested `solid + outside` strokes on the first broader owner-domain path
- six nested `solid + outside` strokes on the next broader owner-domain path
- seven nested `solid + outside` strokes on the next broader owner-domain path
- eight nested `solid + outside` strokes on the next broader owner-domain path
- nine nested `solid + outside` strokes on the next broader owner-domain path
- ten nested `solid + outside` strokes under the subset-budget broader
  owner-domain path
- five nested `solid + outside` strokes on a mixed-topology multi-network
  vector-generated path
- six nested `solid + outside` strokes on a mixed-topology multi-network
  vector-generated path
- one `bevel` owner plus one `miter` non-owner `solid + outside` stroke on a
  mixed-topology multi-network vector-generated path
- one `bevel` owner plus one `miter` non-owner `solid + outside` stroke on a
  mixed-topology multi-network vector-generated path where one disconnected
  sub-packet is a non-orthogonal non-convex piece
- one `bevel` owner plus one `miter` non-owner `solid + outside` stroke on a
  mixed-topology multi-network vector-generated path where multiple
  disconnected sub-packets are non-orthogonal non-convex pieces
- one canonical rectangle path represented by:
  - shape-generated rectangle source
  - vector-generated closed rectangle source
  - both using one `bevel` owner plus one `miter` non-owner `solid + outside`
    stroke
- one broader mixed-topology vector path represented twice by equivalent
  authored topology:
  - canonical vector-generated source
  - reordered/reversed equivalent vector-generated source
  - both using one `bevel` owner plus one `miter` non-owner `solid + outside`
    stroke

## Expected Behavior

- when Phase 4B debug mode is enabled, the selected element must show a visible
  legality-domain overlay
- inside legality overlays must use the inside-mode color family
- outside legality overlays must use the outside-mode color family
- the overlay must come from the runtime-selected element diagnostics, not from
  a mocked legality helper
- when the debug flag is disabled, the overlay must disappear
- when ownership mode is enabled, overlapping supported constrained solid
  strokes must show a visible ownership overlay
- when exact foreign-owned outside polygons are removed by owner-domain
  clipping, the final render must keep the owner stroke visible while the
  foreign-owned stroke color remains visually absent
- when the first broader owner-domain path is enabled for five nested outside
  strokes, the ownership overlay must remain visible, the primary owner stroke
  must remain visible, and the fifth stroke color must remain visually absent
- when the next broader owner-domain path is enabled for six nested outside
  strokes, the ownership overlay must remain visible, the primary owner stroke
  must remain visible, and the sixth stroke color must remain visually absent
- when the next broader owner-domain path is enabled for seven nested outside
  strokes, the ownership overlay must remain visible, the primary owner stroke
  must remain visible, and the seventh stroke color must remain visually absent
- when the next broader owner-domain path is enabled for eight nested outside
  strokes, the ownership overlay must remain visible, the primary owner stroke
  must remain visible, and the eighth stroke color must remain visually absent
- when the next broader owner-domain path is enabled for nine nested outside
  strokes, the ownership overlay must remain visible, the primary owner stroke
  must remain visible, and the ninth stroke color must remain visually absent
- when the subset-budget broader owner-domain path is enabled for ten nested
  outside strokes, the ownership overlay must remain visible, the primary
  owner stroke must remain visible, and the tenth stroke color must remain
  visually absent
- when the mixed-topology broader owner-domain path is enabled for five nested
  outside strokes on a multi-network vector, the ownership overlay must remain
  visible, the primary owner stroke must remain visible, and the fifth stroke
  color must remain visually absent
- when the mixed-topology broader owner-domain path is enabled for six nested
  outside strokes on a multi-network vector, the ownership overlay must remain
  visible, the primary owner stroke must remain visible, and the sixth stroke
  color must remain visually absent
- when the broader mixed-topology subtraction path is enabled for one `bevel`
  owner plus one `miter` non-owner outside stroke on a multi-network vector,
  the ownership overlay must remain visible, the primary owner stroke must
  remain visible, and the miter non-owner must retain its local visible
  remainder instead of disappearing completely
- when the broader mixed-topology subtraction path is enabled for one `bevel`
  owner plus one `miter` non-owner outside stroke on a multi-network vector
  where one disconnected sub-packet is a non-orthogonal non-convex piece, the
  ownership overlay must remain visible, the primary owner stroke must remain
  visible, and the miter non-owner must retain its local visible remainder
  instead of disappearing completely
- when the broader mixed-topology subtraction path is enabled for one `bevel`
  owner plus one `miter` non-owner outside stroke on a multi-network vector
  where multiple disconnected sub-packets are non-orthogonal non-convex
  pieces, the ownership overlay must remain visible, the primary owner stroke
  must remain visible, and the miter non-owner must retain its local visible
  remainders instead of disappearing completely
- when the same local-remainder subtraction semantics are exercised on a
  shape-generated rectangle and a vector-generated closed rectangle, both
  sources must keep the primary owner visible and the local miter remainder
  visible within the same tolerance band
- when the same non-orthogonal mixed-topology subtraction semantics are
  exercised on two equivalent vector-generated inputs, both sources must keep
  the primary owner visible and the local miter remainder visible within the
  same tolerance band

## Probe Strategy

- create a rectangle
- configure one supported constrained-solid stroke
- switch between `inside` and `outside`
- capture the selected element raster
- measure legality-overlay color coverage inside the raster
- measure ownership-overlay color coverage inside the raster
- measure owner-stroke color coverage versus foreign-owned stroke color
  coverage on the final render path
- measure ownership overlay coverage plus primary-owner / fifth-stroke color
  coverage on the five-stroke broader owner-domain scenario
- measure ownership overlay coverage plus primary-owner / sixth-stroke color
  coverage on the six-stroke broader owner-domain scenario
- measure ownership overlay coverage plus primary-owner / seventh-stroke color
  coverage on the seven-stroke broader owner-domain scenario
- measure ownership overlay coverage plus primary-owner / eighth-stroke color
  coverage on the eight-stroke broader owner-domain scenario
- measure ownership overlay coverage plus primary-owner / ninth-stroke color
  coverage on the nine-stroke broader owner-domain scenario
- measure ownership overlay coverage plus primary-owner / tenth-stroke color
  coverage on the ten-stroke subset-budget broader owner-domain scenario
- measure ownership overlay coverage plus primary-owner / fifth-stroke color
  coverage on the mixed-topology multi-network vector broader owner-domain
  scenario
- measure ownership overlay coverage plus primary-owner / sixth-stroke color
  coverage on the mixed-topology six-stroke multi-network vector broader
  owner-domain scenario
- measure ownership overlay coverage plus primary-owner / secondary-blue color
  coverage on the mixed-topology bevel-vs-miter broader subtraction scenario
- measure ownership overlay coverage plus primary-owner / secondary-blue color
  coverage on the mixed-topology bevel-vs-miter broader subtraction scenario
  where one disconnected sub-packet is a non-orthogonal non-convex piece
- measure ownership overlay coverage plus primary-owner / secondary-blue color
  coverage on the mixed-topology bevel-vs-miter broader subtraction scenario
  where multiple disconnected sub-packets are non-orthogonal non-convex
  pieces
- measure primary-owner / secondary-blue coverage on:
  - a shape-generated rectangle
  - a vector-generated closed rectangle
  under the same bevel-vs-miter local-remainder subtraction semantics
- measure primary-owner / secondary-blue coverage on:
  - a canonical mixed-topology vector with one non-orthogonal non-convex
    disconnected sub-packet
  - an equivalent reordered/reversed vector for the same path
  under the same bevel-vs-miter local-remainder subtraction semantics

## Pass Thresholds

- inside legality overlay coverage must be `> 0.01`
- outside legality overlay coverage must be `> 0.005`
- ownership overlay coverage must be `> 0.005`
- disabled overlay coverage must be `< 0.002`
- owner-stroke color coverage must be `> 0.01`
- foreign-owned stroke color coverage must be `< 0.001`
- five-stroke ownership overlay coverage must be `> 0.005`
- five-stroke primary owner coverage must be `> 0.01`
- five-stroke fifth-color coverage must be `< 0.001`
- six-stroke ownership overlay coverage must be `> 0.005`
- six-stroke primary owner coverage must be `> 0.01`
- six-stroke sixth-color coverage must be `< 0.001`
- seven-stroke ownership overlay coverage must be `> 0.005`
- seven-stroke primary owner coverage must be `> 0.01`
- seven-stroke seventh-color coverage must be `< 0.001`
- eight-stroke ownership overlay coverage must be `> 0.005`
- eight-stroke primary owner coverage must be `> 0.01`
- eight-stroke eighth-color coverage must be `< 0.001`
- nine-stroke ownership overlay coverage must be `> 0.005`
- nine-stroke primary owner coverage must be `> 0.01`
- nine-stroke ninth-color coverage must be `< 0.001`
- ten-stroke ownership overlay coverage must be `> 0.005`
- ten-stroke primary owner coverage must be `> 0.01`
- ten-stroke tenth-color coverage must be `< 0.001`
- mixed-topology vector ownership overlay coverage must be `> 0.002`
- mixed-topology vector primary owner coverage must be `> 0.005`
- mixed-topology vector fifth-color coverage must be `< 0.001`
- mixed-topology six-stroke vector ownership overlay coverage must be `> 0.002`
- mixed-topology six-stroke vector primary owner coverage must be `> 0.005`
- mixed-topology six-stroke vector sixth-color coverage must be `< 0.001`
- mixed-topology bevel-vs-miter vector ownership overlay coverage must be `> 0.002`
- mixed-topology bevel-vs-miter vector primary owner coverage must be `> 0.005`
- mixed-topology bevel-vs-miter vector secondary-blue coverage must be `> 0.002`
- mixed-topology bevel-vs-miter non-orthogonal vector ownership overlay coverage must be `> 0.002`
- mixed-topology bevel-vs-miter non-orthogonal vector primary owner coverage must be `> 0.005`
- mixed-topology bevel-vs-miter non-orthogonal vector secondary-blue coverage must be `> 0.002`
- mixed-topology bevel-vs-miter multi-non-orthogonal vector ownership overlay coverage must be `> 0.002`
- mixed-topology bevel-vs-miter multi-non-orthogonal vector primary owner coverage must be `> 0.005`
- mixed-topology bevel-vs-miter multi-non-orthogonal vector secondary-blue coverage must be `> 0.002`
- shape/vector local-remainder primary owner coverage must be `> 0.005`
- shape/vector local-remainder secondary-blue coverage must be `> 0.002`
- shape/vector local-remainder primary coverage delta must be `< 0.01`
- shape/vector local-remainder secondary coverage delta must be `< 0.01`
- equivalent mixed-topology vector primary owner coverage must be `> 0.005`
- equivalent mixed-topology vector secondary-blue coverage must be `> 0.002`
- equivalent mixed-topology vector primary coverage delta must be `< 0.01`
- equivalent mixed-topology vector secondary coverage delta must be `< 0.01`
