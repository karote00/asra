# Exact-Correct Path Algorithm Contract

## Role

This file defines the algorithmic contract for exact-correct stroke geometry.

It exists because high curvature, acute turns, miter behavior, self-overlap, and
self-intersection must not be solved by repeated implementation guesses.

## Feasibility Position

The final engine should treat exact-correct stroke output as feasible under this
definition:

- exact relative to the engine's canonical geometry model
- deterministic for the same authored input and stroke spec
- bounded by an explicit geometry tolerance
- validated by face-level geometry oracles, not by screenshots alone

The final engine should not require analytic exact offsets of arbitrary Bezier
curves as the product baseline. That path is unnecessarily complex for an
interactive design tool and will make performance and robustness harder to
control.

The recommended feasible baseline is:

1. convert authored curves into a canonical tolerance-bounded geometry model
2. build one-sided offset candidates from that canonical model
3. partition all overlaps through planar arrangement
4. classify faces by legal domain, owner, interval, and support state
5. emit semantic regions only after classification

## Reference-Backed Decisions

The following decisions are not open-ended:

- miter joins that exceed the miter limit fall back to bevel geometry
- Figma's public stroke documentation describes miter angle behavior as beveling
  at or below the configured miter angle
- Figma's plugin API describes `MITER` joins as cutting the point off to
  `BEVEL` when the angle is below the miter angle
- SVG/CSS/Canvas stroke behavior also converts miter joins to bevel joins when
  the miter limit is exceeded

The engine may use Figma as the product reference for user-visible behavior, but
it does not have to copy Figma's internal implementation strategy when a more
robust geometry-first method produces the same visible contract.

Reference priority for unresolved behavior:

1. match official Figma documentation when it exists
2. match captured Figma-visible behavior when official docs are missing or
   incomplete
3. use other design-software or design-tool references when Figma cannot answer
   the question, prioritizing large or widely adopted authoring tools such as
   Adobe Illustrator, Adobe After Effects, Framer, Sketch, Lottie/Bodymovin
   behavior, and similar design tools
4. use other large-company graphics or runtime references only when design-tool
   references are missing, incomplete, or contradictory, including Apple/Core
   Graphics, Skia, Flutter, Android, SVG, Canvas, and browser behavior
5. use mature algorithm or library references for construction mechanics when
   product sources do not define the detail, including Bezier.js, Paper.js,
   Clipper, CGAL, robust planar arrangement, straight skeleton, and polygon
   offsetting literature
6. define an Asyra deterministic rule only after recording the reference gap,
   decision rationale, tests, and any divergence from Figma, design-tool
   references, or large-company runtime references

No exact family may be implemented from intuition. If this file cannot describe
the candidate construction, arrangement trigger, face classification, and
support tests, the family stays gated.

Product references define intended behavior. Design-tool references outrank
general runtime references. Algorithm references define how to construct that
behavior robustly. If they conflict, product-visible behavior wins unless it
would violate a hard Asyra invariant such as typed ownership, geometry-first
paint, render/hit/export parity, or deterministic cache safety.

External references used by this contract:

- Research summary:
  `reference-research-findings.md`
- Figma Developer Docs, `StrokeJoin`:
  `https://developers.figma.com/docs/plugins/api/StrokeJoin/`
- Figma Help Center, stroke properties and miter angle:
  `https://help.figma.com/hc/en-us/articles/360049283914-Apply-and-adjust-stroke-properties`
- SVG `stroke-miterlimit` reference:
  `https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-miterlimit`
- WHATWG HTML Canvas line join and miter limit behavior:
  `https://html.spec.whatwg.org/multipage/canvas.html`
- Lottie shape stroke properties:
  `https://lottie-animation-community.github.io/docs/specs/layers/shapes/`
- Flutter `Paint.strokeMiterLimit` and `StrokeJoin`:
  `https://api.flutter.dev/flutter/dart-ui/Paint/strokeMiterLimit.html`
- Skia `SkPaint::setStrokeMiter`:
  `https://api.skia.org/classSkPaint.html`
- Paper.js `Path` stroke properties:
  `https://paperjs.org/reference/path/`
- Bezier.js curve outline and offset utilities:
  `https://pomax.github.io/bezierjs/`
- CGAL straight skeleton and polygon offsetting:
  `https://doc.cgal.org/latest/Straight_skeleton_2/index.html`

## Canonical Geometry Domain

Exact-correct behavior is defined against:

- canonical arc-length topology
- canonical sampled/flattened curve representation
- declared numeric tolerance
- declared legal-domain fill rule

Required tolerance metadata:

- source flattening tolerance
- offset approximation tolerance
- join arc approximation tolerance
- snap tolerance for arrangement
- zero-area face rejection threshold

If any tolerance is omitted, the family must not be marked as exact support.

Canonical tolerance policy:

- exact curve flattening target: `0.25 px`
- preview curve flattening ceiling: `min(1.0 px, strokeWidth / 4)`
- arrangement / snap epsilon: `1e-6` model units
- zero-area face threshold:
  `max(1e-8, flattenTolerance * flattenTolerance * 0.25)`
- preview mode may reduce density only when topology family, support state,
  ownership state, and interval allocation remain unchanged

## Core Algorithm

### 1. Normalize and classify the path

Inputs:

- authored path
- stroke spec
- preview/exact mode

Outputs:

- `PathTopologyModel`
- topology family
- support state

Required decisions:

- open vs closed
- single contour vs compound
- simple vs self-intersecting
- legal-domain fill rule
- canonical length basis

### 2. Allocate dash intervals before geometry

Dashed strokes must allocate intervals on `arc-length-on-topology`.

The dash schedule is not allowed to depend on later offset geometry.

Open and closed dashed paths use deterministic repeated arc-length pattern
placement from the canonical topology length basis. Asyra intentionally does
not implement Figma's segment-local endpoint balancing or half-dash endpoint
placement. `dashOffset` is a phase shift into the authored pattern, and
endpoints only clip whatever authored interval reaches the path boundary.

Odd dash-pattern normalization is not globally closed by this file because
Figma, SVG, and Lottie references do not all describe the same normalization
behavior. The engine must use Figma capture first; otherwise SVG/Canvas are the
default web-standard reference unless product scope chooses Lottie compatibility
and records the divergence.

### 3. Build one-sided offset candidates

For each visible interval:

- derive local tangent and normal frames
- choose the side required by `center | inside | outside`
- build segment-body candidates
- build join candidates
- build cap candidates where applicable
- merge construction strips for that interval into one candidate region before
  product projection. Sampling strips are implementation detail only; they must
  not be emitted as separate visible polygons because that creates internal
  seams and alpha stacking.

No opposite-side geometry may be created for exact constrained support.

### 4. Partition all overlaps

If candidates overlap, touch, cross, or self-intersect:

- normalize each candidate region with boolean `union`
- run planar arrangement
- split candidates into explicit face regions
- preserve source edge, interval, contour, and owner lineage

This is the point where multilayer drawing is prevented.

The renderer must never receive raw overlapping candidate faces as product
geometry.

### 5. Classify faces

For each partitioned face, compute:

- legal-domain membership
- owner identity
- interval identity
- chosen-side validity
- support or blocked status

Representative-point classification is allowed only if the arrangement policy
guarantees the face is topologically uniform for the tested predicate.

### 6. Emit semantic regions

Only faces that pass ownership and legality become semantic regions.

If two or more overlapping candidates represent the same legal visible stroke
region, they must collapse to one semantic region rather than draw as stacked
layers. This is a general visual-coverage rule, not a high-curvature special
case: for any point covered by `N` same-visual faces, final product coverage at
that point must be exactly `1`, never `N` and never `0`.
Runtime implementation rule:

- construct the single `FinalFace[]` source first
- group only by identical `visualPacketKey`
- skip groups whose bounds do not overlap
- backend-union overlapping same-visual groups into one product face
- treat same-visual inputs as coverage before union; normalize input winding so
  opposite-oriented equivalent coverage cannot cancel into a hole or empty face
- preserve `ownerSet`, interval ids, source-span ids, source-contour ids, and
  legal-domain ids on the merged face
- project render / hit-test / export from that merged `FinalFace[]`

Different visual packet keys are never part of this collapse and keep normal
stacking behavior.

## High-Curvature Rule

High curvature is not a separate drawing hack.

It is handled by the same candidate-plus-arrangement model.

Required behavior:

- detect when offset distance is large relative to local curvature radius
- split or densify the canonical geometry before offset error exceeds tolerance
- allow candidate self-overlap
- rely on arrangement and face classification to remove illegal or duplicate
  regions

Forbidden:

- clipping a doubled-width center stroke
- hiding self-overlap through paint masks
- letting renderer draw overlapping candidates directly

Feasibility:

- feasible for tolerance-bounded canonical geometry
- exact support requires stable topology, interval, arrangement, duplicate-face
  collapse, and legality behavior
- without a selected exact backend, high-curvature sampled constrained dashed
  interval-local packets must be labeled
  `resolutionStatus: "local-side-approximation"`
- a no-backend high-curvature local-side approximation may split one visible
  dash interval into bounded source-ordered sub-ribbons only when the unsplit
  selected-side ribbon would be self-intersecting. Every emitted sub-ribbon must
  be a simple polygon built from the authored sampled source path, not from a
  tangent/chord proxy.
- authored segment boundaries are mandatory split points when `sourcePath`
  metadata is available. Segment-local candidate construction comes before any
  fallback robustness subdivision because line-to-Bezier and Bezier-to-Bezier
  high-curvature joins cannot be recovered reliably from one global sampled
  open-ribbon offset.
- with a selected exact backend, accepted high-curvature packets may promote to
  `resolutionStatus: "exact-constrained"` after arrangement, legality, and
  owner collapse

2026-04-29 Figma reference refinement:

- A high-curvature cubic-loop inside dashed SVG export contains a source legal
  loop mask and pre-mask filled dash candidates.
- Its outline export contains final filled dash components after legal-domain
  clipping.
- Asyra may use legal-domain clipping as an internal arrangement/legality
  operation, but product render / hit / export packets may only contain the
  post-legality semantic regions.
- exact backend output must clip arrangement faces with `intersection` /
  `difference` against the source legal domain before side filtering.
- Any implementation that emits pre-clipped candidates as product geometry
  fails exact support even if the screenshot appears visually close.

## Acute-Corner Rule

At every corner, compute the signed turn and selected side before constructing
the join.

Required join inputs:

- incoming tangent
- outgoing tangent
- chosen side
- offset distance
- join family
- miter limit

For miter joins:

- compute the intersection of adjacent chosen-side offset rays
- compute miter ratio against the chosen offset distance
- emit the miter candidate only when the ratio is finite and within the miter
  limit
- otherwise emit bevel geometry
- treat this as normal supported join resolution, not as an unsupported runtime
  blocked state

For bevel joins:

- connect adjacent chosen-side offset endpoints directly

For round joins:

- emit an arc fan between adjacent chosen-side offset endpoints around the
  authored vertex
- approximate the arc within declared join tolerance

Forbidden:

- using miter geometry as a proxy for round support
- deciding miter validity after render emission

## Miter-Limit Rule

The miter-limit decision is part of geometry construction.

It must be deterministic from:

- offset distance
- turn angle
- miter limit
- numeric tolerance

Important:

- center strokes compare the miter length against the center-stroke offset
  distance, normally `strokeWidth / 2`
- one-sided `inside` / `outside` strokes compare against the selected-side
  offset distance, normally `strokeWidth`
- a one-sided implementation must not reuse `strokeWidth / 2` for this check,
  because that bevels valid constrained miters too early

If the miter intersection is unstable because the angle is below the declared
angle tolerance:

- the exact miter is not emitted
- bevel geometry is emitted instead
- the packet remains in the supported exact family if all other support
  criteria pass

This prevents infinite spikes and unstable tiny-angle behavior.

## Self-Overlap Rule

Self-overlap means candidate stroke faces overlap even when the source path is
not self-intersecting.

Required behavior:

- arrangement must partition the overlapping area
- ownership must preserve interval lineage
- legality must decide whether each partitioned face remains visible

The final output must not contain duplicate semantic regions for the same owned
legal area.

## Self-Intersection Rule

Self-intersecting source paths require declared face semantics before exact
support can be claimed.

Required decisions:

- fill-rule basis: `nonzero`, `evenodd`, or app-declared policy
- legal-domain construction from intersection-generated faces
- interval visibility through crossing regions
- ownership behavior when interval candidates meet at source intersections

Reference-backed constraint:

- raw offsetting of self-intersecting closed paths is not allowed
- source intersections must be removed or represented through planar
  arrangement before exact constrained offset construction

Recommended feasible algorithm:

1. split the source topology at all intersections
2. construct a planar arrangement of the source path
3. classify legal domains using the declared fill rule
4. derive legal-region boundary contours from edges adjacent to legal and
   illegal/exterior faces
5. build inside/outside stroke candidates from those boundary contours:
   - `inside` toward the legal face
   - `outside` toward the opposite face
   - center stroke remains authored centerline based and does not consume this
     contour side model
6. run stroke-candidate arrangement only when the contour candidate family
   still overlaps or needs same-visual cleanup
7. classify stroke faces against legal domains and interval ownership

The self-intersection constrained dashed `inside/outside` product path consumes
the shared resolved geometry model's even-odd boundary contours. The former
authored-side local-side approximation is not the product contract and must not
be cited as supported behavior. Each split contour edge is an independent dash
domain: both endpoints receive the endpoint dash rule and dash placement does
not continue across an intersection node into the next split edge.

2026-04-29 Figma reference refinement:

- User-supplied inside dashed self-intersection outline export contains
  thirty-four filled dash subpaths.
- User-supplied outside dashed self-intersection outline export contains
  thirty-two filled dash subpaths.
- Therefore exact inside and exact outside self-intersection support must be
  solved as distinct side-aware face-classification problems.
- A shared center-derived packet family with a side label is not an acceptable
  exact model.
- Later Figma-like comparison established the product stroke source as
  even-odd legal-region boundary contours, including hole boundaries. Local-side
  approximation remains useful only as a historical debugging reference; it is
  not the current support target.

## Overlapping Compound-Hole Rule

Overlapping raw hole contours are not equivalent to nested non-overlapping
contours.

Required behavior for exact support:

1. construct the legal fill domain from the authored contour set and winding
   rule
2. boolean-normalize overlapping holes and shells into legal regions
3. assign stable `legalDomainId`, shell/hole role, and contour lineage metadata
4. allocate intervals on the normalized legal-domain boundaries used for product
   stroke emission
5. build one-sided candidates from those legal boundaries
6. run arrangement/legality before render / hit / export emission

2026-04-29 Figma reference refinement:

- The overlapping-hole inside dashed SVG export contains one merged inner hole
  in the mask, even though the fixture was authored from overlapping holes.
- This confirms that product stroke geometry follows normalized legal domains,
  not each raw hole contour independently.

Current support:

- containment-depth parity for non-overlapping nested contours is supported
- overlapping holes are backend-gated: without exact boolean normalization they
  remain blocked for shared compound support; with a selected backend they use
  normalized legal-domain regions, normalized legal-domain boundary spans for
  dashed product emission, and shared source contour / source span metadata.

## Overlap Rendering Rule

Overlap does not mean "draw every layer."

The candidate geometry may overlap.

The product geometry must not blindly draw overlapping candidates.

Required flow:

1. candidate overlap exists
2. arrangement splits overlap into faces
3. ownership selects the semantic owner
4. legality selects visible regions
5. semantic packets are emitted
6. render batches may optimize emission without changing semantic truth

If the renderer receives two product regions that cover the same owned legal
area without an explicit compositing reason, the engine has failed the exact
path contract.

## Support Gate

A family may move from `research-gated` to exact support only when all are true:

- the algorithm branch in this file covers the family
- tolerance policy is declared
- dirty-layer behavior is declared
- semantic packet output is traceable
- geometry oracles cover representative and pathological fixtures
- performance is measured on the supported workload

## Remaining Implementation And Hardening Gates

These are implementation and hardening gates, not open-ended product guesses:

- exact self-intersecting constrained dashed strokes have backend-gated product
  promotion and real-backend partition / side-specific fixture coverage;
  remaining work is broader visual/reference parity and stress coverage
- high-curvature exact constrained dashed strokes have backend-gated product
  promotion and real-backend overlapping-candidate / side-specific fixture
  coverage; remaining work is broader visual/reference parity and stress
  coverage
- overlapping compound holes require legal-domain boolean normalization before
  interval allocation; the backend-normalized product path implements this for
  constrained dashed geometry
- independent multi-network owner preservation is implemented for exact
  arranged constrained dashed product paths; future export optimization may
  still add flattened visual minimization without losing owner metadata
- open dashed support intentionally uses true arc-length pattern placement for
  both zero and non-zero `dashOffset`; Figma half-dash endpoint balancing is a
  documented divergence, not a product path

If any item above is required by a phase, that phase must either implement the
declared algorithm in this file first or keep the scenario in the current
visibility / hardening state.

## Required Fixtures Before Implementation

Before implementation begins for a supported exact family, define fixtures for:

- shallow acute angle with miter below limit
- shallow acute angle with miter above limit
- round join on acute angle
- bevel join on acute angle
- high-curvature loop with candidate self-overlap
- high-curvature dashed interval crossing a turn
- self-overlapping but non-self-intersecting path
- true self-intersecting path
- compound closed path with hole
- dashed inside stroke with seam-wrap interval

Each fixture must declare:

- input path
- stroke spec
- expected support state
- expected interval summary
- expected semantic-region count
- geometry oracle
- failure-localization expectation

## Go / No-Go Rule

Do not start implementation for an exact family unless this file can answer:

- how candidates are constructed
- when arrangement runs
- how faces are classified
- how duplicate overlap is removed
- how joins are selected
- how miter-limit bevel recovery is selected
- how tests prove the result

If any answer is missing, the family remains gated.
