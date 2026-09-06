# Original Part Geometry and Method v1

This is the implemented original-part refactor contract. PLANS.md records the
local owner/workflow evidence; independent numerical and public-release gates
remain governed by FIRST_RELEASE.md.

## Geometry source

Existing body-local GLB bindings become original part bindings. The domain
resolver consumes the complete decoded source, its SHA-256 identity, binding
pose and positive scale. It preserves every indexed triangle in source order,
including material boundaries. Scaling produces the canonical binary64 local
vertices used by both rendering and analysis. Lighting, colors, hidden state
and diagnostic wireframes cannot alter these vertices or analysis scope.
No binding means the body's explicitly authored analytical primitives are its
actual parts. A binding means the complete original parts replace legacy
surrogate colliders; the two representations are never combined as evidence.

New mesh geometry carries version 1, source identity and scale, positions and
indices. Snapshot version 2 freezes the resolved parts; version 1 remains an
immutable historical input, never implicitly upgraded or rerun as mesh evidence.
Portable storage retains and verifies the original sources required by current
and historical bindings. Missing or mismatched source content is an error.

## Solid interpretation and limits

The analysis profile requires nondegenerate, closed, consistently oriented
two-manifold triangle components. Exact coincident coordinates establish
topological adjacency only; vertices and triangles are never welded, omitted
or moved. Edge-disconnected closed components represent a union of solids,
including components that touch at isolated vertices. Each component must have
connected vertex fans. Holes in a
connected shell remain holes. Nonzero signed winding defines each component's
interior; nested independent shells do not implicitly subtract material. The
topology check does not certify absence of geometric self-intersection or the
source's intended manufacturing volume. Unsupported or ambiguous topology blocks admission; an
uncertain geometric predicate remains unresolved. Source authoring remains
the user's responsibility; no manufacturer accuracy is inferred from GLB.

Per-source limits match restricted GLB (200,000 vertices, 600,000 indices).
The complete resolved workcell is capped at 500,000 vertices and 1,500,000
indices, counted before repeated binding expansion. Mesh body data must retain
matching canonical source bindings; standalone unreferenced mesh blobs are invalid.
Aggregate frozen geometry and output remain bounded by the 64 MiB execution
envelope. Checkpoints and owned Worker deadlines apply inside geometry work,
not merely between body pairs.

## Numerical method

The new original-part method has a distinct immutable method identity. Native
primitive queries retain their analytical support geometry. Mesh queries visit
original triangles, with outward-enclosed bounds and explicit solid containment
checks. A bounding hierarchy may reject only regions proved separated; it never
supplies replacement contact geometry. Boundary uncertainty is not collision
proof or a clear result.

When original triangle bounding boxes overlap, interval support queries may
still certify a separating direction using the complete original triangles and
the user's declared search controls. Bounding-box overlap alone never proves
surface intersection. Solid containment and interval continuity prevent an
enclosed object with disjoint surfaces from being misreported as clear.

Continuous queries cover every declared trajectory interval using shared
joint-space interpolation and conservative motion bounds. Static witnesses may
prove an issue, but sampled frames never prove an interval clear. Time, numerical,
work and evidence limits produce explicit unresolved coverage. Reports preserve
the method/version, complete input, geometry source and actual distance bounds.
If later geometry work exhausts its budget, already established static witnesses
remain in the evidence. Use a zero interval lower bound unless a complete bound
was obtained; retain an established issue or otherwise mark that interval
unresolved. Unvisited intervals stay unknown. Exhaustion never erases findings.

For a pair with a shared ancestor, the domain may express both bodies in that
ancestor's body frame. Its entire common rigid motion cancels exactly, including
the ancestor's own joint. Only descendant mounts and joints remain. Bodies in
separate roots retain world coordinates. The same local-pose algebra must serve
world projection and relative queries; no sampled transform or independent
hierarchy replaces canonical kinematics. Distances and intersections are
invariant under this shared rigid change of frame.

## Permanent product cases

- Source triangle/placement parity across renderer and frozen analysis inputs;
  no visibility or material bypass; missing and corrupt sources rejected.
- Table-leg-only collision, small features, concave gaps and through holes.
- Disjoint surfaces, penetrating surfaces, complete solid containment, contact
  uncertainty and invalid topology; no convex-hull substitution.
- Fast translation and rotation between clear endpoint frames; full interval
  coverage, finite resource termination, cancellation and Worker parity.
- Save/open, duplication, Undo/Redo, immutable historical records, generic
  result/replay/comparison/report workflows and normal-App visual review.

## Bounded acceleration decision

The permanent nested open-bore rings case measured 65,800 work units and 93 ms
for only 256 triangles per part with exhaustive traversal on the development
host. This is a measured quadratic cost, not a reference-hardware benchmark.
The method may build a median-split AABB hierarchy over all original triangles.
The exhaustive path remains the test oracle; holes, containment, crossing and
clearance classification must agree, with independently conservative bounds.

Only an immutable mesh object and its immutable positions/indices permit an
execution-owned topology/index cache. The key is that exact frozen geometry
object (including resolved scale and source), not an asset name or mutable body.
Poses and interval bounds are recomputed for every query. A new source object
misses; mutable input misses. One explicit method executor may retain these
indices across static invocations for the same admitted live input lifetime;
ordinary formal runs retain their own isolated preparation. Each invocation
has a fresh query counter/checkpoint and charges the same logical preparation
work even on a cache hit. Failed preparation is not retained. All indices expire
with the owning Worker; edits, input replacement and cancellation retire that
Worker. No cache reinterprets historical evidence.

The permanent repeated-workcell profile measured 55 index builds across five
poses: 472 ms of 517 ms total was immutable preparation on the development host.
Cross-invocation reuse is justified by that measured cost, not a frame-rate
promise. Exact cold/warm evidence and logical-work equivalence, immutable-key
misses, independent budgets and cancellation are permanent regression gates.
