# Stroke Engine Final Spec

## Authority

This file is the stroke engine specification and the semantic source of truth
for stroke rendering. All final stroke geometry, dash allocation, join, cap,
domain, canonicalization, cache, drag, visible-render, hit, export, and
diagnostic ownership rules must live here.

Other stroke documents have constrained roles:

- `docs/ai/apps/asyra-design/PLANS.md` is the active task plan. It summarizes
  the spec clauses, gates, constraints, and forbidden approaches needed for the
  current task, but it must not define independent stroke semantics.
- `docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js`
  is inspector flow data. It visualizes stage order, data flow, evidence
  checkpoints, and failure reopening, but it must not define finer or different
  stroke geometry semantics than this spec.

No other stroke plan, report, BDD feature, completed copy, or archived spec is
allowed to define current stroke behavior. Other documents may reference,
summarize, visualize, or test this spec, but they must not add competing stroke
semantics. Wrong historical decisions may remain only in decision history.

Stroke tasks may use only this spec, the active plan, and the inspector flow
data as documentation inputs. Canonical visual review rules, required overlays,
failure markers, commands, and completion criteria are part of this spec; they
must not live in a fourth stroke document.

`stroke-flow-inspector.html` is a non-authoritative viewer shell. It may read and
display `stroke-flow-inspector.data.js`; it must not contain stroke rules,
contracts, conclusions, reading instructions, or completion status.

## Spec Completeness Contract

This file must be detailed enough to answer stroke implementation questions
without inspecting historical reports, old tests, runtime fallbacks, screenshots,
or hidden renderer behavior. When a stroke-related defect or ambiguity appears,
the answer must be added here before implementation proceeds.

Every stroke rule introduced by this spec must identify:

1. The owner stage that computes or validates the rule.
2. The exact input artifacts and normalized fields it consumes.
3. The exact output artifacts and metadata it produces.
4. The route conditions and bypass conditions under which it runs.
5. The local geometry basis and source-domain evidence required to prove it.
6. The visible contributors that are allowed to own pixels.
7. The contributors that are forbidden from producing visible output.
8. The channel or descriptor boundary that prevents evidence from becoming
   product output.
9. The cache, dirtying, and invalidation keys that affect reuse.
10. The formal oracle or visual review evidence required before claiming
    correctness.

The active plan may summarize these rules, and the inspector flow may reference
them by `specRuleRefs`, but neither document may replace a missing rule with
local implementation text. Runtime code, tests, or visual review artifacts that
need a rule absent from this file must stop and reopen this spec first.

## Document Deep Audit Protocol

Document-only stroke audits are governed by a fixed matrix. An agent must define
the complete audit matrix before running a deep check, run the whole matrix in
one pass, summarize all findings together, apply one focused documentation edit
batch, and rerun the same matrix after the edit. A deep audit must not add new
focus areas in the middle of the same pass. If a new audit concern is discovered
while the pass is running, the current pass records it as a deferred matrix
extension; the matrix must be updated and validated before the next pass starts.

The minimum document audit matrix is:

1. Source-of-truth boundaries: this spec owns stroke semantics, the active plan
   owns task execution summary, and the inspector flow owns route sequencing.
2. Inspector/spec separation: inspector routes cite `specRuleRefs` for detailed
   geometry, dash, join, descriptor, channel, cache, and visual-review rules.
3. Reference-calibrated stroke parameter rules: external reference behavior is
   translated into Asyra-native wording, field names, defaults, and unsupported
   input handling without making external documents part of the contract.
4. Join and miter resolution: authored join, resolved join, `vertexAngle`,
   `miterAngle`, `angleSource`, comparison evidence, and degenerate cases remain
   unambiguous and non-conflicting.
5. Dash body, dash cap, and join seam continuity: dash allocation, cap footprint,
   source-vertex join ownership, shared Step 27 seam endpoint identity, and
   legal-domain clipping are deterministic and channel-safe.
6. Smooth-continuity and high-curvature routing: tangent-continuous curved spans
   remain smooth products and cannot become source-vertex joins.
7. Center/inside/outside construction: center products, doubled-center
   constrained products, masks, legality clipping, and open constrained spans
   have explicit owners and no hidden renderer fallback.
8. Artifact lifecycle: pre-legality products, post-legality products,
   descriptor strategy records, final faces, render entries, hit/export packets,
   diagnostics, and visual overlays have registered producers and consumers.
9. Channel separation: visible render, hit, export, diagnostics, and visual
   overlay channels cannot consume each other's output as product truth.
10. Cache, dirty, bypass, and current-state rendering: paint-only, hidden-output,
    cache-hit, source-drag, static parameter, undo/redo, reload, and
    collaboration routes preserve the same product semantics.
11. Owner-stage metadata: every product route preserves `ownerStage`,
    `visibleContributor`, `geometryBasis`, artifact ids, route ids, and failure
    reopening evidence.
12. Forbidden contributors: renderer-local joins/caps, endpoint cap repair,
    terminal overhang repair, duplicate interval paint, helper-visible geometry,
    patch geometry, substitute output, and stale descriptors remain forbidden.
13. Route predicates and reachability: structured predicates are complete,
    mutually exclusive where required, co-executed where required, and default
    `else` routes cannot overlap explicit routes.
14. Artifact registry integrity: every route consumes and produces registered
    artifacts, and no produced artifact is left without a legal downstream
    consumer unless it is explicitly terminal.
15. Retired wording scan: fallback, repair, heuristic, approximate, old model,
    renderer-owned, or optional-collapse wording must either be removed or be a
    forbidden-context statement.
16. Numeric tolerance and evidence uniqueness: epsilons, visual tolerances, gap
    floors, and local probe windows have one owner, one value or formula, and
    required evidence; dash/join seams are governed by shared Step 27 endpoint
    identity, not a numeric gap tolerance.
17. Test/refactor/visual gates: step locks, unit gates, integration unlocks,
    regression retry limits, visual review requirements, and port/runtime rules
    are consistent across this spec, the active plan, and inspector data.

The protocol validator must assert that this protocol exists in all three stroke
rule sources before document-only schema or spec work can be considered closed.

## Current Status

The 2026-06-21 stroke architecture closure is historical baseline evidence, not
current runtime closure for reopened stroke feature work. The completed record
is
`docs/ai/apps/asyra-design/plans/completed/stroke-engine-final-architecture-closure.md`.
Runtime stroke behavior is not considered correct until the inspector-flow
step-unit phase, integration phase, visual review, and required regression gates
for the reopened scope pass against this spec.

The current formal product pipeline is:
`feature/session intent -> vector editing intent -> common API/domain adapter ->
canonical computed patch -> transaction boundary -> scene commit -> downstream
event routing -> render mirror patch -> render data derivation -> dirty graph ->
product cache -> render strategy entry -> normalized render data -> normalized
stroke spec -> shared geometry model -> source families -> stroke domains ->
dash interval allocation -> product family selection -> center stroke products /
constrained solid products / dash interval body products / source-vertex join
products / terminal body products / smooth-continuity products -> descriptor
strategy selection -> legality clipping -> resolved regions -> paint payload ->
final faces -> post-legality descriptor materialization -> render entries ->
renderer projection -> final visible result, with hit-export packets and
diagnostics emitted as channel-separated sibling or aggregation consumers of
final faces, render entries, renderer-projection metadata, and hit/export
evidence`.

## Supported Stroke Feature Surface

This spec covers the complete current Asyra stroke engine surface. Any stroke
feature not listed here is unsupported until this file receives an explicit
semantic contract, inspector route, formal oracle, and implementation owner
stage.

Supported authoring inputs:

- Source geometry: authored vector paths, open subpaths, closed subpaths, vector
  networks, self-intersections, contour visits, source families, source
  revisions, and source-domain tangent evidence.
- Stroke visibility and paint: one `FillAttrs` payload per stroke,
  `stroke.fill.visible`, opacity, solid paint, gradient paint, and paint-only
  dirtying that preserves previously verified geometry products.
- Stroke width and position: finite non-negative width, `center`, `inside`, and
  `outside`. Center products are built around the authored center path. Inside
  and outside products are built as doubled authored center-stroke products and
  then filtered by the resolved legal domain declared by the active stroke
  product route.
- Joins: authored `miter`, `bevel`, and `round`; resolved `miter`,
  `bevel`, `round`, `bevel-by-miter-angle`, and degenerate local join variants
  declared by this spec.
- Miter threshold: `miterAngle` as a source-domain angle threshold. The
  comparison input is degrees in the same angle domain as `vertexAngle`.
- Caps: `butt`, `round`, and `square` endpoint/body-side cap footprints.
  `butt` means no extension beyond the terminal seam. `round` means one
  half-circle footprint with radius `stroke.width / 2` centered on the terminal
  seam. `square` means a rectangular extension of `stroke.width / 2` beyond the
  terminal seam along the terminal tangent. Caps are never join primitives.
- Dashes: dash arrays, interval allocation over authored source length or
  declared constrained source spans, reference half-terminal dashes at true open
  dashed-line endpoints, body-side dash cap footprints, Asyra constrained-span
  allocation rules, and legal-domain clipping that never reauthors the dash
  schedule.
- Output channels: visible render entries, hit/export packets, diagnostic
  snapshots, and descriptor evidence with strict channel separation.

Unsupported inputs are rejected before stroke product planning unless this spec
defines a named normalization route for that exact input. A named normalization
route must emit normalized stroke-domain input plus non-visible diagnostic
evidence before product planning starts. Unsupported inputs must not create
hidden product routes, renderer-owned visible geometry, fallback masks, or
substitute output. The unsupported surface currently includes arrowhead or
marker caps, endpoint shapes, brush strokes, dynamic strokes, variable-width
strokes, non-uniform per-side stroke weights, stroke expansion intended only for
external export simplification, and external style-library metadata that does
not change the canonical stroke product.

Adding support for an unsupported input requires this order: spec rule first,
inspector route second, step/unit oracle third, implementation fourth,
integration fifth, E2E/visual sixth. Runtime code must not silently accept an
unsupported stroke feature by approximating it with an existing cap, join,
dash, mask, descriptor, or renderer route.

## Inspector-Flow-First Greenfield Refactor Protocol

Stroke engine refactors that reopen product geometry, join, cap, dash, domain,
descriptor, render-entry, or inspector behavior must follow the inspector flow
one step at a time. The inspector flow is the executable architecture contract
for refactor sequencing, while this README remains the semantic source of truth.

The refactor protocol is fail-closed:

1. Only tests that map to this spec and the inspector flow may participate in
   stroke correctness gates. A test that cannot identify its governing spec rule,
   inspector step or route, and expected artifact owner must be rewritten or
   removed before it can remain in a stroke gate.
2. Add or update one dedicated unit test for the active inspector step before
   implementing that step. The test may assert only the active step contract:
   inputs, outputs, conditions, bypass conditions, limitations, owner stage,
   contributors, required evidence, and reopening behavior.
3. Do not import visual/E2E helpers, packet helpers, or route oracles into step
   tests unless the active inspector step explicitly allows that import and the
   helper itself is mapped to current spec rules.
4. Implement only files listed by the active step lock metadata. A later step
   must not repair, infer, or substitute output for an upstream step.
5. Mark a step verified only after its dedicated unit test and the inspector
   refactor protocol validator pass.
6. Execute the refactor continuously one runtime inspector step at a time until
   all 41 runtime inspector steps are verified, unless the active step reaches
   the retry stop condition below. A step may not advance because a later step is
   easier or because a downstream artifact appears visually acceptable.
7. Each active inspector step has a maximum of three focused repair attempts. Each
   attempt must start from a named failing gate or contract mismatch and end
   with the focused step gate result. If the third attempt still fails, stop the
   task at that step, do not advance the lock, summarize the blocker, the failed
   gate, the owner-stage evidence, and the attempted repair paths, then send a
   system notification when the host environment supports it.
8. Full preset regression remains a separate phase gate. It may be attempted at most three times.
   After each failed full preset
   regression, summarize the failing suite, assertion, owner stage, and focused
   repair path before retrying. If the third full regression attempt fails, stop
   immediately, do not continue repairing, and notify the user for discussion.
9. After all 41 runtime inspector-step unit tests are verified, stop at a
   unit-complete checkpoint. Keep full integration, E2E, visual review, and full
   preset regression locked until the user approves a separate test-plan
   refactor phase. E2E validates user behavior only; it does not define stroke
   engine architecture. Post-runtime validation gates remain outside the runtime
   implementation step sequence.

Each inspector step must expose machine-readable lock metadata: `stepIndex`,
`stepNumber`, `refactorStatus`, `unitTestFile`, `implementationFiles`,
`allowedInputs`, `requiredOutputs`, `allowedTestImports`, `advanceGate`,
`integrationUnlockCondition`, and
`verificationEvidence`. `stepIndex` is the zero-based machine index used for
array/order validation. `stepNumber` is the one-based human-facing number used
in reports, file names, and gate labels. Exactly one product refactor step may
be `active` during product-step execution. During inspector schema repair no
product step is active, all product steps remain locked, and the next executable
gate is the inspector schema protocol gate.

High-risk orchestration steps must also expose an explicit entry-boundary
contract. A step is high-risk when its behavior is implemented as a slice across
stores, render strategy dispatch, cache orchestration, or evidence gates instead
of one pure product function. These steps must declare `entryPointKind`,
`entryPoint`, `implementationFunctions`, `helperAllowlist`, and
`orchestrationBoundary`. The `entryPoint` is the single owner surface that a
unit test and refactor segment must enter through. `implementationFunctions`
lists the named functions or slices that may participate inside that boundary.
`helperAllowlist` lists subordinate helpers that may support the boundary
without becoming independent owner stages. `orchestrationBoundary` must declare
the concrete owner surface, input boundary, output boundary, and forbidden
ownership responsibilities. A high-risk step that lacks this metadata is not
implementation-ready, even if `implementationFiles` is present.

The current high-risk entry-boundary runtime steps are
`render-mirror-patch-apply`, `render-data-derivation`, `stage-product-cache`,
and `render-strategy-entry`. These steps may be orchestration boundaries, but
they may not silently own stroke geometry, product descriptor semantics,
renderer repair, hit/export repair, or diagnostics-as-product output unless this
spec and the inspector flow declare that ownership explicitly.

`visible-final-result` is a post-runtime validation gate, not a runtime
implementation step. It keeps final visual/product closure evidence and failure
reopening rules, but it must not appear in runtime step ordering,
`runtimeImplementationState.verifiedStepIds`, or per-step implementation
allowlists.

Inspector routes must be typed architecture routes, not inferred linear edges.
Every route declares `routeType`, `decisionGroup`, `parallelGroup`,
`coExecutionGroup`, `routePriority`, structured predicates, `specRuleRefs`,
`consumes`,
`produces`, `skipSteps`, `dirtyDependencies`, and `cacheKeyInputs`. Human
readable `condition` text is explanatory only; `conditionId`,
`predicateInputs`, `when`, and `elseOf` are the route condition contract.
Structured predicates use executable shapes composed from `all`, `any`, `not`,
and field comparisons. A route must not use a generic input list as its only
condition source.
Default ordered routes are explicit low-priority `else` routes. Cache-hit,
paint-only, hidden-output, and source-drag paths must be explicit bypass or
classification routes with `resumeAt` or `nextConsumer` so the inspector can
prove which expensive geometry stages are skipped. `edges` are viewer
compatibility output derived from typed routes; they are not an independent flow
source.

Inspector artifacts must be declared in the artifact registry before a route can
consume or produce them. Product assembly is split into top-level inspector
steps for product-family selection, center products, constrained solid
products, dash interval body products, source-vertex join products, terminal
body products, smooth-continuity products, descriptor strategy selection, and
post-legality descriptor materialization. Product family decisions,
descriptor-strategy selection, product co-execution routes, and post-legality
descriptor materialization are separate route groups. Parallel product routes
use co-execution groups and are not mutually exclusive fallback routes.
Descriptor strategy may be selected before legality, but renderer-ready
descriptor materialization may consume only post-legality products, final-face
records, or products carrying explicit legality-equivalence evidence.

Each step references targeted semantic stroke rule ids instead of embedding
every global rule. Fine-grained geometry, join, dash, descriptor, and channel
rules live in this README. Inspector routes cite these clauses through
`specRuleRefs`; they must not copy long semantic rule text into flow data. The
inspector may display the global rule registry, but a
step contract must expose only the rule references that govern that step.

## Canonical Owner-Stage Diagnosis

Stroke regression diagnosis must locate the first canonical stage where product
semantics become incorrect. Do not infer owner stage from the next visible
artifact, a downstream repair opportunity, or a performance profile.

Diagnosis proceeds in source-to-render order:

1. computed patch;
2. render mirror;
3. `StrokeDomainPlan`;
4. `DashProductInterval` / solid product contract;
5. endpoint cap policy / join ownership / smooth continuity;
6. product descriptors;
7. render entries;
8. resolved vector geometry.

Only after all upstream semantic stages are proven correct may a downstream
stage be investigated. If product descriptors are correct but render entries
are wrong, the issue is render projection. If render mirror data is wrong, the
issue is state synchronization or cache invalidation. If dash intervals,
endpoint cap policy, join ownership, or smooth-continuity records are wrong,
downstream geometry must not compensate.

Performance measurements can identify hot stages, but they cannot decide the
semantic owner stage.

## Algorithm Replacement Rule

Algorithm replacement is allowed only when it preserves the stroke product
contract. New algorithms, data structures, caches, or incremental recompute
paths must prove semantic equivalence for the affected stages before they are
accepted.

Valid proof must cover the relevant source-to-render semantic records, not only
pixels:

- `StrokeDomainPlan`;
- `DashProductInterval` / solid product contract;
- endpoint cap policy;
- join ownership;
- smooth-continuity records;
- product descriptors;
- render entries, export packets, and hit/diagnostic channel separation when
  touched.

Runtime guardrails may be used as a safety mechanism, but they are not a formal
fix and cannot replace the equivalence proof. Algorithm replacement must not
introduce preview-only output, reduced precision, frame skipping, overlay-only
render, patch geometry, fixture-specific branches, substitute product output, or
drag-only routes.

## Current-State Product Contract

Committed state decides history; current state decides render. The stroke render
engine is a pure product renderer over the current source/stroke state it
receives. Drag, undo, redo, reload, collaboration patches, parameter switches,
point edits, handle edits, and structural vector operations do not create
separate stroke semantics.

Every current source/stroke state must independently resolve the full stroke
product contract:

- source topology;
- self-intersections;
- contours and contour visits;
- filled regions and legal domains;
- dash allocation;
- terminal roles;
- endpoint cap policy;
- join ownership and authored miter angle resolution;
- smooth-continuity groups;
- product descriptors;
- render, hit, export, diagnostics, and visual-overlay projection.

An intermediate drag frame may remain outside undo history, but it is still a
current state for rendering. It must therefore satisfy the same stroke product
contract as a committed mouseup state. Preview-only shortcuts, drag-only product
routes, undo/redo-specific repairs, reload repairs, collaboration-patch repairs,
or stale-topology substitute render paths are invalid.

Cache is validated acceleration only. It is never the semantic source. Reuse is
allowed only when source revision, topology signature, domain signature, dash
signature, terminal/cap signature, join signature, smooth-continuity signature,
and descriptor signature prove equivalence for the current state. If any
signature cannot prove reuse, Stroke Geometry must rebuild the exact current
product. The same current source/stroke state must produce the same visible,
hit, export, diagnostics, and visual-overlay product output regardless of which
mutation path reached it.

Pixel-level dashed or join defects may still be opened after this closure, but
they must stay on that product pipeline. Such bugs do not authorize another
visible product route.

The inspector flow is now the Stroke / Vector System Inspector Flow. It covers
the complete stroke-related data path from feature intent through common API
vector operations, canonical computed patches, transaction/data-channel
publication, render mirror updates, stroke geometry, product packets, and final
visual review. The framework-aligned vector operation flow is the baseline:
point/handle drag and structural operations commit canonical workspace/world
vector data through computed patches, while render remains a downstream
consumer.

`vector.ts` is a render input assembler. It builds source path/topology and
normalized stroke input, then delegates product semantics to `StrokeDomainPlan`
and the product builders.

Diagnostics, export packet details, performance counters, and screenshot
artifacts are evidence only. They do not decide whether visible product output
exists.

## Stroke / Vector System Flow

Stroke-related behavior is inspected as one deterministic system flow:

1. Feature/session code converts input into explicit vector or stroke intent
   and never writes render store state directly.
2. App common API/domain adapters own vector mutations and emit canonical
   workspace/world computed patches for drag and structural operations.
3. Each intended user action is wrapped in one transaction boundary and one
   intended undo unit. Drag updates remain non-undoable.
4. Scene-tree and data-channel publish changed scalar values and record ids as
   computed patch updates after commit.
5. Render mirror/cache applies each committed patch exactly once and derives
   renderer-ready vector/stroke data from committed state.
6. Stroke geometry stages consume normalized render data and own shared
   geometry, stroke domains, dash intervals, legality, and final semantic
   records.
   Invalidation is stage-based: source path/topology, stroke family, stroke
   domain, dash interval allocation, terminal cap, join/miter shape, paint, and
   render output have separate internal revisions. A stroke parameter change must
   dirty only the stages that parameter affects; vector drag dirties source
   path data while keeping static stroke parameter revisions stable.
   Dirty classification must feed a real stage product cache at the render
   mirror/vector graphic boundary. Exact semantic product descriptors may be
   stored by element, network, stroke, source revision, and geometry-affecting
   stroke signature; paint-only changes retint cached descriptors instead of
   rebuilding geometry.
7. Product output emits render, hit, export, and diagnostics descriptors
   without changing stroke semantics. Visible render must not use diagnostic or
   helper geometry as product output.

Stroke paint data has one canonical model shape. Element `fills` and
`strokes[n].fill` both use `FillAttrs`; a stroke owns exactly one fill payload
whose `id` matches the stroke id. Stroke root fields such as `color`,
`opacity`, `visible`, `kind`, `colorFormat`, `defaultColorFormat`, and
`gradient` are load-boundary normalization input only and must not be written back to
computed data. Stroke visibility is `strokes[n].fill.visible`. Render compares
`computed.strokes` by stroke id and fill signature: if only `stroke.fill`
changes, the renderer dirties `paint` / `renderOutput` and reuses cached
semantic product geometry.

## Asyra Solid Rule

Constrained solid strokes follow Asyra's doubled authored center-stroke mask
model. This is the Asyra rule contract and the only source of truth for
constrained solid product construction:

1. Build the authored center stroke at twice the requested stroke width.
2. Apply authored join behavior to that center stroke. `strokeJoin` and the
   authored miter angle affect the produced center-stroke envelope before
   masking.
3. Clip the result with the filled-region mask for `inside`, or the exterior
   mask for `outside`.

The solid product must not be represented as direct constrained-side visible
geometry. Region faces, strip fragments, helper polygons, and topology evidence
can justify legality, but they are not the visible solid stroke.

For `center` solid strokes, the product-visible encoding is the authored center
stroke. A self-intersecting center solid vector may use an authored stroke path
descriptor for visible render, preserving `strokeJoin`, `strokeCap`, and
`miterAngle`. Native stroke projection is valid only when it is
alpha-safe under the Alpha-Safe Descriptor Projection contract; translucent
self-intersecting center strokes must render through a single-composite
descriptor so crossings do not accumulate alpha. Exact polygon packets remain
valid for hit/export/diagnostics, but they are not required before each
drag-time visible frame when the authored center stroke path is the product.

For `center` dashed strokes, the product-visible encoding is the authored
center dashed stroke. Drag-time visible render may encode visible dash intervals
as authored centerline `strokePaths` with the authored `strokeCap`,
`strokeJoin`, `miterAngle`, and resolved dash allocation. That descriptor
is the exact visible product, not a simplified drag route. Normal drag frames must not require
center dashed polygon packets or resolved self-intersection geometry unless
diagnostics, hit/export materialization, or a rule in this spec explicitly
requires that evidence.

For open `center` dashed strokes, resolved dash allocation is network-level.
A continuous open network/subpath owns one dash interval allocation across its full
arc-length; ordinary segment boundaries inside that continuous network must not
restart the phase. The two true network endpoints use half-length terminal
dashes. If the stroke domain declares a source span as an independent dash span,
that span owns its own allocation origin: both independent span endpoints use
half-length terminal dashes, and the interior visible dashes and gaps are
distributed evenly across the remaining source distance. The distributed gap
length must never be less than `configuredGap * 0.6`. If a candidate interval
count would require a smaller gap, the allocator must reduce the interior
dash/gap count until the gap floor is satisfied; if no separate interior gap can
be kept, the span collapses to the declared terminal dashed product with
dashed-collapse provenance instead of substituting solid coverage. Round and
square dash caps extend the visible footprint at dash body endpoints; they do
not cause the allocator to violate the `configuredGap * 0.6` allocation floor
or to create new independent endpoints. Short authored spans are represented by
the same source-distance dash interval allocation clipped to the available authored range,
with terminal-short provenance when needed, not by a generic solid output.

Open authored dashed `inside` / `outside` strokes use the formal unbounded open
center product only when the open network has no bounded filled-region domain. If an open
self-intersecting network resolves bounded filled regions from its real authored
source segments, dashed `inside` and `outside` for that network own a
constrained domain even though its true endpoints remain open. The filled-region
domain is the planar arrangement of the real open source segments only; no
invisible closing edge may be added for domain, dash, hit-test, export, or
product output.

Stroke domain plan is the single product routing entry point for open/closed
semantics. Vector render code and packet builders must not independently map
open constrained strokes to center; they consume domain modes such as
`center-product`, `closed-constrained-domain`,
`open-contour-constrained-domain`,
`open-dangling-outside-both-sides`, and `inside-excluded-open-span`.

Open self-intersecting `inside` dashed output follows the resolved closed
contour rule: only source spans that participate in a filled contour may produce
inside dash pixels. Dangling open branches and non-contour spans stay unpainted
for `inside`. Open self-intersecting `outside` dashed output follows the
resolved exterior contour rule for contour-owned spans and additionally keeps
dangling open-branch endpoint/cap/dash semantics by rendering those dangling
spans on both sides of the source path. Their visible normal span must equal
`stroke.width * 2` within width tolerance; they are not unbounded open center strokes. This
rule is a product contract: product output must not
normalize these networks to center, must not inherit continuous open-network
dash allocation state across inspector-declared independent constrained source spans, must
not synthesize a closing edge, and must not paint dangling branches for
`inside`. Legal-domain clipping can cut a visible dash body, but that clip does
not create a new dashed-line endpoint, does not add a new endpoint cap, and does
not reallocate half-dashes or gaps at the cut boundary.

For adjacency-aware self-intersecting masks, a grouped render descriptor may
carry authored centerline stroke paths with explicit clip groups. Those groups
are an encoding of the masked authored stroke source: they must preserve
`strokeJoin`, `miterAngle`, and source-centerline provenance, and must not
turn face strips, helper polygons, or derivation fragments into visible product
geometry.

Constrained dashed render has one product pipeline. Static render, drag,
descriptor output, render entries, hit/export, cap switches, reload, and pan all
consume the same `StrokeDomainPlan` and `DashProductInterval` contract. The
product interval owns source range, terminal role, endpoint cap policy, join
ownership, and smooth continuity group metadata. The product builder
materializes body, cap, and join footprints once; descriptors are only one
renderer-ready encoding of that materialized product, not a separate visible
geometry route.

For constrained `inside`, the descriptor clips the materialized authored center
dashed body/cap/join product built at `stroke.width * 2` by the inside
filled-region mask. For constrained `outside`, the product starts from the same
`stroke.width * 2` authored center dashed body/cap/join construction and is
clipped by the outside legal domain, which is the exterior domain plus the
inside filled-region exclusion. The outside route must not add a second
per-segment selected-side clip after this legal-domain clip. If doubled-center
coverage from an adjacent source segment survives the inside-domain exclusion,
that survivor is legal outside product when it remains within the outside legal
domain and is still owned by its declared dash body, cap, or source-vertex join
route. Open dangling outside spans are explicit both-side source-span domains.
One-sided terminal cap suppression is expressed by endpoint cap policy plus
explicit cap/join footprints; no downstream renderer may infer endpoint caps
from stroke style or add caps that the product interval suppressed.

When constrained `outside` dash bodies are emitted through a stroke-path render
descriptor, the descriptor stroke path must be the centerline of the visible
outside band or another encoding proven equivalent to the canonical product
polygons. The exterior clip edge, outer ribbon edge, boundary-domain edge, or
carrier edge may be used as product evidence, but it must not be emitted as the
visible stroke path centerline. A descriptor that shifts the dash body away from
the source-adjacent outside band is an incorrect product descriptor, not a
renderer issue.

If a constrained dashed visible descriptor carries both `strokePathGroups` and
`descriptorProductPolygons`, the visible render entry must materialize the
stroke-path groups and treat descriptor product polygons, clip polygons, carrier
polygons, and boundary-domain polygons as clip/evidence only. Directly projecting
multi-fragment descriptor polygons as visible product is invalid when it creates
same-paint overdraw or opacity changes. Non-intersection dash body samples must
have one visible layer.

The descriptor builder must consume resolved self-intersection split/domain
metadata from the resolved geometry model. Explicit closed constrained source
domains may cover closed contour source spans that the resolved boundary domains
did not cover; they must not retrace the full path or rediscover source
intersections during render. Drag is only source data mutation: it invalidates
the affected source/domain/product cache and reruns this same product pipeline.

## Self-Intersecting Inside Solid

For grid/vector-network self-intersecting inside solid shapes, including the
reported five-point star:

- visible pixels must come from the doubled authored center stroke clipped by an
  inside filled-region mask;
- the inside mask must preserve face occupancy, winding rule, and filled-filled
  adjacency;
- a binary union of filled faces is insufficient when it widens internal shared
  edges or erases join-sensitive corners;
- each internal shared edge may reveal only half of the requested stroke width
  from each adjacent filled face, so the combined visible width along that edge
  matches the requested stroke width rather than two full-width contributions;
- all five internal pentagon corners must respond to `strokeJoin` and
  `miterAngle`;
- miter output must resolve through the authored miter angle;
- bevel output must cut the corner without cracks or overreach;
- round output must be smooth and bounded by the authored center-stroke
  envelope;
- outer authored vertices remain normal authored joins and must not be shaved by
  the inside mask.
- the internal pentagon must remain visually continuous, without fragmented
  helper-like strips, broken fixed-corner shapes, or disconnected slivers.

If a render shows independent full-width strips on both sides of an internal
edge, fixed corner shapes that ignore join style, or visible derivation
fragments, the Stroke Geometry / Product Output path is wrong and the final
Diagnostics review must fail. If a numeric probe passes while the app
screenshot still shows fragmentation, the test is insufficient and must be
tightened before any completion claim.

## Dashed Separation

Dashed constrained strokes are a separate interval-domain model:

- selected boundary intervals own dash placement;
- terminal half-dashes and caps are dashed-only behavior;
- dashed provenance must not be copied into solid product records;
- solid visible render must not borrow dashed boundary interval geometry.

For constrained `inside` dashed strokes, interval-domain ownership stops at
dash allocation. Visible product geometry must be built by the inside
legal-domain product route: each declared source span uses the authored
dash/gap interval allocation in source distance. When the declared source span is an
independent dash span, both span endpoints are half-length terminal dashes and
the interior dash/gap sequence is evenly distributed across the remaining source
distance while preserving `distributedGap >= configuredGap * 0.6`. The same
independent-span allocation rule applies to constrained `outside` dashed
strokes. Each visible interval is then materialized as an authored center dashed
stroke at `stroke.width * 2` with the authored cap, join, and miter angle before
clipping by the selected legal-domain mask. Legal clip boundaries are not dashed-line endpoints:
they do not receive synthetic half-dashes, endpoint caps, or redistributed
middle gaps, and they do not start a new independent dash span. Direct one-sided
ribbons, domain-plan derivation strips, and diagnostic derivation fragments are
not product-visible geometry for constrained dashed strokes.

Dash cap footprints are materialized before legal-domain clipping. Round and
square caps extend the painted footprint beyond the dash body endpoint, so
formal oracles and visual review must measure the actual cap footprint. The
allocator must not change dash/gap lengths, redistribute gaps, or collapse the
dash interval allocation only because cap footprints visually reduce a gap after painting.

### Inside Dashed Tiny-Domain Collapse

Dash interval allocation defines the authored dash/gap intervals, true open dashed-line
endpoint half-dashes, and independent-span half-terminal allocation. The
minimum separate allocation gap is `configuredGap * 0.6` measured in source
distance. For constrained split ranges where the legal domain cannot keep that
separate gap after cap footprint and legal-domain clipping, the affected source
span must collapse to a single `start-end` visible dash owned by the same
`DashProductInterval` provenance. Runtime repair code must not invent different
gap floors, collapse thresholds, or seam tolerances.

The collapsed product is still dashed product, not solid output. It must retain
`DashProductInterval` identity, source span id, terminal role, domain mode,
legal side, endpoint cap policy, join ownership, source/stroke/domain
signatures, and runtime revision metadata. Visual review must prove
dashed-collapse provenance instead of accepting continuous coverage as solid or
generic canonical geometry.

Terminal dash cap ownership is part of the product contract. In the following
paragraph, `endpoint` means a dash interval endpoint classified by
`endpointCapPolicy`, not necessarily an authored path/network endpoint.
`middle` intervals own authored caps on both body-side ends. `start` intervals
suppress the start endpoint only when that endpoint is join-owned and apply the
authored cap on the body-side end. `end` intervals apply the authored cap only
on the body-side start and suppress the end endpoint only when that endpoint is
join-owned. `start-end` intervals suppress both endpoints only when those
endpoints are join-owned. True open authored endpoints remain governed by the
true open endpoint route in the Cap And Terminal Terminology section. Static
render, drag render, product output entries, and hit/export materialization all
consume this same endpoint policy; no downstream square/round terminal helper
may re-add an endpoint-side cap after the owning route has suppressed it.

Join-owned source-vertex terminal bodies remain dash bodies, not ad-hoc join
patches. Their body geometry must be materialized from the owning
`DashProductInterval` on the authored source path and then clipped by the legal
domain. The product builder must not rebuild a source-vertex terminal half dash
from a temporary straight chord between the vertex and an inferred body point:
that chord can overrun the real half-dash footprint and create segment-direction
protrusions. With `capType: butt`, the visible source-vertex terminal body may
occupy only the half-dash body rectangle plus the authored join footprint.

High-angle source-vertex and self-intersection terminal regions use a visible
contributor whitelist. Visible coverage in that local region may come only from
the source-vertex join product and the incident terminal body products. The
source-vertex join is the exclusive visible owner of join-apex and legal-side
corner coverage. Incident terminal bodies own only their dash body plus any
body-side cap allowed by endpoint cap policy; they must not own apex, legal-side
join corner, or seam-continuity residue.

Butt terminal bodies remain strict endpoint products. A butt terminal body must
not overhang the terminal endpoint on the endpoint side and must not emit a
visible body-side cap to repair a source-vertex crack. When a suppressed butt
endpoint participates in a source-vertex join, it may provide construction-only
continuity evidence to the source-vertex join assembler, but that evidence is
not visible terminal geometry.

When a suppressed butt endpoint participates in a source-vertex join, the dash
body and the join must share the same Step 27 seam endpoint identity. The
assembler must not add a separate visible continuity zone, padding polygon, or
overlap polygon to make the seam appear watertight. Construction-only continuity
evidence may prove which Step 27 endpoint ids are legal, but visible output must
remain the authored resolved join footprint and must use those same endpoint
ids at the dash/join handoff. The resolved join identity must be preserved:
`miter` must not collapse to bevel, `round` must remain a join arc rather than a
cap disk, and `bevel` / `bevel-by-miter-angle` must remain the same cut-off
footprint that the doubled-center body/join product would produce before
legal-domain clipping. Formal oracles must distinguish terminal-owned endpoint
overhang from join-owned shared-endpoint contact and must fail any visible
dash/join seam gap at an authored sharp vertex.

The dash body and the source-vertex join must share the same source-domain seam
contract. Dash intervals provide the incident dash body seam boundary:
terminal point, body-side tangent, selected legal side, outer body boundary
vertices, body-side outline segment, and endpoint cap suppression state. The
source-vertex join assembler must consume that boundary and emit a seam-free
join product. In source space, the final visible source-vertex join footprint
must reuse the same Step 27 seam endpoint identities that terminate the
incident dash body products. For a dashed source-vertex seam, Step 27 is the
only source of legal seam identities: `outerBodyBoundaryEndpoint`,
terminal point, `bodySideOutlineSegment`, interval id, split range id, terminal
role, legal side, and cap suppression state. The terminal point and
`outerBodyBoundaryEndpoint` are the endpoint identities at the dash/join
handoff. `bodySideOutlineSegment` proves the side outline and tangent of the
same dash body product, but its far endpoint must not replace the terminal
point as the join seam endpoint. Each resolved join style must use the Step 27
endpoint identities required by that style. Resolved miter and round footprints
use the incident outer body boundary endpoints as their visible seam handoff
endpoints. Bevel-family footprints use the incident outer body boundary
endpoints as the cut-off chord and close the local product face to the incident
Step 27 terminal points when a polygonal face is required. No join footprint may
substitute the authored source vertex, a projected centerline point, a freshly
computed offset point, or a body-side outline endpoint for a required Step 27
seam endpoint. The GPU-visible triangles on both sides of the handoff must
therefore share Step 27 endpoint identities; a nearby coordinate, freshly
projected point, seam-repair endpoint, or downstream cleanup point is not
equivalent. A visible gap between a dash body and its authored-vertex join is a
product failure. The allowed source-space seam gap is zero; floating-point
epsilon is allowed only when comparing serialized coordinates that reference the
same Step 27 seam endpoint id.

A dash seam boundary is valid only when it is derived from the same pre-legality
dash body product that owns the incident visible dash coverage. Its
`outerBodyBoundaryEndpoint` must be a vertex on that dash body product boundary,
and its `bodySideOutlineSegment` must be an edge or edge-aligned subsegment of
that product boundary after endpoint cap policy has been applied and before
inside/outside legal-domain clipping. A planned centerline offset point,
projected source point, descriptor endpoint, seam-repair endpoint, or post-join
endpoint is not a seam boundary unless the Step 27 dash body product
also proves that the point lies on its emitted product polygon boundary with the
same interval id, split range id, terminal role, legal side, and cap suppression
state. Step 28 must not reinterpret or move this boundary to make a join fit;
if the seam boundary does not match the Step 27 dash body product boundary, the
failure reopens Step 27 before join materialization may proceed. A join may add
area inside its canonical footprint, but the added area must still be bounded by
the same Step 27 seam endpoint identities; it must not introduce a separate
padding endpoint, seam tolerance endpoint, or downstream repair endpoint.

For constrained inside/outside dashed joins, the canonical join envelope is
derived in the doubled-center stroke product before legal-domain clipping. The
incident dash body contributes its actual outer body boundary vertices and
outline segments at the join-owned terminal. A resolved `bevel` cuts off the
sharp extension by connecting those two incident outer body boundary endpoints
in the doubled-center product; after inside/outside legal-domain clipping, any
surviving coverage from either adjacent doubled-center segment remains legal
product when it is still owned by its dash body, cap, or source-vertex join
route. The bevel cut-off edge must therefore be seam-connected to both incident
dash bodies. It must not be replaced by an inward chord between smaller
selected-side offset points, and it must not be re-trimmed by a secondary
per-segment selected-side clip after legal-domain clipping.

For outside butt miter-family source vertices, non-emitted continuity evidence
may identify the incident Step 27 seam endpoints consumed by the resolved
source-vertex join footprint. It must not emit visible coverage, alter the
resolved join boundary, add padding endpoints, add overlap endpoints, cap a
resolved miter apex, or respond to observed raster holes or fixture coordinates.
The only visible seam closure is shared endpoint identity between the incident
dash body boundary and the canonical source-vertex join footprint.

Construction-only seam evidence may be generated, used as continuity evidence,
and influence the source-vertex join boundary derivation, but it must not emit
visible coverage and must not survive as an independent visible contributor. A
source-vertex join may consume non-emitted seam evidence, but every emitted
visible join polygon must be expressible as the authored join style and one
canonical resolved join footprint: `miter`, `bevel`, `round`,
`bevel-by-miter-angle`, or `degenerate-bevel`. The final visible polygon must
have `visibleContributor: source-vertex-join` and
`geometryBasis: canonical-join-footprint`; `geometryBasis` must not be any
construction seam basis. Construction-only seam evidence may appear only as
non-emitted continuity evidence. Reparenting construction seam coverage to
`source-vertex-join` without deriving a canonical join footprint is invalid.

### Asyra Join Resolution Details

`strokeJoin` is the authored style, not always the final visible join footprint.
The source-vertex join assembler must resolve the authored join before emitting
visible geometry:

- authored `miter` resolves to `miter` only when
  `vertexAngle - miterAngle > MITER_ANGLE_EPSILON_DEGREES`;
- authored `miter` resolves to `bevel-by-miter-angle` when
  `vertexAngle - miterAngle <= MITER_ANGLE_EPSILON_DEGREES`;
- authored `bevel` resolves to `bevel`;
- authored `round` resolves to `round`.

`degenerate-bevel` is the only degenerate local join footprint. It is allowed
only when source-domain normalization leaves a sharp authored vertex with
ill-conditioned incident join inputs: a zero-length incident source span, a
missing contour-visit tangent, or incident doubled-center join boundaries whose
seam-connected cut-off endpoints collapse within
`max(0.5 source units, stroke.width * 0.05)`. It is not a new geometry primitive
and not a repair path. Its visible footprint may only be the collapsed
bevel-equivalent cut-off footprint when both incident contour-visit tangents,
incident body boundaries, and source-domain angle evidence are complete. If a
contour-visit tangent is missing, if incident body boundaries are missing, or if
the collapsed cut-off footprint has zero area, the join product is emitted only
as non-visible metadata with `resolvedJoin: "degenerate-bevel"`,
`emitted: false`, `vertexAngle: null`,
`angleSource: "source-domain-degenerate"`, the degenerate reason, and the
source-domain evidence that proved the degenerate state.
`degenerate-bevel` must not be used for tangent-continuous curves,
high-curvature smooth spans, renderer holes, post-boolean cracks, or missing
dash/body coverage.

`bevel-by-miter-angle` is provenance for debugging, inspector flow, and formal
oracles. Its visible geometry is bevel-equivalent: it uses the same
seam-connected cut-off footprint as an authored bevel in the same product
family, and must not preserve an extra miter extension.
The stroke engine must not model a high-acute authored miter as a far clipped
miter extension. Near-threshold cases must use
`MITER_ANGLE_EPSILON_DEGREES = 0.000001` and must not emit both miter and
bevel-equivalent footprints.

When authored `miter` resolves to `miter`, the visible join apex is the
source-domain intersection of the two incident legal-side offset lines. It is
not capped by a local source-near window, endpoint cap policy, dash seam
padding, post-boolean cleanup, renderer miter limit, or visible footprint
inference. The only semantic way to avoid that miter extension is for the
source-domain comparison to resolve the authored miter to
`bevel-by-miter-angle`.

Miter resolution is source-domain semantic resolution, not visible-product
inference.

`vertexAngle` must be computed in the authored center-path domain before stroke
alignment masking, terminal body construction, join product clipping, or product
boolean cleanup. The only valid angle sources are:

- `AUTHORED_CENTER_PATH_INCIDENT_TANGENTS` for authored sharp source vertices;
- `CONTOUR_VISIT_INCIDENT_TANGENTS` for self-intersection split terminals.

For a sharp source vertex, `vertexAngle` is the smaller angle between the
reverse of the incoming tangent at the vertex and the outgoing tangent at the
vertex. For a self-intersection split terminal, each contour visit computes its
own angle from that visit's previous and next tangents; different visits at the
same geometric point may resolve independently. Smooth vertices that satisfy
tangent continuity are not sharp join-resolution cases and must not enter the
miter-angle threshold path.

Inside/outside stroke alignment, masked visible polygon angles, terminal body
angles, dash cap angles, join-assembler repair geometry, and post-boolean
product footprints must not be used as `vertexAngle` inputs. For inside and
outside constrained products, the legal-domain filter is applied after doubled
center-stroke body, cap, dash, and resolved join geometry has been produced.
Center products are authored center products and are not converted into
inside/outside masked products. The only permitted miter threshold tolerance is
`MITER_ANGLE_EPSILON_DEGREES = 0.000001`; it biases only the numeric comparison
proof toward `bevel-by-miter-angle` inside the epsilon band and must not
reinterpret the authored geometry or use visible output as an input.

`bevel-by-miter-angle` is a semantic provenance label over bevel-equivalent
geometry, not a new geometry owner or render primitive. The engine must preserve
both `authoredJoin: "miter"` and
`resolvedJoin: "bevel-by-miter-angle"` in product descriptors, debug metadata, and formal
oracle output. Product descriptors must also retain the source-domain evidence
needed to prove the resolution, including `vertexAngle`, `miterAngle`,
`angleSource`, and the angle comparison result. Join ownership and endpoint cap
policy consume `resolvedJoin`; diagnostics preserve both authored and resolved
join provenance.

Render, hit, and export layers may consume the bevel-equivalent footprint
directly, but they must not recompute miter-angle resolution. When metadata is
supported, render entries, hit/export records, and diagnostics must preserve the
authored/resolved join provenance. Geometry can collapse to a bevel-equivalent
footprint; provenance must not silently collapse to authored bevel.

Terminal cap ownership and join ownership are separate product contracts. When
a terminal belongs to a contour corner, authored vertex, or self-intersection
split with join ownership, the endpoint-side cap is suppressed but the corner is
still completed by the authored join (`miter`, `bevel`, or `round`). Visual
review must only run forbidden endpoint-cap probes on true dangling/open
endpoints. Contour and split terminals must instead verify the join footprint;
red pixels at those terminals are valid when they come from the join product.

### Dashed Authored-Vertex Ownership

Dash intervals provide incident body coverage. Source-vertex joins complete
authored corners. Endpoint caps close only true dangling/open interval
endpoints.

`DashProductInterval` owns dash/gap rhythm, source span, contour visit, terminal
role, and dash body coverage along the authored source span. It must not own an
authored vertex apex, legal-side corner completion, join arc, bevel corner,
miter apex, cross-vertex overhang, or duplicate visible paint. A middle dash
must not be emitted as multiple visible products. Source-domain aliases may
duplicate identity evidence and allocation provenance, but they must not
duplicate paint.

When dashed visible coverage reaches an authored sharp vertex, visible corner
completion is always owned by the source-vertex join product. Dash body and
terminal body products may provide incident body coverage up to vertex
adjacency, but they must not replace the join using endpoint caps, endpoint-side
overhangs, construction/helper geometry, duplicate interval products, or side-specific
repair geometry. A terminal body must not cross an authored sharp vertex as
visible paint.

The source-vertex join product owns the local corner footprint, including the
apex and legal-side corner completion. It uses `resolvedJoin`, not endpoint cap
policy:

- `miter` produces the miter join footprint;
- `bevel` produces the bevel join footprint;
- `bevel-by-miter-angle` produces a bevel-equivalent join footprint;
- `round` produces a legal-side join arc, not an endpoint cap disk.

Endpoint caps apply only to true dash interval endpoints on dangling or open
stroke ends. They must not be used to complete authored sharp vertices. If a
dash interval endpoint coincides with an authored sharp vertex, the
endpoint-side cap is suppressed and the interval contributes incident body
coverage to the source-vertex join. A dangling/open endpoint is a cap problem;
an authored vertex, contour vertex, or self-intersection contour visit is a join
problem.

A local corner region must have one visible owner class. Dash body may own
incident body coverage up to vertex adjacency, but it must not own the apex or
legal-side corner. Source-vertex join owns corner completion. Non-emitted
continuity evidence may inform canonical join/terminal assembly, but it must not
survive as an independent visible product. Ordinary terminal body, join-owned
terminal body, source-vertex join, endpoint cap, construction evidence, and
duplicate interval products must not all paint the same local corner.

Inside/outside stroke alignment is applied after doubled center-stroke dash,
cap, and join construction. Stroke alignment masking may clip products, but it
must not redefine dash ownership, create side-specific repair products, or allow
terminal body paint to cross an authored sharp vertex.

No authored sharp vertex may be visibly completed by endpoint caps, terminal
overhangs, construction/helper products, or duplicate interval paint.

### Miter-Angle Join Model Refactor Order

The miter-angle join model must be recovered through the inspector-flow-first
greenfield protocol above. Only tests mapped to the current spec and inspector
flow may drive this refactor, and old renderer-owned or fallback product routes
must not be kept to satisfy stale expectations.

The step-specific unit tests must define the positive contract for the active
inspector step. For join steps, that contract includes `authoredJoin: "miter"`,
`resolvedJoin: "miter"` or `resolvedJoin: "bevel-by-miter-angle"`,
bevel-equivalent visible geometry for `bevel-by-miter-angle`, source-domain
`vertexAngle` evidence, descriptor provenance preservation, and authored-vertex
completion by source-vertex join products instead of endpoint caps, terminal
overhangs, construction/helper products, duplicate interval paint, or
renderer-local joins.

After all 41 runtime inspector-step unit tests are verified, the refactor stops
at a unit-complete checkpoint. Integration tests, E2E, visual review, full
preset regression, performance, and cleanup remain future-phase work until the
user approves a separate test-plan refactor and the required geometry/product
semantics gates are meaningful. Post-runtime validation gates remain separate
from runtime implementation steps.

When the user approves runtime implementation after the unit-complete
checkpoint, runtime progress is tracked separately by
`stroke-flow-inspector.data.js` `runtimeImplementationState`. The 41 runtime
inspector-step unit statuses remain `verified`; runtime audit/refactor starts
from `runtimeImplementationState.activeStepId`, compares only that inspector
step's contract and allowed implementation boundary, runs that step's focused
gate, and then advances `runtimeImplementationState` to the next runtime step.
This runtime phase does not unlock full package regression, E2E, visual review,
performance, cleanup, or post-runtime validation gates.

`runtimeImplementationState.activeStepId` is a derived lock, not a manual
bookmark. `runtimeImplementationState.verifiedStepIds` must be the exact
contiguous runtime prefix beginning at step 1. The active runtime step must be
the first inspector step not present in that prefix. The protocol validator must
fail any missing prefix ledger, duplicate step id, gap, active step already in
the verified prefix, or jump to a later step. A runtime step can advance the
ledger by exactly one id only after its focused runtime gate passes.

### Stroke Test Architecture

Stroke tests are correctness gates only when they are mapped to the current
stroke engine spec and inspector flow. Each retained test must identify the spec
rule, inspector step or route, owner stage, expected artifact channel, and
accepted output shape it verifies. Tests that assert retired behavior, depend on
stale route helpers, or cannot be mapped to current ownership must be removed or
rewritten before they can remain in the stroke gate set.

Production code must not be changed solely to satisfy an unmapped or stale test.
If such a test exposes a real issue, first reproduce the issue with a current
spec/inspector-aligned unit, integration, formal geometry oracle, or app runtime
evidence test.

The stroke correctness gates are explicit package scripts:

- `yarn workspace @asyra/preset test:stroke-flow:unit` runs the test
  architecture guard, the inspector refactor protocol validator, and the 41
  runtime inspector step unit tests.
- `yarn workspace @asyra/preset test:stroke-flow:validation` runs
  post-runtime validation gate contract tests, including `visible-final-result`
  as a validation gate rather than a runtime implementation step.
- `yarn workspace @asyra/preset test:stroke-flow:integration` runs only new
  inspector-flow integration tests under
  `packages/preset/src/__tests__/stroke-flow-integration/`.
- `yarn workspace @asyra/preset test:stroke-geometry:oracle` runs only formal
  geometry/product oracle tests under
  `packages/preset/src/__tests__/stroke-geometry-oracles/`.
- `yarn workspace @asyra/preset test:stroke:regression` runs the new stroke
  regression coverage guard under
  `packages/preset/src/__tests__/stroke-regression/`. This gate verifies that
  regression responsibility is matrix-driven across step units, integration,
  formal geometry oracles, app runtime evidence, visual validation, full package
  regression, and drag/performance phases. Reported cases are regression
  samples inside that matrix; they must not become standalone implementation
  drivers.
- `yarn workspace @asyra/preset test:stroke:new` runs all stroke gates in
  order.

`yarn workspace @asyra/preset test:local` remains a full package regression gate
for a later phase. It must not be treated as the stroke refactor correctness
gate until the spec/inspector-aligned stroke gates pass. Step and oracle tests
must not import helpers or fixtures unless those helpers are themselves mapped to
current spec rules and inspector ownership. Product implementation must be driven
by this spec, the inspector flow, and the unit, validation, integration,
geometry-oracle, and regression coverage gates only.

Outside constrained dashed contour/source split terminal bodies are
terminal-interval owned product packets. Curved round and square terminal bodies
must keep their `join-owned-terminal-body` identity, `geometryId`,
`domainPlanTerminalRole`, `dashProductIntervals`,
`domainPlanSplitRangeTerminals`, endpoint cap policy, join ownership
signatures, smooth-continuity grouping, and runtime revision metadata through
product packet canonicalization. Same-paint union may merge ordinary coverage
only when it does not convert a terminal-owned product into a generic canonical
packet or drop terminal-interval provenance.

For outside dashed high-acute boundary-terminal-pair transitions, terminal body
continuity data may be used only as non-emitted seam evidence for canonical
source-vertex join assembly and terminal body clipping. It must not survive as
a visible helper polygon, source-path replay, substitute fill,
or independent terminal-body product. Visible coverage in the local transition
is limited to the incident terminal body dash products up to their seam
boundaries plus the source-vertex join product that shares the same Step 27
seam endpoint identities. No extra visible seam-repair product may be emitted
to make that seam watertight.

Dirty owner-stage incremental product assembly is allowed for constrained
dashed products. This is a canonical product assembly strategy, not a
render-only cache, preview shortcut, or drag-only approximation. Every
current-state frame still emits a legal canonical product graph. Reusable
descriptors may be retained only when their declared source-vertex,
source-segment, terminal-body, dash-interval, ownership-region,
shared seam endpoint identity, style-token, and local-topology dependencies do
not intersect the current dirty dependency set. Dirty assembly recomputes affected
source-vertex joins, terminal bodies, and dash intervals, then merges those
products with validated reusable descriptors through the same product contract
used for static render, drag render, hit/export, undo/redo, and ordinary data
changes.

Descriptor reuse must be dependency-version validated. Changes to visible
ownership, local topology, shared Step 27 seam endpoint identity, dash interval
identity, stroke alignment, stroke width, join style, cap style, dash/gap lengths,
or resolved join legality invalidate any dependent descriptor
before visible output. Incremental assembly must never reuse stale visible
descriptors, bypass product semantics through render-entry reuse, substitute
preview-only output, or perform geometry-specific repair. The strategy changes
which canonical product descriptors are recomputed, not what products are
legal.
For self-intersection split terminals, join ownership is first-class product
metadata rather than a downstream pairing guess. The materialized join consumes
the split terminal point, the previous and next contour directions, the resolved
legal side, the two owning intervals, and the authored `joinType` /
`miterAngle`. Resolved `miter` intersects the legal-side offset lines, resolved
`bevel` and `bevel-by-miter-angle` use the seam-connected cut-off footprint
between the two incident product-boundary endpoints, and resolved `round` draws
only the join arc between those incident product boundaries. A `round` join is
not an endpoint round cap disk, and `bevel` / `bevel-by-miter-angle` / `round`
are subject to the same legal-side direction rule as `miter`; none may be
replaced by an inward selected-side chord or by terminal-body/cap repair
geometry.

Curve dash smoothness is a top-level stroke rule. A dash rendered on a Bezier or
high-curvature span must remain a continuous smooth product footprint. The
pipeline may sample curves internally, but final visible output must not expose
sampling seams, radial slices, disconnected strips, or comb-like gaps inside one
dash. Tests and app visual review must treat this as a product rule, not a
diagnostic detail.

High curvature is not a join trigger by itself. A curved or high-curvature
source span with tangent continuity remains a smooth-continuity dash product,
not a source-vertex join product. The stroke engine may create source-vertex
join products only at authored sharp vertices or self-intersection contour
visits that fail tangent-continuity and own join completion. Smooth-continuity
dash products must keep one continuous smooth footprint and must not be split
into join-like strip products, visible seam-repair products, helper products,
or source-vertex join ownership.

Open path dashed allocation is source-distance based. Its unbounded open center
product domain is the continuous open network rather than a constrained split
range. Open self-intersecting networks with bounded filled regions formed by
real authored source segments are constrained-domain products for dashed
`inside` / `outside`, so their visible output is contour-ownership driven:
`inside` excludes dangling open branches, while `outside` preserves open
endpoint/cap semantics for those branches. For those constrained products, dash
allocation is not the continuous open-network allocation used by simple open
`center` strokes. Each inspector-declared independent constrained source span
has a declared source-distance allocation origin, but legal-domain clipping inside
that span does not create new half-dash terminals, new endpoint caps, or
redistributed gaps.

## Stroke Product Detail Contracts

### Constrained Dashed Width And Product Construction

All constrained dashed `inside` / `outside` products use one width model:

1. Resolve the formal domain mode and source split ranges from
   `StrokeDomainPlan`.
2. Allocate `DashProductInterval` records on the authored source centerline for
   each independent constrained source span.
3. Materialize each visible interval as an authored center dashed stroke at
   `stroke.width * 2`, with the authored cap, join, and miter angle applied in
   that doubled-width center-stroke space.
4. Apply endpoint cap policy and join ownership before domain clipping.
5. Clip the product to the resolved legal domain: inside filled region for
   `inside`, outside legal domain for `outside`, or both source sides for
   `open-dangling-outside-both-sides`. The outside legal domain is the exterior
   domain plus inside filled-region exclusion. It is not followed by a second
   per-segment selected-side trim.

After clipping, an ordinary constrained inside dash body and a clean
single-segment outside dash body commonly expose a normal span equal to
authored `stroke.width` within width tolerance because the opposite half of the
doubled center product has been removed by the legal-domain clip. That observed
span is not a separate clipping requirement. When an outside dashed product
crosses another segment, any doubled-center coverage that survives the inside
filled-region exclusion remains legal product if it stays inside the outside
legal domain and preserves the declared product owner. An open-dangling outside
both-side span must expose a combined normal span equal to `stroke.width * 2`
within width tolerance because both legal sides of that dangling authored source
span are visible. A full-width one-sided dash translated away from the
centerline is never a valid constrained dashed visible product.

### Outside Dashed Legal Compressed Overlap

Constrained `outside dashed` products may have legal compressed overlap. This
occurs when multiple legal outside dash footprints are clipped into the same
small exterior legal-domain region and overlap in a local source-space probe
region. The overlap is valid when every visible contributor satisfies all of
these conditions:

- its pre-clip interval is a valid `DashProductInterval`;
- its post-clip coverage remains in the exterior/outside legal domain;
- contour visit, split range, legal side, terminal role, endpoint cap policy,
  join ownership, and interval provenance are preserved;
- terminal-interval owned body products may be legal contributors only while
  they remain dash body products, stop at their declared seam boundary, and
  preserve the same provenance; helper closure, construction-only seam evidence,
  or source-path replay is not a legal compressed-overlap contributor;
- the output channel is visible product output, not diagnostics, derivation, hit,
  export, or overlay-only evidence;
- transparent strokes are composited once, or by an equivalent method that does
  not darken the overlap through repeated same-paint draws.

Legal compressed overlap does not require an area or dash/gap-size threshold. It
is determined by provenance, legal side, output channel, and alpha behavior. The
visible result may look merged. That merged-looking coverage is not a geometry
failure by itself.

Visual review must not mark legal compressed overlap as
`unexpected_visible_contributor`, `double_alpha_overdraw`, or
`unexpected_union_or_collapse` merely because multiple legal outside intervals
cover the same local region. It must still fail wrong-side coverage,
inside-domain leaks, cap or join footprint mismatches, lost interval provenance,
diagnostic/helper output leaks, and actual double-alpha darkening.

### Alpha-Safe Descriptor Projection

`alpha-safe` is a projection proof, not a geometry owner. It is true only when
the render backend draws the already-declared product-visible descriptor as one
semantic product layer for the current paint and blend context, so every final
product sample has the same color and alpha as the canonical product packets.

A descriptor route may claim `alpha-safe` only when its evidence records all of:

- the visible descriptor id and the product artifact id it encodes;
- paint alpha and blend mode;
- whether the descriptor can self-overlap or overlap another same-paint visible
  contributor;
- the single-composite strategy, or an equivalent backend guarantee that
  overlapping same-paint samples do not accumulate extra alpha;
- local same-paint overlap probes for self-intersecting or overlapping products.

The projection is not alpha-safe when descriptor decomposition, repeated child
path draws, direct projection of overlapping evidence polygons, or carrier
polygons can darken translucent paint or alter same-paint color/alpha. In that
case visible render must use a single-composite descriptor or canonical product
packets. Opaque same-paint pixels do not excuse wrong owner metadata: local
contributor and ownership oracles still apply even when the final color is
unchanged.

The `DashProductInterval` contract is:

- `sourceRange`: authored source centerline span with stable source segment and
  curve provenance.
- `dashRange`: dash/gap arc-length interval in source coordinates.
- `domainMode`: `center-product`, `closed-constrained-domain`,
  `open-contour-constrained-domain`, `open-dangling-outside-both-sides`, or
  `inside-excluded-open-span`.
- `terminalRole`: `middle`, `start`, `end`, `start-end`, or `none`.
- `endpointCapPolicy`: which endpoint-side caps are suppressed and which
  body-side caps remain authored.
- `joinOwnership`: no join, authored source-vertex join, contour split join, or
  self-intersection split join.
- `legalSide`: the resolved side/domain that may own visible pixels.
- `smoothContinuityGroup`: the curve/span continuity group for one continuous
  visible dash footprint.
- `geometryId`, source revision, stroke signature, domain signature, split
  range id, and runtime revision metadata.
- `seamBoundaryArtifacts`: emitted only for join-owned terminals and derived
  from the actual pre-legality dash body product boundary. Each artifact records
  the interval id, split range id, terminal role, legal side, endpoint cap
  policy, `outerBodyBoundaryEndpoint`, `bodySideOutlineSegment`, and a proof
  that those points are on the same dash body product polygon boundary before
  legality clipping.

Outside dashed `StrokeDomainPlan` canonicalization must collapse duplicate
source-side split ranges into one canonical materializable domain interval when
they share the same source range, legal side, terminal role, join ownership,
paint owner, and materialization identity. Any removed split-range id must be
preserved only as an allocation alias or provenance id on that canonical
counterpart. Allocation aliases are not product owners: they may be used by
terminal allocation, self-intersection ownership, debug metadata, and dirty
dependency lookup, but they must not independently emit dash body, terminal
body, join product, source-domain product packets, render entries, hit/export
packets, or visible descriptors. Duplicate same-paint source-domain
materialization must be eliminated before product packet materialization, not by
render projection, opacity collapse, or renderer-side merge.

The product builder must emit body, cap, and join geometry from those records
once. Render descriptors, hit/export packets, and diagnostics are projections of
that product, not alternate construction routes.

### Domain Mode And Legal Side Resolution

Domain classification is owned by `StrokeDomainPlan`:

- `center-product`: center solid/dashed strokes, plus authored open
  `inside` / `outside` dashed strokes when the real authored open network forms
  no bounded filled-region domain.
- `closed-constrained-domain`: closed authored networks with inside/outside
  filled or exterior domains.
- `open-contour-constrained-domain`: open self-intersecting networks whose real
  authored source segments form one or more bounded filled-region domains.
- `inside-excluded-open-span`: dangling or non-contour open spans that do not
  participate in a filled contour for `inside`.
- `open-dangling-outside-both-sides`: dangling open spans that remain visible
  for `outside` on both sides of the authored source path.

Only real authored source segments may create domains. Near-closed endpoints,
preview chords, inferred links, and visual helper lines must not become closing
edges for domain, dash, hit-test, export, or product output. Self-touching or
near-zero loops create a bounded domain only when the planar arrangement has a
non-zero even-odd filled face bounded by real authored segments.

Legal side resolution uses the current source revision and the resolved
arrangement:

- For `inside`, the legal side is the side whose infinitesimal offset lies in
  the even-odd filled region owned by the same contour visit.
- For `outside`, the legal side is the exterior side owned by the same contour
  visit.
- For authored vertices and contour split terminals, legal side is resolved
  from the previous and next contour directions for that same contour visit.
- For self-intersection split terminals, each contour visit owns a separate
  terminal record carrying terminal point, previous direction, next direction,
  owning intervals, selected side, `joinType`, and `miterAngle`.
- For `open-dangling-outside-both-sides`, both normal sides are legal for the
  dangling source span, while the true open endpoints still use dangling
  endpoint cap policy.
- For `inside-excluded-open-span`, no visible legal side exists.

If a zero-length source segment, zero-area domain, or ambiguous contour visit
cannot resolve a legal side, the product must drop that visible product and
emit diagnostics; it must not guess a side from screen-space proximity or from
surviving clipped area.

### Tiny Sliver Domain Layering

A non-zero-area, non-ambiguous, numerically stable sliver domain is a legal
product domain even when it is visually tiny. Small visual size alone must not
drop visible output and must not change stroke product semantics. Tiny domain
handling is layered:

1. Semantic/topology layer: determine whether the domain exists, is bounded by
   real authored source segments, has resolvable contour visits and legal sides,
   and is numerically stable. Only zero-area, ambiguous, or numerically unstable
   domains may drop visible output and emit diagnostics.
2. Product/allocation layer: render every legal stable domain through the normal
   product contract. Solid inside/outside uses the doubled authored center stroke
   clipped by the legal domain. Inside dashed remains clipped dashed product
   with interval provenance even when a tiny legal domain leaves a visually
   continuous sliver. Outside dashed may use legal compressed overlap. Normal
   dashed ranges use source-distance dash allocation before legal clipping.
3. Visual/raster layer: visual visibility thresholds may affect screenshot
   sampling, overlay markers, and reviewer notes only. They must not remove
   product packets, change visible product semantics, or drop hit/export/
   diagnostics provenance.

`numericalStabilityEpsilon` belongs only to the semantic/topology layer. It may
decide that a domain cannot be classified reliably. `visualVisibilityEpsilon`
belongs only to visual/raster review. It may label a legal product as
below-visibility-threshold or hard-to-sample, but it cannot suppress product
output.

### Asyra Stroke Construction Baseline

The stroke engine computes the visible product before renderer projection.
Center strokes are authored center products or exact center descriptors.
Constrained solid strokes are built as doubled authored center-stroke products
before inside/outside legality clipping. Constrained dashed strokes build
DashProductInterval body products, terminal body products, source-vertex join
products, and smooth-continuity products from the same domain plan before
descriptor or render-entry encoding.

Inside and outside masks are legal-domain filters over declared products. They
may clip or exclude product geometry, but they must not create the join shape,
cap shape, terminal body, dash body, descriptor path, or renderer-visible
repair. Open dangling outside spans are explicit both-side source-span domains;
no invisible closing edge may become product evidence.

### Reference-Calibrated Stroke Parameter Contract

Stroke position, join, cap, dash, and miter parameters are source-domain product
inputs, not renderer repair hints.

- Center position places the authored stroke width around the authored center
  path. Inside and outside positions are modeled as a doubled center-stroke
  product clipped by the relevant legal domain. The mask selects legal output;
  it does not define join shape, cap shape, dash ownership, or terminal body
  ownership.
- Stroke joins apply only at authored sharp vertices and contour-visit
  terminals where source-domain tangent continuity fails. Smooth and
  tangent-continuous curved spans stay smooth-continuity products regardless of
  visual curvature.
- Stroke caps apply only to true open endpoints or body-side dash interval
  endpoints allowed by endpoint cap policy. Endpoint-side caps are suppressed
  when a terminal is join-owned, and a cap never substitutes for an authored
  source-vertex join.
- Dash patterns allocate intervals along the authored source path or declared
  constrained source span. Segment boundaries do not reset dash allocation state unless
  the stroke-domain plan declares a new independent constrained span. Cap-aware
  dash gaps are evaluated against the visible footprint after body-side caps.
- `miterAngle` is the source-domain semantic threshold for authored miter
  resolution. `rendererMiterLimit` is only renderer descriptor style output when
  a descriptor route is already legal; it must not be used to infer source
  joins, clipped-product angles, or post-boolean repair.

### Stroke Parameter Normalization Contract

`normalizeStrokeSpec` owns stroke-parameter normalization and emits a
`RenderableStroke` record. Downstream geometry builders must consume that
normalized record and must not read raw UI/computed stroke fields except when an
inspector step explicitly owns the conversion.

Normalization inputs and outputs:

| Input field | Normalized output | Failure handling |
| --- | --- | --- |
| Stroke id | Stable `strokeId` | Missing id rejects the stroke before product planning |
| Owner element id | Stable `ownerElementId` | Missing owner rejects the stroke before product planning |
| Width | Finite width; authored/schema input accepts `width >= 0`, and render normalization emits visible stroke output only for `width > 0` | Non-finite values emit `invalid-width` diagnostics. Finite `width <= 0` produces an empty product with no diagnostic; negative values that bypass load-boundary validation must fail closed without visible geometry |
| Position | `center`, `inside`, or `outside` | Unknown position rejects geometry output and emits diagnostics |
| Join | `miter`, `bevel`, or `round` | Unknown join rejects geometry output and emits diagnostics |
| Cap | `butt`, `round`, or `square` | Unknown cap rejects geometry output and emits diagnostics |
| Miter threshold | Finite `miterAngle` in degrees | Missing/invalid values use `DEFAULT_MITER_ANGLE_DEGREES = 28.96`, declared by this spec and the load-boundary schema validator, not by product builders |
| Dash/gap lengths | Positive authored dash length and positive authored gap length | Empty/invalid dash or gap length resolves to non-dashed output through the normalization rule |
| Paint | `FillAttrs` paint payload with `visible` flag | Invisible paint may use hidden-output bypass; it must not build visible geometry |

Normalization must preserve provenance. A rejected or defaulted field records
the raw value, normalized value, owner step, and diagnostic reason. Geometry
builders may not silently substitute `bevel` for invalid `miter`, substitute
`round` caps for invalid caps, flatten dashes into solid output, or invent a
descriptor field to keep rendering alive.

Stroke spec rejection diagnostics record rejected or failed inputs only. They do
not record no-visible-output state. A `width: 0` stroke is a legal empty render
product. Render normalization treats any finite `width <= 0` as empty render
output with no rejection diagnostic, so negative width values that bypass
load-boundary validation fail closed without visible geometry. A non-finite
width is invalid data and emits `invalid-width`.

The current miter threshold default is `28.96` degrees. That value is part of
the stroke semantic contract. UI defaults, computed-data defaults, fixture
builders, normalization helpers, descriptor adapters, and formal oracles must
all resolve a missing `miterAngle` to this value unless a future spec revision
changes the default. Product builders may consume the normalized value only; they
must not declare a local fallback.

### Stroke Parameter Step Coverage Contract

Every inspector step must classify every supported stroke parameter before
runtime implementation can use that step as an execution boundary. The
machine-readable matrix lives in
`stroke-flow-inspector.data.js` as `strokeParameterCoverageMatrix`; this spec
defines the parameter set and role semantics.

The supported stroke parameter ids are:

- `stroke.fill.visible`
- `stroke.fill.kind`
- `stroke.fill.color`
- `stroke.fill.opacity`
- `stroke.fill.gradient`
- `stroke.fill.colorFormat`
- `stroke.fill.defaultColorFormat`
- `stroke.style`
- `stroke.position`
- `stroke.width`
- `stroke.dash`
- `stroke.gap`
- `stroke.capType`
- `stroke.joinType`
- `stroke.miterAngle`

Coverage roles are exact:

| Role | Meaning |
| --- | --- |
| `consume` | The step may read the normalized parameter and use it to produce that step's declared output. |
| `preserve` | The step carries the value or provenance through without using it to decide new semantics. |
| `forbid` | The step must not read the parameter as an input for semantics, geometry, cache, render, hit, export, or diagnostics decisions. |
| `dirty-key` | The step may use the parameter only to classify dirty revisions or no-op display metadata changes. |
| `cache-key` | The step may use the parameter only to validate cache reuse or cache invalidation signatures. |
| `output-metadata` | The step may emit the parameter, normalized value, or provenance as evidence or channel metadata, but not as a new semantic decision. |
| `not-applicable` | The parameter is outside the step's declared input/output boundary. This role cannot be combined with any active role. |

The coverage matrix is a required implementation gate, not documentation
decoration. A step unit test must assert only the parameters classified for that
step. A step that needs a parameter not listed as `consume`, `dirty-key`, or
`cache-key` must stop and reopen this spec and the inspector flow before
implementation. A renderer or diagnostics step that needs to display metadata
may use `preserve` or `output-metadata`, but it must not reinterpret stroke
parameters as product geometry.

### Stroke Field Mapping

Stroke fields have explicit layers. A field from one layer must not be treated as
the source of truth for another layer.

| Layer | Field | Meaning | May decide geometry? |
| --- | --- | --- | --- |
| UI / computed stroke input | `joinType` / `strokeJoin` | Authored join selection before normalization | No; it is normalized first |
| UI / computed stroke input | `capType` / `strokeCap` | Authored cap selection before normalization | No; it is normalized first |
| UI / computed stroke input | `miterAngle` | Authored miter threshold in degrees | Only after normalization |
| Normalized renderable stroke | `join` | Authored join enum consumed by product planning | Yes, as authored input |
| Normalized renderable stroke | `cap` | Authored cap enum consumed by endpoint/body-side cap planning | Yes, only for cap products |
| Normalized renderable stroke | `miterAngle` | Source-domain miter threshold in degrees | Yes, only for source-domain join resolution |
| Product/debug metadata | `authoredJoin` | Preserved authored join provenance | No; it records the authored input |
| Product/debug metadata | `resolvedJoin` | Resolved join after source-domain comparison | Yes, as the emitted join footprint class |
| Product/debug metadata | `vertexAngle` / `angleSource` | Source-domain comparison evidence | No visible geometry by itself; it proves resolution |
| Descriptor adapter | `rendererMiterLimit` | Backend style value derived from normalized `miterAngle` | No; it is adapter output only |
| Descriptor adapter | `strokePathStyle.join` / `strokePathStyle.cap` | Renderer style replay for legal descriptor routes | No semantic repair; it may only draw a declared legal descriptor |

`strokeJoin`, `strokeCap`, `joinType`, and `capType` may appear in persisted data
or descriptor terminology, but the semantic owner is the normalized stroke
record plus product metadata. `rendererMiterLimit` is never a synonym for
`miterAngle`, and `strokePathStyle.join` is never a license for the renderer to
complete an authored sharp vertex.

### Cap And Terminal Terminology

Caps and joins are different product primitives. A cap closes or extends one
true open endpoint or one allowed body-side dash interval terminal. A join
completes an authored source vertex or contour-visit terminal with two incident
source-domain tangents. A cap cannot own source-vertex apex pixels, cannot close
a contour/source split, cannot bridge a dash/body gap to a join, and cannot
repair a missing join.

Terminal terms are:

| Term | Definition | Cap eligibility | Join eligibility |
| --- | --- | --- | --- |
| True open endpoint | Authored path/network endpoint with one incident source tangent | Authored cap allowed | No join unless another contour visit provides a second incident tangent |
| Body-side dash endpoint | Dash interval endpoint that borders a visible dash gap inside a declared source span | Authored cap allowed by `endpointCapPolicy` | No join; it is not a source vertex |
| Join-owned terminal | Split, dash, or contour terminal located at an authored sharp vertex or contour visit with two incident tangents | Endpoint-side cap suppressed | Authored join required when incident visible coverage reaches the terminal |
| Contour-visit terminal | A visit of a contour at a source vertex or self-intersection that owns a legal side/domain | Endpoint-side cap suppressed unless it is also a true open endpoint | Legal-side authored join required for sharp visits |
| Smooth-continuity terminal | Boundary between samples that are tangent-continuous through a curve or smooth anchor | Cap suppressed inside the continuity span | No sharp join; smooth-continuity product owns the footprint |

A true open endpoint is an authored path/network endpoint and is allowed to emit
the authored endpoint cap. A true open endpoint must not be reclassified as a
join-owned terminal merely because a dash interval touching it has a `start`,
`end`, or `start-end` interval role. Endpoint-side cap suppression applies only
to join-owned terminals, contour/source split terminals, self-intersection split
terminals, and smooth-continuity interior boundaries.

Dash interval roles are interval roles, not source-vertex classes:

- `middle`: both interval ends are body-side dash endpoints.
- `start`: the source-facing start is endpoint-side and suppressed when it is
  join-owned; the other end is a body-side endpoint.
- `end`: the body-side start may cap; the source-facing end is endpoint-side
  and suppressed when it is join-owned.
- `start-end`: both ends are endpoint-side for that interval and both are
  suppressed when the interval is join-owned. For a true open network endpoint,
  the authored endpoint cap is still owned by the true endpoint route, not by a
  source-vertex join route.

A `round` cap is a half-circle endpoint/body-side cap. A `round` join is a
source-vertex arc between the same incident product boundaries that would be
used by the resolved bevel cut-off for that product family. They may have
similar curvature, but their owner stage, inputs, tangent domain, and metadata
are different. Any visible source-vertex corner completed by a round endpoint
cap is invalid product output.

### Miter Terminology And Descriptor Adapter Fields

`miterAngle` is the semantic miter threshold used by source-domain join
resolution. `vertexAngle` is the measured authored center-path or contour-visit
angle. `angleSource` names the source vertex or contour visit and the previous
and next tangents used for the measurement. Runtime floating-point comparison
uses `MITER_ANGLE_EPSILON_DEGREES = 0.000001` degrees as a deterministic proof
guard. Let `delta = vertexAngle - miterAngle`. The comparison rule is:

- `authoredJoin: "miter"` and `delta > MITER_ANGLE_EPSILON_DEGREES` resolves to
  `resolvedJoin: "miter"`.
- `authoredJoin: "miter"` and `delta <= MITER_ANGLE_EPSILON_DEGREES` resolves
  to `resolvedJoin: "bevel-by-miter-angle"`.

The exact equality case is bevel-equivalent. The epsilon guard must be recorded
in comparison evidence as `miterAngleEpsilonDegrees` and cannot flip a stable
non-boundary angle. It may prevent a near-threshold numeric artifact from
emitting a miter, but it must never turn `vertexAngle <= miterAngle` into
`resolvedJoin: "miter"`.

`rendererMiterLimit` is a descriptor-adapter value for render backends that
require a miter-limit style field. It is derived after semantic join resolution
and after descriptor legality is known. It is never a product input, never an
angle source, never a reason to keep a far miter spike, and never allowed to
collapse `authoredJoin: "miter"` / `resolvedJoin: "bevel-by-miter-angle"` into
authored bevel metadata.

Backend offset helper options may also carry `miterLimit` for APIs that require
one on every offset call. This field has geometric meaning only when the helper
offset `join` is `miter`. For non-miter helper joins such as `round` or
bevel-style joins, including backend square joins, the field is an API
placeholder: it does not participate in authored stroke miter resolution, does
not become a product input or angle source, and does not decide join collapse.

Every product, render entry, hit/export packet, and diagnostic snapshot that
describes a miter-family source-vertex join must preserve:

- `authoredJoin`
- `resolvedJoin`
- `vertexAngle`
- `miterAngle`
- `angleSource`
- previous and next source tangents
- comparison operator and threshold evidence
- `miterAngleEpsilonDegrees`
- final visible footprint basis
- descriptor adapter fields, if any, as adapter fields only

### Asyra Join Resolution Baseline

A source-vertex join is a product owned by the stroke engine. It is computed
from the authored source vertex or contour-visit terminal, previous and next
source-domain tangents, stroke width, legal side, authored join style, miter
angle, cap policy, and owner id. Renderer stroke joins, endpoint caps, terminal
bodies, post-boolean footprints, helper polygons, and masked visible polygon
angles are not join sources.

Join resolution is:

| Authored join | Source-domain comparison | Resolved join | Visible footprint |
| --- | --- | --- | --- |
| `miter` | `vertexAngle - miterAngle > MITER_ANGLE_EPSILON_DEGREES` | `miter` | legal-side offset-line intersection |
| `miter` | `vertexAngle - miterAngle <= MITER_ANGLE_EPSILON_DEGREES` | `bevel-by-miter-angle` | same seam-connected cut-off footprint as authored bevel, while preserving authored miter provenance |
| `bevel` | No miter-angle comparison | `bevel` | seam-connected cut-off footprint between the two incident product-boundary endpoints |
| `round` | No miter-angle comparison | `round` | local source-vertex arc between the two incident product boundaries |

`bevel-by-miter-angle` is semantic provenance for authored miter resolution. It
is not an authored bevel, not a new primitive, and not a renderer fallback.
Product descriptors, debug metadata, diagnostics, and oracles preserve
`authoredJoin`, `resolvedJoin`, `vertexAngle`, `miterAngle`, `angleSource`, and
comparison evidence.

### Source-Domain Angle Evidence

`vertexAngle` is calculated only in the authored center path or contour-visit
tangent domain before masking, clipping, dash caps, terminal body construction,
join repair, boolean cleanup, or renderer projection. The angle evidence must
name the previous tangent, next tangent, contour visit or source vertex id,
legal side, miter angle, comparison result, and deterministic threshold
tolerance. A masked visible polygon angle, clipped legal-side angle, endpoint
cap angle, terminal-body footprint angle, repaired join angle, or
post-boolean footprint angle is invalid evidence.

### Dash Body And Join Seam Contract

Dash intervals provide incident body coverage and seam boundaries. The
dash-body-to-source-vertex-join handoff is a deterministic Asyra product rule,
not an implementation preference. Source-vertex joins consume the incident seam
boundaries and emit a seam-free local join product that reuses the same Step 27
seam endpoint identities on both incident dash body seams. Tests, visual
probes, and runtime repair code must not invent seam tolerances, padding
endpoints, or downstream cleanup endpoints. A visible gap between a dash body
and the owning source-vertex join is a product failure, not a renderer issue.

Terminal bodies stop at their declared seam boundaries. Endpoint-side caps are
suppressed at join-owned terminals. Body-side caps remain only when the endpoint
cap policy allows them, and no cap may substitute for authored source-vertex
join ownership.

### Computation Ownership And Timing Contract

Every stroke semantic value has exactly one owner stage. A downstream stage may
consume an upstream artifact, but it must not recompute, reinterpret, repair, or
move that value unless the inspector route explicitly reopens the owner stage
that owns the value.

The required computation ownership is:

| Value or artifact | Computed at | Consumed by | Must not be recomputed after |
| --- | --- | --- | --- |
| Dash allocation source-distance intervals, terminal roles, independent source-span endpoint half-dash classification, independent-span gap distribution, and `configuredGap * 0.6` evidence | `allocate-dash-intervals` | product-family selection, dash body assembly, terminal body assembly, source-vertex join assembly, and diagnostics | `build-dash-interval-body-products` |
| Dash body visible footprint and endpoint cap suppression state | `build-dash-interval-body-products` | source-vertex join, terminal body, legality, final faces, render entries | `build-source-vertex-join-products` |
| Dash body seam boundary, including terminal point, outer body boundary endpoint, body-side outline segment, body-side tangent, selected legal side, endpoint cap suppression state, interval id, split range id, and source segment index | `build-dash-interval-body-products` | source-vertex join and terminal body assembly | `build-source-vertex-join-products` |
| Source-domain `vertexAngle`, miter comparison, and resolved join | `build-source-vertex-join-products` | legality, final faces, descriptors, render entries, hit/export, diagnostics | `apply-legality` |
| Bevel / bevel-by-miter-angle cut-off edge between incident dash body outer boundary endpoints | `build-source-vertex-join-products` | legality, final faces, render entries | `apply-legality` |
| Terminal body footprint and allowed body-side cap | `build-terminal-body-products` | legality, final faces, render entries | `apply-legality` |
| Smooth-continuity dash footprint | `build-smooth-continuity-products` | legality, final faces, render entries | `apply-legality` |
| Descriptor eligibility and legality basis | `select-stroke-descriptor-strategy` | descriptor materialization | `apply-legality` for eligibility; `materialize-stroke-product-descriptors` for renderer-ready descriptors |
| Same-paint single-composite or equivalent alpha-safe render-entry evidence | `render-entries` | renderer projection and diagnostics | `renderer-projection` |

These timing rules prevent five failure classes:

- duplicate calculation: a later stage recalculates dash endpoints, seam
  boundary points, bevel cut-off endpoints, or miter resolution instead of
  consuming the upstream artifact;
- over-calculation: a stage builds product geometry that belongs to a different
  owner stage, such as a terminal body building source-vertex corner coverage;
- under-calculation: an owner stage emits product geometry without the evidence
  required by downstream stages, such as a dash body without a seam boundary
  artifact;
- early calculation: a stage decides a value before required upstream evidence
  exists, such as resolving a join before Step 27 proves the incident dash body
  outer boundary endpoints;
- late calculation: a downstream stage makes geometry or alpha-composition
  decisions after the owner stage has closed, such as renderer projection
  deciding join shape or same-paint overlap semantics.

Stage cache keys and descriptor reuse signatures must include the exact upstream
artifacts consumed by the stage: source revision, topology/domain signature,
dash allocation signature, dash body seam boundary signature, terminal cap
signature, join/miter signature, legal-side signature, descriptor-mode
signature, paint signature, and output-channel signature where applicable.
Memoization is valid only as transparent reuse of the same declared artifacts; it
must not supply missing artifacts, skip required owner-stage evidence, or reuse a
descriptor whose dependency signature intersects the current dirty dependency
set.

### Smooth Curvature Non-Join Contract

High curvature is not a join trigger. Tangent-continuous curved spans and smooth
anchors remain smooth-continuity products even when their curvature is visually
high. A visible dash on one smooth-continuity span must be one continuous
footprint; disconnected strips, radial slices, comb-like seams, or helper
visible geometry inside one dash are product failures. Sharp source-vertex join
ownership begins only when source-domain tangent continuity fails at an authored
vertex or contour-visit terminal.

### Product Legality And Descriptor Encoding

Product assembly may produce `preLegalityProductUnits`. Descriptor strategy may
be selected before legality only as eligibility metadata: descriptor mode,
required legal basis, owner boundaries, and channel intent. Renderer-ready
descriptor materialization happens after final-face legality records exist and
may consume only `postLegalityProductUnits`, `finalFaces`, or product units
carrying explicit legality-equivalence evidence. A descriptor is a renderer-ready
encoding of an already declared product. It must carry product builder id,
source revision, stroke signature, domain signature, dash interval ids, terminal
roles, endpoint cap policy, join ownership, legal side, smooth-continuity group,
descriptor mode, output channel, and visible/evidence channel separation.
Descriptor evidence polygons, carrier polygons, boundary-domain edges, and
clip/exclude polygons must not become visible fill, stroke masks, or
renderer-owned repair geometry.

### Output Channel Separation

`finalFaces`, `renderEntries`, `hitExportPackets`, and `diagnosticSnapshots`
are sibling channel products over the same semantic stroke records. Renderer
projection consumes declared render entries and emits visible pixels only.
Hit/export consumes final-face channel packets and explicit hit/export evidence;
it must not depend on renderer projection. Diagnostics may aggregate render
projection metadata and hit/export evidence, but diagnostics are never render,
hit, export, or product source of truth.

### Local Composition, Caps, And Joins

At every local source vertex, contour split, or self-intersection split, visible
pixels must be explainable by the allowed local contributors:

| Local case | Allowed visible contributors |
| --- | --- |
| Solid authored vertex | Previous solid body, one authored join, next solid body |
| Center dashed true open endpoint | The owning terminal dash body plus the true endpoint authored cap route |
| Center dashed authored vertex with visible adjacent intervals | Adjacent dash bodies plus the authored source-vertex join when the dash product reaches the vertex |
| Constrained contour/source split terminal | Previous terminal dash body, one legal-side authored join, next terminal dash body |
| Self-intersection split terminal | The contour-visit terminal dash bodies plus exactly one legal-side authored join for that contour visit |
| Gap at a vertex | No dash body may be invented only to carry a cap or join |
| `inside-excluded-open-span` | No visible contributor |

For high-angle source-vertex and self-intersection terminal regions, the
source-vertex join allowed resolved footprints are `miter`, `bevel`, `round`,
`bevel-by-miter-angle`, and `degenerate-bevel`. Disallowed visible contributors
include terminal body apex spill, construction-only seam evidence visible leak,
join-owned continuity evidence emitted as geometry, duplicate
same-paint owner overlap, and diagnostic/helper product leaks.

The contributor oracle for a high-acute authored miter must first verify the
resolved join. If
`vertexAngle - miterAngle <= MITER_ANGLE_EPSILON_DEGREES`, the protected
apex-near region must be covered by a source-vertex-owned
`bevel-by-miter-angle` footprint, not by a miter extension. Terminal body,
construction evidence, and diagnostic/helper products must have zero visible
contribution inside the protected join footprint.

Outside dashed high-acute boundary-terminal-pair terminal bodies also have a
selected-side terminal body envelope oracle. Any source-domain selected-side
terminal half-dash body sample that is inside the legal terminal body
contribution envelope and outside source-vertex apex or protected join
ownership must be covered by the canonical boundary-terminal-pair terminal body
product. A miss in this region is a terminal body product materialization
failure, not an allowed resolved-join gap.

Within the local source-vertex probe region used by formal oracles,
miter-family join output must be locally convex and notch-free after
terminal-body exclusion. The source-vertex join footprint must stay seam-free
through resolved join geometry that shares the incident Step 27 seam endpoint
identities; any concave bite, dash/join gap, endpoint relocation, or visible
seam-repair product in that probe region is a broken corner. That probe region
is not a production clip and must not cap a resolved miter apex.

For join-owned `start`, `end`, and `start-end` interval terminals,
endpoint-side dash caps are suppressed before join materialization. Join-owned
means the endpoint is owned by a source vertex, contour/source split,
self-intersection split, or smooth-continuity interior boundary. True open
authored endpoints remain governed by the true endpoint authored cap route.
Body-side authored caps remain only where
`endpointCapPolicy` allows them. A cap is never a substitute for a
contour/source/split join. A `round` join is a join arc on the legal side, not
an endpoint cap disk; `bevel` and `bevel-by-miter-angle` use the same
seam-connected cut-off footprint between incident product-boundary endpoints;
resolved `miter` intersects the legal-side offset lines and is allowed only when
`vertexAngle - miterAngle > MITER_ANGLE_EPSILON_DEGREES`.

Dash bodies adhere to the authored source segment or curve. A terminal body is
cut from the owning `DashProductInterval`; it must not be rebuilt from a
temporary chord between the vertex and an inferred body point. At acute angles,
the source-vertex miter points toward the resolved legal corner direction; it
must not protrude forward along either adjacent source segment. The local
visible product at an acute constrained dashed vertex must remain segment
adherent: dash body samples lie on the interval's authored source span, join
samples lie in the legal-side join footprint, and no extra packet may fill the
gap between them.

### Ownership Arbitration And Same-Paint Union

Ownership is resolved before visible render. If two candidate packets overlap,
the following precedence applies:

| Candidate overlap | Visible owner |
| --- | --- |
| Diagnostic/helper/derivation vs any product packet | Product packet; diagnostic/helper/derivation stays non-visible |
| Terminal body vs endpoint cap | Terminal body plus allowed body-side cap; suppressed endpoint-side cap is dropped |
| Terminal body vs authored join | Terminal body owns dash-body pixels; authored join owns legal-side corner pixels |
| Source-vertex join vs generic canonical packet | Source-vertex join; generic packet cannot cover the same local join region |
| Self-intersection contour visit A vs visit B | Each visit owns only its resolved legal side/domain; overlap must be clipped or kept diagnostic |
| Smooth-continuity fragments inside one dash | One smooth-continuity group owns the combined dash footprint |
| Same owner, same interval role, same legal side | May merge only if post-merge metadata still identifies that owner and role |

`ordinary coverage` means non-terminal, non-join, non-split, same-owner product
coverage with the same source range, legal side, paint, stroke style,
domainMode, and output channel. Same-paint union may merge ordinary coverage
inside that one owner only. It must not merge terminal-owned product into a
generic packet, merge join-owned product into a cap/body packet, drop
`geometryId`, lose `dashProductIntervals`, erase `domainPlanTerminalRole`,
erase `domainPlanSplitRangeTerminals`, erase endpoint cap policy, erase
join-ownership signatures, erase smooth-continuity grouping, or hide same-paint
overlap by relying on opacity.

Post-canonicalization visible packets must satisfy:

- no forbidden class transition, such as terminal-owned to generic canonical,
  join-owned to cap-owned, diagnostic to visible, or hit/export evidence to
  visible render;
- stable identity for owner, source interval, domain mode, legal side, terminal
  role, cap policy, join ownership, smooth-continuity group, and revision
  metadata;
- contributor exclusivity for local vertex regions, except where this spec
  explicitly allows legal compressed overlap or calls for a single-composite
  descriptor.

### Descriptor, Channel, Cache, And Drag Contracts

Descriptors are renderer-ready encodings of the product builder output. A
visible descriptor may bypass visible polygon final-face projection only when
it exactly encodes the same semantic product and carries enough metadata for
inspector evidence: product builder id, source revision, stroke signature,
domain mode/signature, dash interval ids, terminal roles, endpoint cap policy,
join ownership, legal side, smooth-continuity group, and output channel. If
that equivalence cannot be proven, visible render must use the canonical
product packets instead of a descriptor shortcut.

For constrained outside dashed stroke-path descriptors, equivalence includes
the normal-distance contract: the visible dash body occupies the source-adjacent
outside band from the source boundary to one stroke width away. A reusable
stroke path descriptor may represent that body with a band-center path and
`stroke.width`, but it must not use the outer ribbon edge as the path center
because that shifts the visible product by half a stroke width.

Equivalence also includes alpha/single-layer semantics. When the visible
descriptor path is exact, render entries must not direct-project overlapping
descriptor or carrier polygons as visible fill. Those polygons may clip or
explain the descriptor, but the visible output must remain a single product
layer except for explicitly legal overlap cases.

Output channels are separated:

| Output channel | Allowed geometry |
| --- | --- |
| Visible render | Only product descriptors or product packets for visible owners |
| Hit test | Product hit projection plus explicitly marked non-visible coverage evidence |
| Export | Export projection of product geometry plus explicitly marked non-visible evidence when needed by export semantics |
| Diagnostics | Helper, derivation, rejected-candidate, overlap, and probe geometry |
| Visual overlay | Runtime product geometry plus expected/forbidden oracle probes |

No channel may promote diagnostics/helper geometry into visible render. Hit,
export, diagnostics, and visual overlay records must carry an output-channel
tag so tests can prove they were not consumed as visible render.

Stage cache keys are stage-specific:

| Stage | Required key dimensions |
| --- | --- |
| Source path/topology | element id, network id, source revision, topology signature, transform-space signature |
| Domain plan | source revision, topology signature, fill/even-odd signature, stroke position, domain mode, selected side |
| Dash interval allocation | source revision, network/span id, authored dash length, authored gap length, source-distance allocation origin, split range id, terminal role |
| Terminal cap | dash interval id, cap type, terminal role, endpoint cap policy, source revision |
| Join/miter | source vertex or split terminal id, previous/next contour directions, legal side, join type, miter angle, stroke width |
| Product descriptor | source revision, stroke width, position, cap, join, miter, dash signature, domain signature, legal side, terminal role, join ownership, smooth-continuity group, descriptor mode |
| Paint/render output | stroke fill signature, visibility, opacity, blend/output channel |

Drag changes source path revision every frame but must not mutate static stroke
parameter or paint revisions. Resolved split/domain metadata may be reused only
as a validated current-source input when topology signature, contour visit
identity, domain mode, and split range ids still match the current drag frame.
If validation fails, Stroke Geometry must rebuild exact source/domain/product
data for correctness. Product Output must never retrace source intersections or
switch to a drag-only geometry route; it consumes the current product builder
output or a descriptor proven equivalent to that output.

### Canonical Visual Review And Completion DoD

The spec owns both expected stroke behavior and the canonical review pass/fail
contract.
Completion for a stroke semantic change requires all relevant oracles:

- formal unit/product tests for affected product contracts;
- inspector evidence for stage ownership, dirty counters, cache hits/misses,
  descriptor/channel separation, and failure reopening;
- app visual review overlay for affected canonical groups or focused reported
  cases;
- local source-space probes for source segment adherence, legal side, dash/gap
  recall, cap footprint, join footprint, terminal ownership, and same-paint
  overdraw;
- contributor-count or equivalent ownership oracle for acute vertices,
  self-intersection split terminals, and same-paint local regions.

The local contributor oracle counts visible product owners in a source-space
probe region. A valid constrained dashed source vertex has at most the allowed
contributors from the local composition table: adjacent dash bodies plus one
authored join, or fewer when a dash interval is absent. Except for the legal
compressed overlap case defined in this spec, extra generic packets, duplicate
terminal bodies, endpoint caps at join-owned terminals, diagnostic fragments, or
same-paint overlaps count as failures even when the final pixels are opaque and
visually similar.

#### App Visual Matrix

The canonical visual groups are an app-visible validation matrix, not a primary
regression authority. Stroke correctness is first defined by the stroke engine
spec, the inspector flow, the step-unit gates, the integration gates, the formal
geometry oracle matrix, and the new regression coverage gate. App visual groups
verify that the already-defined product semantics survive the application
runtime, render entries, projection layer, and screenshot artifact path.

Reported cases and canonical visual groups are both regression samples inside
the broader matrix. They may expose missing coverage or verify a repaired route,
but they must not override the product matrix, create fixture-specific runtime
branches, or replace missing unit, integration, or formal oracle coverage.
Focused specs may be used during iteration only after their corresponding spec
rules, inspector routes, product artifacts, and formal oracle cases are known.

Solid stroke groups:

1. `solid inside miter`
2. `solid inside bevel`
3. `solid inside round`
4. `solid center miter`
5. `solid center bevel`
6. `solid center round`
7. `solid outside miter`
8. `solid outside bevel`
9. `solid outside round`

Dashed stroke groups:

10. `dashed inside butt`
11. `dashed inside square`
12. `dashed inside round`
13. `dashed center butt`
14. `dashed center square`
15. `dashed center round`
16. `dashed outside butt`
17. `dashed outside square`
18. `dashed outside round`

Each group must remain independently runnable as an app visual spec once that
group has a current coverage-map entry and has been rewritten into the active
visual validation phase. Groups may share helpers, but they must not collapse
into one long spec that hides the failing group.

#### Required Single-Frame Overlay

Every stroke canonical app visual review must generate a single-frame rule
overlay for the reviewed case. The plain screenshot may be attached, but it is
not the review artifact. The review artifact is the overlay plus metrics.

The same image must show:

- actual app-rendered stroke pixels;
- canonical model source path derived from runtime data;
- fill/even-odd legal domain when the path is closed or self-intersecting;
- centerline and stroke width reference;
- expected visible stroke region;
- forbidden stroke region;
- dash/gap intervals for dashed cases;
- dashed-collapse provenance labels for constrained inside tiny domains;
- legal compressed overlap labels for constrained outside dashed overlap;
- below-visibility-threshold or hard-to-sample labels for legal stable sliver
  domains when screenshot sampling is limited;
- terminal/cap probes for dashed and open-path cases;
- join/corner probes for solid and source-join cases;
- dash width and source-vertex miter direction probes for dashed source-join
  cases;
- source-vertex bevel and bevel-by-miter-angle probes that show both incident
  dash body outer boundary endpoints and verify the cut-off edge is
  seam-connected to both dash bodies;
- overlap/overdraw probes;
- local visible contributor-count probes for acute vertices, authored vertices,
  and self-intersection split terminals;
- output-channel markers that distinguish visible render from hit/export,
  diagnostics, derivation helpers, and overlay-only probes;
- failure markers for every rule violation.

Overlay runtime data must capture selected/reviewed element id, `points`,
`segments`, `networks`, fills, strokes, transform, visibility, opacity, zoom,
viewport, and coordinate space. The selected/reviewed element id must match the
screenshot.

#### Canonical Visual Rules

All 18 groups must verify these rules:

- Source-path adherence: rendered stroke follows the authored source path, each
  source segment has independent coverage metrics, and a full-path aggregate
  pass is insufficient if any segment fails.
- Position correctness: `inside` renders only on the legal inside side/domain,
  `outside` renders only on the exterior/outside side/domain, and `center`
  straddles the source path with expected coverage on both sides.
- Forbidden-region correctness: expected empty regions stay empty; outside
  leaks, inside leaks, gap leaks, mask leaks, and opposite-side leaks are
  independently measured.
- Boundary correctness: caps, joins, corners, terminals, and clipped edges
  match authored stroke fields and are shown by boundary probes.
- Overlap correctness: same-paint overlaps do not create unexpected
  darker/double-alpha output; opaque same-paint output still passes
  contributor-count probes.
- Projection correctness: render, hit, export, diagnostics, and visual overlay
  records preserve channel separation; diagnostics, derivation helpers,
  hit/export evidence, and overlay probes must not appear as visible render
  contributors.

Solid group rules:

- `solid inside *`: expected visible region is the inside half of the doubled
  authored center stroke clipped by the filled/even-odd inside domain; exterior
  probes are unpainted; joins match the resolved `miter`, `bevel`, `round`, or
  `bevel-by-miter-angle` footprint; diagnostic strips/helper polygons never
  become visible.
- `solid center *`: expected visible region straddles the source path; inside
  and outside probes both have coverage where the source path is visible; joins
  match authored join; no unexpected one-side clipping occurs.
- `solid outside *`: expected visible region is the outside half of the doubled
  authored center stroke clipped to the exterior legal domain; inside-domain
  probes are unpainted except documented raster tolerance; joins match authored
  join; self-intersection interior leaks fail.

Dashed shared rules:

- Center dashed cases allocate dash/gap phase along the authored source path.
- Open center dashed cases allocate at continuous open network/subpath level,
  not per segment boundary.
- Open path endpoints use half-length terminal dashes; middle visible intervals
  keep authored dash length and authored gap length in source distance.
- Constrained inside/outside self-intersection cases allocate visible dash/gap
  records per independent source split range, not from continuous open-network
  phase.
- Legal-domain clip boundaries do not create new half-dash records, endpoint
  caps, or gap redistribution. Only true authored open dashed-line endpoints use
  half-length terminal dashes.
- Round and square caps are included when measuring the visible footprint after
  interval allocation. Cap footprint may reduce the visible gap, but it must not
  change authored dash/gap interval lengths or trigger an automatic collapse
  route.
- Constrained inside tiny-domain collapse remains dashed product with
  `DashProductInterval` provenance. A visually continuous collapsed span is not
  a solid substitute.
- Constrained outside dashed legal compressed overlap is valid when all
  overlapping contributors are legal outside dash intervals with preserved
  provenance and single-composite alpha behavior. The merged-looking coverage is
  not a failure by itself.
- Visually tiny but semantically valid sliver domains must be reviewed with
  metadata/provenance evidence when screenshot sampling is hard; visual
  visibility thresholds must not drop product output.
- Every source segment has dash recall and gap leak metrics; expected dash
  samples are painted; expected gap samples are unpainted.
- Terminal/cap footprints match `butt`, `square`, or `round`.
- Source-vertex dash bodies keep the authored stroke width. Terminal or
  source-join dash bodies must not become visibly wider than segment dash
  bodies on the same source path.
- Sharp authored source vertices with `joinType: miter` must be owned by a
  source-vertex miter join packet when a split-range terminal reaches that
  vertex. They must not survive as independent terminal cap packets.
- Miter source-vertex joins extend toward the legal outside/inside source-vertex
  side, not forward along either adjacent source segment.
- Sharp authored source vertices with `joinType: bevel`, or authored `miter`
  resolved to `bevel-by-miter-angle`, must prove that the visible cut-off edge
  connects the two incident dash body outer boundary endpoints in the
  doubled-center product before legal-domain clipping. A bevel that shrinks to a
  smaller selected-side chord, even when seam-free at a point, is invalid.
- Dash intervals preserve provenance through render projection; split ranges
  preserve terminal metadata; broad segment dropout and unexpected double-alpha
  overdraw fail.

#### Dashed Group Review Rules

`dashed inside *` is a strict-review group and must use the strictest overlay:

1. Derive source split ranges from authored source path and even-odd legal
   domain.
2. Split self-intersections into source split ranges.
3. Preserve authored dash/gap intervals on source-distance spans; legal cut
   boundaries do not create half-dash terminals or new endpoint caps. Apply the
   Asyra tiny-domain collapse rule only when the constrained split range cannot
   preserve the post-cap separate-gap floor.
4. Build Asyra doubled center dashed stroke geometry using `stroke.width * 2`.
5. Preserve authored `capType`, `joinType`, and `miterAngle`.
6. Clip visible product to the inside filled/even-odd legal domain.
7. Drop empty clipped fragments.
8. Do not replace dropped fragments with one-sided ribbons, domain-plan strips,
   or diagnostic helper geometry.

Required dashed inside overlay metrics are `inside_dash_recall`,
`worst_segment_dash_recall`, `inside_gap_leak_rate`, `outside_leak_rate`,
`wrong_side_dominance`, `terminal_recall`, `split_terminal_recall`,
`double_alpha_rate`, `local_contributor_count_max`,
`unexpected_visible_owner_count`, and `model_render_drift`. Passing means red
dash pixels are on the expected inside legal region. No-fill inside dashed
remains inside dashed; lack of visible fill must not remove the implicit inside
domain or switch to outside/center behavior.

`dashed center *` requires authored-source dash/gap intervals, continuous open
network allocation for open paths, half-length terminal dashes at true open
endpoints, centerline straddling coverage, gap emptiness on both sides, authored
cap footprints, and no inside-only/outside-only substitute output.

Open authored dashed `inside` / `outside` strokes use formal unbounded open
center product only when the open network has no bounded filled-region domain.
Open self-intersecting networks with bounded filled regions formed by real
authored source segments are reviewed as constrained-domain dashed strokes:
`inside` paints only contour-owned source spans, dangling open branches remain
unpainted, `outside` paints exterior contour spans and dangling open-branch
endpoint/cap/dash spans on both sides, and no invisible closing edge may appear
in domain, dash pixels, hit coverage, export packets, or endpoint terminal
ownership.

`dashed outside *` requires:

- split-range dash/gap allocation for constrained self-intersections;
- source path identity for segment ownership and projection;
- authored center dashed stroke at `stroke.width * 2` clipped by the outside
  legal domain: exterior domain plus inside filled-region exclusion;
- rejection of direct one-sided shifted dash signatures and rejection of any
  secondary per-segment selected-side trim after outside legal-domain clipping;
- round/square cap tangent extension from doubled center product before
  clipping;
- unpainted filled-face/inside-domain probes;
- cap footprints matching `butt`, `square`, or `round`;
- true dangling/open endpoints remain cap-owned;
- authored source vertices and self-intersection split terminals that form
  contour corners are join-owned and materialize authored `miter`, `bevel`, or
  `round` join footprint;
- join-owned source-vertex and split-terminal packets preserve legal-side
  footprint for every `joinType`;
- boundary terminal dash bodies and source-vertex join dash bodies keep a
  seam-free handoff through source-vertex join-owned continuity evidence.

Every constrained outside dashed overlay must show selected legal-side domain,
doubled center-stroke envelope before clipping, and ordinary post-clip visible
span. A clean single-segment outside body whose inside half is fully removed by
the inside filled-region exclusion usually exposes a normal span equal to
authored `stroke.width` within width tolerance, but that width is an observed
consequence of legal-domain clipping, not a second clipping rule. Cross-segment
doubled-center survivors that remain after inside-domain exclusion must not be
trimmed only to satisfy a per-segment width oracle. Dangling open outside
both-side spans are explicit both-side domains and may expose a combined span
equal to `stroke.width * 2` within width tolerance.

#### Self-Intersecting Fixture Review Rules

The self-check pentagram fixture is an Asyra rule-derived matrix, not a
product-packet smoke test. Every reviewed stroke case derives expected probes
from runtime authored source path, source segment order, source split ranges,
closed even-odd legal domain, requested stroke position, style, cap, join,
width, authored dash length, and authored gap length. The oracle must not use emitted product
packets as the only source of truth.

Each pentagram overlay must classify all self-intersection split boundaries and
all authored source vertices:

- `center`: stroke straddles authored path at every source segment, source
  vertex, and self-intersection split.
- `inside`: only inside legal domain is painted at every source segment, source
  vertex, and self-intersection split.
- `outside`: only exterior legal domain is painted at every source segment,
  source vertex, and self-intersection split.
- Open self-intersecting dashed `inside` / `outside`: contour ownership is
  verified; `inside` has no dangling branch output; `outside` has exterior
  contour and dangling open endpoint/cap dash recall; no synthesized closing
  edge appears in expected or rendered product.
- `solid`: continuous expected coverage and authored join footprint at
  source-derived join locations.
- `dashed`: Asyra split-range dash/gap allocation, split-range terminals, cap
  footprints, and join behavior at source-derived locations.

Dashed self-intersections require both presence and absence checks:

- expected dash probes at each source split range, visible split, and authored
  vertex are painted according to split-range interval records;
- expected gap probes remain unpainted;
- expected source-join probes do not disappear merely because no product join
  packet was emitted;
- forbidden inside/outside probes remain unpainted;
- endpoint, source-vertex, and split-terminal style matches authored cap/join;
- true dangling endpoint probes are judged against cap footprints, while
  join-owned contour/source/split terminals are judged against join footprints;
- source-vertex miter probes prove the miter tip points to legal
  exterior/interior side, not along either adjacent source segment;
- endpoint/source-vertex dash width probes compare terminal/source-join body
  width with ordinary segment dash body width;
- local contributor-count probes show only allowed local contributors;
- visible render probes reject generic canonical packets, duplicate terminal
  bodies, endpoint caps at join-owned terminals, diagnostics, and derivation
  fragments in the same local vertex region;
- broad source segment or self-intersection dropout fails even when aggregate
  coverage is high.

#### Failure Markers, Metrics, And Tolerance

Stroke overlays must use stable marker categories:

- `missing_dash`
- `source_segment_dropout`
- `inside_gap_leak`
- `outside_leak`
- `wrong_side_dash`
- `terminal_missing`
- `split_terminal_missing`
- `cap_footprint_mismatch`
- `join_footprint_mismatch`
- `dash_illegal_protrusion`
- `dash_width_mismatch`
- `miter_join_wrong_direction`
- `unexpected_visible_contributor`
- `output_channel_leak`
- `source_derived_probe_missing`
- `legal_domain_leak`
- `model_render_drift`
- `double_alpha_overdraw`
- `unexpected_union_or_collapse`
- `lost_interval_provenance`

Each marker must include source segment id/index or interval id when available.
If any marker is present, the review fails.

Width and span checks use source-space tolerance
`max(0.5 source units, stroke.width * 0.05)`. Raster sampling may add at most
one CSS pixel of antialias tolerance around the source-space expected boundary,
but that raster tolerance cannot hide wrong-side dominance, missing dash recall,
unexpected visible contributors, output-channel leaks, or same-paint overdraw.
Any width/span phrase in this spec that depends on equality must use this
source-space tolerance, and tests must not invent local tolerances. A stricter
tolerance may be used only when this spec or the inspector route declares the
numeric bound, owner stage, artifact id, route id, and required evidence before
runtime implementation. Tests, visual probes, and runtime repair code must not
invent local tolerances.

#### Minimum App Visual Review Commands

Agent-run app visual, drag, and performance gates use
`http://localhost:3001`. `http://localhost:3000` is reserved for user-run
sessions. Extra ports are opt-in and must be shut down after use. The preview
server is not part of the standard gate runtime; production confidence is
covered by `yarn workspace @asyra/asyra-design react:build`.

App visual evidence must be collected from a runtime whose workspace package
entrypoints were built from the current source before the app server loaded
them. A `yarn dev:all` session is valid visual evidence only when its initial
workspace package build phase completes before `apps/asyra-design` starts; a
runtime that starts Vite against stale package `dist` output cannot close a
stroke visual review, even if later file watchers rebuild the packages.

For app runtime evidence and visual validation after the stroke gates pass:

```bash
ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL=http://localhost:3001 \
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3001 \
yarn workspace @asyra/asyra-design test:e2e e2e/stroke-new-flow --reporter=line
```

Before reporting stroke visual correctness:

1. Run the current-flow visual specs referenced by
   `apps/asyra-design/e2e/stroke-new-flow/stroke-visual-e2e-coverage-map.ts`.
2. Generate the required runtime artifacts for the affected current-flow case.
3. Verify every rule listed in this visual review contract for that case.
4. Inspect the overlay manually and compare it to metrics.
5. Report overlay path, metadata path, failed marker count, and remaining
   differences.

If the overlay does not include a required review rule, the review is
incomplete.

## Inspector Step Contracts

- `Interaction`: feature/session steps own explicit user intent only. They must
  not commit model data directly or synchronize render state.
- `Model Commit`: common API/domain adapter steps own canonical workspace vector
  data, computed patch construction, structural operation adapters, and
  transaction/undo boundaries.
- `Data Channel`: scene-tree and reactive event steps publish computed patch
  updates after commit.
- `Render Mirror`: render mirror/cache steps consume committed patch data once
  and derive renderer-ready data without repairing model state.
- `Stroke Geometry`: geometry steps own normalized render inputs, shared
  geometry, source families, stroke domains, dash allocation, legality, paint,
  and final semantic stroke records. Solid and dashed constrained products are
  materialized through their domain-plan product route and clipped by the
  relevant filled-region mask where the position requires it.
- `Product Output`: render, hit, export, and renderer projection steps consume
  semantic descriptors without changing stroke rules.
- `Diagnostics`: diagnostics and visible review steps are the completion gates.
  Translucent self-intersecting center solid strokes also require same-paint
  alpha-overlap probes: self-crossings must match adjacent body stroke paint
  strength and must not darken through multiple visible composites.

## Diagnostic Evidence Limits

Diagnostics may keep bounded records for:

- face ownership;
- winding and occupancy;
- source span and source vertex provenance;
- adjacency classification;
- exact coverage comparison;
- rejected shortcut modes;
- probe measurements.

Diagnostics must not become visible render inputs, normal render cache
signatures, export geometry, or hit geometry unless that path is explicitly
defined as non-visible evidence. Product-visible render must stay the masked
doubled authored center stroke.

## Stroke Parameter Stage Cache Rule

Stroke parameter changes must not share one coarse geometry invalidation helper.
The renderer classifies changes through the stage dirty matrix:

- paint-only fields live under `stroke.fill` (`fill.color`, `fill.opacity`,
  `fill.kind`, `fill.gradient`) and dirty paint payload and render output only;
- display-format fields that do not change actual paint must not dirty render;
- `fill.visible` dirties render output only;
- `style` and `position` select stroke family/domain but reuse source
  path/topology;
- `width` reuses source path/topology and dash interval allocation, then rebuilds domain,
  terminal cap, join/miter, and downstream output;
- `dash` and `gap` rebuild dash interval allocation and downstream output
  without dirtying source topology or join shape;
- `capType` rebuilds terminal cap and downstream output; closed paths must not
  dirty dash interval allocation, while open path square-cap transitions may do so
  conservatively;
- `joinType` and `miterAngle` rebuild join/miter shape and downstream output
  without dirtying source path, stroke domain, dash interval allocation, or paint. Exact
  semantic stroke-path descriptors may treat `miterAngle` as a style replay
  when cached geometry is restyled with the current cap/join/miter values.
  Polygon product geometry that embeds miter shape must keep `miterAngle` in
  its geometry signature and rebuild.

Drag uses the same matrix. Point/handle movement dirties source path and any
derived source geometry required by the changed topology, but it must not mark
static stroke parameter revisions or paint as changed. If topology/domain
signatures cannot prove safe reuse, exact rebuild is required for correctness.

The dirty matrix is not sufficient by itself. Normal render must also keep a
`StrokePipelineStageCache`-style product cache for exact semantic descriptors:

- cache keys include element, network, source revision, and geometry-affecting
  stroke signature;
- cached final semantic descriptors may be retinted for `stroke.fill`-only
  changes and
  restyled for style-only descriptor changes; replaying an old `miterAngle`,
  cap, or join value is invalid;
- constrained dashed drag descriptors reuse resolved split/domain metadata and
  must not run source-intersection tracing as part of visible product output;
- `stroke.fill.visible:false` clears render/hit/export output through a render-output
  hidden path without rebuilding source or stroke geometry;
- diagnostics/export polygon evidence may be materialized lazily, but must not
  become a prerequisite for normal visible parameter switching;
- cache hit, miss, store, and hidden-output counters are required inspector
  evidence for static parameter switching and drag review.

## Drag Performance Contract

Drag correctness is not complete unless point and handle/control drag stay on
the same semantic product pipeline and satisfy the enforced app drag performance
gate. The target is 120fps, which means an 8.33ms frame budget for the enforced
drag review.

This contract applies to moving vector points and Bezier handles/control points
across solid, center dashed, inside dashed, outside dashed, open constrained
dashed, and burst drag cases. Drag must update the source path revision and any
derived source geometry required by the changed topology, while static stroke
parameter revisions, paint revisions, dash parameters, cap parameters, and join
parameters remain unchanged unless the user changed those parameters.

The renderer may reuse resolved split/domain metadata, dash interval allocations, terminal
interval ownership, and product descriptors only after validating them against
the current source revision and topology/domain signatures. Product Output must
not retrace source intersections, switch to a drag-only geometry route, emit
diagnostic/export polygons as visible repair geometry, or bypass the stroke
product contract to hit the performance budget.

Exact rebuild remains required when source revision, topology, domain, dash,
terminal, cap, join, smooth-continuity, or descriptor signatures cannot prove
safe reuse. If an exact geometry stage is too expensive to stay within the
120fps gate, completion evidence must name that stage, show the measured p95 or
average cost, prove why correctness requires exact work there, and keep the
visible output on the same product contract. A broad "geometry is expensive"
claim is not enough.

Enforced app drag gate:

```bash
ASYRA_STROKE_DRAG_E2E_ENFORCE_120FPS=1 \
ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL=http://localhost:3001 \
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3001 \
yarn workspace @asyra/asyra-design test:e2e \
  e2e/stroke-drag-render-performance-solid.spec.ts \
  e2e/stroke-drag-render-performance-open-solid.spec.ts \
  e2e/stroke-drag-render-performance-center-dashed.spec.ts \
  e2e/stroke-drag-render-performance-open-center-dashed.spec.ts \
  e2e/stroke-drag-render-performance-inside-dashed.spec.ts \
  e2e/stroke-drag-render-performance-open-inside-dashed.spec.ts \
  e2e/stroke-drag-render-performance-outside-dashed.spec.ts \
  e2e/stroke-drag-render-performance-open-outside-dashed.spec.ts \
  e2e/stroke-drag-render-performance-burst.spec.ts \
  --reporter=line
```

The gate must report and enforce:

- vector point/control drag resolved geometry p95 below 8.33ms, unless the
  explicit correctness-required exception above is documented;
- vector product render phase p95 below 8.33ms;
- sustained render flush average below 8.33ms;
- stage dirty counters showing drag source-path updates without static stroke
  parameter or paint revision churn;
- cache hit, miss, store, and hidden-output counters for the affected stage
  product cache;
- evidence that final mouseup commits one canonical undoable computed patch
  while intermediate drag updates remain non-undoable.

## Invalid Current-Rule Sources

These sources are not valid rule authorities:

- completed plan copies;
- analysis reports;
- BDD feature files;
- viewer HTML;
- screenshots by themselves;
- old helper names or implementation branches;
- decision-history entries that predate this cleanup.

Screenshots can reopen the earliest owning inspector step, but the semantic rule
must be written into this spec before implementation resumes. The active plan,
and inspector flow must then be synced to reference, visualize, or test the same
rule.

## Completion Requirements

The 2026-06-21 architecture closure met these requirements:

- the stroke engine spec owns the product pipeline and canonical visual review
  DoD, while active plan and inspector flow references do not conflict with it;
- removed stroke specification files are not current rule sources;
- the inspector data labels Stroke Geometry product-unit building as
  model-neutral and route-neutral;
- the inspector data covers the Stroke / Vector System flow from feature intent
  through Product Output and Diagnostics;
- current Asyra rule probes and reviewed screenshots pass;
- visual gates fail when the internal pentagon breaks into helper-like
  fragments even if shared-edge width and join-difference numeric probes pass;
- visual gates fail when translucent center solid self-intersections accumulate
  same-paint alpha overlap, even if global red coverage and route assertions
  pass;
- implementation evidence separately proves render, hit, export, diagnostics,
  reload, performance behavior, and visible screenshot consistency.

Future stroke architecture changes must satisfy the same requirements before
claiming closure.
