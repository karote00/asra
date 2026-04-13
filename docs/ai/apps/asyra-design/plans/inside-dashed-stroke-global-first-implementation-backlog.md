# Inside Dashed Stroke Global-First Implementation Backlog

**Status:** active backlog; Phase 1 completed and product-integrated, Phase 2 completed and product-integrated, Phase 3 pending  
**Date:** 2026-04-01  
**Depends on:** [/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-rebuild-plan.md](/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/plans/inside-dashed-stroke-global-first-rebuild-plan.md)

## Purpose

Turn the global-first rebuild plan into an execution backlog with:

- implementation order
- module boundaries
- temporary freeze points for old logic
- milestone-level acceptance targets

This backlog is intentionally algorithm-first. It does not assume the current
local-first runtime should be extended further.

## Current Status

Completed:

- `DashIntervalRecord`
- `GapIntervalRecord`
- `DashIntervalAllocation`
- first-class `dashIntervalAllocation` output on
  `createDashedGeometryModel(...)`
- Phase 1 TDD coverage for:
  - open-path interval allocation
  - closed-path seam adjacency / wrapping dash canonicality
  - reported sample interval allocation exposed as first-class output
- transitional polygon-splicing Phase 2 was removed from code after review
- no legacy candidate preview surface remains on `createDashedGeometryModel(...)`
- dashed-only compatibility surfaces (`hitPolygons`, `debugParts`) were also
  removed from `createDashedGeometryModel(...)`
- Phase 2 `dash subpath -> stroke-to-outline` rewrite is now active on the
  product path
- open-subpath candidate outline generation now supports:
  - `none`
  - `square`
  - `round`
- dashed candidate render and dashed hit-testing now both consume
  `createDashedGeometryModel(...).model.polygons`

Not started:

- global overlap graph
- overlay partition / ownership resolution

Current in-progress note:

- the runtime path now includes overlap/ownership assembly recovery strong
  enough to remove the latest reported seam overlaps from the product output
- the rebuild is still not complete because final clipping/cutting remains
  pending and must become the next execution target instead of being treated as
  implicitly solved

## Product Integration Strategy

Every completed phase must connect back to product.

Rules:

- do not wait until Phase 5 to connect the new pipeline
- each phase must surface its own output on a product-facing path
- the product may intentionally render an intermediate phase
- if product is rendering an intermediate phase, old final-geometry tests must
  not remain as blocking gates

Current integration state:

- Phase 1: runtime result exposes `dashIntervalAllocation`
- Phase 2 candidate outline polygons are now the default product render for
  dashed geometry
- dashed hit-testing reads from `model.polygons`; there is no separate dashed
  hit/debug surface anymore
- overlap / ownership / final clipping are intentionally not yet on the new
  product path

Important:

- Phase 2 product integration remains mandatory
- but Phase 2 is no longer allowed to define candidate render as
  `bodyPolygons + caps + merged fallback`
- the accepted direction is `dash subpath -> stroke-to-outline -> product render`

---

## 0. Historical Freeze / De-Emphasize List

These entries are kept as decision history so the rebuild does not drift back
to the old shape. They are not instructions to keep old runtime code alive.

### Historical Mainline Repair Targets

In [/Users/asa/Desktop/workspace/asra/packages/preset/src/components/geometry-model.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/components/geometry-model.ts):

- `buildAccumulatedLocalGapRetainedParts(...)`
- `buildAccumulatedScenarioOwnedFacingTerminalRetainedParts(...)`
- `evaluateRemotePollutionRuntimeAdoptionBoundary(...)`
- `buildRemotePollutionOwnerClassRuntimeSurface(...)`
- `consumeRemotePollutionOwnerClassRuntimeSurface(...)`
- `buildRemotePollutionOwnerProjectionPreconditions(...)`
- `buildRemotePollutionOwnerProjectionPayload(...)`
- `consumeRemotePollutionOwnerProjectionPayload(...)`
- `buildRemotePollutionOwnerProjectionOutput(...)`

If any of these code paths still exist, they must not define the new algorithm
skeleton. If they have already been removed, this section remains as historical
record only.

### Historical Early Conflict / Early Ownership Zone

Also in [geometry-model.ts](/Users/asa/Desktop/workspace/asra/packages/preset/src/components/geometry-model.ts):

- `buildInsideDashBoundarySpecs(...)`
- `buildDashBoundarySpecPolygons(...)`
- `applyDashBoundarySpecWedgeConstraints(...)`
- `applyDashBoundarySpecOwnershipConstraints(...)`
- ownership pair decomposition branches
- seam pair decomposition branches

These were the main local-first mixing points where:

- cap inclusion
- wedge legality
- ownership trimming
- local geometry emission

were intertwined too early.

### Keep Only As Historical Reference / Diagnostic

- existing `debugParts`
- existing artifact-stage family classification
- existing remote/local/scenario labels

Useful for comparison, but not a replacement for the new render path.

---

## 1. New Core Data Model

Create the new data model first. No conflict solving yet.

### 1.1 `DashIntervalRecord`

Add a first-class interval record representing authored dash ownership.

Required fields:

- `dashId`
- `startDistance`
- `endDistance`
- `intervalLength`
- `previousDashId`
- `nextDashId`
- `touchedSegmentIndices`
- `crossesSegmentBoundary`
- `capMode`

Acceptance:

- the full path produces a complete ordered interval list
- no polygons are required yet

### 1.2 Internal Dash Candidate Geometry

Keep dash candidate geometry as an internal stroker-stage representation rather
than a public compatibility surface.

Required fields:

- source subpath points
- source tangents
- offset centerline points
- outline polygons
- cap mode

Acceptance:

- every dash interval can emit a candidate
- candidate generation is independent of overlap / ownership decisions
- candidate render comes from one stroked outline representation, not from ad
  hoc body/cap decomposition

### 1.3 `ConflictGraph` / `ConflictComponent`

Add a graph-level conflict model.

Required fields:

- node = `dashId`
- edge = confirmed polygon overlap
- component = connected set of overlapping dashes

Acceptance:

- the system can tell which dashes belong to the same conflict component
- no ownership resolution yet

---

## 2. New Candidate Geometry Pipeline

This is the first real implementation target.

### 2.1 Slice True Path Geometry Per Dash

For each dash interval:

- derive the exact path slice from the authored interval
- do not approximate any part of the dash with tangent projection

Hard rule:

- all candidate geometry must come from the true interval geometry
- not from a tangent-projected strip
- not from endpoint-tangent substitution
- not from local tangent chaining across the dash body
- this subpath is the input to the stroker; it is not yet a fill polygon

Acceptance:

- a curved dash body follows the true segment geometry
- a dash ending on a curve still follows the true segment at its terminal
- short curved terminal dashes do not visibly shoot off along the tangent
- cross-segment dashes are not built from tangent-stitched straight fragments

### 2.2 Build Dash-Subpath Stroker

Implement one generic stroker for an open dash subpath that supports:

- `no cap`
- `square cap`
- `round cap`

This stroker must:

- accept one dash subpath
- generate one stroked outline path
- derive terminal cross-sections from the true sub-curve
- treat cap geometry as part of the outline result
- avoid product-facing `body polygon + cap polygon` stitching

Acceptance:

- cap mode can be swapped without changing ownership logic
- round cap on an open dash is a half-circle, not a full circle
- the resulting outline path is the geometry fed into tessellation
- high-curvature candidates do not require scenario-specific merged-envelope
  fallbacks just to remain visually continuous

### 2.3 Emit `Pure Candidate Render`

Before any clipping or overlap resolution, expose a renderable candidate-only
view.

This is not the final production path, but it is the first visual milestone.

Acceptance:

- authored dash length looks correct
- gap spacing looks correct
- cross-segment dashes remain continuous
- round caps are visibly present
- round caps are half-circles on open dash terminals
- candidate render is driven from the stroked outline path itself
- overlap is still allowed
- out-of-range geometry is still allowed
- the product-facing render path visibly consumes the candidate preview
- render integration tests prove downstream mesh consumers receive candidate
  preview polygons

This milestone is intentionally ugly in overlap zones, but it must be honest.
It must not hide cracks by stitching decomposition polygons that are not the
actual stroker result.

---

## 3. Conflict Detection Backlog

Once pure candidates look right, add global conflict detection.

### 3.1 Spatial Index

Add bbox / spatial lookup for all dash candidates.

Acceptance:

- the system can cheaply ask which dash candidates might overlap

### 3.2 Confirmed Pair Overlap

For each candidate pair returned by the spatial index:

- run actual polygon overlap detection

Acceptance:

- false-positive bbox collisions are filtered out
- confirmed overlaps are explicit

### 3.3 Component Extraction

Build connected conflict components from the overlap graph.

Acceptance:

- if `A-B`, `B-C`, `C-D` overlap in one cluster, they resolve as one component
- no pairwise sequential trimming is allowed
- graph connectivity is symmetric and deterministic
- non-overlapping candidates do not acquire component edges by heuristic

### 3.4 Conflict Detection Performance Guard

Before Phase 3 is accepted, record and keep:

- spatial-index build cost on the reported sample
- confirmed overlap edge count on the reported sample
- component extraction cost on the reported sample

Acceptance:

- bbox filtering cost remains bounded relative to candidate count
- confirmed edge count is explainable from true overlaps, not from proxy
  broadening
- performance numbers are stored with the accepted checkpoint

---

## 4. Overlay Partition Backlog

This is the core boolean-style stage.

### 4.1 Partition Into Atomic Regions

For each conflict component:

- split the component geometry into atomic non-overlapping regions

Each atomic region must record:

- `componentId`
- `regionPolygon`
- `coverageSet`

Examples:

- `{A}`
- `{A,B}`
- `{B,C,D}`

Acceptance:

- all overlapping areas are represented as explicit regions
- source coverage provenance is preserved

### 4.2 Shared / Exclusive Region Labelling

Label each atomic region as:

- exclusive
- shared
- unresolved multi-dash conflict

Acceptance:

- no overlap ownership is guessed during candidate generation
- all ownership questions are deferred to this stage

---

## 5. Ownership Resolution Backlog

Only after partition exists.

### 5.1 Same-Dash Continuity Rule

First ownership rule to implement:

- if multiple atomic regions are part of one authored dash continuity path,
  preserve continuity before considering foreign dash competition

Purpose:

- do not let a cross-segment dash get shortened simply because one end is near a
  corner or curve terminal

Acceptance:

- cross-segment dash visible length stays faithful to authored interval length

### 5.2 Exclusive Region Preservation

Simple rule:

- any region covered by exactly one dash is preserved by that dash

Acceptance:

- exclusive geometry is never lost because of unrelated overlap elsewhere in the
  same component

### 5.3 Multi-Dash Conflict Policy

Add explicit policy for regions whose `coverageSet` contains multiple distinct
dashes.

Important:

- this must be explicit
- not inferred inside per-dash generation

Initial requirement:

- support 2-way, 3-way, and 4-way overlap components

Acceptance:

- conflict resolution works per component, not per pair
- sequence order does not change the result

### 5.4 Shared Region Support

Do not force early binary ownership if the geometry still requires a retained
shared region.

Acceptance:

- shared-region policy is explicit
- shared-region handling is not faked by early clipping

### 5.5 Ownership Priority Policy

Ownership resolution must be deterministic and documented before Phase 5 is
considered implementation-ready.

Required policy order:

1. same-dash continuity preservation
2. exclusive-region preservation
3. explicit shared-region retention policy
4. deterministic multi-dash tie-breaker

Default deterministic tie-break policy:

1. `same-dash continuity`
   - a region supported on both sides by the same authored dash continuity path
     beats foreign ownership claims
2. `exclusive-region preservation`
   - a uniquely covered region does not enter tie-break
3. `centerline support distance`
   - if multiple owners remain, the winner is the owner whose true path slice
     has the smallest aggregate distance to the region's representative sample
     set
4. `authored interval order`
   - if centerline support distance still ties, the owner with the smaller
     authored `startDistance` wins
5. `stable dash id`
   - if authored interval order still ties, the smaller stable `dashId` wins

If product policy later requires retained shared ownership, that policy must be
written explicitly and tested explicitly. Until then, ties must still reduce to
one deterministic owner.

The tie-breaker itself must be written as explicit policy before
implementation. It must not be inferred from:

- candidate traversal order
- incidental polygon split order
- screenshot position
- heuristic window hit/miss

Acceptance:

- the same input always yields the same ownership result
- order of traversal does not change the winner of a multi-dash conflict
- the ownership policy can be explained without referring to implementation
  accident

### 5.6 Overlay / Ownership Complexity Bound

Before Phase 5 is accepted, define and measure:

- maximum atomic-region count growth relative to candidate count
- maximum split depth per component
- bailout policy if a component exceeds the accepted complexity envelope

Complexity envelope numbers must be checked into the repo in structured form at:

- `/Users/asa/Desktop/workspace/asra/docs/ai/apps/asyra-design/benchmarks/inside-dashed-stroke-benchmarks.json`

The benchmark record must include at minimum:

- sample id
- candidate count
- overlap edge count
- component count
- maximum component size
- atomic-region count
- maximum regions per component
- maximum split depth
- per-phase timing
- accepted ceilings
- checkpoint metadata

Acceptance:

- region growth is bounded and recorded on the reported sample
- split depth is bounded and recorded on the reported sample
- bailout or refusal-to-refine policy is explicit before runtime wiring

---

## 6. Final Clipping Backlog

This comes after ownership.

### 6.1 Final Inside-Range Clip

Apply final inside-shape legality clipping only after ownership resolution.

This stage must start from a formal geometry definition:

- clipping target = actual overflow fragments only
- legal domain = owner dash union of legal segment-piece domains
- segment seam / acute angle / high curvature / segment transition are scenario
  families, not separate main algorithms

Acceptance:

- cap and dash length are not already damaged before this stage begins

### 6.2 Decompose Dash Owners Into Segment-Owned Pieces

Before any final clip is attempted:

- decompose each resolved dash owner into segment-owned pieces
- keep per-piece true path slices
- keep per-piece start/end cross-sections
- keep which pieces correspond to true authored terminals vs internal
  cross-segment boundaries

Acceptance:

- one authored dash crossing multiple segments produces multiple legal clip
  pieces
- internal segment-transition boundaries are explicit and are not mistaken for
  authored terminal caps

### 6.3 Build `legal_segment_piece_domain(piece)`

For each owned piece:

- build the exact legal inside-stroke domain from the true segment slice
- bound it by the piece-local start/end cross-sections
- attach cap geometry only when the authored dash truly starts or ends at that
  side

Acceptance:

- a seam piece and an acute-corner piece are handled by the same construction
  rule
- a smooth high-curvature piece does not enter clipping unless it actually
  exceeds its legal piece domain

### 6.4 Build `legal_owner_domain(dash)`

Union the legal domains of all segment-owned pieces that belong to the same
resolved dash owner.

Acceptance:

- final owner legality is defined by piece-domain union, not by local windows
- owner legality does not depend on dash index position or screenshot location

### 6.5 Extract `actual_overflow_fragment`

For each owned region and each eligible passthrough final polygon:

- compute `actual_overflow_fragment = actual geometry - legal_owner_domain`
- clip only if the overflow set is non-empty

Acceptance:

- helpers do not run only because a dash touched a sharp corner, seam, or
  segment boundary
- helpers run only when actual geometry exists outside the legal owner domain

### 6.6 Final Clip Routing Contract

Final clipping must follow this routing:

- `owned regions`
  - eligible only if their resolved owner has a non-empty overflow fragment
- `passthrough geometry`
  - eligible only if its own final polygon has a non-empty overflow fragment
- all other geometry
  - must no-op and pass through untouched

Acceptance:

- `phase6` is not a blanket pass
- no helper is allowed to process all inside geometry just because it is the
  latest phase
- legal geometry remains unchanged through finalization
- normal solid stroke and normal dashed stroke geometry that has no overflow
  fragment remains outside clipping helpers entirely

### 6.7 Final Seam / Acute / Transition Non-Rule

Do not implement separate primary algorithms named:

- seam legality
- corner legality
- transition legality
- high-curvature legality

These may exist only as scenario labels for tests and debugging. The runtime
algorithm must remain:

- build legal segment-piece domains
- union them into legal owner domains
- subtract them from actual geometry to obtain overflow fragments

### 6.8 Performance Guard For Final Clipping

Final clipping must satisfy all of these:

- no per-frame rebuild of high-resolution legal domains for every dash
- no blanket construction of clip domains for all candidates
- no full-document boolean pass when only local owned pieces are eligible
- no helper may run global clipping work when its entry condition is false

Acceptance:

- performance budget is measured on the reported star sample
- polygon-count growth stays bounded relative to the ownership-stage output
- render latency guard is updated together with correctness tests

### 6.9 Legal-Domain Cache / Reuse Model

Final clipping is not implementation-ready until the plan defines:

- when `legal_segment_piece_domain(piece)` is constructed
- when `legal_owner_domain(dash)` is cached
- which dirty conditions force recomputation
- which unchanged conditions must reuse cached domains

Acceptance:

- legal domains are not rebuilt for every dash on every frame by default
- recompute scope is limited to dirty owners / dirty pieces
- cache invalidation rules are explicit and testable

Default cache / reuse rule:

- `legal_segment_piece_domain(piece)` is built once per dirty piece
- `legal_owner_domain(dash)` is built once per dirty owner from its dirty-piece
  set
- unchanged pieces and unchanged owners must reuse cached domains
- recomputation is allowed only when source geometry, stroke parameters, or
  ownership assignment affecting that owner has changed

### 6.10 Bailout Fallback Behavior

If one conflict component exceeds the accepted complexity envelope:

1. stop further partition/refine work for that component
2. discard incomplete partial partition output for that component
3. fall back that component to candidate-preview passthrough geometry
4. do not run ownership clipping on that component
5. mark the component as `unresolved_component_bailout`
6. record the bailout in debug output and benchmark/checkpoint data

This bailout is component-local:

- other components continue through the normal pipeline
- the whole document must not be failed because one component exceeded the
  envelope

Acceptance:

- bailout never produces partially clipped ownership geometry
- bailout never silently hides itself
- bailout degrades to an honest preview result rather than a heuristic repair

---

## 7. Render Integration Backlog

This is where the new path becomes visible.

### 7.1 Add Explicit Candidate Preview Output

Add a clearly isolated candidate-preview output for visual inspection.

Rule:

- must not hijack the main production render path
- must be opt-in / debug-only

Acceptance:

- pure candidate visuals can be inspected without breaking the app

### 7.2 Replace Final Render Input

Once ownership + final clipping are correct:

- switch render consumption to the new final polygons

Acceptance:

- render path uses only the new final output
- old local-first repair path is no longer authoritative

---

## 8. Test Backlog

Tests must be rebuilt around final render correctness.

### 8.1 Keep

Keep tests that still constrain:

- dash interval ordering
- authored dash/gap correctness
- true sub-curve continuity
- cap geometry correctness

### 8.2 Downgrade To Diagnostic

Downgrade tests that can pass while the visible render is still wrong.

This includes:

- local family classification as a primary correctness gate
- adoption / payload / projection contract shape by itself
- any metric that observes intermediate geometry but not final visible output

### 8.3 Add New Hard Gates

New hard gates must cover:

- full-path visible round-cap presence
- visible dash length correctness
- visible gap correctness
- cross-segment terminal continuity
- screenshot / mesh agreement on final output
- formal owner-domain entry-condition tests
- formal owner-domain no-entry tests
- final clipping performance budget on the reported sample

### 8.3A Permanent Scenario Matrix

The following are permanent scenario families, not temporary diagnostics:

- closed-path seam return-to-origin
- left acute angle
- right acute angle
- segment transition
- smooth high-curvature ending
- previously repaired hotspot nearest to the current fix

Each family must remain in the repo as a formal scenario test whenever it is
used to approve a clipping change.

### 8.4 E2E Requirement

E2E must eventually hard-gate:

- visible cap presence on the actual rendered dashed path
- not only coverage recall or first-dash run length

### 8.5 Merge / CI Enforcement Backlog

The rebuild is not complete without automated enforcement of these rules:

- no clipping helper may merge without a `should not run` contract
- no geometry change may merge without the relevant permanent scenario tests
- no performance-regressing clipping change may merge while the guard is red
- no deprecated local-first proxy may become the primary runtime entry condition

Acceptance:

- merge gates match the written plan rules
- enforcement is machine-checkable, not reviewer-memory-only

---

## 9. Milestones

### Milestone A. Pure Candidate Geometry

Deliver:

- full `dash/gap interval allocation`
- full dash candidates
- generic cap generator
- candidate preview

Acceptance:

- authored dash/gap lengths look right
- round caps are visibly present
- overlap is allowed
- clipping is allowed to be wrong

### Milestone B. Global Conflict Topology

Deliver:

- overlap graph
- conflict components
- atomic region partition

Acceptance:

- all overlap solving is component-based
- no more pairwise sequential trimming

### Milestone C. Ownership Resolution

Deliver:

- exclusive/shared/conflict region policy
- continuity-first ownership

Acceptance:

- cross-segment dash continuity survives conflict solving
- multi-dash conflicts are deterministic

### Milestone D. Final Inside Legality

Deliver:

- final inside clipping
- final corner / seam legality

Acceptance:

- visible render is correct
- no need for local-first repair patches

---

## 10. First Three Implementation Targets

If work starts immediately, the first three concrete tasks should be:

1. introduce `DashIntervalRecord` and emit the full interval list from the path
2. implement internal dash-subpath candidate geometry with true sub-curve
   terminal generation and generic cap support
3. expose the candidate outline polygons on the product render path without
   reintroducing any debug-only compatibility surface

These three tasks should happen before any new overlap-fix runtime work.
