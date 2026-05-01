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

## Defined Product Workstream Status

This section is the status checkpoint after the 2026-04-30 CTO-review closure.
It prevents the roadmap from being misread as seven independent product gaps.

There are four product-visible stroke behaviors whose semantics are defined well
enough to implement. Their implementation status is:

| Product behavior | Definition status | Product implementation status | Remaining implementation work |
| --- | --- | --- | --- |
| Self-intersecting closed `inside/outside` dashed exact stroke | `defined but exact-promotion gated` | `implemented as authored-side visible local geometry; exact promotion disabled` | Self-intersecting constrained dashed packets remain visible and side-aware with `resolutionStatus: "local-side-approximation"` even when an exact backend is selected. Exact promotion is disabled because the current backend legal clipping can remove valid internal dash regions after async backend load. Product runtime must prefer stable visible geometry over a wrong exact pass until the exact oracle is fixed. |
| High-curvature / offset self-overlap constrained stroke | `defined but exact-promotion gated` | `implemented as authored-side visible local geometry; exact promotion disabled for local-side sampled packets` | Accepted sampled-simple constrained dashed packets that report `resolutionStatus: "local-side-approximation"` must remain visible local-side packets even when an exact backend is selected. Product runtime must not replace those packets with arrangement faces until the exact path proves segment-local clipping parity and no fan-like overlap at high-curvature cross-segment joins. Local candidate construction emits one packet per dash interval, uses bounded segment-cell polygons when a merged ribbon would fan, and splits authored `sourcePath` intervals at segment boundaries. |
| Overlapping compound holes normalized-boundary dashed stroke | `fully defined` | `implemented for backend-normalized compound constrained dashed product path` | Uses normalized legal-domain boundary spans for dash placement when exact backend boolean normalization is available; raw overlapping hole contours no longer drive product dashed geometry. |
| Multi-network / duplicate-region ownership collapse | `fully defined` | `implemented for exact arranged constrained dashed product path` | Same-visual exact arrangement faces collapse into one ownerSet-preserving packet; different visual packet keys remain separate; render / hit-test / export read the same projected metadata. |

The following three items are not additional product behaviors. They are shared
infrastructure and hardening tracks that keep the four product behaviors above
stable as the exact engine expands:

| Shared infrastructure | Why it is required | Current status |
| --- | --- | --- |
| Holed / multi-contour arrangement face classification | Required so complex arrangement faces can classify legal-domain ownership without relying on backend permissive flags. Backend-normalized compound-hole dashed product geometry emits from normalized legal-domain boundary spans directly, but promoted arrangement paths still need correct face classification. | Conservative classifier exists for simple, concave, holed, and mixed multi-contour arrangement faces. Mixed legal states are split before inside/outside filtering; hole samples are ignored when choosing the representative filled sample. |
| Direct `FinalFace[]` projection for promoted exact families | Required so render, hit-test, and export consume one canonical face source instead of restroking or round-tripping through compatibility packets. | Implemented for vector product runtime: non-exact packets are converted once into `FinalFace[]`, promoted exact arrangement faces are appended directly, and render / hit-test / export all project from the combined face source. Compatibility packets remain available for non-vector and legacy consumers. |
| Exact geometry cache / dirty graph hardening | Required so backend arrangement and future self-intersection / high-curvature exact promotion can meet interaction performance targets. | Backend and projection caches exist; full stage-level invalidation for the remaining exact promotions remains incomplete. |

When asked "what clearly defined product work remains?", do not list
overlapping compound holes or multi-network collapse as missing implementation
work unless a regression is found. Self-intersecting exact promotion and
sampled-simple high-curvature exact promotion remain explicitly gated because
the current exact clipping path can remove or replace valid visible dash
regions. The remaining defined work after these updates is quality hardening:
broader reference parity, performance budgets, and removal of remaining
non-vector compatibility bridges where exact `FinalFace[]` can be consumed
directly.
Describe shared infrastructure items only as supporting cleanup or hardening,
not as additional product semantics.

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
| Compound closed legal-domain normalization | `supported now` for containment-only topology metadata; `backend-gated supported` for overlapping holes | The normalization helper emits a shared legal-domain object for containment-only paths using full-contour containment, not orientation-only or probe-point inference. Overlapping holes require exact backend boolean normalization; with a selected backend that supports `union` and `difference`, vector product runtime promotes them to one shared normalized legal-domain context. |
| Compound closed constrained solid product stroke geometry with explicit containment legal-domain metadata | `supported now` for containment-only simple closed vector networks, including nested depth-parity chains | Solid `inside/outside` inverts the selected side for odd-depth hole contours, emits one shared compound `legalDomainId`, and preserves render / hit-test / export parity. Intersecting contours, overlapping holes, and shared edges remain gated. |
| Compound closed constrained dashed product stroke geometry with explicit legal-domain metadata | `supported now` for full-loop and supported interval-local containment-only simple closed vector networks; `backend-gated supported` for overlapping-hole normalized-boundary dash placement | Containment-only dash intervals are allocated per contour; odd-depth hole contours invert the selected side before one-sided geometry is emitted. With exact backend boolean normalization, overlapping holes use normalized legal-domain boundary spans for product dash placement and preserve source contour/span metadata. Shared-edge cases remain gated. |
| Compound closed without explicit legal-region metadata | `research-gated` unless explicitly supported | Requires declared shell/hole decomposition |
| Open path stroke position | `supported now` as center-equivalent product semantics | Open paths have no inside/outside legal domain, so authored `inside` / `outside` alignment is ignored for geometry. Render, hit-test, and export must emit the same center stroke geometry as `position: center`. This is canonical behavior, not a fallback. |
| Open path dashed endpoint placement | `supported now` for true arc-length pattern placement | Zero and non-zero `dashOffset` both use the deterministic repeated arc-length dash pattern. Asyra intentionally does not rebalance endpoints into Figma-like half-length dashes; endpoints only clip the authored interval that reaches the path boundary. |
| Open path constrained diagnostics | `not applicable` | Open paths must not enter constrained solid/dashed runtime diagnostics solely because the authored stroke position is `inside` or `outside`. The stored UI value may remain unchanged, but resolved geometry is center. |
| Closed constrained dashed full-loop | `supported now` for selected-side full-loop slices, including sharp sampled round-join loops | Reuses one-sided constrained solid geometry for the full loop. Sharp sampled round joins stay visible and are not blocked merely because the exact reference behavior is imperfect. |
| Closed constrained dashed non-full-loop | `supported now` for rectangle-equivalent, broader-simple-closed, sampled-simple-closed, seam-wrapping, and visible local-side approximation slices | Supported slices build interval-local one-sided geometry. Each visible interval emits one packet; that packet may contain multiple bounded segment-cell polygons when a merged ribbon would self-intersect or fan. Self-intersecting and sampled-simple constrained dashed sources preserve `inside/outside` and emit explicitly marked `resolutionStatus: "local-side-approximation"` packets when the current geometry is local-side. A selected backend must not replace those packets with exact arrangement faces unless the exact path proves segment-local clipping parity. Center fallback is forbidden. Seam-wrapping intervals are sliced across the seam instead of being dropped. |
| Constrained solid/dashed ownership and network classification | `supported now` for typed packet metadata | Owner and network grouping must read packet metadata, not `geometryId` string structure |
| Multiple constrained dashed stroke layers on one source | `supported now` for typed-owner accepted runtime status | Multiple visible constrained dashed packets are accepted when every packet carries typed owner metadata. The runtime reason is `typed-owners`; a multi-layer stroke must not be blocked merely because more than one `strokeId` exists. |
| Disjoint multi-network constrained dashed ownership | `supported now` for per-network accepted runtime status | Each network is classified independently through typed `networkId` / `ownerKey`; one accepted network must not be blocked by another accepted network |
| High-curvature smooth closed paths | `supported now` for non-self-intersecting sampled-simple-closed full-loop and visible interval-local dashed slices; exact promotion gated | Basic visibility uses selected-side interval geometry so inside/outside does not disappear. Interval-local sampled constrained dashed packets remain `local-side-approximation` while the exact arrangement path lacks an oracle that preserves segment-local clipping at high-curvature cross-segment joins. High-curvature intervals that would create a self-intersecting one-sided ribbon are subdivided into bounded continuous sub-ribbons so product polygons stay simple and remain on the authored sampled segment path. Cells inside one dash interval share sampled offset-boundary vertices so curved dashes connect instead of stacking independent normal strips; only non-simple cells may degrade to a segment-local offset face. When authored `sourcePath` segment metadata is available, dash intervals are split at authored segment boundaries first and cells touching those boundaries are clipped against adjacent authored segment tail/head polylines, so cross-segment high-curvature turns do not emit fan-like overlap ribbons or exceed the selected side boundary. 2026-04-29 Figma SVG exports show high-curvature inside dashed appearance is legal-domain-clipped filled geometry; broader Figma/reference parity for extreme curvature remains a hardening task. |
| Self-overlap requiring arrangement | `gated` for sampled-simple local-side constrained dashed promotion | Visual plausibility is not enough. Accepted sampled-simple constrained dashed packets remain local-side when their metadata reports `resolutionStatus: "local-side-approximation"`. Exact arrangement promotion can return only after real-backend fixtures prove partitioned overlap claims, side-specific product signatures, and no fan-like replacement of authored segment-local dash geometry. |
| Self-intersecting closed paths | `supported now` for constrained solid local-side candidate visibility and constrained dashed local-side approximation visibility; exact promotion gated | Solid and dashed constrained packets preserve the authored `inside/outside` side so supported strokes do not disappear. 2026-04-29 Figma outline exports confirm inside and outside dashed self-intersections produce different filled-component structures, so exact support classifies each side separately. Exact promotion is disabled for current local-side packets until legal-domain clipping preserves valid internal dash regions and does not remove visible authored-side geometry after backend load. |
| Multi-network overlap ownership | `supported now` for simple closed constrained solid/dashed overlap visibility with typed global ownership diagnostics | Boundary-touching or overlapping source bounds enter candidate construction instead of bounds-level blocking. Constrained solid emits global ownership diagnostics; constrained dashed runtime diagnostics expose candidate arrangement metadata. The 2026-04-29 outside dashed multi-network SVG export is a flattened-union appearance oracle, not proof that Figma preserves independent owner networks through SVG. Exact boolean-union export minimization remains a future optimization, not a visibility blocker. |
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
