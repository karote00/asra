# Runtime Data Representation And Emission Model

## Role

This file defines the canonical runtime representation contract for the final
stroke engine.

It exists to prevent a correct stage architecture from becoming inefficient due
to repeated data reshaping, accidental materialization, or over-fragmented
packet output.

## Core Rule

The final stroke engine must distinguish between:

- semantic geometry units
- emitted payload units

The engine must not assume these are the same object or the same granularity.

## Representation Layers

### 1. Source Topology Layer

Canonical object:

- `PathTopologyModel`

Required source semantics:

- `fillRule: "evenodd" | "nonzero"` is stored on the topology model and copied
  into legal-domain descriptors.
- Missing legacy vector data defaults to `evenodd` during source normalization.
- `fillRule` is topology-revision significant; paint-only changes must not
  rebuild topology, but source fill-rule changes must invalidate legal-domain
  consumers.

Allowed ownership:

- immutable for one committed source revision
- shared by interval allocation, candidate construction, arrangement,
  hit-testing, export, diagnostics, and preview

Allowed shape:

- view-backed references to contour, segment, vertex, sample, and
  intersection storage

Forbidden:

- per-helper deep copies of segment/sample arrays
- shape-family-specific re-flattening that produces private topology objects

### 2. Interval Layer

Canonical object:

- `StrokeIntervalRecord`

Required behavior:

- references topology by stable ids or view ranges
- stores committed interval semantics once
- does not duplicate source coordinates unless an explicit snapshot is required

Preferred representation:

- `[startSampleIndex, endSampleIndex]`
- seam-wrap descriptors
- contour/network references
- committed arc-length boundaries

### 2A. Source Span Layer

Canonical object:

- `SourceSpanGraph`

Current implementation entrypoint:

- `packages/preset/src/components/stroke-render/source-span-graph.ts`

Required behavior:

- splits the committed topology into source spans before candidate ownership
- records cuts from topology vertices, dash interval boundaries, and discovered
  self-intersections on the current flattened topology
- exposes `sourceSpanIds` for each dash interval
- supports seam-wrapping intervals by collecting spans on both sides of the seam

Current migration rule:

- dashed center and constrained dashed packet metadata carry `sourceSpanIds`
- the `FinalFace[]` bridge preserves `sourceSpanIds`
- Step 7, not Step 6, is responsible for turning span-aware intervals into
  arrangement-split final faces

### 3. Candidate-Face Layer

Canonical object:

- `StrokeCandidateFace`

Required behavior:

- geometry is derived from topology and intervals
- face records may reference shared source spans and local offset descriptors
- candidate layers may remain partially symbolic until exact polygon material
  is required

Allowed lazy behavior:

- deferred polygon realization
- deferred triangulation
- deferred bounds realization

Forbidden:

- eagerly materializing every intermediate polygon for every helper
- converting all candidates into render-ready vertex buffers before ownership
  and legality are known

### 4. Partitioned-Face Layer

Canonical object:

- `PartitionedFaceRegion`

Required behavior:

- arrangement produces explicit face identities
- ownership and legality attach to partitioned faces, not to packet groups
- partition output may reuse edge/vertex storage from candidate geometry where
  possible

### 5. Semantic Region Layer

Canonical object:

- `StrokeSemanticRegion`

Meaning:

- the smallest geometry unit that carries final semantic truth for one owned,
  legal, support-classified visible region

Required properties:

- one semantic region has exactly one `ownerKey`
- if exact face collapse merges multiple equivalent owners into one visible
  region, the semantic region carries `ownerSet: string[]` while `ownerKey`
  remains the deterministic primary owner for stable ordering
- one semantic region has a typed `networkId` / source key when it originates
  from a vector network
- one semantic region has exactly one support or blocked classification
- one semantic region belongs to exactly one legal domain context

### 6. Emission Layer

Canonical objects:

- `StrokeRegionPacket`
- `FinalFace`
- `StrokeEmissionBatch`

Meaning:

- `StrokeRegionPacket` is the canonical semantic packet consumed by render,
  hit-test, and export
- `FinalFace` is the next exact-engine canonical face contract. During
  migration, existing resolved stroke packets may be converted into
  `FinalFace[]`; after exact arrangement lands, render, hit-test, and export
  must project from `FinalFace[]` directly.
- `StrokeEmissionBatch` is an output-optimization grouping that may combine
  multiple semantic packets when and only when semantics remain unchanged

Current implementation checkpoint:

- center solid, center dashed, constrained solid, and constrained dashed packets
  attach typed `ownerKey` / `networkId` metadata when the source family can
  provide it
- emitted packet metadata includes `sourcePathId` and numeric `strokeIndex` so
  downstream render, hit-test, export, diagnostics, and tests never need to split
  `geometryId` or `strokeId` strings to recover source identity
- emitted packets also attach typed geometry lifecycle metadata:
  `geometryFamily`, `resolutionStatus`, `runtimeStatus`, `runtimeReason`,
  optional `sourceTopology`, optional `intervalTopology`, optional
  `ownershipStatus`, and optional `ownerCount`
- `PathTopologyModel` owns reusable open/closed simplicity metadata
  (`isSimpleOpen` / `isSimpleClosed`); product packet builders must consume that
  metadata instead of repeating self-intersection scans in every family
- render, hit-test, and export packets preserve the same `debugMeta` object
  reference as the resolved geometry packet
- center dashed overlap candidates read owner/network/interval identity from
  typed metadata rather than parsing `geometryId`
- product-path tests assert geometry family, stroke identity, interval identity,
  resolution status, and runtime status from typed metadata rather than
  `geometryId` string structure
- center dashed overlap ownership diagnostics preserve `ownerKey` / `networkId`
  on owned regions, and unresolved bailouts preserve the affected owner keys
- constrained solid ownership diagnostics preserve numeric `ownerStrokeIndex`
  when typed packet metadata provides it; debug render layers must use that
  field instead of splitting `strokeId`
- a constrained dashed candidate starts as `runtimeStatus: candidate`; it must
  be advanced to `accepted` before product render/hit/export emission
- unsupported exact constrained dashed arrangement must not make the object
  disappear. If the authored stroke is `inside` or `outside`, the product
  render/hit/export path must keep that constrained side. For self-intersecting
  closed paths, the side source is the even-odd legal-region boundary contour
  model; authored-side local-side approximation is not the support contract.
- center-derived substitute packets are not allowed for closed authored
  `inside/outside` constrained product output. For open paths, center-equivalent
  geometry is canonical product behavior even when the authored stroke position
  is `inside` or `outside`.
- center packet metadata may be used as the internal equivalent of Figma's
  center-based `strokeGeometry` view. It is not an oracle for closed
  inside/outside product geometry; closed constrained appearance must come from
  resolved stroke packets or outline-style geometry.
- self-intersecting constrained dashed `inside/outside` packets are represented
  as boundary-contour product geometry. Packet metadata must preserve contour
  id, source provenance, legal-side face id, opposite-face id, interval id, and
  stroke ownership so render, hit-test, export, diagnostics, and future shadow
  projection consume the same contour truth.
- sampled-simple-closed constrained dashed interval-local packets follow the
  same rule: with a selected exact backend they may promote to exact
  arrangement metadata; without it they remain local-side approximation. Real
  Clipper2-backed fixtures now prove overlapping-candidate partitioning,
  backend promotion, and side-specific inside/outside signatures for this path.
  Full-loop sampled constrained packets may remain exact only when candidate
  cleanup has normalized each visible dash into a face-level region.
- first `FinalFace[]` bridge implementation exists in
  `packages/preset/src/components/stroke-render/stroke-final-face.ts`.
  It converts resolved stroke packets into canonical face records, preserves
  typed owner metadata, and collapses exact duplicate geometry only when visual
  packet identity matches.
- vector runtime uses a combined `strokeFinalFaces` array as the render /
  hit-test / export source. Promoted exact arrangement faces enter this array
  directly; non-exact resolved packets are converted once into faces for the
  same pass.

## FinalFace Contract

`FinalFace[]` is the exact-engine target contract.

Minimum fields:

- `faceId`
- `sourceGeometryIds`
- `polygons` or future lazy region descriptor
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

`FinalFace` invariants:

- render, hit-test, and export projections must use the same `FinalFace[]`
  source
- duplicate faces may collapse only when exact face ownership is proven and
  final face geometry plus `visualPacketKey` match
- same visual packet collapse must not multiply opacity and must not remove
  coverage; for a point covered by `N` same-visual faces, product coverage is
  exactly one layer
- `strokeDebugOptions.disableVisualOverlapCollapse === true` may bypass
  same-visual overlap collapse for geometry inspection only. This is a
  diagnostic switch, not product semantics; default render / hit-test / export
  must keep collapse enabled and must continue to share the same product
  `FinalFace[]` source.
- The Asyra Design toolbar exposes the same diagnostic behavior through the
  runtime system property `strokeDebugDisableVisualOverlapCollapse`. This
  property is global, runtime-only, and must not be serialized into authored
  vector geometry or stroke payloads.
- Because the property is global, automated visual tests must explicitly keep it
  off for product assertions. A test that needs raw-overlap inspection must turn
  it on only for that local diagnostic step and must restore it to `false`
  before continuing or exiting.
- different paint, opacity, blend mode, mask, effect, clip context, stacking
  group, visibility state, or stroke spec must remain separate
- collapsed faces must preserve all owners through `ownerSet`; no helper may
  parse `geometryId` to recover ownership
- visual export may emit merged `FinalFace[]` projections; editable/internal
  export may preserve network-separated owner metadata

Current Step 8 implementation:

- duplicate collapse is guarded by `arrangementStatus: "exact"`,
  `resolutionStatus: "exact-constrained"`, and `runtimeStatus: "accepted"`.
- local-side approximation packets remain separate even if a bridge caller asks
  for `collapseDuplicateFaces: true`.
- `collapseExactDuplicateFinalFaces` collapses exact faces by geometry
  signature and `visualPacketKey`; it preserves owner, interval, source-span,
  source-contour, and legal-domain metadata.

`visualPacketKey` must represent the visual stacking identity of a face. It is
not an owner key. It must include or be derived from:

- paint payload
- opacity
- blend mode
- effect context
- mask / clip context
- stroke spec
- stacking group
- visibility state
- runtime geometry family compatibility

Current bridge implementation:

- `StrokeFinalFaceDebugMetaBase.visualContext` may provide explicit visual
  identity overrides
- when source data has no visual context yet, bridge code writes deterministic
  placeholders:
  - blend mode: `normal`
  - effect context: `effect:none`
  - mask context: `mask:none`
  - clip context: `clip:none`
  - stacking group: `stack:default`
- placeholders are part of `visualPacketKey`; they are not ignored. Future
  product data that introduces real blend/mask/clip/effect/stack values must
  replace these placeholders through typed metadata before exact duplicate
  collapse is enabled.

`FinalFace` migration rule:

- existing bridge packets may feed `FinalFace[]`
- new exact arrangement code must emit `FinalFace[]` as its primary output
- once a family emits `FinalFace[]`, downstream render, hit-test, and export
  must not re-run stroke geometry from raw authored input

## GeometryBackend Adapter Contract

Exact boolean, offset, and arrangement work must run through a backend adapter.

Current checkpoint:

- `packages/preset/src/components/stroke-render/geometry-backend.ts` defines the
  `GeometryBackend` interface and an unsupported backend that throws explicit
  errors instead of returning silent empty geometry.
- every backend must expose `backendId`, `backendVersion`, boolean capability
  metadata for `union` / `difference` / `intersection` / `offset` /
  `buildArrangement`, and a deterministic coordinate policy before it can be
  resolved.
- the coordinate policy fixes model-space float to integer-backend conversion:
  default scale is `1_000_000`, rounding is `round`, signed zero is normalized
  to `0`, non-finite values fail fast, and coordinates outside the safe integer
  scaling range are rejected before backend calls.
- `getGeometryBackendCacheSignature` combines backend id, backend version,
  scale, rounding, and epsilon. Exact geometry cache keys must include this
  signature whenever backend output can affect topology or final face geometry.
- the same file defines `GeometryBackendRegistry` and
  `GeometryBackendRegistration` for exact backend registration, active backend
  selection, and lazy backend resolution.
- the default registry always contains
  `unsupported-exact-geometry-backend`; selecting any other backend requires an
  explicit registration.
- registered backends are loaded only when resolved. A registration whose loaded
  backend id differs from the declared id, lacks a version, lacks a supported
  coordinate policy, or exposes malformed capability metadata is invalid and
  must fail fast.
- bridge conversion into `FinalFace[]` preserves existing packet cardinality by
  default; duplicate-region collapse must be explicitly requested by an exact
  arrangement or face-collapse phase. This prevents migration code from changing
  current render/hit/export behavior before exact ownership semantics are fully
  active.
- `packages/preset/src/components/stroke-render/stroke-candidate-arrangement.ts`
  defines the Step 7 exact bridge:
  - resolved packets -> `FinalFace[]` bridge faces
  - bridge faces -> typed `CandidateRegion[]`
  - backend `ArrangementFace[]` -> exact `FinalFace[]`
- arrangement final faces carry `arrangementStatus`, `arrangementFaceId`,
  `arrangementCandidateIds`, and `arrangementLegalState` so render, hit-test,
  export, and diagnostics can trace the exact face partition.
- hit-test and export projections must carry `primaryOwner`, `ownerSet`,
  `intervalIds`, `sourceSpanIds`, `sourceContourIds`, and `legalDomainIds`
  directly from `FinalFace[]`. They must not reconstruct ownership from
  geometry ids.
- render, hit-test, and export projections may use different output structures,
  but they must share the same `FinalFace[]` source and preserve the same final
  geometry ids for merged faces.
- non-vector product runtime may temporarily project exact arranged
  `FinalFace[]` back into existing resolved packet structures while legacy
  consumers are being removed. This compatibility projection is allowed only
  when packet geometry, debug metadata, ownerSet-derived projections, hit-test
  data, and export data all originate from the same exact `FinalFace[]`
  records.
- exact compatibility packets, where still used, must carry typed `ownerSet`,
  `intervalIds`, `sourceSpanIds`, `sourceContourIds`, and `legalDomainIds` in
  debug metadata. Any downstream bridge that rebuilds `FinalFace[]` from these
  packets must restore the full sets instead of deriving a single owner from
  primary packet fields.
- when no exact backend is selected, non-self-intersecting constrained dashed
  product output may remain an explicitly marked `local-side-approximation`;
  it must preserve the authored `inside` / `outside` side and must not fallback
  to center. Self-intersecting constrained dashed `inside/outside` output must
  use the boundary-contour model before support can be claimed.
- local-side constrained dashed interval output emits one packet per dash
  interval. The packet may contain multiple bounded segment-cell polygons when
  a merged ribbon would self-intersect at high curvature. These cells are
  canonical visible geometry for the local-side family, carry shared interval
  metadata, and must not be split into separate paint packets that multiply
  opacity.
- adjacent segment-cell polygons inside the same dash interval should share
  sampled source and offset-boundary vertices, so curved dashes join as one
  continuous local-side face family instead of a stack of independent normal
  strips. A non-simple shared-boundary cell may use a segment-local offset
  fallback only for that cell; the packet still remains one interval with one
  paint payload.
- source-path segment-local cells that touch authored segment boundaries carry
  boundary-legality clipping against the adjacent authored segment tail/head.
  The clipped result remains canonical product geometry for render, hit-test,
  and export projections.
- arrangement classification keeps authored side semantics:
  - `inside` accepts only faces where `insideFillDomain` is true
  - `outside` accepts only faces where `outsideFillDomain` is true
  - `center` accepts all partitioned faces
- exact arrangement output groups claims by `visualPacketKey`; same-visual
  claims merge metadata into one final face, while different visual packet keys
  stay separate and preserve normal stacking. Same-visual union treats inputs as
  coverage, not shell/hole contour roles, so opposite winding cannot erase the
  product face.
- `packages/preset/src/components/stroke-render/clipper2-geometry-backend.ts`
  wraps `clipper2-wasm@0.2.1` as a concrete backend for boolean operations and
  offsetting. This adapter is a backend module only; product helpers must keep
  depending on `GeometryBackend`.
- `loadClipper2GeometryBackend` and `loadAndRegisterClipper2GeometryBackend`
  provide the async WASM preload path. Browser/runtime loading must use the
  bundler-resolved `clipper2z.wasm?url` asset through `locateFile`; fetching a
  package-relative `.wasm` path is invalid because dev servers may return HTML
  instead of `application/wasm`.
- `enableDefaultExactGeometryBackend` is the root-safe bootstrap. It uses a
  dynamic import, registers and selects Clipper2 asynchronously, and may be
  called by app initialization without making render helpers await WASM.
- app startup must await the default exact backend bootstrap before
  `core.start()` when possible. This prevents an initial local render followed
  by a backend-selected second render that changes product geometry after page
  load.
- selecting a different active geometry backend is a render invalidation event.
  Preset render subscriptions must reload the render scene tree when backend
  selection changes so already-loaded vectors are recomputed with the selected
  exact backend instead of staying on pre-backend local approximation.
- synchronous product geometry helpers must never initialize WASM on demand.
  Before the async backend is ready, constrained dashed output remains authored
  side local approximation; after the backend is selected, accepted packets may
  promote through exact arrangement.
- the Clipper2 adapter implements `buildArrangement` by incrementally
  partitioning candidate regions with backend `intersection` and `difference`.
  Output faces are disjoint and preserve every contributing candidate claim.
- before partitioning, `buildArrangement` normalizes each candidate with backend
  `union`. This is required because a single dash interval may be constructed
  from many sampled strip pieces; product arrangement must see one candidate
  region, not many visible strip faces.
- Clipper2 backend operations use bounded per-backend result caches for
  `union`, `difference`, `intersection`, `offset`, and `buildArrangement`.
  Cache keys are derived from operation kind, fill rule, offset options,
  candidate ids, visual packet keys, stroke positions, and deterministic input
  geometry.
- cached backend geometry is cloned before it is returned. Arrangement cache
  hits rebuild `claimedBy` from the current typed `CandidateRegion` objects by
  candidate id, so stale owner objects cannot leak across calls.
- arrangement legal state from the backend is only partition metadata. Product
  inside/outside filtering must use typed source legal domains before converting
  arrangement faces to exact `FinalFace[]`.
- when the selected backend supports `union`, `intersection`, and `difference`,
  legal-domain classification clips each arrangement face into inside and
  outside regions geometrically. Sampler-only legal classification is a fallback
  for non-clipping test backends and must not be treated as exact product
  support for self-intersecting or high-curvature constrained dashed output.

Required operations:

- `union`
- `difference`
- `intersection`
- `offset`
- `buildArrangement`

Backend rules:

- the adapter may be backed by Clipper2-like WASM, another robust polygon
  backend, or a future native implementation
- product helpers may request exact boolean / offset / arrangement work only
  through the selected registry backend; direct imports of a concrete backend
  are forbidden outside backend registration modules
- backend output cannot be accepted as product geometry until Asyra attaches
  `FinalFace` owner, interval, source-span, legal-domain, paint, and visual
  packet metadata
- missing backend support must fail loudly in tests or diagnostics; it must not
  fall back to center strokes or empty render output
- concrete backend wrappers must use the shared coordinate mapper instead of
  implementing local scaling, rounding, epsilon, or signed-zero behavior.
- role-level legal-domain normalization must use geometric union semantics:
  `union(shells, nonzero)`, `union(holes, nonzero)`, then
  `difference(shells, holes, nonzero)`. Source fill rule is used to classify
  source topology, not to toggle overlapping same-role regions during union.

## Normalized Legal Domain Contract

Canonical object:

- `NormalizedLegalDomain`

Current implementation entrypoint:

- `packages/preset/src/components/stroke-render/legal-domain-normalization.ts`

Required fields:

- `legalDomainId`
- `fillRule`
- `mode: "containment-depth" | "backend-boolean"`
- `regions`
- `boundarySpans`
- `classifications`

Boundary span requirements:

- every span has a deterministic seam point
- containment-only spans use topmost-leftmost seam selection on the source
  contour
- every span carries `sourceContourIds`
- current implementation attaches committed `SourceSpanGraph` ids as
  `sourceSpanIds`

Current support:

- containment-only compound paths normalize without a heavy backend
- overlapping holes require backend boolean normalization. With a selected exact
  backend that supports `union` and `difference`, vector product runtime passes
  that backend into normalization and emits one shared legal-domain metadata
  context. Without that backend, product shared compound support remains blocked
  and raw networks stay separate.
- backend-backed normalization must compute
  `union(shells, nonzero) -> union(holes, nonzero) ->
  difference(shells, holes, nonzero)` before product dash allocation can use
  normalized legal boundaries

Forbidden:

- assigning a shared compound `legalDomainId` when normalization is blocked
- using raw overlapping hole contours as exact product dash boundaries
- silently returning empty regions when backend normalization is unavailable

## Stroke Paint Payload Model

Stroke color is represented as a paint payload attached to resolved stroke
geometry.

Canonical naming:

- a stroke may carry `fill` / paint payload data for its visible stroke region
- solid, gradient, image, video, or pattern paint must use the same paint model
  family as layer fills where possible
- legacy wording such as `kind` is implementation detail only and must not be
  used by geometry helpers to decide shape output

Canonical dash naming:

- `dashPattern: number[]`
- `dashOffset: number`

Canonical miter naming:

- authored UI/API field: `miterAngle`
- render helper field: `miterLimit`
- normalization rule: `miterLimit = 1 / sin(miterAngle / 2)`
- `miterAngle = 0` normalizes to infinite miter limit and must not silently
  reset to the default `28.96` degree threshold

Legacy `dash` and `gap` are not runtime geometry inputs. If they appear in old
serialized data, migration must convert them before render normalization; the
stroke renderer must not silently reconstruct geometry from them.

Open dashed placement metadata:

- `dashPlacementMode: "arc-length-pattern"` marks all open and closed dashed
  paths that use the repeated authored dash pattern on the canonical
  arc-length basis.
- Figma-style segment-local endpoint balancing and half-length endpoint dashes
  are documented divergences and must not be emitted by the product runtime.

### 7. Runtime Diagnostics Layer

Canonical objects:

- `StrokeRuntimeStatusDiagnostic`
- `StrokeRuntimeDiagnosticsBatch`

Meaning:

- runtime diagnostics expose `accepted` and `blocked` decisions as typed data
- diagnostics are attached next to the emitted geometry family, not inferred
  from renderer output
- diagnostics are test inputs for support-state parity, blocked-state audits,
  and migration gates
- arrangement-heavy diagnostics are optional lazy payloads; runtime status
  diagnostics must not force arrangement construction during normal product
  rendering

Required properties:

- `sourceId`
- optional `networkId`
- `sourceTopology`
- `status`
- `reason`
- `candidatePacketCount`
- ownership classification with typed `ownerKey[]` when the family performs
  ownership classification

Ownership diagnostics must preserve typed `ownerKey` for both vector networks
and primitive shape sources. `strokeId` may remain as a stable local stroke
index, but it is not enough to identify ownership across source families.

Required behavior:

- constrained dashed diagnostics are emitted only when the authored stroke set
  contains a constrained dashed intent
- constrained solid diagnostics are emitted only when the authored stroke set
  contains a constrained solid intent
- diagnostics must be cleared when a reused render object no longer has the
  matching constrained intent; stale blocked state is a correctness bug
- multi-network vectors classify runtime support per network first
- disjoint accepted networks remain accepted independently
- overlapping or shared-face ownership remains gated until face-level ownership
  is specified
- diagnostics may reference candidate packet counts, but may not turn candidate
  packets into product geometry

Forbidden:

- parsing `geometryId` to explain runtime support state
- treating an empty render output as the only proof of `blocked`
- treating global multi-owner classification as a reason to block disjoint
  per-network accepted geometry
- emitting product render/hit/export packets whose support or blocked state can
  only be recovered from a separate diagnostics side-channel

## Semantic Packet vs Emission Batch

### `StrokeRegionPacket`

This remains the source of semantic truth.

It must preserve:

- owner identity
- network/source identity
- legality status
- support or blocked status
- topology family
- interval identity or full-solid identity
- exact region geometry

### `StrokeEmissionBatch`

This is a transport and performance object, not a semantic authority.

It may group multiple semantic packets only if all are true:

- same paint payload compatibility
- same support or blocked status
- same owner visibility contract for the target consumer
- same geometry-family compatibility for the target emitter
- grouping does not erase packet-level hit/export traceability

Forbidden batching:

- merging packets with different `ownerKey` when the consumer needs owner-level
  diagnostics or hit-testing
- merging exact and substitute geometry into one opaque output object
- grouping that requires re-stroking or recomputing geometry from authored input

## View And Materialization Rules

The engine must define which objects are:

- views
- immutable snapshots
- lazily materialized geometry
- consumer-specific emitted payloads

Default rule:

- topology, intervals, and semantic metadata should prefer view-backed
  structures
- polygon realization should occur only when a downstream stage truly requires
  concrete face geometry
- triangulation should occur only at emission or explicit geometry-validation
  boundaries

Every helper touching geometry must declare one of:

- returns view only
- returns lazy geometry descriptor
- returns materialized geometry

## Zero-Copy Preference Rule

The engine should prefer stable references over array copying for:

- contour lists
- segment lists
- sample spans
- interval-local slices
- ownership metadata
- revision metadata

Materialization is justified only when:

- arrangement requires explicit split geometry
- legality requires concrete region clipping
- renderer/exporter requires finalized vertex payloads
- diagnostics explicitly request full realized geometry

## Conversion Budget Rule

No stage may introduce an undocumented representation conversion.

Every conversion must declare:

- source representation
- target representation
- why conversion is required
- whether it is one-time per revision or repeated per frame

The implementation must treat repeated representation conversion as a
performance bug unless documented otherwise.

Current implementation checkpoint:

- constrained dashed packet construction creates the topology-backed interval
  frame representation once per stroke, then slices visible intervals from that
  shared representation instead of remapping topology points for every visible
  interval
- constrained dashed packet construction computes the source-direction adjusted
  interval stroke once per stroke and reuses it for all visible intervals in
  that packet family
- constrained dashed packet construction reuses runtime revision sets within
  the same stroke build by typed classification key; repeated visible intervals
  must not force repeated source path / stroke spec / interval-signature hashing
- render cache reuse checks stroke revision metadata before materializing
  polygon signatures or normalized geometry models; unchanged geometry/paint
  revisions must not force CPU-side model conversion

## Bounds And Signature Rule

Bounds and geometry signatures must be attached at the earliest stable stage
that can compute them without forcing unnecessary realization.

Preferred order:

1. topology-level bounds for source invalidation
2. semantic-region bounds for legality, paint, and hit
3. emission-batch bounds for renderer submission

The renderer must not become the first place where region bounds exist.

## Consumer Responsibilities

### Render

- consumes semantic packets or emission batches
- may batch payloads
- may not invent geometry

### Hit-Test

- consumes semantic packets
- may use accelerator structures
- may not simplify to unrelated proxy geometry

### Export

- consumes semantic packets
- may serialize batched output
- may not restroke from authored source

### Diagnostics

- may inspect any layer
- may not upgrade diagnostic geometry into product geometry

## Success Criteria

The representation model is only considered complete when:

- topology and interval stages can run without repeated deep copying
- candidate construction can pass span references instead of materialized
  polygons by default
- final semantics are preserved at the semantic-region layer
- render optimization happens through emission batches, not through semantic
  packet erosion
- performance profiling can attribute costs to explicit conversions
