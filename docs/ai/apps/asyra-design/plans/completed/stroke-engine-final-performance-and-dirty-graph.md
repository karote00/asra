# Performance And Dirty Graph

## Performance Target

The final stroke engine has two hard product constraints:

- target: `120 fps`
- minimum floor: `60 fps`

These are runtime contracts, not aspirational notes.

The engine must therefore be structured so that expensive work is bounded,
reused, and incrementally invalidated.

The targets are evaluated only against declared benchmark workloads and declared
benchmark environments. They are still hard constraints, but they must be
measured in a reproducible way rather than by anecdotal local runs.

## Global Performance Rules

- path topology creation must not repeat unnecessarily in one render pass
- each vector network revision must produce one reusable `PathTopologyModel`
- interval allocation must be reusable across render/hit/export consumers
- ownership and legality must rerun only when their inputs are dirty
- render caching must avoid both GPU-only churn and avoidable CPU rebuilding
- preview mode may reduce numeric density, but it must preserve topology family,
  support state, ownership state, and legality state
- representation conversion and materialization costs must be treated as
  first-class runtime costs

## Dirty-Graph Layers

The final stroke engine must maintain at least these dirty layers:

1. source path layer
2. normalized stroke-spec layer
3. topology classification layer
4. interval allocation layer
5. candidate geometry layer
6. arrangement layer
7. ownership layer
8. legality layer
9. resolved region layer
10. paint layer
11. render/hit/export payload layer

Each layer must expose:

- revision key
- dependencies
- downstream invalidation targets

## Required Revision Inputs

Geometry cache keys must include at least:

- source path revision
- stroke spec revision
- interval allocation revision
- topology classification revision
- ownership revision
- legality revision
- paint revision
- preview/exact mode revision

If any of these are omitted, the implementation must explain why the omission is
safe in `function-contracts.md`.

## Vector Runtime Rule

For vector content:

- each network may build `PathTopologyModel` only once per revision
- center, constrained, dashed, hit, export, and diagnostics must all consume
  that same object
- no render strategy may re-flatten the same network independently for each
  packet family

Current implementation checkpoint:

- `buildStrokeRuntimeRevisionSet` derives packet revision fields from real
  source path, stroke spec, interval allocation, topology classification,
  ownership, legality, paint, and preview/exact inputs
- resolved stroke packets carry the revision set through geometry debug
  metadata and into render entries
- `computeStrokeDirtyKeys` compares previous and next packet revision sets in
  the render cache and records the latest dirty stage set
- implementations must not derive source/topology/ownership revisions from
  `geometryId`, render cache keys, cache-prefix structure, or polygon
  signatures
- the vector render pass builds one shared path geometry model per network and
  reuses it across center stroke, constrained solid, constrained dashed,
  diagnostics, render, hit-test, and export packet construction
- the vector render pass builds one shared `PathTopologyModel` per network and
  passes it through the same packet families instead of allowing packet helpers
  to rebuild private topology state
- rectangle and oval render strategies build one shared `PathTopologyModel` for
  the source path and pass it through center, constrained solid, constrained
  dashed, diagnostics, render, hit-test, and export packet construction
- dashed interval allocation consumes `PathTopologyModel.totalLength` and
  `PathTopologyModel.closed` through `allocateDashedIntervalsForTopology`
  instead of recomputing path length in each packet family
- open-path constrained packet builders consume `PathTopologyModel.isSimpleOpen`
  as the reusable topology classification for the current revision; direct
  geometry helper calls may retain a local safety guard, but product render
  paths must not rediscover open self-intersection once per packet family
- interval-local constrained dashed slices may inherit the source topology's
  simple-open/simple-closed classification only when the cap policy cannot
  mutate endpoints into a different topology; square-cap interval slices must
  keep the lower-level safety guard
- constrained dashed packet construction must cache stroke runtime revision sets
  within one stroke build by stable classification inputs such as
  `sourceTopology + intervalTopology`; visible intervals must not each rehash
  the same source points, stroke spec, and interval signature
- compound closed legal-domain classification uses full-contour containment
  depth over explicit topology descriptors; orientation-only or single-probe
  hole inference is not a valid completion signal for Phase 2
- compound legal-domain normalization is single-pass for containment-only paths;
  overlapping holes require exact backend boolean normalization and must not run
  global boolean work unless the compound source revision is dirty
- dashed-center packet construction is single-pass per vector render; overlap
  diagnostics consume the actual rendered dashed-center packets instead of
  triggering a second interval allocation / packet-build pass
- constrained dashed candidate construction and runtime classification must be
  skipped entirely when the authored stroke set has no constrained dashed
  intent
- source span graph construction is bounded by current flattened segment count
  and visible interval count; it may do `O(segmentCount^2)` self-intersection
  discovery for now, but must be cached by topology revision plus interval
  allocation revision before it is used in animation-heavy exact paths
- arrangement-heavy constrained dashed diagnostics must be lazy or debug-gated;
  normal product rendering may attach runtime status metadata, but it must not
  synchronously build ownership arrangement diagnostics unless a debug consumer
  explicitly reads that diagnostic payload
- constrained solid candidate construction, legality clipping, and ownership
  diagnostics must be skipped entirely when the authored stroke set has no
  constrained solid intent
- render cache reuse must fast-path unchanged revision sets before rebuilding
  polygon signatures or normalized geometry models; a cache hit with no dirty
  geometry or paint keys must only restore visibility and carry forward revision
  metadata
- exact backend operation caches must be bounded per backend instance and keyed
  by deterministic operation inputs, backend version, coordinate policy, fill
  rule, path geometry, and operation options. A cached result must be cloned
  before returning to callers.
- arrangement cache entries may cache partition geometry and candidate ids, but
  they must reconstruct `claimedBy` from the current typed `CandidateRegion`
  objects. They must never persist stale owner objects or recover ownership from
  geometry ids.
- render / hit-test / export projections from `FinalFace[]` may cache projected
  packet arrays by final-face array identity within a render pass, but the
  canonical `FinalFace[]` remains the source of truth.
- vector render pass must build one combined `strokeFinalFaces` array and use
  it for render, hit-test, and export. Promoted exact faces must not be
  converted back into resolved packets before projection.
- same-visual `FinalFace[]` overlap collapse is bounded by visual-packet
  grouping and a bounds-overlap precheck. Groups with no overlapping bounds
  must not call the backend boolean union path.
- same-visual overlap collapse is a coverage union, not a legality or contour
  role classifier. It normalizes input winding before union so opposite-oriented
  duplicate coverage cannot create zero-layer output.
- `strokeDebugOptions.disableVisualOverlapCollapse` is a render-source debug
  key. Toggling it must rebuild the `FinalFace[]` projection source for
  inspection, but it must not invalidate path topology, interval allocation,
  legal-domain normalization, or paint payload caches.
- The UI toggle writes the runtime system property
  `strokeDebugDisableVisualOverlapCollapse`; render subscriptions must reload
  the render tree when it changes so already-mounted vectors rebuild the
  final-face projection under the selected debug mode.
- geometry backend selection is part of the render invalidation contract. When
  the active backend changes from unsupported/local to an exact backend, preset
  render subscriptions must reload the render scene tree so existing vectors
  rebuild canonical geometry with the new backend. This reload must not create
  undo history and must not mutate scene data.
- the render pass exposes a debug/profiling counter for the number of path
  geometry models built in that pass
- the render pass exposes a debug/profiling counter for the number of
  path-topology models built in that pass
- regression tests must assert that the geometry and topology counters equal
  the number of rendered networks, not the number of stroke packet families

Current supported performance benchmark checkpoint:

- `packages/preset/src/__tests__/stroke-performance-contract.test.ts` is the
  current declared baseline CPU geometry benchmark suite
- `packages/preset/src/__tests__/clipper2-geometry-backend.test.ts` verifies
  bounded backend cache safety for boolean and arrangement outputs by mutating a
  first result and asserting the cached replay returns clean cloned geometry
  with current candidate owner objects
- runtime target:
  - Vitest/jsdom project test runtime
- hardware tier:
  - local/CI CPU geometry path; no GPU claim is made by this benchmark
- scene scale:
  - 100 moving open points across 300 frames
  - one sampled high-curvature cubic edit loop across 300 frames
  - three disjoint closed networks across 300 frames
- measurement mode:
  - scripted exact geometry update
- warmup period:
  - 20 frames
- sampling window:
  - 280 measured frames
- metric definition:
  - average fps must be at least `120`
  - p95 frame time must be at most `16.67ms`, the `60 fps` floor equivalent
- topology reuse requirement:
  - multi-network benchmark must build exactly one topology per network per
    frame
- scope limit:
  - this benchmark validates the current CPU geometry baseline only; browser
    GPU rendering and full product animation claims require additional declared
    browser benchmarks before they can be treated as product-performance
    evidence

## Preview Rule

Preview mode is allowed only under these constraints:

- lower tessellation density is allowed
- partial packet reuse is allowed
- deferred exact rebuild is allowed
- preview curve flattening may relax up to `min(1.0 px, strokeWidth / 4)`

Preview mode is not allowed to change:

- topology family
- support classification
- blocked classification
- ownership classification
- legality classification

When interaction settles, the exact path must be restored and its geometry hash
must converge to the exact baseline for the same revision.

Exact-mode curve flattening target:

- `0.25 px`

Numeric robustness constants:

- arrangement / snap epsilon: `1e-6` model units
- zero-area face rejection threshold:
  `max(1e-8, flattenTolerance * flattenTolerance * 0.25)`

Preview inheritance rule:

- preview mode must inherit the exact topology graph and committed interval
  schedule for the same source revision whenever a family claims exact support
- preview mode may only relax numeric density and downstream geometry rebuild
  cost, not semantic classification

## Renderer Cache Rule

The renderer cache must not only cache GPU projection objects.

It must also be able to reuse:

- normalized geometry model
- region bounds
- geometry signature/hash
- paint payload hash

Required fast path:

- if previous and next stroke revision sets are both present and no dirty key
  other than render/hit/export exists, the renderer must not rebuild polygon
  signatures, normalized geometry models, triangulation payloads, or paint
  payloads
- if only paint is dirty, geometry-stage work must not rerun before the paint
  update unless the active renderer API strictly requires a model object for the
  update call
- if geometry is dirty, the renderer may rebuild model/signature once for the
  packet, then store the new revision set with the cache entry

Why:

- caching only after CPU geometry rebuilding is too late for animation-heavy
  editing

## Hit-Test Cache Rule

Hit-test caches are part of the same dirty graph as render and export packets.

They must include a stroke-geometry signature in their reuse key, not only the
source point/network object identities.

Minimum signature inputs:

- semantic geometry id
- resolved bounds
- resolved packet count
- support or blocked status for the packet family

Reason:

- parameter-only edits can keep the same path object references while changing
  the stroke packet family from visible center geometry to blocked constrained
  geometry
- reusing the previous hit area after such an edit creates stale interaction
  behavior even when render/export packets are already correct

## Forbidden Runtime Costs

The final runtime must forbid:

- repeating path flattening in one pass for multiple packet families
- repeating topology classification in one pass for multiple consumers
- all-path polygon boolean every frame
- all-network ownership recomputation for paint-only changes
- rebuilding unrelated geometry on dash-offset-only changes
- undocumented repeated conversion from views to copied arrays between adjacent
  stages
- forcing render batching to become the first place where semantic packets are
  grouped

## Complexity Discipline

Each stage must publish:

- expected average complexity
- worst-case trigger
- guard condition when worst-case cost is unsafe

Examples:

- topology build:
  - bounded by segment/sample budget
- interval allocation:
  - bounded by visible interval count
- arrangement:
  - bounded by face/intersection budget; may become research-gated when exact
    support is not yet approved

## Benchmark Environment Contract

Every performance claim must declare:

- runtime target:
  - browser name/version or native runtime build
- hardware tier:
  - CPU class
  - GPU class if GPU-backed rendering is involved
  - memory class
- scene scale:
  - path count
  - network count
  - point count
  - sample budget
- measurement mode:
  - preview drag
  - exact settle
  - scripted animation
- metric definition:
  - warmup period
  - sampling window
  - average fps
  - minimum fps or p95 frame time

No benchmark may claim the product contract is met unless these inputs are
declared alongside the result.

## Measurement Requirements

The final testing spec must measure:

- point-drag preview frame rate
- exact-settle frame rate
- animated multi-point update frame rate
- topology reuse count
- interval allocation reuse count
- geometry rebuild count

At minimum, the benchmark suite must include:

- 100 points moving across 300 frames
- one high-curvature cubic edit loop
- one multi-network update path

Required pass interpretation:

- `120 fps target` means the declared average on the declared reference workload
  and benchmark environment
- `60 fps floor` means the declared minimum accepted frame rate on that same
  workload after warmup, or an equivalent p95 frame-time threshold if the suite
  uses frame-time metrics instead of fps

## Failure Rule

If performance drops below the stated floor:

- first inspect dirty-key over-invalidation
- then inspect topology reuse
- then inspect interval reuse
- then inspect renderer CPU rebuild behavior
- only after that inspect numeric density or tessellation settings

The engine must not solve performance regressions by silently weakening support
semantics.
