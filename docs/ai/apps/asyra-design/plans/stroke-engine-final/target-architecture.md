# Target Architecture: Final Stroke Engine

## Goal

Build one geometry-first stroke engine that is stable enough for a professional
design tool and efficient enough for real-time editing and future animation.

The final engine must support:

- one canonical authored stroke model
- one canonical path-topology model
- one canonical interval-allocation model
- one canonical ownership and legality model
- one canonical resolved-region packet family
- one render/hit/export parity route
- one dirty-graph and cache policy

## Global Architecture Rule

The system must always resolve work in this order:

1. geometry existence
2. legality and ownership
3. resolved visible regions
4. paint payload
5. renderer/export/hit output

Paint never decides geometry.

This applies equally to:

- fill
- stroke
- shadow

## Authoring Model

### Authored Stroke Spec

The authored stroke model must remain expressive enough for future expansion.

Required authored axes:

- style: `solid | dashed`
- position: `center | inside | outside`
- width mode: `uniform | profile`
- join: `miter | bevel | round`
- cap: `butt | square | round`
- miter limit
- stroke fill / paint payload:
  - kind: `solid | gradient | image | video | pattern` where supported
  - opacity
- paint space / transform
- `dashPattern` / `dashOffset`

The final package does not require the runtime to ship all future features at
once, but it does require the authored model to remain extensible enough that
later rollout does not force a contract reset.

## Path Model

### PathTopologyModel

All downstream stroke stages consume a canonical path-topology object rather
than raw ad hoc point lists.

Required contents:

- `pathId`
- `sourceId`
- `networkId`
- `contours`
- `isClosed`
- `isSimple`
- `isSelfIntersecting`
- `orientation`
- `arcLength`
- `segments`
- `samples`
- `vertexDescriptors`
- `intersectionDescriptors`
- `sourceFamily`
- `topologyFamily`
- `revision`

Required contour-level contents:

- contour id
- contour orientation
- contour role: `shell | hole | open`
- contour length
- contour closed/open flag
- contour nesting depth
- contour legal-domain id
- contour vertex list
- contour segment list
- contour sample list
- contour curvature hints

Required topology-domain contents:

- declared fill-rule basis for legal-domain construction
- legal-domain descriptors for compound closed paths
- stable shell/hole assignment
- contour-to-domain ownership mapping

### Normative Schema Expectations

The final package treats `PathTopologyModel` and `StrokeRegionPacket` as schema
contracts, not as informal field checklists.

At minimum, implementations must preserve these invariants:

- one `PathTopologyModel` describes one source revision and one network revision
- one contour belongs to exactly one `networkId`
- one contour has exactly one `role`
- one closed contour has exactly one `legalDomainId`
- every `intersectionDescriptor` references stable contour/segment identities
- every sample references a monotonic arc-length coordinate on the canonical
  length basis
- every `ownerKey` is typed and stable for the lifetime of the region packet
- every `revisionKeys` object is decomposed by stage rather than stored as one
  opaque string

Required schema-level fields for `PathTopologyModel`:

- `pathId: string`
- `sourceId: string`
- `networkId: string`
- `revision: string`
- `sourceFamily: SourceFamily`
- `topologyFamily: TopologyFamily`
- `fillRuleBasis: "nonzero" | "evenodd" | "declared-app-policy"`
- `canonicalLengthBasis: "arc-length-on-topology"`
- `contours: ContourTopology[]`
- `intersectionDescriptors: IntersectionDescriptor[]`
- `legalDomains: LegalDomainDescriptor[]`

Required schema-level fields for `ContourTopology`:

- `contourId: string`
- `role: "shell" | "hole" | "open"`
- `networkId: string`
- `orientation: "cw" | "ccw" | "none-for-open"`
- `isClosed: boolean`
- `nestingDepth: number`
- `legalDomainId: string | null`
- `arcLength: number`
- `vertices: VertexDescriptor[]`
- `segments: SegmentDescriptor[]`
- `samples: SampleDescriptor[]`

Required schema-level fields for `StrokeRegionPacket`:

- `packetId: string`
- `strokeId: string`
- `ownerKey: OwnerKey`
- `sourceId: string`
- `networkId: string`
- `contourId: string`
- `intervalId: string | null`
- `legalDomainId: string | null`
- `sourceFamily: SourceFamily`
- `topologyFamily: TopologyFamily`
- `position: StrokePosition`
- `style: StrokeStyle`
- `join: StrokeJoin`
- `cap: StrokeCap`
- `legalityStatus: LegalityStatus`
- `blockedStatus: BlockedStatus`
- `regionGeometry: RegionGeometry`
- `bounds: Bounds2D`
- `revisionKeys: StageRevisionMap`

Forbidden schema shortcuts:

- storing topology-family decisions only in comments or tests
- overloading `packetId` or `geometryId` with ownership semantics
- omitting `legalDomainId` for compound closed paths
- letting two different stage revisions collapse into one opaque cache token

This model must be reusable by:

- center stroke packets
- constrained stroke packets
- dashed interval allocation
- hit-testing
- export
- diagnostics
- animation previews

Current Phase 2 implementation checkpoint:

- `PathTopologyModel` exists in
  `packages/preset/src/components/stroke-render/path-topology-model.ts`
- rectangle, oval, and vector render paths create and share the topology object
  with stroke packet builders
- constrained dashed topology support classification consumes the shared
  topology family instead of recomputing shape-specific source classification
- compound closed legal-domain classification has an explicit containment-depth
  helper; orientation-only hole inference remains forbidden
- the compound product slice supports constrained solid and constrained dashed
  containment-only vectors; packets share a compound legal-domain id, and
  odd-depth hole contours invert selected side before one-sided geometry is
  emitted

Current Phase 3 implementation checkpoint:

- constrained solid packets now preserve typed contour/legal-domain/topology
  metadata through render, hit-test, and export packet derivation
- constrained solid exact output keeps `runtimeStatus: accepted` when a miter
  join exceeds the limit and resolves to bevel geometry
- inside constrained solid geometry is clipped against the source legal domain
  before emission; paint, hit-test, and export do not repair geometry

Current implementation checkpoint:

- constrained dashed packets preserve the same typed metadata family plus
  interval identity and interval topology
- constrained dashed runtime classification consumes candidate packet metadata
  and explicit ownership state; render strategies decide accepted or blocked
  status from typed diagnostics, not geometry id parsing
- supported interval-local constrained dashed geometry is built from the visible
  interval slice and selected side before paint is attached

Current supported join/cap implementation checkpoint:

- constrained solid ownership diagnostics now publish an explicit
  `arrangementPolicy` and typed `arrangementFaces`
- the current arrangement slice is
  `bounded-convex-subset-arrangement` with declared epsilon, rounding,
  max-exact-subset, zero-area, tangential-touch, and coincident-edge policies
- `arrangementFaces` carry face id, candidate ids, selected owner stroke,
  optional typed owner key, bounds, polygon, and partition method before
  adapter-only `ownedRegions` diagnostics are derived
- candidate-local self-overlap is observable through
  `intra-candidate-intersection` arrangement faces when multiple polygons in
  one candidate overlap with positive area
- render, hit-test, and export packet builders normalize duplicate polygon
  signatures inside one resolved packet before emission while preserving the
  original geometry reference when no duplicate exists
- constrained solid legality clipping consumes foreign-owned arrangement faces,
  not packet groups, as the subtraction source

Current supported paint implementation checkpoint:

- open paths use center-equivalent product semantics for all authored stroke
  positions. `inside` and `outside` are stored UI values only; resolved
  geometry, hit-test geometry, and export packets must match `center`.
- open solid packets preserve `geometryFamily: "solid-center"`,
  `resolutionStatus: "native-center"`, `runtimeStatus: "not-applicable"`,
  and `sourceTopology: "open"` through render, hit-test, and export when the
  authored position is `inside` or `outside`.
- open dashed packets preserve `geometryFamily: "dashed-center"`,
  `resolutionStatus: "native-center"`, `runtimeStatus: "not-applicable"`,
  and `sourceTopology: "open"` through render, hit-test, and export when the
  authored position is `inside` or `outside`.
- open paths must not emit constrained solid/dashed runtime diagnostics solely
  because the authored stroke position is `inside` or `outside`.
- closed self-intersecting constrained dashed `inside/outside` packets are
  emitted as product local-side approximation geometry until exact face
  arrangement exists. They preserve `geometryFamily: "constrained-dashed"`,
  `sourceTopology: "self-intersecting"`, and
  `resolutionStatus: "local-side-approximation"` through render, hit-test, and
  export. They must not be converted to center dashed geometry.
- closed self-intersecting constrained solid full-loop paths preserve
  `geometryFamily: "constrained-solid"` and
  `sourceTopology: "self-intersecting"` as local-side one-sided candidate
  faces; this prevents disappearance without claiming completed legal-domain
  face arrangement
- open-path position changes from `center` to `inside` or `outside` do not
  change the resolved geometry family or hit geometry. They may update the
  authored stroke spec, but they must not dirty constrained geometry families.

Current supported topology gate implementation checkpoint:

- self-intersecting constrained dashed paths use local-side approximation until
  exact face semantics are explicitly supported
- seam-wrapping constrained dashed intervals and sharp sampled full-loop round
  joins stay on the constrained packet family; they must not be blocked or
  converted to center geometry merely because exactness is incomplete
- self-intersecting full-loop constrained solid paths are supported only as
  local-side candidate visibility until face semantics are explicitly supported
- disjoint multi-network constrained dashed vectors remain accepted per typed
  network owner
- containment-only compound constrained solid and dashed vectors are not treated
  as overlapping multi-network ownership; they use legal-domain shell/hole
  classification instead
- overlapping or boundary-touching multi-network source bounds are treated as
  shared-face candidates, not as an automatic product-geometry blocker
- overlapping multi-network dashed attempts emit per-network accepted runtime
  diagnostics when each network can produce typed interval-local one-sided
  packets
- constrained dashed runtime diagnostics carry arrangement diagnostics for
  candidate packets, including candidates, overlap edges, components,
  arrangement faces, and owned regions when those exist
- multiple constrained dashed stroke layers on one source are accepted when all
  packets carry typed owner metadata; the runtime reason is `typed-owners`
- overlapping multi-network solid attempts build global candidate ownership
  diagnostics before accepting product packets; exact boolean-union packet
  minimization remains a later optimization

Current supported performance implementation checkpoint:

- baseline CPU geometry benchmarks live in
  `packages/preset/src/__tests__/stroke-performance-contract.test.ts`
- the declared benchmark suite covers 100 moving points, one high-curvature
  cubic edit loop, one multi-network update path, and the Q8 reference fixture
  workload across 300 frames
- benchmarks assert the `120 fps` target through average fps and the `60 fps`
  floor through p95 frame-time
- the multi-network benchmark asserts one topology build per network per frame
- the Q8 benchmark asserts one topology build per source for two sine paths,
  twenty dashed rectangles, and ten irregular dashed polygons per frame

## Packet Architecture

### Semantic Region And Emission Split

The final architecture must distinguish between:

- semantic-region truth
- emission-time batching

Canonical definitions live in `runtime-data-representation.md`.

Required rule:

- semantic ownership, legality, and support truth must be preserved before any
  render/export batching begins

### StrokeRegionPacket

All product-facing stroke semantics must flow through one resolved packet
family.

Required packet sections:

- geometry metadata
- ownership metadata
- legality metadata
- topology metadata
- region geometry
- bounds
- paint payload
- cache metadata

Batching is allowed only after semantic packets already exist.

The renderer/exporter may therefore consume:

- semantic `StrokeRegionPacket[]`
- or `StrokeEmissionBatch[]` derived from them

But the engine may not skip the semantic packet layer.

Required typed metadata fields:

- `packetId`
- `sourcePathId`
- `strokeId`
- `strokeIndex`
- `ownerKey`
- `networkId`
- `contourId`
- `intervalId | null`
- `sourceFamily`
- `topologyFamily`
- `position`
- `style`
- `join`
- `cap`
- `legalityStatus`
- `blockedStatus`
- `revisionKeys`

Required packet-level invariants:

- one packet may reference one contour only
- one packet may reference one interval only, or `null` for full solid coverage
- one packet may not merge owned regions from two different `ownerKey` values
- one packet may not mix `supported` and `blocked-with-diagnostics` geometry in the
  same region payload
- one packet bounds object must be derived from the emitted region geometry, not
  from authored source bounds

Forbidden:

- parsing ownership from `geometryId`
- using display/cache ids as semantic inputs
- letting render-only ids control legality or support behavior
- letting batching rules redefine packet semantics

## Output Parity

Render, hit-testing, export, diagnostics, and future animation overlays must
consume the same resolved-region family.

Meaning:

- render cannot invent extra geometry
- hit-testing cannot simplify to an unrelated shape family
- export cannot re-stroke from authored data independently
- diagnostics may add metadata, but not become the product geometry
- batching may optimize transport, but not alter semantic-region truth

## Representation Discipline

The runtime architecture must remain feasible for interactive workloads.

Therefore:

- topology and interval layers should prefer view-backed references over copied
  arrays
- helper boundaries must declare whether they return views, lazy geometry, or
  materialized geometry
- repeated representation conversion counts as runtime cost and must be visible
  to profiling
- packet granularity for semantic truth must stay distinct from batching
  granularity for renderer/export payloads

See `runtime-data-representation.md` for the canonical representation contract.

## Fallback Philosophy

Fallbacks are allowed only when they are:

- deterministic
- topology-preserving
- explicitly classified
- cache-safe
- documented in the topology semantics and testing specs

Fallbacks are not allowed to:

- silently pretend a supported exact geometry exists
- rely on paint tricks to hide geometry gaps
- use debug geometry as production geometry
- smuggle unsupported semantics through legacy paths

## Open-Source Readiness

The final architecture must be maintainable by contributors who were not
present for the earlier stroke rollout.

Therefore the architecture must be:

- typed
- explicit
- stage-based
- testable in isolation
- resistant to string-contract drift
- readable without private historical knowledge

It must also be readable without forcing contributors to infer whether a
document describes:

- current support guarantees
- end-state goals
- or migration-only roadmap steps

See `active-support-scope.md` for the current support boundary.
