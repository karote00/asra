# Stroke Engine Final Plan

## Active Source Of Truth

Only these files define the current stroke refactor plan:

- `stroke-flow-inspector.data.js`
- `stroke-flow-inspector.html`

Implementation, DoD, status, risk, E2E state, and step ordering must be read
from the inspector data. If any completed-history document disagrees with the
inspector, the inspector wins.

## Completed History Rule

Former stroke-engine-final markdown plan files have been moved unchanged to
`../completed/` with the `stroke-engine-final-` filename prefix. They are
historical decision records only.

Do not edit completed history files and do not use them as current
implementation guidance.

## Current Figma-like Stroke Contract

This plan is active. The latest self-intersecting inside/center/outside dashed
split-range blockers were revalidated on 2026-05-19 by strengthening the Step
30 star-wide oracle, fixing the upstream split-range domain/interval/candidate
flow, clipping terminal/cap geometry to the implicit legal domain, preserving
selected-side provenance through projection, and collapsing same-stroke overlap
without losing terminal provenance.

The previous outside dashed blocker is resolved for the current star/reference
gate. Outside uses the same split-range interval allocation as inside/center,
and now has verified selected-side candidate geometry, generic inside/outside
legality, projection provenance, and final visual evidence for butt, square,
and round caps. This remains scoped evidence, not a full Figma stroke-matrix
completion claim.

The active target is the contract below. Boundary-contour product dashes,
cumulative self-intersecting dashed schedules, renderer repair, and any
"unsupported but still complete" interpretation are invalid.

Completion definition:

- Every Figma stroke family exposed by the product has a verified behavior
  oracle, implementation, diagnostics, and render/hit/export projection path.
- No product stroke family that Figma supports may remain blocked as
  unsupported.
- Step 30 must validate the full Figma stroke matrix, not only the currently
  fixed star/split-range cases.
- If a behavior is unknown, the plan status is incomplete until a Figma
  reference is captured and encoded as tests.

Global rules:

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
   split-range dash domains: topology plus implicit fill/hole analysis splits
   the authored path into legal source ranges, and each range is an independent
   dash domain.
9. For every Figma-like split range, both range ends receive half-dash coverage
   and the interior dash/gap schedule is evenly distributed within that range.
   No dash continuity may cross the split-range boundary.
10. Self-intersecting inside/outside side selection is resolved once in the
    shared geometry model as source split ranges with legal side, even when fill
    paint is hidden or absent. Downstream stroke stages consume that metadata;
    source-path orientation or packet-local fill probes are not valid fallbacks
    for this family.
11. Fill, hole, even-odd, and legal-boundary contours are side-resolution,
    legality, fill, and diagnostic evidence only. They must not become
    independent dashed product paths or replacement boundary-stroke geometry.
12. Legality clips or filters existing candidate geometry only. It must not
    construct widened center bands, contour restrokes, or replacement product
    geometry.
13. Overlap is resolved before product `FinalFace`/render output when terminal
    provenance remains available. Raw overlapping fragments may exist only as
    diagnostics/debug evidence; product visual overlap collapse must not create
    double-opacity overdraw or erase split-range terminal identity.
14. Typed metadata carries owner, network, contour, legal-domain, interval,
    source-span, support, blocked, dirty-stage, side-resolution, and revision
    state. Helpers must not parse `geometryId`, packet order, or rendered
    pixels to recover semantics.
15. `FinalFace[]` is the canonical source for render, hit-test, and export
    projection. Renderer entries draw upstream `FinalFace`-derived geometry
    faithfully and never repair stroke semantics.
16. Final visual E2E is an AI-reviewed product gate: deterministic probes and
    screenshot review must compare against Figma-like behavior, including
    split-range dash placement, same-split-range adjacent gaps, implicit
    hole-side stroke, no forbidden contour dash loops, bounded legal clipping,
    and no double-opacity product overlap.
17. Outside dashed butt/square/round is verified for the current
    self-intersecting star/reference gate. Passing this scoped gate does not
    prove every outside stroke family, cap, join, angle, or topology that Figma
    supports.
18. The current Step 13 matrix is not a full completion claim until every
    exposed Figma stroke behavior has encoded reference tests and Step 30 visual
    evidence.

## Sequential Implementation Plan

Implementation must follow these steps in order. A step is not complete until
its implementation, tests, diagnostics/evidence, inspector status/risk, and
self-review are complete. Do not patch downstream render output to hide an
upstream failure.

Current execution state:

- Plan status: `outside-dashed-gates-passed-full-matrix-open`.
- Latest resolved blocker: outside dashed butt/square/round for the
  self-intersecting star/reference gate now passes Step 17 candidate, Step 20
  legality, Step 24/25 projection provenance, Step 30 deterministic visual
  probes, and AI screenshot review.
- Current blocker: no active blocker is known for the currently encoded
  star/reference dashed gate. The plan remains open because full Figma stroke
  parity requires encoded references for every exposed stroke behavior, not only
  the currently fixed self-intersecting dashed cases.
- Stop rule: if a new visual or Figma-reference failure appears, reopen the
  earliest owning step and proceed sequentially. Do not patch renderer output to
  hide an upstream candidate, legality, projection, or interval failure.
- Step 13 exposes runtime support state separately from Figma parity status and
  provides the explicit Figma stroke-family matrix.
- Step 13 now exposes runtime support state separately from Figma parity status
  and provides the first explicit Figma stroke-family matrix.
- Step 13 is now aligned for source-family classification. Its matrix has no
  implementation-gap or unverified-reference entries after reconciling stale
  self-intersecting solid, compound dashed, and open constrained classifications
  with current implementation/test evidence.
- Step 14 is now aligned: every Step 13 classified family resolves to an
  explicit `StrokeDomainPlan`, including compound legal-boundary spans and
  self-intersecting implicit fill/hole side authority.
- Step 15 is now aligned: interval allocation consumes explicit Step 14 domain
  plans, including split-range terminal half-dash intervals and independent
  legal-boundary shell/hole schedules.
- Step 16 is now aligned: source-span provenance is resolved for split-range
  intervals through `SourceSpanGraph` and for legal-boundary shell/hole
  intervals through typed Step 14 domain sourceSpanIds.
- Step 17 is now aligned for the current inside/center/outside dashed gates:
  candidate geometry consumes shared selectedSide metadata, preserves
  split-range provenance, and covers butt/square/round outside cap evidence for
  the current star/reference fixtures. The 2026-05-19 top-left outside
  first-dash regression is covered by a degenerate cubic-start tangent oracle:
  shared path sampling must use the first non-degenerate tangent instead of a
  horizontal fallback before Step 17 builds offset/cap geometry. Outside
  source-vertex terminal starts also add selected-side join geometry at closed
  segment boundaries, so the fourth segment first dash participates in the
  same Figma-like outside miter corner across butt, square, and round caps.
- Step 18 is now aligned: arrangement and visual-overlap collapse preserve
  candidate provenance, terminal metadata, and support boundaries without using
  `sourceContourIds` as a dashed correctness key.
- Step 19 is now aligned: ownership continues from typed ownerSet/source
  metadata only after packets, arrangement, and FinalFace bridges.
- Step 20 is now aligned for the current inside/center/outside dashed gates:
  legality uses a generic source-path implicit legal-domain clip/filter path,
  independent of visible fill paint and without inside-only helper semantics.
- Step 21 is now aligned: paint-free region packets preserve legal geometry,
  terminal/side/owner/source/legal-domain provenance, arrangement metadata, and
  non-paint revision keys without paint leakage.
- Step 22 is now aligned: paint attachment preserves geometry/provenance,
  isolates paint-only dirty paths, and passes visual paint regression gates.
- Step 23 is now aligned: fill consumes shared self-intersection geometry, and
  fill/no-fill variants preserve implicit legal-domain stroke evidence.
- Step 24 is aligned for the current inside/center/outside gates: `FinalFace[]`
  preserves terminal, selectedSide, and legal-domain provenance.
- Step 25 is aligned for the current inside/center/outside gates: render,
  hit, and export packets project from `FinalFace[]` and expose outside
  selectedSide/legal-domain provenance, not only dash presence.
- Step 26 is now aligned: render entries project FinalFace-derived geometry and
  paint without renderer-side stroke repair across the current center/constrained
  solid/dashed visual matrix. Revalidated on 2026-05-18: self-intersecting
  constrained dashed product-final entries use direct FinalFace `solid-graphics`
  projection, not `masked-solid` repair.
- Step 27 is now aligned: renderer draw consumes upstream entries faithfully and
  does not repair stroke semantics.
- Step 28 is now aligned: hit/export projection is FinalFace-derived for the
  current drag, refresh, and constrained visual gates.
- Step 29 is now aligned: runtime diagnostics publish typed product/debug/blocked
  evidence with branch identity and provenance.
- Step 30 is partial, not complete: inside/center/outside dashed
  self-intersecting star/reference gates pass deterministic probes and AI visual
  review, but the full exposed Figma stroke matrix is still open.
- Stop rule for current and future changes: if a visual failure is discovered,
  keep the plan open and proceed sequentially; do not patch downstream render
  output to hide upstream contract failures.

| Step | Inspector id                     | Figma-like DoD                                                                                                                                                                                         |
| ---- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | `input-event`                    | Input produces vector/stroke edit intent only; no geometry, dash, side, legality, or render repair decisions.                                                                                          |
| 2    | `vector-api-mutation`            | Topology mutations preserve authored points, segments, networks, handles, and closed state without synthesizing product stroke paths.                                                                  |
| 3    | `validate-topology`              | Runtime validation rejects malformed topology before commit; product support classification remains downstream.                                                                                        |
| 4    | `transaction-write`              | One intended vector/stroke edit maps to one intended undo transaction; final truth comes from committed state.                                                                                         |
| 5    | `data-channel-delta`             | Computed-data deltas preserve every key needed to dirty source, spec, topology, stroke domain, interval, candidate, legality, paint, hit/export, and visual stages.                                    |
| 6    | `render-cache-patch`             | Render cache patches committed deltas into a complete snapshot and reuses cache only when Figma-like inputs still match.                                                                               |
| 7    | `dirty-revision-graph`           | Dirty graph classifies every stroke stage explicitly, including stroke domain, and keeps paint-only/source-topology edits on the correct rerun path.                                                   |
| 8    | `render-strategy-entry`          | Vector render strategy orchestrates only; topology family, side, legality, ownership, and paint decisions stay in stage helpers.                                                                       |
| 9    | `normalize-render-data`          | Render data normalization stabilizes inputs without repairing invalid topology into product geometry.                                                                                                  |
| 10   | `normalize-stroke-spec`          | `normalizeStrokeSpec` canonicalizes width, position, caps, joins, miter, dash, opacity, and paint with rejection diagnostics.                                                                          |
| 11   | `build-path-topology`            | `PathTopologyModel` owns source topology, fillRule, source revision, topology family, contours, length, and legal descriptors, but not stroke polygons.                                                |
| 12   | `shared-geometry-model`          | Shared resolved geometry is canonical fill/hole/legal-domain evidence and source split-range side authority for fill, stroke, future shadow, legality, and diagnostics; it is not a dash product path. |
| 13   | `resolve-source-families`        | `ResolvedSourceFamily` centralizes topology/stroke support state, blocked reason, and legal-domain hints.                                                                                              |
| 14   | `resolve-stroke-domains`         | `StrokeDomainPlan` makes split ranges, family interval domains, legal-domain references, and side authority explicit before interval allocation.                                                       |
| 15   | `allocate-intervals`             | Self-intersecting constrained inside/outside dashed strokes allocate per split range with half-dash endpoints and balanced interior dash/gap, with no cross-range continuity.                          |
| 16   | `build-source-span-graph`        | Source-span provenance proves intervals/candidates came from authored source split ranges, not fill/hole contour dash domains.                                                                         |
| 17   | `build-one-sided-candidates`     | Candidates are local one-sided geometry from normalized spec, intervals, and shared split-range side metadata; outside dashed must keep butt/square/round selected-side cap geometry and acute first dash shape covered by packet and visual gates. |
| 18   | `partition-arrangement-faces`    | Arrangement partitions supported candidate geometry and overlap only; backend availability must not promote unsupported behavior or fill-boundary paths.                                               |
| 19   | `resolve-ownership`              | Ownership resolves from typed metadata only, never `geometryId`, packet order, visual color, or renderer output.                                                                                       |
| 20   | `apply-legality`                 | Legality clips/filters existing candidates against the correct legal domain for inside and outside, preserves legal-side provenance, and never constructs replacement geometry or inside-only clip paths. |
| 21   | `build-resolved-stroke-regions`  | Paint-free `StrokeRegionPacket` preserves geometry, support, provenance, owner, legal-domain, interval, side-resolution, and revision metadata.                                                        |
| 22   | `attach-paint-payload`           | Paint attaches after semantic geometry is final; paint-only edits do not mutate or rerun geometry stages.                                                                                              |
| 23   | `fill-region-consumer`           | Fill consumes shared fillRegions; hidden/absent fill paint does not remove implicit legal domains needed by inside/outside stroke.                                                                     |
| 24   | `build-final-faces`              | `FinalFace[]` is final geometry and preserves interval, source-span, legal-domain, owner, side-resolution, runtime, and paint metadata, including outside dashed selectedSide proof.              |
| 25   | `emit-render-hit-export-packets` | Render, hit, and export packets project from `FinalFace[]` only; outside dashed packets prove selectedSide/legal-domain provenance, not merely visible dash pixels.                             |
| 26   | `render-entries`                 | Render entries project `FinalFace` geometry and paint; native center paths are allowed only for center-equivalent semantics.                                                                           |
| 27   | `mesh-render`                    | Renderer draws upstream entries faithfully and does not repair geometry, side, legality, overlap, or Figma-like semantics.                                                                             |
| 28   | `hit-export`                     | Final non-drag hit/export projection matches `FinalFace` render geometry; drag deferral is allowed only when documented and tested.                                                                    |
| 29   | `runtime-diagnostics`            | Diagnostics identify product/debug/legacy branch, support, blocked reason, owner/legal provenance, side evidence, overlap, dirty trace, and projection path.                                           |
| 30   | `visible-final-result`           | Final visual result passes upstream gates, deterministic E2E probes, and AI visual review against Figma-like reference behavior; current star/reference dashed gates pass, but full matrix parity remains open. |

## Functional Parity Status

The inspector status is now intentionally conservative:

- Steps 1-12 are foundation-aligned for the current flow, but they are not a
  full-product completion claim.
- Step 13 is aligned for source-family classification.
- Step 14 is aligned for domain planning across the Step 13 family matrix.
- Step 15 is aligned for interval allocation across the Step 14 domain plan
  boundary.
- Step 16 is aligned for source-span provenance across the Step 15 interval
  boundary.
- Step 17 is aligned for the current inside/center/outside dashed gates. Full
  matrix completion still requires additional Figma references as new exposed
  behaviors are identified.
- Step 18 is aligned for arrangement/overlap metadata preservation across the
  Step 14-17 domain, interval, provenance, and candidate metadata.
- Step 19 is aligned for typed ownership propagation.
- Step 20 is aligned for the current inside/center/outside dashed gates.
- Step 21 is aligned after revalidation against the Step 20 legality
  provenance gate.
- Step 22 is aligned after revalidation against the paint-free region boundary.
- Step 23 is aligned after revalidation against the shared
  geometry/legal-domain recalibration.
- Step 24 preserves outside selectedSide/legal-domain metadata through
  `FinalFace[]` for the current outside dashed gate.
- Step 25 preserves outside selectedSide/legal-domain metadata through render,
  hit, and export projection for the current outside dashed gate.
- Step 26 is aligned after revalidation against the FinalFace render-entry
  projection contract.
- Step 27 is aligned after revalidation against renderer draw as a faithful
  consumer of upstream entries.
- Step 28 is aligned after revalidation against hit/export projection and
  drag/refresh freshness gates.
- Step 29 is aligned after revalidation against runtime diagnostic branch
  identity and provenance gates.
- Step 30 is partial: current inside/center/outside dashed visual oracles pass,
  including outside butt/square/round for the current star/reference gate. It is
  not complete until every exposed Figma stroke behavior has encoded visual
  reference coverage.
- Known functional blocker: none for the currently encoded
  self-intersecting dashed star/reference gate. Unknown or newly captured Figma
  behaviors must reopen the earliest owning step.

## Completion Evidence

1. **Step 13: Build the Figma stroke-family matrix**
   Completed: the source-family matrix now has no implementation-gap or
   unverified-reference entries, and open constrained behavior is represented as
   center-equivalent runtime support rather than an unsupported blocker.

2. **Step 14: Prove every classified family has a stroke domain plan**
   Completed locally: source-family classifications now map into explicit
   `StrokeDomainPlan` outputs for open, simple closed, compound closed,
   self-intersecting closed, solid, dashed, center, inside, and outside
   families.

3. **Step 15: Allocate intervals from the domain plan**
   Completed locally: `allocateStrokeIntervalsForDomainPlan` routes
   split-range, legal-boundary-span, source-path, and topology-arc-length
   domains through explicit interval allocation.

4. **Step 16: Resolve source-span provenance**
   Completed locally: split-range intervals resolve through `SourceSpanGraph`;
   legal-boundary shell/hole intervals resolve through typed domain
   sourceSpanIds.

5. **Step 17: Build candidate geometry from resolved records**
   Completed for the current dashed star/reference gate: candidate flow records
   domainKind, consumes shared selectedSide metadata, proves source-path and
   split-range routing without boundary-contour product paths, and covers
   outside dashed butt/square/round selectedSide/cap evidence, including the
   degenerate cubic-start tangent case that affected the fourth segment's first
   outside dash and the selected-side source-vertex join required at that closed
   segment boundary.

6. **Step 18: Preserve metadata through arrangement**
   Completed locally: exact arrangement and visual-overlap collapse preserve
   terminal/source metadata, remove same-stroke opacity overdraw, and do not use
   `sourceContourIds` as a dashed correctness path.

7. **Step 19: Revalidate typed ownership**
   Completed locally: ownership remains ownerSet/source metadata driven and
   does not parse geometry ids, packet order, or sourceContourIds.

8. **Step 26: Expand render-entry projection**
   Completed locally: render entries project FinalFace-derived geometry and
   paint without renderer-side stroke repair.

9. **Step 25-29: Expand render/hit/export/diagnostics**
   Completed locally: render/hit/export/diagnostics project from `FinalFace[]`
   and distinguish product, debug, fallback, and blocked evidence through typed
   provenance.

10. **Step 30: Final visible result**
    Completed for the current dashed star/reference gate: inside/center/outside
    split-range gates include deterministic probes and AI visual review. The
    full Figma stroke matrix remains open because any unencoded reference
    behavior must still receive its own oracle.

## Required Gates

## Active Full Matrix Completion Plan

Execute sequentially for any newly discovered or unencoded Figma stroke
behavior. Do not update downstream status until the current step's DoD,
targeted tests, diagnostics/evidence, and self-review pass.

1. **Find the owning step**
   Classify the failing behavior as interval/domain, candidate, legality,
   arrangement/overlap, FinalFace/projection, render draw, diagnostics, or final
   visual evidence. Reopen the earliest owning step only.

2. **Add the oracle before implementation**
   Encode the Figma reference as unit/integration/visual tests. For visible
   geometry, Step 30 must include deterministic probes and AI screenshot review.

3. **Fix sequentially**
   Implement the owning step, then update downstream gates only after the
   upstream implementation, tests, diagnostics/evidence, and self-review pass.

4. **Preserve current dashed invariants**
   Do not regress split-range half-dash endpoints, redistributed gaps, selected
   side from shared geometry, no boundary-contour product loops, no renderer
   repair, no same-stroke overdraw, or outside butt/square/round provenance for
   the current star/reference gate.

Run gates in step order. The targeted gate for the current step runs before
broader gates.

- Targeted unit/integration tests for the current step.
- Relevant visual/E2E when the step affects visible geometry, hit/export, drag,
  refresh, or final visual correctness.
- `yarn workspace @asyra/preset build:preset`
- `yarn lint:ci`

Current partial visual evidence includes the broader constrained/reference
dashed visual suite. This suite is required but not sufficient for complete
Figma stroke parity:

- `apps/asyra-design/e2e/constrained-dashed-stroke-visual.spec.ts`
- reference dashed visual specs
- reported dashed regression specs

## Current Known Guardrails

- Do not call the plan complete while any Figma-supported stroke family remains
  unsupported, blocked, unverified, or covered only by a partial fixture.
- Do not restore source-path cumulative dash scheduling for self-intersecting
  constrained inside/outside dashed strokes.
- Do not restore independent fill/hole boundary-contour dashed product paths.
- Do not use source-path orientation as the self-intersecting inside/outside
  side authority.
- Do not introduce renderer-side geometry repair.
- Do not edit `../completed/*`; those files are completed-history records only.
