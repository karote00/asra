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
- one open dashed fixture proving zero-offset true arc-length pattern behavior
  and one explicit-offset fixture proving non-zero `dashOffset` uses the same
  phase-shifted arc-length pattern without endpoint rebalancing
- one odd dash-pattern normalization fixture with an explicit Figma/SVG/Lottie
  compatibility decision
- one open-path fixture proving `strokeAlign: INSIDE` and
  `strokeAlign: OUTSIDE` resolve to the same geometry as center alignment
- one Figma MCP compound-hole fixture proving inside stroke follows legal filled
  regions rather than raw contour orientation
- one high-curvature fixture that creates candidate self-overlap
- one overlap fixture that proves duplicate candidate layers collapse into
  semantic regions
- one self-intersection fixture that verifies local-side output remains visible
  and unchanged when an exact backend is selected; selected-backend output must
  not promote to exact arrangement geometry until the arrangement oracle is
  fixture-proven
- one self-intersecting inside dashed outline fixture whose exact oracle is
  filled-component semantics, not center fallback visibility
- one self-intersecting outside dashed outline fixture proving outside has its
  own side-aware component structure
- one high-curvature inside dashed fixture proving selected-backend product
  output is exact constrained arrangement geometry and pre-clipped candidates
  are not treated as final exact faces
- one overlapping-hole compound fixture proving raw hole contours are
  normalized into legal-domain boolean regions before exact constrained dashed
  emission
- one flattened-union multi-network export fixture proving visible output plus
  metadata-preserving ownerSet fixtures for exact independent multi-network
  owner semantics

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

- `packages/preset/src/__tests__/path-topology-model.test.ts` and
  `legal-domain-normalization.test.ts` verify overlapping compound holes require
  backend boolean normalization before shared compound support
- `packages/preset/src/__tests__/vector-constrained-dashed-stroke.test.ts`
  verifies vector product runtime keeps overlapping holes separate without a
  backend and, with a selected boolean backend, places product dashes on
  normalized legal-domain boundary spans while preserving source contour/span
  owner metadata
- `packages/preset/src/__tests__/constrained-dashed-stroke-packets.test.ts`
  verifies self-intersecting inside/outside dashed packets remain side-aware
  local-side approximation packets instead of center-derived geometry
- `packages/preset/src/__tests__/constrained-dashed-stroke-packets.test.ts`
  verifies reported `vector-6` inside dashed packets do not place polygon
  vertices outside the selected-side legal domain at the closed-path seam. The
  regression uses authored anchor guard points and the authored `PathGeometry`
  segment chain so the first dash at a closed-path seam is constrained by the
  true previous source segment, not by a sampled endpoint tangent or an
  anchor-to-anchor chord. Endpoint intervals are endpoint-aware: a dash starting
  at the seam clips its start cap against the previous segment but must preserve
  the body that follows the next segment; a dash ending at the seam mirrors
  that rule by clipping against the next segment while preserving the body that
  follows the previous segment. Only a dash that spans through the seam clips
  against both adjacent segments at full crossing reach. Smooth anchors are not
  allowed to activate the guard. The same regression also verifies that every
  resolved dash packet keeps a source-edge point set on its
  `slicePathGeometryPoints` interval, so no dash body can be replaced by an
  endpoint tangent, and that interval polygons crossing another active authored
  sharp-boundary edge are clipped by that authored edge instead of retaining a
  tangent/cap cut, including seam-adjacent intervals that do not themselves
  contain the sharp seam vertex.
- `packages/preset/src/__tests__/constrained-dashed-stroke-packets.test.ts`
  verifies a generic, non-reported source-path constrained dash loop preserves
  a proportional set of authored `slicePathGeometryPoints` source-edge samples
  for every curved dash packet. This prevents future fixes from passing only
  the reported `vector-6` fixture while still drawing generic source-path
  dashes from endpoint tangents or legality-clip intersections.
- `packages/preset/src/__tests__/constrained-dashed-stroke-packets.test.ts`
  verifies reported `vector-6` seam end dashes clip against the start authored
  segment when their completed one-sided polygon crosses that segment. The pass
  rule requires boundary points on the start segment and nearest-segment
  selected-side legality, so Bezier clipping cannot be approximated by a global
  endpoint tangent or unrelated curve sample.
- `packages/preset/src/__tests__/constrained-dashed-stroke-packets.test.ts`
  verifies high-curvature inside dashed packets stay inside source legal bounds
  after final legality clipping
- `packages/preset/src/__tests__/vector-constrained-solid-stroke.test.ts`
  verifies overlapping multi-network constrained solid vectors emit product
  packets after entering global ownership diagnostics
- `packages/preset/src/__tests__/vector-constrained-dashed-stroke.test.ts`
  verifies overlapping multi-network constrained dashed vectors emit accepted
  per-network runtime diagnostics with typed owner metadata
- `packages/preset/src/__tests__/vector-constrained-dashed-stroke.test.ts`
  verifies overlapping hole vectors are not assigned the shared compound
  `legalDomainId` used by containment-only compound support
- existing self-intersection fixtures verify constrained solid/dashed paths
  remain constrained local-side geometry instead of silently falling back to
  center visibility

Current Figma reference fixture coverage obligations:

- `stroke-ref-01-self-intersecting-closed-inside-dashed`:
  - original SVG has one stroked path, five subpaths, dash pattern `[27,20]`
  - outline SVG has thirty-four filled subpaths
  - exact support must compare filled-component or face coverage, not merely
    visibility
- `stroke-ref-02-self-intersecting-closed-outside-dashed`:
  - original SVG has one stroked path, one subpath, dash pattern `[27,20]`
  - outline SVG has thirty-two filled subpaths
  - exact support must keep outside separate from inside; a shared center
    component model is invalid
  - current runtime support must keep self-intersecting inside/outside dashes
    visible as side-aware local geometry even when the exact backend is loaded;
    it must not promote this topology through the current exact clipping path
    because that path can remove valid internal dash regions
- `stroke-ref-03-high-curvature-cubic-loop-inside-dashed`:
  - original SVG uses a legal-domain mask plus pre-mask filled dash candidates
  - outline SVG has twenty filled subpaths
  - exact support must prove final packets contain post-legality regions only
  - without a selected exact backend, current runtime visibility support marks
    sampled-simple-closed interval-local constrained dashed packets as
    `resolutionStatus: "local-side-approximation"`
  - with a selected exact backend, accepted packets must promote to
    `resolutionStatus: "exact-constrained"` with exact arrangement metadata
- `stroke-ref-04-compound-overlap-holes-inside-dashed`:
  - original SVG mask has an outer shell and one merged inner hole
  - outline SVG has twenty-four filled subpaths
  - product support proves overlapping holes are boolean-normalized before
    stroke emission and that dashes are allocated from normalized boundaries,
    not raw overlapping hole contours
- `stroke-ref-05-Multi-network-overlap-outside-dashed`:
  - original SVG has one merged stroked contour, dash pattern `[28,16]`
  - outline SVG has sixteen filled subpaths
  - this fixture validates flattened-union visible output but is not sufficient
    to validate independent multi-network owner preservation

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

Current `FinalFace[]` contract coverage:

- `packages/preset/src/__tests__/solid-center-stroke-packets.test.ts`
  verifies existing resolved stroke packets can materialize canonical final
  faces
- tests assert typed owner metadata is preserved without parsing
  `geometryId`
- tests assert local-side approximation duplicates do not collapse and exact
  duplicate geometry collapses only when visual packet keys match
- tests assert different paint payloads keep duplicate geometry as separate
  final faces
- render, hit-test, and export packet projections must continue to derive from
  the same final-face source
- `packages/preset/src/__tests__/stroke-candidate-arrangement.test.ts`
  verifies the Step 7 backend bridge:
  - typed `CandidateRegion[]` construction
  - inside/outside legal-state filtering into distinct exact final face sets
  - typed legal-domain geometry overrides backend legal state before product
    side filtering
  - concave simple arrangement faces use an interior sample instead of a naked
    centroid-only classifier
  - same-visual ownerSet / interval / source-span merge on one arrangement face
  - exact duplicate arrangement faces collapse without opacity stacking
  - same-visual overlapping `FinalFace[]` records are backend-unioned before
    render / hit-test / export projection, so alpha is applied once over the
    unioned product region
  - same-visual overlapping inputs with opposite winding still produce one
    coverage layer and cannot cancel to a hole or zero-layer result
  - failed or empty backend union fails open to the original faces rather than
    deleting product coverage
  - vector render debug mode can bypass same-visual overlap collapse with
    `strokeDebugOptions.disableVisualOverlapCollapse === true`, while product
    default still collapses the same fixture before render / hit-test / export
    projection
  - any E2E that inspects raw overlap must enable
    `strokeDebugDisableVisualOverlapCollapse` inside that specific test step,
    must assert the debug state is active before capturing raw geometry, and
    must restore the property to `false` before the test exits. Product visual
    tests must not rely on a globally enabled debug state.
  - toolbar E2E verifies the development-only overlap-debug toolbar toggle
    updates `strokeDebugDisableVisualOverlapCollapse`, so debug inspection can
    be enabled without editing vector element data. Production builds must hide
    this debug UI unless explicitly built with
    `VITE_ASYRA_ENABLE_STROKE_DEBUG_UI=true`.
  - different visual packet keys stay separate on the same arrangement face
  - different opacity keeps overlapping faces separate because it changes
    `visualPacketKey`
  - non-overlapping same-visual faces skip backend union to avoid unnecessary
    boolean work
  - unknown backend candidate references fail loudly
- `packages/preset/src/__tests__/clipper2-geometry-backend.test.ts` verifies
  the Phase 9/13 backend adapter:
  - Clipper2 can be loaded and registered without product helpers importing the
    concrete backend
  - backend version, capability metadata, coordinate policy, and cache
    signature are deterministic
  - boolean, offset, and arrangement operations return real geometry
  - one multi-strip candidate is normalized into one arrangement face before
    partitioning, preventing visible internal dash seams and opacity
    multiplication
  - exact legal-domain clipping splits crossing arrangement faces with backend
    `intersection` / `difference` before inside/outside filtering
  - backend operation caches clone cached geometry before return
  - arrangement cache hits bind `claimedBy` to the current typed candidate
    objects instead of stale cached owners
- `packages/preset/src/__tests__/constrained-dashed-stroke-packets.test.ts`
  verifies high-curvature and reported `vector-6` inside dashed intervals emit
  one packet per dash interval, with bounded segment-cell polygons when a
  merged ribbon would create fan-like overlap. Every emitted cell polygon must
  be simple, remain within stroke-width distance of the authored sampled source
  path, preserve shared interval metadata, and stay bounded by local
  sharp-corner selected-side guards. Adjacent cells for the same smooth curve
  dash must share source/offset-boundary vertices so they connect rather than
  overlap as independent normal strips. Source-path intervals crossing authored
  segment boundaries must emit segment-local polygons instead of one inflated
  cross-segment fan, and cells touching segment boundaries must be clipped by
  adjacent authored segment tail/head polylines.
- `packages/preset/src/__tests__/vector-constrained-dashed-stroke.test.ts`
  verifies the Phase 10/12 product promotion path:
  - without an exact backend, authored inside/outside constrained dashed output
    remains visible as `local-side-approximation`
  - with a selected arrangement backend, accepted constrained dashed packets are
    promoted to `resolutionStatus: "exact-constrained"` with
    `arrangementStatus: "exact"`
  - multi-network constrained dashed candidates are promoted in one vector-level
    arrangement pass, and same-visual exact faces preserve every contributing
    network in `ownerSet`
  - backend-normalized overlapping compound-hole dashed vectors allocate product
    dashes on normalized legal-domain boundary spans and carry source contour /
    source span metadata into export packets
  - runtime diagnostics remain accepted and do not report blocked fallback

Current and future `FinalFace[]` fixtures:

- self-intersecting inside/outside dashed fixtures must prove stable visible
  side-aware local geometry with and without an exact backend selected. They
  must not expect exact promotion until the clipping oracle preserves internal
  dash regions.
- high-curvature inside/outside dashed fixtures include backend-gated exact
  promotion from visible local-side packets and real Clipper2-backed tests that
  compare side-specific final signatures separately for each side
- real backend arrangement fixtures partition self-intersecting and
  high-curvature overlapping candidates into owner-specific and shared faces
- broader holed / multi-contour arrangement fixtures must stay in the suite to
  prove filled-sample selection and mixed-legal-state splitting before those
  faces are used for self-intersection or high-curvature exact promotion
- future reference fixtures should add larger real-document visual parity and
  stress coverage, not redefine the product semantics

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
  - preview flattening tolerance does not exceed `min(1.0 px, strokeWidth / 4)`
  - exact flattening target is `0.25 px`

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

### Case 20B. Closed self-intersecting constrained solid exact arranged visual collapse gate

- Input:
  - closed bow-tie vector `(0,0)-(40,40)-(0,40)-(40,0)`
  - solid constrained inside stroke, width `4`
  - reported vector-6 self-intersecting closed star with the user-provided
    cubic/line segment topology, solid constrained inside stroke, width `10`,
    red alpha paint
- Expected output:
  - product render emits constrained solid geometry instead of disappearing
    only after this gate passes; before that point, this slice is
    implementation-in-progress and must not be documented as supported
  - selected-side source-span candidate polygons enter exact arrangement for
    same-visual overlap collapse
  - source self-intersections are not clipping boundaries by themselves
  - every authored segment in reported vector-6 remains visibly covered in the
    product render
  - same-visual opacity does not stack where candidates overlap
  - exact arrangement must not replace source-span candidates with a
    legal-domain-clipped fill that deletes crossing stroke coverage or creates
    a large bridge face
  - export packet keeps `geometryFamily = constrained-solid`
  - source topology remains typed as `self-intersecting`
  - runtime diagnostics are accepted and final projections share one collapsed
    face source for render / hit-test / export
- Pass rule:
  - reported vector-6 full global visual test passes with all five authored
    segments visible
  - reported vector-6 five endpoint local crops, five self-intersection local
    crops, and authored segment body local crops pass
  - red alpha overlap probes do not exceed the single-layer product threshold
  - render mesh count is `1` for one visual packet after collapse
  - export packet count is `1` for one visual packet after collapse
  - a probe inside the local-side stroke strip, such as `(2,5)`, is hit
  - arrangement/ownership diagnostics have at least one owned region whose
    candidate id belongs to the self-intersecting candidate
  - exterior probes around sharp vertices and high-curvature ends remain below
    the unsupported-coverage threshold
  - legal-domain clipping is not claimed by this test; the pass condition is
    authored-side source-span preservation plus same-visual overlap collapse
  - if any required visual crop or opacity oracle fails, implementation status
    remains `implementation in progress` and product support cannot be claimed

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
