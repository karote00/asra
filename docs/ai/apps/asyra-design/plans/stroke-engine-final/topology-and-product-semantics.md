# Topology And Product Semantics

## Role

This file defines the product-semantics contract for topology families in the
final stroke engine.

Its purpose is to prevent the engine from silently deciding support semantics
through ad hoc implementation.

Current support guarantees are governed jointly by this file and
`active-support-scope.md`.

This file defines semantic family rules.

It does not by itself turn roadmap ambition into current support.

## Product Goal

The final goal is Figma-like stroke behavior for supported Asyra Design paths.

This goal includes, over time:

- simple closed paths
- open paths
- self-intersecting closed paths
- multi-network paths
- high-curvature sampled smooth paths
- animation-heavy editing updates

The final engine may land these in phases, but they remain part of the end-state
goal and must not be forgotten outside the formal support table.

## Basic Design-Tool Baseline Semantics

The basic baseline is allowed to support the common design-tool cases before
every extreme topology is solved.

Baseline product semantics:

- stroke geometry is resolved against the authored topology's legal visible
  domain
- `inside` means the visible stroke region remains inside that legal domain
- `outside` means the visible stroke region is outside that legal domain
- `center` straddles the boundary
- compound holes invert the side relation relative to the filled legal domain
- paint is applied only after the stroke geometry is resolved
- `dashPattern` / `dashOffset` are interval geometry over the supported
  topology, not paint or shader repair. Legacy `dash` / `gap` fields are not
  canonical inputs and must not be used by runtime geometry.

Baseline support may include:

- simple closed single-contour paths
- compound closed paths with explicit legal-region / winding-rule metadata only
  after product packets consume the multi-contour legal domain directly
- simple open paths without self-intersection
- miter, bevel, and round joins
- none, round, and square caps
- solid strokes on supported topology
- dashed strokes only after interval-local one-sided geometry is implemented
  and tested for that topology

Baseline support must keep explicitly gated unless listed as supported in the
active support contract:

- multi-network overlap ownership beyond the supported simple closed
  global-diagnostics slice
- nested ownership chains beyond containment-depth legal-region parity
- decorated caps
- any behavior whose support state is not explicit

High-curvature constrained dashed `inside/outside` families are supported as
backend-gated exact promotion paths. Self-intersecting constrained dashed
families are currently supported as authored-side visible local geometry only:
the engine must preserve dash visibility and must not convert the stroke to
center geometry, but it must not promote self-intersecting packets through exact
arrangement until the exact legal-domain clipping oracle no longer removes
valid internal dash regions. This state remains explicit through
`sourceTopology: "self-intersecting"` plus
`resolutionStatus: "local-side-approximation"` metadata.

## Support-State Vocabulary

Each topology family must be classified as one of:

- `supported`
- `research-gated`
- `blocked`
- `blocked-with-diagnostics`

Definitions:

- `supported`
  - exact intended semantics are implemented and tested
- `research-gated`
  - the family is in final target scope, but exact product semantics or
    geometry rules are not yet settled
- `blocked`
  - the family must not render as exact support and must not be implied by
    successful lower-level packets
- `blocked-with-diagnostics`
  - the family may remain visible through an explicitly documented non-exact
    blocked path; exact semantics are not yet claimed

## Topology Families

### Family 1. Simple Closed Single-Contour Paths

Examples:

- rectangle
- oval
- simple convex or non-convex polygon without self-intersection

End-state goal:

- full exact support

Current final-package expectation:

- `supported`

### Family 2. Compound Closed Paths With Holes Or Nested Contours

Examples:

- donut-like paths
- compound glyph-like outlines
- nested contour shapes with one legal fill domain and interior holes

End-state goal:

- exact support with declared legal-domain semantics
- exact `inside` / `outside` behavior defined against legal domains rather than
  against contour orientation alone

Required product-semantic precondition:

- the engine must declare the legal-domain basis:
  - fill-rule source
  - shell/hole assignment rule
  - contour-to-domain mapping rule

Reference-backed direction:

- use Figma-like `VectorRegion` records when available
- preserve region loops and `NONZERO` / `EVENODD` winding rules as typed
  metadata
- do not infer shell/hole ownership from contour order alone when explicit
  region data exists
- Figma MCP capture for a donut-like even-odd path shows inside stroke behavior
  follows legal filled regions: outer shell centerline moves inward, while hole
  boundary centerline expands around the hole to keep stroke inside the filled
  region

Current final-package expectation:

- legal-domain topology classification is `supported now` when explicit
  contours can be assigned stable shell/hole roles
- constrained solid and constrained dashed product stroke support is
  `supported now` for containment-only vector slices, including nested
  depth-parity chains
- for that slice, even-depth shell contours use the authored `inside/outside`
  side and odd-depth hole contours invert the selected side so geometry is
  resolved against the legal filled region rather than raw contour interior
- render, hit-test, and export packets must carry the same shared compound
  `legalDomainId`
- intersecting contours, overlapping hole contours, shared edges, and
  non-containment nested ownership chains remain `research-gated`
- 2026-04-29 Figma SVG exports for overlapping compound holes show the legal
  domain is normalized first: two overlapping raw hole contours become one
  merged inner hole before inside dashed appearance is emitted. Exact support
  for this family therefore requires legal-domain boolean normalization before
  dash interval emission.
- otherwise `research-gated`

### Family 3. Open Paths

Examples:

- line
- polyline
- cubic path with open endpoints

End-state goal:

- exact `center`
- exact `inside`
- exact `outside`

Current final-package expectation:

- exact `center` may be `supported`
- open-path authored `inside` / `outside` resolves to the same geometry as
  `center`. Open paths have no inside/outside legal domain in the product vector
  renderer.
- open-path constrained solid/dashed runtime diagnostics are not applicable
  for product vector rendering.
- This intentionally follows Figma's line-default center behavior for the
  current open-path product slice, while closed-shape `inside` / `outside`
  remains Figma-like constrained geometry.

Fallback policy:

- substitute visibility must be explicit
- open-path center-equivalent geometry is not fallback recovery; it is the
  canonical product behavior for authored `inside` / `outside`
- open paths must not be mislabeled as constrained exact support when they emit
  center geometry
- Asyra dashed-open-path behavior intentionally diverges from Figma endpoint
  balancing: zero and non-zero `dashOffset` both use true arc-length pattern
  placement, and endpoints only clip the interval that reaches the boundary

### Family 4. High-Curvature Sampled Smooth Closed Paths

Examples:

- oval-like smooth loops
- sampled smooth cubic loops

End-state goal:

- exact support with stable interval and one-sided region semantics

Current final-package expectation:

- may be `supported` for supported exact slices when topology is proven stable
- otherwise `research-gated`
- 2026-04-29 Figma SVG exports for a high-curvature cubic loop show inside
  dashed appearance as legal-domain-clipped filled dash geometry. Candidate
  geometry may exist outside the legal domain before clipping, but product
  packets must not emit that pre-clipped geometry as final render / hit / export
  output.
- 2026-04-30 research closure defines high-curvature exact support as
  tolerance-bounded canonical geometry plus arrangement / face classification.
  Until that exact branch removes duplicate and illegal candidate faces,
  sampled-simple-closed constrained dashed interval-local packets are visibility
  support only and must be marked
  `resolutionStatus: "local-side-approximation"`.

### Family 5. Self-Overlapping But Non-Self-Intersecting One-Sided Candidates

Examples:

- high-width turns
- extreme curvature overlaps

End-state goal:

- exact support through face partition and ownership/legality resolution

Current final-package expectation:

- exact support only after arrangement-stage correctness is proven
- otherwise `research-gated`

### Family 6. Self-Intersecting Closed Paths

Examples:

- stars
- figure-eight loops
- loops with true segment intersection

End-state goal:

- exact support only with declared face semantics

Required product-semantic precondition:

- the engine must define which face model governs:
  - fill-rule interpretation
  - ownership across intersection-generated faces
  - interval visibility through intersecting regions

Reference-backed direction:

- do not offset raw self-intersecting closed paths
- split and arrange the source first
- classify source faces by explicit fill rule before building exact constrained
  stroke faces

Current final-package expectation:

- repeated constrained dashed non-full-loop intervals may emit direct
  interval-local one-sided packets for visibility
- full-loop constrained solid/dashed face ownership remains `research-gated`
  or `blocked`
- 2026-04-29 Figma outline exports confirm that inside and outside dashed
  self-intersecting outputs produce distinct filled-component structures
  (`inside` and `outside` must not share a center-derived exact component model)

Allowed temporary behavior:

- local one-sided interval visibility is allowed only when packet metadata
  keeps `sourceTopology: "self-intersecting"` so reviewers do not mistake it
  for completed face-arrangement support
- never claim full-loop exact constrained support before face semantics are
  settled

### Family 7. Multi-Network Paths

Examples:

- one vector object with multiple closed networks
- combinations of open and closed networks

End-state goal:

- exact support with typed ownership and legal-domain behavior

Current final-package expectation:

- disjoint closed networks may be supported when each network resolves to one
  typed owner and runtime diagnostics report one accepted entry per network
- overlapping simple closed constrained solid regions are supported for product
  visibility when all candidate packets carry typed owners and global ownership
  diagnostics are emitted
- overlapping simple closed constrained dashed regions are supported when each
  network resolves through interval-local one-sided geometry and runtime
  diagnostics report accepted entries per network
- source-bounds overlap is not a blocker by itself; it is only a signal to use
  global candidate / ownership diagnostics for constrained solid
- exact boolean-union export minimization for overlapping solid packets remains
  an optimization gate; it must not be used to hide product geometry
- a flattened-union SVG export does not prove independent multi-network owner
  preservation. The 2026-04-29 Figma outside dashed multi-network export
  contains one merged contour, so it can validate flattened visible output but
  not distinct source-network ownership semantics.

Decision rule:

- per-network dashed acceptance is valid only when typed `networkId` /
  `ownerKey` metadata remains intact and runtime diagnostics classify each
  network independently
- constrained solid overlap must enter the global ownership diagnostic path
  before render / hit / export packets are accepted
- if multiple networks claim the same final semantic face with identical stroke
  layer, stroke spec, and paint payload, the exact collapsed face must carry a
  typed `ownerSet` rather than losing owners or parsing them from IDs
- different stroke layers, different paint, or different object stacking
  preserve separate product regions instead of owner-collapse
- if a future fixture requires exact duplicate-face collapse, update the
  source-of-truth first, then add a boolean-union or face-emission phase

### Family 8. Nested Ownership Chains

Examples:

- multiple constrained strokes or interval owners overlapping the same region

End-state goal:

- exact deterministic ownership resolution

Current final-package expectation:

- containment-depth nested chains are supported for simple closed compound
  vectors
- even depths are shell-like and keep the authored constrained side
- odd depths are hole-like and invert `inside` / `outside` before one-sided
  geometry is emitted
- non-containment nested overlap, intersecting contours, and shared-edge chains
  remain `research-gated`

## Figma-Like Decision Rule

If Figma behavior is uncertain:

1. capture a reference fixture set
2. compare at the topology-family level, not only a screenshot level
3. prefer deterministic geometry-first semantics
4. if Figma is inconsistent, choose the version that is:
   - topology-preserving
   - ownership-explicit
   - cache-safe
   - reviewable
5. record the divergence in the decision log and tests

If Figma behavior is documented, it is the product reference unless it conflicts
with a stronger Asyra geometry-first invariant. The current fixed reference
decision is that a `miter` join beyond the configured miter threshold is emitted
as bevel geometry.

If no Figma reference exists:

1. research other established design-software or design-tool behavior first,
   prioritizing large or widely adopted authoring products
2. research other large-company graphics or runtime behavior only if design-tool
   references cannot answer the question
3. use mature algorithm references only after product and runtime behavior
   cannot answer the question
4. write the deterministic Asyra semantic rule in this package
5. add tests that prove the rule and expose the divergence status
6. keep the family `research-gated` until those steps are complete

No runtime helper, renderer, exporter, or hit-test path may invent behavior for
an undocumented topology family.

Product references decide what the user should see. Design-tool references
outrank general runtime references. Algorithm references decide how the engine
can compute that result. A geometry algorithm that is robust but
product-incompatible is not sufficient for Figma-like support.

## Canonical Length-Basis Rule

All supported dashed families must use one canonical dash-length basis:

- `arc-length-on-topology`

Meaning:

- authored dash pattern and offset are interpreted on the committed topology
  length basis
- parameter-space `t` values may assist evaluation, but they are not the
  semantic source of dash length
- preview tessellation may not change the committed interval allocation for the
  same exact topology revision

## Legal-Domain Rule

For closed paths:

- `inside` means geometry that remains within the declared legal fill domain
- `outside` means geometry that leaves that legal fill domain
- contour orientation is an input, not the whole decision
- compound-path support is not complete until shell/hole and legal-domain
  semantics are written explicitly

## Support-Claim Rule

A topology family may be marked `supported` only if all are true:

- geometry semantics are written explicitly
- exact-correct algorithm branch exists for the family
- ownership semantics are written explicitly
- legality behavior is written explicitly
- blocked behavior is either absent or clearly separated
- unit coverage exists for the algorithm contract
- visual coverage exists for the user-visible output
- performance constraints have been evaluated for the supported slice

## Forbidden Semantic Shortcuts

- no family may be treated as supported because a substitute geometry happened to look good
- no family may be treated as supported because a lower-level packet existed
- no family may be silently upgraded by adding a support flag in code only
- no family may remain semantically ambiguous after being marked supported
