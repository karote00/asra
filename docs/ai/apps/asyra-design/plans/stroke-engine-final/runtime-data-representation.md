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
- one semantic region has a typed `networkId` / source key when it originates
  from a vector network
- one semantic region has exactly one support or blocked classification
- one semantic region belongs to exactly one legal domain context

### 6. Emission Layer

Canonical objects:

- `StrokeRegionPacket`
- `StrokeEmissionBatch`

Meaning:

- `StrokeRegionPacket` is the canonical semantic packet consumed by render,
  hit-test, and export
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
  render/hit/export path must keep that constrained side and may emit
  deterministic local-side approximation packets marked
  `resolutionStatus: "local-side-approximation"`.
- center-derived substitute packets are not allowed for closed authored
  `inside/outside` constrained product output. For open paths, center-equivalent
  geometry is canonical product behavior even when the authored stroke position
  is `inside` or `outside`.
- center packet metadata may be used as the internal equivalent of Figma's
  center-based `strokeGeometry` view. It is not an oracle for closed
  inside/outside product geometry; closed constrained appearance must come from
  resolved stroke packets or outline-style geometry.
- self-intersecting constrained dashed `inside/outside` packets are currently
  local-side approximation product geometry, not exact arrangement geometry.
  The runtime must preserve `sourceTopology: "self-intersecting"` so opacity,
  gradient, image paint, hit-test, and export reviewers can distinguish this
  supported visibility slice from future exact legal-domain face arrangement.

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
