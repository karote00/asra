# Stroke Engine Reference Research Findings

## Role

This file records external reference findings used to close stroke-engine
uncertainty.

It does not replace the active contracts. It feeds decisions back into:

- `source-of-truth.md`
- `topology-and-product-semantics.md`
- `exact-correct-path-algorithm.md`
- `testing-and-benchmark-spec.md`

## Reference Priority Used

Research follows this order:

1. Figma official documentation
2. captured Figma-visible behavior when official docs are incomplete
3. other established design-software or design-tool references
4. other large-company graphics or runtime references
5. mature geometry libraries and algorithm references
6. Asyra deterministic semantics with recorded divergence

If a lower-priority source conflicts with a higher-priority source, the
higher-priority source wins for product-visible behavior.

Design-software references outrank general runtime references. Algorithm
references may define construction mechanics. They may not override Figma-like
or design-tool product semantics.

## Figma Findings

### Stroke Alignment

References:

- Figma `strokeAlign`:
  `https://developers.figma.com/docs/plugins/api/properties/nodes-strokealign/`
- Figma stroke properties:
  `https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties`
- Figma REST node types:
  `https://developers.figma.com/docs/rest-api/file-node-types`

Findings:

- Figma exposes `CENTER`, `INSIDE`, and `OUTSIDE`.
- Figma defines inside strokes as completely inside the shape and outside
  strokes as completely outside the shape.
- Figma documentation says its internal implementation doubles stroke weight and
  masks by fill.
- Figma Help states most shapes default to inside strokes, while lines default
  to center strokes.
- Figma Help states SVG only supports center strokes; inside/outside SVG export
  is simplified to preserve appearance but may produce more complex SVG code.

Asyra decision:

- Match Figma-visible containment semantics.
- Do not copy Figma's doubled-width masking implementation for exact product
  geometry.
- Build direct one-sided geometry and validate containment with face-level
  tests.
- For open paths, keep the active Asyra product rule: authored `inside` and
  `outside` resolve to center-equivalent geometry. This is an explicit product
  simplification from the Figma-like closed-shape goal, not an implementation
  fallback.

### Stroke Geometry API Caveat

Reference:

- Figma `strokeGeometry` on node APIs:
  `https://developers.figma.com/docs/plugins/api/InstanceNode/`
- Figma `outlineStroke()` on node APIs:
  `https://developers.figma.com/docs/plugins/api/InstanceNode/`

Findings:

- Figma exposes `strokeGeometry` as paths representing object strokes.
- Figma states `strokeGeometry` is always from the center regardless of
  `strokeAlign`.
- Figma exposes `outlineStroke()` as the API operation closest to editor
  Outline Stroke behavior while leaving the original node intact.

Asyra decision:

- Figma `strokeGeometry` is not a sufficient oracle for exact constrained
  inside/outside output.
- Use Figma-visible capture and `outlineStroke()`-style references for product
  behavior where constrained alignment matters.

### Vector Networks And Legal Domains

References:

- Figma vector networks help:
  `https://help.figma.com/hc/en-us/articles/360040450213-Vector-networks`
- Figma `VectorNetwork`:
  `https://developers.figma.com/docs/plugins/api/VectorNetwork/`
- Figma `VectorPath`:
  `https://developers.figma.com/docs/plugins/api/VectorPath/`
- Figma `windingRule`:
  `https://developers.figma.com/docs/plugins/api/properties/VectorPath-windingrule/`

Findings:

- Figma vector networks are graph-like and can have multiple paths and branches.
- Segments are non-directional graph edges.
- Regions contain one or more loops and a winding rule.
- A region such as a letter `o` is represented with two loops.
- `VectorPath.windingRule` is `NONZERO`, `EVENODD`, or `NONE`.
- Figma says the winding rule determines whether a point is inside or outside.

Asyra decision:

- Model legal domains as explicit region records, not contour-order guesses.
- Preserve typed region, loop, segment, and winding-rule metadata through stroke
  candidate construction and face classification.
- For compound closed paths, use Figma-like region loops and winding rules as
  the product reference.
- If a vector has no explicit legal region data, support remains gated until
  Figma fixture capture defines the fill-domain behavior for that family.

### Joins And Miter Limit

References:

- Figma `StrokeJoin`:
  `https://developers.figma.com/docs/plugins/api/StrokeJoin/`
- Figma `strokeMiterLimit` node property:
  `https://developers.figma.com/docs/plugins/api/VectorNode/`
- Figma REST `strokeMiterAngle`:
  `https://developers.figma.com/docs/rest-api/file-node-types`

Findings:

- Figma joins are `MITER`, `BEVEL`, and `ROUND`.
- Figma defines `MITER` as sharp unless the angle is below the configured miter
  angle, then the point is cut to bevel.
- Figma documents `strokeMiterLimit` as the same as SVG miter limit.
- Figma REST exposes `strokeMiterAngle` and documents the default as `28.96`
  degrees. This corresponds to SVG miter limit `4` via
  `miterLimit = 1 / sin(angle / 2)`.

Asyra decision:

- Miter-limit exceedance emits bevel geometry in the supported exact family.
- This is not a blocked state.
- Runtime normalization converts `miterAngle` into SVG-style `miterLimit`.
- `miterAngle = 0` means no positive corner angle is below the threshold, so the
  normalized miter limit is infinite rather than falling back to Figma's default
  `28.96` degree threshold.

### Caps And Endpoint Styling

References:

- Figma `StrokeCap`:
  `https://developers.figma.com/docs/plugins/api/StrokeCap/`
- Figma vector-network cap help:
  `https://help.figma.com/hc/en-us/articles/360040450213-Vector-networks`

Findings:

- Figma supports no cap, round, square, and several arrow/shape caps.
- Figma lets vector-network endpoints carry cap styling.
- Figma's help text says round cap extends by half the stroke weight and square
  cap extends by half the stroke weight.

Asyra decision:

- Baseline exact open-path support should first cover no cap, round cap, and
  square cap.
- Arrow, diamond, circle, triangle, and other decorated caps remain separately
  gated unless product scope requires them.

### Dashed Stroke Behavior

References:

- Figma stroke properties:
  `https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties`
- Figma `dashPattern` node property:
  `https://developers.figma.com/docs/plugins/api/VectorNode/`

Findings:

- Figma exposes dash and gap lengths in pixels.
- Figma custom dash syntax is `dash, gap, dash, gap`.
- Figma says it starts and ends every dashed line with a half-length dash.
- Figma exposes `dashPattern` as alternating dash and gap lengths.

Asyra decision:

- Product open-path dashed strokes resolve authored `inside` / `outside`
  positions as center geometry.
- Runtime stroke data uses `dashPattern` and `dashOffset` as the canonical dash
  API. Legacy `dash` / `gap` compatibility fields are not runtime geometry
  inputs; old serialized data must be migrated before render normalization.
- Figma's half-dash endpoint behavior still needs a dedicated fixture set before
  more advanced open dashed semantics, endpoint balancing, or decorated caps are
  supported.
- Closed-loop dashed support may continue to use canonical arc-length interval
  allocation, but seam behavior must be validated against Figma fixtures.

### 2026-04-29 Self-Intersecting Inside Dashed Reclassification

References:

- SVG 2 painting and dashing:
  `https://www.w3.org/TR/SVG2/painting.html`
- MDN `stroke-dasharray`:
  `https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-dasharray`
- MDN `stroke-dashoffset`:
  `https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-dashoffset`
- Figma Guide to fills:
  `https://help.figma.com/hc/en-us/articles/360041003694-Guide-to-fills`
- Figma Paint API:
  `https://www.figma.com/plugin-docs/api/Paint/`
- Skia dash path effect:
  `https://api.skia.org/classSkDashPathEffect.html`

Findings:

- SVG defines dash arrays as alternating dash/gap intervals and repeats an odd
  list to an even list. Negative dash values are invalid; an all-zero list
  renders solid.
- SVG defines dash offset as the offset into the dash array. Skia likewise uses
  an even interval array plus phase modulo the interval sum.
- Figma user-facing docs describe a stroke fill as the visible outline paint,
  and Figma Paint API represents solid, gradient, image, video, and pattern as
  paint payloads independent from geometry.
- Therefore stroke paint should be represented as a reusable paint/fill payload
  attached after geometry resolution.
- A closed self-intersecting `inside` dashed path cannot be product-rendered
  from segment-local dash candidates. Candidate overlap would apply opacity
  multiple times and can leak outside the legal inside domain.

Asyra decision:

- Constrained dashed `inside/outside` on self-intersecting closed paths is
  blocked until planar arrangement can split intersections, classify legal
  faces, and collapse duplicate semantic regions.
- The runtime may expose typed blocked diagnostics for this family.
- It must not render local-side interval candidates as product geometry.
- Figma half-dash endpoint behavior must not be assumed to apply unchanged to
  every closed-loop or constrained dashed family without capture.

### Boolean Geometry

Reference:

- Figma boolean operations:
  `https://help.figma.com/hc/en-us/articles/360039957534-Boolean-operations`

Findings:

- Figma boolean operations are non-destructive.
- Figma says updated boolean operations use a layer's stroke and fill to
  calculate the resulting shape geometry.

Asyra decision:

- Keep geometry-first product semantics.
- Boolean and future compound operations must consume resolved geometry packets
  rather than reconstruct stroke behavior from paint.

## Peer Product And Runtime Findings

### Lottie / After Effects Shape Stroke Model

References:

- Lottie shape spec:
  `https://lottie.github.io/lottie-spec/dev/specs/shapes/`
- Lottie animation community shape layer docs:
  `https://lottie-animation-community.github.io/docs/specs/layers/shapes/`

Findings:

- Lottie solid and gradient strokes include line cap, line join, miter limit,
  width, dashes, and color/gradient payloads.
- Lottie miter limit can be animatable through `ml2`.
- Lottie dash arrays require dash/gap entries to alternate.
- Lottie says odd dash/gap sequences repeat with dash/gap roles reversed.
- Negative dash/gap entries or zero total length cause the dash array to be
  ignored.

Asyra decision:

- Use Lottie as a strong animation-oriented reference for animated stroke
  property changes and invalid dash rejection.
- Do not copy Lottie odd-pattern normalization if Figma or SVG behavior differs
  for the same product-visible case; require a fixture and explicit divergence
  decision.

### SVG And Canvas Stroke Model

References:

- SVG `stroke-miterlimit`:
  `https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-miterlimit`
- SVG `stroke-dasharray`:
  `https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-dasharray`
- SVG `stroke-linecap`:
  `https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-linecap`
- WHATWG Canvas:
  `https://html.spec.whatwg.org/multipage/canvas.html`

Findings:

- SVG converts miter joins to bevel when miter limit is exceeded.
- SVG odd dash arrays repeat the full list to make an even-length sequence.
- SVG negative dash values are invalid.
- SVG line caps define butt/no extension, round half-circle extension, and square
  half-width rectangle extension.
- Canvas miter behavior aligns with beveling when miter limit is exceeded.

Asyra decision:

- SVG/Canvas are the default standards reference when Figma is silent and no
  higher-priority product fixture contradicts them.
- Use SVG cap behavior for zero-length edge cases only if Figma fixtures do not
  provide a different answer.

### Flutter / Skia Stroke Model

References:

- Flutter `Paint.strokeMiterLimit`:
  `https://api.flutter.dev/flutter/dart-ui/Paint/strokeMiterLimit.html`
- Flutter `StrokeJoin`:
  `https://api.flutter.dev/flutter/dart-ui/StrokeJoin.html`
- Skia `SkPaint`:
  `https://api.skia.org/classSkPaint.html`

Findings:

- Flutter explicitly says miter-limit exceedance draws a bevel join.
- Flutter documents possible corner popping when the angle is animated through
  the limit.
- Skia exposes stroke miter controls in the low-level graphics runtime used by
  Flutter and many production graphics stacks.

Asyra decision:

- Treat miter-limit threshold crossing as a stable geometry-state transition.
- Animation tests must include threshold-crossing cases and verify that popping
  is bounded to the intended miter-to-bevel transition, not cache corruption.

## Algorithm And Library Findings

### Clipper2

References:

- Clipper2 overview:
  `https://angusj.com/clipper2/Docs/Overview.htm`
- Clipper2 offset paths:
  `https://angusj.com/clipper2/Docs/Units/Clipper.Offset/Classes/ClipperOffset/_Body.htm`
- Clipper2 join types:
  `https://angusj.com/clipper2/Docs/Units/Clipper/Types/JoinType.htm`

Findings:

- Clipper2 supports clipping, offsetting, triangulating, and multiple fill
  rules.
- Clipper2 warns that offsetting intersecting closed paths produces undesirable
  results and recommends removing intersections through union first.
- Clipper2 supports open path offsetting; self-intersecting open paths flatten
  overlapping regions in the solution polygon.
- Clipper2 warns that redundant tiny segments can slow offsetting and cause
  blemishes.
- Clipper2 supports miter, bevel, square, and round offset joins.

Asyra decision:

- Use arrangement/union-style cleanup before offsetting self-intersecting closed
  source families.
- Keep redundant-segment removal and simplification as explicit normalization
  steps with tolerance metadata.
- Do not rely on raw offsetting to solve self-intersecting closed paths.

### CGAL Straight Skeleton And Offsetting

Reference:

- CGAL 2D straight skeleton and polygon offsetting:
  `https://doc.cgal.org/latest/Straight_skeleton_2/index.html`

Findings:

- CGAL supports straight skeletons and offsets for simple polygons with holes.
- CGAL defines contours, polygon-with-holes orientation, bounded sides, inward
  offsets, and exterior offset construction.
- CGAL notes that offset polygons can change side count, split into multiple
  polygons, and preserve orientation relative to source polygons.
- CGAL's straight-skeleton package does not cover every general self-intersecting
  planar figure directly.

Asyra decision:

- Use straight-skeleton references for compound simple polygons with holes and
  interior/exterior offset reasoning.
- Do not use straight skeleton alone as the self-intersection solution.
- Self-intersections still need planar arrangement and face classification.

### Bezier.js And Curve Offsets

Reference:

- Bezier.js:
  `https://pomax.github.io/bezierjs/`

Findings:

- Bezier.js is useful as a mature curve utility reference for curve splitting,
  extrema, outlines, and approximate offsets.
- Curve offsets are approximation-driven and need tolerance control.

Asyra decision:

- Use Bezier-style curve subdivision and outline construction as mechanics for
  canonical curve sampling.
- Exact support remains exact relative to Asyra's declared canonical
  tolerance-bounded geometry model, not analytic exact Bezier offsets.

## Closed Decisions From This Research Pass

- Product-visible behavior is Figma-first.
- Figma `strokeGeometry` is not enough to validate constrained inside/outside
  behavior.
- Legal domains should be represented as typed regions with loops and
  winding-rule metadata.
- Miter-limit exceedance is supported bevel geometry.
- Baseline exact caps should start with no cap, round, and square.
- Dashes are interval-domain geometry, but Figma half-dash endpoint behavior
  requires explicit fixtures before open dashed exact support.
- Self-intersecting closed paths require arrangement/union-style cleanup and face
  semantics before offsetting; raw offsetting is not acceptable.
- Algorithm references are construction references, not product semantics
  authorities.

## Figma MCP Fixture Capture

Capture date:

- 2026-04-27

Figma file:

- `Asra`
- file key: `rb8P1t26TNnTOgPJs5RAEv`

Dedicated frame:

- `Stroke Engine Reference Fixtures`
- node id: `6016:2`

Scope rule:

- only this dedicated frame is managed by Codex
- existing document shapes are not reference fixtures and were not edited

Captured fixture groups:

1. closed-loop constrained dashed seam
2. open path `inside/outside`
3. self-intersecting constrained stroke
4. multi-network overlap ownership
5. nested ownership chains
6. compound closed paths with holes
7. numeric robustness thresholds
8. performance benchmark fixture shapes

MCP-observed metadata:

- Figma accepted `strokeAlign: INSIDE` and `strokeAlign: OUTSIDE` metadata on
  open imported polyline vectors.
- Figma preserved `dashPattern` arrays on closed rectangles, compound vectors,
  dense wave vectors, and repeated boxes.
- Figma preserved `strokeJoin`, `strokeCap`, and `strokeMiterLimit` metadata on
  the fixture vectors.
- Imported even-odd compound paths exposed `VectorPath.windingRule: EVENODD`.
- Imported multi-subpath paths exposed one vector with one `vectorPaths` record
  and one `vectorNetwork.regions` record for the test import.

SVG export findings:

- Q1 inside dashed rectangle exported as a rectangle with the same stroke width
  and dash array, but its stroke centerline was inset by half stroke width.
- Q1 outside dashed rectangle exported as a larger SVG viewport with the same
  stroke width and dash array, making the visible stroke extend outside the
  authored rectangle bounds.
- Q2 open inside/outside polyline export was captured historically, but it is
  not an active product rule for Asyra. The active Asyra contract keeps open
  paths center-equivalent for authored `inside` / `outside` position.
- Q6 donut inside stroke exported with the outer stroke centerline inset and the
  inner-hole stroke centerline expanded around the hole. This supports the rule
  that compound inside stroke is defined against legal filled regions, not raw
  contour orientation alone.
- Q5 nested compound inside exported as generated path geometry with dash array,
  confirming that nested compound constrained dashed behavior must be treated as
  product geometry, not raw authored contours.
- User-supplied Q4 outlined SVG export shows Figma converts overlapping
  multi-network solid stroke output into compound filled geometry with an outer
  counter-clockwise contour and clockwise holes. This confirms source-bounds
  overlap is not a product-geometry blocker.
- User-supplied Q4 dashed outlined SVG export shows dashed overlap output as
  concrete filled dash subpaths, confirming overlapping dashed networks should
  emit typed product packets instead of disappearing.
- User-supplied Q5 nested solid outlined SVG export shows alternating
  containment-depth orientation (`CCW -> CW -> CCW -> CW -> CCW`). This
  supports parity-based shell/hole role assignment for nested containment
  chains.
- User-supplied Q8 SVG exports define the benchmark fixture as two sine paths,
  twenty dashed rectangles, and ten irregular closed dashed polygons. The
  original SVG keeps stroke parameters; the outlined SVG supplies visual output
  reference.
- Q7 center acute miter exported as a normal stroked path; this fixture needs a
  threshold sweep or outline capture before it can define exact miter transition
  coordinates.

Immediate spec decisions from the MCP capture:

- the basic design-tool baseline is sufficiently defined for common stroke
  behavior
- baseline exact support may target simple closed paths and explicit-region
  compound holes before solving every high-end topology edge case
- closed rectangle constrained strokes may be modeled as authored boundary plus
  chosen-side offset centerline; export confirms Figma shifts the effective
  centerline for inside/outside rectangles instead of leaving the authored
  centerline unchanged
- open-path authored `inside` / `outside` resolves to center-equivalent
  geometry in the current product contract. Any future Figma-divergence research
  must be promoted through explicit fixtures before it can replace this rule.
- compound holes must use legal-domain semantics; for inside stroke, hole
  boundaries are treated opposite the outer shell so the stroke remains inside
  the filled legal region
- the supported Asyra product slice for this rule is constrained solid and
  constrained dashed containment-only vectors, including nested depth-parity
  chains
- even-odd winding metadata must remain typed through the Asyra pipeline
- overlapping simple closed multi-network constrained solid/dashed behavior can
  be marked supported for product visibility when typed packets and global
  ownership diagnostics are emitted; exact boolean-union export minimization is
  tracked separately

MCP limitation from this pass:

- the Starter plan tool-call limit stopped additional SVG export for Q3 and Q4
- Q3 self-intersection conclusions remain fixture-created and
  metadata-observed, but not yet export-confirmed

## Still Gated After This Research Pass

- Figma-visible behavior for constrained dashed strokes on closed loops,
  especially seam placement and half-dash behavior.
- Figma-visible behavior for open `inside/outside` strokes, including endpoint
  and cap semantics.
- Figma-visible behavior for self-intersecting vector-network regions with
  constrained strokes.
- Boolean-union minimization for overlapping constrained solid export packets
  when two networks claim the same visible stroke face.
- Exact numeric tolerance values for flattening, offset approximation,
  arrangement snapping, and zero-area rejection.
- Performance benchmark environments and fixture sizes for `120 fps` target and
  `60 fps` floor.
