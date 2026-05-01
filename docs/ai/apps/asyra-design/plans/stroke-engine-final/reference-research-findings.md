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
- Figma's half-dash endpoint behavior is intentionally not the Asyra product
  rule. Open and closed dashed paths use true repeated arc-length pattern
  placement; endpoints only clip the interval that reaches the boundary.
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

- Constrained dashed `inside/outside` on self-intersecting closed paths is not
  exact until planar arrangement can split intersections, classify legal faces,
  and collapse duplicate semantic regions.
- The runtime may keep the authored side visible through deterministic
  local-side approximation packets, but only when every packet is explicitly
  marked `sourceTopology: "self-intersecting"` and
  `resolutionStatus: "local-side-approximation"`.
- This visibility path is not a center fallback, is not exact support, and must
  not be promoted to exact without the arrangement/face-collapse stage.
- Figma half-dash endpoint behavior is documented as a product divergence.
  Open center-equivalent dashed geometry uses the same true arc-length pattern
  allocator as closed-loop and constrained dashed families.

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
- Dashes are interval-domain geometry. Asyra uses true arc-length interval
  allocation instead of Figma endpoint balancing for open zero-offset dashed
  support; any future endpoint-balancing mode would require a new product
  decision and tests before implementation.
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
  metadata-observed, but not yet export-confirmed in that MCP pass. The
  2026-04-29 user-supplied SVG exports below close the product-visible outline
  reference for the supplied self-intersecting star fixtures.

## 2026-04-29 User-Supplied Figma SVG / Outline Fixture Analysis

Input files:

- `stroke-ref-01-self-intersecting-closed-inside-dashed-*`
- `stroke-ref-02-self-intersecting-closed-outside-dashed-*`
- `stroke-ref-03-high-curvature-cubic-loop-inside-dashed-*`
- `stroke-ref-04-compound-overlap-holes-inside-dashed-*`
- `stroke-ref-05-Multi-network-overlap-outside-dashed-*`

Read-only analysis source:

- user-exported original SVG
- user-exported outline SVG
- user screenshot for visible Figma editor appearance

General finding:

- These exports are product-appearance references, not always authored-source
  references.
- Original SVG export may already contain Figma-generated appearance geometry,
  masks, or merged contours.
- Outline SVG export is the stronger oracle for visible filled stroke geometry,
  because it contains the final filled dash components after Figma's stroke
  expansion.
- The renderer must not infer authoring topology from an outline SVG. It may
  use outline geometry to validate final visible regions, packet count classes,
  clipping behavior, and overdraw absence.

### Reference 01. Self-Intersecting Closed Inside Dashed

Observed SVG structure:

- original SVG:
  - one stroked path
  - `stroke-width="10"`
  - `stroke-dasharray="27 20"`
  - five path subpaths
  - no mask or clip path
- outline SVG:
  - one filled path
  - thirty-four filled subpaths

Finding:

- Figma does not export this inside dashed self-intersecting fixture as a simple
  centerline fallback.
- The outline output contains many independent filled dash components. This
  confirms that the product-visible target is filled geometry per visible dash
  component, not raw candidate rectangles and not a hidden center fallback.
- The original export is already Figma-generated constrained appearance
  geometry. It must not be treated as the user's original five-point star
  centerline.

Asyra decision:

- Current local-side approximation visibility may remain as a non-exact
  supported visibility slice only when packets are explicitly marked
  `resolutionStatus: "local-side-approximation"`.
- Exact support requires matching the filled-component semantics through source
  arrangement, legal-domain classification, interval ownership, and duplicate
  region collapse.
- Any test promoted to exact support must compare semantic filled components or
  face-level coverage, not only "something is visible".

### Reference 02. Self-Intersecting Closed Outside Dashed

Observed SVG structure:

- original SVG:
  - one stroked path
  - `stroke-width="10"`
  - `stroke-dasharray="27 20"`
  - one path subpath
  - no mask or clip path
- outline SVG:
  - one filled path
  - thirty-two filled subpaths

Finding:

- Outside dashed self-intersection also remains constrained-side visible output.
- The outline output has a different filled-component count from inside
  (`32` versus `34`), so inside/outside cannot share one post-hoc center
  expansion with only a side label changed.
- The original outside export is a generated outline-like path suitable for
  preserving appearance in SVG, not a reliable authored-source topology record.

Asyra decision:

- Inside/outside self-intersecting dashed paths must preserve the authored side.
- Center fallback is forbidden.
- Exact support must run separate inside and outside legality/ownership
  classification and may not assume the component cardinality is identical
  between the two sides.

### Reference 03. High-Curvature Cubic Loop Inside Dashed

Observed SVG structure:

- original SVG:
  - one mask path describing the source legal loop
  - one masked filled dash path
  - the visible dash path contains forty-six subpaths before mask clipping
- outline SVG:
  - one filled path
  - twenty filled subpaths

Finding:

- Figma uses a legal-domain mask in the appearance export for this high-curvature
  inside dashed loop.
- Candidate geometry may be larger than the legal domain before clipping.
- The final outline output proves the product-visible result is clipped filled
  geometry, not raw offset candidates.

Asyra decision:

- High-curvature inside dashed support must be validated by final legal-domain
  clipping and filled-region output.
- Local interval geometry is not sufficient for exact support if it leaks
  outside the legal domain or draws duplicate overlap.
- The exact branch remains arrangement-and-legality gated when curvature causes
  candidate self-overlap.

### Reference 04. Compound Overlap Holes Inside Dashed

Observed SVG structure:

- original SVG:
  - one mask path with two subpaths
  - outer legal shell: `(0,0)-(240,160)`
  - one merged inner hole: `(45,45)-(185,115)`
  - one masked filled dash path with eighty pre-mask subpaths
- outline SVG:
  - one filled path
  - twenty-four filled subpaths

Finding:

- The two overlapping hole rectangles in the authoring fixture are not preserved
  as two independent hole owners in the appearance export.
- Figma resolves the legal domain first and exports one merged inner hole before
  applying inside dashed appearance.
- This is a legal-domain normalization fixture, not a contour-order fixture.

Asyra decision:

- Overlapping compound holes require a legal-domain boolean normalization stage
  before exact constrained stroke support can be claimed.
- Containment-depth parity remains valid for nested non-overlapping contours.
- Intersecting or overlapping hole contours are not covered by the
  containment-only supported slice.
- Product packets for overlapping holes must be emitted from normalized legal
  regions, not from each raw hole contour independently.

### Reference 05. Multi-Network Overlap Outside Dashed

Observed SVG structure:

- original SVG:
  - one stroked path
  - `stroke-width="10"`
  - `stroke-dasharray="28 16"`
  - one path subpath
  - no mask or clip path
- outline SVG:
  - one filled path
  - sixteen filled subpaths

Finding:

- The exported original is already a merged single-contour outside dashed
  appearance path.
- This fixture proves a flattened-union outside dashed product result.
- It does not prove preservation of two independent multi-network owners,
  because the SVG no longer contains two owner networks.

Asyra decision:

- Use this fixture as a flattened-union visible-output oracle.
- Do not use it as evidence that Figma preserves independent multi-network
  ownership for overlapping outside dashed paths.
- Exact multi-network ownership still needs either direct Figma node metadata
  capture or an authored fixture that preserves distinct network identities
  through the reference pipeline.

## Reference Closure From 2026-04-29 SVG Exports

Closed or refined:

- self-intersecting inside/outside dashed must remain constrained-side visible;
  center fallback is forbidden
- self-intersecting inside and outside dashed outputs have different filled
  component structure and must not share one exact component model
- high-curvature inside dashed exact support requires legal-domain clipping of
  candidate geometry
- overlapping compound holes require legal-domain boolean normalization before
  exact stroke emission
- the supplied multi-network outside dashed SVG validates flattened-union output
  but not independent owner preservation

Still gated after these exports:

- exact self-intersecting constrained dashed face ownership and duplicate-region
  collapse
- exact high-curvature candidate self-overlap removal
- exact overlapping-hole legal-domain boolean normalization in runtime product
  packets
- exact independent multi-network ownership when source network identities must
  remain separate

## 2026-04-30 External Algorithm Research Closure

This pass resolves the remaining product-semantic ambiguity into implementation
rules. It does not mean every exact algorithm is already implemented.

References:

- Figma stroke properties:
  `https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties`
- CGAL 2D arrangements:
  `https://doc.cgal.org/latest/Arrangement_on_surface_2/index.html`
- Clipper2 offset paths:
  `https://angusj.com/clipper2/Docs/Units/Clipper.Offset/Classes/ClipperOffset/_Body.htm`
- Martinez polygon clipping:
  `https://github.com/w8r/martinez`
- Paper.js `Path.flatten([flatness])`:
  `https://paperjs.org/reference/path/`
- SVG `stroke-dasharray`:
  `https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-dasharray`
- SVG `stroke-dashoffset`:
  `https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-dashoffset`

### Planar Arrangement As The Exact Self-Intersection Path

Finding:

- CGAL defines 2D arrangements as a subdivision into vertices, edges, and faces
  induced by curves. This is the correct data model for source intersections,
  candidate stroke overlap, and face-level legality.
- Clipper2 warns that offsetting intersecting closed paths produces undesirable
  results and recommends removing intersections through a union clipping
  operation before offsetting.

Asyra decision:

- Exact self-intersecting constrained strokes must split source intersections,
  build a source arrangement, classify legal faces by declared fill rule, build
  one-sided interval candidates from split spans, then run candidate
  arrangement and duplicate-region collapse.
- Raw offsetting of self-intersecting closed paths is forbidden.
- Current local-side approximation remains a visibility bridge only.

### High-Curvature And Candidate Self-Overlap

Finding:

- Mature curve tooling such as Paper.js and Bezier.js treats curve offsetting
  and flattening as tolerance-bounded approximation, not analytic exact output.
- Candidate self-overlap is expected when offset distance is large relative to
  local curvature.

Asyra decision:

- High-curvature exact support is exact relative to Asyra's declared canonical
  flattened geometry, not analytic Bezier offsets.
- Candidate self-overlap is resolved by arrangement and face classification.
- Until arrangement removes duplicate/illegal faces, sampled high-curvature
  constrained dashed interval packets are local-side approximation, not exact
  constrained support.

### Compound Holes And Boolean Normalization

Finding:

- Polygon boolean libraries such as Martinez implement union, intersection,
  difference, and xor for polygons, multipolygons, holes, and self-intersecting
  inputs.
- The user-supplied Figma overlapping-hole fixture shows Figma normalizes the
  legal domain into one merged hole before emitting inside dashed appearance.

Asyra decision:

- Exact compound support is `LegalDomain = union(shells) - union(holes)`.
- Overlapping holes must run legal-domain boolean normalization before interval
  allocation and one-sided candidate construction.
- Containment-depth parity remains the current supported slice for
  non-overlapping nested contours.

### Multi-Network Overlap

Finding:

- Figma's flattened SVG export can prove final visible output, but it does not
  prove that independent source-network owners survive export.

Asyra decision:

- Current product rendering may keep overlapping network strokes visible when
  every packet preserves typed `networkId` / `ownerKey` metadata.
- Exact owner-collapsed output uses an `ownerSet` on the final semantic face
  when multiple networks claim the same visible region with identical stroke
  layer, stroke spec, and paint payload.
- Different stroke layers, different paint, or different object stacking do not
  collapse.

### Open Dashed Endpoint And Closed Seam Rules

Finding:

- Figma documents that dashed lines start and end with a half-length dash.
- SVG defines dash arrays and dash offsets as deterministic repeated
  arc-length patterns.

Asyra decision:

- Open paths keep authored `inside` / `outside` center-equivalent for geometry.
- Open and closed dashed support use deterministic arc-length interval
  allocation. They do not auto-balance endpoints or seams; Figma half-dash
  endpoint behavior is a documented divergence from Asyra's product rule.

### Numeric Tolerance Policy

Finding:

- Paper.js documents `flatten([flatness])` as subdividing curves until the
  maximum error is met, with default flatness `0.25`.

Asyra decision:

- Exact curve flattening target: `0.25 px`.
- Preview curve flattening ceiling: `1.0 px` or `strokeWidth / 4`, whichever is
  lower, while preserving topology family and support state.
- Snap epsilon: `1e-6` model units.
- Zero-area face rejection threshold:
  `max(1e-8, flattenTolerance * flattenTolerance * 0.25)`.
- Interaction settle must rebuild exact geometry and converge to the exact
  baseline hash for the same revision.

## Still Gated After This Research Pass

- Exact self-intersection arrangement implementation now has a backend-gated
  promotion path for accepted constrained dashed packets plus real Clipper2
  fixtures for partitioned owner claims, product promotion, and side-specific
  inside/outside signatures. Remaining work is broader Figma/reference parity
  and stress coverage for extreme repeated-interval cases.
- Exact high-curvature candidate arrangement now has a backend-gated promotion
  path for accepted sampled-simple constrained dashed packets plus real
  Clipper2 fixtures for overlapping-candidate partitioning, product promotion,
  and side-specific inside/outside signatures. Remaining work is broader
  Figma/reference parity and stress coverage for extreme curvature cases.
- Runtime legal-domain boolean normalization for overlapping compound holes was
  later implemented for the backend-normalized constrained dashed product path;
  see `active-support-scope.md` for current status.
- Independent multi-network same-visual ownerSet collapse was later implemented
  for exact arranged constrained dashed product paths; see
  `active-support-scope.md` for current status.
- Open dashed zero-offset support uses the same pure arc-length pattern
  semantics as non-zero `dashOffset`; endpoint half-dash behavior is not a
  product path.

## 2026-04-30 CTO Review Closure

The remaining gates are now implementation gates, not unresolved product
semantics. The exact engine must converge on the following model:

```text
Raw Vector
  -> Canonical Flatten
  -> Source Span Graph
  -> Legal Domain Normalization
  -> Dash Interval Allocation
  -> Candidate Region Generation
  -> Planar Arrangement
  -> Face Classification
  -> Duplicate / Owner Collapse
  -> FinalFace[]
  -> RenderMesh / HitRegion / ExportPath
```

### Fill Rule And Legal Domain

Decision:

- self-intersection and compound legal-domain classification must use the source
  path's declared fill rule
- when source data has no fill-rule field yet, the temporary default is
  `evenodd`, but the data model must expose
  `fillRule: "evenodd" | "nonzero"` before exact support is claimed
- `inside` means candidate faces intersected with the legal fill domain
- `outside` means candidate faces outside the legal fill domain
- `center` remains independent from fill-domain clipping unless an export
  projection explicitly requires normalization

Rationale:

- forcing all self-intersections to `evenodd` would be deterministic, but it
  would prevent future Figma-like fill-rule parity
- the engine may default old data to `evenodd`; it must not erase the ability to
  support `nonzero`

### FinalFace As Canonical Runtime Contract

Decision:

- `FinalFace[]` is the canonical exact-geometry source for render, hit-test, and
  export
- legacy resolved packets may exist only as bridge inputs while migration is in
  progress
- `RenderMesh`, `HitRegion`, and `ExportPath` are projections of `FinalFace[]`,
  not independent geometry authorities

Minimum `FinalFace` fields:

- `faceId`
- `sourceGeometryIds`
- `polygons` or lazy region descriptor
- `bounds`
- `visualPacketKey`
- `paintKey`
- `strokeSpecKey`
- `ownerSet`
- `intervalIds`
- `sourceSpanIds`
- `sourceContourIds`
- `legalDomainIds`
- `geometryFamily`
- `resolutionStatus`
- `runtimeStatus`
- `sourceTopology`

### Collapse Rule

Decision:

- duplicate candidate regions collapse only when they share the same final face
  geometry and the same visual packet identity
- visual packet identity includes paint, opacity, blend/effect/mask/clip context,
  stroke spec, stacking group, visibility, and compatible runtime status
- same visual packet collapse does not stack opacity
- different visual packet identity must remain separate and follows normal
  stacking
- collapsed faces keep typed `ownerSet`, `intervalIds`, `sourceSpanIds`, and
  `sourceContourIds`

### Multi-Network Export And Hit-Test

Decision:

- visual export emits merged `FinalFace[]` projections
- editable/internal export may preserve network-separated packets plus owner
  metadata
- hit-test returns a primary owner selected by deterministic stack order and
  also carries the full `ownerSet`

### Preview And Tolerance Policy

Decision:

- final/settled geometry is deterministic and cache-keyed by tolerance
- preview geometry may use lower tessellation density, but it is never a final
  hit-test or export source
- if preview topology differs from final topology, final settled geometry wins
- runtime default exact tolerance remains `0.25 px` until a measured performance
  profile proves a lower value can still satisfy the `120 fps` target and
  `60 fps` floor
- export may define a stricter tolerance profile, but it must use a different
  cache key

### Backend Strategy

Decision:

- use a hybrid architecture
- Asyra owns the runtime data model, owner metadata, dirty graph, cache keys,
  legal-domain classifier, and `FinalFace[]` contract
- heavy boolean / offset operations may use a Clipper2-like backend behind a
  `GeometryBackend` adapter
- CGAL arrangement remains the conceptual model, not the first production JS/TS
  runtime dependency
