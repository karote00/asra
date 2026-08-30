# Stroke Engine Product Contract

## Authority

This document is the product contract for Asyra stroke behavior. It defines the
supported behavior, public package boundary, shared product model, representative
cases, forbidden fallbacks, and definition of done.

The architecture companion is
`tools/flow-inspector/inspectors/stroke-flow-inspector.data.cjs`.
It maps package ownership and data flow only. Formal tests and synchronized
visual cases prove an implementation; they do not redefine this contract.

Internal algorithms, helper types, artifact subdivisions, identity encodings,
diagnostics, cache design, and optimization strategy are intentionally left to
the implementation. Cache may be added only after profiling identifies a
material cost and an exact cache-hit equivalence test exists.

## Product Goal

`@asyra/stroke-engine` turns one canonical vector topology and one authored
stroke into one immutable stroke result. The result is renderer-independent and
is complete before pixels are drawn.

The engine targets Figma-like authoring behavior rather than compatibility with
Figma internals. Equal accepted inputs must produce equivalent product geometry
and channel membership.

## Supported Behavior

### Topology

The initial engine supports:

- line, quadratic Bézier, and cubic Bézier segments;
- open and closed networks;
- multiple networks in one topology;
- explicit authored `sharp` and `smooth` anchor continuity;
- multiple filled regions, each with its own `nonzero` or `evenodd` winding
  rule and one or more closed loops;
- compound and self-intersecting topology, including different winding rules
  within one vector;
- empty and degenerate topology as explicit non-product outcomes.

An **authored segment** is a line, quadratic, or cubic segment explicitly stored
in canonical topology. An **atomic stroke span** is the smallest surviving
source-path interval after the topology is split at every authored vertex,
point intersection, tangency, self-intersection, cross-network intersection,
and boundary of a coincident overlap interval. Its interior contains no further
split point, and it may remain curved. One authored segment may therefore
produce multiple atomic stroke spans.

`NONE` is represented by the absence of a filled region; it is not a third
winding algorithm. Center-aligned strokes may use networks with or without
filled regions. Inside and outside strokes require closed filled material
resolved from the declared regions. A non-degenerate open network is rejected
as `unsupported-open-alignment`, and closed topology with no filled region is
rejected as `unsupported-missing-filled-region`. The engine must not substitute
a center stroke, infer an undeclared region, or invent a closing edge.

### Stroke style

The initial engine supports:

- `solid` and `dashed` styles;
- `center`, `inside`, and `outside` alignment;
- non-negative width;
- `butt`, `round`, and `square` caps;
- `miter`, `round`, and `bevel` joins;
- `miterAngle` in degrees from `0` through `180`;
- solid-color and linear-gradient paint;
- authored stroke order when an element contains multiple strokes.

For a visible band of width `W`:

- center alignment places `W / 2` on each side of the source path;
- inside alignment is the intersection of the filled material and the width-`W`
  inward boundary band;
- outside alignment is the intersection of the filled material's complement
  and the width-`W` outward boundary band.

Filled material is resolved by evaluating each declared region with its own
winding rule, then taking the Boolean union of all resolved region material.
Inside and outside placement is derived from that composed material, not guessed
from contour winding alone. When an inside band is wider than local material, it
clips and merges within the filled region; it does not reject, cross to the
outside, or add repair geometry. Outside bands obey the symmetric rule in the
complement.

All bodies, caps, joins, dash pieces, networks, intersections, and region
contributions belonging to one authored stroke are Boolean-composed before
paint is applied. The product contains no overlapping material and paints every
covered point at most once. Separate authored strokes remain separate products;
render projects them in ascending `strokeOrder`, so a larger order appears over
a smaller order. Explicit `networkIds` determine authored network order.

### Caps, joins, and dashes

- Caps appear only at visible open center-stroke ends and dash ends created by
  an actual gap.
- Closed network seams do not receive authored endpoint caps.
- Square caps extend one half stroke width beyond the endpoint.
- Round caps are semicircular with radius one half stroke width.
- Joins appear only where two visible stroke portions meet at an explicitly
  sharp authored vertex. The engine does not infer sharp or smooth intent from
  coincident or nearly collinear tangents.
- Authored smooth vertices remain continuous and do not add a join primitive.
  Intersection-generated split points never create a join.
- For each sharp join, the tested vertex angle is the interior angle on the
  actual convex material side between the incoming and outgoing boundary
  tangents, normalized to `[0, 180]`. The concave side is resolved by body
  intersection and receives no join primitive.
- A miter join is used when that material-side angle is strictly greater than
  `miterAngle`; equality and smaller angles use a bevel result.
- An invalid or unbounded miter must resolve to bevel without producing
  non-finite geometry.
- Dash and gap must both be finite and greater than zero when style is dashed.

Center-aligned dashed strokes use a continuous arc-length pattern:

- `[dash, gap]` begins once at each authored network start and continues across
  authored vertices and intersection-generated split points;
- each separate network restarts the pattern;
- a closed network treats arc length periodically, so a visible dash spanning
  the closure seam is one dash and receives no artificial cap;
- a dash continuing through a sharp authored vertex may use its configured
  join; a gap at that vertex creates no join.

Inside and outside dashed strokes fit each atomic stroke span independently.
For authored dash `D`, authored gap `G`, span arc length `L`, and `m` fitted
gaps, the span layout is:

```text
half dash | fitted gap | full dash | ... | fitted gap | half dash
```

The two endpoint half dashes each have core length `D / 2`; the `m - 1`
interior dashes retain core length `D`. The fitted gap is:

```text
fittedGap = L / m - D
```

The initial `m` is the positive integer nearest to `L / (D + G)`; an exact tie
uses the smaller count. The engine may only reduce `m`, never shrink `D`, until
every source-path gap has positive length and satisfies:

```text
visibleGap = fittedGap - leftCapIntrusion - rightCapIntrusion
visibleGap >= 0.6 * G
```

Butt-cap intrusion is `0`; round- and square-cap intrusion is `W / 2` per dash
end. This clearance concerns only dash ends facing a real gap. Atomic span
endpoints never receive caps:

- at a sharp authored vertex, eligible endpoint halves connect as
  `half dash + configured join + half dash`;
- at a smooth authored vertex, they connect through the continuous body;
- at an intersection-generated split point, they meet through body continuity
  and final Boolean composition without a cap or invented join.

If no layout with at least one gap can satisfy the clearance rule, the complete
atomic stroke span becomes one continuous endpoint-to-endpoint dash. The engine
must not shorten dash length or squeeze an invalid gap merely to increase dash
count.

### Paint and visibility

- A hidden stroke produces an empty result.
- Width zero produces an empty result.
- Opacity zero remains a valid product: its geometry still participates in hit
  and export, while render output is transparent.
- Solid paint preserves its authored color and opacity.
- Linear-gradient paint preserves stop order and source-local gradient handles.
  Positions outside the handle interval clamp to the first or last stop; the
  gradient never repeats or reflects.
- Equal-offset stops create a hard transition. The later authored stop applies
  exactly at and after the shared offset.
- Gradient RGB components interpolate in encoded sRGB using premultiplied alpha.
  A stop's effective alpha is `color alpha * stop opacity * paint opacity`.
  Start and end handles must not coincide.
- Stroke product, render and export consumers, and the canonical fill gradient
  contract use the same sampling semantics.
- Radial, angular, diamond, mesh, image, pattern, multiple-paint, and unknown
  paint forms are unsupported in the initial engine and produce a rejected
  result.

### Degenerate input

Individual zero-length segments contribute no visible stroke geometry and do
not borrow a tangent, cap, join, or dash interval from adjacent segments. If no
non-degenerate contribution remains, the result is empty.

The engine must reject malformed topology, missing references, non-finite
coordinates, invalid stroke values, malformed paint, and unsupported authored
forms. It must never repair canonical model data inside the result.

Outcome precedence is deterministic:

1. malformed structure, references, ids, connectivity, continuity, numbers, or
   paint return `rejected: invalid-input`;
2. a valid unsupported paint, open alignment, or missing filled region returns
   its specific `rejected` reason, in that order;
3. valid supported input is tested for `hidden`, `zero-width`, `empty-topology`,
   then `degenerate-topology`, in that order;
4. remaining supported input evaluates to `product`, or to
   `failed: engine-failure` if a geometry mechanic fails.

An empty condition never hides invalid or unsupported authored input.

Accepted input obeys these public validity rules:

- element, stroke, point, segment, network, region, loop, and revision ids are
  non-empty; map keys match the contained ids;
- `strokeOrder` is a non-negative integer;
- `networkIds` and `regionIds` list every corresponding record exactly once;
- every referenced anchor, control, segment, network, region, and loop edge
  exists; each segment uses the references required by its declared kind;
- network segment sequences have their declared open or closed connectivity;
  region loops form closed directed traversals;
- a smooth anchor has tangent-continuous adjacent authored segments; conflicting
  continuity and geometry is invalid rather than silently reclassified;
- coordinates, width, dash, gap, miter angle, gradient handles, stop offsets,
  and opacities are finite;
- width is non-negative, miter angle is in `[0, 180]`, and every opacity and
  gradient-stop offset is in `[0, 1]`;
- dashed input has positive dash and gap values; solid input does not use dash
  or gap to alter its product;
- a linear gradient has distinct finite handles and at least two authored stops
  in non-decreasing offset order, allowing equal offsets for a hard transition;
- color strings use the canonical stroke-property color syntax. This contract
  does not introduce a second color grammar.

## Public Interface

The future package exposes one engine creation surface and one evaluation
surface. The exact internal module layout is not part of this contract.

```ts
export function createStrokeEngine(): StrokeEngine

export interface StrokeEngine {
  evaluate(input: StrokeEngineInput): StrokeEngineResult
}

export interface StrokeEngineInput {
  readonly elementId: string
  readonly strokeId: string
  readonly strokeOrder: number
  readonly revision: string
  readonly coordinateSpace: { readonly kind: 'source-local' }
  readonly topology: CanonicalVectorTopology
  readonly stroke: StrokeSpec
}

export interface CanonicalVectorTopology {
  readonly networkIds: readonly string[]
  readonly regionIds: readonly string[]
  readonly points: Readonly<Record<string, VectorPoint>>
  readonly segments: Readonly<Record<string, VectorSegment>>
  readonly networks: Readonly<Record<string, VectorNetwork>>
  readonly regions: Readonly<Record<string, VectorRegion>>
}

export type VectorPoint = VectorAnchorPoint | VectorControlPoint

export interface VectorPointBase {
  readonly id: string
  readonly x: number
  readonly y: number
}

export interface VectorAnchorPoint extends VectorPointBase {
  readonly kind: 'anchor'
  readonly continuity: 'sharp' | 'smooth'
}

export interface VectorControlPoint extends VectorPointBase {
  readonly kind: 'control'
}

export type VectorSegment =
  | VectorLineSegment
  | VectorQuadraticSegment
  | VectorCubicSegment

export interface VectorSegmentBase {
  readonly id: string
  readonly startId: string
  readonly endId: string
}

export interface VectorLineSegment extends VectorSegmentBase {
  readonly kind: 'line'
}

export interface VectorQuadraticSegment extends VectorSegmentBase {
  readonly kind: 'quadratic'
  readonly controlId: string
}

export interface VectorCubicSegment extends VectorSegmentBase {
  readonly kind: 'cubic'
  readonly outControlId: string
  readonly inControlId: string
}

export interface VectorNetwork {
  readonly id: string
  readonly pointIds: readonly string[]
  readonly segmentIds: readonly string[]
  readonly closed: boolean
}

export interface VectorRegion {
  readonly id: string
  readonly fillRule: 'nonzero' | 'evenodd'
  readonly loops: readonly VectorRegionLoop[]
}

export interface VectorRegionLoop {
  readonly id: string
  readonly edges: readonly VectorRegionEdge[]
}

export interface VectorRegionEdge {
  readonly segmentId: string
  readonly direction: 'forward' | 'reverse'
}

export interface StrokeSpec {
  readonly visible: boolean
  readonly width: number
  readonly style: 'solid' | 'dashed'
  readonly position: 'center' | 'inside' | 'outside'
  readonly dash: number
  readonly gap: number
  readonly capType: 'butt' | 'round' | 'square'
  readonly joinType: 'miter' | 'round' | 'bevel'
  readonly miterAngle: number
  readonly paint: StrokePaint
}

export type StrokePaint =
  | {
      readonly kind: 'solid'
      readonly color: string
      readonly opacity: number
    }
  | {
      readonly kind: 'linear-gradient'
      readonly start: readonly [number, number]
      readonly end: readonly [number, number]
      readonly stops: readonly {
        readonly offset: number
        readonly color: string
        readonly opacity: number
      }[]
      readonly opacity: number
    }

export type StrokeEngineResult =
  | StrokeProductResult
  | StrokeEmptyResult
  | StrokeRejectedResult
  | StrokeFailedResult

export interface StrokeResultBase {
  readonly elementId: string
  readonly strokeId: string
  readonly strokeOrder: number
  readonly revision: string
  readonly coordinateSpace: { readonly kind: 'source-local' }
}

export interface StrokeProductResult extends StrokeResultBase {
  readonly kind: 'product'
  readonly product: StrokeProduct
  readonly render: StrokeRenderOutput
  readonly hit: StrokeHitOutput
  readonly export: StrokeExportOutput
}

export interface StrokeEmptyResult extends StrokeResultBase {
  readonly kind: 'empty'
  readonly reason:
    | 'hidden'
    | 'zero-width'
    | 'empty-topology'
    | 'degenerate-topology'
  readonly render: EmptyStrokeRenderOutput
  readonly hit: EmptyStrokeHitOutput
  readonly export: EmptyStrokeExportOutput
}

export interface StrokeRejectedResult extends StrokeResultBase {
  readonly kind: 'rejected'
  readonly reason:
    | 'invalid-input'
    | 'unsupported-paint'
    | 'unsupported-open-alignment'
    | 'unsupported-missing-filled-region'
  readonly render: EmptyStrokeRenderOutput
  readonly hit: EmptyStrokeHitOutput
  readonly export: EmptyStrokeExportOutput
}

export interface StrokeFailedResult extends StrokeResultBase {
  readonly kind: 'failed'
  readonly reason: 'engine-failure'
  readonly render: EmptyStrokeRenderOutput
  readonly hit: EmptyStrokeHitOutput
  readonly export: EmptyStrokeExportOutput
}

export interface StrokeProduct {
  readonly id: string
  readonly paint: StrokePaint
  readonly faces: readonly StrokeFace[]
  readonly bounds: StrokeBounds
}

export interface StrokeBounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface StrokeFace {
  readonly id: string
  readonly windingRule: 'nonzero' | 'evenodd'
  readonly contours: readonly StrokeContour[]
  readonly bounds: StrokeBounds
}

export interface StrokeContour {
  readonly id: string
  readonly closed: true
  readonly curves: readonly StrokeCurve[]
}

export type StrokeCurve =
  | {
      readonly kind: 'line'
      readonly p0: readonly [number, number]
      readonly p1: readonly [number, number]
    }
  | {
      readonly kind: 'quadratic'
      readonly p0: readonly [number, number]
      readonly p1: readonly [number, number]
      readonly p2: readonly [number, number]
    }
  | {
      readonly kind: 'cubic'
      readonly p0: readonly [number, number]
      readonly p1: readonly [number, number]
      readonly p2: readonly [number, number]
      readonly p3: readonly [number, number]
    }

export interface StrokeRenderOutput {
  readonly productId: string
  readonly entries: readonly StrokeRenderEntry[]
}

export interface StrokeHitOutput {
  readonly productId: string
  readonly regions: readonly StrokeHitRegion[]
}

export interface StrokeExportOutput {
  readonly productId: string
  readonly paint: StrokePaint
  readonly paths: readonly StrokeExportPath[]
}

export interface StrokeRenderEntry {
  readonly id: string
  readonly faceId: string
  readonly mesh: StrokeTriangleMesh
  readonly paint: StrokePaint
}

export interface StrokeTriangleMesh {
  readonly positions: readonly number[]
  readonly indices: readonly number[]
}

export interface StrokeHitRegion {
  readonly faceId: string
  readonly windingRule: 'nonzero' | 'evenodd'
  readonly contours: readonly StrokeContour[]
}

export interface StrokeExportPath {
  readonly faceId: string
  readonly windingRule: 'nonzero' | 'evenodd'
  readonly contours: readonly StrokeContour[]
}

export interface EmptyStrokeRenderOutput {
  readonly productId: null
  readonly entries: readonly []
}

export interface EmptyStrokeHitOutput {
  readonly productId: null
  readonly regions: readonly []
}

export interface EmptyStrokeExportOutput {
  readonly productId: null
  readonly paths: readonly []
}
```

All public geometry is expressed in the request's source-local coordinate
space. The returned result graph is deeply immutable. Public DTOs must not
expose renderer objects or mutable engine state. Triangle-mesh positions are
flat `[x, y]` pairs, and indices address those pairs in triangle triples. Render
meshes cover their matching face; hit regions and export paths preserve the
matching face contours and winding rule. Every render entry and product export
output uses the product paint.

`networkIds` and `regionIds` are the only authored ordering authorities for
their record collections. Region edges explicitly declare traversal direction;
consumers must not infer loop traversal or holes from record insertion order.
Absence from every region means no filled material for that topology portion,
while its segments remain eligible for center alignment.

Internal geometry mechanics may be replaceable, but replacement does not change
the public creation surface or product semantics. The default engine remains the
required product implementation.

## Package Ownership And Boundaries

### `@asyra/stroke-engine`

Owns:

- request validation and normalization;
- all stroke product geometry;
- caps, joins, dashes, alignment, and fill-rule behavior;
- the immutable canonical stroke product;
- render, hit, and export projections from that product;
- source-space render meshes and public result assembly.

It must not import React, Pixi, Canvas rendering APIs, WebGL/WebGPU rendering
APIs, app feature state, selection state, or preset internals.

### Asyra Design and framework state packages

The app owns user intent and property editing. Feature-system owns interaction
sessions. Factory and scene-tree own transaction and canonical model commit.
Props-manager owns property validation. Reactive-events publishes committed
changes. None owns stroke product geometry.

The existing create, drag, selection, scene-tree, property, undo/redo, and
render-mirror flows remain unchanged unless a separate task explicitly changes
them.

The render mirror may map committed canonical topology and properties into the
public source-local input DTO. That mapping preserves authored segment meaning,
explicit anchor continuity, network and region order, ids, stroke order, and
revision; it does not validate, repair, or create stroke product geometry.

### `@asyra/preset`

Preset registers the default engine and invokes it from the selected render
strategy. It preserves authored stroke order. It must not construct, repair, or
reinterpret stroke product geometry.

A registered default engine is required for every active stroke input. Missing
registration is a fail-fast preset integration error; it must not silently skip
evaluation or present prior stroke output as the accepted revision.

### `@asyra/render`

Render consumes completed mesh-backed render entries and projects them into
pixels. It owns renderer resources, target state, transforms, antialiasing, and
pixel composition.

An active stroke update is projected only after both its mirror update and
completed render output are available. A removed or zero-stroke update clears
from the mirror update alone and does not wait for render output that its bypass
path never creates.

Render must not rebuild paths, caps, joins, dashes, alignment, clipping, or
final faces. Product rendering must not fall back to Pixi `Graphics.stroke()` or
an equivalent renderer-local path-stroke operation. Renderer-local strokes are
allowed only for non-product overlays such as selection affordances.

## Shared Product And Channel Parity

A product result contains exactly one `StrokeProduct`. Render, hit, and export
are sibling projections of that same immutable product.

For every product result:

- `render.productId`, `hit.productId`, and `export.productId` equal
  `product.id`;
- `export.paint` and every render entry's paint equal `product.paint`;
- each visible or queryable projection maps back to one or more product face
  ids;
- channel ordering follows product-face ordering;
- hit and export carry the same winding rule as their matching product face;
- render meshes may tessellate faces but cannot change their coverage;
- hit geometry cannot be derived from rendered pixels or GPU buffers;
- export geometry cannot be derived from rendered pixels or GPU buffers;
- replacing a conforming render tessellation cannot change hit or export;
- no channel may add a cap, join, dash, clip, or fallback face absent from the
  product.

Within one product, face coverage is non-overlapping and represents a single
paint application for the authored stroke. Separate stroke products retain
their ascending `strokeOrder` composition and are not prematurely unioned.

Empty, rejected, and failed results carry the request revision and explicit
empty outputs for all three channels so consumers can clear stale results.

Channel construction is atomic. If source-space mesh tessellation or any
render, hit, or export projection fails after canonical product geometry is
complete, evaluation returns `failed: engine-failure` with three empty channel
outputs. It must not publish a partial product result or preserve a successful
output from the failed revision.

## Canonical Product Cases

These cases define the initial formal and visual fixture set. Source-space
oracles are the semantic authority; synchronized screenshots verify the normal
app pipeline later.

| ID                                    | Input                                                                                                    | Required result                                                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `stroke-line-butt`                    | Horizontal open line, center solid, butt cap                                                             | Rectangle of exact width ending at both authored endpoints.                                                                             |
| `stroke-line-round`                   | Same line with round cap                                                                                 | Butt body plus one radius-`W/2` semicircle at each end.                                                                                 |
| `stroke-line-square`                  | Same line with square cap                                                                                | Body extends `W/2` past each endpoint.                                                                                                  |
| `stroke-corner-bevel`                 | Two segments with a 90° sharp vertex                                                                     | One connected bevel join with no gap or spike.                                                                                          |
| `stroke-corner-round`                 | Same corner with round join                                                                              | One connected round outer join.                                                                                                         |
| `stroke-corner-miter`                 | Same corner above miter threshold                                                                        | One finite connected miter join.                                                                                                        |
| `stroke-miter-threshold`              | Vertex angle equal to `miterAngle`                                                                       | Bevel result; the engine emits no ambiguous branch.                                                                                     |
| `stroke-miter-material-side`          | Center, inside, and outside sharp corners with reflex counterparts                                       | Threshold uses the convex material-side angle; the concave side receives no join primitive.                                             |
| `stroke-authored-continuity`          | Equal geometry evaluated once with `sharp` and once with `smooth` continuity                             | Sharp input uses the configured join; smooth input remains continuous without inferred reclassification.                                |
| `stroke-rectangle-alignments`         | Closed rectangle, center/inside/outside                                                                  | Three width-`W` bands in their declared locations.                                                                                      |
| `stroke-oval-alignments`              | Closed oval, center/inside/outside                                                                       | Curved bands remain smooth and have the declared placement.                                                                             |
| `stroke-inside-narrow-material`       | Inside width exceeds a narrow part of filled material                                                    | Band clips and merges within the region; no outside material, rejection, or repair face appears.                                        |
| `stroke-center-dash-open`             | Open center polyline with `[dash, gap]`                                                                  | Pattern continues across authored and intersection-generated boundaries; real dash ends use configured caps.                            |
| `stroke-center-dash-closed-seam`      | Closed center contour whose period crosses the network seam                                              | The spanning dash is one dash with no artificial seam cap.                                                                              |
| `stroke-center-dash-gap-at-vertex`    | A center-stroke gap covers an authored corner                                                            | No join is invented at the corner.                                                                                                      |
| `stroke-inside-dash-atomic-fit`       | Inside dashed self-intersecting contour                                                                  | Every atomic stroke span has endpoint half dashes, unchanged full dash length, and independently fitted equal gaps.                     |
| `stroke-outside-dash-atomic-fit`      | Outside dashed compound contour                                                                          | Every surviving atomic stroke span uses the same independent fitting rule after region resolution.                                      |
| `stroke-dash-cap-clearance`           | Inside/outside gaps with butt, round, and square caps                                                    | Every post-cap visible gap is at least `0.6 * authoredGap`; dash count decreases when required.                                         |
| `stroke-dash-short-atomic-span`       | Atomic span cannot contain one valid fitted gap                                                          | The complete span is one endpoint-to-endpoint dash with no endpoint caps or shortened dash.                                             |
| `stroke-dash-intersection-connection` | Half dashes meet at sharp, smooth, and intersection-generated split points                               | Sharp uses its join, smooth uses body continuity, and intersection uses Boolean composition; none receives an endpoint cap.             |
| `stroke-mixed-winding-regions`        | One vector with nonzero and evenodd regions and a hole                                                   | Each region uses its declared rule; composed filled material and inside/outside bands preserve intended holes.                          |
| `stroke-no-filled-region`             | Closed topology with no declared region, inside or outside alignment                                     | Rejected with `unsupported-missing-filled-region`; no implicit region or center fallback.                                               |
| `stroke-self-intersection`            | Closed self-intersecting regions and crossing networks                                                   | Boolean-composed product has correct coverage and no overlapping or duplicate-alpha material.                                           |
| `stroke-network-order`                | Multiple networks with explicit `networkIds`                                                             | Dash restarts and deterministic product ordering follow `networkIds`, never record insertion order.                                     |
| `stroke-open-center`                  | Open quadratic/cubic network, center alignment                                                           | Valid centered product with configured caps.                                                                                            |
| `stroke-open-inside-rejected`         | Non-degenerate open network, inside alignment                                                            | Rejected with `unsupported-open-alignment`; no center fallback.                                                                         |
| `stroke-open-outside-rejected`        | Non-degenerate open network, outside alignment                                                           | Rejected with `unsupported-open-alignment`; no center fallback.                                                                         |
| `stroke-hidden-empty`                 | `visible: false`                                                                                         | Empty `hidden` result and three empty channel outputs.                                                                                  |
| `stroke-zero-width-empty`             | `width: 0`                                                                                               | Empty `zero-width` result and three empty channel outputs.                                                                              |
| `stroke-degenerate-empty`             | Only zero-length segments                                                                                | Empty `degenerate-topology` result.                                                                                                     |
| `stroke-zero-opacity-product`         | Valid geometry with paint opacity zero                                                                   | Product geometry remains present; render is transparent; hit/export remain valid.                                                       |
| `stroke-linear-gradient`              | Valid source-local two-handle linear gradient                                                            | Product geometry matches solid equivalent; sampling clamps outside handles and uses premultiplied sRGB with the declared alpha product. |
| `stroke-gradient-hard-stop`           | Two authored stops share an offset                                                                       | The later stop applies at the offset and creates one stable hard transition.                                                            |
| `stroke-gradient-coincident-handles`  | Linear gradient start equals end                                                                         | Rejected with `invalid-input`; no solid or endpoint-color fallback.                                                                     |
| `stroke-unsupported-paint`            | Radial or unknown paint                                                                                  | Rejected with `unsupported-paint`; no solid-color fallback.                                                                             |
| `stroke-invalid-input`                | Missing references, non-finite coordinate, or invalid dashed value                                       | Rejected with `invalid-input`; no repaired geometry.                                                                                    |
| `stroke-outcome-precedence`           | Invalid or unsupported input that is also hidden or zero-width                                           | Exact invalid or unsupported rejection wins; an empty condition never masks it.                                                         |
| `stroke-engine-failure`               | An injected product-geometry mechanic, tessellation, or channel projection fails during valid evaluation | Failed with `engine-failure` and three empty channel outputs; no partial, prior, or substitute product.                                 |
| `stroke-multiple-order`               | Two overlapping authored strokes with different `strokeOrder`                                            | Each stroke product paints once internally; ascending order is back-to-front and the larger order appears above.                        |
| `stroke-channel-parity`               | Any valid product fixture                                                                                | All channels reference the same product and face ordering; hit/export preserve face winding, and render/export preserve product paint.  |

Additional regression cases belong in formal test fixtures when discovered.
They do not require a new governance document.

## Forbidden Fallbacks And Errors

The following are product failures:

- substituting center alignment for unsupported inside/outside input;
- inferring a filled region, anchor continuity, network order, or region order
  that the public input does not declare;
- inventing a closing edge for an open path;
- putting a cap or invented join at an atomic stroke span endpoint;
- shrinking authored dash length, retaining too many dashes, or accepting a
  post-cap gap below `0.6 * authoredGap` during inside/outside fitting;
- falling back from invalid stroke geometry to fill geometry, bounds, a prior
  frame, or renderer-local stroke output;
- using a cap or join to cover missing body geometry;
- painting overlapping parts of one authored stroke more than once;
- making hit or export infer a face winding rule;
- replacing a malformed or unsupported gradient with a solid or endpoint color;
- deriving hit or export from pixels, GPU buffers, or antialiasing output;
- returning stale product output for the new accepted revision;
- catching an internal geometry failure and returning a successful product;
- adding fixture-specific or shape-specific repair geometry.

Authored invalid or unsupported input returns `rejected`. Valid input that
intentionally has no product returns `empty`. An engine or geometry-mechanic
failure during an otherwise valid evaluation returns `failed` with three empty
channel outputs. It must not be translated into a successful product or a
different authored outcome.

## Definition Of Done

The Stroke Engine feature is done when all of the following are true:

1. `@asyra/stroke-engine` has a documented root API matching the public result
   contract above and has no renderer or app dependency.
2. Every canonical product case above exists as a formal source-space test with
   valid, boundary, empty, rejected, and negative assertions.
3. Render, hit, and export parity is formally tested for every product case.
4. The existing app intent, canonical commit, undo/redo, scene-tree, property,
   selection, and render-mirror flows still pass their focused tests unchanged.
5. Preset registers and invokes the default engine without creating product
   geometry, and authored multiple-stroke order is preserved.
6. Render draws only completed render entries in ascending `strokeOrder`, clears
   empty/rejected/failed revisions, and never uses a product path-stroke
   fallback.
7. Synchronized visual review passes the line, cap, join, rectangle, oval,
   center dash, atomic inside/outside dash, mixed-winding, overlap,
   self-intersection, translucent, hard-stop, and gradient fixtures at a zoom
   that exposes seams, compressed gaps, overlap alpha, spikes, wrong-side
   material, and stale output.
8. Malformed input, unsupported paint, unsupported open alignment, missing
   filled regions, coincident gradient handles, outcome precedence, and injected
   geometry-mechanic failures return their exact rejected or failed result with
   no prior or substitute output.
9. A normal and heavy fixture profile is captured after semantic correctness.
   Any cache or optimization added in response has a measured benefit and an
   exact equivalence regression test; no cache is required when profiling does
   not justify one.
10. Package build, focused unit/integration tests, app build, and relevant E2E
    tests pass with no unresolved product-semantic decision.

Implementation proceeds in vertical slices. A slice is complete only when its
public result, channel parity, formal case, and normal app projection all work;
internal scaffolding alone is not completion.
