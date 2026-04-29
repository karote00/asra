# Active Support Scope And Roadmap Boundary

## Role

This file separates:

- end-state stroke-engine ambition
- current active support contract
- migration roadmap

Its purpose is to keep the final package honest about what is already
contract-ready versus what is still a rollout path.

## Authority Rule

For current behavior claims:

- this file outranks `phase-execution-plan.md`

For migration sequencing:

- `phase-execution-plan.md` remains authoritative

The phase plan may not be used to infer current support if this file says a
family is still gated.

## Three Scope Layers

### 1. End-State Goal

This is the long-term Figma-like target for the stroke engine.

It includes:

- exact one-sided constrained support
- compound closed legal-domain correctness
- stable dashed interval semantics
- overlap-safe ownership and legality
- animation-safe performance behavior
- render/hit/export semantic parity

### 2. Basic Design-Tool Baseline

This is the first practical implementation slice supported by the current
Figma MCP capture and reference research.

It is intentionally smaller than the end-state goal, but it is large enough for
a useful basic design tool.

The basic baseline may eventually claim support only for:

- simple closed single-contour paths
- compound closed paths when explicit legal-region / winding-rule metadata is
  available and product render / hit-test / export packets consume that
  multi-contour legal domain directly
- simple open paths without self-intersection
- solid strokes
- dashed strokes only where interval-local one-sided geometry is implemented
  and tested
- `center`, `inside`, and `outside` alignment
- miter, bevel, and round joins
- none, round, and square caps
- render / hit-test / export parity for all supported packets

The basic baseline must keep these out of exact support:

- self-intersecting source paths
- multi-network overlap ownership beyond the supported simple closed
  global-diagnostics slice
- nested ownership chains beyond containment-depth legal-region parity
- high-curvature self-overlap that requires unimplemented arrangement
  correctness
- decorated caps such as arrows, diamonds, circles, or triangles
- any family without tests, support status, and explicit blocked behavior

### 3. Active Support Contract

This is the current maximum behavior that may be claimed as supported in code,
docs, tests, and review.

A family belongs here only if all are true:

- semantics are written explicitly
- exact-correct algorithm branch is written in `exact-correct-path-algorithm.md`
- helper contracts are aligned
- tests exist
- performance cost has been evaluated for the supported slice
- blocked behavior is clearly separated

### 4. Migration Roadmap

This is the implementation journey from the current runtime to the end-state
goal.

It may describe:

- upcoming phase work
- guarded supports
- blocked families
- recovery steps

It may not redefine the active support contract silently.

## Current Package Position

The current package should be read as:

- end-state architecture: broad and forward-compatible
- active support contract: intentionally narrower
- phase plan: migration-focused, not proof of current support

## Active Support Table Rule

Every topology family and semantic family must be readable through these
statuses:

- `supported now`
- `research-gated`
- `blocked`

No document may rely on narrative wording alone where this status should be
explicit.

## Current Active Support Snapshot

This table is the current package-level support contract.

| Family | Status | Notes |
| --- | --- | --- |
| Simple closed single-contour exact support | `supported now` | Primary exact-family baseline |
| Compound closed legal-domain classification | `supported now` for topology metadata only | The containment-depth helper and regression fixture classify shell/hole roles without orientation-only inference. This is not product stroke rendering support. |
| Compound closed constrained solid product stroke geometry with explicit containment legal-domain metadata | `supported now` for containment-only simple closed vector networks, including nested depth-parity chains | Solid `inside/outside` inverts the selected side for odd-depth hole contours, emits one shared compound `legalDomainId`, and preserves render / hit-test / export parity. Intersecting contours and shared edges remain gated. |
| Compound closed constrained dashed product stroke geometry with explicit containment legal-domain metadata | `supported now` for full-loop and supported interval-local containment-only simple closed vector networks | Dash intervals are allocated per contour; odd-depth hole contours invert the selected side before one-sided geometry is emitted. Intersecting contours, shared edges, and seam-heavy compound arrangement remain gated. |
| Compound closed without explicit legal-region metadata | `research-gated` unless explicitly supported | Requires declared shell/hole decomposition |
| Open path stroke position | `supported now` as center-equivalent product semantics | Open paths have no inside/outside legal domain, so authored `inside` / `outside` alignment is ignored for geometry. Render, hit-test, and export must emit the same center stroke geometry as `position: center`. This is canonical behavior, not a fallback. |
| Open path constrained diagnostics | `not applicable` | Open paths must not enter constrained solid/dashed runtime diagnostics solely because the authored stroke position is `inside` or `outside`. The stored UI value may remain unchanged, but resolved geometry is center. |
| Closed constrained dashed full-loop | `supported now` for selected-side full-loop slices, including sharp sampled round-join loops | Reuses one-sided constrained solid geometry for the full loop. Sharp sampled round joins stay visible and are not blocked merely because the exact reference behavior is imperfect. |
| Closed constrained dashed non-full-loop | `supported now` for rectangle-equivalent, broader-simple-closed, sampled-simple-closed, seam-wrapping, and self-intersecting local-side approximation slices with tests | Supported exact slices build interval-local one-sided geometry. Self-intersecting constrained dashed sources preserve `inside/outside` and emit local-side approximation packets marked `resolutionStatus: "local-side-approximation"` until face arrangement, legal-domain classification, and duplicate-region collapse are implemented. Center fallback is forbidden. Seam-wrapping intervals are sliced across the seam instead of being dropped. |
| Constrained solid/dashed ownership and network classification | `supported now` for typed packet metadata | Owner and network grouping must read packet metadata, not `geometryId` string structure |
| Multiple constrained dashed stroke layers on one source | `supported now` for typed-owner accepted runtime status | Multiple visible constrained dashed packets are accepted when every packet carries typed owner metadata. The runtime reason is `typed-owners`; a multi-layer stroke must not be blocked merely because more than one `strokeId` exists. |
| Disjoint multi-network constrained dashed ownership | `supported now` for per-network accepted runtime status | Each network is classified independently through typed `networkId` / `ownerKey`; one accepted network must not be blocked by another accepted network |
| High-curvature smooth closed paths | `supported now` for non-self-intersecting sampled-simple-closed full-loop and visible interval-local dashed slices; broader exact arrangement remains `research-gated` | Basic visibility uses selected-side interval geometry so inside/outside does not disappear. Self-overlap and overlap ownership still require exact arrangement before full Figma-like support is claimed. |
| Self-overlap requiring arrangement | `research-gated` until arrangement correctness is approved | Visual plausibility is not enough |
| Self-intersecting closed paths | `supported now` for constrained solid local-side candidate visibility and constrained dashed local-side approximation visibility; exact arrangement remains `research-gated` | Solid and dashed constrained packets preserve the authored `inside/outside` side so supported strokes do not disappear. Dashed self-intersection packets are explicitly marked `resolutionStatus: "local-side-approximation"` and must not be described as exact Figma-like face arrangement. Face ownership, duplicate-face collapse, and overlap removal require arrangement before exact support is claimed. |
| Multi-network overlap ownership | `supported now` for simple closed constrained solid/dashed overlap visibility with typed global ownership diagnostics | Boundary-touching or overlapping source bounds enter candidate construction instead of bounds-level blocking. Constrained solid emits global ownership diagnostics; constrained dashed runtime diagnostics expose candidate arrangement metadata. Exact boolean-union export minimization remains a future optimization, not a visibility blocker. |
| Nested ownership chains | `supported now` for containment-depth parity compound chains | Depth is classified by containment; even depth is shell-like, odd depth is hole-like and inverts constrained side. Non-containment overlap chains remain gated. |

## Current Honesty Rule

The package must not imply that "final" means "full final behavior is already
supported."

In this package, "final" means:

- final architecture direction
- final source-of-truth authority
- final contract location

It does not automatically mean:

- final support breadth
- final rollout completion

## Required Reading Policy

When someone asks "what is supported now?":

1. read this file
2. read `topology-and-product-semantics.md`
3. read `testing-and-benchmark-spec.md`

When someone asks "how do we get there?":

1. read this file
2. read `phase-execution-plan.md`

## Support Claim Rule

The engine may claim Figma-like support for a family only if:

- the family is `supported now` here
- the exact-correct algorithm branch exists
- the topology semantics doc agrees
- the helper contracts agree
- the tests assert exact behavior rather than substitute visibility

## Roadmap Boundary Rule

The phase plan may describe:

- support goals
- not-yet-implemented exact families
- research-gated investigation

But these do not become active support merely by appearing in a later phase.

## Documentation Hygiene Rule

If a future change emits or demotes a family:

- update this file first
- update `topology-and-product-semantics.md` second
- update tests third
- update `phase-execution-plan.md` only if migration sequencing changes

## Success Criteria

This boundary is only considered correct when:

- a new contributor can tell current support without reading the phase plan
- a reviewer can distinguish roadmap ambition from current guarantee
- a runtime slice cannot be mislabeled as supported by citing future phases
