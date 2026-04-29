# Phase Execution Plan

## Role

This file defines the implementation sequence from the current stroke runtime to
the final stroke-engine architecture.

It is the active replacement for the earlier bounded rollout plan.

This file is migration authority only.

It must not be used as the primary source for current support claims; those live
in `active-support-scope.md` and `topology-and-product-semantics.md`.

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
  visibility packets; exact face ownership remains research-gated until an
  explicit face policy exists
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
