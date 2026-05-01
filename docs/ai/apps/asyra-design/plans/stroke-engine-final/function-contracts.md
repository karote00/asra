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

- must emit `fillRule`, `fillRuleBasis`, `canonicalLengthBasis`,
  `legalDomains`, and contour `role`
- missing legacy source `fillRule` must normalize to `evenodd`; explicit
  `nonzero` must survive into topology, legal-domain descriptors, cache keys,
  and diagnostics
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
  parity-based shell/hole roles, while intersecting contours, overlapping holes,
  and shared edges remain blocked or `research-gated`
- must return the committed canonical dash-length basis used by interval
  allocation
- current implementation entrypoints:
  - `classifyPathTopologyModel`
  - `classifyCompoundClosedLegalDomains`
- compound closed rule:
  - shell/hole classification must use containment depth or an equivalent
    legal-domain decomposition; contour orientation alone is metadata, not a
    legality decision
  - overlapping non-containment contours must return no compound
    shell/hole classification until legal-domain boolean normalization exists

### `buildCompoundLegalDomainNormalization`

- Purpose:
  - produce the normalized compound legal-domain object consumed by product
    packets
- Inputs:
  - closed simple `PathTopologyModel[]`
  - target shared `legalDomainId`
  - optional `GeometryBackend`
  - `allowBackendNormalization` flag
- Outputs:
  - `NormalizedLegalDomain` when normalization is supported
  - explicit blocked result when source topology or backend requirements are
    not satisfied
- Preconditions:
  - every source topology must be closed and simple for the current
    implementation
  - shared compound product support requires at least one shell and one hole
- Postconditions:
  - containment-only paths emit one shared legal domain with deterministic
    boundary seams
  - backend-backed overlap normalization runs
    `union(shells, nonzero) -> union(holes, nonzero) ->
    difference(shells, holes, nonzero)`
  - normalized boundary spans carry source contour ids and source span ids
- Boundary conditions:
  - one shell and one hole
  - nested containment-depth chains
  - overlapping holes
  - missing backend
  - unsupported self-intersecting source contours
- Error cases:
  - unsupported source topology
  - missing shell or hole
  - overlapping holes without an exact backend
- Allowed recovery paths:
  - return `blocked: requires-exact-backend` and keep product networks separate
  - return `blocked: unsupported-source-topology` before product packets claim
    compound support
- Forbidden usage:
  - using probe-point-only containment for overlapping holes
  - assigning a shared compound legal-domain id when normalization is blocked
  - allocating product dashes on raw overlapping hole contours
- Complexity target:
  - containment-only: bounded by contour count and point count
  - backend-boolean: bounded by backend region complexity and dirty graph
- Cache dependencies:
  - source topology revisions
  - fill rule
  - backend id and backend implementation version
- Test references:
  - `packages/preset/src/__tests__/legal-domain-normalization.test.ts`
  - `packages/preset/src/__tests__/vector-constrained-solid-stroke.test.ts`
  - `packages/preset/src/__tests__/vector-constrained-dashed-stroke.test.ts`

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
  - open paths use the same repeated arc-length dash pattern as closed paths
  - `dashOffset` is always a phase shift into the authored dash pattern
  - endpoints clip the authored interval that reaches the path boundary; they
    are not rebalanced into half-length dashes
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
- current open-path endpoint implementation:
  - `allocateDashedCenterStrokeIntervals` emits true arc-length pattern
    intervals for open paths with both zero and non-zero dash offsets
  - `SolidCenterStrokeGeometryDebugMeta.dashPlacementMode` records
    `"arc-length-pattern"`

### `buildSourceSpanGraph`

- Purpose:
  - split the committed source topology into ownership spans before candidate
    face construction
- Inputs:
  - `PathTopologyModel`
  - optional committed dash interval records
- Outputs:
  - `SourceSpanGraph`
  - `SourceSpanRecord[]`
  - `SourceSpanCut[]`
- Preconditions:
  - topology points and total length are already normalized
  - intervals use the same topology revision and arc-length basis
- Postconditions:
  - spans are split at vertices and dash interval boundaries
  - current flattened self-intersections become `self-intersection` cuts
  - `getSourceSpanIdsForInterval` can trace every visible dash interval to
    source span ids
- Boundary conditions:
  - open path
  - closed path
  - seam-wrapping visible interval
  - self-intersecting flattened polyline
  - empty interval set
- Error cases:
  - none for unsupported exact semantics; unsupported geometry remains a later
    arrangement classification concern
- Allowed recovery paths:
  - keep the stroke packet visible while marking exact face ownership for Step 7
- Forbidden usage:
  - using only `intervalId` as ownership provenance
  - letting a self-intersection-crossing interval claim one unsplit source span
  - splitting render packets in Step 6 solely to satisfy metadata
- Complexity target:
  - `O(segmentCount^2 + intervalCount)` for current self-intersection discovery
  - later exact backends may replace the discovery step, but the output contract
    must stay stable
- Cache dependencies:
  - topology revision
  - interval allocation revision
- Test references:
  - `packages/preset/src/__tests__/source-span-graph.test.ts`
  - `packages/preset/src/__tests__/dashed-center-stroke-packets.test.ts`
  - `packages/preset/src/__tests__/constrained-dashed-stroke-packets.test.ts`

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
  local-side approximation packets when no exact arrangement backend is
  selected. With a selected backend, accepted packets promote through exact
  face arrangement, legal-domain classification, and duplicate semantic-region
  collapse. The packets must keep `geometryFamily: "constrained-dashed"` and
  report either `resolutionStatus: "local-side-approximation"` or
  `resolutionStatus: "exact-constrained"` according to the selected backend.
- sampled-simple-closed interval-local constrained dashed packets follow the
  same selected-backend promotion rule. Full-loop sampled constrained packets
  may remain exact when they do not need interval-local candidate overlap
  cleanup.
- closed inside interval-local constrained dashed packets clip the one-sided
  candidate against the source legal domain; the product path does not build a
  doubled-width center packet and trim it afterward
- for local-side approximation packets that are not yet exact-arrangement
  geometry, closed inside interval-local candidates must still be clipped by
  selected-side guards. Intervals that cover a sharp source vertex clip against
  the two adjacent authored segments; intervals that do not cover that vertex
  still clip if their candidate polygon crosses an active authored
  sharp-boundary edge. This is a local cap/join and boundary legality guard,
  not a global self-intersection legal classifier.
- vector product callers must provide authored anchor guard points when they
  are available. The guard edges come from the authored anchor-to-anchor segment
  chain, while only anchors marked sharp may activate the guard; smooth anchors
  remain available as adjacent segment endpoints but must not trigger clipping.
- if a local-side approximation interval polygon crosses another active
  authored sharp-boundary edge, the crossed portion must be clipped by that
  authored edge line, not by the sampled tangent or interval end cap. This
  crossing rule is independent of whether the visible interval contains the
  sharp vertex that activated the edge.
- if a sampled high-curvature interval-local candidate creates a
  self-intersecting selected-side ribbon, the helper must split the source
  interval into bounded continuous sub-ribbons and emit only simple polygons.
  The split is a geometry validity repair inside the same dash interval; it is
  forbidden to change the dash schedule, use tangent/chord geometry, or fall
  back to center stroke geometry.
- source-path callers must split visible intervals at authored segment
  boundaries before candidate construction. Helpers may receive one authored
  line or Bezier segment slice at a time, but they must not be asked to infer a
  correct cross-segment high-curvature join from a single sampled open ribbon.
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

### `getGeometryBackend`

- Purpose:
  - resolve the selected exact geometry backend through the registry
- Inputs:
  - optional backend id override
- Outputs:
  - `GeometryBackend`
- Preconditions:
  - requested backend id is registered
  - registration loads a backend whose `backendId` matches the declared id
  - loaded backend exposes a non-empty `backendVersion`
  - loaded backend exposes boolean capability metadata for every required
    operation
  - loaded backend exposes a valid coordinate policy
- Postconditions:
  - backend factory is loaded lazily and cached after first resolve
  - missing exact backend support fails loudly through the unsupported backend
  - backend cache signature is stable for the selected backend id, version, and
    coordinate policy
- Boundary conditions:
  - default unsupported backend
  - one registered exact backend
  - multiple registered backends with active selection
- Error cases:
  - empty backend id
  - unregistered backend id
  - lazy registration returns a backend with a mismatched id
  - missing backend version
  - malformed capability metadata
  - invalid coordinate policy
- Allowed recovery paths:
  - remain on unsupported backend and keep exact feature slices blocked
- Forbidden usage:
  - direct product imports of concrete boolean / offset implementations
  - silently returning empty regions when the exact backend is unavailable
  - falling back to center stroke geometry because backend selection failed
  - local float-to-integer scaling outside the shared coordinate mapper
  - treating an adapter with `buildArrangement: false` as exact arrangement
    support
- Complexity target:
  - `O(1)` registry lookup after registration
- Cache dependencies:
  - backend id
  - backend implementation version
  - backend capability set
  - backend coordinate policy scale / rounding / epsilon
- Test references:
  - `packages/preset/src/__tests__/geometry-backend.test.ts`

### `createClipper2GeometryBackend`

- Purpose:
  - adapt a loaded `clipper2-wasm` module to the `GeometryBackend` interface
- Inputs:
  - loaded Clipper2 module
  - optional backend id
  - optional backend version
  - optional coordinate policy
- Outputs:
  - `GeometryBackend`
- Preconditions:
  - Clipper2 module is already loaded by app/bootstrap code
  - caller does not perform async WASM initialization inside product geometry
    helpers
  - source points are finite and inside coordinate policy bounds
- Postconditions:
  - `union`, `difference`, `intersection`, and `offset` use Clipper2 through the
    shared coordinate mapper
  - `buildArrangement` partitions overlapping candidate regions into disjoint
    backend boolean faces and preserves all candidate claims
  - repeated backend calls may reuse bounded operation caches, but returned
    geometry must be cloned so callers cannot mutate cached state
  - arrangement cache hits must rebuild `claimedBy` from the current typed
    candidate objects by candidate id
  - backend metadata includes `clipper2-wasm@0.2.1`
  - legal-state classification remains permissive at the backend boundary; the
    Asyra arrangement bridge must apply typed legal-domain classification before
    product inside/outside filtering
- Boundary conditions:
  - closed polygon offset uses `EndType.Polygon`
  - open path offset uses authored cap type
  - bevel join maps to Clipper2 square join until a bevel-specific adapter path
    exists
- Error cases:
  - non-finite or unsafe coordinates
  - backend boolean failure while splitting candidate arrangement
- Allowed recovery paths:
  - keep arrangement-gated features blocked while boolean/offset operations are
    available
- Forbidden usage:
  - product helper imports of `clipper2-wasm`
  - treating Clipper2 boolean output as final product geometry without `FinalFace`
    metadata
  - treating backend permissive arrangement legal state as full legal-domain
    classification
- Complexity target:
  - Clipper2 backend complexity for boolean and offset operations; callers must
    still obey dirty-key and per-network invalidation budgets
- Cache dependencies:
  - backend cache signature
  - coordinate policy
  - fill rule for boolean operations
  - offset width / join / cap / miter / closed state
  - input polygon geometry
  - candidate id / visual packet key / stroke position for arrangement cache
- Test references:
  - `packages/preset/src/__tests__/clipper2-geometry-backend.test.ts`

### `loadAndRegisterClipper2GeometryBackend`

- Purpose:
  - asynchronously load Clipper2 WASM, register the resulting backend, and
    optionally select it as active
- Inputs:
  - optional Clipper2 factory options
  - optional backend id/version/coordinate policy
  - optional `select` flag
- Outputs:
  - loaded `GeometryBackend`
- Preconditions:
  - caller is app/bootstrap or an explicit backend initialization module
  - runtime can load the Clipper2 WASM asset
- Postconditions:
  - backend is registered through `GeometryBackendRegistry`
  - active backend changes only when `select !== false`
  - browser runtime uses the bundler-resolved Clipper2 WASM URL through
    `locateFile`, so the loader must not fetch an HTML fallback route as WASM
- Boundary conditions:
  - tests may pass `wasmBinary` directly
  - browser runtime must not rely on the package `locateFile` default unless it
    is known to resolve to an actual `.wasm` asset URL served as WASM
- Error cases:
  - WASM load failure
  - invalid backend metadata
  - duplicate registration with incompatible implementation
- Allowed recovery paths:
  - keep unsupported backend active and leave exact backend-gated features
    blocked
- Forbidden usage:
  - calling this from per-frame render, hit-test, export, or geometry helper
    code
  - hiding WASM load failure by falling back to center stroke output
- Complexity target:
  - one async load per app/session
- Cache dependencies:
  - loaded backend cache signature
- Test references:
  - `packages/preset/src/__tests__/clipper2-geometry-backend.test.ts`

### `enableDefaultExactGeometryBackend`

- Purpose:
  - provide a root-safe app bootstrap for the default exact backend
- Inputs:
  - none
- Outputs:
  - `Promise<void>` that resolves after the default backend is registered and
    selected
- Preconditions:
  - runtime can dynamically import the backend chunk and load the WASM asset
  - callers do not await this promise from synchronous render code
- Postconditions:
  - Clipper2 backend is registered and selected when loading succeeds
  - repeated calls share one in-flight promise
  - failed loads reset the promise so a later call can retry
  - successful backend selection triggers render scene-tree invalidation through
    the geometry-backend selection observer, causing already-loaded vectors to
    recompute exact backend-gated geometry
- Boundary conditions:
  - before the promise resolves, render paths keep explicit local-side
    visibility for constrained dashed output
  - after the promise resolves, accepted constrained dashed packets may promote
    through exact arrangement
- Error cases:
  - backend chunk load failure
  - WASM load failure
  - backend registration failure
- Allowed recovery paths:
  - app initialization may catch and report the failure because no-backend
    rendering remains visible and typed
- Forbidden usage:
  - awaiting this promise inside product render
  - treating failure as permission to fallback to center or emit empty output
- Complexity target:
  - one async backend load per app session unless load fails and is retried
- Cache dependencies:
  - backend cache signature after successful selection
- Test references:
  - app build must keep the backend on an async loading path

### `createGeometryBackendCoordinateMapper`

- Purpose:
  - convert model-space float geometry into deterministic integer backend
    coordinates and back
- Inputs:
  - `GeometryBackendCoordinatePolicy`
  - `Vec2`, `Vec2[]`, `PolygonRegion`, or distance scalar
- Outputs:
  - scaled backend-space values
  - model-space values after reverse mapping
- Preconditions:
  - scale is positive
  - epsilon is positive
  - max coordinate times scale remains inside JavaScript safe integer range
  - rounding mode is supported
- Postconditions:
  - signed zero normalizes to `0`
  - model-space to backend-space uses a single deterministic rounding rule
  - all exact backend wrappers share the same scaling semantics
- Boundary conditions:
  - sub-epsilon values round to zero
  - negative values are preserved except for signed zero
  - region conversion preserves polygon order and count
- Error cases:
  - non-finite coordinates
  - coordinates outside safe scaling range
  - invalid policy
- Allowed recovery paths:
  - reject the exact operation and keep the feature slice blocked until source
    geometry is valid
- Forbidden usage:
  - silently clamp unsafe coordinates
  - changing coordinate scale in product helpers
  - using a backend-specific mapper that produces different hashes
- Complexity target:
  - `O(n)` over converted points
- Cache dependencies:
  - coordinate policy scale
  - coordinate policy rounding
  - coordinate policy epsilon
- Test references:
  - `packages/preset/src/__tests__/geometry-backend.test.ts`

### `partitionFacesFromCandidates`

- Purpose:
  - partition overlapping candidate faces into explicit face regions
- Inputs:
  - candidate body/join/cap faces
  - intersection metadata
  - selected `GeometryBackend`
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
- current numeric policy:
  - exact flattening target: `0.25 px`
  - preview flattening ceiling: `min(1.0 px, strokeWidth / 4)`
  - snap epsilon: `1e-6` model units
  - zero-area threshold:
    `max(1e-8, flattenTolerance * flattenTolerance * 0.25)`
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

Current Step 7 implementation note:

- `stroke-candidate-arrangement.ts` implements the backend-facing bridge for
  this contract.
- `buildStrokeArrangementCandidates` converts canonical bridge `FinalFace[]`
  into typed `CandidateRegion[]` with owner, network, stroke, interval, source
  span, source contour, legal-domain, paint, stroke-spec, visual-packet, and
  stroke-position metadata.
- `buildArrangedStrokeFinalFacesFromResolvedPackets` calls
  `GeometryBackend.buildArrangement` and converts partitioned arrangement faces
  back into exact `FinalFace[]`.
- when typed legal domains are provided, `buildArrangedStrokeFinalFacesFromResolvedPackets`
  runs `classifyArrangementFacesByLegalDomain` before side filtering. Backend
  legal state is not product authority for inside/outside.
- arrangement legal state is interpreted before final face emission:
  `inside` requires `insideFillDomain`, `outside` requires
  `outsideFillDomain`, and `center` bypasses side clipping.
- unknown candidate references from a backend are hard failures; they must not
  become empty render output.
- tests:
  - `packages/preset/src/__tests__/stroke-candidate-arrangement.test.ts`

### `classifyArrangementFacesByLegalDomain`

- Purpose:
  - turn backend-partitioned `ArrangementFace[]` into source-policy-aware
    legal-state faces before `inside` / `outside` filtering
- Inputs:
  - backend arrangement faces
  - typed legal-domain descriptors containing `legalDomainId`, source
    `fillRule`, and normalized `PolygonRegion[]`
- Outputs:
  - arrangement faces with `legalState.insideFillDomain` and
    `legalState.outsideFillDomain` recomputed from the legal-domain geometry
- Preconditions:
  - arrangement face polygons are finite and already partitioned by the backend
  - legal-domain regions represent the source fill domain or normalized
    `union(shells) - union(holes)` domain for compound paths
  - caller supplies source `fillRule`; the classifier must not hardcode
    `evenodd`
- Postconditions:
  - `nonzero` domains use winding classification
  - `evenodd` domains use parity classification
  - sample points on a legal-domain boundary count as inside to avoid seam
    flicker
  - if no legal domain is provided, existing backend legal state is preserved
    explicitly as a gated fallback
- Boundary conditions:
  - implementation chooses deterministic filled-region samples from area
    centroid, vertex average, edge midpoints, and bounded grid scans. This
    covers convex, concave, holed, and mixed multi-contour promoted slices.
  - if one backend face has mixed legal states, the classifier splits it before
    inside/outside filtering instead of returning one ambiguous face.
  - empty arrangement geometry preserves backend legal state and must remain
    diagnostic-visible
- Error cases:
  - non-finite legal-domain geometry
  - legal-domain descriptors that do not match the current source topology
  - classifier sample point cannot be chosen for a promoted exact family
- Allowed fallbacks:
  - keep authored-side local approximation visible when exact legal-domain
    classification is unavailable
  - preserve backend legal state only for non-promoted diagnostic paths
- Forbidden usage:
  - parsing owner, network, interval, or legal-domain identity from
    `geometryId`
  - using backend permissive legal state as product inside/outside authority
  - replacing closed authored `inside` / `outside` with center geometry
- Complexity target:
  - `O(F * D * P)` for `F` arrangement faces, `D` legal domains, and `P`
    legal-domain polygon edges, plus a bounded constant interior-sample scan per
    face; exact backend callers must cache domains per topology revision
- Cache dependencies:
  - arrangement face geometry
  - source fill-rule revision
  - legal-domain geometry revision
  - backend version and flatten tolerance
- Test references:
  - `packages/preset/src/__tests__/stroke-candidate-arrangement.test.ts`

### `promoteConstrainedDashedPacketsToExactArrangement`

- Purpose:
  - promote accepted constrained dashed product packets through the selected
    exact arrangement backend when available
- Inputs:
  - accepted constrained dashed resolved packets
  - active `GeometryBackend` from the registry
- Outputs:
  - exact arranged resolved packets projected from `FinalFace[]`, or the
    original local-side packets when exact promotion is unavailable
- Preconditions:
  - packets already preserve authored `inside` / `outside` stroke position in
    typed debug metadata
  - runtime diagnostics have accepted the candidate packet set
  - self-intersecting constrained dashed packets are not eligible for exact
    promotion until exact legal-domain clipping preserves valid internal dash
    regions
  - sampled-simple constrained dashed packets with
    `resolutionStatus: "local-side-approximation"` are not eligible for exact
    promotion until exact arrangement proves segment-local clipping parity and
    does not replace authored high-curvature intervals with fan-like faces
- Postconditions:
  - with a backend supporting `buildArrangement`, only eligible packets emit
    exact faces carrying `arrangementStatus: "exact"` and
    `resolutionStatus: "exact-constrained"`
  - all accepted network candidates for the current vector are arranged in the
    same promotion pass, so same-visual overlap can collapse into a shared
    `ownerSet`
  - vector product runtime appends promoted exact faces directly to its
    `strokeFinalFaces` source; compatibility packets are not required for
    vector render / hit-test / export projection
  - any remaining exact compatibility packets preserve `ownerSet`,
    `intervalIds`, `sourceSpanIds`, `sourceContourIds`, and `legalDomainIds` in
    typed debug metadata for downstream projections
  - without an exact backend, emitted packets remain visible
    `local-side-approximation` packets preserving authored side semantics
  - self-intersecting constrained dashed packets remain visible local-side
    packets even when a backend is selected
  - sampled-simple local-side constrained dashed packets remain visible
    local-side packets even when a backend is selected
- Boundary conditions:
  - zero packets return zero packets
  - backend with no arrangement capability returns original packets
  - backend arrangement failure returns original packets and must not emit center
    substitute geometry
- Error cases:
  - backend throws during arrangement
  - backend returns no final faces for an accepted visible packet set
- Allowed recovery paths:
  - keep local-side approximation visible and typed until exact promotion is
    repaired
- Forbidden usage:
  - center fallback
  - empty render output solely because exact backend is unavailable
  - reconstructing owner metadata from geometry ids
- Complexity target:
  - bounded by candidate count and backend arrangement complexity; must be
    dirty-key gated before animation-heavy exact promotion is enabled
- Cache dependencies:
  - backend cache signature
  - packet revision set
  - arrangement revision
- Test references:
  - `packages/preset/src/__tests__/vector-constrained-dashed-stroke.test.ts`

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

### `buildFinalFaces`

- Purpose:
  - convert accepted region packets or exact arrangement faces into canonical
    `FinalFace[]`
- Inputs:
  - accepted geometry packets or arrangement faces
  - paint payload identity
  - stroke spec identity
  - owner metadata
  - interval/source span metadata
- Outputs:
  - `FinalFace[]`
- Preconditions:
  - no product caller may pass blocked geometry as renderable final faces
  - owner metadata must be typed data, not parsed from `geometryId`
  - visual packet identity must be known before duplicate collapse
- Postconditions:
  - render, hit-test, and export projections can be derived without restroking
    authored input
  - exact duplicate regions collapse only when exact face ownership is proven
    and `visualPacketKey` matches
  - collapsed faces preserve `ownerSet`, `intervalIds`, `sourceSpanIds`, and
    `sourceContourIds`
- Boundary conditions:
  - empty packet set
  - one owner
  - multiple owners sharing the same visual face
  - same geometry with different paint or opacity
  - local-side approximation packets
- Error cases:
  - missing visual packet identity
  - invalid region bounds
  - missing owner metadata for exact multi-owner collapse
- Allowed recovery paths:
  - keep visually distinct packets separate
  - emit local-side approximation only when explicitly marked
- Forbidden usage:
  - using `FinalFace[]` to hide unsupported exact topology
  - opacity stacking for same-visual duplicate collapse
  - collapsing different paint, opacity, blend, mask, effect, clip, stack, or
    stroke spec
- Complexity target:
  - `O(faceCount)` for bridge packets without exact duplicate collapse
  - `O(exactFaceCount * signatureCost)` when exact duplicate collapse is
    enabled
  - arrangement-backed exact implementations may be higher, but must expose
    dirty-graph cache keys
- Cache dependencies:
  - resolved region revision
  - paint revision
  - stroke spec revision
  - ownership revision
  - legality revision
- Test references:
  - `solid-center-stroke-packets.test.ts`
  - `stroke-candidate-arrangement.test.ts`
  - future exact arrangement face-collapse fixtures

Current Step 8 implementation note:

- `collapseDuplicateFaces: true` is not enough to merge faces. The face must
  also have `arrangementStatus: "exact"`,
  `resolutionStatus: "exact-constrained"`, and `runtimeStatus: "accepted"`.
- `collapseExactDuplicateFinalFaces` is the exact-family collapse helper for
  already materialized `FinalFace[]`.
- local-side approximation packets are intentionally non-collapsible.

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
