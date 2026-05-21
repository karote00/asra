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

## Current Figma-Like Stroke Contract

This plan is active and TDD-driven. The 2026-05-20 Figma filled-star review
reopened the self-intersecting inside dashed flow. The previous active plan
misclassified the central filled pentagon as an unfilled hole and accepted the
wrong inside stroke result.

Figma reference screenshots are rule-discovery evidence only. Automated gates
must encode generic stroke rules instead of comparing pixels against a fixed
reference image.

The active model is now **filled-face boundary stroke domains**:

- Figma vector fill truth is defined by vector regions / loops and each
  region's winding rule. `NONZERO` and `EVENODD` are both valid Figma rules;
  `NONZERO` is the default path rule unless the data explicitly says otherwise.
- Shared geometry must resolve planar faces, region membership, winding-rule
  basis, and adjacent face occupancy before stroke domains are selected.
- A self-intersecting central face is not a hole merely because of contour
  orientation, signed area, or an even-odd helper name. It is a filled face when
  the region/winding-rule evaluation says it is filled.
- `inside`: every filled face owns inside stroke along its own boundary. If
  multiple filled faces share an edge, each filled face may contribute its own
  inside boundary stroke provenance. The central filled pentagon in the
  five-point star is inside-eligible and must produce inside dashed stroke.
- `outside`: outside stroke belongs only to boundaries between a filled face
  and the exterior/unfilled outside of the filled shape. Filled-filled internal
  adjacency is not outside. A real unfilled hole is outside-ineligible for the
  global exterior stroke unless a separate Figma rule is captured and encoded.
- `center`: center strokes may use center-equivalent geometry for the family
  being tested, but center behavior cannot define inside/outside face rules.

Dash allocation runs on each selected filled-face boundary split segment. When
a boundary is cut by intersections, every resulting segment is an independent
dash domain: both ends receive half-dash coverage, the interior dash/gap rhythm
is solved before emission, and no continuity crosses the split boundary.

Invalid current or historical rules:

- Treating `hole` as a generic label for self-intersecting internal faces.
- Classifying hole/outer solely from contour signed area or orientation.
- Hardcoding even-odd containment for all self-intersecting filled-region
  decisions.
- Using source-path orientation, selectedSide metadata, visible fill paint,
  packet order, rendered pixels, or renderer repair as the inside/outside
  authority.
- Claiming completion when the central filled face of the Figma star does not
  have inside dashed stroke.

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
7. Simple closed inside/outside strokes use authored source-path one-sided
   geometry on the resolved legal side; they must not be substituted by widened
   center-stroke clipping.
8. Self-intersecting closed inside/outside dashed strokes use Figma-like
   filled-face boundary domains. Shared geometry resolves filled faces, region
   loops, winding-rule basis, global exterior boundaries, real unfilled holes,
   filled-filled internal adjacency, and boundary split segments before
   stroke-domain selection.
9. For every selected boundary split segment, both range ends receive half-dash
   coverage and the interior dash/gap schedule is evenly distributed within
   that range. No dash continuity may cross the split boundary.
10. Inside selects every filled face boundary and draws on that face's inside
    side. Outside selects only filled-to-exterior boundaries and draws on the
    exterior side.
11. Butt is the base dashed geometry. Square and round caps are additive
    endpoint geometry attached after the base terminal dash intervals are
    allocated; the assembled geometry then re-enters overlap, legality/mask,
    FinalFace, and render/export projection.
12. Fill regions, winding rules, loops, and face classifications are shared
    geometry evidence used to derive stroke boundary domains. They must not be
    recreated downstream as replacement geometry.
13. Legality clips or filters existing candidate geometry only. It enforces the
    selected filled-face/exterior side and eligibility; it must not construct
    replacement center bands, authored source contour loops, or renderer fixes.
14. Overlap is resolved before product `FinalFace`/render output when terminal
    provenance remains available. Raw overlapping fragments may exist only as
    diagnostics/debug evidence.
15. A single visible dash interval must remain one connected product coverage
    unit after legality/mask clipping. High-curvature outside clipping may prune
    tiny numeric residue or stitch same-interval clip fragments upstream, but the
    renderer must never draw a dash as disconnected slivers to hide a geometry
    failure.
16. Typed metadata carries owner, network, region, face, boundary, interval,
    source-span, support, blocked, dirty-stage, side-resolution, winding-rule,
    and revision state. Helpers must not parse `geometryId`, packet order, or
    rendered pixels to recover semantics.
17. `FinalFace[]` is the canonical source for render, hit-test, and export
    projection. Renderer entries draw upstream `FinalFace`-derived geometry
    faithfully and never repair stroke semantics.
18. Final visual E2E is an AI-reviewed product gate: deterministic probes and
    screenshot review must verify the Figma-like rules above, including
    boundary-domain dash placement, same-boundary adjacent gaps, central filled
    face inside stroke, outside exterior-only stroke, bounded legal clipping,
    no disconnected high-curvature dash slivers, and no double-opacity product
    overlap.
19. The current Step 13 matrix and Step 30 gates define the present completion
    claim for product-exposed Figma stroke behavior. Any newly captured Figma
    mismatch reopens the earliest owning upstream step.

## Sequential Implementation Plan

Implementation must follow these steps in order. A step is not complete until
its implementation, tests, diagnostics/evidence, inspector status/risk, and
self-review are complete. Do not patch downstream render output to hide an
upstream failure.

Current execution state:

- Plan status: `active-figma-like-stroke-matrix-verification`.
- The 2026-05-20 filled-star inside dashed blocker is fixed for the encoded
  matrix slice: the central pentagon is classified as a filled face, not a
  hole; inside dashed stroke includes central filled-face boundaries; outside
  dashed stroke excludes filled-filled internal adjacency.
- The 2026-05-20 outside high-curvature blocker is fixed for the encoded matrix
  slice: outside butt/square/round boundary-domain packets must remain connected
  product coverage after legality clipping, with no high-complexity polygon made
  from near-zero-edge clip residue. `polygonCount: 1` alone is not accepted as
  proof because one polygon can still contain a fan of disconnected-looking
  sliver edges.
- Earliest owning steps for that slice are aligned after revalidation: Step 11
  keeps the Figma winding-rule basis, Step 12 emits merged filled-face boundary
  split segments, Step 14/15 select and allocate boundary-domain intervals, and
  Step 17/20/24/25/26/30 preserve and render the result.
- Blocked downstream steps for the 2026-05-20 filled-star inside slice: none.
- Completion is still a matrix claim, not a blanket declaration that every
  possible Figma stroke behavior is finished. Any newly captured Figma mismatch
  reopens the earliest owning upstream step and must be fixed with TDD evidence
  before downstream status is updated.
- Stop rule: add failing TDD oracles first, fix the earliest owning step, then
  update downstream status only after the upstream implementation, tests,
  diagnostics/evidence, generated screenshots, and self-review pass.

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
| 14   | `resolve-stroke-domains`         | `StrokeDomainPlan` selects filled-face boundary domains: inside includes every filled face boundary, including central filled face boundaries; outside includes only filled-to-exterior boundaries.                                                                                                   |
| 15   | `allocate-intervals`             | Self-intersecting constrained dashed strokes allocate per selected filled-face boundary split segment with half-dash endpoints and balanced interior dash/gap, with no cross-segment continuity.                                                                                                      |
| 16   | `build-source-span-graph`        | Provenance proves each interval/candidate came from a resolved filled-face boundary split segment and retains source/topology/face evidence.                                                                                                                                                          |
| 17   | `build-one-sided-candidates`     | Candidates are built from filled-face boundary intervals; butt is base geometry, square/round caps are additive endpoint geometry, and no source-path-only or hole-label substitute is allowed.                                                                                                       |
| 18   | `partition-arrangement-faces`    | Arrangement partitions supported candidate geometry and overlap only; backend availability must not promote unsupported behavior or fill-boundary paths.                                                                                                                                              |
| 19   | `resolve-ownership`              | Ownership resolves from typed metadata only, never `geometryId`, packet order, visual color, or renderer output.                                                                                                                                                                                      |
| 20   | `apply-legality`                 | Legality enforces filled-face/exterior eligibility: inside keeps geometry for selected filled face boundaries; outside keeps only filled-to-exterior boundary geometry.                                                                                                                               |
| 21   | `build-resolved-stroke-regions`  | Paint-free `StrokeRegionPacket` preserves geometry, support, provenance, owner, legal-domain, interval, face/region, side-resolution, and revision metadata.                                                                                                                                          |
| 22   | `attach-paint-payload`           | Paint attaches after semantic geometry is final; paint-only edits do not mutate or rerun geometry stages.                                                                                                                                                                                             |
| 23   | `fill-region-consumer`           | Fill consumes shared filled regions/faces; hidden/absent fill paint does not remove implicit region evidence needed by inside/outside stroke.                                                                                                                                                         |
| 24   | `build-final-faces`              | `FinalFace[]` is final geometry and preserves interval, source-span, region/face, boundary, legal-domain, owner, mask-side, runtime, and paint metadata.                                                                                                                                              |
| 25   | `emit-render-hit-export-packets` | Render, hit, and export packets project from `FinalFace[]` only and preserve boundaryDomainId, face/region id, interval, source provenance, and inside/outside eligibility.                                                                                                                           |
| 26   | `render-entries`                 | Render entries project `FinalFace` geometry and paint; native center paths are allowed only for center-equivalent semantics.                                                                                                                                                                          |
| 27   | `mesh-render`                    | Renderer draws upstream entries faithfully and does not repair geometry, side, legality, overlap, or Figma-like semantics.                                                                                                                                                                            |
| 28   | `hit-export`                     | Final non-drag hit/export projection matches `FinalFace` render geometry; drag deferral is allowed only when documented and tested.                                                                                                                                                                   |
| 29   | `runtime-diagnostics`            | Diagnostics identify product/debug/legacy branch, support, blocked reason, owner/legal/face provenance, side evidence, overlap, dirty trace, and projection path.                                                                                                                                     |
| 30   | `visible-final-result`           | Final visual result passes upstream gates, deterministic E2E probes, and screenshot review proving central filled face inside stroke, exterior-only outside stroke, half-dash/gap rules, and no renderer repair.                                                                                      |

## Functional Parity Status

The 2026-05-20 filled-star inside dashed slice is now aligned against the active
generic rules. The current implementation and tests prove:

1. Shared geometry classifies the central star region as a filled face under the
   active Figma winding-rule/region evaluation.
2. Domain planning selects central filled-face boundaries for inside dashed
   stroke and excludes filled-filled internal adjacency for outside dashed
   stroke.
3. Candidate, legality, overlap, `FinalFace`, render, hit/export, and packet
   metadata preserve boundary-domain, face/region, interval, terminal, side, and
   legal provenance.
4. Visual E2E probes confirm inside dashed screenshots contain central
   filled-face stroke, outside dashed screenshots omit internal filled-face
   stroke, terminal half-dash/gap rules hold, and no double-opacity overdraw is
   introduced.
5. The verification gates for this slice passed:
   `yarn workspace @asyra/preset test:local src/__tests__/resolved-vector-geometry-model.test.ts src/__tests__/stroke-domain-plan.test.ts src/__tests__/constrained-dashed-stroke-packets.test.ts src/__tests__/stroke-final-face.test.ts src/__tests__/vector-constrained-dashed-stroke.test.ts src/__tests__/vector-component.test.ts`,
   `yarn workspace @asyra/asyra-design test:e2e e2e/stroke-self-check-star-render.spec.ts --workers=1`,
   `yarn workspace @asyra/preset build:preset`, and `yarn lint:ci`.

This does not close the entire stroke system. The Step 13 matrix and Step 30
rule-driven gates remain the active completion authority. A new Figma mismatch
must reopen the earliest owning step with a failing generic oracle before any
downstream repair is attempted.

## Current Known Guardrails

- Do not call the whole stroke system complete from a single fixture or cap
  family; completion requires the active matrix and Step 30 gates.
- Do not restore authored-source-path cumulative dash scheduling for
  self-intersecting constrained inside/outside dashed strokes.
- Do not treat `hole` as a generic internal-face label. A real hole is an
  unfilled face proven by region/winding evaluation.
- Do not use source-path orientation, contour signed area, selectedSide
  metadata, visible fill paint, packet order, or rendered pixels as the
  self-intersecting inside/outside side authority.
- Do not hardcode even-odd for all self-intersecting fill/face decisions.
- Do not introduce renderer-side geometry repair.
- Do not edit `../completed/*`; those files are completed-history records only.
