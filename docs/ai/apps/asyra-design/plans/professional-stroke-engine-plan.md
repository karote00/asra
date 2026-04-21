# Architecture Spec: Professional Stroke Engine

## Document Role

This document is the architecture spec for the stroke engine.

It defines:

- canonical data models
- canonical stage boundaries
- decision rules that must not drift during implementation
- numerical robustness rules
- observability and migration requirements

It is not the rollout schedule.

The implementation sequence, phase gates, and temporary rollout limits live in:

- `docs/ai/apps/asyra-design/plans/professional-stroke-engine-execution-plan.md`

## Scope

Define the full stroke architecture required for a professional design tool.

This architecture covers:

- `solid` and `dashed` stroke geometry
- stroke positions:
  - `inside`
  - `center`
  - `outside`
- uniform width
- variable width
- join behavior:
  - `miter`
  - `round`
  - `bevel`
- cap behavior:
  - `butt`
  - `round`
  - `square`
- dash pattern allocation and rendering
- solid-color and gradient-color stroke paint
- render, hit-test, and export consistency
- cache / dirty propagation and runtime performance
- debug / observability tooling
- migration from legacy stroke paths

This is an umbrella architecture spec.

Subplans such as `inside dashed stroke` and `gradient stroke fill` must map to
this architecture instead of defining parallel engines.

## Goal

Build one stroke system whose geometry, paint, render, hit-test, and export
behavior are stable enough for professional vector design work.

The required outcome is:

- one canonical stroke authored model
- one canonical geometry pipeline
- one canonical legality / ownership pipeline
- one canonical paint pipeline
- one canonical render packet format
- one canonical cache / invalidation model

The system must not depend on mode-specific repair stacks.

Meaning:

- `solid` and `dashed` are variants of one pipeline
- `inside`, `center`, and `outside` are placement modes of one geometry model
- paint is applied to resolved visible stroke geometry
- joins, caps, width, dashes, and gradients must compose without changing the
  core pipeline shape

## Non-Negotiable Requirements

1. Geometry and paint must be separate systems.
2. No stroke mode may own a private geometry algorithm.
3. No paint mode may mutate geometry boundaries.
4. `solid` and `dashed` strokes must share the same placement and legality
   model.
5. `inside`, `center`, and `outside` must be resolved before paint.
6. Hit-testing must use the same resolved geometry family as rendering.
7. Export must use the same resolved geometry family as rendering.
8. Fallbacks may exist only as:
   - bounded topology-preserving decomposition
   - deterministic numerical recovery
   - explicitly tested cache-safe alternates
9. Fallbacks must not introduce scenario-named visual rules.
10. Temporary debug geometry must never become the product-facing render path.
11. Variable width must use the same ownership and legality architecture as
    uniform width.
12. Dash semantics must support pattern arrays and offset without splitting the
    engine into special paths.
13. Every product-facing stroke behavior must be covered by visual tests.
14. Every stroke algorithm must be covered by unit tests.
15. Scenario-family matrices define the primary stroke test structure; incident
    regressions are secondary and must map back to explicit families.
16. Every rendering issue review must explicitly check whether the current
    product semantics are intended before classifying the issue as a geometry
    or runtime bug.

## Geometry / Paint Separation Rule

The system must follow one invariant:

- geometry determines visibility
- paint determines color
- renderer determines projection

Meaning:

1. resolve stroke geometry first
2. resolve ownership and legality second
3. resolve paint field third
4. triangulate / rasterize last

There is no such thing as:

- separate gradient stroke geometry
- separate solid-color stroke geometry
- paint-driven clipping

There is only:

- final visible stroke geometry
- paint applied over that geometry

## Canonical Authored Model

### Base Types

```ts
type StrokePosition = 'inside' | 'center' | 'outside'
type StrokeJoin = 'miter' | 'round' | 'bevel'
type StrokeCap = 'butt' | 'round' | 'square'
type StrokeStyle = 'solid' | 'dashed'
type GradientSpace = 'local-bounds' | 'object-space' | 'world-space'
type PathOrientation = 1 | -1 | 0
```

### Paint Model

```ts
interface SolidStrokePaintSpec {
  kind: 'solid'
  color: RGBAColor
}

interface GradientStrokePaintSpec {
  kind: 'gradient'
  gradientId: string
  gradientSpace: GradientSpace
  stops: GradientStop[]
  transform: Mat3
  extendMode: 'pad' | 'reflect' | 'repeat'
}

type StrokePaintSpec = SolidStrokePaintSpec | GradientStrokePaintSpec
```

### Width Model

```ts
interface UniformStrokeWidthSpec {
  mode: 'uniform'
  width: number
}

interface WidthProfileStop {
  t: number
  width: number
}

interface ProfileStrokeWidthSpec {
  mode: 'profile'
  stops: WidthProfileStop[]
  interpolation: 'linear'
}

type StrokeWidthSpec = UniformStrokeWidthSpec | ProfileStrokeWidthSpec
```

### Dash Model

```ts
interface SolidStrokeStyleSpec {
  style: 'solid'
}

interface DashPatternSpec {
  style: 'dashed'
  pattern: number[]
  offset: number
}

type StrokeStyleSpec = SolidStrokeStyleSpec | DashPatternSpec
```

### Authored Stroke Spec

```ts
interface AuthoredStrokeSpec {
  strokeId: string
  version: number
  styleSpec: StrokeStyleSpec
  position: StrokePosition
  widthSpec: StrokeWidthSpec
  join: StrokeJoin
  cap: StrokeCap
  miterLimit: number
  opacity: number
  paint: StrokePaintSpec
}
```

### Stage 1 Normalization Rules

Normalization must produce a valid canonical stroke spec before any geometry is
constructed.

Required rules:

- `opacity` must be clamped to `[0, 1]`
- uniform `width` must be `> 0`
- width profile stop count must be `>= 2`
- width profile `t` values must be sorted, unique, and inside `[0, 1]`
- width profile widths must be `> 0`
- `miterLimit` must be `>= 1`
- dashed `pattern` must contain only positive finite values
- dashed `pattern` must not be empty
- odd-length dash patterns must be doubled during normalization
- `offset` must be normalized against total pattern length
- paint stops must be sorted and clamped to valid gradient stop ranges

Guaranteed post-normalization invariants:

- no stage after Stage 1 receives invalid width values
- no stage after Stage 1 receives negative or zero dash elements
- no stage after Stage 1 needs to guess whether dashed inputs are valid

## End-To-End Pipeline

### Stage 2. Canonical Path Geometry

Build one path model for the vector network.

Required data:

```ts
interface PathGuideFrame {
  distance: number
  t: number
  point: Vec2
  tangent: Vec2
  normalLeft: Vec2
  normalRight: Vec2
  curvature: number
  segmentIndex: number
}

interface PathSegmentRecord {
  segmentId: string
  kind: 'line' | 'quadratic' | 'cubic'
  start: Vec2
  end: Vec2
  control1?: Vec2
  control2?: Vec2
  startAnchorType: 'sharp' | 'smooth'
  endAnchorType: 'sharp' | 'smooth'
  arcLength: number
  bounds: Bounds
}

interface CanonicalPathModel {
  pathId: string
  closed: boolean
  totalLength: number
  orientation: PathOrientation
  segments: PathSegmentRecord[]
  cumulativeSegmentLengths: Float64Array
  sampledGuideFrames?: PathGuideFrame[]
}
```

Orientation semantics:

- `1`: closed path with positive orientation
- `-1`: closed path with negative orientation
- `0`: open path or degenerate closed path whose enclosed area is not stable

Rules:

- all downstream stages reference this path model
- no downstream stage may redefine path topology
- guide frames are cacheable derived data, not authored truth
- `orientation === 0` must never be treated as a valid closed-region orientation

### Stage 3. Stroke Placement Domain

Resolve the placement domain before solid / dashed branching.

Required data:

```ts
interface ClosedShapeConstraint {
  polygon: Vec2[][]
  orientation: 1 | -1
  fillRule: 'nonzero' | 'evenodd'
}

interface OpenPlacementDomain {
  position: 'center'
  signedCenterlineOffset: number
  signedOuterOffset: number
  signedInnerOffset: number
  requiresClosedShapeConstraint: false
}

interface ClosedPlacementDomain {
  position: 'inside' | 'outside'
  signedCenterlineOffset: number
  signedOuterOffset: number
  signedInnerOffset: number
  requiresClosedShapeConstraint: true
  closedShapeConstraint: ClosedShapeConstraint
}

type StrokePlacementDomain = OpenPlacementDomain | ClosedPlacementDomain
```

Rules:

- `inside` and `outside` require a valid closed-shape constraint
- open paths do not support `inside` or `outside`
- self-intersecting closed paths must declare the fill rule used to derive
  legality
- `orientation === 0` may not produce `inside` or `outside` legality
- placement legality is defined here, not later by ad hoc clipping

### Stage 4. Interval Allocation

Produce one canonical interval stream for both solid and dashed rendering.

Required data:

```ts
type StrokeIntervalKind = 'visible' | 'gap'

interface StrokeIntervalRecord {
  intervalId: string
  strokeId: string
  kind: StrokeIntervalKind
  authoredIndex: number
  startDistance: number
  endDistance: number
  intervalLength: number
  wrapsSeam: boolean
  touchedSegmentIndices: number[]
  previousVisibleIntervalId: string | null
  nextVisibleIntervalId: string | null
}
```

Rules:

- `solid` normalizes to one full-length visible interval
- `dashed` normalizes to alternating visible / gap intervals
- interval lengths are measured on the canonical path arc length
- dash offset applies before interval stream emission
- cap rendering does not mutate nominal dash allocation
- interval allocation does not know anything about paint

### Stage 5. Interval Source Slice Extraction

Extract the exact source slice for each visible interval.

Required data:

```ts
interface SourceSliceFrame {
  point: Vec2
  tangent: Vec2
  normalLeft: Vec2
  normalRight: Vec2
  widthLeft: number
  widthRight: number
  segmentIndex: number | null
  joinAnchorType?: 'sharp' | 'smooth'
  joinSourcePoint?: Vec2
  joinIncomingTangent?: Vec2
  joinOutgoingTangent?: Vec2
}

interface SegmentOwnedSlicePiece {
  pieceId: string
  intervalId: string
  segmentIndex: number | null
  frames: SourceSliceFrame[]
  startKind: 'interval-start' | 'segment-transition'
  endKind: 'interval-end' | 'segment-transition'
}

interface VisibleIntervalSourceSlice {
  intervalId: string
  sourceFrames: SourceSliceFrame[]
  segmentOwnedPieces: SegmentOwnedSlicePiece[]
  sourceLength: number
}
```

Rules:

- this is still source geometry, not render polygons
- segment-owned pieces are first-class and must survive downstream
- variable width is already resolved onto the slice frames here
- no ownership or clipping happens here

### Stage 6. Stroke Band Construction

Build exact candidate stroke-band geometry for each visible interval.

Required data:

```ts
interface SegmentCrossSection {
  frameDistance: number
  center: Vec2
  leftPoint: Vec2
  rightPoint: Vec2
  tangent: Vec2
  widthLeft: number
  widthRight: number
}

interface StrokeBoundarySource {
  intervalId: string
  sourceSlice: VisibleIntervalSourceSlice
  outerBoundary: Vec2[]
  innerBoundary: Vec2[]
  centerlineReference: Vec2[]
  startCrossSection: SegmentCrossSection
  endCrossSection: SegmentCrossSection
  startCapIncluded: boolean
  endCapIncluded: boolean
}

interface StrokeFragmentPrimitive {
  primitiveId: string
  intervalId: string
  primitiveKind: 'body' | 'join' | 'cap'
  polygon: Vec2[]
  bounds: Bounds
  touchedSegmentIndices: number[]
}

interface StrokeCandidateGeometry {
  intervalId: string
  boundary: StrokeBoundarySource
  primitives: StrokeFragmentPrimitive[]
  candidatePolygons: Vec2[][]
}
```

Rules:

- this stage creates full candidate geometry
- joins and caps are part of the geometry result
- there must be no special-case algorithm named after corner families
- constrained positions must derive legal piece domains from exact piece slices
- the visible candidate geometry must preserve authored interval length semantics
- variable width must not fork this stage into a separate engine

### Stage 7. Global Overlap / Overlay Partition

Run the global conflict pipeline on candidate geometry.

Required data:

```ts
interface OverlapEdge {
  leftIntervalId: string
  rightIntervalId: string
}

interface ConflictComponent {
  componentId: string
  intervalIds: string[]
}

interface AtomicStrokeRegion {
  regionId: string
  componentId: string
  coverageSet: string[]
  polygon: Vec2[]
  bounds: Bounds
}
```

Rules:

- this stage is shared by solid and dashed whenever overlaps exist
- `solid` may degenerate to exclusive ownership, but still uses the same region
  model
- no pair-local repair may replace the overlay model

### Stage 8. Ownership And Visibility Resolution

Resolve which interval owns each atomic region.

Required data:

```ts
interface ResolvedRegionOwnership {
  regionId: string
  ownerIntervalId: string
  ownerStrokeId: string
  ownerPrimitiveKind: 'body' | 'join' | 'cap'
  polygon: Vec2[]
  bounds: Bounds
}

interface VisibilityBailoutRecord {
  componentId: string
  reason:
    | 'overlay-instability'
    | 'numeric-instability'
    | 'owner-tie-unresolved'
    | 'illegal-domain-missing'
  preservedPreviewIntervalIds: string[]
  preservedPreviewPolygons: Vec2[][]
}

interface VisibilityResolutionResult {
  ownedRegions: ResolvedRegionOwnership[]
  passthroughIntervals: string[]
  unresolvedBailouts: VisibilityBailoutRecord[]
}
```

Rules:

- ownership is a geometry decision
- paint is not involved
- bailout is component-local and must preserve preview geometry, not partial
  corruption
- ownership must be deterministic under candidate traversal reorder

### Stage 9. Final Legality Clipping

For constrained positions, clip only true overflow against the legal owner
domain.

Required data:

```ts
interface LegalPieceDomain {
  pieceId: string
  polygons: Vec2[][]
}

interface LegalOwnerDomain {
  ownerIntervalId: string
  polygons: Vec2[][]
}

interface FinalVisibleStrokeGeometry {
  strokeId: string
  intervalId: string
  polygons: Vec2[][]
  bounds: Bounds
}
```

Rules:

- `actual_overflow = actual_geometry - legal_owner_domain`
- only non-empty overflow may enter clipping helpers
- unconstrained geometry must not be routed through clipping helpers
- legality never changes interval identity

### Stage 10. Paint Field Resolution

Apply paint only after final visible geometry is resolved.

Required data:

```ts
interface SolidPaintUniforms {
  rgba: [number, number, number, number]
  opacity: number
}

interface GradientPaintUniforms {
  gradientSpace: GradientSpace
  transform: Mat3
  stopOffsets: Float32Array
  stopColors: Float32Array
  extendMode: 'pad' | 'reflect' | 'repeat'
}

interface LocalBoundsPaintField {
  fieldId: string
  strokeId: string
  bounds: Bounds
  paint: StrokePaintSpec
}

interface StrokePaintPacket {
  strokeId: string
  geometryId: string
  fieldId: string
  paintKind: 'solid' | 'gradient'
  uniformPayload?: SolidPaintUniforms
  gradientPayload?: GradientPaintUniforms
}
```

Rules:

- geometry does not know color
- paint does not change geometry
- gradient sampling uses the authored paint field and the final visible geometry
  only

### Stage 11. Triangulation And Render Packet Build

Build GPU-ready packets from final visible geometry plus paint.

Required data:

```ts
interface StrokeRenderMeshPacket {
  geometryId: string
  strokeId: string
  vertexPositions: Float32Array
  vertexCoverageUV?: Float32Array
  vertexLocalBoundsUV?: Float32Array
  indices: Uint32Array
  paintPacketId: string
  bounds: Bounds
}

interface StrokeHitTestPacket {
  geometryId: string
  polygons: Vec2[][]
  bounds: Bounds
}
```

Rules:

- triangulation must not invent geometry
- `vertexCoverageUV` is used only by coverage-aware antialiasing or procedural
  fragment shading paths
- `vertexLocalBoundsUV` is used only by local-bounds paint sampling paths
- hit-testing must use the same final geometry family
- export packets must reuse the same resolved geometry source

## Ownership Resolution Rules

Stage 8 must follow one deterministic priority table.

### Region Classification Rule

Ownership priority may run only after every atomic region has been classified
geometrically.

Required classification rules:

- `body` region:
  - the region lies inside the swept band between consecutive source-slice
    cross-sections
  - the region is not introduced solely by a segment-transition expansion
  - the region is not introduced solely by a terminal cap closure
- `join` region:
  - the region is introduced by a segment-transition connection between two
    consecutive slice pieces
  - the region touches the join anchor fan and would disappear if the two body
    sweeps were not bridged
- `cap` region:
  - the region is introduced by terminal closure at the authored interval start
    or end
  - the region lies within the cap owner's terminal cross-section envelope

Forbidden:

- using priority rules to classify geometry
- labeling a region as `join` or `cap` only because `body` lost a tie-break
- allowing one atomic region to belong to multiple primitive classes for the
  same interval after classification

### Geometric Classification Predicates

Classification must use explicit geometric predicates with shared tolerances.

Required predicate rules:

- `body` predicate:
  - the region centroid or clipped test sample lies between consecutive
    cross-sections on the source-slice sweep axis
  - the region remains after subtracting join fan polygons and terminal cap
    polygons from the interval candidate
- `join` predicate:
  - the region intersects the canonical join fan polygon for the segment
    transition
  - the region lies outside both adjacent body sweep slabs after tolerance-aware
    projection
- `cap` predicate:
  - the region intersects the canonical start-cap or end-cap closure polygon
  - the region lies within the terminal cross-section envelope expanded only by
    `pointMergeEpsilon`

Classification stability rules:

- all predicates must use the shared tolerance family
- classification must be invariant under candidate traversal reorder
- if a region satisfies multiple predicates after tolerance expansion, the
  classification step must shrink to canonical subregions before ownership
  priority runs
- if canonical subregion splitting is numerically unstable, the whole component
  must bail out rather than jitter between classes

### Primitive Priority

When two candidate primitives compete for the same atomic region:

1. same-interval primitives merge before ownership
2. `body` beats `join` if the region lies on the interval's continuous body
   sweep
3. `join` beats `cap` when the region belongs to a segment-transition corner
4. `cap` beats foreign `body` only if the region lies inside the cap owner's
   authored interval terminal span

### Interval Priority

When multiple intervals still compete after primitive priority:

1. same-stroke continuity-preserving owner wins
2. lower normal-distance-to-source-slice wins
3. lower start-distance wins
4. lower authored visible interval index wins
5. stable interval id wins

### Bailout Trigger

Ownership must bail out for the component if:

- the overlay partition is numerically unstable
- the owner set cannot be made deterministic under the above rules
- the legality source required for constrained ownership is missing

## Legality Resolution Rules

Stage 9 must follow one fixed rule table.

### Supported Legality Modes

- `center`: no legality clipping
- `inside`: constrained by closed-shape interior
- `outside`: constrained by closed-shape exterior envelope

### Open Path Rule

- open paths support `center` only
- open paths reject `inside` and `outside` during Stage 3 normalization

### Self-Intersection Rule

- self-intersecting closed paths must declare the fill rule used for legality
- legality domains use the same declared fill rule throughout the pipeline
- if the fill rule cannot be evaluated stably, the constrained stroke must
  bail out before final clipping

### Legality Source Rule

- legal piece domains derive from exact segment-owned slice pieces
- legal owner domains derive from the ownership result plus those exact piece
  domains
- legality is computed after ownership, not before

### Canonical Polygon Form Rule

All legality-domain construction and clipping stages must use one canonical
polygon representation and one polygon-boolean engine configuration.

Required rules:

- Stage 3, Stage 7, and Stage 9 must exchange legality polygons in the same
  winding-preserving polygon form
- fill-rule evaluation for self-intersection legality must use the same polygon
  representation as final clipping
- polygon normalization, winding, and hole encoding must not drift by stage
- legality-domain caches must store canonical polygon form, not ad hoc debug or
  engine-specific intermediates
- polygon boolean evaluation must run in normalized component-local coordinates
  before returning to document coordinates
- component-local normalization scale must be part of the legality-domain cache
  identity when boolean normalization is applied

### Topology Rule

- clipping may split polygons
- clipping may not merge different interval identities
- clipping may not erase non-overflow geometry

## Numerical Robustness Policy

Every stage must use one shared tolerance family.

```ts
interface NumericalTolerancePolicy {
  pointMergeEpsilon: number
  collinearityEpsilon: number
  parallelEpsilon: number
  minSegmentLength: number
  minIntervalLength: number
  polygonBooleanEpsilon: number
  miterCollapseAngleEpsilon: number
}
```

Required rules:

- no stage may define a private epsilon family
- near-zero segments must be normalized or rejected in Stage 2
- near-zero visible intervals must be normalized or removed in Stage 4
- near-parallel and near-collinear tests must use shared tolerances
- polygon boolean operations must use one shared boolean tolerance
- miter joins that exceed the stable miter envelope must degrade
  deterministically to bevel behavior
- serialization and cache keys must use deterministic rounding

## Miter Spike Policy

Miter joins must use one explicit acceptance rule. They may not be approved or
collapsed by ad hoc visual heuristics.

### Effective Join Angle

For a join between consecutive tangents `t_in` and `t_out`, define:

- `theta = acos(clamp(dot(normalize(t_in), normalize(t_out)), -1, 1))`
- `theta` is the unsigned turning angle in `[0, pi]`

If `theta <= miterCollapseAngleEpsilon`, the join is numerically unstable and
must degrade directly to bevel behavior.

### Effective Half Width

For uniform width:

- `effectiveHalfWidth = width / 2`

For variable width:

- `effectiveHalfWidth = max(widthLeft, widthRight) / 2`

This conservative rule is required so the acceptance test does not understate
the spike length when width varies across the join.

### Miter Acceptance Formula

Define the theoretical miter spike length:

- `miterSpikeLength = effectiveHalfWidth / sin(theta / 2)`

A miter join is accepted only if:

- `miterSpikeLength <= miterLimit * effectiveHalfWidth + pointMergeEpsilon`

Otherwise the join must degrade deterministically to bevel behavior.

### Near-Threshold Stability Rule

If:

- `abs(miterSpikeLength - miterLimit * effectiveHalfWidth) <= pointMergeEpsilon`

then the join is inside the threshold ambiguity band.

Required behavior:

- if the same authored join identity existed in the previous stable revision,
  preserve the previous accepted join classification
- otherwise choose bevel behavior conservatively

This rule is required to avoid frame-to-frame flipping near the miter boundary.

### Forbidden Miter Behavior

- do not accept a miter solely because the rendered spike looks visually small
- do not use a separate miter rule for dashed vs solid
- do not use a separate miter rule for inside vs center vs outside
- do not keep an over-limit miter and clip it later as a substitute for proper
  join degradation

## Degenerate And Edge-Case Policy

The engine must define behavior for degenerate inputs instead of leaving them
undefined.

Required cases:

- zero-length segment
- single-point path
- open path with `inside` or `outside`
- closed path with unstable orientation
- self-intersecting closed path with invalid legality fill rule
- near-zero dash elements after normalization
- near-zero width profile stops
- dash shorter than local join or cap extent
- gap collapse after dash-pattern normalization
- near-threshold miter joins
- over-limit miter spikes

Allowed outcomes:

- normalize to a stable canonical form
- reject during Stage 1 or Stage 3 normalization
- component-local bailout with preserved preview geometry

Forbidden outcome:

- silent scenario-specific geometry mutation later in the pipeline

## Dash Edge-Case Policy

Dash semantics must remain stable under extreme but valid authored input.

Required rules:

- dash allocation is always measured on canonical arc length
- cap and join construction may extend visible area, but may not rewrite nominal
  dash allocation
- very short visible dash intervals that normalize below `minIntervalLength`
  must be removed during Stage 4 normalization instead of creating degenerate
  geometry later
- gaps that normalize below `minIntervalLength` must collapse deterministically
  during Stage 4 normalization
- dash-pattern normalization must happen before seam-wrap handling
- seam-wrap handling must preserve authored interval order after offset

## Data Model And Performance Strategy

### Global Data Principles

1. Authored data is immutable per revision.
2. Derived geometry caches are revision-keyed.
3. Paint caches are independent of geometry caches.
4. Dirty propagation must be minimal.
5. IDs must be stable across frames when authored identity is unchanged.

### Canonical Cache Keys

```ts
interface StrokeCacheKeys {
  pathKey: string
  placementKey: string
  intervalKey: string
  sourceSliceKey: string
  candidateGeometryKey: string
  ownershipKey: string
  legalDomainKey: string
  paintFieldKey: string
  meshPacketKey: string
}
```

Cache-key composition requirements:

- `pathKey`: path revision + segment topology + canonical orientation state
- `placementKey`: `pathKey` + position + legality fill rule
- `intervalKey`: `placementKey` + normalized dash pattern + offset
- `sourceSliceKey`: `intervalKey` + width spec revision
- `candidateGeometryKey`: `sourceSliceKey` + join + cap + miter limit
- `ownershipKey`: `candidateGeometryKey` + overlap component membership
- `legalDomainKey`: `ownershipKey` + constrained-placement identity
- `paintFieldKey`: paint revision + opacity + gradient transform + gradient
  stops
- `meshPacketKey`: final geometry revision + paint field identity

### Recommended In-Memory Layout

Use split representations:

1. object records for authored / debug / graph identity
2. typed arrays for hot numeric paths

Recommended:

- `Float64Array` for cumulative lengths and precise geometry evaluation
- `Float32Array` for render vertices and paint sampling attributes
- `Uint32Array` for index and ownership references
- stable object maps for authoring and inspector surfaces

### Dirty Graph

```ts
AuthoredPathRevision
  -> CanonicalPathModel
  -> StrokePlacementDomain
  -> StrokeIntervalRecord[]
  -> VisibleIntervalSourceSlice[]
  -> StrokeCandidateGeometry[]
  -> Conflict / Ownership
  -> FinalVisibleStrokeGeometry[]

AuthoredPaintRevision
  -> LocalBoundsPaintField
  -> StrokePaintPacket
  -> StrokeRenderMeshPacket
```

This separation is required so that:

- changing gradient stops does not rebuild stroke geometry
- changing opacity does not rebuild ownership
- changing width or join invalidates geometry but not unrelated paint state

## Unified Behavior Matrix

The engine must support all combinations below without changing architecture.

| Style | Position | Paint |
| --- | --- | --- |
| `solid` | `center` | `solid` |
| `solid` | `center` | `gradient` |
| `solid` | `inside` | `solid` |
| `solid` | `inside` | `gradient` |
| `solid` | `outside` | `solid` |
| `solid` | `outside` | `gradient` |
| `dashed` | `center` | `solid` |
| `dashed` | `center` | `gradient` |
| `dashed` | `inside` | `solid` |
| `dashed` | `inside` | `gradient` |
| `dashed` | `outside` | `solid` |
| `dashed` | `outside` | `gradient` |

The allowed difference between combinations is:

- interval allocation
- placement legality
- paint field

The forbidden difference is:

- separate geometry engines by mode
- separate clipping engines by paint type

## Verification Requirements

### Geometry Contracts

- interval lengths remain authored-correct
- visible geometry follows true path slices
- joins and caps match the selected stroke spec
- inside / outside legality stays stable
- overlap ownership is deterministic
- variable width stays continuous and interval-faithful

### Paint Contracts

- solid paint is uniform over visible stroke geometry
- gradient paint samples from the authored field
- paint-only edits do not mutate geometry

### Render Contracts

- final polygons and mesh agree
- hit-test and visible render agree
- export geometry and visible render agree

### Degenerate Contracts

- invalid open-path constrained strokes are rejected deterministically
- unstable closed legality states bail out deterministically
- degenerate path inputs do not produce undefined geometry

### Golden Fixture Families

- single straight
- polyline corner acute
- polyline corner obtuse
- smooth cubic high curvature
- closed rectangle
- closed circle seam wrap
- star self-overlap
- dense dash pattern
- wide stroke miter boundary
- near-zero segment
- single-point path

### Performance Contracts

- no blanket full-document rebuild on local stroke edits
- no geometry rebuild on paint-only edits
- no full overlap solve outside dirty components
- dirty interval recomputation remains bounded

### Fuzz Contracts

- randomized path topology fuzzing must preserve determinism
- randomized dash-pattern fuzzing must preserve interval invariants
- randomized width-profile fuzzing must not fork ownership or legality rules

## Debug And Observability Requirements

The engine must ship with stage-level inspection support.

Required debug surfaces:

- source slice viewer
- candidate primitive viewer
- overlap graph viewer
- ownership region coloring
- legality domain overlay
- final polygon viewer
- mesh wireframe viewer
- bailout reason logger
- dirty propagation trace

These are delivery requirements, not optional diagnostics.

## Migration Requirements

Legacy stroke paths must be removed through a bounded migration plan.

Required migration rules:

- new and legacy engines may dual-run only behind explicit comparison gates
- rollout must happen by supported behavior slices, not by ad hoc bug families
- when the new engine bails out, fallback behavior must be explicit and tested
- render, hit-test, and export must migrate together once a slice is promoted
- no long-term half-new / half-old product path is allowed

## Bailout UX / Product Policy

Bailout is not only an engineering condition. It is also a product-state
contract.

Required product rules:

- a bailed-out component must remain visible and interactable
- hit-test on a bailed-out component must use the preserved preview geometry
- export on a bailed-out component must use the same preserved preview geometry
  or reject explicitly; it may not silently export a different geometry family
- the product must expose a degraded-state indicator or inspectable bailout
  reason whenever comparison mode or diagnostics are enabled
- product surfaces must not silently mix canonical geometry and bailout preview
  geometry for the same promoted slice

## Out Of Scope For First Delivery Slice

The architecture must support all features in scope, but the first execution
slice does not need to ship the full matrix at once.

Deferred from the first delivery slice:

- variable width production enablement
- world-space gradient production enablement
- export parity hardening for every exporter target

These are deferred in rollout only. They are not removed from the architecture.

## Exit Criteria

This architecture is satisfied only if the engine can demonstrate all of the
following:

- one canonical stroke geometry pipeline exists
- one canonical stroke paint pipeline exists
- `solid` and `dashed` both run through the same geometry architecture
- `inside`, `center`, and `outside` are all first-class and deterministic
- width, join, cap, miter, dash pattern, and dash offset are composition-safe
- solid and gradient paint are applied over final geometry, not mixed into
  geometry rules
- render, hit-test, and export consume the same final geometry family
- dirty propagation is bounded and formally tested
- numerical robustness rules are shared across stages
- debug and bailout surfaces are available for every stage
- no legacy mode-specific fallback remains on the product-facing render path
