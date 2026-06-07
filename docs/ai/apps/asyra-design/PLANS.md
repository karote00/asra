Never record completed plans here.

# App Plans

## In Progress

1. Stroke engine final implementation

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

- Reopened on 2026-05-31 for grid/vector-network self-intersecting inside
  solid rule correctness.
- The inspector flow is now scoped as the Stroke / Vector System Inspector
  Flow. It must cover the full upstream-to-output path: feature intent, vector
  common API/domain adapter, canonical computed patch, transaction/data
  channel, render mirror, stroke geometry, product packets, and final visual
  review.
- The framework-native vector operation flow is the current baseline: point and
  handle drag plus structural vector operations must express explicit
  operations, write canonical workspace/world vector data through computed
  patches, and let render consume committed downstream state.
- The outside dashed square visual gate remains open. This is tracked at the
  Product Output / visual review step, not as a whole-system completion claim.
- No whole-engine completion claim is active.
- The 2026-05-31 reported self-intersecting inside solid slice now has focused
  unit probes, e2e pixel gates, and manual app screenshot review passing for
  shared-edge half-width, fill clipping, join-matrix differences, and absence of
  fragmented internal pentagon output.
- The final Diagnostics / visual review step may be treated as passed only for
  the reported inside-solid slice. No whole-matrix or whole-engine completion
  claim is active until the broader matrix is revalidated with the same
  screenshot-review standard.

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
  use fixed corner patches that ignore the authored join envelope;
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

Dashed constrained strokes remain a separate interval-domain model for dash
allocation, but constrained `inside` dashed visible geometry follows the same
Asyra doubled center-stroke mask rule as constrained solid geometry. For each split source
range, allocate visible intervals with half-dash terminals at both cut ends and
evenly distributed middle gaps; then build the authored center dashed stroke at
twice the requested stroke width, preserving `strokeCap`, `strokeJoin`, and
`strokeMiterLimit`, and clip that doubled center-stroke product with the
filled-region mask for `inside`. The clipped result is the visible product
geometry. Direct selected-side ribbons, local-side fallback strips, and
derivation helpers are evidence only and must not define product-visible inside
dashed pixels.

For product-visible constrained `inside` dashed render, the same exact product
may be encoded as a grouped render descriptor containing the inside
`fillClipPolygons`, the authored dashed `strokePaths`, and the
`strokePathStyle`. This descriptor is the visible product path, not a preview
or approximation. When a frame has one exact inside dashed mask descriptor for
one fill domain and one stroke style, same-visual overlap collapse is not
required; diagnostics/export may still keep per-interval evidence, but visible
render must consume the exact descriptor.

### Required Stroke / Vector System Flow

Stroke-related behavior must be observed as one deterministic system flow:

1. Feature/session code converts user input into explicit vector or stroke
   intent. It must not directly synchronize render state.
2. App common API/domain adapters own vector mutations. They produce canonical
   workspace/world computed data patches for point/handle drag and structural
   vector operations.
3. Each intended user action is committed through one transaction boundary and
   one intended undo unit. Drag preview remains non-undoable; mouseup/final
   edits are undoable.
4. Scene-tree and data-channel publish computed patch updates. Payloads must
   identify changed scalar values and record ids instead of forcing unrelated
   full-topology rewrites.
5. Render is a downstream consumer. Render mirror/cache applies committed data
   exactly once and derives renderer-ready vector/stroke data from that mirror.
6. Stroke geometry stages consume normalized render data only. They must not
   depend on feature-local state, undo payload cleanup, or direct app-to-render
   synchronization.
7. Product output stages may emit render, hit, export, and diagnostics
   descriptors, but visible render must not use diagnostic/helper geometry as
   product output.

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
- Product Output steps own render/hit/export packet projection and renderer
  draw entries without changing stroke semantics.
- Diagnostics and final visual review are the only completion gates. Current
  outside dashed square failures remain blocked here until reviewed screenshots
  and rule-driven probes pass.

### Validation Gates

Before claiming this plan is complete:

- the three authority files above must state the same rule;
- no deleted stroke report, BDD feature, completed copy, or old spec file may
  remain as a rule source;
- `stroke-flow-inspector.data.js` must pass `node --check`;
- search must show no old rule references outside decision history and ignored
  artifacts;
- runtime implementation evidence must include focused probes and reviewed
  screenshots before the final Diagnostics / visual review gate can close;
- tests that only prove numeric half-width or join-difference pixels while
  allowing visible pentagon fragmentation are insufficient and must fail.
