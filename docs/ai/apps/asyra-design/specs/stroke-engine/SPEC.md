# Stroke Engine Specification

## Authority

This document is the semantic source of truth for Asyra stroke behavior. It
defines the supported authoring surface, deterministic geometry, ownership,
artifact, output-channel, cache, diagnostic, numerical, and acceptance
contracts.

The machine-readable companion is
`docs/ai/apps/asyra-design/specs/stroke-engine/inspector.data.js`. The Inspector
defines stage order, route predicates, artifact ownership, preservation, and
failure ownership. It may summarize this document by stable rule id, but it
must not introduce geometry or product semantics that are absent here.

No implementation file, test, screenshot, analysis artifact, report, viewer,
or decision record defines stroke behavior. Those materials may verify or
explain this contract only.

## Product Principles

1. One semantic value has one owner stage.
2. Product geometry is derived deterministically from canonical vector topology
   and a normalized stroke specification.
3. Render, hit, and export are sibling projections of the same completed stroke
   product.
4. Downstream stages preserve completed products and evidence; they do not
   reconstruct upstream semantics.
5. Diagnostics and validation evidence never contribute visible, hit, export,
   or persisted product data.
6. A cache hit is valid only when it is semantically identical to evaluation
   without reuse.
7. Unsupported or invalid input fails closed to a typed rejected or empty
   result; it never selects substitute geometry.

## Package Ownership

### `@asyra/stroke-engine`

The stroke engine is a pure, deterministic, replaceable workspace package. It
owns:

- stroke input normalization;
- source geometry and topology classification for stroke production;
- domain planning;
- dash allocation;
- center, constrained-solid, and constrained-dashed product construction;
- cap, join, miter, seam, and smooth-continuity semantics;
- legality projection;
- final-face composition;
- render, hit, and export descriptor production;
- stage-owned reuse signatures and immutable evidence.

It must not import application UI, React, Pixi, scene-tree runtime state,
feature sessions, selection state, or preset internals.

### Asyra Design

The app owns user intent, stroke property editing, vector editing operations,
and app common-API adapters. It converts user actions into canonical mutation
requests and never constructs stroke product geometry.

### Framework state packages

Feature-system owns interaction session execution. Props-manager validates
stroke property writes. Factory and scene-tree own transaction boundaries and
canonical model commit. Reactive-events publishes committed deltas. None of
these packages owns stroke geometry.

### `@asyra/preset`

Preset owns optional default registration and integration wiring. It may
register the default stroke engine with built-in render strategies. It must not
contain stroke geometry algorithms or become the semantic owner of an engine
artifact.

### `@asyra/render`

Render owns renderer abstractions and concrete pixel projection. It consumes
completed render entries. It must not infer domains, allocate dashes, construct
caps or joins, clip legality, compose final faces, or use renderer output as hit
or export geometry authority.

## Public Engine Contract

The package exposes a replaceable engine interface equivalent to:

```ts
interface StrokeEngine {
  evaluate(
    request: StrokeEngineRequest,
    context?: StrokeEvaluationContext
  ): StrokeEngineResult
}

declare function createStrokeEngine(options: {
  geometryBackend: StrokeGeometryBackend
}): StrokeEngine
```

The exact TypeScript declarations may group fields into named types, but they
must preserve the semantics below.

### `StrokeEngineRequest`

A request contains:

- `schemaVersion`;
- stable element and stroke ids;
- canonical vector `points`, `segments`, and ordered `networks`;
- source, topology, stroke-style, paint, and visibility revisions;
- fill rule and coordinate-space signature;
- authored stroke fields from the supported surface;
- domain context required to derive filled regions and legal sides;
- optional immutable reuse candidates with their complete owner-stage
  signatures.

The request contains canonical model data, not renderer objects, sampled
pixels, visual probes, or product polygons from an earlier frame.

### `StrokeEngineResult`

The result is a discriminated union:

- `rejected`: input cannot be normalized; contains reason ids and non-product
  diagnostics;
- `empty`: valid input intentionally produces no product; contains a semantic
  reason and revision evidence;
- `product`: contains immutable final faces, render descriptors, hit
  descriptors, export descriptors, output-channel identity, and product
  evidence.

A `product` result carries no renderer pixels and no mutable renderer state.
Every collection has deterministic ordering.

### `StrokeGeometryBackend`

The backend supplies deterministic curve evaluation, path length, sweep/offset,
polygon boolean, containment, area, bounds, and canonicalization primitives.
Backend replacement is legal only when an independent differential contract
proves equal product identity, geometry within the declared tolerances, legal
side, source coverage, channels, and bounds.

## Supported Authoring Surface

The engine supports:

- line, quadratic Bezier, and cubic Bezier authored segments;
- open and closed paths;
- ordered vector networks, compound paths, contour visits, and
  self-intersections;
- one stroke paint payload per stroke;
- solid and gradient paint payloads with visibility and opacity;
- `solid` and `dashed` styles;
- `center`, `inside`, and `outside` positions;
- finite non-negative width;
- one authored dash/gap pair;
- `butt`, `round`, and `square` caps;
- `miter`, `bevel`, and `round` joins;
- a source-domain `miterAngle` threshold;
- visible render, hit, export, and opt-in diagnostic channels;
- discrete updates, continuous parameter updates, drag, undo, redo, reload, and
  collaboration deltas through the same semantic pipeline.

Multiple stroke paints, arbitrary dash arrays, mixed per-end caps, mixed
per-point joins, markers, arrowheads, brush strokes, dynamic or variable-width
strokes, and non-uniform side weights are unsupported. They produce a typed
rejected result unless this specification later defines their complete
semantics.

## Stroke Field Semantics

| Field | Contract |
| --- | --- |
| `visible` | `false` produces a valid empty output without rebuilding geometry. |
| `width` | Finite `W > 0` produces geometry; `W = 0` is valid empty; negative or non-finite values are rejected. |
| `style` | `solid` or `dashed`; style changes do not erase authored dash/gap. |
| `position` | `center`, `inside`, or `outside`; an unavailable constrained domain does not map to center. |
| `dash`, `gap` | Finite positive values required for dashed output. |
| `capType` | `butt`, `round`, or `square`; caps apply only at cap-owned body boundaries. |
| `joinType` | `miter`, `bevel`, or `round`; joins apply only at authored sharp vertices reached by product bodies. |
| `miterAngle` | Finite source-domain angle threshold in degrees. |
| `fill` | Paint payload attached after geometry and legality; paint-only changes preserve geometry identity. |

Unknown enum values and invalid dashed parameters are rejected. A rejected
dashed stroke never becomes a solid stroke.

## Canonical Artifact Envelope

Every cross-stage product or evidence artifact is immutable and records:

- `schemaVersion`;
- stable `artifactId` and `ownerStageId`;
- source, topology, stroke, paint, and visibility revisions used by its owner;
- complete dependency signature;
- ordered child artifact ids;
- source ids and source-distance ranges represented by the artifact;
- product or evidence channel;
- ordered provenance showing each stage that preserved it.

Downstream stages may compute summaries such as area, bounds, counters, and
display labels. They may not recalculate source ranges, interval identity,
terminal role, cap policy, join resolution, legal side, product geometry, or
channel ownership.

Missing required envelope fields produce a typed failure owned by the first
stage that should have emitted or preserved the field.

## Coordinate And Numerical Contract

All semantic geometry is evaluated in source space. Zoom, viewport, DPR, and
raster antialiasing never change product geometry.

For source length `L`, dash `D`, gap `G`, and width `W`:

```text
STROKE_SOURCE_EPSILON =
  max(0.000001, max(L, D, G, W) * 0.000000001)

STROKE_GEOMETRY_TOLERANCE = max(0.001, W * 0.01)

STROKE_AREA_TOLERANCE = max(0.00000001, W * W * 0.000001)

MITER_ANGLE_EPSILON_DEGREES = 0.000001
```

Source epsilon is used only for ordering, degeneracy, and identity comparison.
Geometry and area tolerances are used for independent equivalence proofs. They
do not permit visible cracks, wrong-side paint, absent joins, missing body
coverage, or undeclared overlap.

Width-oriented acceptance uses `max(0.5 source units, W * 0.05)`. Raster review
may add at most one CSS pixel around an already-defined source-space boundary;
it cannot weaken a semantic absence or ownership assertion.

## Source Geometry Model

The engine builds one immutable source geometry model for every ordered authored
network. It preserves authored point, segment, network, and revision identity.
Sampling, flattening, contour traversal, self-intersection splitting, and
legality splitting never replace an authored segment id or create a new authored
vertex.

The model contains:

- exact or bounded-error path evaluation and arc length;
- authored endpoint and incident tangent identity;
- open/closed and compound topology;
- contour and filled-region evidence under the requested fill rule;
- source-domain tangent continuity;
- derived split provenance;
- domain context sufficient for inside/outside planning.

Derived contour visits, tessellation points, intersections, and legality split
points are not authored vertices and cannot own authored caps or joins.

## Source Families And Continuity

Each network is classified as degenerate, simple open, simple closed, compound,
or self-intersecting. Each authored vertex is classified from source-domain
incident tangents as endpoint, tangent-continuous, or sharp.

High curvature inside one authored smooth segment is body continuity, not a
join. A tangent-continuous authored vertex remains one smooth-continuity route.
A sharp authored vertex may own one join when visible incident products reach
the vertex.

Zero-length authored segments produce explicit empty source records and no
visible product. They do not borrow geometry or allocation state from adjacent
segments.

## Stroke Domain Plan

Domain planning is the sole owner of center/inside/outside routing. It emits one
of these modes, or another mode with equivalent explicit semantics:

- `center-product`;
- `closed-constrained-domain`;
- `open-contour-constrained-domain`;
- `open-dangling-outside-both-sides`;
- `inside-excluded-open-span`.

Center occupies the signed normal band `[-W / 2, W / 2]` around the authored
source.

Inside and outside are constructed from a doubled center product of total width
`2W`, then intersected with the selected legal domain. Inside occupies the
filled side adjacent to the source boundary. Outside occupies the exterior side
adjacent to the source boundary. A downstream stage never selects or changes
the side.

An open network without a bounded filled region uses the formal open center
product for inside/outside authoring. An open self-intersecting network that
forms bounded filled regions from real authored segments uses constrained
domains without adding an invisible closing edge.

For such an open network:

- inside includes contour-participating source spans and excludes dangling
  branches;
- outside includes exterior contour spans and paints dangling branches on both
  sides over the normal band `[-W, W]`.

Domain clipping never creates authored endpoints, allocation origins, caps, or
joins.

## Independent Dash Spans

Every authored line, quadratic, or cubic segment is exactly one
`IndependentDashSpan`. It has a stable span id, source-distance origin zero, one
authored source range, and an ordered start/end pair.

Dash allocation restarts at every authored segment boundary, including closed
paths. Flattening, contour traversal, self-intersection, domain clipping, and
legality splitting preserve the original span and do not restart allocation.

## Dash Allocation

Let a non-degenerate span have length `L`, dash `D`, gap `G`, width `W`, and cap
`C`. The start and end terminal dash bodies each have nominal source length
`D / 2`; each interior dash has source length `D`.

Cap longitudinal extension is:

```text
E(butt, W) = 0
E(round, W) = W / 2
E(square, W) = W / 2
```

For `N >= 0` interior dashes:

```text
visibleGap = (L - D - N * D) / (N + 1) - 2 * E(C, W)
sourceGap = visibleGap + 2 * E(C, W)
```

The allocator selects the largest integer `N` whose ordered ranges are valid,
whose `sourceGap` is non-negative, and whose
`visibleGap + STROKE_SOURCE_EPSILON >= 0.6 * G`.

Ranges are:

- start: `[0, D / 2]`;
- interior `i`: start terminal, one source gap, then ordered `D` bodies separated
  by `sourceGap`;
- end: `[L - D / 2, L]`.

If no `N` satisfies the floor, one dashed collapsed interval covers `[0, L]`.
It remains dashed and records `insufficient-visible-gap`; it is not solid and
not two overlapping terminal intervals.

Allocation records interval ids, ordered source ranges, terminal roles,
visible/source gap, cap extension, span id, segment id, and endpoint-cap policy.
Legality may shorten or separate visible fragments but never edits allocation.

## Cap Ownership

For dashed spans, authored source-endpoint sides of start and end terminal
intervals suppress caps. Only an inward body-side terminal may use the authored
cap. Middle intervals may use the authored cap at both body sides. A collapsed
start-end interval suppresses both authored endpoint-side caps.

For solid open paths, the true authored endpoints own the configured caps.
Derived split points own no caps.

Cap footprints are:

- butt: no longitudinal extension past its seam;
- round: one half-circle of radius `W / 2` centered on the seam;
- square: one rectangle extending `W / 2` along the terminal tangent.

A cap is never a join primitive and never repairs missing body or join geometry.

## Join And Miter Resolution

Only an authored sharp source or network vertex can own an authored join. A
visible join requires visible incident body products on both sides. A gap at a
vertex does not create a body only to carry a join.

`vertexAngle` is derived solely from authored incident source tangents before
masking, clipping, or polygon cleanup. `miterAngle` is compared in the same
degree domain:

```text
delta = vertexAngle - miterAngle
```

For authored `miter`:

- `delta > MITER_ANGLE_EPSILON_DEGREES` resolves to `miter`;
- otherwise it resolves to `bevel-by-miter-angle`.

`bevel-by-miter-angle` preserves authored-miter provenance but uses the same
seam-connected cut-off footprint as authored bevel. Degenerate tangent cases
resolve to a deterministic bevel-equivalent footprint.

Round joins use one legal-side join arc. Miter, bevel, round, and
bevel-by-miter-angle share the same incident seam identity and contributor
rules. A renderer join style cannot visibly complete a constrained sharp
vertex.

## Product Family Selection

Exactly one family plan is selected per normalized stroke/network route:

- center solid or center dashed;
- constrained solid;
- constrained dashed;
- typed empty or rejected result.

Selection is based only on normalized style, position, source family, and domain
plan. Product builders may co-execute for bodies and authored joins, but they do
not form a fallback chain.

## Center Products

Center solid is the authored center stroke over `[-W / 2, W / 2]`, with authored
open-end caps and authored sharp joins.

Center dashed materializes the independent intervals and body-side cap policies
defined above. Authored sharp vertices reached by adjacent terminal bodies use
one source-vertex join. Tangent-continuous spans remain connected body
continuity.

For translucent paint, a self-crossing center stroke must not accumulate extra
alpha from duplicate representations of the same semantic product. The final
face owner emits one alpha-safe composite or equivalent single-layer evidence.

## Constrained Solid Products

Inside and outside solid products begin as a `2W` authored-center sweep. The
body and canonical source-vertex joins are assembled before legality. Legality
selects the declared inside or outside domain.

At internal shared edges of compound or self-intersecting filled regions, each
adjacent filled face exposes the correct half-width contribution. Helper faces,
arrangement boundaries, contour visits, and derivation fragments remain
evidence and do not paint.

Descriptor-backed source paths are permitted only for same-owner smooth spans
whose exact equivalence to the completed product is proven. Authored sharp
vertices require canonical join products before descriptor encoding.

## Constrained Dash Bodies

Each allocated non-empty interval owns exactly one connected pre-legality body
artifact. Its authoritative geometry is the swept-band set over the authored
source-distance range. Offset rails are an encoding, not the authority.

For center the cross-section is `[-W / 2, W / 2]`. For constrained one-sided
routes the pre-legality body uses the doubled band and records the selected
domain. For dangling outside both-side routes the visible legal normal span is
`[-W, W]`.

At curvature cusps or offset self-intersections, output follows the outer
envelope of the swept-band set. Sampling must not create comb gaps, radial
slices, disconnected strips, subdivision caps, straight-chord substitution, or
visible carrier edges.

The completed dash body artifact contains source range, body topology, endpoint
cap primitives and policy, ordered rails/cross-sections, source-adherence
evidence, allocation identity, and all data needed by legality without reading
the whole source path again.

## Dash Seam Boundaries

Each constrained dash body endpoint that participates in a join emits a complete
directed seam cross-section from the actual completed body boundary:

- center: left rail to right rail relative to authored direction;
- constrained one-sided: source-adjacent endpoint to outer endpoint;
- outside both-side: negative-normal outer endpoint to positive-normal outer
  endpoint.

The artifact records the ordered seam polyline, both endpoint ids, body and
interval ids, span and source segment ids, terminal role, legal side, tangent,
and cap-suppression state.

Source-vertex joins consume the exact two incident seam artifacts and share
each complete seam, not merely one endpoint. Seam gap area is zero. Any allowed
same-paint overlap is represented once by final composition.

## Pre-Legality Product Set

The product-set owner collects completed bodies, cap primitives, canonical
source-vertex joins, smooth-continuity evidence, and ownership metadata without
recomputing them.

Terminal and smooth-continuity records are non-visible evidence over body
products. They do not emit duplicate body or cap geometry. The set preserves
all body, interval, seam, join, cap-policy, source-range, domain, and revision
identities.

## Legality

Legality intersects constrained product units with their canonical legal domain.
It emits actual immutable surviving fragments or an explicit legality-empty
record with domain id and measured area evidence.

The only post-allocation empty reason is zero area after canonical legal-domain
intersection, where area is at most `STROKE_AREA_TOLERANCE`. Any larger sliver
is required product geometry.

Legality may split one body into multiple fragments only where the exact domain
separates it. Each fragment preserves the originating body id, interval id,
effective source ranges, seam provenance, cap policy, join provenance, and legal
side. It never reallocates dashes or reconstructs product geometry.

## Final Faces And Composition

Final-face composition is the last geometry-changing stage. It attaches paint,
resolves same-paint overlap, and emits one alpha-safe semantic product while
preserving every product and evidence identity.

Allowed same-paint composition is limited to declared compatible products. It
must not convert a terminal, join, interval, legal fragment, or source-span
owner into generic geometry or erase provenance.

Every local visible region is explainable by these contributors:

| Local case | Allowed visible contributors |
| --- | --- |
| Solid authored sharp vertex | Previous body, one authored join, next body |
| Dashed authored vertex reached by bodies | Incident dash bodies and one authored join |
| True solid open endpoint | Owning body and configured cap |
| Dashed authored source endpoint | Owning terminal body; endpoint-side cap suppressed |
| Derived intersection or legality split | Incident legal body fragments only |
| Tangent-continuous source region | One continuous body product |
| Gap at a vertex | No contributor invented for cap or join |

Positive overlap outside a declared same-paint composition region, duplicate
alpha, missing required coverage, wrong-side material, and an unowned
protrusion are product failures.

## Descriptor Encoding

A descriptor is a renderer-ready encoding of an already completed final-face
product. It may replace eager polygons only when registered exactness evidence
proves equivalent product identity, geometry, bounds, legal side, seam
continuity, source coverage, and render/hit/export output.

Descriptors preserve source revision, stroke signature, domain signature,
interval and fragment ids, terminal roles, cap policy, join ownership, legal
side, smooth-continuity ids, output channel, and exactness-evidence id.

Evidence polygons, carrier paths, clip boundaries, and domain boundaries do not
become visible geometry. A downstream consumer may not slice the source path,
rebuild caps/joins, rerun legality, or compose another final face.

## Output Channels

The completed product fans out into sibling channels:

- render descriptors and packets;
- hit descriptors and packets;
- export descriptors and packets;
- optional diagnostics.

Render entries consume only visible product descriptors or packets. Renderer
projection emits pixels and immutable projection membership evidence.

Hit and export consume the completed semantic product or one shared exact
descriptor projection. They never consume renderer pixels, draw calls, renderer
geometry, bounds-only substitutes, or diagnostic geometry.

Render, hit, and export preserve equal surviving interval ids, legal fragment
ids, effective source-range unions, and geometry under their declared channel
encoding. Diagnostics are tagged evidence only.

## Survival And Channel Parity

For every allocated non-empty dash interval:

```text
allocated
  = materialized
  = legalityEmpty union finalFace
  = legalityEmpty union render
  = legalityEmpty union hit
  = legalityEmpty union export
```

The unions are disjoint by interval and legal-fragment id. Equality of ids alone
is insufficient: surviving channels also preserve effective source ranges,
geometry signature, coverage signature, legal side, bounds, and area.

Each stage appends immutable stage-owned membership evidence to one stable
survival identity. It never mutates an earlier stage's evidence.

## Invalidation And Reuse

Invalidation is stage-specific:

| Change | Required invalidation |
| --- | --- |
| Paint color/opacity/kind | Paint and channel projection only |
| Visibility | Channel output only; hidden produces valid empty output |
| Width | Domain-dependent body, caps, joins, legality, and downstream output |
| Style or position | Family/domain planning and downstream output |
| Dash or gap | Dash allocation and downstream dashed products |
| Cap | Cap-owned body boundaries and downstream output |
| Join or miter angle | Join products and downstream output |
| Source point/handle | Source geometry and every dependent product |
| Topology | Entire affected network pipeline |

Every owner stage defines a semantic cache key containing only dimensions that
affect its output. Required dimensions include stable source and network ids,
revisions, topology signature, coordinate-space signature, normalized stroke
fields owned by the stage, domain signature, ordered child ids, and algorithm
schema version.

Paint-only reuse may retint an unchanged completed product. Visibility may skip
projection. Geometry reuse requires exact signature equality. Reuse candidates
with missing or mismatched identity fail closed to exact evaluation.

Cache hit and exact evaluation produce equal immutable products, bounds, area,
channels, and evidence. Object identity, array identity, recipe id alone, or
renderer cache state is not semantic identity.

## Interaction And State Consistency

Point drag, handle drag, structural vector editing, discrete property edits,
continuous parameter edits, undo, redo, reload, and collaboration deltas all
reach the engine through committed canonical state.

One intended user action creates one intended undo commit. Intermediate drag
updates may be non-undoable within one session, while the final action publishes
one canonical undoable result.

The render mirror applies each committed delta once and derives an engine
request carrying matching revisions. The engine does not read transient UI
state. Render output must correspond to the accepted canonical revision and
must not display stale cached geometry for a newer request.

## Diagnostics

Diagnostics may report bounded records for normalization rejection, source
topology, domains, interval allocation, ownership, seam identity, legality,
composition, cache decisions, and channel parity.

Every diagnostic record is explicitly tagged non-product. Diagnostic mode does
not alter geometry, ordering, cache keys, channel membership, timing, hit, or
export behavior.

## Acceptance Contracts

### Normalization

- Every supported field has one deterministic normalized representation.
- Invalid input produces the declared rejected result.
- Zero width, hidden paint, empty topology, and zero-length sources produce
  their declared empty result.

### Source-space geometry

- Body cross-sections occupy the configured position and width.
- Curved bodies follow authored source tangents and outer envelopes.
- Every required body is connected before legality.
- Legal output has zero wrong-side material above area tolerance.
- Required slivers, terminals, joins, and smooth spans are present.
- Seam endpoints and polylines match within geometry tolerance with no visible
  crack.

### Ownership and composition

- Every visible region maps to an allowed owner.
- Caps and joins never substitute for one another.
- Derived splits own neither authored caps nor authored joins.
- Same-paint output is alpha-safe and preserves provenance.
- Evidence and diagnostics contribute no product geometry.

### Channel parity

- Render, hit, and export consume the same completed semantic product.
- Surviving interval, fragment, range, legal-side, bounds, and geometry evidence
  agree across channels.
- Renderer projection is never the geometry authority of hit or export.

### State and reuse

- Discrete, continuous, drag, undo/redo, reload, and collaboration routes produce
  the same result for the same canonical request.
- Cache hit and exact evaluation are equivalent.
- Paint and visibility changes do not rebuild source geometry.
- Geometry-affecting changes cannot reuse stale product artifacts.

### Performance

Correctness is required for every measured frame. Frame-aligned end-to-visible
p95 has a target of `8.33 ms` for normal scenarios and a hard upper bound of
`16.67 ms` for declared heavy scenarios.

Timing begins when a canonical mutation or property revision is accepted and
ends at the first visible projection carrying the same product hash, revision,
freshness, and channel membership. Attribution may report engine evaluation,
cache, render-entry, and renderer-flush time, but no component metric replaces
end-to-visible latency.

Continuous width, dash, gap, and miter-angle evaluation must contain at least
90 percent distinct geometry-affecting states plus an explicit repeated state
that proves the cache-hit path. Performance never authorizes approximate,
preview-only, or alternate product semantics.

## Contract Extension

A new stroke capability is admissible only when this document defines its input
normalization, semantic owner, stage inputs/outputs, routes, artifacts,
contributors, channels, reuse dimensions, numerical acceptance, and final
product evidence. The Inspector must then reference the new rule and represent
its complete lifecycle before implementation begins.
