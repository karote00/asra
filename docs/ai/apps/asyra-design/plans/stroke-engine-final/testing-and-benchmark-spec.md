# Testing And Benchmark Spec

## Role

This file defines the required test and benchmark contract for the final stroke
engine.

Every supported family must have:

- unit coverage for algorithm semantics
- visual coverage for user-visible behavior

Every high-cost editing path must have benchmark coverage.

## Basic Baseline Test Gate

The basic design-tool baseline may start implementation before every extreme
topology family is solved.

Baseline support tests must cover:

- simple closed rectangle, oval, and non-self-intersecting polygon
- compound constrained solid and dashed containment paths with shared
  legal-domain metadata, including nested depth-parity chains
- simple open line and simple open polyline
- `center`, `inside`, and `outside` alignment
- solid strokes and explicitly supported dashed stroke slices
- miter, bevel, and round joins
- none, round, and square caps
- render / hit-test / export parity for the supported slice

Baseline support tests must prove:

- stroke geometry is resolved against the legal visible domain
- compound holes invert the side relation relative to the filled legal domain
- open paths ignore `inside` / `outside` stroke alignment for geometry and
  render as center strokes. This is canonical open-path behavior, not a
  fallback.
- open paths do not emit constrained solid/dashed runtime diagnostics solely
  because the authored position is `inside` or `outside`.
- supported closed constrained dashed non-full-loop slices, including
  self-intersecting repeated dashed intervals, build from sliced source
  fragments and one-sided geometry, not from doubled-width center bands
- dash intervals are geometry/topology intervals, not paint or shader output
- constrained solid/dashed ownership and network routing are read from typed
  packet metadata, not by parsing `geometryId`
- unsupported edge families are explicitly absent or marked `research-gated`

Baseline tests do not need to prove exact support for:

- self-intersecting source paths
- non-containment multi-network overlap ownership beyond the supported simple
  closed global-diagnostics slice
- nested ownership chains beyond containment-depth legal-region parity
- high-curvature self-overlap requiring arrangement correctness
- decorated caps

## Mandatory Test Groups

- normalization invalid inputs
- zero-width / invisible stroke rejection
- odd dash pattern normalization
- negative offset normalization
- interval seam-wrap continuity
- exact-correct path algorithm fixtures
- compound legal-domain decomposition
- arrangement robustness and zero-area-face rejection
- representation conversion budget
- semantic-packet versus emission-batch parity
- hit/render/export packet parity
- dirty-key minimal invalidation
- archived unsupported slices remain absent

## Oracle Rules

Probe points alone are not sufficient for final-stroke validation.

For every supported exact family, the suite must choose at least one of these
stronger oracles in addition to simple probe checks:

- area or area-delta oracle
- boundary continuity oracle
- packet cardinality oracle
- owner/legal-domain metadata oracle
- forbidden-face absence oracle
- geometry-hash stability oracle

Minimum exact-family requirement:

- one point/probe oracle
- one metadata oracle
- one geometry-structure oracle

## Representation Validation Rule

At least one test group must verify:

- semantic packets remain individually traceable after render batching
- hit/export consumers can recover semantic-region truth without restroking
- repeated view-to-copy conversions are observable in profiling or counters

## Parameter-Trace Validation Rule

At least one test group must verify:

- one parameter edit produces the expected dirty-layer set
- one parameter edit reruns only the expected pipeline stages
- one authored-path fixture can be traced from topology family through final
  semantic regions
- one stroke-parameter edit invalidates stale hit-test geometry even when source
  path object identities are unchanged
- one vector render pass with multiple networks builds exactly one path geometry
  model per network, regardless of how many stroke packet families consume it

The authoritative trace model lives in `parameter-impact-matrix.md`.

## Exact-Correct Algorithm Validation Rule

Before any high-curvature, acute-corner, miter-sensitive, self-overlap, or
self-intersection family is supported, tests must cover the algorithm branch in
`exact-correct-path-algorithm.md`.

The tests must include:

- one fixture where miter remains below limit
- one fixture where miter exceeds limit and emits bevel geometry while staying
  in the supported exact family
- one open dashed Figma fixture proving whether half-dash endpoint behavior
  applies to the supported family
- one odd dash-pattern normalization fixture with an explicit Figma/SVG/Lottie
  compatibility decision
- one open-path fixture proving `strokeAlign: INSIDE` and
  `strokeAlign: OUTSIDE` resolve to the same geometry as center alignment
- one Figma MCP compound-hole fixture proving inside stroke follows legal filled
  regions rather than raw contour orientation
- one high-curvature fixture that creates candidate self-overlap
- one overlap fixture that proves duplicate candidate layers collapse into
  semantic regions
- one self-intersection fixture that verifies support state remains gated until
  face semantics are declared

The miter-limit fixture must assert both geometry and status:

- geometry has bevel coverage, not an unstable spike
- runtime status is exact supported join resolution, not
  `blocked` or `research-gated`
- normalization maps Figma-style `miterAngle` to SVG-style `miterLimit`:
  `28.96` degrees is approximately `4`, `180` degrees is `1`, and `0` degrees
  is infinite rather than the default threshold

Current Phase 3 coverage:

- `packages/preset/src/__tests__/constrained-solid-stroke-geometry.test.ts`
  verifies closed inside bevel join geometry, closed miter-limit exceedance to
  bevel geometry, and round join construction
- `packages/preset/src/__tests__/constrained-solid-stroke-packets.test.ts`
  verifies constrained solid render/hit/export metadata parity for owner,
  contour, legal domain, source topology, topology family, geometry family,
  resolution status, runtime status, and runtime reason

Current implementation coverage:

- `packages/preset/src/__tests__/constrained-dashed-stroke-packets.test.ts`
  verifies constrained dashed full-loop render/hit/export metadata parity,
  interval-local single-edge one-sided geometry, and contour/legal-domain/
  topology metadata on full-loop and interval-local packets. It also verifies
  sampled-simple-closed `inside` and `outside` dashed paths emit visible
  interval-local one-sided packets instead of disappearing.
- `packages/preset/src/__tests__/primitive-shape-constrained-dashed-stroke.test.ts`
  and `packages/preset/src/__tests__/vector-constrained-dashed-stroke.test.ts`
  verify product-path accepted/blocked diagnostics for shape and vector
  constrained dashed slices

Current supported join/cap coverage:

- `packages/preset/src/__tests__/constrained-solid-ownership-diagnostics.test.ts`
  verifies the constrained solid arrangement policy, arrangement-face emission,
  exact subset partition method, and empty arrangement-face output for disjoint
  packets
- the same ownership diagnostics suite verifies overlap-heavy synthetic
  components produce typed face ownership without reading owner identity from
  `geometryId`
- `packages/preset/src/__tests__/constrained-solid-legality-clipping.test.ts`
  verifies legality clipping subtracts foreign-owned arrangement faces instead
  of subtracting packet groups or reparsing debug ids

Current supported paint coverage:

- `packages/preset/src/__tests__/constrained-solid-stroke-geometry.test.ts`
  verifies lower-level closed one-sided helper geometry and miter-limit bevel
  resolution. Product vector rendering does not route open paths through
  constrained geometry.
- `packages/preset/src/__tests__/vector-constrained-solid-stroke.test.ts`
  verifies open vector solid position changes preserve native center geometry
  and do not emit constrained runtime diagnostics
- `packages/preset/src/__tests__/vector-constrained-dashed-stroke.test.ts`
  verifies open vector dashed position changes preserve native center geometry
  and do not emit constrained runtime diagnostics

Current supported topology gate coverage:

- `packages/preset/src/__tests__/vector-constrained-solid-stroke.test.ts`
  verifies overlapping multi-network constrained solid vectors emit product
  packets after entering global ownership diagnostics
- `packages/preset/src/__tests__/vector-constrained-dashed-stroke.test.ts`
  verifies overlapping multi-network constrained dashed vectors emit accepted
  per-network runtime diagnostics with typed owner metadata
- existing self-intersection fixtures verify constrained solid/dashed paths
  remain constrained local-side geometry instead of silently falling back to
  center visibility

Current supported performance coverage:

- `packages/preset/src/__tests__/stroke-performance-contract.test.ts` measures
  the declared baseline CPU geometry workloads
- benchmark workloads:
  - 100 moving open points over 300 frames
  - one high-curvature cubic edit loop over 300 frames
  - one disjoint multi-network update path over 300 frames
  - Q8 reference fixture workload over 300 frames: two sine paths, twenty
    dashed rectangles, and ten irregular closed dashed polygons
- benchmark thresholds:
  - average fps must be at least `120`
  - p95 frame time must be at most `16.67ms`, matching the `60 fps` floor
- benchmark warmup:
  - first 20 frames are excluded from per-frame metrics
- benchmark environment:
  - Vitest/jsdom runtime in the project test environment
  - CPU geometry path only; GPU/browser claims require separate browser
    benchmark declarations before they can be used as product performance
    evidence

## Required Concrete Test Cases

### Case 1. Closed rectangle inside solid miter

- Input:
  - rectangle `(0,0)-(80,0)-(80,40)-(0,40)`
  - style `solid`
  - position `inside`
  - width `10`
  - join `miter`
- Expected output:
  - all resolved polygons stay inside the original contour
- Pass rule:
  - bounds never exceed `[0,80] x [0,40]`
  - probe `(81,20)` is `false`
  - no packet may contain a point outside the declared legal domain

### Case 2. Closed rectangle outside solid miter

- Input:
  - same rectangle
  - style `solid`
  - position `outside`
  - width `10`
  - join `miter`
- Expected output:
  - geometry exists only outside the contour band
- Pass rule:
  - probe `(40,20)` is `false`
  - packet metadata marks the family as exact constrained output, not substitute
    geometry

### Case 3. Open line center solid round cap

- Input:
  - line `(0,0)-(100,0)`
  - style `solid`
  - position `center`
  - width `10`
  - cap `round`
- Expected output:
  - rounded end extensions exist
- Pass rule:
  - `(-4,0)` and `(104,0)` are `true`
  - `(-4,-4)` is `false`

### Case 4. Closed rectangle center dashed miter

- Input:
  - rectangle `(0,0)-(80,0)-(80,40)-(0,40)`
  - style `dashed`
  - position `center`
  - width `10`
  - pattern `[87,20]`
  - join `miter`
- Expected output:
  - corner-spanning dash remains continuous
- Pass rule:
  - probe `(83,-3)` is `true`

### Case 5. Closed rectangle center dashed bevel

- Input:
  - same rectangle
  - style `dashed`
  - position `center`
  - width `10`
  - pattern `[87,20]`
  - join `bevel`
- Expected output:
  - outer square is cut away by the bevel diagonal
- Pass rule:
  - probe `(84,-4)` is `false`
  - probe `(81,-3)` is `true`

### Case 6. Closed rectangle center dashed round join

- Input:
  - same rectangle
  - style `dashed`
  - position `center`
  - width `10`
  - pattern `[87,20]`
  - join `round`
- Expected output:
  - visible curvature exists without a miter spike
- Pass rule:
  - `(83,-3)` is `true`
  - `(84,-4)` is `false`

### Case 7. Closed rectangle inside dashed full-loop round join

- Input:
  - same rectangle
  - style `dashed`
  - position `inside`
  - width `6`
  - pattern `[400,20]`
  - join `round`
- Expected output:
  - one full-loop exact constrained packet exists
- Pass rule:
  - packet count equals `1`
  - packet bounds equal original contour bounds
  - interval metadata reports one full-loop visible interval on the canonical
    arc-length basis

### Case 8. Closed rectangle outside dashed single-edge round cap

- Input:
  - same rectangle
  - style `dashed`
  - position `outside`
  - width `4`
  - pattern `[20,220]`
  - offset `220`
  - cap `round`
- Expected output:
  - only one single-edge visible packet exists
- Pass rule:
  - resolved interval count equals `1`
  - probes on unrelated edges are `false`

### Case 9. Shape/vector equivalence for constrained dashed full-loop round join

- Input:
  - shape rectangle
  - rectangle-equivalent vector
  - same `inside + dashed + full-loop + round join` stroke
- Expected output:
  - equivalent coverage
- Pass rule:
  - fixed probe set has identical results
  - packet cardinality, interval family, and legality status also match

### Case 10. Smooth oval outside dashed full-loop round join

- Input:
  - smooth oval loop
  - style `dashed`
  - position `outside`
  - full-loop visible interval
  - join `round`
- Expected output:
  - exact constrained packet accepted
- Pass rule:
  - runtime status is `accepted`
  - runtime status is not `blocked`
  - committed interval schedule is identical between preview and exact mode for
    the same topology revision

### Case 11. Sharp self-intersecting star constrained dashed

- Input:
  - sharp 5-point self-intersecting star
  - style `dashed`
  - position `inside`
- Expected output:
  - if exact self-intersection semantics are not supported, the state remains
    `research-gated` or `blocked`
- Pass rule:
  - support classification matches runtime status exactly
  - unsupported exact support is never reported
  - no packet is mislabeled as `supported` without declared face semantics

### Case 12. Open acute-turn constrained exact one-sided geometry

- Input:
  - open polyline with one acute turn
  - exact constrained support enabled
- Expected output:
  - chosen-side geometry only
- Pass rule:
  - no opposite-side ghost band appears at the turn
  - cap/join metadata remains side-specific rather than center-derived

### Case 12A. Simple open dashed inside alignment resolves to center geometry

- Input:
  - open line `(0,10)-(40,10)`
  - style `dashed`
  - position `inside`
  - width `4`
  - pattern `[400,20]`
- Expected output:
  - one dashed center packet exists
  - packet bounds are `[0,40] x [8,12]`
  - constrained dashed runtime diagnostics are absent
  - export packet metadata reports `geometryFamily: dashed-center`,
    `resolutionStatus: native-center`, and
    `runtimeStatus: not-applicable`
- Pass rule:
  - hit probes `(20,9)` and `(20,11)` are `true`
  - outside-width probes `(20,7)` and `(20,13)` are `false`
  - changing the authored position from center to inside does not change the
    resolved geometry family

### Case 12B. Self-intersecting open dashed inside alignment resolves to center geometry

- Input:
  - open polyline `(0,0)-(40,40)-(0,40)-(40,0)`
  - style `dashed`
  - position `inside`
  - width `4`
  - pattern `[400,20]`
- Expected output:
  - dashed center packets are emitted
  - constrained dashed runtime diagnostics are absent
  - packet metadata remains `geometryFamily: dashed-center` and
    `resolutionStatus: native-center`
- Pass rule:
  - render packet count is greater than `0`
  - hit area is present
  - no constrained packet is emitted for the open path

### Case 12C. Closed constrained dashed sampled/seam visibility

- Input:
  - sampled closed cubic loop
  - style `dashed`
  - position `inside`
  - width `4`
  - repeated pattern `[20,20]`
- Expected output:
  - constrained dashed packets are emitted as product geometry
  - center-derived substitute packets are not emitted
  - runtime diagnostics report accepted state
  - seam-wrapping intervals preserve `wrapsSeam: true` metadata when present
- Pass rule:
  - diagnostics report accepted entries
  - export packet count is greater than `0`
  - no product packet remains in `candidate` state

### Case 13. Multi-network outside dashed ownership typing

- Input:
  - multi-network closed vector
  - two disjoint closed networks
  - each network owns one outside dashed stroke
- Expected output:
  - owner metadata distinguishes the networks
  - each disjoint network is accepted independently
- Pass rule:
  - typed `ownerKey` exists
  - runtime classification never parses `geometryId`
  - each packet keeps one `networkId` only
  - runtime diagnostics contain one `accepted` entry per network
  - global multi-owner classification is not allowed to block disjoint
    per-network accepted packets

### Case 14. Animation benchmark: 100 moving points over 300 frames

- Input:
  - 100 points updating across 300 frames
- Expected output:
  - one topology model per network revision
  - frame rate target maintained
- Pass rule:
  - average frame rate `>= 120 fps`
  - minimum frame rate `>= 60 fps`
  - profiler counters show topology reuse
  - benchmark output declares runtime, hardware tier, warmup period, and sample
    window

### Case 15. Drag preview on high-curvature cubic path

- Input:
  - high-curvature cubic path
  - continuous control-point drag
- Expected output:
  - preview may reduce tessellation
  - topology family, ownership, and interval family remain stable
  - exact geometry restores after settle
- Pass rule:
  - preview and final classification match
  - final geometry hash equals exact baseline hash
  - preview uses the same committed interval schedule as exact mode

### Case 16. Compound closed path with one hole inside constrained solid

- Input:
  - donut-like compound path with one shell and one hole
  - style `solid`
  - position `inside`
  - width `8`
- Expected output:
  - geometry remains inside the declared legal fill domain
  - shell contour strokes inset toward the fill
  - hole contour strokes expand away from the hole interior into the fill
- Pass rule:
  - packets carry one stable shared compound `legalDomainId`
  - no face enters the hole interior
  - render, hit-test, and export packet metadata match
  - the equivalent dashed compound case emits the same legal-domain metadata and
    applies the same hole-side inversion

### Case 17. Tangential-touch robustness in arrangement

- Input:
  - one-sided candidate set with a tangential touch but no true crossing
- Expected output:
  - arrangement keeps tangential touch distinct from true crossing
- Pass rule:
  - no zero-area face is emitted
  - face count matches the declared robustness policy

### Case 18. Render/hit/export lifecycle metadata parity

- Input:
  - any accepted constrained dashed rectangle packet
  - render, hit, and export packets derived from the same resolved packet
- Expected output:
  - all three output families preserve the same typed lifecycle metadata
  - metadata includes owner, geometry family, resolution status, runtime status,
    and source topology
- Pass rule:
  - render packet `debugMeta` is the same object reference as resolved geometry
    `debugMeta`
  - hit packet `debugMeta` is the same object reference as resolved geometry
    `debugMeta`
  - export packet `debugMeta` is the same object reference as resolved geometry
    `debugMeta`
  - tests may use `geometryId` only as an opaque cache-key stability field, not
    as proof of owner, topology, stroke family, support state, or blocked state
  - no emitted product packet remains in `runtimeStatus: candidate`

### Case 19. Dirty-key minimal invalidation

- Input:
  - previous revision set and next revision set containing source path, stroke
    spec, interval allocation, topology classification, ownership, legality,
    paint, and preview/exact mode revisions
- Expected output:
  - paint-only changes dirty only paint payload and render/hit/export payloads
  - interval-only changes dirty interval allocation and downstream geometry
    stages, but not path topology
  - source path changes dirty every dependent geometry and payload stage
  - preview/exact transitions dirty numeric geometry and downstream payload
    stages while preserving support-family classification
- Pass rule:
  - missing or non-comparable revision fields throw explicit errors
  - returned dirty keys are deterministic and ordered by pipeline stage
  - no test accepts blanket invalidation as the default outcome

### Case 20. Overlapping multi-network constrained exact support

- Input:
  - vector with two closed rectangle-equivalent networks whose source bounds
    overlap
  - constrained solid `outside`, width `8`
  - constrained dashed `outside`, width `4`, pattern `[400,20]`
- Expected output:
  - constrained solid product packets are emitted after global ownership
    diagnostics are built
  - constrained dashed product packets are emitted per typed network owner
  - probes in outer stroke bands hit; probes in fill-only centers do not hit
- Pass rule:
  - export packet list contains accepted constrained packets for both networks
  - dashed diagnostics have `acceptedCount = 2`, `blockedCount = 0`
  - dashed diagnostics expose arrangement candidates for both networks and an
    overlap edge when source bounds overlap
  - solid ownership diagnostics expose at least two candidates and at least one
    overlap edge

### Case 20A. Multiple constrained dashed strokes on one source

- Input:
  - rectangle `(0,0)-(80,0)-(80,40)-(0,40)`
  - two dashed constrained strokes:
    - stroke `0`: inside, width `6`, pattern `[400,20]`
    - stroke `1`: outside, width `6`, pattern `[400,20]`
- Expected output:
  - both constrained dashed packets are emitted
  - each packet keeps its own typed `strokeId` and `ownerKey`
  - runtime diagnostics are accepted with reason `typed-owners`
  - arrangement diagnostics expose two candidates and owned overlap regions
- Pass rule:
  - render mesh count is `2`
  - export packet owner keys are `...:stroke:0` and `...:stroke:1`
  - diagnostics have `acceptedCount = 1`, `blockedCount = 0`
  - diagnostics do not contain the legacy multi-owner blocked reason

### Case 20B. Closed self-intersecting constrained solid local-side visibility

- Input:
  - closed bow-tie vector `(0,0)-(40,40)-(0,40)-(40,0)`
  - solid constrained inside stroke, width `4`
- Expected output:
  - product render emits constrained solid geometry instead of disappearing
  - export packet keeps `geometryFamily = constrained-solid`
  - source topology remains typed as `self-intersecting`
  - runtime diagnostics are accepted with one candidate packet
  - ownership diagnostics expose candidate-local positive-area self-overlap
    faces when local-side polygons overlap
- Pass rule:
  - render mesh count is `1`
  - export packet count is `1`
  - a probe inside the local-side stroke strip, such as `(2,5)`, is hit
  - arrangement/ownership diagnostics have at least one owned region whose
    candidate id belongs to the self-intersecting candidate
  - full legal-domain face ownership is not claimed by this test

### Case 20C. Closed self-intersecting constrained dashed full-loop remains visible as local-side approximation

- Input:
  - closed bow-tie vector `(0,0)-(40,40)-(0,40)-(40,0)`
  - dashed constrained inside stroke, width `4`, pattern `[400,20]`
- Expected output:
  - product render emits constrained dashed local-side approximation geometry
  - source topology remains typed as `self-intersecting`
  - interval topology is `full-loop`
  - runtime diagnostics are accepted because product visibility is preserved
  - exact face arrangement is not claimed
- Pass rule:
  - constrained dashed packet count is greater than `0`
  - every packet has `resolutionStatus = local-side-approximation`
  - accepted diagnostics count is `1`
  - no center-derived substitute packet is emitted

### Case 20D. Closed self-intersecting constrained dashed non-full-loop remains visible as local-side approximation

- Input:
  - closed bow-tie vector `(0,0)-(40,40)-(0,40)-(40,0)`
  - dashed constrained inside stroke, width `4`, miter join,
    `dashPattern: [27,20]`, `dashOffset: 0`
- Expected output:
  - product render emits constrained dashed local-side approximation geometry
  - source topology remains typed as `self-intersecting`
  - runtime diagnostics are accepted because product visibility is preserved
  - first dash is not allowed to disappear silently while later dashes render
- Pass rule:
  - constrained dashed packet count is greater than `0`
  - every packet has `resolutionStatus = local-side-approximation`
  - accepted diagnostics count is `1`
  - no center-derived substitute packet is emitted

### Case 20E. Duplicate polygon normalization before render / hit / export

- Input:
  - one resolved constrained stroke packet containing two identical polygons,
    one in forward order and one in reverse order
- Expected output:
  - render entries contain one polygon
  - hit-test packets contain one polygon
  - export packets contain one polygon
  - bounds remain the bounds of the retained polygon
  - if no duplicate polygon exists, render / hit / export keep the original
    geometry reference
- Pass rule:
  - duplicate packet polygon count is normalized from `2` to `1`
  - non-duplicate packet tests still assert shared geometry reference for
    render / hit / export

### Case 21. Baseline animation performance contract

- Input:
  - 100 moving open points over 300 frames
  - high-curvature cubic edit loop over 300 frames
  - three disjoint moving closed networks over 300 frames
- Expected output:
  - supported exact geometry path remains within declared performance targets
  - topology build count equals network count per frame for the multi-network
    workload
- Pass rule:
  - average fps is at least `120`
  - p95 frame time is at most `16.67ms`
  - topology build count equals `frameCount * networkCount`

## Benchmark Rules

- every benchmark must identify the stage it is testing
- every benchmark must specify the data scale
- every benchmark must specify the pass threshold
- every benchmark must specify whether it measures preview or exact mode
- every benchmark must specify runtime, hardware tier, warmup period, and sample
  window
- every benchmark must specify whether the pass rule uses fps or frame-time
  metrics

## Failure Rule

If a test reveals a mismatch between:

- support semantics
- runtime output
- helper contract
- benchmark expectations

then the fix must begin by updating the active docs in this folder before
claiming completion.
