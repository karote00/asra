# Stroke Engine Final Analysis Report

## Role

This report is the initial risk baseline for the final stroke-engine spec
package in `docs/ai/apps/asyra-design/plans/stroke-engine-final/`.

It captures:

- the baseline architecture strengths
- the baseline algorithmic gaps
- the runtime and performance risks
- the documentation-governance issues
- the recommended correction path

This report is an assessment document, not the implementation plan itself.
Current implementation authority lives in the final spec package, especially
`source-of-truth.md`, `active-support-scope.md`, `geometry-pipeline.md`, and
`function-contracts.md`.

## Executive Summary

At the time of the final-package reset, the stroke-engine direction was
substantially stronger than the earlier
incident-driven dashed-stroke work. The repo now has a recognizable geometry
pipeline, shared packet-based render/hit/export routing, scenario-coverage
thinking, and a cleaner separation between geometry and paint.

However, that baseline system was still a bounded rollout engine, not yet a final
professional engine on the level required for an open-source, Figma-like design
tool foundation.

The most important conclusion is this:

- the baseline engine was directionally correct
- the baseline constrained-stroke algorithm was not structurally final
- the most serious risks identified by this report were:
  - one-sided constrained geometry could remain coupled to doubled-width
    center-style construction unless explicitly replaced
  - ownership classification could depend on string-parsed ids unless packet
    metadata became typed
  - topology classification could stay too heuristic for final product
    semantics unless support states became explicit
  - the runtime cost model could stay too expensive for animation-heavy editing
    paths unless dirty keys and shared topology caches became mandatory
  - the stroke documentation set could drift into multiple active-looking
    authorities unless legacy plans were deleted

The final spec package therefore needs to reset the stroke documents around a
single geometry-first contract, a typed packet model, and a hard 120fps/60fps
performance discipline.

## Baseline Strengths Identified

### 1. Geometry-first direction was already visible

The baseline engine already routed render, hit-testing, and export through
resolved packet families rather than allowing each consumer to improvise its own
geometry.

This is the correct direction for a professional engine because:

- it reduces semantic drift between output systems
- it makes testing possible at the packet level
- it creates a stable place to attach paint, diagnostics, caching, and export
  metadata

### 2. Scenario-matrix testing is a real improvement

The baseline stroke work no longer depended only on screenshot-by-screenshot
repairs. The use of historical scenario coverage tables, family-based support expansion, and helper-level
unit tests is the correct testing philosophy for a geometry engine that must be
reused and extended by other contributors.

### 3. Geometry and paint are mostly separated already

The baseline runtime already trended toward:

- geometry packet creation first
- paint payload attachment second
- rendering third

This must remain a hard invariant in the final package and be generalized to
fill, stroke, and shadow consistently.

## Baseline Architectural Gaps

### 1. Inside/outside geometry is not yet structurally final

The most important structural issue identified at reset time was the
constrained-dashed path risk of relying on widened center-style interval
geometry in supported slices.

Problem pattern:

- construct a doubled-width center packet
- clip it against legality or ownership
- interpret the surviving portion as `inside` or `outside`

Why this is insufficient:

- it is not the true one-sided geometry model
- it can over-generate candidate area near sharp turns
- it can generate false coverage under high curvature
- it can generate misleading ownership/legality input around overlap-heavy or
  self-intersecting topologies
- it hides the distinction between "the geometry that exists" and "the geometry
  produced by clipping away the wrong half"

Correct final direction:

- `inside` and `outside` must build one-sided geometry directly
- segment, join, and cap faces must be created for the chosen side only
- legality and ownership must operate on candidate one-sided faces, not on a
  fictitious doubled-width band

### 2. Ownership risk around geometry-id string parsing

The reset-time audit identified a fragile contract risk: constrained-dashed
ownership must not derive owner identity from the `geometryId` string.

Why it is risky:

- renaming cache keys can silently break ownership
- packet identity becomes overloaded with semantics it should not carry
- ownership becomes harder to validate independently from render naming
- open-source contributors may change ids without understanding the hidden
  contract

Correct final direction:

- ownership metadata must be typed
- `ownerKey`, `strokeId`, `networkId`, `intervalId`, and `sourceTopology`
  belong in packet metadata
- no helper may infer ownership by parsing a display or cache string

### 3. Source topology classification is too coarse

The baseline constrained-dashed classifier collapsed large classes of geometry
into a very small set of categories. That was acceptable for bounded rollout
support expansion, but it is too weak for final product semantics.

Why it is risky:

- smooth sampled loops and sharp sampled loops can be too loosely grouped
- true vector families can be misclassified as sampled proxies
- support expansion and substitute path behavior can become shape-dependent rather than
  topology-dependent
- future animation and open-source extensions will increase the number of path
  families rapidly

Correct final direction:

- topology classification must be derived from an explicit path-topology model
- shape origin and path topology must be separate axes
- support/substitute path decisions must attach to topology families rather than to
  path-source shortcuts

### 4. Render-path work was too repetitive

The baseline vector render path derived path geometry several times inside one
render pass for the same network in order to feed different packet families.

Why it is risky:

- repeated flattening and path-model derivation wastes CPU time
- animation-heavy edits will multiply the cost immediately
- packet-family reuse becomes weaker than it should be
- the engine cannot plausibly claim 120fps interactive behavior without a
  stronger shared dirty-graph strategy

Correct final direction:

- each network revision must produce one canonical `PathTopologyModel`
- center, constrained, dashed, hit, export, and diagnostics must consume the
  same topology object
- downstream stages must be able to reuse interval allocation and topology
  classification results

### 5. Geometry cache scope was too narrow

The baseline renderer cached projection/container objects, but too much CPU
work could still happen before the cache helped.

Why it is risky:

- polygon normalization and signatures can be rebuilt too often
- geometry-model reconstruction could still happen on render-path updates
- packet-level changes cannot be minimized precisely enough for animation

Correct final direction:

- cache keys must exist at topology, interval, ownership, legality, region, and
  paint boundaries
- the renderer should receive stable normalized geometry models whenever
  possible
- cache invalidation must be driven by explicit dirty keys instead of
  re-deriving everything per pass

## Product-Semantics Risks

### 1. Open path exact inside/outside semantics are not yet settled

The baseline system previously used explicit center-derived substitute geometry in some constrained
cases. That substitute path must not be treated as final constrained semantics because
it hides unsupported one-sided geometry behind visible center geometry.

The final package must:

- keep open-path exact semantics in scope
- describe unresolved behavior explicitly
- require a research gate until exact one-sided open geometry is formalized

### 2. Self-intersection semantics need a declared face model

Self-intersecting paths cannot be treated as a minor extension of simple-path
logic.

The final package must:

- define self-intersection as a topology family, not an accident
- require planar arrangement / face classification before exact support
- separate preview-safe substitute path from exact support

### 3. Multi-network ownership requires typed region semantics

Multi-network constrained stroke behavior is fundamentally an ownership problem,
not just a packet-routing problem.

The final package must:

- define how ownership behaves across networks
- distinguish unsupported exact behavior from preview visibility substitute paths
- forbid accidental support through packet coalescing

## Documentation Governance Problems

### 1. Too many active-looking stroke authorities

At reset time, the repo contained:

- architecture documents
- execution documents
- historical scenario coverage tables
- ledgers
- manual QA
- failure triage
- legacy-looking status documents

Several of these are useful, but together they create review ambiguity.

### 2. "Deprecated" and "still searchable" were in tension

Some legacy stroke documents remained visible in search results even though
newer docs said they were no longer active authority.

Why it matters:

- new contributors can pick the wrong entrypoint
- AI reviewers can ground themselves in stale assumptions
- plan drift becomes more likely over time

Correct final direction:

- a single final source-of-truth folder
- a routing document that names the only active files
- deletion of earlier plan-generation files outside the final package
- historical rationale preserved only in decision history or this report
- an explicit migration and legacy-deletion document

## Recommended Correction Path

### 1. Replace the prior active authority with one final spec package

Create a new source-of-truth folder dedicated to the final stroke-engine
package. Delete older stroke planning documents outside the final package so
they cannot become shadow authorities. Preserve only relevant historical
rationale in app decision history or this report.

### 2. Re-center the engine on one-sided constrained geometry

Treat the one-sided geometry model as the primary geometry contract for
`inside`/`outside`, especially for dashed intervals. The final docs must make it
impossible for doubled-width clipping to remain the product path.

### 3. Promote typed packet metadata everywhere

The final package must treat typed metadata as mandatory for:

- owner identity
- network identity
- source topology
- interval topology
- legality status
- substitute path status

### 4. Make performance a contract, not a wish

The final docs must include:

- per-stage complexity expectations
- dirty invalidation rules
- cache dependency contracts
- preview-vs-exact behavior rules
- animation-specific stability rules

### 5. Require self-review loops in the docs themselves

This work is complex enough that the docs must define how to audit themselves.
Every later change should be forced back through:

- cross-doc consistency review
- stage contract review
- support/substitute path review
- performance-budget review

## Bottom Line

The reset-time stroke engine was a strong intermediate foundation, but it was
not yet the final reusable open-source foundation for a professional design
tool.

The final package should therefore do three things at once:

1. preserve the good geometry-first direction
2. close the structural gaps around one-sided geometry, ownership typing, and
   performance discipline
3. replace the prior multi-file ambiguity with one authoritative final spec
   package

That is the purpose of the new `stroke-engine-final/` document set.
