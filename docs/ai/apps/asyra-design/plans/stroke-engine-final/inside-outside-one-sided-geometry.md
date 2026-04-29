# One-Sided Geometry For `inside` And `outside`

## Role

This file defines the final canonical geometry method for constrained stroke
placement.

It is the explicit replacement for any product path that:

- builds a doubled-width center band
- clips away one half
- interprets the survivor as exact constrained geometry

That path is forbidden as the final engine architecture.

## Core Rule

`inside` and `outside` are one-sided geometry modes.

They must be built as one-sided geometry from the start.

They are not:

- clipped center strokes
- paint masks over center strokes
- debug overlays that happen to look constrained

Exact-correct handling for high curvature, acute joins, miter limits,
self-overlap, and self-intersection is defined in
`exact-correct-path-algorithm.md`.

## Canonical Flow

### 1. Normalize authored path into `PathTopologyModel`

Required outcome:

- one canonical path-topology object
- contour decomposition
- intersection descriptors
- arc-length parameterization
- stable orientation
- segment/sample descriptors

Why:

- the constrained engine must know which side is inward or outward before it
  constructs faces

### 2. Decompose into contour/network units

Each contour must preserve:

- contour id
- network id
- orientation
- role: `shell | hole | open`
- closure
- legal-domain id
- nesting depth
- contour-local length
- contour-local intersections
- contour-local sample stream

Why:

- constrained semantics are side-relative per contour
- ownership and legality later depend on stable contour/network identity

### 3. Build side-aware frames

For each sample and each authored vertex, compute:

- tangent
- left normal
- right normal
- curvature hint
- local arc-length parameter
- neighborhood relation

Why:

- one-sided segment, join, and cap faces must be derived from the chosen side
  explicitly

### 4. Select side

For each contour:

- `inside` selects the inward side
- `outside` selects the outward side

The chosen side is determined from contour orientation, contour role, declared
fill-rule basis, and legal-domain metadata.

Compound closed path rule:

- `inside` means "the side that stays inside the contour's declared legal fill
  domain"
- `outside` means "the side that leaves that legal fill domain"
- shell and hole contours may therefore select opposite geometric normal
  directions while still following the same product meaning
- no implementation may infer hole behavior from orientation alone without
  legal-domain confirmation

### 5. Build segment-body faces directly

For each visible segment span:

- use the source edge on one side
- use the chosen-side offset edge on the other side
- emit one body face between them

Do not construct the opposite side.

Required body-face property:

- one body face corresponds to one chosen-side band, not to a symmetric band

### 6. Build join faces directly

At each visible corner or smooth turn:

- emit a chosen-side join wedge/fan
- the join family is selected from `miter | bevel | round`
- the non-chosen side must not be materialized

Join construction requirements:

- miter: build only the chosen-side spike candidate
- bevel: build only the chosen-side bevel wedge
- round: build only the chosen-side arc fan

### 7. Build cap faces directly

For lower-level one-sided helper geometry used by constrained closed-path
candidate construction:

- emit a chosen-side terminal profile
- `butt`, `square`, and `round` are constructed only on the chosen side

Current product vector rendering does not promote open-path constrained
semantics. Open paths have no inside/outside legal domain, so authored
`inside` / `outside` positions resolve to center geometry for render, hit-test,
and export. This center-equivalent behavior is canonical, not a fallback. The
one-sided cap helper remains documented for constrained geometry internals only.

### 8. Allocate dash intervals before geometry

For dashed strokes:

- allocate visible/gap intervals on the canonical arc-length basis of the
  topology model
- slice only the visible interval input
- build one-sided segment/join/cap faces only for the visible interval

Forbidden:

- first build a doubled-width center dashed packet
- then clip it to simulate `inside` or `outside`

Canonical dash-length rule:

- all dash intervals are measured on one canonical authored-path length basis:
  `arc-length-on-topology`
- raw parameter-space `t` values may be used for lookup, but they must not be
  the normative dash-length basis
- flatten preview density may change numeric sampling, but it may not change the
  committed interval schedule for the same exact topology revision

### 9. Construct direct one-sided regions for simple topologies

If the topology is simple enough:

- no self-overlap
- no self-intersection
- no multi-owner ambiguity

Then the region may be constructed directly from:

- body faces
- join faces
- cap faces

without face partitioning.

### 10. Escalate to planar arrangement for complex topologies

If any of these appear:

- high curvature causing overlap
- self-overlap
- self-intersection
- multi-owner overlap
- nested ownership ambiguity

then candidate one-sided faces must enter a planar arrangement / face
classification stage.

Required outcome:

- partition overlapping candidate faces into explicit face regions
- classify which faces belong to the chosen side and owner
- discard non-owned or illegal faces before final packet emission

### 10A. Numeric robustness policy for arrangement

The arrangement stage must publish one explicit numeric policy for:

- intersection tolerance
- near-coincident edge snapping
- tangent touch vs true crossing classification
- zero-area face rejection
- repeated-vertex collapse
- face winding normalization

Required rule:

- exact support claims may not rely on undocumented ad hoc epsilon handling
- if exact predicates are not used, the implementation must document a stable
  deterministic snap policy and its thresholds

### 11. Apply legality and ownership only to candidate one-sided faces

Legality and ownership may:

- keep a face
- trim a face
- classify a face as blocked

They may not:

- invent the correct one-sided geometry from a wrong doubled-width source
- treat a false center band as canonical truth

### 12. Emit typed `StrokeRegionPacket[]`

Final constrained geometry must be emitted as typed region packets that carry:

- geometry id
- stroke id
- owner key
- network id
- contour id
- interval id
- source topology
- legality status
- blocked status
- explicit bounds

Owner identity must never be inferred later from string parsing.

## Compound Path Rule

For closed compound paths:

- every closed contour must map to one declared legal domain
- shell/hole classification must be stable before side-aware geometry begins
- legality clipping must operate against legal domains, not against raw contour
  orientation alone
- if a compound path cannot produce a stable legal-domain decomposition, the
  family must remain `research-gated` or `blocked`

## Why The Old Doubled-Width Clip Path Is Wrong

The doubled-width clip path is structurally wrong because it:

- creates geometry on the wrong side first
- asks clipping to erase a construction mistake
- increases overlap complexity near turns
- increases false ownership interactions
- can generate false visibility under high curvature
- makes exact constrained dashed behavior dependent on clip behavior rather than
  on true one-sided construction

This can be acceptable as a bounded experimental probe, but it is not valid as
the final product architecture.

## Explicitly Forbidden Product Paths

The following must remain forbidden in final product runtime:

- `width * 2` center band then clip half away
- center dashed packet first, constrained semantics second
- miter proxy geometry for supported round joins
- paint or shader masks that repair missing constrained geometry
- debug overlays used as the visible product path

## Success Criteria

The one-sided model is only considered implemented correctly when:

- simple closed inside/outside geometry is constructed without opposite-side
  faces ever existing
- dashed constrained intervals are constructed from interval-local one-sided
  faces
- ownership and legality operate on candidate one-sided faces, not synthetic
  center-band packets
- packet metadata is typed
- render/hit/export share the same constrained region family
- tests prove no opposite-side ghost coverage appears in supported exact slices
