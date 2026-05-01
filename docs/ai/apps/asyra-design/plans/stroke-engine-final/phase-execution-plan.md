# Phase Execution Plan

## Role

This file defines the implementation sequence from the current stroke runtime to
the final stroke-engine architecture.

It is the active replacement for the earlier bounded rollout plan.

This file is migration authority only.

It must not be used as the primary source for current support claims; those live
in `active-support-scope.md` and `topology-and-product-semantics.md`.

## Next Active Track. Exact Engine FinalFace Migration

This track is the active execution order after the 2026-04-30 CTO review
closure. It does not renumber the historical rollout phases below; it defines
the next exact-engine implementation path from the current runtime checkpoint.

### Step 1. Extend `FinalFace[]` Bridge To Every Stroke Family

Goal:

- route solid center, dashed center, constrained solid, and constrained dashed
  render / hit-test / export projections through `FinalFace[]`

Current implementation checkpoint:

- solid center projections already derive render, hit-test, and export payloads
  from a `FinalFace[]` bridge
- dashed center, constrained solid, and constrained dashed packet tests now
  assert that each family can materialize `FinalFace[]`
- bridge mode preserves existing packet cardinality by default; duplicate
  collapse remains opt-in for exact arrangement / face-collapse phases
- `FinalFace[]` bridge preserves typed owner, interval, contour, legal-domain,
  topology, runtime, and paint metadata supplied by the source packets

Required outputs:

- all stroke families can materialize `FinalFace[]`
- bridge mode preserves existing packet cardinality by default
- no bridge conversion enables duplicate collapse unless an exact face-collapse
  phase explicitly requests it

Gate:

- current product rendering, hit-test, and export tests remain behaviorally
  unchanged
- every final face carries typed owner metadata when the source packet provides
  it

Wrong-decision recovery:

- if bridge conversion changes visible packet count or hit/export behavior,
  disable collapse for that family and restore behavior before proceeding

### Step 2. Complete `visualPacketKey` Semantics

Goal:

- make duplicate-region collapse safe by encoding the full visual stacking
  identity

Current implementation checkpoint:

- `FinalFace` debug metadata accepts a typed `visualContext`
- `visualPacketKey` is built from paint identity, paint revision, stroke spec,
  opacity, blend mode, effect key, mask key, clip key, stacking group,
  visibility key, and runtime family key
- current stroke data does not yet provide blend/mask/clip/effect/stacking
  context, so bridge code uses explicit placeholder keys such as
  `blendMode: "normal"`, `mask:none`, `clip:none`, `effect:none`, and
  `stack:default`
- tests prove duplicate geometry does not collapse when paint, opacity, or
  visual context differ
- bridge default remains no-collapse; explicit duplicate collapse is still
  reserved for exact arrangement / face-collapse phases

Required outputs:

- `visualPacketKey` includes or references paint, opacity, blend mode, effect
  context, mask/clip context, stroke spec, stacking group, visibility state, and
  compatible runtime geometry family

Gate:

- same visual packet duplicate faces may collapse without opacity stacking
- different paint, opacity, blend, mask, clip, effect, stack, visibility, or
  stroke spec never collapse

Wrong-decision recovery:

- if a fixture shows incorrect merging, widen `visualPacketKey`; never patch
  render or export separately

### Step 3. Add Source `fillRule` And Default Migration

Goal:

- make legal-domain classification read source policy instead of hardcoded
  assumptions

Required outputs:

- source topology model exposes `fillRule: "evenodd" | "nonzero"`
- old vectors without a fill-rule field default to `evenodd`
- exact support cannot be claimed for a family whose legal-domain stage ignores
  source fill rule

Gate:

- self-intersection and compound legal-domain tests can run both `evenodd` and
  `nonzero` cases

Wrong-decision recovery:

- if a helper hardcodes `evenodd` for exact support, demote the exact claim and
  move the rule back into source normalization

Current implementation checkpoint:

- `PathTopologyModel` exposes `fillRule` and `fillRuleBasis` as concrete
  `"evenodd" | "nonzero"` values.
- legacy vector render data normalizes missing `fillRule` to `evenodd`.
- topology revision includes `fillRule`, so legal-domain consumers cannot reuse
  stale topology after a fill-rule change.
- constrained solid legality diagnostics read source `fillRule`; simple polygon
  clipping remains visually unchanged because `evenodd` and `nonzero` are
  equivalent for the currently supported simple domain.

### Step 4. Implement `GeometryBackend` Registration And Selection

Goal:

- keep heavy boolean / offset work behind a replaceable backend adapter

Required outputs:

- backend registration / selection entrypoint
- lazy backend loading policy
- tests using a mock backend to verify `union`, `difference`, `intersection`,
  `offset`, and `buildArrangement` data flow
- unsupported backend continues to fail loudly

Gate:

- missing backend support cannot silently emit empty geometry, center fallback,
  or local-side approximation

Wrong-decision recovery:

- if backend integration leaks into product helpers directly, move it behind the
  adapter before continuing

Current implementation checkpoint:

- `geometry-backend.ts` defines `GeometryBackend`, `GeometryBackendRegistry`,
  and `GeometryBackendRegistration`.
- the default registry starts with
  `unsupported-exact-geometry-backend`, which throws explicit errors for
  `union`, `difference`, `intersection`, `offset`, and `buildArrangement`.
- backend registrations are lazy: `load()` is not called until the selected
  backend is resolved.
- resolving a registration whose loaded backend id does not match the declared
  id fails immediately.
- tests verify operation data flow through a mock exact backend without
  introducing a real boolean dependency yet.

### Step 5. Implement Legal-Domain Normalization

Goal:

- solve compound overlapping holes with normalized legal boundaries

Required outputs:

- `LegalDomain = union(shells) - union(holes)`
- normalized boundaries with deterministic seam selection
- source contour/span metadata attached to normalized boundary spans
- dash allocation uses normalized boundaries for normalized compound paths

Gate:

- overlapping-hole fixtures prove hidden raw hole edges do not produce product
  stroke geometry

Wrong-decision recovery:

- if raw contour intervals leak into normalized product geometry, return to
  legal-domain normalization before touching dash or render code

Current implementation checkpoint:

- `legal-domain-normalization.ts` defines `NormalizedLegalDomain`,
  `NormalizedBoundarySpan`, and `buildCompoundLegalDomainNormalization`.
- containment-only compound paths normalize without a heavy backend and emit one
  shared legal-domain id plus deterministic topmost-leftmost seams for each
  boundary span.
- source contour ids and committed `SourceSpanGraph` span ids are attached to
  normalized boundary spans.
- overlapping holes are not promoted to product compound support without an
  exact backend. Without `allowBackendNormalization` and a registered backend,
  normalization returns `blocked: requires-exact-backend`.
- vector product runtime now passes the selected exact backend into compound
  normalization when `union` and `difference` are available. With that backend,
  overlapping-hole vectors promote to one shared normalized legal domain instead
  of separate raw-network domains.
- mock-backend tests verify the exact boolean flow:
  `union(shells, nonzero) -> union(holes, nonzero) ->
  difference(shells, holes, nonzero)`. Role-level union is geometric union; it
  must not reuse source `evenodd` because overlapping same-role regions would
  toggle into XOR-like gaps.
- vector product rendering now consumes the normalization result for shared
  compound legal-domain metadata. If normalization is blocked, it keeps the
  source networks separate instead of assigning a false shared compound domain.

### Step 6. Implement Source Span Graph And Dash Interval Split

Goal:

- make dash ownership span-aware before self-intersection and arrangement
  support

Required outputs:

- source spans split at vertices, self-intersections, normalized-boundary cuts,
  and dash interval boundaries
- dash intervals carry `sourceSpanIds`
- interval crossing a self-intersection is split before face ownership

Gate:

- tests can trace each final face back to interval ids and source span ids

Wrong-decision recovery:

- if a dash interval claims an unsplit self-intersection span, fix interval/span
  allocation before candidate generation

Current implementation checkpoint:

- `source-span-graph.ts` defines `SourceSpanGraph`, `SourceSpanRecord`, and
  `SourceSpanCut`.
- source spans are split at topology vertices, dash interval boundaries, and
  detected line-segment self-intersections on the current flattened topology.
- dashed center and constrained dashed packets attach `sourceSpanIds` to debug
  metadata; the existing `FinalFace[]` bridge carries those ids into final face
  records.
- legal-domain normalized boundary spans now use the source span graph instead
  of raw segment ids.
- Step 6 does not split render packets into multiple visible fragments yet.
  That is intentional: Step 7 arrangement will split final faces while
  preserving visual continuity and avoiding seam artifacts.

### Step 7. Implement Candidate Arrangement And Face Classification

Goal:

- solve self-intersection, high-curvature candidate self-overlap, and duplicate
  face ownership through arrangement

Required outputs:

- source/candidate arrangement
- legal-domain face classification
- side-aware inside/outside classification
- ownerSet assignment
- duplicate-region face detection

Gate:

- self-intersecting inside and outside dashed fixtures are classified as
  distinct exact face sets
- high-curvature candidates remove illegal/duplicate self-overlap faces
- render, hit-test, and export all project from the same exact `FinalFace[]`

Wrong-decision recovery:

- if arrangement cannot explain a visible face owner, keep the family as
  `local-side-approximation` or `research-gated`; do not promote it to exact

Current implementation checkpoint:

- `stroke-candidate-arrangement.ts` converts resolved stroke packets into
  typed `CandidateRegion[]` without parsing `geometryId`.
- arrangement work is backend-driven through `GeometryBackend.buildArrangement`;
  the unsupported backend still throws instead of producing silent empty output.
- arrangement faces are filtered by authored `strokePosition` and face
  `legalState`: `inside` keeps inside-domain faces, `outside` keeps
  outside-domain faces, and `center` keeps all faces.
- backend-returned arrangement faces become exact `FinalFace[]` with
  `arrangementStatus: "exact"`, `arrangementFaceId`,
  `arrangementCandidateIds`, and `arrangementLegalState` metadata.
- same-visual claims on one arrangement face merge owner, interval, source
  span, source contour, and legal-domain metadata into one exact final face;
  different visual packet keys remain separate.
- product constrained dashed self-intersecting / high-curvature families remain
  `local-side-approximation` until an exact backend is selected and product
  runtime routing is explicitly promoted. Step 7 adds the exact bridge; it does
  not silently switch product output.

### Step 8. Enable Explicit Duplicate Collapse For Exact Families

Goal:

- turn on collapse only after exact arrangement and owner metadata are complete

Required outputs:

- `collapseDuplicateFaces: true` only for families with exact face ownership
- ownerSet / intervalIds / sourceSpanIds / sourceContourIds preserved after
  collapse
- same visual packet collapse does not stack opacity
- different visual packets remain separate

Gate:

- collapse changes no visual result except removing duplicate same-packet
  overdraw
- hit-test still returns deterministic primary owner plus full ownerSet
- visual export emits merged final faces while editable/internal export can
  preserve owner metadata

Wrong-decision recovery:

- if collapse changes visible stacking or loses owner metadata, disable collapse
  for that family and fix `visualPacketKey` / ownership before retrying

Current implementation checkpoint:

- `buildStrokeFinalFacesFromResolvedPackets(..., { collapseDuplicateFaces:
  true })` now treats collapse as a guarded exact-only operation. Local-side
  approximation bridge packets remain separate even if a caller requests
  collapse.
- exact duplicate collapse requires `arrangementStatus: "exact"`,
  `resolutionStatus: "exact-constrained"`, and `runtimeStatus: "accepted"`.
- `collapseExactDuplicateFinalFaces` collapses exact `FinalFace[]` records by
  geometry signature plus `visualPacketKey`, preserving `ownerSet`,
  `intervalIds`, `sourceSpanIds`, `sourceContourIds`, and legal-domain ids.
- `buildArrangedStrokeFinalFacesFromResolvedPackets` applies exact duplicate
  collapse after backend arrangement conversion. This removes duplicate
  same-packet exact faces without changing opacity or visual stacking.
- `collapseStrokeFinalFaceVisualOverlaps` now runs after the vector renderer
  assembles the single `strokeFinalFaces` source. It groups faces by
  `visualPacketKey`, skips groups whose bounds do not overlap, and backend-unions
  only same-visual overlapping groups. The merged face preserves
  `ownerSet`, `intervalIds`, `sourceSpanIds`, `sourceContourIds`, legal-domain
  ids, and debug collapse provenance.
- This visual-overlap collapse applies before render / hit-test / export
  projection, so same stroke opacity is not stacked in overlap regions and all
  projections see the same canonical product geometry. For any point covered by
  `N` same-visual faces, product coverage is exactly one layer; the collapse
  must never turn coverage into zero layers.
- Same-visual union normalizes input winding because those inputs are coverage,
  not shell/hole contour roles. Opposite-oriented duplicate coverage must not
  cancel into holes.
- `strokeDebugOptions.disableVisualOverlapCollapse` is available as a
  diagnostic-only vector render option. It bypasses same-visual overlap collapse
  so implementers can inspect raw `FinalFace[]` geometry; product defaults keep
  collapse enabled.
- Asyra Design exposes this through an icon-only toolbar overlap-debug toggle backed by
  runtime system property `strokeDebugDisableVisualOverlapCollapse`. The toggle
  is debug UI only: it is visible in development builds, hidden in production by
  default, and can only be exposed in production with the explicit
  `VITE_ASYRA_ENABLE_STROKE_DEBUG_UI=true` build flag. The toggle must not mutate
  element computed data or authored stroke payloads; it only rebuilds the current
  render projection for inspection.
- different visual packet keys still remain separate, including different
  paint, opacity, blend, mask, clip, effect, stack, visibility, or stroke spec.
- tests:
  - `solid-center-stroke-packets.test.ts` verifies local-side approximation does
    not collapse and exact duplicates do.
  - `stroke-candidate-arrangement.test.ts` verifies exact arrangement duplicate
    faces collapse without opacity stacking, same-visual overlaps union before
    projection, different-opacity overlaps remain separate, opposite-winding
    same-visual coverage cannot cancel to zero layers, empty backend union fails
    open, and non-overlapping same-visual faces skip backend union.
  - `vector-constrained-dashed-stroke.test.ts` verifies the debug bypass keeps
    raw same-visual faces available without changing the product default.
  - `viewport-navigation.spec.ts` verifies the toolbar toggle changes the
    runtime debug system property.

## Next Active Track. Exact Backend And Product Promotion

This track starts after the FinalFace migration steps. Completing the previous
eight steps means the architecture can safely host an exact stroke engine; it
does not mean every stroke topology is already exact. The following phases are
the remaining path to product-grade Figma-like stroke behavior.

### Status Taxonomy After CTO-Review Closure

Exact-stroke work must be tracked as product workstreams plus shared
infrastructure blockers. Do not report shared blockers as independent product
features.

Defined product workstreams:

1. self-intersecting closed `inside/outside` dashed exact stroke - exact
   promotion is currently gated off; side-aware local visibility is implemented
   and protected
2. high-curvature / offset self-overlap exact constrained stroke - backend-gated
   exact promotion exists with real-backend partition and side-specific fixtures
3. overlapping compound holes normalized-boundary dashed stroke - implemented
   for the backend-normalized compound constrained dashed product path
4. multi-network / duplicate-region ownership collapse - implemented for the
   exact arranged constrained dashed product path

Shared infrastructure blockers:

1. holed / multi-contour arrangement face classification
2. direct `FinalFace[]` projection for promoted exact families
3. exact geometry cache / dirty graph hardening

Implementation rule:

- high-curvature exact promotion must be reported as an implemented
  backend-gated product path after real-backend partition, promotion, and
  side-specific signature fixtures are present
- self-intersecting exact promotion must not be reported as implemented until
  exact legal-domain clipping preserves valid internal dash regions after
  backend load
- any remaining work for those families is broader Figma/reference parity,
  stress coverage, and performance hardening, not a missing promotion path
- overlapping compound holes normalized-boundary dashed stroke and
  multi-network / duplicate-region ownership collapse must not be listed as
  unfinished product work unless a regression is found
- the three shared infrastructure items exist only because the product
  workstreams cannot be completed safely without them
- if a later status report lists remaining work, it must preserve this grouping
  and avoid presenting the shared blockers as separate product semantics

### Phase 9. Connect Exact Geometry Backend

Goal:

- replace the unsupported backend with a production exact geometry backend
  adapter for boolean, offset, and arrangement operations

Required outputs:

- selected backend adapter, initially Clipper2 WASM or an equivalent
  deterministic polygon engine
- deterministic coordinate scaling from model-space floats to integer backend
  coordinates and back
- backend version and capability metadata included in cache keys
- `union`, `difference`, `intersection`, `offset`, and `buildArrangement`
  backed by real operations
- explicit unsupported errors remain when no backend is registered

Gate:

- legal-domain normalization handles overlapping holes through backend boolean
  operations
- arrangement bridge receives real partitioned faces
- missing backend support cannot emit empty geometry, fallback center, or
  pretend exact output

Wrong-decision recovery:

- if backend integration leaks into product helpers directly, move it behind
  `GeometryBackend` before continuing
- if coordinate scaling changes topology or creates unstable hashes, revert the
  backend promotion and fix scaling before enabling product families

Current implementation checkpoint:

- implemented: `geometry-backend.ts` defines registration, lazy resolution,
  unsupported backend behavior, mock-backend operation tests, backend
  capability metadata, backend version metadata, deterministic coordinate
  policy, shared coordinate mapper, and backend cache signatures.
- implemented: `clipper2-geometry-backend.ts` wraps `clipper2-wasm@0.2.1`
  behind `GeometryBackend` for `union`, `difference`, `intersection`, and
  `offset`. Product helpers still do not import Clipper2 directly.
- implemented: async preload/register helpers expose Clipper2 registration to
  a future backend bootstrap entrypoint without making synchronous product
  geometry helpers initialize WASM on demand.
- implemented: `enableDefaultExactGeometryBackend` is exported from the root
  preset entrypoint as a dynamic-import bootstrap. It does not statically import
  the concrete Clipper2 backend.
- implemented: the Asyra Design app starts the exact backend bootstrap in the
  background after `applyPreset`. Before the async backend is ready, product
  rendering remains on local-side constrained visibility; after selection,
  accepted constrained dashed packets can promote through exact arrangement.
- bundle guard: concrete Clipper2 helpers remain outside the root static export
  surface. The default app may emit async backend assets, but synchronous product
  geometry helpers must not initialize or await WASM during render.
- implemented: Clipper2-backed `buildArrangement` partitions overlapping
  candidate regions into disjoint faces and preserves multi-candidate owner
  claims.
- implemented: typed legal-domain face classification runs after backend
  partitioning and before product inside/outside filtering.
- implemented: holed and mixed multi-contour arrangement faces use
  deterministic filled-region sampling and split mixed legal states before
  inside/outside filtering.
- current limitation: broader real-document Figma/reference parity remains a
  hardening requirement for extreme multi-contour faces, not a blocker for the
  implemented backend arrangement path.

### Phase 10. Promote Constrained Dashed To Exact Arrangement

Goal:

- replace local-side approximation with exact arrangement output family by
  family

Promotion order:

1. simple closed inside/outside dashed
2. self-intersecting inside/outside dashed
3. high-curvature sampled closed dashed
4. multi-network overlap dashed
5. compound holes dashed

Required outputs:

- chosen-side candidate geometry only
- backend arrangement partitioning
- legal-domain face classification
- ownerSet collapse through exact `FinalFace[]`
- render, hit-test, and export projections from exact final faces

Gate:

- promoted families report `resolutionStatus: "exact-constrained"`
- promoted families do not depend on diagnostics to define visible output
- inside/outside does not disappear and does not fallback to center

Current implementation checkpoint:

- `clipper2-geometry-backend.ts` now implements backend-driven candidate
  partitioning. Overlapping candidates are split into disjoint arrangement
  faces; overlap faces carry all contributing candidate claims.
- `stroke-candidate-arrangement.ts` converts partitioned backend faces into
  exact `FinalFace[]`, groups same visual packet claims, and preserves different
  visual packet separation.
- `arrangement-face-classifier.ts` now recomputes arrangement `legalState` from
  typed legal-domain geometry and source `fillRule` before the bridge applies
  authored `inside` / `outside` filtering. Backend permissive legal state is no
  longer product authority when legal domains are supplied.
- vector product runtime now has a gated exact promotion path for accepted
  constrained dashed packets: when the selected `GeometryBackend` supports
  `buildArrangement`, all accepted local candidate packets for the vector are
  promoted through one backend arrangement pass, classified against the vector
  legal domain, and projected back from exact `FinalFace[]`.
- if no exact backend is selected, or if backend arrangement fails, product
  runtime keeps authored-side local constrained dashed visibility. It must not
  emit center fallback and must not disappear merely because exact arrangement
  is unavailable.
- implemented: real Clipper2-backed fixtures cover self-intersecting
  arrangement partitioning, high-curvature overlapping candidate partitioning,
  backend-gated product promotion, and side-specific inside/outside exact
  signatures.
- current limitation: broader visual/reference parity for extreme repeated
  dash intervals remains a hardening task.

Wrong-decision recovery:

- if a promoted family shows unexplained visible faces, demote only that family
  back to explicit `local-side-approximation` and fix the exact path before
  retrying

### Phase 11. Exact Compound And Multi-Network Ownership

Goal:

- make compound legal domains and multi-network overlap ownership exact and
  product-visible

Required outputs:

- `union(shells) - union(holes)` legal-domain normalization in the product path
- dash interval allocation on normalized boundaries for normalized compound
  paths
- normalized boundary spans mapped back to source owner metadata
- multi-network same-visual collapse and different-visual separation
- hit-test returns primary owner plus full ownerSet

Gate:

- overlapping holes do not draw stroke on hidden raw hole edges
- multi-network overlap never resolves owner by `geometryId` or incidental
  packet order
- visual export, editable metadata, and hit-test agree on final geometry

Current implementation checkpoint:

- arrangement final faces preserve `ownerSet`, `intervalIds`, `sourceSpanIds`,
  `sourceContourIds`, and `legalDomainIds`.
- hit-test and export packets expose `primaryOwner`, `ownerSet`, interval ids,
  source span ids, source contour ids, and legal-domain ids from the same
  `FinalFace[]` source used by render.
- multi-network overlap ownership can be represented without parsing
  `geometryId`; UI selection policy can consume `primaryOwner` plus `ownerSet`.
- constrained dashed multi-network exact promotion now runs across all accepted
  network candidates in one arrangement pass. Same-visual overlap can collapse
  into one product packet while preserving every network owner in `ownerSet`.
- exact `FinalFace[]` compatibility packets carry typed `ownerSet`, interval,
  source-span, source-contour, and legal-domain metadata in debug metadata so
  downstream compatibility projections cannot collapse multi-owner faces back
  to a single owner.
- backend-normalized overlapping compound-hole dashed strokes now allocate
  product dashes on normalized legal-domain boundary spans instead of raw
  overlapping hole contours. The projected packets preserve source contour,
  source span, legal-domain, and ownerSet metadata.

Wrong-decision recovery:

- if normalized-boundary dash placement diverges from visible legal-domain
  output, stop promotion and repair legal-domain normalization first

### Phase 12. Export, Hit-Test, And Runtime Promotion

Goal:

- make exact `FinalFace[]` the single product source for promoted families

Required outputs:

- render projection from exact `FinalFace[]`
- hit-test projection from the same exact `FinalFace[]`
- visual export projection from the same exact `FinalFace[]`
- editable/internal export preserves owner metadata
- legacy projection routes either removed or limited to explicit non-exact
  fallback families

Gate:

- render, hit-test, and export coverage match on the same fixture set
- promoted exact families have no second stroke geometry path
- project scan confirms no old product route silently handles exact families

Current implementation checkpoint:

- solid center packet projections expose dedicated `FinalFace[]` conversion
  helpers for render, hit-test, and export.
- hit-test/export packet metadata now comes from the same `FinalFace[]` records
  as render entries.
- hit/export projection arrays are cached per `FinalFace[]` source to avoid
  rebuilding packet metadata repeatedly in one render pass.
- vector product runtime now builds one combined `strokeFinalFaces` source per
  render pass. Non-exact packets are converted once into `FinalFace[]`; exact
  arranged constrained dashed faces are appended directly without converting
  back into resolved packets first.
- vector render, hit-test, and export project from the combined
  `strokeFinalFaces` source. Multi-owner exact faces therefore keep their full
  `ownerSet` without relying on a packet round-trip.
- current limitation: non-vector product paths and explicit no-backend
  local-side approximation families may still use resolved packet compatibility
  projection before reaching `FinalFace[]`.

Wrong-decision recovery:

- if parity breaks, restore the last exact `FinalFace[]` source and fix only the
  faulty projection; do not restroke authored input in render/export layers

### Phase 13. Performance Hardening

Goal:

- make the exact engine sustainable for animation and interactive editing

Required outputs:

- backend result cache
- topology, source-span, interval, arrangement, and final-face cache layers
- active-drag preview policy with settled-frame exact recompute
- benchmark fixtures for 100 points, 10+ self-intersecting stars, compound
  holes, and multi-network overlap
- helper-level performance tests for heavy geometry stages

Gate:

- normal interaction target remains 120 fps
- minimum floor remains 60 fps
- no repeated flatten, topology, interval allocation, or arrangement work within
  one frame for the same revision
- CPU and memory stay bounded under benchmark workloads

Current implementation checkpoint:

- implemented: Clipper2 backend operations use bounded per-backend result caches
  for `union`, `difference`, `intersection`, `offset`, and `buildArrangement`.
  Cached outputs are cloned before return so caller mutation cannot poison later
  geometry.
- implemented: arrangement cache entries are reconstructed against the current
  `CandidateRegion` objects by typed candidate id, so owner metadata remains
  current and is not recovered from geometry ids.
- implemented: solid-center `FinalFace[]` projection helpers cache hit-test and
  export packet arrays per final-face source, avoiding repeated metadata packet
  rebuilding in one render pass.
- implemented: vector runtime combines non-exact packet-derived faces with
  promoted exact arrangement faces into one `strokeFinalFaces` array, then uses
  that array for render, hit-test, and export projections.
- implemented: vector, rectangle, and oval runtime paths already reuse shared
  path geometry and topology models per source revision; existing performance
  contract tests guard that topology count tracks network count, not packet
  family count.
- validated: app production build places Clipper2 in async backend assets
  (`clipper2-geometry-backend` chunk plus `clipper2z` WASM). The main render
  path still does not synchronously import or await the backend.
- implemented: browser Clipper2 loading now uses the bundler-resolved WASM URL
  through `locateFile`, preventing dev/prod servers from returning HTML as a
  failed `.wasm` response.
- implemented: active geometry-backend selection now notifies preset render
  subscriptions, and selection changes reload the render scene tree. Existing
  vectors therefore recompute exact backend-gated stroke geometry after the
  async backend finishes loading.
- implemented: arrangement legal-domain classification now samples filled
  regions for simple, concave, holed, and mixed multi-contour faces. If one
  backend face contains polygons with different legal states, the classifier
  splits them before inside/outside filtering.
- implemented: closed self-intersecting constrained dashed packets remain
  product-visible as authored-side local geometry. Exact promotion is disabled
  for this topology because the current legal-domain clipping pass can remove
  valid internal dash regions after backend load; packets therefore keep
  `resolutionStatus: "local-side-approximation"` even with a selected backend.
- implemented: sampled-simple / high-curvature constrained dashed packets now
  have the same backend-gated exact promotion path. With a selected arrangement
  backend they return `resolutionStatus: "exact-constrained"`; without a
  backend they remain visible as explicit `local-side-approximation` packets.
- implemented: backend-normalized compound-hole boundary dash projection is
  product-visible after async bootstrap.
- implemented: high-curvature exact promotions have real-backend fixtures
  proving partitioned candidate faces, product promotion, and side-specific
  inside/outside signatures. Self-intersection fixtures currently guard stable
  local-side visibility and side-specific geometry until exact clipping is
  corrected.
- current limitation: performance/stress coverage must continue to grow for
  large documents, animation, and extreme repeated-interval reference parity.

Wrong-decision recovery:

- if exact backend work misses the frame budget, keep exact output for settled
  frames and repair dirty graph/cache boundaries before enabling animated
  exact recompute

## Phase 0. Documentation Reset

### Goal

Install this final spec package as the active authority.

### Required outputs

- final source-of-truth folder
- analysis report
- legacy deletion plan
- deletion of earlier stroke planning files outside `stroke-engine-final/`

### Gate

- reviewers can identify one active entrypoint without searching old plans

### Expected situations

- deleted legacy docs still appear in search as files
- reviewers still cite deleted legacy files as implementation references
- routing ambiguity is discovered during review

### Decision rule

- if any reviewer can reasonably mistake a deleted legacy file for active authority,
  this phase remains open

### Wrong-decision recovery

- delete legacy files, update routing, and preserve any still-needed rationale
  in decision history first
- rerun cross-doc review before moving on

## Phase 1. Typed Packet And Dirty-Key Foundation

### Goal

Replace string-derived semantics with typed packet metadata and explicit dirty
keys.

### Current implementation note

The current runtime has supported the first typed diagnostics slice:

- constrained dashed runtime status is emitted as typed diagnostics with
  `accepted` and `blocked` states; unsupported constrained dashed cases must not
  be made visible through center-derived substitute packets
- diagnostics include `sourceId`, optional `networkId`, source topology,
  ownership reason, and candidate packet count
- vector constrained dashed classification is per-network for disjoint networks
  instead of one global multi-owner block
- stroke packets now carry `revisionSet` values derived from real source path,
  stroke spec, interval allocation, topology classification, ownership,
  legality, paint, and preview/exact inputs
- render cache now compares packet revision sets with `computeStrokeDirtyKeys`
  before deciding whether geometry or paint work is dirty
- constrained dashed owner metadata is supplied through typed packet metadata;
  helper code must not derive owner identity from `geometryId`, cache key, or
  cache-prefix parsing

### Required outputs

- typed region packet contract
- typed owner/network/interval/source metadata
- stage revision keys
- minimal invalidation policy

### Must not do

- change product-visible geometry behavior yet unless needed for correctness

### Gate

- no helper still depends on parsing `geometryId`
- dirty-key contract is testable
- dirty-key runtime integration is not complete until real source, topology,
  interval, ownership, legality, paint, and preview/exact revisions are emitted
  by the canonical pipeline; cache-key or `geometryId` derived placeholders do
  not satisfy this gate

### Expected situations

- hidden owner parsing survives in helper glue
- packet ids are still overloaded with semantic meaning
- conservative invalidation reruns too much work

### Decision rule

- if ownership or support semantics require string parsing anywhere, the phase is
  not done
- if invalidation cannot explain which stage reruns and why, the phase is not
  done

### Wrong-decision recovery

- move semantics into typed metadata
- widen invalidation conservatively if needed
- then tighten invalidation with tests before closing the phase

## Phase 2. Shared PathTopologyModel

### Goal

Build one reusable canonical path-topology object per path/network revision.

### Current implementation note

The current runtime has supported the first shared-topology slice:

- `buildPathTopologyModel` creates a reusable topology object for shape paths
  and vector network paths
- rectangle, oval, and vector render strategies build one topology per
  source/network pass and pass that object to center, constrained solid,
  constrained dashed, diagnostics, render, hit-test, and export packet builders
- dashed interval allocation consumes the topology length and closure state via
  `allocateDashedIntervalsForTopology` instead of rebuilding private path-length
  state inside each packet family
- topology classification is owned by the shared model and is reused by
  constrained dashed support classification
- compound closed legal-domain classification has a containment-depth helper
  and regression fixture, so shell/hole role is not inferred from contour
  orientation alone
- the first compound product slice is closed for constrained solid
  containment-only vectors with one shell and one hole; render / hit-test /
  export packets consume the shared compound legal-domain metadata directly
- vector render diagnostics expose the number of path-topology models built in
  the pass, matching the existing path-geometry model counter

### Required outputs

- one reusable topology builder
- one topology-family classifier
- one interval allocator consuming topology directly
- one legal-domain decomposition path for compound closed support classification
  before any compound product stroke support claim
- one constrained solid containment-only compound product path with explicit
  dashed/nested/intersecting blocked behavior

### Gate

- one network is flattened once per revision
- center/constrained/dashed/render/hit/export reuse one topology object

### Expected situations

- multiple packet families still rebuild the same topology
- preview mode and exact mode drift into different topology families
- topology classification remains tied to shape-specific shortcuts
- compound closed paths still infer hole behavior from orientation only

### Decision rule

- if one network revision produces more than one topology build in one pass, the
  phase is not done
- if preview changes topology family or support state, the phase is not done
- if compound closed classification lacks explicit legal-domain descriptors, the
  topology-classification slice is not done
- if compound closed dashed, nested, intersecting, or shared-edge behavior is
  claimed from the constrained solid containment-only slice, the claim must be
  demoted

### Wrong-decision recovery

- consolidate topology creation into one reusable builder
- separate tessellation density from topology semantics
- update classifier contracts before touching downstream packet code

## Phase 3. Final One-Sided Solid Geometry

### Goal

Move exact constrained solid geometry onto direct one-sided construction.

### Current implementation note

The current runtime has closed the supported simple solid slice:

- simple closed constrained solid paths use one-sided constrained geometry
- open paths use center-equivalent geometry for authored `inside` / `outside`
  positions; they do not enter the constrained solid product path
- render, hit-test, and export consume the same resolved packet source
- open-path center-equivalent rendering is canonical behavior, not substitute
  fallback visibility
- inside closed constrained solid candidates are clipped against the declared
  legal source domain before packet emission
- closed inside bevel joins now emit bevel join geometry instead of reusing
  miter geometry
- closed miter-limit exceedance emits bevel join geometry while staying in the
  `exact-constrained` / `accepted` runtime family
- constrained solid packets carry typed contour, legal-domain, source-topology,
  topology-family, owner, network, and stroke metadata through render, hit-test,
  and export
- compound constrained solid vectors with one shell and one hole share a
  compound legal-domain id and invert selected side on the hole contour so
  inside/outside is resolved against the filled legal domain
- outside miter/bevel keeps compact exact output when body faces do not overlap;
  outside round and inside constrained joins use explicit one-sided join
  construction
- no constrained solid path uses doubled-width center geometry as a product
  route

### Required outputs

- one-sided body faces
- one-sided join faces
- one-sided legality input
- no doubled-width constrained solid path

### Gate

- exact inside/outside solid support no longer depends on clipped symmetric
  center geometry
- acute-corner, join, and miter-limit behavior follows
  `exact-correct-path-algorithm.md`
- miter-limit exceedance produces bevel geometry in the supported exact family,
  not a blocked or unsupported result

### Expected situations

- old doubled-width assumptions remain in legality helpers
- one-sided join/cap construction produces missing or extra faces
- miter/bevel/round behavior diverges by source family

### Decision rule

- if opposite-side geometry exists before legality for a supported exact slice,
  this phase is not done
- if source-equivalent paths produce different one-sided semantics, this phase
  is not done
- if a helper treats miter-limit exceedance as an error to repair in render,
  export, paint, or hit-test, this phase is not done

### Wrong-decision recovery

- return to one-sided candidate construction first
- do not patch legality or paint to hide wrong geometry
- update tests to prove ghost-band removal before proceeding

## Phase 4. Final One-Sided Dashed Geometry

### Goal

Move exact constrained dashed support onto interval-local one-sided geometry.

### Current implementation note

This phase is closed for the supported constrained dashed slices:

- full-loop slices reuse exact one-sided constrained solid geometry
- supported non-full-loop slices build interval-local one-sided candidates from
  the sliced source fragment
- closed inside slices apply legality clipping to the one-sided candidate, not
  to a doubled-width center band
- closed self-intersecting constrained dashed slices preserve authored
  `inside/outside` visibility through local-side approximation packets until
  exact face arrangement, legal-domain classification, and duplicate
  semantic-region collapse are implemented
- open dashed paths use center-equivalent geometry for authored `inside` /
  `outside` positions and do not emit constrained dashed runtime diagnostics
- open dashed paths with zero and non-zero `dashOffset` both emit true
  arc-length pattern intervals; Figma-like endpoint half-dash balancing is a
  deliberate product divergence
- full-loop and interval-local packets carry typed owner, network, stroke,
  contour, legal-domain, source-topology, topology-family, and
  interval-topology metadata
- render, hit-test, export, runtime diagnostics, and blocked decisions consume
  typed packet metadata instead of inferring support from packet ids

Closed constrained dashed slices must not use either of these historical
visibility paths:

- remapping `inside/outside` to center stroke for render visibility
- building doubled-width center packets and clipping them back to one side

### Required outputs

- interval-first one-sided candidate construction
- direct single-edge / corner-spanning / full-loop one-sided candidates
- no center-band constrained dashed path

### Gate

- exact supported constrained dashed slices are built without doubled-width
  center packets
- dashed exact support follows the interval and overlap rules in
  `exact-correct-path-algorithm.md`

### Expected situations

- interval-local geometry still reuses center-band helpers
- corner-spanning and single-edge slices disagree on side semantics
- full-loop support is correct but non-full-loop support remains ambiguous

### Decision rule

- if a supported constrained dashed slice still starts from widened center
  geometry, this phase is not done
- if interval families require separate hidden geometry engines, this phase is
  not done

### Wrong-decision recovery

- move the fix back to interval-local one-sided candidate building
- keep unsupported interval families explicitly gated instead of forcing them
  through a wrong geometry class

## Phase 5. Arrangement, Ownership, And Legality Hardening

### Goal

Formalize the face-partition and ownership path for overlap-heavy scenarios.

### Current implementation note

This phase is closed for the supported constrained solid ownership/legality
slice:

- constrained solid ownership diagnostics now publish an explicit
  `arrangementPolicy`
- the current arrangement policy is `bounded-convex-subset-arrangement`
- the policy declares epsilon, rounding factor, max exact subset count,
  zero-area threshold, tangential-touch behavior, and coincident-edge
  deduplication behavior
- overlap-sensitive candidates emit typed `arrangementFaces` before
  `ownedRegions`
- each arrangement face records `faceId`, candidate ids, owner stroke, optional
  owner key, bounds, polygon, and partition method
- exact subset intersections are marked as `exact-subset-intersection`
- budget-bounded overlap regions are explicitly marked as
  `bounded-overlap-polygon`
  and therefore remain visible to future hardening work
- legality clipping now subtracts foreign-owned `arrangementFaces` instead of
  reparsing packet-level groups or using raw packet overlap as ownership truth
- existing nested and mixed-topology ownership tests now verify the explicit
  arrangement policy and arrangement face output

### Required outputs

- explicit arrangement stage
- typed ownership stage
- legality acting on partitioned faces
- one documented numeric robustness policy for arrangement

### Gate

- self-overlap and nested ownership families no longer rely on ad hoc packet
  grouping

### Expected situations

- arrangement is skipped when overlap actually exists
- ownership remains packet-group based instead of face-region based
- legality trims wrong regions because face ownership is still ambiguous
- production and tests use different epsilon or snap behavior

### Decision rule

- if overlap-sensitive slices cannot explain ownership at the face-region level,
  this phase is not done
- if legality is still correcting ownership mistakes, this phase is not done
- if arrangement correctness depends on undocumented numeric heuristics, this
  phase is not done
- if overlap can draw duplicate product layers instead of one semantic region,
  this phase is not done

### Wrong-decision recovery

- return to face partition and ownership inputs first
- do not add later-stage clipping patches to compensate
- downgrade the family to `research-gated` if exact semantics are not ready

## Phase 6. Open-Path Center-Equivalent Position Semantics

### Goal

Mark open-path center-equivalent semantics as supported.

### Current implementation note

This phase is closed for product open-path position semantics:

- render, hit-test, and export packets share the same resolved geometry
- solid open vectors carry `geometryFamily: "solid-center"`,
  `resolutionStatus: "native-center"`, `runtimeStatus: "not-applicable"`, and
  `sourceTopology: "open"` even when authored position is `inside` or
  `outside`
- dashed open vectors carry `geometryFamily: "dashed-center"`,
  `resolutionStatus: "native-center"`, `runtimeStatus: "not-applicable"`, and
  `sourceTopology: "open"` even when authored position is `inside` or
  `outside`
- dashed open vectors carry `dashPlacementMode: "arc-length-pattern"` metadata
  so tests and diagnostics can prove the runtime does not enter endpoint
  balancing paths
- switching an open vector from center to inside/outside preserves the packet
  family and hit geometry; constrained runtime diagnostics remain absent

### Required outputs

- explicit open-path position normalization before product packet construction
- render / hit-test / export parity for center-equivalent open strokes
- tests proving open-path position changes do not enter constrained families

### Gate

- open center-equivalent support is separate from closed constrained geometry
  and is tested as such

### Expected situations

- authored `inside` / `outside` is stored on the stroke but ignored by resolved
  open-path geometry
- open-path position changes should not dirty constrained packet families
- open-path cap and dash behavior follows the center stroke implementation

### Decision rule

- if an open path emits constrained solid/dashed packets solely because position
  is `inside` or `outside`, this phase is not done
- if an open-path position change changes hit geometry while width, dash, cap,
  join, and source geometry are unchanged, this phase is not done

### Wrong-decision recovery

- normalize open-path stroke positions to center before product packet
  construction
- remove constrained runtime diagnostics for open-path position changes
- update docs and tests to assert center-equivalent render / hit / export parity

## Phase 7. Self-Intersection And Multi-Network Semantics

### Goal

Mark exact support only after face semantics are defined.

Disjoint multi-network constrained dashed ownership is already supported for the
typed per-network slice. This phase still owns overlapping or shared-face
multi-network semantics.

### Current implementation note

This phase is closed as a gating phase, not as broad exact support:

- self-intersecting constrained solid and dashed paths may emit local-side
  visibility packets when no exact backend is selected; accepted constrained
  dashed packets promote to exact arrangement metadata when an exact backend is
  selected
- disjoint multi-network constrained dashed vectors remain supported through
  typed per-network owner diagnostics
- overlapping or boundary-touching multi-network source bounds are treated as
  shared-face candidates, not as an automatic product-geometry blocker
- overlapping constrained dashed vectors emit accepted per-network runtime
  diagnostics when typed interval-local one-sided packets can be built
- overlapping constrained solid vectors build global ownership diagnostics
  before accepted product packets are emitted
- exact boolean-union export minimization for overlapping constrained solid is
  still a later optimization gate

### Required outputs

- declared self-intersection face policy
- declared overlapping multi-network ownership policy
- research-gated to supported transitions documented explicitly

### Gate

- no unsupported exact family is silently treated as supported through
  substitute geometry

### Expected situations

- self-intersection appears visually plausible without approved face semantics
- overlapping multi-network ownership looks stable in one fixture but is not
  formally defined
- substitute visibility is mistaken for exact support

### Decision rule

- if face semantics or overlapping multi-network ownership semantics are not
  written explicitly, these families remain `research-gated` or `blocked`
- if the exact-correct algorithm branch cannot explain source intersections,
  interval visibility, and face classification, these families remain gated

### Wrong-decision recovery

- demote the family immediately if tests or reviewers reveal semantic ambiguity
- update topology semantics and tests before marking supported again

## Phase 8. Animation And Performance Hardening

### Goal

Make the engine safe for frequent point motion and future animation work.

### Current implementation note

This phase is closed for the declared baseline benchmark workloads:

- `packages/preset/src/__tests__/stroke-performance-contract.test.ts` measures
  the supported CPU geometry path in the current Vitest/jsdom runtime
- declared workloads cover:
  - 100 moving open points across 300 frames
  - one high-curvature cubic edit loop across 300 frames
  - one disjoint multi-network update path across 300 frames
- the benchmark uses 20 warmup frames, then checks average fps against the
  `120 fps` target and p95 frame time against the `60 fps` floor
- the multi-network workload asserts one topology build per network per frame
- no benchmark weakens support semantics to pass performance; failures must
  inspect dirty keys, topology reuse, interval reuse, and renderer CPU rebuild
  before changing geometry semantics

### Required outputs

- preview/exact policy enforcement
- topology reuse benchmarks
- frame-rate benchmarks
- renderer CPU/GPU cache validation
- benchmark environment contract enforcement

### Gate

- animation benchmarks show `>= 120 fps` target and `>= 60 fps` floor on the
  declared supported benchmark workloads

### Expected situations

- topology reuse is correct but renderer CPU churn remains high
- preview mode is fast but exact settle is too slow
- one benchmark passes while another reveals over-invalidation

### Decision rule

- if supported benchmark workloads cannot meet the floor, this phase is not done
- if performance only improves by weakening semantics silently, this phase is
  not done

### Wrong-decision recovery

- inspect dirty keys and cache reuse before touching semantics
- if a semantic family is too expensive for exact support, move it back to
  `research-gated` or blocked until the architecture can support it honestly

## Phase Rule For Every Phase

Before closing a phase:

- check cross-doc consistency
- check that support or blocked semantics are explicit
- check that helper contracts match the phase behavior
- check that the tests for the phase are written
- check that no deleted legacy stroke planning file exists outside
  `stroke-engine-final/`

If any of these fail, the phase is not complete.
