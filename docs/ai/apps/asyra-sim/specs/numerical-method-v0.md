# Machine-Scale Geometry Method v0

Status: M0 implementation contract. Source code and passing local tests are not
an independent numerical audit or release approval. The method must pass the
R0 product cases and delivery gates before public release.

## Inputs and Interpretation

The model denotes real-valued rigid geometry using the exact finite binary64
values in its normalized snapshot. Unit conversion is recorded before that
snapshot; it does not represent metrology uncertainty. Normalize mounting
quaternions and joint axes mathematically. Compose parent, mounting frame, then
joint motion. Capsules use the local Y axis and a center-segment length excluding
the two hemispherical caps. Box sizes are full extents. Colliders on one body
form a union, not a convex hull across colliders.

The initial envelope is 0.0001–20 m for radii and box extents, 0–20 m for capsule
center lengths, at most 1,000 m per local translation component, 64 bodies,
12 actuated joints in one serial chain, revolute values within ±100 rad, and
prismatic values within ±20 m. Motion has 1–2,000 frames, times in [0, 3,600] s,
and consecutive times at least 0.000001 s apart. These ranges constrain work and
conditioning; they do not promise a uniform absolute accuracy throughout them.
The maximum shape-dimension ratio is 200,000. Body and collider identity must be
unique in their respective scopes. Missing analysis geometry blocks the run.

## Arithmetic and Pose Ownership

The domain owns one algebra-parameterized pose/interpolation implementation.
Ordinary binary64 evaluation serves playback; outward interval evaluation serves
formal evidence. Neither the renderer nor the method redefines kinematics.
Scale finite axis components by their largest absolute component before
normalizing their norm. Positive rescaling preserves the exact direction and
prevents an overflowing squared norm from turning a valid translation into zero.

Basic interval operations enclose IEEE-754 binary64 arithmetic using adjacent
representable values. Overflow, division across zero, or nonfinite inputs fail
explicitly. Square-root guesses are checked using outward-rounded squares.
Trigonometric enclosures use a finite Taylor polynomial, a bounded remainder,
and repeated angle doubling after exact power-of-two range reduction. Formal
bounds do not assume that native `Math.sin` or `Math.cos` is correctly rounded.
Intervals may widen through dependent expressions; widening reduces conclusions
and must never be repaired by narrowing to an unproved epsilon.

The runtime must support standard binary64 operations, subnormals, and BigInt
DataView access. Test the arithmetic identities and outward-rounding contract
on every supported browser/runtime. Initial delivery targets the measured local
Chromium environment; other environments are unverified until their gates run.

## Static Convex Queries

Support functions cover every box/sphere/capsule pair, including rotated shapes.
A numerical closest-simplex search proposes axes and convex witness points; it
does not itself certify separation or penetration. Re-evaluate certificates
using interval arithmetic:

- A separating-axis support gap divided by its direction norm is a lower bound
  on unsigned distance. Zero is always a valid lower bound.
- The distance between a point in each convex shape is an upper bound. Witness
  points are support points or exact convex interpolants, carried as intervals.
- Strict inclusion of the origin in a tetrahedron whose vertices lie in the
  Minkowski difference establishes penetration, using interval determinant signs.
  A search epsilon or near-zero witness is not a contact certificate.
- Degenerate simplices, equality/touching, ill-conditioned arithmetic, and
  insufficient iterations may return unresolved with the bounds obtained.

Bounds, witnesses, penetration evidence, and convergence are separate fields.
The requested distance tolerance is an output-width target, not an assumed error.
The initial target is 0.000001 m; numerical intervals and search residuals remain
visible when this target cannot be reached. No nanometer-accuracy claim is made.

## Continuous Time

Split at every trajectory keyframe and never extrapolate. Evaluate shared
interval kinematics on each complete time interval. Support separation valid
for those pose enclosures certifies a lower bound for the entire interval.
Static witnesses at declared times provide upper bounds on the minimum over the
interval; they do not prove clearance between those times. Subdivide when bounds
do not resolve the selected threshold. The distance-tolerance setting controls
static search, not a promised width for the continuous minimum. Report the actual
continuous lower/upper bounds even when wider than that setting. This route covers
rotation and translation without assuming a straight Cartesian path.

Preserve evaluated interval partitions, including unresolved leaves. Reaching
the configured time resolution, node/iteration limit, timeout, or cancellation
cannot establish clearance. Time endpoints are represented as binary64 values;
subdivision stops if no representable interior midpoint remains. The reported
time bracket is the actual leaf interval, not an exact first-contact time.

The application caps retained evidence at 200,000 leaves across all pairs,
independently of the node budget. Reserve at least one unresolved-range record
for every remaining pair. Do not subdivide when the pending partition would
exceed its remaining evidence capacity; retain the current bounds and witness
as unresolved instead. When the initial keyframe partition itself cannot fit,
record the complete requested range as unevaluated, with no witness and an
explicit evidence-capacity reason. Never discard an established finding to
make room or silently present omitted time as covered.

## Decisions and Verification

Unsigned clearance is nonnegative. A strict upper bound below a positive user
threshold establishes insufficient clearance. A strict lower bound above the
threshold establishes clearance. Equality or overlap with a threshold is
unresolved unless an independent penetration certificate already establishes an
issue. Threshold zero therefore does not turn a tiny positive estimate into
contact. A known finding survives incomplete coverage of other pairs or times.

Formal tests must include all unordered shape pairs, independent analytical
distances, symmetry/rigid-transform invariance, strict penetration and touching,
near-limit scales, compound bodies, rotational and high-speed sweeps, uncertainty,
and budget termination. Approximate renderer positions are never test oracles.
Independent review and pilot evidence remain release gates.

The numerical design uses support-set distance search; its certificates and
interval arithmetic are App-owned implementations, not an imported solver.
Background references:
<a href="https://graphics.stanford.edu/courses/cs448b-00-winter/papers/gilbert.pdf" target="_blank" rel="noopener noreferrer">Gilbert, Johnson, and Keerthi: convex-set distance</a>
and
<a href="https://262.ecma-international.org/16.0/index.html" target="_blank" rel="noopener noreferrer">ECMAScript numeric semantics</a>.
