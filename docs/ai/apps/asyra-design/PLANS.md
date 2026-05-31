Never record completed plans here.

# App Plans

## In Progress

1. Stroke engine final implementation

- current product-exposed matrix status: complete as of 2026-05-31 after the
  reopened Step 1 -> Step 30 audit, broken-star visual fragmentation oracle,
  split solid/dashed packet suites, split solid/dashed visual suites,
  render/hit/export provenance gates, refresh gates, and drag render
  performance gate passed. Keep this active entry only as the source of truth
  for future Figma captures that may reopen the earliest owning step.
- active source-of-truth package:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md`
- active routing and inspector contract:
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js`
  - `docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.html`
- active baseline analysis report:
  - `docs/ai/apps/asyra-design/reports/stroke-engine-final-analysis-report.md`
- decision history:
  - `docs/ai/apps/asyra-design/decisions/releases/unreleased.md`

Required direction:

- geometry is resolved before paint
- fill, stroke, and shadow attach paint to canonical geometry
- the stroke engine completion claim is matrix-based, not slice-based. It must
  cover every product-exposed topology/style/position/join/cap/fill-rule
  combination before any active status can say the stroke engine is complete:
  open paths, simple closed paths, compound paths with real holes,
  self-intersecting closed paths, solid, dashed, center, inside, outside,
  miter/bevel/round joins, butt/square/round caps, high-curvature authored
  curves, true self-intersections, hidden/absent fill paint, opacity/overlap,
  render, hit-test, export, diagnostics, refresh, and reload performance
- `inside` and `outside` constrained strokes first resolve shared fill/mask
  domains. Solid and dashed consume that evidence differently: solid uses a
  Figma-like doubled center-stroke plus fill/exterior mask model, while dashed
  uses selected boundary-domain dash intervals.
- Figma-documented base stroke rules stop at the generic vector model:
  `strokeGeometry` is center-stroke geometry regardless of `strokeAlign`;
  constrained `inside` / `outside` solid strokes are modeled as doubled
  center-stroke geometry masked by fill/exterior domains; `strokeJoin` is
  miter/bevel/round; and miter behavior is bounded by `strokeMiterLimit`.
  The self-intersecting inside solid rules below are Asyra Step 20 acceptance
  rules derived from captured Figma evidence. They are not a separate hidden
  renderer oracle and must be kept identical in this active plan, the stroke
  engine README, and `stroke-flow-inspector.data.js` before implementation
  resumes.
- self-intersecting solid visible render must project the authored source path
  as a doubled-width center stroke and apply the inside-fill or
  outside-exterior mask. For self-intersecting inside solid, the visible source
  stroke projection must be a normalized/unioned center-stroke mask; a
  segmented path-stroke projection that exposes split intervals, detached tips,
  or doubled local fragments at join-reactive internal corners is rejected.
  Face-owned derivation clips must prove the legal source-stroke envelope near
  join-reactive internal corners without being painted as the product-visible
  mask. Raw edge-strip endpoints, tangent attach points, high-degree overlap
  vertices, accepted join polygon attach points, or small isolated clip fragments
  must not become visible boundaries. The right-upper internal pentagon corner is
  the regression guard:
  if the render clip shows side-peaks, double-tips, pinholes, split rays, or a
  second local stroke layer there, Step 24/25 is still emitting derivation
  fragments as product-visible geometry and must fail. Coverage diagnostics may
  keep bounded fragments, but the visible render descriptor must project a
  single source-stroke envelope through the inside filled-region mask.
  Exact boolean coverage may be used for legality, hit-test, export, or
  diagnostics, but flattened exact-boolean polygons must not be the outside
  solid visible-render source when they expose bridge/cut seam edges.
- self-intersecting inside solid parity is guarded by the captured Figma star
  mismatch: visible pixels must be exactly the doubled authored center-stroke
  band intersected with the inside filled-region mask. For self-intersecting
  sources, that inside mask must be face/winding/adjacency-aware and must not
  collapse to `union(fillRegions)` or another binary filled-region union.
  The accepted visible mask mode is
  `solidMaskModelVisibleMaskMode: 'inside-fill-source-stroke-clip'`: the
  rendered source stroke mask must be clipped by the inside filled-region mask.
  Face-owned fragments remain legality, coverage-oracle, hit/export, and
  diagnostic evidence; they are not the product-visible render rule unless a
  separate Figma capture proves otherwise. This accepted source stroke mask must
  already be normalized/unioned at true self-intersections; raw segmented
  source-stroke strips or renderer path-stroke projection are rejected when they
  leave split intervals around the right-upper internal pentagon corner. `fill
union - shared-edge reject strips` and equivalent
  `binary-union-minus-shared-edge-reject` masks are rejected diagnostics, not a
  visible-render strategy, because they can re-widen every internal shared edge
  and damage unrelated faces such as the top triangle.
  Inspector metadata must call the accepted mode
  `solidMaskModelInsideMaskMode: 'face-occupancy-inside-fill'`; any shortcut
  equivalent to `union(fillRegions)` must be recorded as
  `solidMaskModelRejectedMaskMode: 'binary-filled-region-union'` and fails Step
  30 parity. Filled faces, boundary-domain faces, or exact-boolean face polygons
  must never be painted as whole-face stroke coverage, and binary-union masks
  must not make every internal adjacency edge render as full-width stroke.
- The same self-intersecting inside solid mask must preserve the authored outer
  source vertices / outer star tips. They are ordinary authored source-stroke
  joins after the doubled-center-stroke step, not diagnostics-only topology
  markers. Step 20 may add bounded render-only source-vertex clip fragments when
  the face-owned mask would otherwise shave a tip, but those fragments must be
  paired with the filled-region clip and must not enter exact coverage, hit,
  export, `debugMeta`, or cache signatures as heavy polygon evidence.
- Step 20 inside solid mask construction must be face-owned: intersect the
  authored doubled source-stroke candidate with each filled face occupancy domain
  before any same-paint union, preserve face id, winding, source span, and
  filled-filled adjacency side, and merge only after metadata proves the merge
  cannot widen an internal shared edge. Internal shared edges reveal only the
  owning face-side contribution; endpoint protrusions from source-stroke plus
  face ownership are legal and must not be removed by smoothing, overlap
  collapse, or renderer clipping.
- current self-intersecting inside solid Step 20 and Step 30 visual evidence is
  complete for the current product-exposed matrix. The 2026-05-31 broken-star
  visual fragmentation failure is now covered by generic source-path
  continuity, visible connectedness/fragmentation, fill/stroke separation, and
  render/hit/export consistency oracles through the full Step 1 -> Step 30
  audit. Product eligibility is based on Figma-like authored geometry and anchor
  continuity, not fixture-specific segment order; a blanket all-corner
  supplement remains rejected because it reopens the right-upper
  internal-pentagon side-peak/root-cause gates.
- Step 20 self-intersecting inside solid visible parity must not be built from
  edge strips, heuristic endpoint connectors, topology micro-tapers, or
  small-polygon filters. `solidMaskModelVisibleMaskMode:
'inside-fill-source-stroke-clip'` is valid only when the visible clip preserves
  authored doubled source-stroke coverage at authored outer source vertices,
  authored joins, and true self-intersection nodes through the inside fill mask.
  A `boundary-strip-connector-approximation` visible mask is a rejected
  diagnostic.
- Step 20 self-intersecting inside solid internal face-corner protrusions are
  diagnostic evidence unless a Figma capture proves a product-visible join rule
  for that corner class. A fixed circular self-intersection node mask, fixed
  endpoint connector, or fixed wedge is a rejected diagnostic for visible render.
  Accepted metadata is
  `solidMaskModelInternalCornerJoinMode: 'stroke-join-aware-face-corner'`;
  accepted records must also expose
  `solidMaskModelJoinEligibilityMode: 'internal-face-only'`;
  rejected shortcuts must be exposed as
  `solidMaskModelRejectedInternalCornerJoinMode: 'fixed-round-node-mask'` or
  `'fixed-endpoint-connector'` and fail Step 30.
- Step 20 join-aware face-corner geometry is eligibility-gated, not global.
  Only join-reactive internal pentagon self-intersection corners may receive
  `strokeJoin` / `strokeMiterLimit` protrusion geometry: the corner must be a
  true self-intersection node exposed by central/internal pentagon face
  ownership. Outer-triangle corners, non-pentagon filled-face corners, mask
  polygon vertices, and ordinary shared-boundary width transitions are
  mask-only corners. They must remain face-owned mask clipping and must not
  receive miter spikes, bevel cuts, round lobes, or any join-generated
  protrusion. The current self-check slice has focused join-eligibility evidence,
  but this does not generalize to every self-intersecting shape without broader
  fixtures.
- Join-reactive internal pentagon corners must stay within the face-owned
  source-stroke clip and must be seam-free: bevel corners must not overreach
  beyond the legal face-owned source-stroke envelope or expose antialiased
  crack seams, miter corners must respect `strokeMiterLimit`, and round corners
  must be smooth by construction with a bounded arc step. A low-segment faceted
  round corner, a white/grey crack inside the bevel corner, or any join polygon
  that escapes the face-owned envelope fails Step 20/30.
- Join-reactive round corners must not inflate the clip arc by tangent overlap
  or redraw a standalone corner patch. The accepted round supplement only bridges
  face-owned derivation strips to the authored doubled source-stroke round
  envelope, with arc radius bounded by `stroke.width` around the true
  self-intersection node. Any round polygon
  whose arc radius includes tangent attach overlap, creates disconnected
  source/offset layers, or leaves grey/white pinholes at 2000% local zoom is a
  rejected Step 20 visible-mask strategy even if coarse smoothness probes pass.
- Smoothness is a default stroke requirement, not a follow-up polish task. Any
  newly generated round join, round cap, curved mask boundary, high-curvature
  continuity patch, or source-stroke clip repair must use bounded smooth
  geometry and must include a deterministic smoothness or no-crack probe when it
  is part of the acceptance surface.
- Inside solid visible render must also prove source-segment adherence outside
  the internal pentagon corners: the authored doubled source-stroke band must
  remain continuously attached to the original segment through lower-right /
  right-bottom anchors, with no grey fill wedge or black background wedge between
  the source segment and the red stroke. This is a one-sided local adherence /
  no-wedge requirement on the authored segment, not the adjacency-width probe
  used for filled-filled internal adjacency.
- The accepted visible-render descriptor must stay reload-safe: Step 20 may
  construct face-owned edge strips as intermediate evidence, but Step 24/25 must
  emit bounded normalized face-owned clip polygons plus a normalized source
  center-stroke mask through a render-only descriptor, not through `debugMeta`,
  export, hit, or inspector payloads. Raw edge-strip lists, render clip polygon
  arrays, render stroke paths, segmented source-stroke strips, and unused
  center-stroke polygon masks must not enter `debugMeta`, exported packets, hit
  packets, or the masked-source-stroke render cache signature on the normal
  reload path.
- Stroke diagnostics are opt-in, not a normal runtime data channel. Default app
  render/reload uses `StrokeDiagnosticsMode: 'off'`: render, hit, export, and
  computed-data projections must not publish full `debugMeta`, boundary points,
  face ownership traces, probe arrays, or `__asyraConstrained*Diagnostics`
  objects. Runtime may keep only bounded `runtimeMeta` ids/enums/revision keys
  needed for render/cache/routing. `StrokeDiagnosticsMode: 'full'` is reserved
  for tests and inspector flows; `summary` may only publish bounded counts,
  status, timings, and error codes without polygons, points, or trace arrays.
- Performance gates must measure both the outside reload symptom and the
  function-level owner. Self-intersecting inside solid needs unit timing for
  Step 20 `solid-mask-model-*` phases, render clip polygon/point counts, and a
  browser reload gate that records constrained-solid phase durations. A passing
  outer `page.reload()` assertion alone is insufficient evidence.
- Specification-first workflow is mandatory for the remaining stroke repairs.
  Active docs, inspector flow, and the stroke engine plan must be updated before
  implementation when a captured mismatch changes the contract. After that,
  implementation must not add new local rules while coding. The only allowed
  exception is a focused failing unit/integration test proving the frozen
  contract is wrong; in that case stop implementation, update all three active
  source-of-truth files first, then resume from the new contract. Screenshot
  review is final acceptance evidence, not the primary root-cause method.
- render, hit-test, export, optional diagnostics, and animation share the same
  resolved geometry family, but diagnostics must be produced only through the
  explicit diagnostics mode described above
- ownership, topology, support state, interval state, and blocked state are
  typed metadata, never parsed from `geometryId`
- interaction performance targets `120fps`; product floor is `60fps`
- Step 30 completion requires deterministic probes plus global and local zoom
  visual review artifacts for solid miter/join shape, mask boundaries, overlap
  darkening, high-curvature cracks, exact-boolean bridge/cut seams, split-end
  cap artifacts, dashed terminal/cap behavior, intersections, and side
  eligibility. Reported high-curvature or source-segment adherence defects must
  be reviewed at the same effective zoom the issue was observed at; for the
  cubic self-check inside solid star, that means 2000% local crops paired with
  deterministic probes, not only the default global zoom.
- Step 30 reload gates must include the cubic self-check inside solid star, not
  only the straight pen-drawn star, because high-curvature face-owned masks are
  the path that can regress into minute-long reloads.
- Step 30 completion must include a coverage ledger for the full matrix. A gate
  for one fixture, cap family, join family, or topology slice is only slice
  evidence. It cannot close the full stroke engine unless every required matrix
  axis has deterministic probes, generated global/local review artifacts, and
  matching render/hit/export/diagnostic provenance.
- Step 30 inside solid gates must include fill-preservation probes for the right
  large face, right-bottom thin face, central face, and top/left faces. Any
  face-wide red flood, filled-face polygon-as-stroke render, or filled interior
  materially eaten by stroke coverage is a blocker.
- Step 30 inside solid gates must also include local adjacency-width probes for
  all filled-filled shared edges, with the self-intersecting star upper-left crop
  as the first encoded fixture:
  `internal-pentagon-shared-edge-half-width`,
  `normal-width-comparison-edge`, `internal-pentagon-endpoint-protrusion`, and
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
  `inside-solid-lower-left-high-curvature-no-gap`, and
  `inside-solid-lower-right-high-curvature-no-gap`,
  `inside-solid-right-bottom-source-segment-adherence`, plus
  `inside-solid-outer-source-vertices-no-gap` for all five authored outer source
  vertices / outer tips.
  Passing fill-preservation probes without
  these local continuity/protrusion probes is insufficient, and each probe must
  be traceable through `solidMaskModelAdjacencyProbe` metadata to source segment
  or span, authored source vertex or self-intersection node when applicable,
  filled face id, filled-filled adjacency side, and mask mode.
- The adjacency-width probes must be relative geometry tests, not Figma
  screenshot golden matching: measure stroke width along stable perpendicular
  sampling lines over the middle 35%-65% of the tested edge, ignore the outer
  2px anti-alias band, compare median width across at least three nearby
  samples, and treat the legacy-named
  `internal-pentagon-shared-edge-half-width` probe as a source-stroke continuity
  and width-parity probe under the current Figma base rule. The shared-edge
  median must remain within 0.85-1.25 of the `normal-width-comparison-edge`
  median, combined adjacent coverage must remain bounded, and
  `normal-width-comparison-edge` must stay within 0.85-1.25 of the expected full
  inside stroke band. A binary mask still fails when it produces face-wide red
  flood, damages unrelated faces, or breaks source-path continuity.
- self-intersecting solid Step 30 gates must include explicit solid join and
  mask-model gates: outside round/bevel plus inside miter/bevel/round, with no
  dashed terminal metadata, no illegal side leakage, no same-paint dark-overdraw
  beyond the anti-aliasing threshold, internal pentagon corner shape differences
  across miter/bevel/round, bevel corner no-overreach/no-crack probes, round
  corner smoothness and source-envelope probes, source-segment adherence probes,
  and local deterministic crack probes for high-curvature anchors such as
  `tp-13` and `tp-16`. The right-bottom source-segment
  adherence probe targets the internal pentagon lower-right self-intersection
  on the authored `tp-15 -> tp-16` / `ts-26` segment (`sourceSegmentIndex = 3`),
  not the outer star tip and not the closing `tp-16 -> tp-12` segment. It must
  include a 2000% crop and verify that the red inside stroke stays attached to
  that authored source segment locally, with no grey/black wedge at the segment
  edge. The probe must accept one-sided source-stroke contact when that is the
  legal face-owned side; requiring red coverage on both sides of this source
  segment is a test-oracle error because it turns a source-segment adherence
  check into the separate filled-filled adjacency width check. The exact
  packet/export/hit coverage oracle and the visible
  masked-source-stroke descriptor must agree on this local adherence; a render
  clip that passes while exact coverage fails is still a Step 20 mismatch.
- self-intersecting solid mask-model packets must stay on the lightweight
  product path during reload; inspector provenance is opt-in through full
  diagnostics mode, and dashed-only interval allocation plus expensive ownership
  arrangement diagnostics are not allowed on the normal render path
- any heavy stroke test file must be split or parameterized into named focused
  cases when runtime hides failures or encourages skipping. Full dashed
  regression gates may be run single-worker or by named shards, but they must
  not be skipped after solid changes.
- every newly observed Figma mismatch must be converted into a generic failing
  oracle before implementation. The owner must be routed through the inspector
  flow first, then the active plan, then the earliest implementation stage.

Legacy stroke planning files outside `stroke-engine-final/` are not retained as
active or archived documents. Historical reasoning belongs only in decision
history and the active analysis report.
