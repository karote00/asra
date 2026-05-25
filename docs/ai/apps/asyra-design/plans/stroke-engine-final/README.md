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
fill. This plan therefore separates the product models:

- `solidMaskModel`: solid inside/outside is equivalent to authored source
  center-stroke geometry at doubled width, preserving authored source-vertex
  `strokeJoin` and `strokeMiterLimit`, then applying the inside fill mask or
  outside exterior mask. This is a three-part contract:
  product geometry is the authored doubled center stroke, legality is the
  fill/exterior mask domain, and visible render projection is a masked
  source-stroke draw. Shared boundary domains are mask/provenance evidence, not
  the solid product path.
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
    dashed, it filters/clips interval candidates by boundary-domain eligibility.
    It must not construct replacement center bands, authored source contour
    loops, boundary ribbons, or renderer fixes. Solid legality may keep exact
    boolean coverage as an oracle for hit/export/diagnostics, but it must also
    preserve a seam-free visible render descriptor for inside/outside mask
    projection.
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
    solid miter/join parity, no split-end cap artifacts in solid, no
    high-curvature solid cracks, no exact-boolean bridge/cut seam painted in
    outside solid render, no disconnected high-curvature dash slivers, and no
    double-opacity product overlap. Review evidence must include deterministic
    crack probes plus a global screenshot and local zoom crops for
    high-curvature anchors, self-intersection joins, and mask boundaries before
    a visual fix can be called complete.
20. The current Step 13 matrix and Step 30 gates define the present completion
    claim for product-exposed Figma stroke behavior. Any newly captured Figma
    mismatch reopens the earliest owning upstream step.
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

Current execution state:

- Plan status: `active-solid-mask-model-visible-render-aligned-encoded-slice`.
- Earliest owning step for the remaining full-engine claim is Step 30
  `visible-final-result`: the current encoded self-intersecting solid slice has
  Step 17/20/24/25 packet and metadata evidence plus deterministic outside
  solid `tp-13` / `tp-16` high-curvature crack probes. Broader deterministic
  global/local visual review is still required before claiming full solid and
  dash parity.
- Dashed terminal/cap and high-curvature evidence remains valid only for the
  dashed matrix slices named below. It is not evidence that solid
  inside/outside parity is complete.
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
- The 2026-05-26 self-intersecting solid visible-render slice is aligned for
  the encoded self-check star gates: outside solid no longer paints
  exact-boolean bridge/cut seam polygons, and deterministic local crack probes
  at `tp-13` and `tp-16` pass against the `solidMaskModel` masked-source-stroke
  projection. This is still encoded-slice evidence, not full stroke-engine
  completion; any new Figma mismatch must reopen the earliest owning upstream
  step with a failing deterministic probe before downstream status changes.
- Blocked downstream steps for the 2026-05-20 filled-star inside slice: none.
- Completion is still a matrix claim, not a blanket declaration that every
  possible Figma stroke behavior is finished. Any newly captured Figma mismatch
  reopens the earliest owning upstream step and must be fixed with TDD evidence
  before downstream status is updated.
- Stop rule: add failing TDD oracles first, fix the earliest owning step, then
  update downstream status only after the upstream implementation, tests,
  diagnostics/evidence, generated screenshots, and self-review pass.

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
     - `yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-render.spec.ts -g "self-intersecting inside dashed|self-intersecting outside dashed" --workers=1`
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
     mask.
   - Solid outside clips the doubled center-stroke candidate by the exterior
     mask.
   - Solid outside visible render must preserve a `renderStrokePaths +
     renderMask` descriptor for masked source-stroke drawing. Exact boolean
     coverage may remain an oracle for hit/export/diagnostics, but flattened
     exact-boolean annulus polygons must not be the visible render source when
     they expose bridge/cut seams.
   - Filled-filled internal adjacency must not produce outside solid coverage.
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
     miter apex, high-curvature endpoints, and self-intersection/mask
     boundaries.
   - Local zoom crops must be paired with deterministic crack assertions; an
     attached crop without an assertion is review evidence only, not pass/fail
     coverage.
   - Review must explicitly check for missing miter, overlap darkening, black
     cracks, split-end cap artifacts, illegal outside filled-filled coverage, and
     renderer repair evidence.
   - A command pass without generated screenshot/crop evidence is not enough.
7. After every solid slice, rerun dashed regressions immediately.
   - If a dashed gate fails, revert or narrow that solid slice; do not fix solid
     by rewriting dash allocation, terminal half-dash, additive cap, or dashed
     high-curvature continuity logic.

## Current 2026-05-25 SolidMaskModel Slice Evidence

These checks were added as failing oracles first, then passed after the current
Step 17/20/24/25 solidMaskModel implementation slice removed the old
self-intersecting solid path that consumed boundary domains as product ribbons
and hardened render/export metadata.

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
    passed with 18 tests, including the self-check solid join matrix unit that
    keeps inside/outside solid packets near the authored source path and rejects
    boundary-domain ribbon product geometry.
  - `yarn workspace @asyra/preset exec vitest run src/__tests__/vector-constrained-solid-stroke.test.ts --reporter=verbose`
    passed with 24 tests, including reported vector-6 self-intersecting inside
    and outside solid gates.
  - `yarn workspace @asyra/preset exec vitest run src/__tests__/stroke-candidate-arrangement.test.ts --reporter=verbose`
    passed with 26 tests after solid exact-union metadata stopped emitting empty
    `figmaLikeSplitRangeTerminals` arrays.
- SolidMaskModel E2E visual gate:
  - `yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-render.spec.ts -g "self-intersecting inside solid uses solidMaskModel|self-intersecting outside solid uses solidMaskModel" --workers=1`
  - Current passing result proves exported/rendered solid metadata uses
    `:solid-mask`, contains no `figmaLikeTerminalRole`, contains no split
    terminal records, includes inside filled-face and outside outer-domain mask
    evidence, and writes global screenshots plus local outside zoom crops.
  - `yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-render.spec.ts -g "self-intersecting inside solid uses solidMaskModel|self-intersecting outside solid uses solidMaskModel|self-intersecting solid join matrix" --workers=1`
    passed with 3 tests after adding the outside round/bevel and inside
    miter/bevel/round solid join matrix. This gate now asserts no dashed terminal
    metadata, no illegal side leakage, and no same-paint dark-overdraw component
    larger than the anti-aliasing threshold. It does not yet prove
    high-curvature black-crack absence because the local zoom crops were
    review artifacts, not deterministic crack probes.
  - `yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-render.spec.ts -g "self-intersecting inside dashed|self-intersecting outside dashed|self-intersecting inside solid|self-intersecting outside solid" --workers=1`
    passed with 10 tests when the solid join matrix is included, proving the
    self-check star keeps both product models active without using dashed
    evidence as solid completion evidence.
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
  - Current passing result proves a single pen-drawn self-intersecting inside
    solid star reloads under the existing 2-second contract.
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
- `yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-render.spec.ts -g "self-check: self-intersecting outside dashed .* final pixels keep split terminals and outside side|self-check: right-bottom high-curvature outside dashed terminal remains cap-owned across join settings|self-check: outside dashed star captures Cmd\\+1 and app-zoom coverage-unit review" --workers=1`
- `yarn workspace @asyra/asyra-design test:e2e e2e/reported-dashed-stroke-sharp-corners.spec.ts -g "original vector-6 tp-16 outside" --workers=1`
- `yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-render.spec.ts -g "self-check: self-intersecting inside dashed .* final pixels keep split terminals and bounded overdraw" --workers=1`
- `yarn workspace @asyra/asyra-design test:e2e e2e/dashed-center-stroke-visual.spec.ts -g "benchmark: rectangle center dashed miter|benchmark: rectangle center dashed bevel|benchmark: closed vector center dashed stroke renders through the supported path" --workers=1`
- Screenshot self-review passed for `self-check-outside-dashed-square-cmd1-global-review.png`,
  `self-check-outside-dashed-square-left-bottom-app-zoom-review.png`,
  `self-check-outside-dashed-square-right-bottom-app-zoom-review.png`,
  `self-check-outside-dashed-square-top-app-zoom-review.png`, and original
  vector-6 tp16 butt/square/round and miter/bevel/round native app zoom crops.

| Step | Inspector id                     | Figma-like DoD                                                                                                                                                                                                                                                                                        |
| ---- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `input-event`                    | Input produces vector/stroke edit intent only; no geometry, dash, side, legality, or render repair decisions.                                                                                                                                                                                         |
| 2    | `vector-api-mutation`            | Topology mutations preserve authored points, segments, networks, handles, and closed state without synthesizing product stroke paths.                                                                                                                                                                 |
| 3    | `validate-topology`              | Runtime validation rejects malformed topology before commit; product support classification remains downstream.                                                                                                                                                                                       |
| 4    | `transaction-write`              | One intended vector/stroke edit maps to one intended undo transaction; final truth comes from committed state.                                                                                                                                                                                        |
| 5    | `data-channel-delta`             | Computed-data deltas preserve every key needed to dirty source, spec, topology, stroke domain, interval, candidate, legality, paint, hit/export, and visual stages.                                                                                                                                   |
| 6    | `render-cache-patch`             | Render cache patches committed deltas into a complete snapshot and reuses cache only when Figma-like inputs still match.                                                                                                                                                                              |
| 7    | `dirty-revision-graph`           | Dirty graph classifies every stroke stage explicitly, including fill-rule, region/face classification, stroke domain, and paint-only rerun paths.                                                                                                                                                     |
| 8    | `render-strategy-entry`          | Vector render strategy orchestrates only; topology family, side, legality, ownership, and paint decisions stay in stage helpers.                                                                                                                                                                      |
| 9    | `normalize-render-data`          | Render data normalization stabilizes inputs without repairing invalid topology into product geometry.                                                                                                                                                                                                 |
| 10   | `normalize-stroke-spec`          | `normalizeStrokeSpec` canonicalizes width, position, caps, joins, miter, dash, opacity, and paint with rejection diagnostics.                                                                                                                                                                         |
| 11   | `build-path-topology`            | `PathTopologyModel` owns source topology, Figma winding-rule basis, source revision, topology family, contours, length, and legal descriptors, but not stroke polygons. Missing `fillRule` must not silently become even-odd if Figma default should be nonzero.                                      |
| 12   | `shared-geometry-model`          | Shared resolved geometry produces filled faces/regions, loops, real holes, filled-filled adjacency, exterior boundaries, open boundaries, and boundary split segments with adjacent face occupancy and winding-rule evidence. It must not classify central filled faces as holes by area/orientation. |
| 13   | `resolve-source-families`        | `ResolvedSourceFamily` centralizes topology/stroke support state, blocked reason, and legal-domain hints without spreading product decisions through helpers.                                                                                                                                         |
| 14   | `resolve-stroke-domains`         | `StrokeDomainPlan` emits `sharedDomainEvidence` for filled faces, exterior, holes, filled-filled adjacency, and boundary split ranges. Inside includes every filled face for mask/domain evidence; outside includes only filled-to-exterior evidence. It does not emit product stroke polygons.     |
| 15   | `allocate-intervals`             | Only `dashIntervalModel` allocates intervals. Self-intersecting constrained dashed strokes allocate per selected filled-face boundary split segment with dashed terminal half-dash endpoints and balanced interior dash/gap, with no cross-segment dash continuity. Solid bypasses interval allocation. |
| 16   | `build-source-span-graph`        | Provenance maps dash intervals and solid mask candidates back to resolved domain evidence, authored source spans, vertices, dash boundaries where present, and intersection-derived split points.                                                                                                     |
| 17   | `build-one-sided-candidates`     | `solidMaskModel` builds authored source center-stroke candidates at doubled width with source-vertex join/miter semantics before masking. `dashIntervalModel` builds boundary-domain interval candidates; butt is base dashed geometry and square/round caps are dashed-only additive endpoint geometry. |
| 18   | `partition-arrangement-faces`    | Arrangement partitions supported candidate geometry and overlap only; backend availability must not promote unsupported behavior or fill-boundary paths.                                                                                                                                              |
| 19   | `resolve-ownership`              | Ownership resolves from typed metadata only, never `geometryId`, packet order, visual color, or renderer output.                                                                                                                                                                                      |
| 20   | `apply-legality`                 | Solid applies inside-fill or outside-exterior masks to doubled center-stroke candidates and preserves a seam-free visible render descriptor for masked source-stroke drawing. Exact boolean coverage may remain an oracle for hit/export/diagnostics, but flattened outside annulus polygons must not be painted when they expose bridge/cut seams. Dashed applies boundary-domain eligibility to interval candidates. |
| 21   | `build-resolved-stroke-regions`  | Paint-free `StrokeRegionPacket` preserves geometry, support, provenance, owner, legal-domain, interval, face/region, side-resolution, and revision metadata.                                                                                                                                          |
| 22   | `attach-paint-payload`           | Paint attaches after semantic geometry is final; paint-only edits do not mutate or rerun geometry stages.                                                                                                                                                                                             |
| 23   | `fill-region-consumer`           | Fill consumes shared filled regions/faces; hidden/absent fill paint does not remove implicit region evidence needed by inside/outside stroke.                                                                                                                                                         |
| 24   | `build-final-faces`              | `FinalFace[]` is final geometry and preserves model provenance: `solidMaskModel`, `dashIntervalModel`, and `sharedDomainEvidence`, including source-span, region/face, legal-domain, owner, mask-side, interval when present, runtime, and paint metadata. Solid records distinguish visible render descriptor provenance from exact coverage oracle provenance. |
| 25   | `emit-render-hit-export-packets` | Render, hit, and export packets project from `FinalFace[]` only and preserve model provenance. Solid packets expose mask/domain evidence without dashed terminal metadata and keep `solidMaskModelVisibleRender`, `solidMaskModelCoverageOracle`, and `solidMaskModelMaskSide` distinct when present; dashed packets expose boundaryDomainId and interval metadata. |
| 26   | `render-entries`                 | Render entries project `FinalFace` geometry and paint; native center paths are allowed only for center-equivalent semantics, and constrained solid may carry an upstream masked-source-stroke descriptor for visible render.                                                                             |
| 27   | `mesh-render`                    | Renderer draws upstream entries faithfully and does not repair geometry, side, legality, overlap, or Figma-like semantics. It must not paint exact-boolean bridge/cut seam edges as outside solid visible geometry.                                                                                   |
| 28   | `hit-export`                     | Final non-drag hit/export projection matches `FinalFace` render geometry; drag deferral is allowed only when documented and tested.                                                                                                                                                                   |
| 29   | `runtime-diagnostics`            | Diagnostics identify product/debug/legacy branch, support, blocked reason, owner/legal/face provenance, side evidence, overlap, dirty trace, and projection path.                                                                                                                                     |
| 30   | `visible-final-result`           | Final visual result passes upstream gates, deterministic E2E probes, global screenshot review, and high-curvature local zoom review proving solid miter/join parity, solid mask boundaries, no solid overlap darkening/cracks/exact-boolean bridge seams/split-end cap artifacts, dashed half-dash/gap/cap rules, and no renderer repair. |

## Functional Parity Status

The filled-star self-intersecting inside/outside constrained slice is split by
product model. The shared domain evidence, dashed interval behavior, and
encoded self-intersecting solid mask-model gates are aligned for the current
self-check/vector-6 slices. This remains active matrix evidence, not full
stroke-engine completion.

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
5. The dashed/shared-domain verification gates for this slice passed:
   `yarn workspace @asyra/preset test:local src/__tests__/resolved-vector-geometry-model.test.ts src/__tests__/stroke-domain-plan.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/stroke-final-face.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts src/__tests__/vector-component.test.ts`,
   `yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-render.spec.ts --workers=1`,
   `yarn workspace @asyra/preset build:preset`, and `yarn lint:ci`.

The current encoded self-intersecting solid inside/outside slice is aligned for
the self-check star and reported vector-6 gates, including the solid join
matrix, dark-overdraw probes, masked-source-stroke render metadata, and outside
solid high-curvature crack probes at `tp-13` and `tp-16`. This is not full
stroke-engine completion. Broader Step 30 coverage must still expand the same
`solidMaskModel` checks across the remaining stroke matrix: doubled
center-stroke geometry, source-vertex miter/join behavior, fill/exterior mask
clipping, no same-paint overlap darkening, no high-curvature cracks, no
exact-boolean seam artifacts, and no dashed terminal/cap metadata in solid
product output.

This does not close the entire stroke system. The Step 13 matrix and Step 30
rule-driven gates remain the active completion authority. A new Figma mismatch
must reopen the earliest owning step with a failing generic oracle before any
downstream repair is attempted.

## Current Known Guardrails

- Do not call the whole stroke system complete from a single fixture or cap
  family; completion requires the active matrix and Step 30 gates.
- Do not build self-intersecting constrained solid product geometry from
  boundary-domain ribbons. Solid must follow `solidMaskModel`: authored source
  center-stroke at doubled width plus inside/outside mask.
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
  path plus provenance diagnostics.
- Do not edit `../completed/*`; those files are completed-history records only.
