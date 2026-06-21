Never record completed plans here.

# App Plans

## In Progress

No in-progress app plans.

## Current Stroke Authority

The stroke engine final implementation was completed on 2026-06-21 as an
architecture closure. The completed record is
`docs/ai/apps/asyra-design/plans/completed/stroke-engine-final-architecture-closure.md`.

Pixel-level stroke defects may still be opened as separate bugfix work, but
they must use the closed architecture below. They must not reopen alternate
product routes.

### Authority

Only these files define current stroke rules:

- Active plan: `docs/ai/apps/asyra-design/PLANS.md`
- Stroke engine spec: `docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md`
- Inspector flow data: `docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js`

`docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.html`
may remain only as a viewer shell for the inspector data. It must not define
stroke rules, reading order, completion claims, contracts, or baseline status.

Decision history may record wrong or superseded decisions, but wrong stroke
specification files must not remain in the docs tree.

### Status

- Completed on 2026-06-21 for stroke architecture closure.
- The only formal product pipeline is:
  `computed patch -> render mirror -> StrokeDomainPlan -> DashProductInterval /
  solid product contract -> endpoint cap policy / join ownership / smooth
  continuity -> product descriptors / render entries`.
- The inspector flow is the Stroke / Vector System Inspector Flow. It covers
  the full upstream-to-output path: feature intent, vector common API/domain
  adapter, canonical computed patch, transaction/data channel, render mirror,
  stroke geometry, product packets, product descriptors, render entries, and
  final visual review.
- The framework-aligned vector operation flow is the baseline: point and handle
  drag plus structural vector operations express explicit operations, write
  canonical workspace/world vector data through computed patches, and let render
  consume committed downstream state.
- `vector.ts` is a render input assembler. It builds source path/topology and
  normalized stroke input, then delegates product semantics to
  `StrokeDomainPlan` and product builders.
- Diagnostics, export packet details, performance counters, and screenshot
  artifacts are evidence only. They do not decide whether visible product
  output exists.
- The 2026-06-21 closure gates passed static route guards, product contract
  suites, preset build, React build, focused app e2e, performance gates, and
  manual screenshot review. Pixel-level dashed/join defects can be filed after
  closure, but they must stay on this product pipeline.

### Required Stroke Rule

Asyra constrained solid strokes are not authored as direct selected-side solid
geometry. This rule is an Asyra rule; it may be informed by external design-tool
behavior, but external tools are not the authority for the current contract.

For solid `inside` and `outside`, the visible result must be produced by:

1. building the authored center stroke at twice the requested stroke width,
2. preserving authored `strokeJoin` and `strokeMiterLimit` on that center
   stroke,
3. clipping that doubled authored stroke with the filled-region mask for
   `inside` or the exterior mask for `outside`.

For self-intersecting inside solid shapes in grid/vector-network state:

- visible pixels must come from the doubled authored center stroke clipped by a
  face, winding, and adjacency-aware filled-region mask;
- grouped render descriptors may encode that adjacency-aware mask only by
  preserving authored centerline stroke paths, `strokeJoin`, and
  `strokeMiterLimit`; they must not encode face strips or helper polygons as
  visible product geometry;
- internal shared edges must not receive independent full-width stroke from
  both adjacent faces; each adjacent face may reveal only its half of the
  requested stroke width along that shared edge;
- the five internal pentagon corners must change with `strokeJoin` and
  `strokeMiterLimit`;
- the internal pentagon must not fragment, break into helper-like slivers, or
  use fixed corner shapes that ignore the authored join envelope;
- derivation fragments, face strips, domain ribbons, endpoint helper polygons,
  and coverage probes are evidence only and must not become product-visible
  stroke geometry.

For `center` solid strokes, the product-visible geometry is the authored
center stroke itself. Self-intersecting center solid vectors may render that
product as an authored stroke path descriptor with `strokeJoin`, `strokeCap`,
and `strokeMiterLimit` preserved. Native stroke projection is allowed only when
it is alpha-safe for the visible product; translucent self-intersecting center
strokes must use a single-composite descriptor so crossings do not accumulate
alpha. Polygon packets may still exist for hit/export/diagnostics, but
drag-time visible render must not require rebuilding unioned center-stroke
polygons when the authored stroke descriptor is the exact product.

For `center` dashed strokes, the product-visible geometry is the authored
center dashed stroke itself. Drag-time visible render may encode visible dash
intervals as authored centerline `strokePaths` with the authored `strokeCap`,
`strokeJoin`, `strokeMiterLimit`, and dash allocation already resolved. This
path descriptor is the exact center dashed product for visible render; it is
not a simplified drag route. Normal drag frames must not require rebuilding center dashed
polygon packets or resolved self-intersection geometry when no diagnostics,
hit/export materialization, or constrained-domain rule needs those polygons.

For open `center` dashed strokes, dash allocation is owned by the continuous
open network/subpath, not by individual segment boundaries. The two true open
network endpoints use half-dash terminal intervals when the path is long
enough, middle visible intervals keep the authored dash length, and middle
gaps are distributed across the full network. Round and square dash caps count
toward the painted footprint when measuring readability: the current Asyra
floor is `configuredGap * 0.6` after cap footprint. If the open network cannot
hold endpoint half-dashes plus a legible cap-aware visual gap, it may collapse
to one `start-end` visible dash instead of squeezing multiple dash groups
together.

Open dashed stroke position is domain-dependent. A simple open network with no
bounded filled-region domain uses the formal unbounded open center product for
authored dashed `inside` and `outside` positions: render, hit-test, export, and
diagnostics must consume that product while preserving the authored UI value. An
open self-intersecting network that resolves one or more bounded filled regions
from its real authored source segments uses constrained `inside` / `outside`
domain products. For that network, the filled-region domain is the planar
arrangement of the real open source segments only; the renderer must not add an
invisible closing edge for domain, dash, hit-test, export, or product output.

Stroke domain plan is the single product routing entry point for open/closed
semantics. Vector render code and packet builders must not independently map
open constrained strokes to center; they consume domain modes such as
`center-product`, `closed-constrained-domain`,
`open-contour-constrained-domain`,
`open-dangling-outside-both-sides`, and `inside-excluded-open-span`.

Open self-intersecting `inside` dashed output follows the closed contour rule:
only source spans that participate in a resolved filled contour may produce
inside dash pixels. Dangling open branches and source spans that do not form a
filled contour must not produce inside dash output, even if they are part of the
authored open network. Open self-intersecting `outside` dashed output follows
the outside contour rule for contour-owned spans and additionally preserves
dangling open-branch endpoint/cap/dash semantics by rendering those dangling
spans on both sides of the authored source path. Their visible normal span is
therefore approximately `stroke.width * 2`; they are not unbounded open center
strokes. Unlike simple open `center` strokes, each independent
contour-owned or dangling constrained source span is its own dash allocation
domain: both cut ends use terminal half-dashes when the span is long enough,
middle dash/gap records are redistributed inside that span, and no continuous
open-network dash phase may be inherited across independent constrained spans.
The product must not synthesize a closing edge and must not route through center
substitution merely because `network.closed` is false.

Dashed constrained strokes remain a separate interval-domain model for dash
allocation, but constrained `inside` dashed visible geometry is owned by the
inside legal-domain product route. For each split source range, allocate visible
intervals with half-dash terminals at both cut ends and evenly distributed
middle gaps; then materialize the authored dashed interval product with the
requested cap, join, and miter limit and clip it with the filled-region mask for
`inside`. The clipped result is the visible product geometry. Direct
selected-side ribbons, domain-plan derivation strips, and derivation helpers are
evidence only and must not define product-visible inside dashed pixels.

Dash allocation must also respect a cap-aware visual gap floor. When round or
square dash caps extend the painted dash footprint, split-range allocation must
not keep adding dash groups until the visible gap after caps becomes tiny. If a
split range cannot hold both terminal half-dashes and a legible cap-aware visual
gap, it may collapse to a single `start-end` visible dash for that range. This
is a heuristic Asyra readability rule and may be tuned, but the current floor is
`configuredGap * 0.6` after cap footprint. For example, a configured gap of `20`
must not be redistributed into visual gaps below roughly `12`. Tests must
measure the gap after cap footprint, not only the centerline dash/gap distances.

Terminal dash cap ownership is a first-class product rule. `middle` intervals
own authored caps on both ends. `start` intervals suppress the start endpoint
cap and only apply the authored cap on the body-side end. `end` intervals apply
the authored cap only on the body-side start and suppress the endpoint cap.
`start-end` intervals suppress both endpoint caps. This applies to butt, round,
and square caps, static render, drag render, product output descriptors, and
hit/export materialization; no downstream builder may re-add an endpoint-side
cap after allocation.

Terminal cap ownership does not replace join ownership. When a terminal sits on
a contour corner, a self-intersection split, or any authored vertex with
`joinType` ownership, the endpoint-side dash cap is still suppressed, but the
corner must be completed by the authored join (`miter`, `bevel`, or `round`).
Visual review must therefore distinguish true dangling/open endpoints from
contour/join terminals: dangling endpoints forbid endpoint-side caps, while
contour terminals require the correct join footprint and must not be judged by a
generic "red pixel beyond endpoint" cap probe.

Curve dash smoothness is a top-level stroke product rule. A visible dash on a
Bezier or high-curvature source span must be one continuous smooth footprint
following the authored curve and its selected domain. Sampling frames,
split-range materialization, terminal policy clipping, and polygon cleanup must
not leave comb-like seams, radial slices, or disconnected strip fragments inside
one dash. Any optimization or cleanup that turns a curved dash into many small
unjoined pieces is invalid even if the rough coverage area is present.

Constrained dashed render has one product pipeline for static render, drag,
cap/style switches, reload, hit/export, and render entries. The pipeline starts
from the `StrokeDomainPlan`, allocates `DashProductInterval` records, attaches
endpoint cap policy, join ownership, and smooth-continuity group metadata, then
materializes body/cap/join geometry into product descriptors. A descriptor is
only an output encoding of that same product builder; it is not a separate
inside/outside, static/drag, or simplified route.

For constrained `inside`, the product descriptor clips the authored dashed
stroke body, cap footprints, and join footprints by the inside filled-region
domain. For constrained `outside`, the product descriptor clips the same
materialized product to the exterior domain, while open dangling outside spans
are materialized as explicit both-side source-span domains. The descriptor
must be able to express one-sided terminal cap suppression by carrying explicit
cap/join footprints and endpoint policy metadata; no downstream render builder
may infer or re-add endpoint caps.

Resolved self-intersection metadata and boundary-domain split ranges are shared
inputs to the single product builder. Resolved closed constrained source domains
may cover uncovered closed contour spans, but visible product output must not
retrace the whole source path, recompute source intersections inside render, or
switch to any drag-specific geometry path. Drag only changes source point data;
it dirties source/domain/product cache and reruns this same product pipeline.

### Required Stroke / Vector System Flow

Stroke-related behavior must be observed as one deterministic system flow:

1. Feature/session code converts user input into explicit vector or stroke
   intent. It must not directly synchronize render state.
2. App common API/domain adapters own vector mutations. They produce canonical
   workspace/world computed data patches for point/handle drag and structural
   vector operations.
3. Each intended user action is committed through one transaction boundary and
   one intended undo unit. Drag updates remain non-undoable; mouseup/final
   edits are undoable.
4. Scene-tree and data-channel publish computed patch updates. Payloads must
   identify changed scalar values and record ids instead of forcing unrelated
   full-topology rewrites.
5. Render is a downstream consumer. Render mirror/cache applies committed data
   exactly once and derives renderer-ready vector/stroke data from that mirror.
6. Stroke geometry stages consume normalized render data only. They must not
   depend on feature-local state, undo payload cleanup, or direct app-to-render
   synchronization.
   Stroke geometry invalidation is stage-based: source path/topology, stroke
   family, stroke domain, dash schedule, terminal cap, join/miter shape, paint,
   and render output use separate revisions. Static stroke parameter changes
   must dirty only the stages they actually affect; drag changes dirty source
   path data without mutating static stroke parameter revisions.
   Dirty classification must feed a real stage product cache at the render
   mirror/vector graphic boundary. Exact semantic descriptors can be reused
   when source revision and geometry-affecting stroke signature match; paint
   changes retint cached descriptors instead of rebuilding geometry. For exact
   stroke-path descriptors, miter-angle changes may replay cached geometry only
   when the descriptor can be restyled with the current cap/join/miter style;
   polygon product evidence that depends on miter geometry must keep miter in
   its geometry signature. Drag-time constrained dashed descriptors must also
   reuse resolved split/domain metadata; recomputing source intersections in
   product output violates the stage-cache contract.
7. Product output stages may emit render, hit, export, and diagnostics
   descriptors, but visible render must not use diagnostic/helper geometry as
   product output.

Stroke paint uses the same canonical `FillAttrs` payload shape as element
fills. A stroke owns one paint payload at `strokes[n].fill`, and that fill id
matches the stroke id. Root stroke paint fields such as `color`, `opacity`,
`visible`, `kind`, `colorFormat`, `defaultColorFormat`, and `gradient` are
load-boundary normalization input only; app UI, common APIs, scene-tree computed data,
and render mirror output must not write them back. A `stroke.fill`-only change
is a paint/renderOutput change and must reuse existing semantic stroke product
geometry.

### Inspector Flow Requirements

- Lanes must read as Interaction, Model Commit, Data Channel, Render Mirror,
  Stroke Geometry, Product Output, and Diagnostics.
- Interaction steps own feature/session intent only. They must not commit
  model data directly or write render store state.
- Model Commit steps own common API/domain adapter behavior, canonical
  workspace vector data, computed patch construction, and transaction/undo
  boundaries.
- Data Channel steps own scene-tree patch publication and reactive event
  propagation after commit.
- Render Mirror steps own downstream mirror/cache updates and render data
  derivation. They must apply each patch once and must not repair model data.
- Stroke Geometry steps own normalized render inputs, shared geometry, stroke
  domains, dash intervals, legality, and final semantic stroke records.
- Stroke Geometry and Render Mirror steps must expose stage dirty/counter
  evidence for source-path reuse, topology/domain reuse, dash schedule reuse,
  terminal cap rebuild, join rebuild, paint-only update, and drag source-path
  updates with static stroke parameters.
- Paint-only update means `stroke.fill` changed. It must not trigger vector
  bounds repair, source topology rebuild, stroke domain rebuild, dash schedule
  rebuild, terminal cap rebuild, or join rebuild.
- Render Mirror / Stroke Geometry must expose stage product cache evidence:
  product-geometry hit, miss, store, and render-output hidden counters. Cached
  descriptors are exact product descriptors; diagnostics/export polygons remain
  lazy evidence and must not become normal visible-render prerequisites.
- Product Output steps own render/hit/export packet projection and renderer
  draw entries without changing stroke semantics.
- Diagnostics and final visual review are completion gates. The 2026-06-21
  architecture closure passed the broader matrix and performance gates listed in
  the completed record. Future stroke changes must rerun the relevant subset and
  inspect generated screenshots before claiming closure.
- Diagnostics for translucent self-intersecting center solid strokes must include
  same-paint alpha-overlap probes. A screenshot passes only when self-crossings
  have the same paint strength as adjacent body stroke samples and do not become
  darker through multiple visible composites.

### Validation Gates

For future stroke architecture changes:

- the three authority files above must state the same rule;
- no removed stroke report, BDD feature, completed copy, or old spec file may
  remain as a rule source;
- `stroke-flow-inspector.data.js` must pass `node --check`;
- search must show no old rule references outside decision history and ignored
  artifacts;
- runtime implementation evidence must include focused probes and reviewed
  screenshots before the final Diagnostics / visual review gate can close;
- translucent center solid visual evidence must include same-paint alpha-overlap
  probes at self-intersections, not just global red-pixel or dark-pixel scans;
- tests that only prove numeric half-width or join-difference pixels while
  allowing visible pentagon fragmentation are insufficient and must fail.
