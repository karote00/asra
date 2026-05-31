# Stroke Engine Final Plan

## Active Source Of Truth

Only these files define the current stroke refactor plan:

- `README.md`
- `stroke-flow-inspector.data.js`
- `stroke-flow-inspector.html`

Implementation, DoD, status, risk, E2E state, and step ordering must be read
from the inspector data. This README summarizes the active plan and must stay
in sync with that data. If any completed-history document disagrees with the
inspector, the inspector wins.

## Completed History Rule

Former stroke-engine-final markdown plan files have been moved unchanged to
`../completed/` with the `stroke-engine-final-` filename prefix. They are
historical decision records only.

Do not edit completed history files and do not use them as current
implementation guidance.

## Artifact Rule

Stroke artifacts are classified before staging:

- durable evidence belongs in `artifacts/committed/` and must be linked from
  this README, the inspector, a test, or a decision record
- transient diagnostic output belongs in `artifacts/transient/`, `tmp/`,
  `local/`, or `debug/`, which are ignored by Git
- legacy tracked files already under `artifacts/` remain historical evidence;
  do not move or rewrite them just to adopt the new folder split
- after a commit exists, artifact cleanup should be a new commit unless the user
  explicitly asks to rewrite history

## Current Figma-Like Stroke Contract

This plan is active and TDD-driven. The 2026-05-20 Figma filled-star review
reopened the self-intersecting inside dashed flow. The previous active plan
misclassified the central filled pentagon as an unfilled hole and accepted the
wrong inside stroke result.

Figma reference screenshots are rule-discovery evidence only. Automated gates
must encode generic stroke rules instead of comparing pixels against a fixed
reference image.

The active model is now **shared fill/mask domain evidence with separate solid
and dashed product models**:

- Figma vector fill truth is defined by vector regions / loops and each
  region's winding rule. `NONZERO` and `EVENODD` are both valid Figma rules;
  `NONZERO` is the default path rule unless the data explicitly says otherwise.
- Shared geometry must resolve planar faces, region membership, winding-rule
  basis, and adjacent face occupancy before stroke domains are selected.
- A self-intersecting central face is not a hole merely because of contour
  orientation, signed area, or an even-odd helper name. It is a filled face when
  the region/winding-rule evaluation says it is filled.
- `inside`: every filled face contributes to the inside mask domain. The
  central filled pentagon in the five-point star is inside-eligible and must be
  able to reveal inside constrained stroke after masking.
- `outside`: outside stroke belongs only to the exterior/unfilled outside of
  the filled shape. Filled-filled internal adjacency is not outside. A real
  unfilled hole is outside-ineligible for the global exterior stroke unless a
  separate Figma rule is captured and encoded.
- `center`: center strokes may use center-equivalent geometry for the family
  being tested, but center behavior cannot define inside/outside face rules.

Figma's plugin API defines `strokeGeometry` as center stroke regardless of
`strokeAlign`, and defines inside/outside as doubled stroke weight masked by the
fill. Figma also exposes `strokeJoin` as miter/bevel/round and
`strokeMiterLimit` for miter cutoff behavior. Those are the documented base
rules. The self-intersecting inside solid adjacency, join-reactive corner,
round source-envelope, and source-segment adherence rules in this plan are
Asyra Step 20 acceptance rules derived from captured Figma evidence; they must
stay identical in `PLANS.md`, this README, and `stroke-flow-inspector.data.js`
before implementation resumes. This plan therefore separates the product
models:

- `solidMaskModel`: solid inside/outside is equivalent to authored source
  center-stroke geometry at doubled width, preserving authored source-vertex
  `strokeJoin` and `strokeMiterLimit`, then applying the inside fill mask or
  outside exterior mask. This is a three-part contract:
  product geometry is the authored doubled center stroke, legality is the
  fill/exterior mask domain, and visible render projection is a masked
  source-stroke draw. Shared boundary domains are mask/provenance evidence, not
  the solid product path.
- Inside `solidMaskModel` has an additional anti-flood constraint: the visible
  stroke can reveal only the authored doubled source-stroke band inside filled
  regions. Filled-face polygons, boundary-domain full-face coverage, and
  exact-boolean fill-face flood polygons are not valid visible stroke geometry.
- Self-intersecting inside `solidMaskModel` has an additional adjacency
  constraint: the inside-fill mask must preserve face occupancy, winding, and
  filled-filled adjacency ownership. A binary filled-region union such as
  `union(fillRegions)` is not a complete Asyra Step 20 inside mask because it
  over-admits stroke at internal shared boundaries and can make every internal
  edge render full width. The upper-left Figma star crop requires local probes
  for the internal pentagon edge adjacent to the outer triangle, a normal-width
  comparison edge, the endpoint protrusion, and the shared-boundary width
  transition. Passing that slice is not enough: all five internal pentagon
  corner protrusions, diagnostic miter/bevel/round join-shape review, and the
  lower-left / lower-right high-curvature no-gap probes are required before the
  row can be promoted.
- Self-intersecting inside solid visible projection is valid only when the
  product-visible mask is the inside filled-region mask:
  `solidMaskModelVisibleMaskMode: 'inside-fill-source-stroke-clip'`. The
  renderer consumes the upstream authored doubled source-stroke path plus the
  filled-region clip. Face-owned fragments may remain Step 20 legality,
  coverage-oracle, hit/export, and diagnostic evidence, but they are not the
  product-visible render rule unless a separate Figma capture proves otherwise.
  Raw segmented source-stroke strips or path-stroke projection are rejected when
  they expose split intervals, detached tips, or doubled local fragments at
  join-reactive internal corners; the source-stroke side of the descriptor must
  be normalized/unioned before render. `binary-union-minus-shared-edge-reject`
  must be recorded only as rejected diagnostic provenance and is a Step 30
  failure if it reaches visible render. A visible mask assembled from edge
  strips, heuristic endpoint connectors, topology micro-tapers, or small-polygon
  filtering is likewise only a `boundary-strip-connector-approximation`
  diagnostic; it is not complete Asyra Step 20 parity.
- The render descriptor for that projection must be bounded. Step 20 may create
  raw face-owned edge strips while deriving the mask, but Step 24/25 must emit a
  normalized inside-fill render clip and normalized source center-stroke path
  through a render-only descriptor. Large render clip arrays, raw segmented
  source-stroke strips, and unused center-stroke polygon
  masks must not be copied into `debugMeta`, export packets, hit packets,
  inspector payloads, or the masked-source-stroke render cache signature. A
  correct visual mask that forces minute-long reloads is still a Step 25/30
  failure.
- Face-owned derivation clips must still prove bounded join-reactive
  source-stroke envelope coverage, but preservation must not depend on painting
  those clips as the product-visible mask. Step 24/25 must not carry raw
  edge-strip endpoints, tangent attach points, high-degree overlap vertices,
  accepted join polygon attach points, or small isolated internal-corner clip
  fragments as product-visible render boundaries. The right-upper internal
  pentagon corner is the focused root-cause guard: side-peaks, double-tips,
  pinholes, split rays, or a second local stroke layer there prove the visible
  render clip still contains derivation fragments. Bounded fragments may remain
  in diagnostics/coverage oracles, but the render descriptor must expose a single
  source-stroke envelope clipped by the inside filled-region mask.
- Self-intersecting inside `solidMaskModel` mask construction is face-owned:
  Step 20 intersects the authored doubled source-stroke candidate with each
  filled face occupancy domain before any same-paint union. Each result keeps
  face id, winding/occupancy, source span, mask side, and filled-filled adjacency
  side. Internal shared edges may reveal only the contribution owned by that
  filled face; two adjacent filled faces must not be unioned into one wider
  internal stroke band. Same-paint merging is allowed only after ownership
  metadata proves the merge cannot widen an internal shared edge or erase a local
  width transition.
- The internal pentagon endpoint protrusion in the upper-left crop is a legal
  source-stroke plus face-ownership result. Step 20/24/25/27 must not remove it
  through smoothing, overlap collapse, exact-boolean simplification, renderer
  clipping, topology tapering, small-polygon filtering, heuristic connector
  replacement, or alpha-overdraw workarounds. The same rule applies to all five
  internal pentagon corners, not only the first upper-left fixture.
- Internal pentagon face-corner protrusion shape is join-dependent. Step 20
  must preserve `strokeJoin` and `strokeMiterLimit` when it builds the
  face-owned source-stroke clip around true self-intersection face corners.
  Fixed circular self-intersection node masks, fixed endpoint connectors, and
  fixed wedges are rejected visible-render strategies. Accepted records expose
  `solidMaskModelInternalCornerJoinMode:
'stroke-join-aware-face-corner'` and
  `solidMaskModelJoinEligibilityMode: 'internal-face-only'`; rejected shortcuts expose
  `solidMaskModelRejectedInternalCornerJoinMode: 'fixed-round-node-mask'` or
  `'fixed-endpoint-connector'` and fail Step 30.
- Join-aware face-corner geometry is not applied to every filled-face corner.
  Step 20 must classify corners before adding any join-shaped protrusion:
  `join-reactive corner` means a true self-intersection node exposed by
  central/internal pentagon face ownership, and may respond to `strokeJoin` /
  `strokeMiterLimit`; `mask-only corner` means an outer-triangle corner,
  non-pentagon filled-face corner, mask polygon vertex, or ordinary
  shared-boundary width transition, and must remain face-owned mask clipping.
  Mask-only corners must not change between miter, bevel, and round except for
  anti-alias-level differences, and must not receive miter spikes, bevel cuts,
  round lobes, or join-generated protrusions.
- Join-reactive internal pentagon face-corner geometry must be bounded by the
  face-owned source-stroke clip. Bevel corners must not overreach or leave
  antialiased seam cracks inside the accepted stroke area; miter corners must
  obey `strokeMiterLimit`; round corners must be generated from smooth bounded
  arc geometry rather than low-segment interpolation. Faceted round joins,
  bevel crack seams, or join polygons that escape the face-owned envelope fail
  Step 20 and Step 30.
- Join-reactive round corner supplements are only allowed to bridge face-owned
  derivation strips to the authored doubled source-stroke round envelope. Their
  arc radius is bounded by `stroke.width` from the true self-intersection node;
  tangent attach overlap may extend derivation transitions along adjacent edges,
  but it must not inflate the arc radius or draw a separate corner layer. A
  round supplement that
  creates disconnected inner/outer stroke layers, grey/white pinholes, or a
  two-lobe shape at 2000% local zoom is a Step 20 failure even when the lower
  resolution single-lobe or angle-bucket unit probe passes.
- Smooth geometry is mandatory for stroke repairs by default. Any new round
  join/cap, curved clip, high-curvature continuity patch, or source-stroke
  visible projection must include enough bounded points for smooth display and
  must be paired with a deterministic smoothness/no-crack probe when the visual
  shape is part of the acceptance criteria.
- The five authored outer source vertices / outer star tips are also legal
  source-stroke joins. Face-owned inside clipping must not shave them away. A
  bounded render-only source-vertex clip fragment is allowed only when paired
  with the filled-region clip; it must not become exact coverage, hit/export
  geometry, full diagnostics payload, or a render cache signature input.
- Non-corner source-segment adherence is a separate inside-solid requirement:
  lower-right / right-bottom source-stroke bands must stay attached to the
  authored segment under the face-owned mask. A grey fill wedge or black
  background wedge between the original segment and visible stroke is a Step 20
  legality/projection failure, even when internal pentagon width probes pass.
  This probe is one-sided source-stroke contact on the authored segment, not a
  requirement that both sides of the segment carry red stroke paint.
- `solidMaskModel` exact boolean coverage may be used as a legality, hit-test,
  export, or diagnostic oracle. It must not become the self-intersecting
  outside solid visible-render polygon when the boolean result is represented by
  flattened annulus contours with bridge/cut seam edges; those seams are
  implementation artifacts and must not be painted.
- `dashIntervalModel`: dashed inside/outside uses selected boundary split
  domains as interval domains. Every selected split segment is an independent
  dash domain, both ends receive dashed terminal half-dash coverage, the
  interior dash/gap rhythm is solved before emission, caps are additive after
  butt interval allocation, and no dash continuity crosses a true split
  boundary.
- `sharedDomainEvidence`: Step 12/14 filled faces, exterior, filled-filled
  adjacency, holes, boundary domains, and split ranges feed mask/domain
  selection, provenance, diagnostics, and probes. They must not be promoted into
  solid product geometry.
- Runtime and diagnostics are separate data channels. Normal app render/reload
  uses `StrokeDiagnosticsMode: 'off'` and may carry only bounded runtime
  metadata needed for render/cache/routing. Full `debugMeta`, boundary points,
  face ownership traces, probe arrays, inspector provenance, and
  `__asyraConstrained*Diagnostics` objects are emitted only when tests or the
  inspector explicitly opt in to `StrokeDiagnosticsMode: 'full'`; `summary`
  diagnostics must remain bounded and cannot include polygons or point arrays.

Invalid current or historical rules:

- Treating `hole` as a generic label for self-intersecting internal faces.
- Classifying hole/outer solely from contour signed area or orientation.
- Hardcoding even-odd containment for all self-intersecting filled-region
  decisions.
- Using source-path orientation, selectedSide metadata, visible fill paint,
  packet order, rendered pixels, or renderer repair as the inside/outside
  authority.
- Claiming completion when the central filled face of the Figma star does not
  have inside constrained solid/dashed stroke.
- Treating boundary-domain coverage as solid product geometry instead of
  mask/provenance evidence.
- Treating an inside filled face as stroke paint, causing face-wide red flood or
  fill interior erosion instead of a clipped source-stroke band.
- Letting dashed terminal/cap metadata or split-end cap behavior define a solid
  join, miter, or high-curvature shape.
- Treating outside solid `exact-boolean` flattened polygons as seam-free visible
  render geometry when they expose bridge/cut edges between mask contours.

Completion definition:

- Every Figma stroke family exposed by the product has a verified behavior
  oracle, implementation, diagnostics, and render/hit/export projection path.
- No product stroke family that Figma supports may remain blocked as
  unsupported.
- Step 30 validates the current product-exposed Figma stroke matrix through
  rule-driven visual gates, not fixed screenshot image comparison and not only
  one fixed star/split-range case.
- If a behavior is unknown or newly captured from Figma, it is outside the
  completion claim until a reference is captured, encoded as tests, and routed
  through the earliest owning step.

## Full Stroke Engine Completion Contract

The stroke engine is complete only when the active source-of-truth matrix is
closed. A passing self-check star, reported vector, cap family, join family, or
single topology is slice evidence only. It may unblock the next step, but it
must not close the engine.

The required matrix axes are:

- Topology: open paths, simple closed paths, compound closed paths with real
  unfilled holes, and self-intersecting closed paths.
- Stroke style: solid and dashed. Solid and dashed share upstream
  `sharedDomainEvidence` only; they do not share product geometry.
- Stroke position: center, inside, and outside. Open-path inside/outside must
  be verified against Figma and treated as center-equivalent only after tests
  prove that behavior for the exposed family.
- Fill state and fill rule: visible fill, hidden fill, absent fill paint,
  `NONZERO`, `EVENODD`, filled faces, real unfilled holes, and filled-filled
  internal adjacency.
- Geometry shape: straight segments, authored sharp vertices, authored
  smooth/tangent-continuous vertices, cubic high-curvature samples, true
  self-intersection split points, and near-degenerate segments.
- Solid presentation: `strokeJoin` miter/bevel/round, `strokeMiterLimit`,
  inside fill preservation, outside exterior masking, no split-end cap
  artifacts, no face-wide flood, no same-paint overlap darkening, and no
  exact-boolean bridge/cut seam in visible render.
- Dashed presentation: dash phase, per-domain terminal half-dashes, balanced
  redistributed interior gaps, butt base geometry, square/round additive caps,
  source-vertex joins only at authored sharp or tangent-discontinuous vertices,
  high-curvature continuity, and no cross-domain dash continuity across true
  self-intersection split boundaries.
- Projection and runtime: `FinalFace`, render, hit-test, export, diagnostics,
  drag finalization, refresh, reload, opacity/overlap, and performance.

Every matrix row needs the same evidence chain before it can be marked aligned:

1. A generic failing oracle derived from Figma behavior or an already captured
   rule, not a one-off screenshot pixel match.
2. Unit or packet tests at the earliest owning stage.
3. `FinalFace` / render / hit / export metadata proving model provenance,
   owner, legal-domain, face/region, source-span, interval when dashed, and
   visible-render descriptor when solid.
4. Deterministic E2E probes for final pixels.
5. Generated global screenshot plus local zoom crops for the relevant geometry
   risk areas.
6. Reload/performance evidence when the path can run on ordinary page refresh.
7. Immediate dashed regression gates after solid changes, and immediate solid
   regression gates after dashed changes.

Owner routing for new mismatches is fixed:

- Steps 1-10 own source data, state deltas, dirty keys, render-data
  normalization, and stroke-spec validation.
- Steps 11-14 own topology, fill-rule/face classification, shared
  fill/mask/domain evidence, holes, exterior, and filled-filled adjacency.
- Step 15 owns only dashed interval allocation.
- Step 16 owns provenance from source spans, source vertices, dash boundaries,
  and split points.
- Step 17 owns model-specific candidate geometry: doubled authored
  center-stroke candidates for solid, interval candidates for dashed.
- Steps 18-20 own arrangement, ownership, legality, mask clipping/filtering,
  overlap limits, and exact-coverage oracle boundaries.
- Steps 21-25 own canonical packet, `FinalFace`, render, hit, and export
  projection metadata.
- Steps 26-29 own projection-only render entries, renderer fidelity, hit/export
  projection, and diagnostics.
- Step 30 owns final visual proof only. It cannot repair upstream geometry and
  cannot mark a matrix row complete when deterministic probes or local review
  crops are missing.

Test suite structure is part of the contract. Follow
`docs/ai/apps/asyra-design/rules/testing-contracts.md` and
`docs/ai/apps/asyra-design/rules/geometry-scenario-testing.md`: tests must be
partitioned by behavior contract, scenario family, runtime path, and
performance budget. A heavy spec that becomes slow enough to encourage
skipping, hides progress, or accumulates dozens/hundreds of unrelated small
cases must be split into named focused cases or sharded commands. Passing
output must clearly identify the behavior and invariant that passed without a
second diagnostic pass. The full dashed regression suite can run single-worker
or through documented shards, but no solid fix may skip dashed regression, and
no dashed fix may skip the solid mask-model regression gates.

## Global Rules

1. Vector data changes start in feature/input code and enter state only through
   common APIs, validation, and transaction-bounded mutation.
2. Render consumes committed state deltas. Render is never the authority for
   vector topology, stroke position, dash placement, legality, ownership,
   support, or product repair.
3. Stroke work is stage-owned and dirty-key driven: source path, normalized
   stroke spec, topology, shared geometry, source-family support, stroke
   domains, intervals, source spans, candidates, arrangement, ownership,
   legality, resolved regions, paint, FinalFace, render/hit/export,
   diagnostics, and final visual evidence.
4. Geometry is resolved before paint. Fill, stroke, hit-test, export,
   diagnostics, and future shadow attach paint/effects to canonical geometry.
5. Each vector network revision builds one shared `PathTopologyModel` and one
   shared resolved vector geometry model.
6. Open vector path inside/outside behavior must be verified against Figma
   reference behavior. It must not be assumed from the current implementation.
7. Simple closed inside/outside solid strokes may keep an existing direct
   one-sided implementation only when tests prove it is equivalent to the
   Figma doubled center-stroke plus fill/exterior mask contract.
8. Self-intersecting closed inside/outside solid and dashed strokes share
   filled-face/exterior domain evidence, but not product geometry. Shared
   geometry resolves filled faces, region loops, winding-rule basis, global
   exterior boundaries, real unfilled holes, filled-filled internal adjacency,
   and boundary split segments before model-specific consumption.
9. Solid constrained strokes use `solidMaskModel`: source center-stroke
   geometry at doubled width, source-vertex join/miter semantics, and an
   inside-fill or outside-exterior mask. Boundary split endpoints are not solid
   caps or joins, and boundary domains are only mask/provenance evidence.
   For self-intersecting inside solid, the inside-fill mask must preserve
   face/winding occupancy and filled-filled adjacency ownership; a binary
   filled-region union is a rejected shortcut, not Asyra Step 20 parity.
   Outside solid visible render must consume an upstream masked-source-stroke
   descriptor, not a flattened exact-boolean annulus polygon that can expose
   bridge/cut seam edges.
10. Dashed constrained strokes use `dashIntervalModel`: for every selected
    boundary split segment, both range ends receive dashed terminal half-dash
    coverage and the interior dash/gap schedule is evenly distributed within
    that range. Dash continuity must not cross a true self-intersection split
    boundary. A smooth/tangent-continuous authored source vertex on the same
    outside legal coverage is different: when the dash phase produces
    continuous visible coverage on both adjacent source segments, that
    continuity must be represented before candidate generation as one dashed
    coverage interval, not as two dashed terminal half-dashes stitched after
    packets exist.
11. Inside selects every filled face for the mask/domain evidence. Outside
    selects only filled-to-exterior evidence and excludes filled-filled internal
    adjacency.
12. Butt is the base dashed geometry. Square and round caps are dashed-only
    additive endpoint geometry attached after the base terminal dash intervals
    are allocated; the assembled dashed geometry then re-enters overlap,
    legality/mask, FinalFace, and render/export projection. A boundary split
    endpoint is a dashed terminal/cap boundary, not a line-join boundary. Only
    authored sharp or tangent-discontinuous source vertices are line-join
    boundaries: when visible dashed terminal half-dashes from adjacent source
    segments meet at the same authored sharp source vertex on the same legal
    outside boundary, dashed product geometry may emit `source-vertex-join`
    coverage that responds to miter/bevel/round. Authored
    smooth/tangent-continuous vertices and curve-internal high curvature are
    continuous offset-curve coverage, not join-type coverage; they must preserve
    same-coverage-unit continuity without using `boundary-terminal-join`.
13. Fill regions, winding rules, loops, and face classifications are
    `sharedDomainEvidence`. They must not be recreated downstream as
    replacement geometry and must not become solid product stroke paths.
14. Legality clips or filters existing candidate geometry only. For solid, it
    applies the fill/exterior mask to the doubled center-stroke candidate. For
    self-intersecting inside solid, Step 20 also owns adjacency-width clipping:
    the mask must be face/winding/adjacency-aware and must not degenerate into a
    binary `union(fillRegions)` clip that makes internal shared edges all
    full-width. For dashed, it filters/clips interval candidates by
    boundary-domain eligibility. It must not construct replacement center bands,
    authored source contour loops, boundary ribbons, or renderer fixes. Solid
    legality may keep exact boolean coverage as an oracle for
    hit/export/diagnostics, but it must also preserve a seam-free visible render
    descriptor for inside/outside mask projection.
15. Overlap is resolved before product `FinalFace`/render output when terminal
    provenance remains available. Raw overlapping fragments may exist only as
    diagnostics/debug evidence. For self-intersecting constrained dashed
    product strokes, visual-overlap partition/collapse is scoped to a visible
    dash coverage unit: same-interval fragments may be partitioned, but
    independent interval faces must not be merged into a new arranged face and
    boundary-terminal-join geometry must not enter product, render, hit, or
    export output. Boundary-terminal-join records are allowed only as explicit
    diagnostics, never as visible coverage or as replacement terminal
    provenance. Constrained dashed render projection may use
    `render-projection-arrangement` only as a paint projection from
    `FinalFace[]`; hit/export remain direct `FinalFace` projections, and
    renderer masks, `paint-composite` masking, and renderer repairs remain
    forbidden.
16. A single visible dash interval must remain one connected product coverage
    unit after legality/mask clipping. High-curvature outside clipping may prune
    tiny numeric residue or stitch same-interval clip fragments upstream, but the
    renderer must never draw a dash as disconnected slivers to hide a geometry
    failure.
17. Typed metadata carries owner, network, region, face, boundary, interval,
    source-span, support, blocked, dirty-stage, side-resolution, winding-rule,
    and revision state. Helpers must not parse `geometryId`, packet order, or
    rendered pixels to recover semantics. Product metadata must distinguish
    `solidMaskModel`, `dashIntervalModel`, and `sharedDomainEvidence`.
18. `FinalFace[]` is the canonical source for render, hit-test, and export
    projection. Renderer entries draw upstream `FinalFace`-derived geometry and
    upstream-provided solid visible-render descriptors faithfully and never
    repair stroke semantics. Consuming a `renderStrokePaths + renderMask`
    descriptor generated before projection is not renderer repair; inventing
    that descriptor in renderer code is.
19. Final visual E2E is an AI-reviewed product gate: deterministic probes and
    screenshot review must verify the Figma-like rules above, including
    boundary-domain dash placement, same-boundary adjacent gaps, central filled
    face inside stroke, outside exterior-only stroke, bounded legal clipping,
    solid miter/join parity, inside solid source-stroke continuity and bounded
    adjacency-width behavior, internal
    pentagon endpoint protrusion, no split-end cap artifacts in solid, no
    high-curvature solid cracks, no exact-boolean bridge/cut seam painted in
    outside solid render, no disconnected high-curvature dash slivers, and no
    double-opacity product overlap. Review evidence must include deterministic
    crack probes plus a global screenshot and local zoom crops for
    high-curvature anchors, self-intersection joins, mask boundaries, and the
    upper-left inside-solid adjacency crop before a visual fix can be called
    complete.
20. The current Step 13 matrix and Step 30 gates define the present completion
    claim for product-exposed Figma stroke behavior. Completion requires the
    full matrix coverage ledger in this document; one fixture, one cap family,
    one join family, one stroke position, or one topology slice is never enough.
    Any newly captured Figma mismatch reopens the earliest owning upstream step.
21. Self-intersecting solid mask-model packets must keep lightweight provenance
    diagnostics on the normal render/reload path. They must not run dashed-only
    interval allocation, dashed terminal/cap handling, boundary-domain product
    ribbons, or expensive ownership arrangement diagnostics unless a debug-only
    inspector mode explicitly asks for them.

## Sequential Implementation Plan

Implementation must follow these steps in order. A step is not complete until
its implementation, tests, diagnostics/evidence, inspector status/risk, and
self-review are complete. Do not patch downstream render output to hide an
upstream failure.

Specification-first rule for the remaining stroke work:

- Captured Figma mismatches first update this README, `PLANS.md`, and
  `stroke-flow-inspector.data.js` until the contract, owner step, failure
  signals, and acceptance gates are consistent.
- After that contract is frozen, implementation may not add new local stroke
  rules while coding. If focused unit/integration tests prove the frozen
  contract is wrong, stop implementation and update all three active
  source-of-truth files before resuming.
- Root cause must be proven by focused unit/integration tests that inspect
  helper output, packet/render descriptors, and product-visible fragments.
  Screenshot review remains mandatory final acceptance evidence, but it is not
  the primary root-cause method.

Current execution state:

- Plan status: `complete-current-product-figma-like-stroke-matrix`.
- The 2026-05-31 generated inside solid self-check star artifact proved the
  previous Step 30 completion claim was invalid: product-visible stroke could be
  fragmented while local probes and matrix status still passed.
- The first repaired owner is the Step 24/25 visible-render descriptor path:
  inside solid visible render now draws the doubled authored source stroke
  through the Figma base inside fill mask. Face-owned mask fragments remain
  legality/diagnostic evidence and must not be exposed as the only
  product-visible source-stroke clip unless a separate Figma capture proves that
  behavior.
- `e2e/stroke-self-check-star-solid-visual.spec.ts` now includes a global
  source-path / visual-fragmentation oracle. The focused inside solid gate
  passes after the descriptor correction, the full Step 1 -> Step 30 audit has
  been re-run against the matrix, and the current product-exposed rows can be
  marked `complete`.
- Dashed terminal/cap and high-curvature evidence remains valid only for the
  dashed matrix slices named below. It cannot be used as solid parity evidence.
- The 2026-05-20 filled-star inside dashed blocker is fixed for the encoded
  matrix slice: the central pentagon is classified as a filled face, not a
  hole; inside dashed stroke includes central filled-face boundaries; outside
  dashed stroke excludes filled-filled internal adjacency.
- The 2026-05-20 outside high-curvature blocker is fixed for the encoded dashed
  matrix slice: outside dashed butt/square/round boundary-domain interval
  packets must remain connected product coverage after legality clipping, with
  no high-complexity polygon made from near-zero-edge clip residue.
  `polygonCount: 1` alone is not accepted as proof because one polygon can
  still contain a fan of disconnected-looking sliver edges.
- The 2026-05-24 dashed terminal/cap contradiction is fixed for the encoded
  self-intersecting outside dashed star and original vector-6 gates: boundary
  split endpoints are dashed terminal/cap geometry, not line joins; authored
  sharp or tangent-discontinuous source vertices can emit typed dashed
  `source-vertex-join` coverage when adjacent visible outside terminal
  half-dashes meet on the same legal boundary; authored
  smooth/tangent-continuous vertices, including the lower-left/lower-right
  high-curvature smooth anchors, are continuous offset-curve coverage and must
  not respond to join type; dashed product packet, `FinalFace`, render, hit, and
  export paths do not carry visible `boundary-terminal-join` geometry or
  `sourceBoundaryJoinCount` provenance; outside dashed butt terminal packets
  start/end at their own split endpoint before overlap handling; constrained
  dashed product render uses
  `render-projection-arrangement` instead of `paint-composite`/renderer mask
  projection.
- The 2026-05-24 lower-left/lower-right/tp16 smooth high-curvature continuity
  repair is validated for the encoded self-check and original vector-6 gates.
  Join non-response at tp-13/tp-16 is expected because their incoming/outgoing
  tangents are continuous. The old dashed post-packet behavior that unioned two
  dashed terminal half-dash packets into `smooth-source-continuity` coverage is
  invalidated: it carried dashed terminal cut edges into the smooth body and
  could break boundary-domain orientation. The current dashed implementation
  builds a single pre-candidate `smooth-source-continuity` interval from
  adjacent smooth/tangent-continuous dashed terminal coverage only when both
  sides share the same outside legal boundary-domain coverage.
- The original vector-6 tp16 extreme dashed high-curvature smoothness slice is
  validated for the encoded native app zoom crop. The dashed terminal/cap and
  join semantics remain fixed: tp16 is an interval-internal
  smooth/tangent-continuous sample and does not respond to join type; true dash
  start/end cut edges remain dashed terminal/cap edges. Product body smoothness
  is guarded by stroke-width-aware contour oracles and same interval provenance,
  not overlap, cap, join, renderer masking, or renderer repair.
- Earliest owning steps for the dashed high-curvature repair are Step 14/15
  interval allocation and Step 17 candidate generation. Step 20 legality may
  clip/filter the single dashed candidate and stitch same-interval fragments,
  but it must not build replacement geometry or cross-interval merged coverage.
  Step 24/25/26/30 were revalidated for that encoded dashed slice with rebuilt
  preset E2E and screenshot review.
- The 2026-05-25 full dashed packet-suite timeout was test-oracle
  over-sampling, not a stuck dash pipeline. The long split-range stress case is
  now split into 18 named parameterized cases, and the redundant
  residue-sample-by-legal-edge filter was replaced by backend area residue
  measurement for that stress path. The full
  `constrained-dashed-stroke-packets.test.ts` suite must be run with a bounded
  worker configuration and must not be skipped.
- The 2026-05-26 self-intersecting outside solid visible-render slice is aligned
  for the encoded self-check star gates: outside solid no longer paints
  exact-boolean bridge/cut seam polygons, and deterministic local crack probes
  at `tp-13` and `tp-16` pass against the `solidMaskModel` masked-source-stroke
  projection.
- The 2026-05-26 self-intersecting inside solid fill-preservation and
  shared-edge-width slices are now current completion evidence for the encoded
  self-check star gates: right large face, right-bottom thin face, central face,
  top/left filled interiors, internal shared-edge width behavior, all five
  internal pentagon corner protrusions, diagnostic miter/bevel/round internal
  corner join-shape probes, bevel no-overreach/no-crack probes, round
  smoothness/source-envelope probes, all five authored outer source vertex
  no-gap probes, lower-left / lower-right high-curvature no-gap probes,
  right-bottom source-segment adherence, normal width comparison, top-triangle
  integrity, shared-edge width-parity probes, shared-boundary width-transition,
  and global/local screenshot review artifacts pass.
- Blocked downstream steps for the 2026-05-20 filled-star inside slice: none.
- Completion is a matrix claim for the current product-exposed Figma-like
  stroke behavior, not a blanket declaration that every possible future Figma
  stroke case is finished. Any newly captured Figma mismatch reopens the
  earliest owning upstream step and must be fixed with TDD evidence before
  downstream status is updated.
- Completion stop rule: do not keep the stroke engine marked complete if any
  active matrix ledger row returns to `uncovered`, `requires-matrix-audit`,
  `red/reopened`, or `aligned-slice`.

Current 2026-05-31 completion evidence:

- `yarn workspace @asyra/preset test:local` passed with 70 files, 671 tests,
  and 5 skipped tests after the constrained dashed and constrained solid packet
  suites were split by behavior family.
- `yarn workspace @asyra/preset build:preset` passed.
- `yarn workspace @asyra/asyra-design react:build` passed.
- `yarn workspace @asyra/asyra-design test:e2e e2e/solid-constrained-stroke-visual.spec.ts e2e/solid-constrained-stroke-visual-vector.spec.ts e2e/solid-constrained-stroke-visual-reported-global.spec.ts e2e/solid-constrained-stroke-visual-reported-local.spec.ts e2e/solid-constrained-stroke-visual-reported-segment.spec.ts --workers=1`
  passed with 50 tests across 5 files.
- `yarn workspace @asyra/asyra-design test:e2e e2e/constrained-dashed-stroke-visual.spec.ts e2e/constrained-dashed-stroke-visual-vector.spec.ts e2e/constrained-dashed-stroke-visual-transition.spec.ts e2e/constrained-dashed-stroke-visual-equivalence.spec.ts --workers=1`
  passed with 94 tests across 4 files.
- `yarn workspace @asyra/asyra-design test:e2e e2e/reported-dashed-stroke-sharp-corners.spec.ts --workers=1`
  passed with 9 tests.
- `yarn workspace @asyra/asyra-design test:e2e e2e/reported-vector-6-dashed-inside-seam.spec.ts e2e/stroke-self-check-star-dashed-visual.spec.ts e2e/stroke-rule-driven-dashed-visual.spec.ts --workers=1`
  passed with 17 tests.
- `yarn workspace @asyra/asyra-design test:e2e e2e/vector-stroke-refresh.spec.ts e2e/stroke-drag-render-performance.spec.ts --workers=1`
  passed with 7 tests.
- `yarn lint:ci` passed with 0 errors and existing no-console warnings.
- `git diff --check` and
  `node --check docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js`
  passed.

## Required Solid/Dash Implementation Sequence

The next implementation work must follow this sequence. Do not skip directly to
stroke engine edits.

1. Freeze the dashed baseline before solid changes.
   - Run the focused dashed packet, arrangement, self-check star, and visual
     gates first.
   - Treat those results as the regression baseline for every later solid slice.
   - Required focused commands:
     - `yarn workspace @asyra/preset exec vitest run src/__tests__/constrained-dashed-stroke-packets.test.ts --reporter=verbose`
       with `--maxWorkers=1 --minWorkers=1` when debugging deterministic
       packet-suite runtime.
     - `yarn workspace @asyra/preset exec vitest run src/__tests__/stroke-candidate-arrangement.test.ts --reporter=verbose`
     - `yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-dashed-visual.spec.ts -g "self-intersecting inside dashed|self-intersecting outside dashed" --workers=1`
     - `yarn workspace @asyra/asyra-design test:e2e e2e/stroke-rule-driven-dashed-visual.spec.ts --workers=1`
2. Add failing `solidMaskModel` tests before changing implementation.
   - Unit or packet tests must fail for missing miter apex, high-curvature crack
     or fan sliver, same-paint overlap darkening, split-end cap artifact, and
     solid output carrying dashed terminal/cap metadata.
   - E2E tests must fail for self-intersecting star solid inside/outside global
     output and local zoom crop probes.
   - Outside solid E2E must include deterministic high-curvature crack probes at
     `tp-13` and `tp-16`, and must fail when a visible render entry paints an
     exact-boolean bridge/cut seam as a black line.
   - Inside solid E2E must include deterministic Figma-star fill-preservation
     probes for the right large face, right-bottom thin face, central face, and
     top/left faces. These probes must fail on face-wide red flood, central fill
     erosion, and red pixels far from the authored doubled center-stroke band.
   - Inside solid E2E must also include deterministic adjacency-width probes
     across all filled-filled shared-edge traces, with the upper-left internal
     pentagon edge as the first local crop: internal pentagon edge adjacent to
     the outer triangle, normal-width comparison edge, internal pentagon endpoint
     protrusion, shared-boundary width transition,
     all-internal-shared-edges-half-width, and top-triangle-mask-integrity. These
     legacy-named probes now verify source-stroke continuity and bounded
     width-parity under the Figma base inside-fill mask rule. They must fail when
     a binary filled-region union mask, or a binary union minus global shared-edge
     reject strips mask, creates face-wide red flood, damages an unrelated face,
     or breaks source-path continuity.
   - Probe measurement must be relative and geometry-derived, not Figma
     screenshot golden matching. Use source/face metadata to place sampling lines
     perpendicular to the tested edge, sample the stable middle 35%-65% of each
     edge, ignore the outer 2px anti-alias band, take the median of at least
     three nearby samples, and compare the shared-edge width against the
     normal-width comparison edge. `internal-pentagon-shared-edge-half-width`
     passes only when the shared-edge median remains within 0.85-1.25 of the
     normal-edge median, with combined adjacent coverage bounded by the normal
     source-stroke envelope. `normal-width-comparison-edge` must stay within
     0.85-1.25 of the expected full inside stroke band for that local source
     segment.
   - `internal-pentagon-endpoint-protrusion` passes only when a connected
     source-stroke-owned protrusion remains near the tested internal pentagon
     endpoint inside the bounded source-stroke envelope. It must fail when the
     protrusion is smoothed away, clipped away, replaced by a face flood, or
     disconnected from source-span / face ownership metadata.
   - `all-internal-pentagon-corner-protrusions` passes only when all five
     internal pentagon corners retain connected source-stroke-owned protrusions
     produced by authored doubled source-stroke coverage at true
     self-intersection nodes after face-owned masking.
     It must fail when the result is driven by boundary strip connectors,
     topology micro-tapers, small-polygon filters, or a single upper-left-only
     probe.
   - `all-internal-pentagon-corner-join-shapes` passes only when all five
     internal pentagon face-corner protrusions visibly and geometrically differ
     across `miter`, `bevel`, and `round` according to `strokeJoin` and
     `strokeMiterLimit`. It must fail when the mask is driven by a fixed round
     node mask, fixed endpoint connector, or fixed wedge.
   - `internal-pentagon-bevel-corners-no-overreach-crack` passes only when bevel
     join-reactive corners remain inside the face-owned source-stroke envelope
     and show no white/grey crack seam in global or local crops.
   - `internal-pentagon-round-corners-smooth` passes only when round
     join-reactive corners are generated from bounded smooth arc geometry; it
     fails on visibly faceted or low-segment round protrusions.
   - `internal-pentagon-round-corners-source-envelope` passes only when all five
     round join-reactive corners stay within the authored doubled
     source-stroke envelope, bridge from face-owned derivation strips without a
     second detached layer, and show no grey/white pinholes in 2000%
     local crops. This probe is separate from smoothness; a smooth but
     over-expanded or disconnected clip still fails.
   - `internal-pentagon-corner-join-shapes-only`,
     `outer-triangle-corners-join-invariant`, and
     `non-pentagon-mask-corners-no-miter-spikes` pass only when join-shaped
     protrusions are limited to the five join-reactive internal pentagon
     self-intersection corners. Outer-triangle and non-pentagon mask-only
     corners must remain mask-clipped boundaries and must not grow miter spikes,
     bevel cuts, or round lobes when `strokeJoin` changes.
   - `inside-solid-lower-left-high-curvature-no-gap` and
     `inside-solid-lower-right-high-curvature-no-gap` pass only when the
     authored source-stroke band remains continuous through the reported lower
     high-curvature anchors before face-owned clipping. They fail on black
     background gaps, cut-chain seams, filtered short fragments, or a
     high-degree-node chain break.
   - `inside-solid-right-bottom-source-segment-adherence` passes only when the
     lower-right/right-bottom visible source-stroke band remains attached to the
     internal pentagon lower-right self-intersection on the authored
     `tp-15 -> tp-16` / `ts-26` segment (`sourceSegmentIndex = 3`), with no grey
     fill wedge or black background wedge between that segment and the stroke.
     This is not the outer star tip and not the closing `tp-16 -> tp-12`
     segment. It must accept one-sided legal face-owned source-stroke contact;
     two-sided red coverage belongs to the separate filled-filled adjacency-width
     probes and must not be required here. Exact packet/export/hit
     coverage and the masked-source-stroke
     render descriptor must both preserve this local source-segment adherence;
     if one channel passes and another fails, Step 20 remains reopened.
   - `inside-solid-outer-source-vertices-no-gap` passes only when all five
     authored outer source vertices / outer tips retain visible inside solid
     stroke coverage from the authored doubled source-stroke band. It fails when
     a face-owned mask, exact-boolean simplification, or render clip fragment
     leaves a grey fill wedge or black background gap at any tested outer tip.
   - `shared-boundary-width-transition` passes only when samples moving from the
     shared edge into the adjacent owned segment show a local width transition
     instead of a uniform full-width band. It fails if all adjacent samples are
     indistinguishable from the normal-width comparison edge.
   - Reload performance must fail when a single self-intersecting solid star runs
     dashed interval/cap handling or expensive ownership arrangement diagnostics
     on the normal render path.
3. Implement Step 17 as two product builders, not one shared product geometry.
   - `solidMaskModel`: build authored source center-stroke candidates at doubled
     width and preserve source-vertex `strokeJoin` / `strokeMiterLimit` before
     masking.
   - `dashIntervalModel`: keep the existing dashed interval allocation, terminal
     half-dash, additive cap, and high-curvature continuity rules intact.
   - `sharedDomainEvidence` may be shared only as mask/domain/provenance input.
4. Implement Step 20 solid mask legality without boundary ribbons.
   - Solid inside clips the doubled center-stroke candidate by the filled-face
     mask. For self-intersecting inside solid, that mask must preserve
     face/winding occupancy and filled-filled adjacency ownership. The mask may
     reveal only the source-stroke band, must preserve filled-face interiors
     outside that band, and must not be implemented as a binary
     `union(fillRegions)` clip for Asyra Step 20 parity.
   - Step 20 must produce face-owned inside mask fragments before same-paint
     union: each fragment is clipped against one filled face occupancy domain and
     carries source span, face id, winding, adjacency role, mask side, and
     rejected-mask fallback state. If the only available fallback is binary
     filled-region union, the result may remain diagnostic/hit/export evidence
     but Step 30 must fail Asyra Step 20 parity via
     `solidMaskModelRejectedMaskMode: 'binary-filled-region-union'`.
   - Solid outside clips the doubled center-stroke candidate by the exterior
     mask.
   - Solid outside visible render must preserve a `renderStrokePaths +
renderMask` descriptor for masked source-stroke drawing. Exact boolean
     coverage may remain an oracle for hit/export/diagnostics, but flattened
     exact-boolean annulus polygons must not be the visible render source when
     they expose bridge/cut seams.
   - Filled-filled internal adjacency must not produce outside solid coverage.
   - Filled-face polygons, boundary-domain full-face coverage, and exact-boolean
     fill-face flood polygons must not become inside solid visible render
     geometry.
   - Product/render metadata should expose the intended mask model when present:
     `solidMaskModelInsideMaskMode: 'face-occupancy-inside-fill'` and reject or
     flag `solidMaskModelRejectedMaskMode: 'binary-filled-region-union'` for
     parity failures. Visible projection metadata must expose
     `solidMaskModelVisibleMaskMode: 'inside-fill-source-stroke-clip'` when the
     rendered source stroke is clipped by the inside fill mask, and
     `solidMaskModelRejectedVisibleMaskMode:
'binary-union-minus-shared-edge-reject'` only as rejected diagnostic
     provenance. The Figma-star probes should be traceable through
     `solidMaskModelAdjacencyProbe`, including the full inside solid probe list:
     `internal-pentagon-shared-edge-half-width`,
     `normal-width-comparison-edge`, `internal-pentagon-endpoint-protrusion`,
     `shared-boundary-width-transition`,
     `all-internal-shared-edges-half-width`, `top-triangle-mask-integrity`,
     `all-internal-pentagon-corner-protrusions`,
     `all-internal-pentagon-corner-join-shapes`,
     `internal-pentagon-corner-join-shapes-only`,
     `internal-pentagon-bevel-corners-no-overreach-crack`,
     `internal-pentagon-round-corners-smooth`,
     `internal-pentagon-round-corners-source-envelope`,
     `outer-triangle-corners-join-invariant`,
     `non-pentagon-mask-corners-no-miter-spikes`,
     `inside-solid-lower-left-high-curvature-no-gap`,
     `inside-solid-lower-right-high-curvature-no-gap`,
     `inside-solid-right-bottom-source-segment-adherence`, and
     `inside-solid-outer-source-vertices-no-gap`.
   - Metadata for those probes must identify source segment/span, authored source
     vertex or self-intersection node when applicable, filled face id, adjacency
     side, mask mode, join eligibility when applicable, and whether coverage came
     from the visible masked-source-stroke descriptor or from a rejected coverage
     oracle.
   - Renderer-side semantic repair, alpha workarounds, and boundary-ribbon solid
     substitutes remain forbidden. Renderer consumption of an upstream
     solidMaskModel visible-render descriptor is allowed.
5. Update Step 24/25 provenance only after Step 17/20 pass.
   - Solid `FinalFace`, render, hit, and export packets must carry
     `solidMaskModel` plus mask/domain provenance and must not carry dashed
     terminal/cap metadata.
   - Solid render metadata must distinguish
     `solidMaskModelVisibleRender: 'masked-source-stroke'` from
     `solidMaskModelCoverageOracle: 'exact-boolean' | 'render-mask'` and record
     `solidMaskModelMaskSide: 'inside-fill' | 'outside-exterior'` when present.
   - Dashed records keep interval, terminal, cap, boundaryDomainId, and
     boundaryRole metadata.
6. Run visual self-review before marking Step 30 aligned.
   - Every solid repair must produce a global screenshot and local zoom crops for
     miter apex, high-curvature endpoints, self-intersection/mask boundaries, all
     five internal pentagon miter/bevel/round corner crops when inside
     self-intersecting parity is in scope, outer-triangle/non-pentagon mask-only
     corner crops, all authored outer source vertices, right-bottom
     source-segment adherence, and the upper-left inside-solid adjacency crop.
   - Local zoom crops must be paired with deterministic crack assertions; an
     attached crop without an assertion is review evidence only, not pass/fail
     coverage.
   - Review must explicitly check for missing miter, overlap darkening, black
     cracks, split-end cap artifacts, illegal outside filled-filled coverage, and
     renderer repair evidence.
   - Inside solid review must explicitly compare the legacy-named internal
     pentagon adjacent-edge probe, a normal-width comparison edge, the endpoint
     protrusion, the shared-boundary width transition, every filled-filled
     shared edge, top-triangle mask integrity, all internal pentagon protrusions,
     diagnostic internal corner join-shape comparisons, bevel no-overreach/no-crack, round
     smoothness and source-envelope bounds, outer-triangle/non-pentagon
     join-invariance, lower-left/lower-right high-curvature no-gap coverage,
     right-bottom source-segment adherence, and all authored outer source
     vertices.
   - A command pass without generated screenshot/crop evidence is not enough.
7. After every solid slice, rerun dashed regressions immediately.
   - If a dashed gate fails, revert or narrow that solid slice; do not fix solid
     by rewriting dash allocation, terminal half-dash, additive cap, or dashed
     high-curvature continuity logic.
8. Update the full matrix coverage ledger before claiming completion.
   - Mark each topology/style/position/join/cap/fill-rule row as
     `uncovered`, `requires-matrix-audit`, `red/reopened`, `aligned-slice`, or
     `complete`.
   - `aligned-slice` means the current fixture is useful evidence but not full
     parity.
   - `complete` requires upstream unit/packet gates, projection metadata gates,
     deterministic final probes, generated global/local screenshots, reload or
     performance evidence when applicable, and reciprocal solid/dashed
     regression gates.
   - A slow test cannot justify dropping a row. Split, shard, or narrow the
     named cases and keep the full regression path runnable.

## Current 2026-05-25/2026-05-26 SolidMaskModel Slice Evidence

These checks were added as failing oracles first, then passed after the current
Step 17/20/24/25 solidMaskModel implementation slice removed the old
self-intersecting solid path that consumed boundary domains as product ribbons
and hardened render/export metadata.

This section is retained as historical guardrail and current regression
evidence. The 2026-05-26 inside solid Figma comparison first reopened inside
parity for face-wide red flood and
fill-preservation failures; the implementation added deterministic
fill-preservation probes and closed that no-flood/no-major-erosion encoded
self-check slice. A later upper-left Figma crop reopened inside solid adjacency
parity because a binary filled-region mask can create face-wide flood, damage
unrelated faces, and erase an endpoint protrusion. The current implementation
now treats that encoded adjacency, protrusion, high-curvature, and join-matrix
evidence as reopened audit input rather than an active full Step 30 completion.
Outside
crack/join-switch evidence remains valid.

- Dashed baseline status before solid implementation:
  - `yarn workspace @asyra/preset exec vitest run src/__tests__/stroke-candidate-arrangement.test.ts --reporter=verbose`
    passed with 26 tests.
  - `yarn workspace @asyra/preset exec vitest run src/__tests__/constrained-dashed-stroke-packets.test.ts -t "(keep outside self-intersecting boundary endpoints|keep the right-bottom high-curvature|restore true outside source-vertex joins|reject self-intersecting outside dashed geometry|keep self-intersecting outside dashed overlap scoped|keep high-curvature outside source-path dashes smooth|keep smooth high-curvature outside vertices continuous without join-type geometry)" --reporter=verbose`
    passed with 7 focused dashed tests.
  - `yarn workspace @asyra/preset exec vitest run src/__tests__/constrained-dashed-stroke-packets.test.ts --reporter=verbose --maxWorkers=1 --minWorkers=1`
    passed with 121 tests in roughly 27 seconds after the long split-range
    stress oracle was split into 18 named parameterized cases. The root cause
    of the previous six-minute no-output run was redundant test-side
    point-sampling over high-point-count residue polygons, not a stuck dash
    pipeline. This full suite is now part of the required dashed baseline and
    must not be skipped.
- SolidMaskModel unit gate:
  - `yarn workspace @asyra/preset exec vitest run src/__tests__/constrained-solid-stroke-packets.test.ts -t "(require self-intersecting inside solidMaskModel|require self-intersecting outside solidMaskModel|keep self-intersecting solid reload path off boundary-domain packet generation)" --reporter=verbose`
  - Current passing result proves self-intersecting solid packets carry
    source-vertex provenance, no longer use `:boundary-domain:` product
    geometry, no longer carry dashed terminal metadata, and no longer emit the
    `constrained-solid:self-intersecting-boundary-domain-packets` render phase.
  - `yarn workspace @asyra/preset exec vitest run src/__tests__/constrained-solid-stroke-packets.test.ts --reporter=verbose`
    passed with 30 tests for the current packet/provenance, reload,
    fill-preservation, internal pentagon join-shape, source-envelope,
    right-upper root-cause, and reindexed source-segment adherence gates.
  - `yarn workspace @asyra/preset exec vitest run src/__tests__/vector-constrained-solid-stroke.test.ts --reporter=verbose`
    passed with 24 tests, including reported vector-6 self-intersecting inside
    and outside solid gates.
  - `yarn workspace @asyra/preset exec vitest run src/__tests__/stroke-candidate-arrangement.test.ts --reporter=verbose`
    passed with 26 tests after solid exact-union metadata stopped emitting empty
    `figmaLikeSplitRangeTerminals` arrays.
- SolidMaskModel E2E visual gate:
  - `yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-solid-visual.spec.ts -g "self-intersecting inside solid uses solidMaskModel|self-intersecting outside solid uses solidMaskModel" --workers=1`
  - Current passing result proves exported/rendered solid metadata uses
    `:solid-mask`, contains no `figmaLikeTerminalRole`, contains no split
    terminal records, includes inside filled-face and outside outer-domain mask
    evidence, writes global screenshots plus local zoom crops, and includes
    inside right large face, right-bottom thin face, central face, and top/left
    face fill-preservation probes.
  - Split visual gates must run as separate commands:
    `yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-dashed-visual.spec.ts --workers=1`
    and
    `yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-solid-visual.spec.ts --workers=1`.
    The separate gates prove the self-check star keeps both product models
    active without using dashed evidence as solid completion evidence. A
    combined cross-spec command is not the current DoD because it can fail on
    E2E app API initialization rather than stroke-rule assertions.
  - `yarn workspace @asyra/asyra-design test:e2e e2e/solid-constrained-stroke-visual.spec.ts -g "reported vector-6 inside solid global visual contract|reported vector-6 inside solid product red alpha keeps every authored segment visible|reported vector-6 inside solid endpoint|reported vector-6 inside solid self-intersection|reported vector-6 inside solid authored segment" --workers=1`
    passed with 27 tests after vector-6 local probes were rewritten from the old
    local-side-candidate oracle to solidMaskModel mask/provenance oracles.
  - `yarn workspace @asyra/asyra-design test:e2e e2e/reported-vector-6-solid-visual.spec.ts -g "preserves every authored segment|switches reported vector-6 from inside solid to center solid without freezing|renders self-intersecting center solid" --workers=1`
    passed with 3 tests.
  - `yarn workspace @asyra/asyra-design test:e2e e2e/reported-vector-6-solid-outside-switch.spec.ts --workers=1`
    passed with 1 test.
  - `yarn workspace @asyra/asyra-design test:e2e e2e/stroke-rule-driven-dashed-visual.spec.ts --workers=1`
    passed with 4 tests, preserving the dashed visual baseline after the solid
    mask-model and renderer projection hardening.
- Solid reload performance gate:
  - `yarn workspace @asyra/asyra-design test:e2e e2e/vector-stroke-refresh.spec.ts -g "self-intersecting inside solid star fast after refresh" --workers=1`
  - `yarn workspace @asyra/asyra-design test:e2e e2e/vector-stroke-refresh.spec.ts --workers=1`
  - Current passing result proves a single pen-drawn self-intersecting inside
    solid star reloads under the existing 2-second contract and the full
    refresh file passes 6/6 with diagnostics explicitly enabled for accepted /
    blocked branch assertions.
  - `yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-solid-visual.spec.ts -g "inside solid reload" --workers=1`
  - Current passing result proves the cubic self-check Figma star stays on the
    bounded masked-source-stroke reload path. It protects the high-curvature
    face-owned mask path and fails when raw edge-strip lists or unused
    center-stroke polygon masks make reload exceed the bounded 5-second
    contract. The inside solid internal-corner root-cause unit gate additionally
    rejects segmented source-stroke/path projection when it creates split
    visible intervals at the right-upper internal pentagon corner; accepted
    render descriptors use a normalized source center-stroke mask instead.
  - The cubic reload gate must also record browser-side vector render phase
    durations and fail when constrained-solid phases exceed the bounded
    threshold. The unit `inside solid adjacency` gate must record Step 20
    `solid-mask-model-*` phase durations, render clip polygon/point counts, and
    assert that path-based masked-source-stroke entries do not carry unused
    center-stroke polygon masks or split source-stroke intervals.
  - Current implementation slice:
  - Self-intersecting solid now builds authored source center-stroke geometry at
    doubled width, carries inside/outside mask provenance, and does not consume
    boundary-domain ribbons as solid product geometry. Outside visible render
    now keeps exact-boolean difference coverage as an oracle while drawing the
    visible source stroke through upstream solid masks, so exact-boolean
    bridge/cut seam polygons are not painted for the encoded self-check slice.
  - Source-span provenance for solidMaskModel packets now uses authored source
    segments and source vertices instead of sampled topology vertices, so
    reported vector-6 no longer emits thousands of sampled provenance ids.
  - Step 24/25 solid exact-union and render-projection metadata omit
    `figmaLikeSplitRangeTerminals` when no dashed terminals exist. Dashed
    packets still preserve terminal metadata when present.
  - A segment-piece/body rewrite was evaluated and rejected because it caused
    unacceptable vector-6 performance and polygon-count regressions. Future
    miter or high-curvature work must keep the doubled-center-stroke-plus-mask
    product model and add bounded-cost tests before any geometry rewrite.
  - The self-check inside solid artifact still reports a high polygon count
    after mask clipping. The existing reload gate passes, but future broader
    solid fixtures should keep polygon count and reload latency under review.
  - The self-check outside solid local crops now include deterministic crack
    probes for high-curvature anchors `tp-13` and `tp-16`. Future crack work
    must add similarly deterministic probes before changing implementation, and
    must preserve exact coverage for hit/export/diagnostics.
  - `yarn workspace @asyra/preset build:preset` passed after the current slice.

Current 2026-05-24 evidence for the high-curvature outside smoothness repair:

- `yarn workspace @asyra/preset exec vitest run src/__tests__/constrained-dashed-vector6-high-curvature-diagnostic.test.ts -t "keeps the tp16 high-curvature outside endpoint" --reporter=verbose`
- `yarn workspace @asyra/preset exec vitest run src/__tests__/constrained-dashed-vector6-high-curvature-diagnostic.test.ts --reporter=verbose`
- `yarn workspace @asyra/preset exec vitest run src/__tests__/constrained-dashed-stroke-packets.test.ts -t "keep smooth high-curvature outside vertices continuous without join-type geometry" --reporter=verbose`
- `yarn workspace @asyra/preset exec vitest run src/__tests__/constrained-dashed-stroke-packets.test.ts -t "reject self-intersecting outside dashed geometry that crosses into filled faces at high curvature boundaries" --reporter=verbose`
- `yarn workspace @asyra/preset exec vitest run src/__tests__/constrained-dashed-stroke-packets.test.ts -t "keep the right-bottom high-curvature outside endpoint as terminal cap geometry independent of join type" --reporter=verbose`
- `yarn workspace @asyra/preset exec vitest run src/__tests__/constrained-dashed-stroke-packets.test.ts -t "keep outside self-intersecting boundary endpoints as terminal caps" --reporter=verbose`
- `yarn workspace @asyra/preset exec vitest run src/__tests__/constrained-dashed-stroke-packets.test.ts -t "(keep outside self-intersecting boundary endpoints|keep the right-bottom high-curvature|restore true outside source-vertex joins|reject self-intersecting outside dashed geometry|keep self-intersecting outside dashed overlap scoped|keep high-curvature outside source-path dashes smooth|keep smooth high-curvature outside vertices continuous without join-type geometry)" --reporter=verbose`
- `yarn workspace @asyra/preset exec vitest run src/__tests__/constrained-dashed-stroke-packets.test.ts -t "keep center dashed round caps smooth on large strokes" --reporter=verbose`
- `yarn workspace @asyra/preset build:preset`
- `yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-dashed-visual.spec.ts -g "self-check: self-intersecting outside dashed .* final pixels keep split terminals and outside side|self-check: right-bottom high-curvature outside dashed terminal remains cap-owned across join settings|self-check: outside dashed star captures Cmd\\+1 and app-zoom coverage-unit review" --workers=1`
- `yarn workspace @asyra/asyra-design test:e2e e2e/reported-dashed-stroke-sharp-corners.spec.ts -g "original vector-6 tp-16 outside" --workers=1`
- `yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-dashed-visual.spec.ts -g "self-check: self-intersecting inside dashed .* final pixels keep split terminals and bounded overdraw" --workers=1`
- `yarn workspace @asyra/asyra-design test:e2e e2e/dashed-center-stroke-visual.spec.ts -g "benchmark: rectangle center dashed miter|benchmark: rectangle center dashed bevel|benchmark: closed vector center dashed stroke renders through the supported path" --workers=1`
- Screenshot self-review passed for `self-check-outside-dashed-square-cmd1-global-review.png`,
  `self-check-outside-dashed-square-left-bottom-app-zoom-review.png`,
  `self-check-outside-dashed-square-right-bottom-app-zoom-review.png`,
  `self-check-outside-dashed-square-top-app-zoom-review.png`, and original
  vector-6 tp16 butt/square/round and miter/bevel/round native app zoom crops.

| Step | Inspector id                     | Figma-like DoD                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `input-event`                    | Input produces vector/stroke edit intent only; no geometry, dash, side, legality, or render repair decisions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2    | `vector-api-mutation`            | Topology mutations preserve authored points, segments, networks, handles, and closed state without synthesizing product stroke paths.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 3    | `validate-topology`              | Runtime validation rejects malformed topology before commit; product support classification remains downstream.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 4    | `transaction-write`              | One intended vector/stroke edit maps to one intended undo transaction; final truth comes from committed state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 5    | `data-channel-delta`             | Computed-data deltas preserve every key needed to dirty source, spec, topology, stroke domain, interval, candidate, legality, paint, hit/export, and visual stages.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 6    | `render-cache-patch`             | Render cache patches committed deltas into a complete snapshot and reuses cache only when Figma-like inputs still match.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 7    | `dirty-revision-graph`           | Dirty graph classifies every stroke stage explicitly, including fill-rule, region/face classification, stroke domain, and paint-only rerun paths.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 8    | `render-strategy-entry`          | Vector render strategy orchestrates only; topology family, side, legality, ownership, and paint decisions stay in stage helpers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 9    | `normalize-render-data`          | Render data normalization stabilizes inputs without repairing invalid topology into product geometry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 10   | `normalize-stroke-spec`          | `normalizeStrokeSpec` canonicalizes width, position, caps, joins, miter, dash, opacity, and paint with rejection diagnostics.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 11   | `build-path-topology`            | `PathTopologyModel` owns source topology, Figma winding-rule basis, source revision, topology family, contours, length, and legal descriptors, but not stroke polygons. Missing or invalid raw vector render data normalizes to the Figma-like vector schema default `nonzero`; explicit `evenodd` and `nonzero` values must be preserved, topology-revision significant, and consumed by downstream Figma-like face/legality classification without local override. Missing `fillRule` must not silently become even-odd.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 12   | `shared-geometry-model`          | Shared resolved geometry produces filled faces/regions, loops, real holes, filled-filled adjacency, exterior boundaries, open boundaries, and boundary split segments with adjacent face occupancy and winding-rule evidence. It must not classify central filled faces as holes by area/orientation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 13   | `resolve-source-families`        | `ResolvedSourceFamily` centralizes topology/stroke support state, blocked reason, and legal-domain hints without spreading product decisions through helpers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 14   | `resolve-stroke-domains`         | `StrokeDomainPlan` emits `sharedDomainEvidence` for filled faces, exterior, holes, filled-filled adjacency, and boundary split ranges. Inside includes every filled face for mask/domain evidence; outside includes only filled-to-exterior evidence. It does not emit product stroke polygons.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 15   | `allocate-intervals`             | Only `dashIntervalModel` allocates intervals. Self-intersecting constrained dashed strokes allocate per selected filled-face boundary split segment with dashed terminal half-dash endpoints and balanced interior dash/gap, with no cross-segment dash continuity. Solid bypasses interval allocation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 16   | `build-source-span-graph`        | Provenance maps dash intervals and solid mask candidates back to resolved domain evidence, authored source spans, vertices, dash boundaries where present, and intersection-derived split points.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 17   | `build-one-sided-candidates`     | `solidMaskModel` builds authored source center-stroke candidates at doubled width with source-vertex join/miter semantics before masking. `dashIntervalModel` builds boundary-domain interval candidates; butt is base dashed geometry and square/round caps are dashed-only additive endpoint geometry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 18   | `partition-arrangement-faces`    | Arrangement partitions supported candidate geometry and overlap only; backend availability must not promote unsupported behavior or fill-boundary paths.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 19   | `resolve-ownership`              | Ownership resolves from typed metadata only, never `geometryId`, packet order, visual color, or renderer output.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 20   | `apply-legality`                 | Solid applies inside-fill or outside-exterior masks to doubled center-stroke candidates and preserves a seam-free visible render descriptor for masked source-stroke drawing. Self-intersecting inside solid must use a face/winding/adjacency-aware inside mask, not a binary filled-region union and not binary union minus global shared-edge reject strips: clip per filled face before same-paint union, preserve face/source/adjacency ownership, keep internal shared edges at the owning face-side contribution, preserve authored doubled source-stroke coverage at authored outer source vertices, authored joins, and true self-intersection nodes for all internal pentagon protrusions, keep lower-left/lower-right high-curvature and right-bottom source-segment coverage continuous on the legal face-owned side, keep unrelated faces such as the top triangle intact, and make only join-reactive internal pentagon self-intersection corners respond to `strokeJoin` / `strokeMiterLimit`. Round join-reactive corners must also stay within the authored doubled source-stroke envelope without detached layers or pinholes. Outer-triangle corners, non-pentagon filled-face corners, mask polygon vertices, and ordinary shared-boundary transitions are mask-only corners and must not receive join-generated protrusions. Face-wide red flood remains illegal. Edge-strip + heuristic connector + taper/filter/fixed round node masks are rejected diagnostics, not parity. Exact boolean coverage may remain an oracle for hit/export/diagnostics, but flattened outside annulus polygons must not be painted when they expose bridge/cut seams. Dashed applies boundary-domain eligibility to interval candidates. |
| 21   | `build-resolved-stroke-regions`  | Paint-free `StrokeRegionPacket` preserves geometry, support, provenance, owner, legal-domain, interval, face/region, side-resolution, and revision metadata.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 22   | `attach-paint-payload`           | Paint attaches after semantic geometry is final; paint-only edits do not mutate or rerun geometry stages.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 23   | `fill-region-consumer`           | Fill consumes shared filled regions/faces; hidden/absent fill paint does not remove implicit region evidence needed by inside/outside stroke.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 24   | `build-final-faces`              | `FinalFace[]` is final geometry and preserves only bounded runtime metadata by default: owner, interval/source/legal ids, model family/status, paint key, and revision data needed by render/cache/routing. Full solidMaskModel/dashIntervalModel/sharedDomainEvidence provenance is diagnostics-only and must be emitted only through explicit full diagnostics mode.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 25   | `emit-render-hit-export-packets` | Render, hit, and export packets project from `FinalFace[]` only. Default render entries use render-only descriptors plus bounded runtime metadata; default hit/export packets must not carry full `debugMeta`, boundary points, face traces, probe arrays, render clip arrays, or render stroke paths. Full diagnostics mode may expose solid/dashed provenance for inspector/E2E, but that payload is not product runtime state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 26   | `render-entries`                 | Render entries project `FinalFace` geometry and paint; native center paths are allowed only for center-equivalent semantics, and constrained solid may carry an upstream masked-source-stroke descriptor for visible render.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 27   | `mesh-render`                    | Renderer draws upstream entries faithfully and does not repair geometry, side, legality, overlap, or Figma-like semantics. It must not paint exact-boolean bridge/cut seam edges as outside solid visible geometry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 28   | `hit-export`                     | Final non-drag hit/export projection matches `FinalFace` render geometry; drag deferral is allowed only when documented and tested.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 29   | `runtime-diagnostics`            | Diagnostics are opt-in. Default runtime clears stroke diagnostics objects and does not publish full provenance. Full diagnostics mode identifies product/debug/legacy branch, support, blocked reason, owner/legal/face provenance, side evidence, overlap, dirty trace, and projection path for inspector/E2E only; summary mode is bounded to counts/status/timing/error codes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 30   | `visible-final-result`           | Final visual result passes upstream gates, deterministic E2E probes, global screenshot review, and high-curvature/local fill-preservation review proving solid miter/join parity, solid mask boundaries, no inside face-wide red flood, inside solid source-stroke continuity and bounded adjacency-width/protrusion parity across all internal shared edges, all five internal pentagon corner protrusions, diagnostic internal corner join-shape review for miter/bevel/round, bevel no-overreach/no-crack, round smoothness plus source-envelope bounds, no join-shaped protrusion added to mask-only corners without Figma evidence, bounded outer-triangle/non-pentagon mask-only final-pixel changes with clip-only invariance proven by packet gates, all five outer source vertices / outer tips, lower-left/lower-right inside-solid high-curvature no-gap coverage, source-segment adherence, top triangle mask integrity, global fragmentation/connectedness tolerance, relative probe tolerances, no solid overlap darkening/cracks/exact-boolean bridge seams/split-end cap artifacts, dashed half-dash/gap/cap rules, and no renderer repair.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Functional Parity Status

Active matrix coverage ledger:

| Matrix row                                 | Required evidence before `complete`                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Current status                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open path solid center/inside/outside      | Figma reference behavior, center-equivalent proof when applicable, cap/join/miter probes, render/hit/export metadata, refresh/reload gate                                                                                                                                                                                                                                                                                                                                                            | `complete: solid-constrained open inside/outside exact one-sided visual gates, solid center gates, vector refresh/reload, packet/render/hit/export metadata gates, typecheck/lint`                                                                                                                                                       |
| Open path dashed center/inside/outside     | Figma reference behavior, dash phase, butt/square/round caps, open-end terminal probes, render/hit/export metadata, refresh/reload gate                                                                                                                                                                                                                                                                                                                                                              | `complete: dashed center open line/acute/high-curvature visual gates, constrained dashed open inside/outside visual gates, butt/square/round cap visual gates, vector refresh/reload, packet/render/hit/export metadata gates`                                                                                                           |
| Simple closed solid center/inside/outside  | Doubled center-stroke plus mask equivalence for inside/outside, miter/bevel/round joins, miter-limit, fill preservation, outside mask, overlap/crack probes                                                                                                                                                                                                                                                                                                                                          | `complete: rectangle/oval/vector center and constrained solid visual gates, join/cap probes, legality overlay/owner-domain visual gates, packet/render/hit/export metadata gates`                                                                                                                                                        |
| Simple closed dashed center/inside/outside | Dash interval allocation, cap additive model, joins at authored vertices, side legality, overlap/projection provenance, visual probes                                                                                                                                                                                                                                                                                                                                                                | `complete: rectangle/oval/vector constrained dashed visual matrix, center dashed joins/caps/gaps, shape/vector equivalence gates, reference dashed rendering/completeness gates, packet/render/projection provenance gates`                                                                                                              |
| Compound closed solid with real holes      | Fill-rule-specific region/hole classification, inside mask, outside exterior rule, hole-side behavior, solid visible descriptor, hit/export oracle                                                                                                                                                                                                                                                                                                                                                   | `complete: path-topology/stroke-domain-plan compound legal-domain gates plus vector-constrained-solid one-hole and nested compound render/hit/export side-inversion oracles`                                                                                                                                                             |
| Compound closed dashed with real holes     | Fill-rule-specific domain selection, internal hole boundary eligibility, terminal/gap/cap probes, side legality, projection provenance                                                                                                                                                                                                                                                                                                                                                               | `complete: stroke-domain-plan compound legal-boundary-span gates, stroke-candidate-flow compound dashed gate, vector-constrained-dashed compound-hole render/hit/export side-inversion oracle, and rule-driven dashed visual gates`                                                                                                      |
| Self-intersecting solid center             | Source center-stroke geometry, join/miter/miter-limit probes, high-curvature probes, projection metadata                                                                                                                                                                                                                                                                                                                                                                                             | `complete: reported vector-6 center solid visual gate, solid center stroke packet/render gates, projection metadata, no product double-alpha overlap`                                                                                                                                                                                    |
| Self-intersecting solid inside             | Figma base rule first: doubled authored source-stroke band clipped by the inside fill mask; no face-wide red flood, no fill erosion, no product-visible mask fragments, global connectedness / fragmentation oracle, fill-mask-eligible source-path continuity, join/miter/cap visual gates, render/hit/export provenance, and final local/global visual review. Face-owned mask fragments are legality/diagnostic evidence unless a separate Figma capture proves they are the visible render rule. | `complete: global source-path/fragmentation oracle, inside fill-mask source-stroke projection, no face-wide red flood, no fill erosion, solid miter/bevel/round internal-corner gates, render/hit/export provenance, self-check star solid visual gate, reported vector-6 solid gates, and split solid/dashed regression suites passed.` |
| Self-intersecting solid outside            | Doubled source-stroke band clipped by exterior mask, no exact-boolean bridge/cut seam in visible render, join-switch matrix, high-curvature crack probes, projection metadata                                                                                                                                                                                                                                                                                                                        | `complete: outside solid self-check crack probes, outside join-switch visual gate, vector-6 outside switch visual gate, seam-free visible-render descriptor and packet/export metadata gates`                                                                                                                                            |
| Self-intersecting dashed center            | Center dash rhythm, terminal/cap behavior, authored-source joins, high-curvature continuity, projection provenance                                                                                                                                                                                                                                                                                                                                                                                   | `complete: dashed center self-crossing high-curvature visual gate, center dashed packet/render gates, projection provenance`                                                                                                                                                                                                             |
| Self-intersecting dashed inside            | Filled-face boundary-domain interval allocation, central filled-face stroke, terminal half-dashes, caps, overlap/projection provenance                                                                                                                                                                                                                                                                                                                                                               | `complete: self-check inside dashed butt/square/round final pixels, reported vector-6 dashed inside seam gates, rule-driven dashed visual gates, terminal/cap/projection metadata gates`                                                                                                                                                 |
| Self-intersecting dashed outside           | Exterior-only boundary-domain intervals, no filled-filled internal adjacency, terminal half-dashes, caps, high-curvature continuity, overlap/projection provenance                                                                                                                                                                                                                                                                                                                                   | `complete: self-check outside dashed butt/square/round final pixels, right-bottom high-curvature terminal cap ownership, sharp-seam square-cap source-vertex miter visual gate, no internal filled-filled adjacency gates`                                                                                                               |
| Cross-cutting opacity/overlap              | Same-paint overlap collapse or projection arrangement without darkening, owner/provenance preserved, hit/export remains direct FinalFace projection                                                                                                                                                                                                                                                                                                                                                  | `complete: overlap/dark-overdraw self-check gates, legality owner-domain visual gates, FinalFace/render projection metadata gates, hit/export packet gates`                                                                                                                                                                              |
| Cross-cutting diagnostics/reload           | Inspector branch ids, model tags, dirty-stage trace, no dashed-only work on solid reload, bounded runtime or split/sharded tests                                                                                                                                                                                                                                                                                                                                                                     | `complete: diagnostics mode gates, vector refresh/reload gates, stroke drag render performance UX gate, split/sharded heavy stroke suites, diagnostics-off normal runtime behavior, and product render freshness evidence passed.`                                                                                                       |

The active matrix is complete for the current product-exposed Figma-like
stroke behavior. Future Figma captures, newly exposed vector families, or any
row demotion to `uncovered`, `requires-matrix-audit`, `red/reopened`, or
`aligned-slice` must reopen the earliest owning upstream step before repair.

The filled-star self-intersecting inside/outside constrained model remains split
by product model. The shared domain evidence, solid mask model, dashed interval
behavior, final visual gates, refresh/performance gates, and split packet suites
are current completion evidence. Future Figma mismatches must demote the
earliest owning row before a repair is
attempted.

The current implementation and tests still prove:

1. Shared geometry classifies the central star region as a filled face under the
   active Figma winding-rule/region evaluation.
2. Domain planning emits `sharedDomainEvidence` for central filled-face inside
   eligibility and excludes filled-filled internal adjacency from outside
   eligibility.
3. Dashed candidate, legality, overlap, `FinalFace`, render, hit/export, and
   packet metadata preserve boundary-domain, face/region, interval, dashed
   terminal, side, and legal provenance for the encoded dashed slices.
4. Visual E2E probes confirm dashed inside screenshots contain central
   filled-face stroke, dashed outside screenshots omit internal filled-face
   stroke, dashed terminal half-dash/gap/cap rules hold, and no dashed
   double-opacity overdraw is introduced for the encoded gates.
5. The previous full verification gates remain historical context, and the
   current verification adds the generic source-path continuity, visible
   connectedness/fragmentation, fill/stroke separation, and render/hit/export
   consistency oracles that were missing from the broken-star failure.

The current self-intersecting solid evidence is complete for the current
product-exposed matrix. Outside solid crack probes, outside join-switch
behavior, packet/provenance metadata, inside solid fill-preservation,
adjacency-width, right-upper root-cause, source-segment adherence, join-shape,
vector-6 global/local, reload, performance, and reciprocal dashed regression
gates all feed the Step 13 matrix and Step 30 rule-driven gates. A new Figma
mismatch must reopen the earliest owning step with a failing generic oracle
before any downstream repair is attempted.

## Current Known Guardrails

- Do not call the whole stroke system complete from a single fixture or cap
  family; completion requires the active matrix and Step 30 gates.
- Do not build self-intersecting constrained solid product geometry from
  boundary-domain ribbons. Solid must follow `solidMaskModel`: authored source
  center-stroke at doubled width plus inside/outside mask.
- Do not paint an inside filled face as stroke. Inside solid visible render must
  preserve fill interiors outside the doubled source-stroke band; right-side or
  right-bottom face-wide red flood is a Step 20 blocker unless Step 17 packets
  already prove full-face product geometry.
- Do not treat self-intersecting inside solid `inside-fill` as a binary
  filled-region union. Step 20 must preserve face/winding occupancy and
  filled-filled adjacency ownership so the upper-left internal pentagon
  source-stroke continuity and endpoint protrusion can match Figma evidence.
- Do not use flattened exact-boolean annulus polygons as the self-intersecting
  outside solid visible-render source when they expose bridge/cut seam edges.
  Exact coverage may remain a legality, hit-test, export, or diagnostic oracle.
- Do not restore cumulative dash scheduling for self-intersecting constrained
  inside/outside dashed strokes.
- Do not treat `hole` as a generic internal-face label. A real hole is an
  unfilled face proven by region/winding evaluation.
- Do not use source-path orientation, contour signed area, selectedSide
  metadata, visible fill paint, packet order, or rendered pixels as the
  self-intersecting inside/outside side authority.
- Do not hardcode even-odd for all self-intersecting fill/face decisions.
- Do not introduce renderer-side semantic repair. Renderer consumption of an
  upstream `masked-source-stroke` visible-render descriptor is allowed for
  constrained solid; inventing that descriptor in renderer code is not.
- Do not close a visual mismatch without generated global screenshots, local
  zoom review crops for the reported high-curvature/intersection areas, and
  deterministic probes that would fail on cracks, stripe seams, or illegal
  filled-filled outside coverage.
- Do not route self-intersecting solid mask-model packets through dashed
  interval allocation, dashed-only backend offset, dashed-only outline
  validation, dashed terminal/cap metadata, or ownership arrangement
  diagnostics on page reload. Solid must use the lightweight mask-model product
  path; provenance diagnostics are explicit opt-in data, not normal runtime
  output.
- Do not edit `../completed/*`; those files are completed-history records only.
