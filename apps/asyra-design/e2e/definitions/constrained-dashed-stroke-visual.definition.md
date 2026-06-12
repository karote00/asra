# Constrained Dashed Stroke Visual Definition

This benchmark defines the screenshot-level oracle for the currently supported
constrained dashed slices across:

- full-loop topology family `full-loop visible`
- the first single-edge topology family `single-edge visible interval`
- the first corner-spanning topology family `corner-spanning visible interval`
- the first supported join/cap round representatives
- the first supported paint gradient-paint representative

It answers:

> When a supported shape-generated or vector-generated closed path uses a
> constrained dashed stroke whose visible interval either covers the full
> closed loop, stays within one legal edge span, or crosses one supported legal
> corner, does the real app/runtime path render the supported slices while
> keeping the remaining non-product diagnostic round/paint slices blocked?

## Current supported scope

- shape-generated `rect`
- `position: inside`
- `position: outside`
- one single-edge visible interval on a closed path
- vector-generated closed single-network rectangle-equivalent path
- `position: inside`
- `position: outside`
- one single-edge visible interval on a closed path
- vector-generated closed single-network non-rectangle-equivalent quadrilateral
  path
- `position: inside`
- `position: outside`
- one single-edge visible interval on a closed path
- shape-generated `rect`
- corner-spanning supported representatives on a closed path:
  - `position: inside + join: bevel`
  - `position: inside + join: miter`
  - `position: outside + join: bevel`
  - `position: outside + join: miter`
- vector-generated closed single-network rectangle-equivalent path
- corner-spanning supported representatives on a closed path:
  - `position: inside + join: bevel`
  - `position: inside + join: miter`
- vector-generated closed single-network non-rectangle-equivalent quadrilateral
  path
- corner-spanning supported representatives on a closed path:
  - `position: inside + join: bevel`
  - `position: inside + join: miter`
  - `position: outside + join: bevel`
- shape-generated `oval`
- `position: inside`
- `position: outside`
- vector-generated closed single-network rectangle-equivalent path
- `position: inside`
- `position: outside`
- vector-generated closed single-network non-rectangle-equivalent quadrilateral
  path
- `position: inside`
- `position: outside`
- `style: dashed`
- one full-loop visible interval on a closed path
- `join: bevel`
- `cap: butt`

## Required supported behavior

- rectangle inside constrained dashed full-loop stroke renders a visible inner
  band on the real product path
- the stroke remains constrained to the legal inner band and does not fill the
  rectangle center
- rectangle outside constrained dashed full-loop stroke renders a visible outer
  band on the same product path while the rectangle center remains unfilled
- rectangle inside constrained dashed single-edge stroke renders one visible
  inner interval on the legal top edge span only
- rectangle outside constrained dashed single-edge stroke renders one visible
  outer interval on the same legal top edge span only
- the first vector-generated closed rectangle-equivalent single-edge fixture
  keeps the same inside/outside interval-local semantics on the supported
  product path
- the first broader vector-generated closed non-rectangle-equivalent
  single-edge fixture keeps the same inside/outside interval-local semantics
  on the supported product path
- the first corner-spanning constrained dashed representatives keep one
  visible interval across a legal corner while the rectangle center
  remains absent for the current supported representatives:
  - `inside + bevel`
  - `inside + miter`
  - `outside + bevel`
  - `outside + miter`
- the first vector-generated closed rectangle-equivalent corner-spanning
  constrained dashed representatives keep the same legal inside-corner
  coverage on the supported product path for:
  - `inside + bevel`
  - `inside + miter`
  - `outside + bevel`
  - `outside + miter`
- the first broader vector-generated closed non-rectangle-equivalent
  corner-spanning constrained dashed representative keeps one visible inside
  interval across the supported top-right legal corner for:
  - `inside + bevel`
  - `inside + miter`
- the next broader vector-generated closed non-rectangle-equivalent
  corner-spanning constrained dashed representative keeps one visible outside
  interval across the same supported top-right legal corner for:
  - `outside + bevel`
  - `outside + miter`
- oval inside constrained dashed full-loop stroke renders a visible inner band
  on the same product path without filling the oval center
- oval outside constrained dashed full-loop stroke renders a visible outer band
  on the same product path without filling the oval center
- the first vector-generated closed rectangle-equivalent fixture keeps the same
  inside/outside visible-band semantics on the supported product path
- closed single-network vector repeated dashed strokes keep the authored
  `inside` / `outside` placement on the app path when the closed legality
  domain is valid; they must not silently render as centered substitute geometry
- the first vector-generated closed rectangle-equivalent round-join fixture
  keeps the same `full-loop + inside + round join` constrained dashed
  semantics on the supported product path
- the next vector-generated closed rectangle-equivalent round-join fixture
  keeps the same `full-loop + outside + round join` constrained dashed
  semantics on the supported product path
- the next broader vector-generated closed non-rectangle-equivalent round-join
  fixture keeps the same `full-loop + outside + round join` constrained dashed
  semantics on the supported product path
- shape-generated and vector-generated rectangle-equivalent fixtures keep
  matching `full-loop + outside + round join` constrained dashed coverage on
  the next supported join/cap source-equivalence topology family equivalence gate
- the next shape-generated `rect` round-join fixture keeps the same
  `full-loop + outside + round join` constrained dashed semantics on the
  supported product path
- the first vector-generated closed rectangle-equivalent round-cap fixture
  keeps the same `single-edge + inside + round cap` constrained dashed
  semantics on the supported product path
- the next vector-generated closed rectangle-equivalent round-cap fixture
  keeps the same `single-edge + outside + round cap` constrained dashed
  semantics on the supported product path
- shape-generated and vector-generated rectangle-equivalent fixtures keep
  matching `single-edge + outside + round cap` constrained dashed coverage on
  the next supported join/cap source-equivalence topology family equivalence gate
- the next shape-generated `rect` round-cap fixture keeps the same
  `single-edge + outside + round cap` constrained dashed semantics on the
  supported product path
- the first broader vector-generated closed non-rectangle-equivalent round-cap
  fixture keeps the same `single-edge + inside + round cap` constrained dashed
  semantics on the supported product path
- the next broader vector-generated closed non-rectangle-equivalent round-cap
  fixture keeps the same `single-edge + outside + round cap` constrained
  dashed semantics on the supported product path
- the first broader vector-generated closed non-rectangle-equivalent round-join
  fixture keeps the same `full-loop + inside + round join` constrained dashed
  semantics on the supported product path
- the shape-generated `rect` fixture keeps `corner-spanning + inside + round
  join` constrained dashed coverage on the uniform-width corner-spanning topology family product path
- the shape-generated `rect` fixture keeps `corner-spanning + outside + round
  join` constrained dashed coverage on the uniform-width corner-spanning topology family product path
- the closed rectangle-equivalent `vector` fixture keeps `corner-spanning +
  inside + round join` constrained dashed coverage on the uniform-width Family
  C product path
- the closed rectangle-equivalent `vector` fixture keeps `corner-spanning +
  outside + round join` constrained dashed coverage on the uniform-width Family
  C product path
- supported full-loop constrained dashed round joins use the shared constrained
  round geometry path; they must not substitute miter geometry as a proxy
- the first supported paint gradient-paint representative keeps the same constrained
  dashed `rect + full-loop + inside` geometry while swapping only paint to a
  local-bounds linear gradient on the bounded app/runtime path
- the next supported paint gradient-paint representative keeps the same constrained
  dashed `rect + full-loop + outside` geometry while swapping only paint to a
  local-bounds linear gradient on the bounded app/runtime path
- the next supported paint vector-generated gradient-paint representative keeps the
  same constrained dashed `full-loop + inside` geometry on a closed
  rectangle-equivalent `vector` path while swapping only paint to the same
  local-bounds linear gradient field
- the next supported paint vector-generated gradient-paint representative keeps the
  same constrained dashed `full-loop + outside` geometry on a closed
  rectangle-equivalent `vector` path while swapping only paint to the same
  local-bounds linear gradient field
- the next broader supported paint vector-generated gradient-paint representative keeps
  the same constrained dashed `full-loop + inside` geometry on a closed
  non-rectangle-equivalent quadrilateral `vector` path while swapping only
  paint to the same local-bounds linear gradient field
- the next broader supported paint vector-generated gradient-paint representative keeps
  the same constrained dashed `full-loop + outside` geometry on a closed
  non-rectangle-equivalent quadrilateral `vector` path while swapping only
  paint to the same local-bounds linear gradient field
- the next supported paint gradient-paint representative keeps the same constrained
  dashed `rect + single-edge + inside` geometry while swapping only paint to a
  local-bounds linear gradient on the bounded app/runtime path
- shape-generated and vector-generated rectangle-equivalent round-join
  full-loop coverage stays within the declared tolerance on the first supported join/cap
  source-equivalence topology family equivalence gate
- shape-generated and vector-generated rectangle-equivalent round-cap
  single-edge coverage stays within the declared tolerance on the next supported join/cap
  source-equivalence topology family equivalence gate
- shape-generated and vector-generated rectangle-equivalent full-loop gradient
  coverage stays within the declared tolerance on the first supported paint source-equivalence topology family
  equivalence gate
- the first broader vector-generated closed non-rectangle-equivalent fixture
  keeps the same inside/outside visible-band semantics on the supported product
  path
- shape-generated and vector-generated rectangle-equivalent full-loop coverage
  stays within the declared tolerance on the first source-equivalence topology family equivalence gate

## Required blocked behavior

- shape-generated `rect` with multiple eligible constrained dashed strokes
  renders both selected-side bands through typed multi-stroke ownership while
  leaving non-product center coverage absent
- open-path constrained dashed `vector` paths keep authored `inside` /
  `outside` in scene data and render through exact interval-local one-sided
  geometry for supported simple open paths
- real-created open single-network `vector` paths with repeated dash intervals
  keep authored `inside` / `outside` in scene data after switching from
  `center`, and render through exact constrained open-path semantics when the
  topology is supported
- real-created simple closed single-network `vector` paths with repeated dash
  intervals keep authored `inside` / `outside` in scene data after switching
  from `center`, and render through constrained multi-interval placement when
  the closed legality domain is valid
- simple closed cubic single-network `vector` paths with repeated dash
  intervals keep authored `inside` / `outside` in scene data after switching
  from `center`, and route through constrained multi-interval placement when
  the sampled closed legality domain is valid
- self-intersecting constrained dashed full-loop `vector` paths must render only
  through explicit domain-plan contour or dangling-span product entries
- the reported closed star-like single-network `vector` with repeated dash
  intervals keeps authored `inside` / `outside` in scene data after switching
  from `center`, and routes through constrained multi-interval placement when
  its sampled closed legality domain is valid; true self-intersecting
  fill-rule legality remains domain-plan classified before product output
- multi-network constrained dashed `vector` paths render each disjoint network
  through typed per-network ownership while keeping the inter-network gap absent
- corner-spanning constrained dashed slices are not part of this benchmark and
  remain blocked/pending elsewhere, except for:
  - the first shape-generated `rect + inside + bevel/miter` representative pair
  - the next bounded shape-generated `rect + outside + bevel/miter`
    representative pair
  - the first vector-generated closed rectangle-equivalent
    `inside + bevel/miter` representative pair
  - the next bounded vector-generated closed rectangle-equivalent
    `outside + bevel` representative
  - the matching bounded vector-generated closed rectangle-equivalent
    `outside + miter` representative
- broader non-full-loop constrained dashed slices beyond the first closed
  single-network rectangle-equivalent and first broader non-rectangle-
  equivalent vector fixtures are not part of this benchmark and remain
  blocked/pending elsewhere
- multi-network vector constrained dashed slices are not part of this benchmark
  and remain blocked/pending elsewhere
- constrained dashed gradient-paint support beyond the first supported paint
  representative remains blocked/pending elsewhere:
  - only these supported paint representatives are supported here:
    - shape-generated `rect + full-loop + inside + local-bounds linear gradient paint`
    - shape-generated `rect + full-loop + outside + local-bounds linear gradient paint`
    - shape-generated `rect + single-edge + inside + local-bounds linear gradient paint`
    - shape-generated `rect + single-edge + outside + local-bounds linear gradient paint`
    - shape-generated `rect + inside + bevel + corner-spanning + local-bounds linear gradient paint`
    - shape-generated `rect + outside + bevel + corner-spanning + local-bounds linear gradient paint`
    - closed rectangle-equivalent `vector + full-loop + inside + local-bounds linear gradient paint`
    - closed rectangle-equivalent `vector + full-loop + outside + local-bounds linear gradient paint`
    - closed rectangle-equivalent `vector + single-edge + inside + local-bounds linear gradient paint`
    - closed rectangle-equivalent `vector + single-edge + outside + local-bounds linear gradient paint`
    - closed rectangle-equivalent `vector + inside + bevel + corner-spanning + local-bounds linear gradient paint`
    - closed rectangle-equivalent `vector + outside + bevel + corner-spanning + local-bounds linear gradient paint`
    - closed non-rectangle-equivalent quadrilateral `vector + full-loop + inside + local-bounds linear gradient paint`
    - closed non-rectangle-equivalent quadrilateral `vector + full-loop + outside + local-bounds linear gradient paint`
    - closed non-rectangle-equivalent quadrilateral `vector + single-edge + inside + local-bounds linear gradient paint`
    - closed non-rectangle-equivalent quadrilateral `vector + single-edge + outside + local-bounds linear gradient paint`
    - closed non-rectangle-equivalent quadrilateral `vector + inside + bevel + corner-spanning + local-bounds linear gradient paint`
  - broader gradient-paint slices beyond these first vector-generated
    representatives remain
    blocked/pending
  - corner-spanning constrained dashed gradient paint remains blocked/pending
    beyond the first supported representative:
    - shape-generated `rect + inside + bevel + corner-spanning + local-bounds linear gradient paint`
    - shape-generated `rect + outside + bevel + corner-spanning + local-bounds linear gradient paint`
    - closed rectangle-equivalent `vector + inside + bevel + corner-spanning + local-bounds linear gradient paint`
    - closed non-rectangle-equivalent quadrilateral `vector + inside + bevel + corner-spanning + local-bounds linear gradient paint`
  - variable-width plus gradient combined slices remain blocked/pending

## Probe strategy

- create one rectangle
- configure one `dashed + inside` constrained full-loop stroke
- capture the selected element raster
- measure inner-band coverage, outer-band leakage, and center leakage
- repeat with `position: outside` and measure supported outer-band coverage
  plus inner-band leakage
- repeat on one rectangle with two eligible constrained dashed strokes and
  verify:
  - the authored inside/outside full-loop pair stays absent
  - the rectangle center remains absent
- repeat on one rectangle with `inside + round join` and verify:
  - constrained dashed coverage exists on the bounded app path
  - exterior leakage remains absent
  - the rectangle center remains absent
- repeat on one rectangle with `outside + round join` and verify:
  - constrained dashed coverage exists on the bounded exterior bands
  - interior leakage remains absent
  - the rectangle center remains absent
- repeat on one rectangle and one rectangle-equivalent closed vector with
  `outside + round join` and verify:
  - exterior top-band coverage stays equivalent
  - exterior left-band coverage stays equivalent
  - interior leakage stays absent on both sources
  - center coverage stays absent on both sources
- repeat on one rectangle with `outside + single-edge + round cap` and verify:
  - constrained dashed coverage exists on the supported exterior terminal cap
  - constrained dashed coverage exists on the supported exterior body span
  - terminal-cap leakage into the inner band remains absent
  - the later exterior gap remains absent
  - the rectangle center remains absent
- repeat on one rectangle-equivalent closed vector path with
  `outside + single-edge + round cap` and verify:
  - constrained dashed coverage exists on the supported exterior terminal cap
  - constrained dashed coverage exists on the supported exterior body span
  - terminal-cap leakage into the inner band remains absent
  - the later exterior gap remains absent
  - the vector center remains absent
- repeat on one rectangle and one rectangle-equivalent closed vector with
  `outside + single-edge + round cap` and verify:
  - exterior terminal-cap coverage stays equivalent
  - exterior body coverage stays equivalent
  - terminal-cap leakage into the inner band stays absent on both sources
  - the later exterior gap stays absent on both sources
  - center coverage stays absent on both sources
- repeat on one non-rectangle-equivalent closed vector path with
  `outside + single-edge + round cap` and verify:
  - constrained dashed coverage exists on the supported exterior terminal cap
  - constrained dashed coverage exists on the supported exterior body span
  - terminal-cap leakage into the inner band remains absent
  - the later exterior gap remains absent
  - the vector center remains absent
- repeat on one rectangle with `inside + full-loop + local-bounds linear
  gradient paint` and verify:
  - the constrained dashed geometry still follows the same legal inner band
  - the left inner probe skews toward the leading gradient stop
  - the right inner probe skews toward the trailing gradient stop
  - the rectangle center remains fill-colored, not stroke-colored
  - because the inspector does not yet expose stroke-gradient authoring, patch
    the selected stroke row through internal computed data and then sync the
    selected render element from that computed snapshot before raster capture
- repeat on one rectangle with `outside + full-loop + local-bounds linear
  gradient paint` and verify:
  - the constrained dashed geometry still follows the same legal outer band
  - the left outer probe skews toward the leading gradient stop
  - the right outer probe skews toward the trailing gradient stop
  - the rectangle center remains fill-colored, not stroke-colored
  - because the inspector does not yet expose stroke-gradient authoring, patch
    the selected stroke row through internal computed data and then sync the
    selected render element from that computed snapshot before raster capture
- repeat on one rectangle with `inside + single-edge + local-bounds linear
  gradient paint` and verify:
  - the constrained dashed geometry still follows the same legal interval-local
    top-edge band
  - the earlier interval probe skews more strongly toward the leading gradient
    stop than the later interval probe
  - a later same-edge gap stays fill-colored and does not inherit the stroke
    gradient skew
  - the rectangle center remains fill-colored, not stroke-colored
  - because the inspector does not yet expose stroke-gradient authoring, patch
    the selected stroke row through internal computed data and then sync the
    selected render element from that computed snapshot before raster capture
- repeat on one rectangle with `outside + single-edge + local-bounds linear
  gradient paint` and verify:
  - the constrained dashed geometry still follows the same legal interval-local
    exterior top-edge band
  - the earlier exterior interval probe skews more strongly toward the leading
    gradient stop than the later exterior interval probe
  - a later same-edge exterior gap stays background-colored and does not
    inherit the stroke gradient skew
  - the rectangle center remains fill-colored, not stroke-colored
  - because the inspector does not yet expose stroke-gradient authoring, patch
    the selected stroke row through internal computed data and then sync the
    selected render element from that computed snapshot before raster capture
- repeat on one rectangle with `inside + bevel + corner-spanning +
  local-bounds linear gradient paint` and verify:
  - the constrained dashed geometry still follows the same legal corner-local
    interval remainder
  - an earlier top-near-corner probe skews more strongly toward the leading
    gradient stop than a later top-near-corner probe on the same visible
    interval
  - the right-near-corner probe remains visibly painted because the interval
    still spans the legal turn
  - an earlier top-edge gap remains fill-colored and does not inherit the
    stroke gradient skew
  - exterior corner leakage remains absent
  - the rectangle center remains fill-colored, not stroke-colored
  - because the inspector does not yet expose stroke-gradient authoring, patch
    the selected stroke row through internal computed data and then sync the
    selected render element from that computed snapshot before raster capture
- repeat on one rectangle with `outside + bevel + corner-spanning +
  local-bounds linear gradient paint` and verify:
  - the constrained dashed geometry still follows the same legal corner-local
    exterior interval remainder
  - an earlier top-near-corner outside probe skews more strongly toward the
    leading gradient stop than a later top-near-corner outside probe on the
    same visible interval
  - the right-near-corner outside probe remains visibly painted because the
    interval still spans the legal turn
  - an earlier top-edge exterior gap remains background-colored
  - interior corner leakage remains fill-colored and does not inherit the
    stroke gradient skew
  - the rectangle center remains fill-colored, not stroke-colored
  - because the inspector does not yet expose stroke-gradient authoring, patch
    the selected stroke row through internal computed data and then sync the
    selected render element from that computed snapshot before raster capture
- repeat on one vector path patched to a closed rectangle-equivalent network
  with `inside + bevel + corner-spanning + local-bounds linear gradient
  paint` and verify:
  - the constrained dashed geometry still follows the same legal corner-local
    interval remainder
  - an earlier top-near-corner probe skews more strongly toward the leading
    gradient stop than a later top-near-corner probe on the same visible
    interval
  - the right-near-corner probe remains visibly painted because the interval
    still spans the legal turn
  - an earlier top-edge gap remains absent because this vector fixture has no
    fill
  - exterior corner leakage remains absent
  - the vector center remains absent because this vector fixture has no fill
  - patch the selected stroke row through internal computed data and then sync
    the selected render element from that computed snapshot before raster
    capture
- repeat on one vector path patched to a closed rectangle-equivalent network
  with `outside + bevel + corner-spanning + local-bounds linear gradient
  paint` and verify:
  - the constrained dashed geometry still follows the same legal corner-local
    exterior interval remainder
  - an earlier top-near-corner outside probe skews more strongly toward the
    leading gradient stop than a later top-near-corner outside probe on the
    same visible interval
  - the right-near-corner outside probe remains visibly painted because the
    interval still spans the legal turn
  - an earlier top-edge exterior gap remains absent because this vector fixture
    has no fill
  - interior corner leakage remains absent
  - the vector center remains absent because this vector fixture has no fill
  - patch the selected stroke row through internal computed data and then sync
    the selected render element from that computed snapshot before raster
    capture
- repeat on one vector path patched to a closed non-rectangle-equivalent
  quadrilateral network with `inside + bevel + corner-spanning +
  local-bounds linear gradient paint` and verify:
  - the constrained dashed geometry still follows the same legal corner-local
    interval remainder across the top and slanted legal turn
  - an earlier top-near-corner probe skews more strongly toward the leading
    gradient stop than a later top-near-corner probe on the same visible
    interval
  - the slanted-near-corner probe remains visibly painted because the interval
    still spans the legal turn
  - an earlier top-edge gap remains absent because this vector fixture has no
    fill
  - exterior corner leakage remains absent
  - the vector center remains absent because this vector fixture has no fill
  - patch the selected stroke row through internal computed data and then sync
    the selected render element from that computed snapshot before raster
    capture
- repeat on one vector path patched to a closed rectangle-equivalent network
  with `inside + round join` and verify:
  - constrained dashed coverage exists on the bounded app path
  - exterior leakage remains absent
  - the vector center remains absent
- repeat on one vector path patched to a closed rectangle-equivalent network
  with `inside + full-loop + local-bounds linear gradient paint` and verify:
  - the constrained dashed geometry still follows the same legal inner band
  - the left inner probe skews toward the leading gradient stop
  - the right inner probe skews toward the trailing gradient stop
  - the vector center remains absent because this vector fixture has no fill
  - patch the selected stroke row through internal computed data and then sync
    the selected render element from that computed snapshot before raster
    capture
- repeat on one vector path patched to a closed rectangle-equivalent network
  with `outside + full-loop + local-bounds linear gradient paint` and verify:
  - the constrained dashed geometry still follows the same legal outer band
  - the left outer probe skews toward the leading gradient stop
  - the right outer probe skews toward the trailing gradient stop
  - the vector center remains absent because this vector fixture has no fill
  - patch the selected stroke row through internal computed data and then sync
    the selected render element from that computed snapshot before raster
    capture
- repeat on one vector path patched to a closed rectangle-equivalent network
  with `inside + single-edge + local-bounds linear gradient paint` and verify:
  - the constrained dashed geometry still follows the same legal interval-local
    top-edge band
  - the earlier interval probe skews more strongly toward the leading gradient
    stop than the later interval probe
  - the later same-edge gap remains absent because this vector fixture has no
    fill
  - the vector center remains absent because this vector fixture has no fill
  - patch the selected stroke row through internal computed data and then sync
    the selected render element from that computed snapshot before raster
    capture
- repeat on one vector path patched to a closed rectangle-equivalent network
  with `outside + single-edge + local-bounds linear gradient paint` and verify:
  - the constrained dashed geometry still follows the same legal interval-local
    exterior top-edge band
  - the earlier exterior interval probe skews more strongly toward the leading
    gradient stop than the later exterior interval probe
  - the later same-edge exterior gap remains absent because this vector fixture
    has no fill
  - the vector center remains absent because this vector fixture has no fill
  - patch the selected stroke row through internal computed data and then sync
    the selected render element from that computed snapshot before raster
    capture
- repeat on one vector path patched to a closed non-rectangle-equivalent
  quadrilateral network with `outside + single-edge + local-bounds linear
  gradient paint` and verify:
  - the constrained dashed geometry still follows the same legal interval-local
    exterior top-edge band
  - the earlier exterior interval probe skews more strongly toward the leading
    gradient stop than the later exterior interval probe
  - the later same-edge exterior gap remains absent because this vector fixture
    has no fill
  - the vector center remains absent because this vector fixture has no fill
  - patch the selected stroke row through internal computed data and then sync
    the selected render element from that computed snapshot before raster
    capture
- repeat on one vector path patched to a closed non-rectangle-equivalent
  quadrilateral network with `inside + full-loop + local-bounds linear
  gradient paint` and verify:
  - the constrained dashed geometry still follows the same legal inner band
  - the left inner probe skews toward the leading gradient stop
  - the right inner probe skews toward the trailing gradient stop
  - the vector center remains absent because this vector fixture has no fill
  - patch the selected stroke row through internal computed data and then sync
    the selected render element from that computed snapshot before raster
    capture
- repeat on one vector path patched to a closed non-rectangle-equivalent
  quadrilateral network with `outside + full-loop + local-bounds linear
  gradient paint` and verify:
  - the constrained dashed geometry still follows the same legal outer band
  - the left outer probe skews toward the leading gradient stop
  - the right outer probe skews toward the trailing gradient stop
  - the vector center remains absent because this vector fixture has no fill
  - patch the selected stroke row through internal computed data and then sync
    the selected render element from that computed snapshot before raster
    capture
- repeat on one vector path patched to a closed non-rectangle-equivalent
  quadrilateral network with `inside + single-edge + local-bounds linear
  gradient paint` and verify:
  - the constrained dashed geometry still follows the same legal interval-local
    top-edge band
  - the earlier interval probe skews more strongly toward the leading gradient
    stop than the later interval probe
  - the later same-edge gap remains absent because this vector fixture has no
    fill
  - the vector center remains absent because this vector fixture has no fill
  - patch the selected stroke row through internal computed data and then sync
    the selected render element from that computed snapshot before raster
    capture
- compare shape-generated and vector-generated `inside + round join` full-loop
  probe coverage on matched `80x40` fixtures
- repeat on one vector path patched to a closed rectangle-equivalent network
  with `inside + single-edge + round cap` and verify:
  - cap coverage exists near the leading terminal
  - body coverage exists on the supported interval
  - exterior leakage remains absent
  - later top-edge spans remain absent
  - the vector center remains absent
- repeat on one vector path patched to a closed non-rectangle-equivalent
  quadrilateral network with `inside + single-edge + round cap` and verify:
  - cap coverage exists near the leading terminal
  - body coverage exists on the supported interval
  - exterior leakage remains absent
  - later top-edge spans remain absent
  - the vector center remains absent
- repeat on one vector path patched to a closed non-rectangle-equivalent
  quadrilateral network with `inside + round join` and verify:
  - constrained dashed coverage exists on the bounded app path
  - exterior leakage remains absent
  - the vector center remains absent
- repeat on one rectangle with `inside + single-edge + round cap` and verify:
  - cap coverage exists near the leading terminal
  - body coverage exists on the supported interval
  - exterior leakage remains absent
  - later top-edge spans remain absent
  - the rectangle center remains absent
- repeat on one vector path patched to a self-intersecting closed full-loop
  network and
  verify:
  - constrained dashed coverage remains absent on the bounded app path
  - the center remains absent
- repeat on the reported closed star-like single-network vector with a
  repeated dash pattern and verify:
  - the center-authored dashed stroke is visible
  - the same stroke remains visible after switching to authored `inside`
  - the same stroke remains visible after switching to authored `outside`
  - the constrained switch uses the supported constrained dashed packet path
    when the sampled closed legality domain is valid
- repeat on one vector path patched to one open horizontal line and verify:
  - constrained dashed coverage remains absent on the authored line span
  - nearby above-line and below-line bands remain absent
- repeat on one vector path patched to two disconnected closed rectangle
  networks and verify:
  - constrained dashed coverage remains absent on both disconnected networks
  - the inter-network gap remains absent
- repeat on one rectangle with a single-edge visible interval and verify:
  - the rectangle fixture stays axis-aligned for this probe
  - the authored dash pattern yields exactly one visible interval on the app
    fixture perimeter
  - coverage exists on the supported edge span
  - later spans on the same edge remain absent
  - the center remains absent
- repeat on one rectangle with a corner-spanning visible interval and verify:
  - coverage exists on both sides of the supported inside corner
  - unrelated top-edge spans remain absent
  - exterior leakage remains absent
  - the center remains absent
  - repeat once with `join: bevel`
  - repeat once with `join: miter`
  - repeat once with `position: outside + join: bevel` and verify:
    - coverage exists on both supported exterior corner-adjacent spans
    - unrelated top-edge spans remain absent
    - interior leakage remains absent
    - the center remains absent
  - repeat once with `position: outside + join: miter` and verify:
    - coverage exists on both supported exterior corner-adjacent spans
    - unrelated top-edge spans remain absent
    - interior leakage remains absent
    - the center remains absent
- repeat the same inside/outside probe strategy on one oval
- create one vector path, patch it to a closed rectangle-equivalent network,
  and repeat the same inside/outside probes on the supported vector fixture
- repeat on one vector path patched to a closed rectangle-equivalent network
  with a corner-spanning visible interval and verify:
  - coverage exists on both sides of the supported inside corner
  - unrelated top-edge spans remain absent
  - exterior leakage remains absent
  - the center remains absent
  - repeat once with `join: bevel`
  - repeat once with `join: miter`
- repeat on one vector path patched to a closed non-rectangle-equivalent
  quadrilateral network with a corner-spanning visible interval and verify:
  - coverage exists on the supported top edge near the corner
  - coverage exists on the adjacent slanted edge near the same corner
  - unrelated top-edge spans remain absent
  - exterior leakage remains absent
  - the center remains absent
  - repeat once with `position: inside + join: bevel`
  - repeat once with `position: inside + join: miter`
  - repeat once with `position: outside + join: bevel`
    - coverage exists on the supported top outside span near the corner
    - coverage exists on the adjacent slanted outside span near the same corner
    - interior leakage remains absent
  - repeat once with `position: outside + join: miter`
    - coverage exists on the supported top outside span near the corner
    - coverage exists on the adjacent slanted outside span near the same corner
    - interior leakage remains absent
- create one vector path, patch it to a closed non-rectangle-equivalent
  quadrilateral network, and repeat:
  - the same inside/outside probes on the first broader full-loop vector
    fixture
  - the same inside/outside single-edge probes on the first broader single-edge topology family
    vector fixture
- compare shape-generated and vector-generated probe coverage deltas for both
  `inside` and `outside`
- compare shape-generated and vector-generated round-cap single-edge probe
  coverage deltas on matched `80x40` fixtures using the tighter terminal-cap
  probe
- compare shape-generated and vector-generated full-loop gradient probe deltas
  on matched `80x40` fixtures using the same left/right inner-band color probes
  while intentionally excluding the center probe because the rectangle fixture
  keeps fill color and the vector fixture has no fill
- compare shape-generated and vector-generated single-edge probe coverage
  deltas for both `inside` and `outside` on matched `80x40` fixtures

## Pass thresholds

- supported inner-band coverage must be `> 0.55`
- supported exterior leakage must be `< 0.12`
- supported center leakage must be `< 0.03`
- supported outer-band coverage must be `> 0.55`
- supported single-edge interval coverage must be `> 0.55`
- vector single-edge round-cap terminal coverage may use a tighter probe with a
  lower bounded threshold of `> 0.25` on the first 4px rectangle-equivalent
  representative
- supported corner-spanning edge coverage must be `> 0.55`
- non-product same-edge gap coverage must be `< 0.03`
- supported interior leakage for the outside slice must be `< 0.12`
- shape/vector inside-band coverage delta must be `< 0.08`
- shape/vector outside-band coverage delta must be `< 0.08`
- shape/vector center leakage delta must be `< 0.03`
- shape/vector single-edge supported-interval coverage delta must be `< 0.08`
- shape/vector single-edge same-edge gap coverage delta must be `< 0.03`
- shape/vector round-cap terminal coverage delta must be `< 0.12`
- shape/vector gradient left/right alpha delta must be `< 20`
- shape/vector gradient left/right red-blue skew delta must be `< 40`
