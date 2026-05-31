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
  solid parity.
- No whole-engine completion claim is active.
- The 2026-05-31 reported self-intersecting inside solid slice now has focused
  unit probes, e2e pixel gates, and manual app screenshot review passing for
  shared-edge half-width, fill clipping, join-matrix differences, and absence of
  fragmented internal pentagon output.
- Step 30 may be treated as passed only for this reported inside-solid slice.
  No whole-matrix or whole-engine completion claim is active until the broader
  matrix is revalidated with the same screenshot-review standard.

### Required Stroke Rule

Figma-style constrained solid strokes are not authored as direct selected-side
solid geometry.

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

Dashed constrained strokes remain a separate interval-domain model. Dashed
split-segment intervals, terminal half-dashes, caps, and provenance must not be
used to define solid visible geometry.

### Inspector Flow Requirements

- Step 17 builds stroke candidates by model: solid uses the doubled authored
  center-stroke candidate plus mask provenance; dashed uses interval candidates.
- Step 20 applies solid legality by clipping the doubled authored center-stroke
  candidate with the correct mask. It may keep diagnostic derivation evidence,
  but visible solid render must not be built from that evidence.
- Step 24 and Step 25 must carry model-separated render, hit, and export
  descriptors. Solid visible render must consume the masked authored stroke
  descriptor; hit/export may use coverage evidence only when it cannot affect
  visible pixels.
- Step 30 is the only final visual gate. For the 2026-05-31 reported
  inside-solid slice it passed only after current Figma-parity probes and manual
  app screenshot review covered internal shared-edge width, all five internal
  corner join variants, miter-limit behavior, fill preservation, no visible
  derivation fragments, and no fragmented internal pentagon. Future slices must
  pass the same standard before any broader completion claim.

### Validation Gates

Before claiming this plan is complete:

- the three authority files above must state the same rule;
- no deleted stroke report, BDD feature, completed copy, or old spec file may
  remain as a rule source;
- `stroke-flow-inspector.data.js` must pass `node --check`;
- search must show no old rule references outside decision history and ignored
  artifacts;
- runtime implementation evidence must include focused probes and reviewed
  screenshots before Step 30 can close;
- tests that only prove numeric half-width or join-difference pixels while
  allowing visible pentagon fragmentation are insufficient and must fail.
