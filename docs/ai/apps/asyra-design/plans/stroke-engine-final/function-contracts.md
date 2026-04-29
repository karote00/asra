# Stroke Engine Function Contracts

## Role

This file defines the implementation contracts for the core final stroke-engine
helpers.

No helper listed here may be implemented with hidden semantics that are not
described in its contract section.

## Contract Format

Each helper must define:

- Purpose
- Inputs
- Outputs
- Preconditions
- Postconditions
- Boundary conditions
- Error cases
- Allowed recovery paths
- Forbidden usage
- Complexity target
- Cache dependencies
- Test references

## Representation Contract

Every helper returning geometry-adjacent data must also be classifiable as one
of:

- view-backed metadata
- lazy geometry descriptor
- materialized geometry
- consumer-emission payload

Default preference:

- return view-backed metadata where possible
- delay geometry materialization until ownership, legality, or emission requires
  it
- treat repeated conversion between representations as a measurable cost

If a helper requires materialization, its implementation must be able to answer:

- why a view was insufficient
- whether materialization happens once per revision or repeatedly per frame
- whether the output is semantic truth or emitter-only batching

## Contracts

### `normalizeStrokeSpec`

- Purpose:
  - convert authored stroke data into validated normalized stroke specs
- Inputs:
  - authored stroke list
  - default policy
- Outputs:
  - normalized stroke spec list
  - per-entry rejection diagnostics
- Preconditions:
  - authored input may be partial or malformed
- Postconditions:
  - all surviving specs are valid for downstream geometry
- Boundary conditions:
  - zero width
  - odd dash pattern
  - negative dash offset
  - invisible stroke
- Error cases:
  - invalid paint payload
  - invalid width mode
  - invalid dash entries
- Allowed recovery paths:
  - normalize odd dash pattern
  - normalize negative offset
  - reject invalid stroke
- Forbidden usage:
  - geometry creation
  - ownership inference
- Complexity target:
  - `O(strokeCount)`
- Cache dependencies:
  - stroke authored revision
- Test references:
  - normalization invalid inputs
  - zero-width rejection
  - odd dash pattern normalization
  - negative offset normalization

### `buildPathTopologyModel`

- Purpose:
  - build the canonical reusable path-topology object for one source revision
- Inputs:
  - shape/vector source data
  - preview/exact tessellation policy
- Outputs:
  - `PathTopologyModel`
- Preconditions:
  - source data is structurally valid enough to parse
- Postconditions:
  - downstream stages share one topology revision
- Boundary conditions:
  - open path
  - closed path
  - compound closed path with holes
  - repeated points
  - curve-heavy path
  - self-intersection
- Error cases:
  - malformed network graph
  - invalid control-point references
- Allowed recovery paths:
  - preview tessellation density reduction
- Forbidden usage:
  - per-packet repeated recomputation inside one render pass
  - inferring shell/hole roles after interval allocation already started
- Complexity target:
  - bounded by segment/sample budget
- Cache dependencies:
  - source path revision
  - preview/exact mode
- Test references:
  - path topology reuse benchmark
  - self-intersection discovery fixture
  - compound legal-domain decomposition fixtures
  - `packages/preset/src/__tests__/path-topology-model.test.ts`
  - `packages/preset/src/__tests__/vector-constrained-solid-stroke.test.ts`

Normative requirements:

- must emit `fillRuleBasis`, `canonicalLengthBasis`, `legalDomains`, and
  contour `role`
- must emit typed simplicity classifications for both sides of the topology
  split:
  - `isSimpleClosed` for closed contours
  - `isSimpleOpen` for open contours
- must normalize repeated points and zero-length segments before downstream
  interval work
- must preserve stable contour and segment identities across paint-only changes
- must expose open self-intersection through typed topology metadata instead of
  forcing each packet family to rediscover it independently
- preview mode may reduce numeric density, but it may not rewrite the topology
  graph for a family that claims exact support
- current implementation entrypoint:
  - `packages/preset/src/components/stroke-render/path-topology-model.ts`
- current Phase 2 runtime rule:
  - shape render strategies and vector render strategies must build the topology
    once and pass it into packet builders; packet helpers may self-build a
    topology only for isolated direct-helper tests and never as a product render
    path substitute

### `classifySourceTopology`

- Purpose:
  - classify source family and topology family from the path-topology model
- Inputs:
  - `PathTopologyModel`
- Outputs:
  - source family
  - topology family
  - support-hint metadata
- Preconditions:
  - topology model already exists
- Postconditions:
  - support decisions do not depend on shape name alone
- Boundary conditions:
  - simple closed
  - compound closed
  - open
  - sampled smooth
  - self-intersecting
  - multi-network
- Error cases:
  - inconsistent topology metadata
- Allowed recovery paths:
  - classify as `research-gated`
- Forbidden usage:
  - direct render branching by component type only
  - treating contour orientation as a complete legal-domain policy
- Complexity target:
  - `O(featureCount)`
- Cache dependencies:
  - topology revision
- Test references:
  - topology-family classification matrix
  - `packages/preset/src/__tests__/path-topology-model.test.ts`

Normative requirements:

- must classify legal-domain complexity separately from raw source family
- must not mark compound paths as product `supported` unless shell/hole
  semantics are explicit and render / hit-test / export packet builders consume
  the resulting multi-contour legal domain directly
- current product support includes constrained solid and constrained dashed
  containment-only compound vectors; nested containment-depth chains use
  parity-based shell/hole roles, while intersecting contours and shared edges
  remain blocked or `research-gated`
- must return the committed canonical dash-length basis used by interval
  allocation
- current implementation entrypoints:
  - `classifyPathTopologyModel`
  - `classifyCompoundClosedLegalDomains`
- compound closed rule:
  - shell/hole classification must use containment depth or an equivalent
    legal-domain decomposition; contour orientation alone is metadata, not a
    legality decision

### `allocateStrokeIntervals`

- Purpose:
  - allocate visible/gap intervals from stroke spec and path topology
- Inputs:
  - normalized stroke spec
  - path-topology model
- Outputs:
  - interval records
- Preconditions:
  - normalized stroke spec is valid
- Postconditions:
  - interval metadata is deterministic and seam-aware
- Boundary conditions:
  - full-loop visible interval
  - seam-wrap interval
  - single-edge interval
  - corner-spanning interval
  - preview rebuild with same exact schedule
- Error cases:
  - invalid length basis
- Allowed recovery paths:
  - emit one full interval for solid stroke
- Forbidden usage:
  - constructing geometry here
  - using parameter-space distance as the semantic dash-length source
- Complexity target:
  - `O(intervalCount)`
- Cache dependencies:
  - path length revision
  - dash pattern revision
  - dash offset revision
- Test references:
  - seam-wrap continuity
  - full-loop interval allocation
  - `packages/preset/src/__tests__/path-topology-model.test.ts`

Normative requirements:

- must use `arc-length-on-topology` as the only semantic dash-length basis
- must serialize enough metadata to reconstruct interval ownership and seam
  continuity deterministically
- preview mode may approximate lookup numerically, but it may not change the
  committed interval schedule for the same exact topology revision
- current implementation entrypoint:
  - `allocateDashedIntervalsForTopology`
- current Phase 2 runtime rule:
  - packet helpers must consume topology length/closure state for dash
    allocation and must not maintain separate private `getPathLength` copies

### `sliceIntervalGeometryInput`

- Purpose:
  - derive interval-local geometry input from path topology and interval record
- Inputs:
  - `PathTopologyModel`
  - interval record
- Outputs:
  - interval-local segment/sample span
- Preconditions:
  - interval record belongs to the same topology revision
- Postconditions:
  - interval-local geometry input is stable and deterministic
  - output should prefer topology views or ranges over copied coordinate arrays
- Boundary conditions:
  - seam-wrap
  - single segment
  - multi-segment
- Error cases:
  - interval/topology mismatch
- Allowed recovery paths:
  - none
- Forbidden usage:
  - hidden preview-only geometry mutation
- Complexity target:
  - bounded by touched segment/sample count
- Cache dependencies:
  - interval revision
  - topology revision
- Test references:
  - interval slicing fixtures

### `buildOneSidedSegmentFaces`

- Purpose:
  - build one-sided body faces for the chosen side
- Inputs:
  - side-aware frame data
  - interval-local segment span
  - normalized stroke spec
- Outputs:
  - candidate body faces
- Preconditions:
  - side choice is already resolved
- Postconditions:
  - opposite-side geometry is never materialized
- Boundary conditions:
  - straight span
  - curved span
  - short span
- Error cases:
  - degenerate span
- Allowed recovery paths:
  - preview density reduction only
- Forbidden usage:
  - widened center-band construction for constrained modes
- Complexity target:
  - `O(touchedSegments)`
- Cache dependencies:
  - topology revision
  - interval revision
  - stroke width/join/cap revision
- Test references:
  - inside/outside ghost-band rejection
  - `packages/preset/src/__tests__/constrained-solid-stroke-geometry.test.ts`

Current Phase 3 implementation note:

- open paths do not use constrained solid geometry in the product vector render
  path. Authored `inside` / `outside` positions are resolved as center geometry
  for render, hit-test, and export.
- closed inside constrained solid paths build selected-side candidates and clip
  them against the declared source legal domain before packet emission
- closed outside miter/bevel paths may use compact exact polygons when adjacent
  body faces do not overlap; this is an emission optimization, not a doubled
  center-band construction

Current implementation note:

- supported constrained dashed full-loop intervals reuse the exact constrained
  solid selected-side geometry path
- supported constrained dashed non-full-loop intervals slice the source interval
  first, then build direct one-sided constrained geometry for that visible
  closed-path interval. Product vector rendering maps open-path authored
  `inside` / `outside` dashed strokes to center geometry before this stage.
- self-intersecting closed constrained dashed intervals emit product
  local-side approximation packets until exact face arrangement, legal-domain
  classification, and duplicate semantic-region collapse exist. The packets
  must keep `geometryFamily: "constrained-dashed"` and
  `resolutionStatus: "local-side-approximation"`.
- closed inside interval-local constrained dashed packets clip the one-sided
  candidate against the source legal domain; the product path does not build a
  doubled-width center packet and trim it afterward
- constrained dashed packet metadata records contour, legal-domain,
  source-topology, topology-family, and interval-topology for both full-loop and
  interval-local packets

Current supported paint implementation note:

- product vector rendering maps open-path authored `inside` / `outside`
  positions to center geometry before packet construction.
- open solid vectors publish `geometryFamily: "solid-center"` and open dashed
  vectors publish `geometryFamily: "dashed-center"` even when the authored
  position is `inside` or `outside`.
- open vectors must not emit constrained solid/dashed runtime diagnostics solely
  because the authored position is `inside` or `outside`.
- parameter transitions from open `center` to open `inside` / `outside` must
  keep the same packet family and hit geometry unless width, dash, cap, join,
  or source geometry also changes.

### `buildOneSidedJoinFaces`

- Purpose:
  - build one-sided join wedges/fans
- Inputs:
  - vertex descriptor
  - chosen side
  - normalized stroke spec
- Outputs:
  - candidate join faces
- Preconditions:
  - join family already normalized
- Postconditions:
  - join geometry matches selected family on the chosen side only
- Boundary conditions:
  - miter limit exceeded
  - acute turn
  - obtuse turn
  - high curvature
- Error cases:
  - impossible join basis from malformed topology
- Allowed recovery paths:
  - deterministic bounded recovery when numeric collapse happens
  - miter-limit exceedance emits bevel geometry as supported join resolution,
    not as an unsupported blocked state
- Forbidden usage:
  - miter proxy for round support
  - forwarding a miter-limit-exceeded join to render/export for later repair
- Complexity target:
  - bounded per touched vertex
- Cache dependencies:
  - topology revision
  - stroke join revision
- Test references:
  - miter/bevel/round corner probes
  - `packages/preset/src/__tests__/constrained-solid-stroke-geometry.test.ts`

Current Phase 3 implementation note:

- closed inside bevel joins emit bevel join geometry directly
- closed miter-limit exceedance emits bevel join geometry as supported exact
  output, not as `blocked` or `research-gated`
- closed outside round joins use arc fan construction on the selected side.
  Product open paths use center cap semantics.
- constrained solid packet metadata records the accepted topology and legal
  domain so render, hit-test, and export do not infer join behavior from
  `geometryId`

Current implementation note:

- constrained dashed full-loop round joins inherit the constrained solid
  one-sided round-join path
- sharp sampled full-loop round joins remain visible through the same selected
  side path; they are not blocked simply because exact reference parity is
  incomplete
- seam-wrapping constrained dashed intervals are sliced across the seam and
  emitted with `wrapsSeam: true`; the authored dash is not dropped
- supported corner-spanning constrained dashed intervals must continue to use
  interval-local one-sided candidate construction; if a future interval family
  cannot use the same explicit candidate model, it remains gated rather than
  entering center-band substitute geometry

### `buildOneSidedCapFaces`

- Purpose:
  - build one-sided terminal faces for lower-level constrained helper coverage
    and closed constrained slices
- Inputs:
  - endpoint descriptor
  - chosen side
  - normalized stroke spec
- Outputs:
  - candidate cap faces
- Preconditions:
  - caller has explicitly opted into one-sided helper geometry; product vector
    rendering must not call this path only because an open path has authored
    `inside` or `outside` position
- Postconditions:
  - cap geometry is side-specific and family-correct
- Boundary conditions:
  - butt
  - square
  - round
- Error cases:
  - endpoint descriptor missing
- Allowed recovery paths:
  - explicit unsupported classification
- Forbidden usage:
  - center cap geometry clipped afterward
- Complexity target:
  - bounded per endpoint
- Cache dependencies:
  - endpoint revision
  - cap revision
- Test references:
  - constrained cap helper tests

Current supported paint implementation note:

- square, round, and butt one-sided cap helpers remain available for constrained
  geometry internals, but the product vector render path for open strokes uses
  center cap semantics regardless of authored `inside` / `outside` position.

### `partitionFacesFromCandidates`

- Purpose:
  - partition overlapping candidate faces into explicit face regions
- Inputs:
  - candidate body/join/cap faces
  - intersection metadata
- Outputs:
  - partitioned face regions
- Preconditions:
  - candidate faces belong to one topology revision
- Postconditions:
  - later ownership and legality act on explicit face regions
- Boundary conditions:
  - no overlap
  - self-overlap
  - self-intersection
  - nested overlap
- Error cases:
  - arrangement budget overflow
- Allowed recovery paths:
  - explicit `research-gated` classification when exact semantics are not
    approved
- Forbidden usage:
  - skipping partition when ownership ambiguity exists
  - undocumented epsilon changes between test and production builds
- Complexity target:
  - bounded by face/intersection budget
- Cache dependencies:
  - candidate-face revision
  - intersection revision
- Test references:
  - self-overlap face partition fixtures

Normative requirements:

- must publish one numeric robustness policy for:
  - crossing tolerance
  - tangential touch classification
  - coincident-edge snap or split behavior
  - zero-area face rejection
  - face winding normalization
- must produce the same face partition for the same committed topology revision
  independent of render-only ids

Current supported join/cap implementation note:

- constrained solid overlap diagnostics publish `arrangementPolicy`
- current strategy is `bounded-convex-subset-arrangement`
- current numeric policy is:
  - `epsilon = 0.000001`
  - `roundingFactor = 1000`
  - `maxExactSubsetCount = 4096`
  - `zeroAreaThreshold = 0.000001`
  - tangential touches are boundary overlap and must not emit zero-area faces
  - coincident edge duplicates are deduped by rotated polygon signatures
- constrained solid overlap diagnostics publish `arrangementFaces` before
  ownership regions
- exact subset intersections must use
  `partitionMethod: "exact-subset-intersection"`
- budget-bounded overlap polygons must use
  `partitionMethod: "bounded-overlap-polygon"` and remain visible in
  diagnostics

### `resolveStrokeOwnership`

- Purpose:
  - assign ownership to partitioned faces
- Inputs:
  - partitioned face regions
  - typed owner metadata
  - product ownership policy
- Outputs:
  - ownership-classified face regions
- Preconditions:
  - owner metadata is typed and explicit
- Postconditions:
  - no downstream stage needs string parsing
  - ownership diagnostics preserve typed `ownerKey`, not only `strokeId`
- Boundary conditions:
  - single owner
  - repeated intervals from one owner
  - disjoint multiple network owners
  - overlapping multiple owners
  - nested owners
- Error cases:
  - missing owner metadata must return an explicit `missing-owner-metadata`
    blocked reason
- Allowed recovery paths:
  - explicit blocked/research result
- Forbidden usage:
  - owner inference from `geometryId`
  - owner assignment from packet order alone
- Complexity target:
  - bounded by owner-set and face count
- Cache dependencies:
  - arrangement revision
  - owner metadata revision
- Test references:
  - typed owner metadata tests
  - multi-network ownership tests

Normative requirements:

- must resolve ownership at the face-region level, not only at the packet-group
  level
- for compound closed paths, owner resolution must retain `legalDomainId`
- primitive shape sources and vector network sources must both attach typed
  `ownerKey` before ownership diagnostics are built
- disjoint network owners may be accepted independently when typed `networkId`
  keeps the candidate sets separate
- global multi-owner packet grouping may not block disjoint per-network accepted
  candidates
- overlapping multi-network constrained solid faces must build global ownership
  diagnostics before support can be claimed
- overlapping multi-network constrained dashed faces may be accepted per network
  when every emitted packet carries typed `networkId` and `ownerKey` metadata
- if two candidate owners remain semantically indistinguishable, the output must
  downgrade explicitly instead of choosing by incidental packet order

Current supported join/cap implementation note:

- constrained solid `ownedRegions` are derived from `arrangementFaces`
- `ownedRegions` remain as adapter diagnostics for existing clipping and
  debug readers, but they are no longer the only face-level truth
- owner selection is recorded per arrangement face through `ownerStrokeId` and
  optional typed `ownerKey`
- legality clipping subtracts foreign-owned arrangement faces, not packet groups

### `applyLegalityClipping`

- Purpose:
  - keep only legal faces for the current constrained semantics
- Inputs:
  - ownership-classified face regions
  - legality policy
- Outputs:
  - legal visible faces
  - legality diagnostics
- Preconditions:
  - ownership has already resolved ambiguity
- Postconditions:
  - legality is explicit, typed, and testable
- Boundary conditions:
  - non-overflow preserve
  - overflow trim
  - full removal
- Error cases:
  - missing legality domain
- Allowed recovery paths:
  - explicit blocked status only if product semantics allow it
- Forbidden usage:
  - using legality to repair wrong doubled-width geometry
  - reducing legality to orientation-only tests on compound paths
- Complexity target:
  - bounded by face count and domain count
- Cache dependencies:
  - ownership revision
  - legality policy revision
- Test references:
  - legality preserve/drop fixtures

Normative requirements:

- for closed paths, legality must be evaluated against declared legal domains
- for open paths, constrained legality is not invoked for product vector stroke
  position changes because open paths resolve to center geometry by contract
- legality may trim or reject faces, but it may not create replacement geometry

Current supported join/cap implementation note:

- constrained solid legality clipping consumes
  `ownershipDiagnostics.arrangementFaces` as its foreign-owned subtraction
  source
- packet-level overlap is used only to discover arrangement candidates, not as
  the final ownership truth

### `resolveStrokeRegions`

- Purpose:
  - convert legal visible faces into final `StrokeRegionPacket[]`
- Inputs:
  - legal visible faces
  - topology/support metadata
- Outputs:
  - typed region packets without paint
- Preconditions:
  - ownership and legality already resolved
- Postconditions:
  - packet metadata is complete and stable
- Boundary conditions:
  - zero packets
  - one full-loop packet
  - multiple interval packets
- Error cases:
  - missing typed metadata
- Allowed recovery paths:
  - none beyond prior explicit status
- Forbidden usage:
  - packet mutation by renderer
- Complexity target:
  - `O(regionCount)`
- Cache dependencies:
  - legality revision
  - topology/support revision
- Test references:
  - packet parity tests

### `buildRenderPackets`

- Purpose:
  - convert region packets into render payloads
- Inputs:
  - paint-attached region packets
- Outputs:
  - render packets or emission batches derived from semantic packets
- Preconditions:
  - paint payload already attached
- Postconditions:
  - renderer does not restroke from authored input
  - semantic packet truth remains recoverable after batching
- Boundary conditions:
  - solid paint
  - gradient paint
  - image paint
- Error cases:
  - missing paint payload
- Allowed recovery paths:
  - reject packet
- Forbidden usage:
  - constructing geometry here
  - collapsing multiple semantic packets into one opaque batch that breaks
    hit/export traceability
- Complexity target:
  - `O(regionCount)`
- Cache dependencies:
  - region revision
  - paint revision
- Test references:
  - render/export/hit parity

Normative requirements:

- batching is an emission optimization, not a semantic authority
- if render batching groups multiple semantic packets, packet-level ownership,
  legality, and blocked identity must remain queryable

### `buildHitPackets`

- Purpose:
  - produce hit-test payloads from the same region packets
- Inputs:
  - paint-attached or geometry-only region packets
- Outputs:
  - hit packets
- Preconditions:
  - region packets are valid
- Postconditions:
  - hit shape equals rendered region family
  - typed debug metadata remains attached for diagnostics and traceability
- Boundary conditions:
  - sparse multi-packet intervals
  - empty packet set
- Error cases:
  - invalid bounds
- Allowed recovery paths:
  - none
- Forbidden usage:
  - simplified unrelated hit geometry
- Complexity target:
  - `O(regionCount)`
- Cache dependencies:
  - region revision
- Test references:
  - hit/render parity

### `buildExportPackets`

- Purpose:
  - produce export payloads from the same region packets
- Inputs:
  - paint-attached or geometry-only region packets
- Outputs:
  - export packets
- Preconditions:
  - region packets are valid
- Postconditions:
  - export geometry equals rendered region family
  - typed debug metadata remains attached for diagnostics and traceability
- Boundary conditions:
  - multiple region packets
  - empty packet set
- Error cases:
  - invalid region geometry
- Allowed recovery paths:
  - none
- Forbidden usage:
  - exporter restroking from authored path
- Complexity target:
  - `O(regionCount)`
- Cache dependencies:
  - region revision
- Test references:
  - export/render parity

### `computeStrokeDirtyKeys`

- Purpose:
  - derive minimal invalidation keys for topology, interval, geometry, legality,
    region, and paint stages
- Inputs:
  - previous revision set
  - next revision set
  - required revision fields: source path, stroke spec, interval allocation,
    topology classification, ownership, legality, paint, preview/exact mode
- Outputs:
  - dirty-key set by stage
- Preconditions:
  - revision sets are comparable
- Postconditions:
  - only necessary downstream stages rerun
- Boundary conditions:
  - paint-only change
  - dash-offset-only change
  - path-point move
  - preview-to-exact transition
- Error cases:
  - missing revision fields
- Allowed recovery paths:
  - conservative wider invalidation, but never narrower than correctness
- Forbidden usage:
  - blanket rerun of all stages by default
- Complexity target:
  - `O(revisionFieldCount)`
- Cache dependencies:
  - all declared stage revisions
- Test references:
  - dirty-key minimal invalidation benchmark
  - `packages/preset/src/__tests__/stroke-performance-contract.test.ts`

Current supported performance implementation note:

- baseline performance tests measure scripted exact CPU geometry updates
- the benchmark suite covers 100 moving points, high-curvature cubic edits, and
  multi-network updates over 300 frames
- pass criteria are average fps `>= 120` and p95 frame time `<= 16.67ms`
- the multi-network benchmark must prove one topology build per network per
  frame, not one build per packet family

### `buildStrokeRuntimeRevisionSet`

- Purpose:
  - create the comparable revision set carried by resolved stroke packets
- Inputs:
  - source path points and closed state
  - stroke spec fields that affect geometry or intervals
  - interval allocation signature
  - source topology and interval topology metadata
  - ownership and legality metadata
  - paint payload fields
  - preview/exact mode
- Outputs:
  - complete `StrokeRevisionSet`
- Preconditions:
  - inputs come from typed stage outputs or authored stroke/path data
- Postconditions:
  - render, hit, export, diagnostics, and cache logic can compare packet
    revisions without inspecting `geometryId`
- Boundary conditions:
  - solid strokes use an explicit non-dashed interval signature
  - center strokes use native-center resolution metadata
  - constrained requests that cannot emit product geometry keep explicit blocked
    diagnostics instead of blocked recovery packet metadata
- Error cases:
  - non-finite source coordinates must produce an invalid source revision and
    be rejected before support
- Allowed recovery paths:
  - conservative invalidation if a stage cannot yet produce a narrower typed
    revision
- Forbidden usage:
  - deriving any revision from `geometryId`, cache key, cache-prefix structure,
    render signature, or debug overlay labels
- Complexity target:
  - `O(pointCount + strokeFieldCount + metadataFieldCount)`
- Cache dependencies:
  - every declared `StrokeRevisionKey`
- Test references:
  - `stroke-dirty-keys.test.ts`
  - `solid-center-stroke-render.test.ts`
  - `solid-center-stroke-packets.test.ts`

Normative requirements:

- a paint-only change may not invalidate topology, interval allocation,
  arrangement, ownership, or legality
- a dash-offset-only change may invalidate interval allocation and later stages,
  but not topology classification
- preview-to-exact transition must preserve topology family and support state
  while allowing numeric-geometry rebuild
- render, hit, and export packets must preserve the same typed lifecycle
  metadata as the resolved geometry packet
- constrained dashed product packets must not remain in candidate state after
  runtime classification; they must be either advanced to `accepted` or omitted
  with blocked diagnostics
