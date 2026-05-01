# Canonical Geometry Pipeline

## Role

This file defines the canonical runtime sequence for the final stroke engine.

No implementation path may skip, merge, or reorder these stages unless this
file is updated first in the same change.

## Canonical Stages

1. `NormalizeStrokeSpec`
2. `BuildPathTopologyModel`
3. `ResolveSourceFamilies`
4. `AllocateIntervals`
5. `BuildOneSidedCandidates`
6. `PartitionArrangementAndFaces`
7. `ResolveOwnership`
8. `ApplyLegality`
9. `BuildResolvedStrokeRegions`
10. `AttachPaintPayload`
11. `BuildFinalFaces`
12. `EmitRenderHitExportPackets`

## Stage Contracts

### 1. NormalizeStrokeSpec

- input:
  - authored stroke list
  - default stroke policy
- output:
  - normalized stroke specs
  - rejection diagnostics
- invariants:
  - only valid normalized values proceed
  - width, stroke fill / paint payload, `dashPattern`, and `dashOffset` are
    normalized once here
- allowed recovery:
  - reject invalid entries
  - normalize odd dash patterns and negative offsets
- forbidden callers:
  - renderer
  - hit/export helpers
- complexity budget:
  - `O(strokeCount)`
- dirty keys:
  - stroke authored revision

### 2. BuildPathTopologyModel

- input:
  - shape/vector source data
- output:
  - canonical `PathTopologyModel`
- invariants:
  - every downstream stage sees the same topology revision
  - flattening and intersection discovery happen here, not in later packet
    stages
  - open-path simplicity (`isSimpleOpen`) and closed-path simplicity
    (`isSimpleClosed`) are classified here once per topology revision
  - legal-domain descriptors and shell/hole roles are fixed here for the current
    topology revision
  - downstream interval and candidate stages should receive view-backed topology
    access rather than copied coordinate arrays
- allowed recovery:
  - reduced preview tessellation only when preview policy says so
- forbidden callers:
  - paint
  - export-specific restroking
- complexity budget:
  - bounded by contour, segment, and configured sample counts
- dirty keys:
  - source path revision
  - preview/exact mode

Current Phase 2 checkpoint:

- shape and vector render strategies build this model before packet-family
  construction
- packet builders receive the model in product render paths; direct helper
  tests may self-build it only as an isolated input-normalization guard
- topology-family classification, legal-domain descriptors, and dash length
  basis are treated as properties of this model
- packet builders may trust `PathTopologyModel.isSimpleOpen` only when the
  authored cap policy does not mutate the open-path endpoints into a different
  topology; otherwise the lower-level geometry helper must keep its own safety
  guard

### 3. ResolveSourceFamilies

- input:
  - path-topology model
- output:
  - source family
  - topology family
  - support-family hints
- invariants:
  - shape origin and topology family are separate
  - no support decision is based only on shape name
  - compound legal-domain semantics are classified separately from contour
    orientation
- allowed recovery:
  - classify as `research-gated` if topology is unresolved
- forbidden callers:
  - raw render strategies making private shape branches
- complexity budget:
  - `O(contourCount + featureCount)`
- dirty keys:
  - path topology revision

### 4. AllocateIntervals

- input:
  - normalized stroke spec
  - path-topology model
- output:
  - interval records on canonical arc-length domain
- invariants:
  - dash semantics are allocated before geometry
  - seam-wrap continuity is preserved in interval metadata
  - the same exact topology revision yields the same committed interval schedule
    regardless of preview tessellation density
  - interval-local helpers should consume references or ranges into topology
    storage rather than duplicated spans when possible
- allowed recovery:
  - solid strokes yield one full-coverage interval
- forbidden callers:
  - constrained packet builders inventing private dash schedules
- complexity budget:
  - `O(intervalCount)`
- dirty keys:
  - path length revision
  - dash pattern revision
  - dash offset revision

Current Phase 2 checkpoint:

- dashed interval allocation goes through `allocateDashedIntervalsForTopology`
  and consumes topology length/closure state
- packet-family helpers must not maintain private path-length calculators once a
  topology model is available

### 5. BuildOneSidedCandidates

- input:
  - path-topology model
  - interval records
  - normalized stroke spec
- output:
  - one-sided candidate faces
- invariants:
  - `inside` builds inward geometry only
  - `outside` builds outward geometry only
  - `center` builds symmetric center geometry only
- allowed recovery:
  - preview-safe tessellation reduction
- forbidden callers:
  - doubled-width center-band clipping for constrained output
- complexity budget:
  - bounded per segment, per join, per cap, per visible interval
- dirty keys:
  - path topology revision
  - interval revision
  - stroke geometry revision

Current Step 6 checkpoint:

- source span ownership is computed before candidate construction by
  `buildSourceSpanGraph`
- dashed center and constrained dashed packets carry `sourceSpanIds`
- self-intersection-crossing intervals are span-split in metadata before face
  ownership, while render packet splitting is deferred to arrangement

Backend boundary:

- this stage may produce candidate descriptors without a heavy backend
- one dash interval must resolve to one visual candidate region. Implementations
  may sample a curve into many construction strips, but those strips must be
  merged into a face-level region before render, hit-test, export, or exact
  arrangement projection. Internal strip edges must never be visible product
  geometry.
- once it needs boolean offset / cleanup / arrangement, it must resolve work
  through `GeometryBackendRegistry`; product helpers must not import concrete
  backend implementations directly

Current Phase 3 checkpoint:

- constrained solid inside/outside support no longer uses doubled-width center
  packets as a product geometry route
- open product vector paths resolve authored `inside` / `outside` positions to
  center geometry. They do not enter constrained solid candidate construction
  solely because the authored stroke position changed.
- closed inside constrained solid paths clip one-sided candidates against the
  declared source legal domain before packet emission
- miter-limit exceedance is resolved inside candidate construction as bevel
  geometry while preserving exact supported runtime status
- compact outside miter/bevel emission is allowed only when it represents the
  same selected-side geometry without opposite-side construction

Current implementation checkpoint:

- constrained dashed full-loop slices reuse the constrained solid selected-side
  geometry path
- constrained dashed non-full-loop slices allocate intervals first, slice the
  source path on the canonical arc-length domain, and build one-sided geometry
  only for the visible interval
- closed inside constrained dashed interval-local packets apply legal-domain
  clipping to the one-sided candidate, not to a widened center packet
- closed inside constrained dashed interval-local packets also apply a bounded
  sharp-corner selected-side guard before render packets are emitted. The guard
  has two independent jobs:
  - intervals that start exactly at a sharp authored vertex clip only the
    interval start cap against the previous authored source segment; they must
    not clip the dash body against the next segment because that body follows
    the next segment;
  - intervals that end exactly at a sharp authored vertex clip only the interval
    end cap against the next authored source segment; they must not clip the
    dash body against the previous segment because that body follows the
    previous segment;
  - intervals that genuinely span across a sharp authored vertex clip against
    both adjacent authored source segments;
  - any interval polygon that crosses an active authored sharp-boundary edge is
    clipped by that authored edge even when the interval does not contain the
    sharp vertex.
  This prevents seam-adjacent dashes from being cut by the interval tangent/cap
  line instead of the authored closing segment while avoiding over-clipping the
  dash body on the segment it actually follows.
- every non-full-loop constrained dash packet must build its source edge from
  the authored interval polyline returned by `slicePathGeometryPoints`. Tangent
  frames may be used only to derive local normals / caps from that polyline;
  they must never replace the source edge, extend a dash body, or act as an
  authored segment boundary. For vector product paths, guards use bounded local
  polylines sliced from the authored source segments (line or cubic), not
  endpoint tangents, anchor-to-anchor chords, or sampled tangent-frame
  surrogates. Smooth anchors may only serve as adjacent segment endpoints.
- source-path constrained dash packets must preserve that authored interval
  source edge through legality handling. A closed-path legal-domain clip is not
  allowed to rebuild the dash body from clip intersections if doing so removes
  the authored interval polyline. Source-path packets use local selected-side
  guards for boundary protection; non-source-path packets may still use the
  broader closed-boundary legality clip.
- when a source-path dash polygon crosses a non-owned authored boundary
  segment, clipping must be computed as polygon-to-authored-polyline
  intersection, not as an endpoint tangent or an unconditional half-plane pass.
  Candidate choice is evaluated against the nearest sampled boundary segment so
  Bezier boundaries are treated as the curve polyline they were sampled from,
  not as one global line.
- constrained dashed packets preserve contour, legal-domain, source-topology,
  topology-family, and interval-topology metadata for downstream ownership,
  blocked diagnostics, render, hit-test, and export consumers

Current supported paint checkpoint:

- open product vector solid paths emit `solid-center` packets with
  `sourceTopology: "open"` even when the authored position is `inside` or
  `outside`
- open product vector dashed paths emit `dashed-center` packets with
  `sourceTopology: "open"` even when the authored position is `inside` or
  `outside`
- closed self-intersecting constrained dashed paths preserve authored
  `inside/outside` visibility as local-side approximation packets. Exact
  promotion remains gated until legal-domain clipping preserves valid internal
  dash regions.
- sampled-simple-closed constrained dashed interval-local packets remain
  local-side approximation while the exact arrangement oracle is gated.
- interval-local constrained dashed packets may expose multiple bounded
  segment-cell polygons inside one packet when a single merged ribbon would
  self-intersect or create fan-like overlap. This is product geometry, not debug
  strip output: cells must keep one interval/source-span ownership family, stay
  simple, and preserve paint parity without changing authored opacity.
- segment-cell polygons for one dash interval must share the same sampled
  offset boundary at adjacent source samples whenever that produces simple
  polygons. They must not independently recompute a fresh normal per cell,
  because that creates stacked stripe overlap on curved dashes. If a shared
  boundary cell becomes non-simple at an extreme turn, only that cell may fall
  back to a segment-local offset face while preserving the same interval,
  paint, and owner metadata.
- if one sampled high-curvature visible interval would form a self-intersecting
  one-sided ribbon, the interval must be represented as bounded source-ordered
  cell polygons until every emitted polygon is simple. This is a
  validity-preserving subdivision, not a fallback to center geometry.
- when authored `sourcePath` segment metadata is available, subdivision must
  happen at authored segment boundaries before high-curvature robustness splits.
  A dash interval that crosses from a line segment into a Bezier segment, or
  from one Bezier segment into another, must emit segment-local one-sided faces
  rather than one global sampled ribbon. This prevents the offset boundary of
  one segment from pulling the adjacent segment into fan-like overlap geometry.
- when a source-path segment-local face starts at an authored segment boundary,
  it must be clipped against the previous authored segment tail; when it ends at
  an authored segment boundary, it must be clipped against the next authored
  segment head. Bezier boundaries are sampled polylines for this local clip.
  This is boundary legality, not dash rescheduling.
- open dashed paths are not constrained product paths; authored
  `inside/outside` resolves to center-equivalent dashed geometry before this
  stage
- render, hit-test, and export observe the exact constrained packet metadata;
  center/native and blocked constrained states remain distinguishable at runtime

### 6. PartitionArrangementAndFaces

- input:
  - candidate faces
  - topology/intersection metadata
- output:
  - partitioned faces
  - arrangement metadata
- invariants:
  - required for self-overlap, self-intersection, and multi-owner regions
  - later stages consume face regions, not raw unpartitioned overlap soup
  - one numeric robustness policy governs crossing, tangency, snap, and
    zero-area rejection
  - exact flattening target is `0.25 px`; preview flattening ceiling is
    `min(1.0 px, strokeWidth / 4)` and may not alter support state
- allowed recovery:
  - bypass for simple non-overlapping topologies
- forbidden callers:
  - legality stage pretending arrangement work already happened
- complexity budget:
  - bounded by candidate-face count and active intersection budget
- dirty keys:
  - candidate-face revision
  - intersection revision

Current supported join/cap checkpoint:

- constrained solid overlap diagnostics publish a concrete
  `arrangementPolicy`

Current Step 7 checkpoint:

- `stroke-candidate-arrangement.ts` is the exact arrangement bridge from
  resolved packets to `CandidateRegion[]`, backend partition faces, and exact
  `FinalFace[]`.
- the bridge filters arrangement faces by typed stroke position and backend
  legal-state classification; it never falls back from `inside` / `outside` to
  center.
- exact backend promotion normalizes each input candidate with `union` before
  partitioning, so a sampled curved dash cannot self-stack opacity or expose
  internal seams.
- exact backend promotion clips arrangement faces against typed source legal
  domains with `intersection` / `difference` when those operations are
  available. Probe-point legal classification is only a fallback for
  non-clipping test backends, not an exact product path for self-intersecting or
  high-curvature constrained dashed strokes.
- same-visual candidate claims on one partitioned face merge metadata into one
  final face; different visual packet keys stay separate for later stacking.
- product runtime still requires an explicit backend-selection and promotion
  gate before local-side approximation families can claim exact arrangement
  support.
- the current shipped slice uses `bounded-convex-subset-arrangement`
- the policy declares `epsilon`, `roundingFactor`, `maxExactSubsetCount`,
  `zeroAreaThreshold`, tangential-touch behavior, and coincident-edge dedupe
- overlap-sensitive candidates emit typed `arrangementFaces` before ownership
  regions
- every arrangement face records `faceId`, participating candidate ids,
  selected owner stroke id, optional typed `ownerKey`, bounds, polygon, and
  partition method
- exact subset intersections emit
  `partitionMethod: "exact-subset-intersection"`
- budget-bounded overlap regions emit
  `partitionMethod: "bounded-overlap-polygon"` and remain diagnostic-visible

### 7. ResolveOwnership

- input:
  - partitioned faces
  - typed ownership metadata
- output:
  - ownership-classified face regions
- invariants:
  - owner identity is typed
  - no string parsing from packet ids
- allowed recovery:
  - explicit unsupported classification when product semantics are not approved
- forbidden callers:
  - renderers inferring owner from names
- complexity budget:
  - bounded by face count and owner candidate count
- dirty keys:
  - arrangement revision
  - owner-set revision

Current supported join/cap checkpoint:

- constrained solid ownership regions are derived from typed arrangement faces
- `ownedRegions` remain an adapter diagnostic projection, not the only
  source of face-level ownership truth
- owner selection is recorded on each arrangement face through `ownerStrokeId`
  and optional typed `ownerKey`
- legality and render consumers may not infer owner identity from packet order
  or `geometryId`

### 8. ApplyLegality

- input:
  - ownership-classified face regions
  - legality policy
- output:
  - legal visible face regions
  - legality diagnostics
- invariants:
  - legality acts on candidate one-sided faces only
  - legality cannot repair a wrong geometry model
  - compound closed paths evaluate legality against declared legal domains rather
    than orientation-only heuristics
- allowed recovery:
  - explicit `blocked` only when semantics say so
- forbidden callers:
  - paint or export mutating legality outcomes
- complexity budget:
  - bounded by legal-domain count and face count
- dirty keys:
  - ownership revision
  - legality-policy revision

Current Phase 3 checkpoint:

- constrained solid packet debug metadata carries contour and legal-domain ids
  through render, hit-test, and export
- legality clipping consumes constrained solid packets after selected-side
  candidate construction; paint/export/hit-test do not repair geometry

Current supported join/cap checkpoint:

- constrained solid legality clipping subtracts foreign-owned arrangement faces
  from candidate geometry
- packet grouping and overlap detection are only discovery inputs; they are not
  the final ownership truth
- legality clipping may remove already-owned face area, but it may not invent
  replacement geometry or repair a bad ownership assignment

### 9. BuildResolvedStrokeRegions

- input:
  - legal visible face regions
- output:
  - `StrokeRegionPacket[]` without paint
- invariants:
  - packet metadata must be typed and complete
  - render/hit/export parity starts here
  - semantic-region packets are the smallest product-truth unit; batching is a
    later optimization only
- allowed recovery:
  - none beyond prior explicit stage outputs
- forbidden callers:
  - render-only packet mutation
- complexity budget:
  - `O(regionCount)`
- dirty keys:
  - legality revision
  - topology/support revision

### 10. AttachPaintPayload

- input:
  - resolved stroke regions
  - normalized paint payload
- output:
  - paint-attached region packets
- invariants:
  - paint uses region bounds or declared paint space
  - paint never changes region geometry
- allowed recovery:
  - reject invalid paint payload
- forbidden callers:
  - geometry stages reading paint to alter faces
- complexity budget:
  - `O(regionCount)`
- dirty keys:
  - paint revision
  - bounds revision

### 11. BuildFinalFaces

- input:
  - paint-attached region packets or exact arrangement faces
- output:
  - `FinalFace[]`
- invariants:
  - `FinalFace[]` is the canonical source for render, hit-test, and export
    projection
  - duplicate regions collapse only when the family has exact face ownership
    and geometry plus `visualPacketKey` match
  - collapsed faces preserve typed `ownerSet`, `intervalIds`, `sourceSpanIds`,
    and `sourceContourIds`
  - same visual packet collapse must not stack opacity
  - different paint, opacity, blend, mask, clip, effect, stack, visibility, or
    stroke spec must remain separate
- allowed recovery:
  - keep visually distinct packets separate
  - mark local-side approximation explicitly when exact arrangement is not yet
    implemented for that family
- forbidden callers:
  - renderer-only collapse that discards hit/export ownership
  - exporter restroking from authored input
- complexity budget:
  - bridge path without exact collapse: `O(regionCount)`
  - exact duplicate collapse: `O(exactFaceCount * signatureCost)`
  - exact arrangement path: bounded by arrangement face count and cache keys
- dirty keys:
  - resolved region revision
  - ownership revision
  - legality revision
  - paint revision

Current Step 8 checkpoint:

- exact duplicate collapse is gated by `arrangementStatus: "exact"`,
  `resolutionStatus: "exact-constrained"`, and `runtimeStatus: "accepted"`.
- local-side approximation packets do not collapse even when a caller requests
  duplicate collapse.
- exact arrangement output calls `collapseExactDuplicateFinalFaces` after
  backend face conversion.

### 12. EmitRenderHitExportPackets

- input:
  - `FinalFace[]`
- output:
  - render packets
  - hit packets
  - export packets
- invariants:
  - all outputs share the same final face geometry family
  - specialization is payload-level, not geometry-level
  - render/export batching may group semantic packets, but it may not erase
    packet-level semantic truth
  - packet-level metadata must carry the final geometry lifecycle state:
    native center, exact constrained, or blocked diagnostics for constrained
    requests that cannot emit product geometry
  - blocked constrained requests must keep the typed reason in diagnostics;
    render/hit/export packets must not pretend blocked geometry exists
- allowed recovery:
  - none
- forbidden callers:
  - exporter or hit-testing restroking from authored spec
- complexity budget:
  - `O(regionCount)`
- dirty keys:
  - region revision
  - output payload revision

## Cross-Stage Rules

- no stage may silently repair an earlier-stage contract violation
- every support or blocked outcome must be typed and testable
- every stage must document its own dirty dependencies
- preview mode may reduce numeric density, but it may not change:
  - topology family
  - support state
  - ownership state
  - legality state
- preview mode must therefore inherit the exact topology graph and committed
  interval schedule for the same source revision whenever exact support is
  claimed for that family
- every stage that materializes geometry must justify why a view-backed form was
  insufficient
