# Stroke Engine Final Spec

## Authority

This file is the stroke engine specification. It must stay in sync with:

- `docs/ai/apps/asyra-design/PLANS.md`
- `docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js`

No other stroke plan, report, BDD feature, completed copy, or archived spec is
allowed to define current stroke behavior. Wrong historical decisions may remain
only in decision history.

`stroke-flow-inspector.html` is a non-authoritative viewer shell. It may read and
display `stroke-flow-inspector.data.js`; it must not contain stroke rules,
contracts, conclusions, reading instructions, or completion status.

## Current Status

The stroke engine remains active as of 2026-05-31. The reported
grid/vector-network self-intersecting inside solid slice now passes focused
numeric probes, e2e pixel gates, and manual app screenshot review for
shared-edge half-width, fill clipping, join-matrix differences, and absence of
fragmented internal pentagon output. Any previous whole-matrix completion
statement is superseded; this is slice-level evidence only, not a whole-engine
completion claim.

The inspector flow is now the Stroke / Vector System Inspector Flow. It covers
the complete stroke-related data path from feature intent through common API
vector operations, canonical computed patches, transaction/data-channel
publication, render mirror updates, stroke geometry, product packets, and final
visual review. The framework-native vector operation flow is the baseline:
point/handle drag and structural operations commit canonical workspace/world
vector data through computed patches, while render remains a downstream
consumer.

The outside dashed square visual gate has current rule-driven probes and
reviewed screenshots passing for the self-intersecting star slice. That is
slice evidence at Product Output / visual review; it is not a whole-system
completion claim.

## Stroke / Vector System Flow

Stroke-related behavior is inspected as one deterministic system flow:

1. Feature/session code converts input into explicit vector or stroke intent
   and never writes render store state directly.
2. App common API/domain adapters own vector mutations and emit canonical
   workspace/world computed patches for drag and structural operations.
3. Each intended user action is wrapped in one transaction boundary and one
   intended undo unit. Drag preview remains non-undoable.
4. Scene-tree and data-channel publish changed scalar values and record ids as
   computed patch updates after commit.
5. Render mirror/cache applies each committed patch exactly once and derives
   renderer-ready vector/stroke data from committed state.
6. Stroke geometry stages consume normalized render data and own shared
   geometry, stroke domains, dash intervals, legality, and final semantic
   records.
   Invalidation is stage-based: source path/topology, stroke family, stroke
   domain, dash schedule, terminal cap, join/miter shape, paint, and render
   output have separate internal revisions. A stroke parameter change must
   dirty only the stages that parameter affects; vector drag dirties source
   path data while keeping static stroke parameter revisions stable.
   Dirty classification must feed a real stage product cache at the render
   mirror/vector graphic boundary. Exact semantic product descriptors may be
   stored by element, network, stroke, source revision, and geometry-affecting
   stroke signature; paint-only changes retint cached descriptors instead of
   rebuilding geometry.
7. Product output emits render, hit, export, and diagnostics descriptors
   without changing stroke semantics. Visible render must not use diagnostic or
   helper geometry as product output.

Stroke paint data has one canonical model shape. Element `fills` and
`strokes[n].fill` both use `FillAttrs`; a stroke owns exactly one fill payload
whose `id` matches the stroke id. Stroke root fields such as `color`,
`opacity`, `visible`, `kind`, `colorFormat`, `defaultColorFormat`, and
`gradient` are legacy load-boundary input only and must not be written back to
computed data. Stroke visibility is `strokes[n].fill.visible`. Render compares
`computed.strokes` by stroke id and fill signature: if only `stroke.fill`
changes, the renderer dirties `paint` / `renderOutput` and reuses cached
semantic product geometry.

## Asyra Solid Rule

Constrained solid strokes follow Asyra's doubled authored center-stroke mask
model. This is the Asyra rule contract; it may be informed by a subset of
external design-tool behavior, but external tools are not the authority for this
spec:

1. Build the authored center stroke at twice the requested stroke width.
2. Apply authored join behavior to that center stroke. `strokeJoin` and
   `strokeMiterLimit` affect the produced center-stroke envelope before masking.
3. Clip the result with the filled-region mask for `inside`, or the exterior
   mask for `outside`.

The solid product must not be represented as direct constrained-side visible
geometry. Region faces, strip fragments, helper polygons, and topology evidence
can justify legality, but they are not the visible solid stroke.

For `center` solid strokes, the product-visible encoding is the authored center
stroke. A self-intersecting center solid vector may use an authored stroke path
descriptor for visible render, preserving `strokeJoin`, `strokeCap`, and
`strokeMiterLimit`. Native stroke projection is valid only when it is
alpha-safe for the visible product; translucent self-intersecting center strokes
must render through a single-composite descriptor so crossings do not accumulate
alpha. Exact polygon packets remain valid for hit/export/diagnostics, but they
are not required before each drag-time visible frame when the authored center
stroke path is the product.

For `center` dashed strokes, the product-visible encoding is the authored
center dashed stroke. Drag-time visible render may encode visible dash intervals
as authored centerline `strokePaths` with the authored `strokeCap`,
`strokeJoin`, `strokeMiterLimit`, and resolved dash allocation. That descriptor
is the exact visible product, not a preview. Normal drag frames must not require
center dashed polygon packets or resolved self-intersection geometry unless
diagnostics, hit/export materialization, or another exact rule explicitly needs
that evidence.

For open `center` dashed strokes, resolved dash allocation is network-level.
A continuous open network/subpath owns one dash schedule across its full
arc-length; individual segment boundaries must not restart the phase. The two
true network endpoints use half-dash terminal intervals when the path is long
enough, middle intervals keep the authored dash length, and middle gaps are
distributed across the network. Round and square cap footprint is included when
measuring readability: the current Asyra floor is `configuredGap * 0.6` after
cap footprint. If the open network cannot hold endpoint half-dashes plus a
legible cap-aware visual gap, it may collapse into one `start-end` visible dash
instead of producing crowded dash groups.

Open authored dashed `inside` / `outside` strokes are center-equivalent only
when the open network has no bounded filled-region domain. If an open
self-intersecting network resolves bounded filled regions from its real authored
source segments, dashed `inside` and `outside` for that network own a
constrained domain even though its true endpoints remain open. The filled-region
domain is the planar arrangement of the real open source segments only; no
invisible closing edge may be added for domain, dash, hit-test, export, or
product output.

Stroke domain plan is the single product routing entry point for open/closed
semantics. Vector render code and packet builders must not independently map
open constrained strokes to center; they consume domain modes such as
`simple-open-center-product`, `closed-constrained-domain`,
`open-contour-constrained-domain`, and
`open-dangling-outside-both-sides`.

Open self-intersecting `inside` dashed output follows the resolved closed
contour rule: only source spans that participate in a filled contour may produce
inside dash pixels. Dangling open branches and non-contour spans stay unpainted
for `inside`. Open self-intersecting `outside` dashed output follows the
resolved exterior contour rule for contour-owned spans and additionally keeps
dangling open-branch endpoint/cap/dash semantics by rendering those dangling
spans on both sides of the source path. Their visible normal span is
approximately `stroke.width * 2`; they are not center-equivalent ribbons. This
rule is a product contract, not a diagnostic fallback: product output must not
normalize these networks to center, must not inherit continuous open-network
dash phase across independent constrained spans, must not synthesize a closing
edge, and must not paint dangling branches for `inside`.

For adjacency-aware self-intersecting masks, a grouped render descriptor may
carry authored centerline stroke paths with explicit clip groups. Those groups
are an encoding of the masked authored stroke source: they must preserve
`strokeJoin`, `strokeMiterLimit`, and source-centerline provenance, and must not
turn face strips, helper polygons, or derivation fragments into visible product
geometry.

For constrained `inside` dashed render, the product-visible encoding may be one
exact grouped descriptor with `fillClipPolygons`, authored dashed `strokePaths`,
and `strokePathStyle`. That descriptor represents the same doubled authored
center-dashed stroke clipped by the inside filled-region mask. It is not a drag
preview, a helper overlay, or an approximation. If the descriptor covers one
fill domain and one stroke style, product output may bypass same-visual overlap
collapse for that frame; per-interval polygons remain diagnostics/export
evidence unless explicitly routed as non-visible projection data. The
descriptor builder must consume resolved self-intersection split/domain
metadata from the resolved geometry model. Explicit source-span product domains
may cover source segment spans that the resolved boundary domains did not
cover; they must not retrace the full path or rediscover source intersections
during drag-time product rendering. Dangling open-branch spans for outside are
explicit dangling source-span domains, not diagnostic fallback.

For constrained `outside` dashed render, drag-time visible render may use an
exact grouped descriptor with authored doubled center-dashed `strokePaths`,
authored cap/join/miter style, and an exterior clip mask. This descriptor is the
outside legal-domain product path. Square and round caps remain
terminal-sensitive and must retain full terminal/cap correctness; butt-cap
outside dashed drag may use fill-only resolved geometry only when no terminal or
cap rule depends on full self-intersection stroke-boundary metadata.

## Self-Intersecting Inside Solid

For grid/vector-network self-intersecting inside solid shapes, including the
reported five-point star:

- visible pixels must come from the doubled authored center stroke clipped by an
  inside filled-region mask;
- the inside mask must preserve face occupancy, winding rule, and filled-filled
  adjacency;
- a binary union of filled faces is insufficient when it widens internal shared
  edges or erases join-sensitive corners;
- each internal shared edge may reveal only half of the requested stroke width
  from each adjacent filled face, so the combined visible width along that edge
  matches the requested stroke width rather than two full-width contributions;
- all five internal pentagon corners must respond to `strokeJoin`;
- miter output must obey `strokeMiterLimit`;
- bevel output must cut the corner without cracks or overreach;
- round output must be smooth and bounded by the authored center-stroke
  envelope;
- outer authored vertices remain normal authored joins and must not be shaved by
  the inside mask.
- the internal pentagon must remain visually continuous, without fragmented
  helper-like strips, broken corner patches, or disconnected slivers.

If a render shows independent full-width strips on both sides of an internal
edge, fixed corner patches that ignore join style, or visible derivation
fragments, the Stroke Geometry / Product Output path is wrong and the final
Diagnostics review must fail. If a numeric probe passes while the app
screenshot still shows fragmentation, the test is insufficient and must be
tightened before any completion claim.

## Dashed Separation

Dashed constrained strokes are a separate interval-domain model:

- selected boundary intervals own dash placement;
- terminal half-dashes and caps are dashed-only behavior;
- dashed provenance must not be copied into solid product records;
- solid visible render must not borrow dashed boundary interval geometry.

For constrained `inside` dashed strokes, interval-domain ownership stops at
dash allocation. Visible product geometry must be built as Asyra doubled center
dashed stroke geometry: each split source range keeps half-dash
terminals at both cut ends and evenly distributed middle gaps, then each visible
interval is stroked on the authored centerline at `stroke.width * 2` with the
authored cap, join, and miter limit, and finally clipped by the inside
filled-region mask. Direct one-sided ribbons, local-side fallback strips, and
diagnostic derivation fragments are not product-visible geometry for inside
dashed strokes.

Split-range dash allocation is cap-aware. Round and square caps extend the
painted footprint beyond the centerline interval, so visual review must measure
the actual gap after cap footprint. Allocation should avoid producing many dash
groups when their visual gaps become much smaller than the configured gap. If a
short split range cannot keep terminal half-dashes and a legible visual gap, the
range may collapse into one `start-end` visible dash. This is a tunable Asyra
readability heuristic; the current floor is `configuredGap * 0.6` after cap
footprint, so a configured gap of `20` must not redistribute into visual gaps
below roughly `12`. Changes must be covered by rule-driven tests and visual
review.

Open path dashed allocation uses the same cap-aware readability floor, but its
center-equivalent domain is the continuous open network rather than a
constrained split range. Open self-intersecting networks with bounded filled
regions formed by real authored source segments are constrained-domain products
for dashed `inside` / `outside`, so their visible output is contour-ownership
driven: `inside` excludes dangling open branches, while `outside` preserves
open endpoint/cap semantics for those branches.
For those constrained products, dash allocation is not the continuous
open-network allocation used by simple open `center` strokes. Each independent
contour-owned span or dangling open source span owns its own split-range
allocation: both cut ends use half-dash terminals when possible, middle
dashes/gaps are redistributed inside that span, and dash phase must not carry
across unrelated constrained spans.

## Inspector Step Contracts

- `Interaction`: feature/session steps own explicit user intent only. They must
  not commit model data directly or synchronize render state.
- `Model Commit`: common API/domain adapter steps own canonical workspace vector
  data, computed patch construction, structural operation adapters, and
  transaction/undo boundaries.
- `Data Channel`: scene-tree and reactive event steps publish computed patch
  updates after commit.
- `Render Mirror`: render mirror/cache steps consume committed patch data once
  and derive renderer-ready data without repairing model state.
- `Stroke Geometry`: geometry steps own normalized render inputs, shared
  geometry, source families, stroke domains, dash allocation, legality, paint,
  and final semantic stroke records. Solid still uses doubled authored
  center-stroke candidates plus mask provenance; constrained `inside` dashed
  still clips doubled center-dashed product intervals with the inside
  filled-region mask.
- `Product Output`: render, hit, export, and renderer projection steps consume
  semantic descriptors without changing stroke rules.
- `Diagnostics`: diagnostics and visible review steps are the completion gates.
  The 2026-05-31 inside-solid slice passed only after current Asyra rule probes
  and manual app screenshot review. The current outside dashed square slice now
  passes the same evidence standard, while broader whole-engine completion
  remains guarded until the full matrix and performance gates are validated.
  Translucent self-intersecting center solid strokes also require same-paint
  alpha-overlap probes: self-crossings must match adjacent body stroke paint
  strength and must not darken through multiple visible composites.

## Diagnostic Evidence Limits

Diagnostics may keep bounded records for:

- face ownership;
- winding and occupancy;
- source span and source vertex provenance;
- adjacency classification;
- exact coverage comparison;
- rejected shortcut modes;
- probe measurements.

Diagnostics must not become visible render inputs, normal render cache
signatures, export geometry, or hit geometry unless that path is explicitly
defined as non-visible evidence. Product-visible render must stay the masked
doubled authored center stroke.

## Stroke Parameter Stage Cache Rule

Stroke parameter changes must not share one coarse geometry invalidation helper.
The renderer classifies changes through the stage dirty matrix:

- paint-only fields live under `stroke.fill` (`fill.color`, `fill.opacity`,
  `fill.kind`, `fill.gradient`) and dirty paint payload and render output only;
- display-format fields that do not change actual paint must not dirty render;
- `fill.visible` dirties render output only;
- `style` and `position` select stroke family/domain but reuse source
  path/topology;
- `width` reuses source path/topology and dash schedule, then rebuilds domain,
  terminal cap, join/miter, and downstream output;
- `dashPattern` and `dashOffset` rebuild dash schedule and downstream output
  without dirtying source topology or join shape;
- `capType` rebuilds terminal cap and downstream output; closed paths must not
  dirty dash schedule, while open path square-cap transitions may do so
  conservatively;
- `joinType` and `miterAngle` rebuild join/miter shape and downstream output
  without dirtying source path, stroke domain, dash schedule, or paint. Exact
  semantic stroke-path descriptors may treat `miterAngle` as a style replay
  when cached geometry is restyled with the current cap/join/miter values.
  Polygon product geometry that embeds miter shape must keep `miterAngle` in
  its geometry signature and rebuild.

Drag uses the same matrix. Point/handle movement dirties source path and any
derived source geometry required by the changed topology, but it must not mark
static stroke parameter revisions or paint as changed. If topology/domain
signatures cannot prove safe reuse, exact rebuild is required for correctness.

The dirty matrix is not sufficient by itself. Normal render must also keep a
`StrokePipelineStageCache`-style product cache for exact semantic descriptors:

- cache keys include element, network, source revision, and geometry-affecting
  stroke signature;
- cached final semantic descriptors may be retinted for `stroke.fill`-only
  changes and
  restyled for style-only descriptor changes; replaying an old `miterLimit`,
  cap, or join value is invalid;
- constrained dashed drag descriptors reuse resolved split/domain metadata and
  must not run source-intersection tracing as part of visible product output;
- `stroke.fill.visible:false` clears render/hit/export output through a render-output
  hidden path without rebuilding source or stroke geometry;
- diagnostics/export polygon evidence may be materialized lazily, but must not
  become a prerequisite for normal visible parameter switching;
- cache hit, miss, store, and hidden-output counters are required inspector
  evidence for static parameter switching and drag review.

## Invalid Current-Rule Sources

These sources are not valid rule authorities:

- completed plan copies;
- analysis reports;
- BDD feature files;
- viewer HTML;
- screenshots by themselves;
- old helper names or implementation branches;
- decision-history entries that predate this cleanup.

Screenshots can reopen the earliest owning inspector step, but the rule must be
written into the three authority files before implementation resumes.

## Completion Requirements

Completion requires:

- the three authority files state the same solid rule;
- old stroke specification files are removed from the docs tree;
- the inspector data labels Stroke Geometry candidate building as
  model-neutral;
- the inspector data covers the Stroke / Vector System flow from feature intent
  through Product Output and Diagnostics;
- no active status claims completion until current Asyra rule probes and
  reviewed screenshots pass;
- visual gates fail when the internal pentagon breaks into helper-like fragments
  even if shared-edge width and join-difference numeric probes pass;
- visual gates fail when translucent center solid self-intersections accumulate
  same-paint alpha overlap, even if global red coverage and route assertions
  pass;
- implementation evidence separately proves render, hit, export, diagnostics,
  reload, performance behavior, and visible screenshot consistency.
