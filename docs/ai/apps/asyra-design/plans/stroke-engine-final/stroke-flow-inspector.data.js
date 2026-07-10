/* global module */
;(() => {
  const groups = [
    'All',
    'Interaction',
    'Model Commit',
    'Data Channel',
    'Render Mirror',
    'Stroke Geometry',
    'Product Output',
    'Diagnostics'
  ]

  const lanes = groups.filter((group) => group !== 'All')

  const latestRules = [
    'The stroke-engine README is the stroke semantic source of truth. This data file is inspector flow data: it visualizes stages, data flow, evidence checkpoints, and failure reopening only.',
    'PLANS.md is the active task plan. It summarizes the current task, required spec clauses, gates, and constraints without defining independent stroke semantics.',
    'Inspector-Flow-First Greenfield Stroke Engine Refactor is the active execution protocol: exactly one inspector step is active, stroke tests must map to current spec and inspector contracts before entering the refactor gate, and integration/E2E remain locked until step unit verification is complete.',
    'Canonical visual review procedure and DoD live in the stroke-engine README and are summarized by PLANS.md. Stroke tasks must not read a fourth stroke document.',
    'Viewer HTML is a shell only.',
    'Current stroke repair work first restores a diagnosable correctness baseline. Performance-oriented changes must be separated from correctness contract clarity work until the baseline is stable.',
    'This board is the Stroke / Vector System Inspector Flow: it covers feature intent, model commit, data channel, render mirror, stroke geometry, product output, and diagnostics.',
    'First incorrect owner stage is diagnosed in source-to-render order: computed patch, render mirror, StrokeDomainPlan, DashProductInterval or solid product contract, endpoint cap policy, join ownership, smooth continuity, product descriptors, render entries, then resolved vector geometry.',
    'Performance data and visible artifacts do not decide owner stage. Downstream geometry must not compensate for wrong dash intervals, cap policy, join ownership, or smooth-continuity records.',
    'Algorithm replacement is allowed only with formal equivalence evidence for the touched stroke product semantics. Runtime guardrails are safety only, not a formal fix.',
    'Features express explicit user intent only. They must not directly write render store state or depend on renderer-local repair.',
    'Vector common APIs and domain adapters own point/handle drag and structural vector operations. They emit canonical workspace/world computed patches.',
    'One intended user action maps to one intended undo commit. Drag updates remain non-undoable; final drag and structural operations are undoable.',
    'Scene-tree and data-channel publish computed patch updates with changed scalar values and record ids. They must not force unrelated full-topology rewrites.',
    'Render is a downstream consumer. Render mirror/cache applies committed patches exactly once and derives render data from committed state.',
    'Committed state decides history; current state decides render. Every current source/stroke state, including non-undoable drag frames, undo/redo results, reloads, collaboration patches, parameter switches, point edits, and handle edits, must render through the same stroke product contract.',
    'Stroke geometry stages consume normalized render data only; they must not depend on feature-local state, undo payload cleanup, or direct app-to-render synchronization.',
    'Stroke invalidation is stage-based. Source path/topology, stroke family, stroke domain, dash interval allocation, terminal cap, join/miter shape, paint, and render output use separate internal revisions.',
    'Stroke paint model data is canonicalized as stroke.fill using the same FillAttrs format as element fills. Stroke root paint fields such as color, opacity, visible, kind, colorFormat, defaultColorFormat, and gradient are load-boundary normalization input only and must not be written back.',
    'A stroke.fill-only change dirties paint and render output only. It must not trigger vector bounds repair, source topology rebuild, domain rebuild, dash interval allocation rebuild, terminal cap rebuild, or join rebuild.',
    'Static stroke parameter changes dirty only the stages they affect; vector drag dirties source path data without mutating static stroke parameter or paint revisions.',
    'Stroke performance diagnostics must expose stage dirty counters such as paint-only update and drag source-path-with-static-stroke.',
    'Point/handle drag performance target is 120fps: enforced app drag gates must run with ASYRA_STROKE_DRAG_E2E_ENFORCE_120FPS=1 and prove vector point/control resolved geometry p95, vector product render phase p95, and sustained render flush average stay within the 8.33ms frame budget unless the stroke-engine README documents a correctness-required exact-geometry exception.',
    'Dirty classification must feed a real stroke stage product cache. Stage cache keys must include the source, topology/domain, dash, terminal cap, join/miter, legal-side, descriptor-mode, and paint dimensions owned by the stroke-engine README.',
    'Static stroke parameter switches must report stage cache hit, miss, store, and hidden-output counters so inspector review can distinguish geometry rebuilds from product descriptor reuse.',
    'Center solid visible render is the authored center stroke. Self-intersecting center solid vectors may use authored stroke path descriptors while preserving strokeJoin, strokeCap, and miterAngle; renderer path projection is allowed only when alpha-safe under README #alpha-safe-descriptor-projection, while translucent self-intersections require single-composite descriptor output.',
    'Diagnostics for translucent self-intersecting center solid strokes must include same-paint alpha-overlap probes at self-crossings; global red coverage alone is insufficient.',
    'Constrained solid visible render uses the Asyra doubled authored center-stroke mask model: build the authored center stroke at twice the requested stroke width, apply strokeJoin and miterAngle there, then clip by the inside filled-region mask or outside exterior mask.',
    'Self-intersecting inside solid visible pixels must come from the doubled authored center stroke clipped by a face, winding, and adjacency-aware filled-region mask.',
    'Grouped render descriptors may encode the adjacency-aware mask only as authored centerline stroke paths with explicit clip groups; they must not expose face strips, helper polygons, or derivation fragments as visible product geometry.',
    'Internal shared edges reveal half of the requested stroke width from each adjacent filled face; the combined visible width along the shared edge must not become two independent full-width strips.',
    'All five internal pentagon corners are join-sensitive and must vary with strokeJoin and miterAngle.',
    'Derivation fragments, face strips, helper polygons, coverage probes, and diagnostics can prove legality, hit/export, or failure modes, but they must not become product-visible solid stroke geometry.',
    'Dashed constrained strokes remain interval-domain based. Dash intervals, terminal half-dashes, and caps must stay separate from solid visible geometry.',
    'Constrained dashed inside/outside visible products materialize authored center dashed intervals at stroke.width * 2, apply cap/join/miter in that doubled center space, then clip through the legal-domain rules owned by the stroke-engine README. The outside route clips by exterior domain plus inside filled-region exclusion and must not add a secondary per-segment selected-side trim after that clip. Open dangling outside both-side spans are explicit both-side source-span domains.',
    'StrokeDomainPlan owns domain mode and legal-side resolution. Only real authored source segments may create bounded domains; inferred closing edges, preview chords, and helper lines must not create domain, dash, hit/export, or visible product output.',
    'Dash cap footprints are materialized before legal-domain clipping. Round and square caps extend visible dash endpoints, but cap footprint does not authorize dash/gap redistribution, synthetic cut-boundary half-dashes, or automatic collapse output.',
    'Constrained inside dashed tiny domains use the Asyra cap-aware collapse rule declared in the stroke-engine README. The collapsed span remains dashed product with DashProductInterval provenance and must not become solid-like substitute output.',
    'Constrained outside dashed legal compressed overlap is valid when all overlapping visible contributors are legal outside DashProductInterval products, remain in the exterior legal domain, preserve provenance, and composite transparent paint once without double-alpha darkening.',
    'Outside dashed StrokeDomainPlan canonicalization must collapse duplicate source-side split ranges into one canonical materializable interval when they share source range, legal side, terminal role, join ownership, paint owner, and materialization identity. Removed split-range ids may survive only as allocation aliases or provenance ids on the canonical counterpart; aliases may resolve terminal allocation and debug/dirty dependency lookup, but they are not product owners and must not emit dash body, terminal body, join product, source-domain packets, render entries, hit/export packets, or visible descriptors.',
    'Tiny sliver domain handling is layered: numericalStabilityEpsilon belongs only to semantic/topology classification, visualVisibilityEpsilon belongs only to visual review, and visually tiny legal stable domains must not be dropped from product output.',
    'Terminal dash cap ownership is defined by the stroke-engine README sections #cap-and-terminal-terminology and #dash-body-and-join-seam-contract. Inspector flow records terminal-role evidence, endpointCapPolicy, and failure reopening only; it does not redefine cap semantics.',
    'Terminal cap ownership versus join ownership is defined by the stroke-engine README sections #cap-and-terminal-terminology, #asyra-join-resolution-baseline, and #local-composition-caps-and-joins. Inspector flow sequences the owning steps and required evidence only; it does not redefine endpoint or join behavior.',
    'High-angle source-vertex and self-intersection terminal regions use a visible contributor whitelist: only the source-vertex join product and incident terminal body products may emit visible coverage. Source-vertex join owns join-apex and legal-side corner coverage; terminal bodies own only dash body plus allowed body-side cap coverage.',
    'Butt terminal bodies remain strict endpoint products: they must not overhang the endpoint side or emit a visible body-side cap to repair source-vertex cracks. Suppressed butt endpoints may provide construction-only continuity evidence, but visible crack-closing coverage is valid only when the dash body and source-vertex join share the same dash body seam-boundary artifact endpoint identities, with terminal body ownership still stopped at the butt endpoint.',
    'Dash bodies and source-vertex joins share a source-domain seam contract. Dash intervals provide incident dash body seam boundaries, including outer body boundary vertices and outline segments, and the source-vertex join assembler consumes those boundaries to emit a seam-free join product whose visible triangles share the same seam-boundary artifact endpoint identities as both incident dash body seams. A visible dash/join seam gap at an authored sharp vertex is a product failure.',
    'Outside dashed high-acute boundary-terminal-pair transition continuity data is non-emitted seam evidence only. It may inform canonical source-vertex join assembly and terminal body clipping, but it must not survive as a visible helper polygon, source-path replay, substitute fill, or independent terminal-body product.',
    'For outside butt miter-family source vertices, non-emitted continuity evidence may identify the incident seam-boundary artifact endpoints consumed by the resolved source-vertex join footprint. It must not emit visible coverage, alter the resolved join boundary, add padding endpoints, add overlap endpoints, respond to raster holes or fixture coordinates, cap a resolved miter apex, or extend terminal body ownership.',
    'Construction-only seam evidence may influence endpoint identity selection and join boundary derivation, but visible source-vertex join output must use visibleContributor:source-vertex-join, geometryBasis:canonical-join-footprint, and resolution miter, bevel, round, bevel-by-miter-angle, or degenerate-bevel. geometryBasis must not be any construction seam basis; construction-only seam evidence may be recorded only with emitted:false and must not be reparented into visible geometry.',
    'For authored miter joins, the assembler resolves the join from the vertex angle and miterAngle using README MITER_ANGLE_EPSILON_DEGREES = 0.000001. Delta greater than that epsilon resolves to miter; delta less than or equal to that epsilon resolves to bevel-by-miter-angle. bevel-by-miter-angle is debug/oracle provenance, but its visible geometry is the same seam-connected cut-off footprint as authored bevel for the same product family and must not preserve an extra miter extension. Near-threshold cases must not emit both miter and bevel-equivalent footprints.',
    'Miter resolution is source-domain semantic resolution, not visible-product inference. vertexAngle must come only from authored center-path incident tangents or contour-visit incident tangents before inside/outside masking, terminal body construction, join clipping, or product boolean cleanup.',
    'bevel-by-miter-angle is a semantic provenance label over bevel-equivalent geometry, not a new geometry owner or render primitive. Product descriptors, debug metadata, and formal oracle output must preserve authoredJoin:miter plus resolvedJoin:bevel-by-miter-angle and must not collapse the case into authored bevel.',
    'Dashed authored vertices follow strict ownership: dash intervals provide incident body coverage and seam boundaries, source-vertex joins complete authored corners, and endpoint caps close only true dangling/open interval endpoints. No authored sharp vertex may be visibly completed by endpoint caps, terminal overhangs, construction/helper products, duplicate interval paint, or a visible gap between dash body and join.',
    'Miter-angle join recovery follows the inspector-flow-first greenfield refactor protocol: whole-flow review group first, active step unit contract second, implementation third, step verification fourth, then the runtime unit gate automatically opens focused test-architecture, integration, and formal geometry-oracle work. E2E, visual, regression, performance, and cleanup remain ordered behind their preceding gates.',
    'The refactor must advance through the runtime inspector steps by reviewing the active step whole-flow group before each one-step implementation segment. An active step may be retried at most three focused repair attempts; if the third attempt still fails, keep the same owner step, summarize blocker evidence and attempts, and automatically perform a task replan before the next implementation iteration.',
    'Full preset regression remains a future phase gate with at most three attempts. It must not run automatically after the runtime-step unit checkpoint. Each failed future attempt requires a failing-suite, assertion, owner-stage, and focused-repair summary before retrying; the third failed attempt automatically enters task replan before another regression attempt.',
    'Outside constrained dashed contour/source split terminal bodies are terminal-interval owned product packets. Curved round and square terminal bodies must keep their join-owned-terminal-body identity, geometryId, domainPlanTerminalRole, dashProductIntervals, domainPlanSplitRangeTerminals, endpoint cap policy, join ownership signatures, smooth-continuity grouping, and runtime revision metadata through product packet canonicalization. Same-paint union may merge only the ordinary-coverage class defined by the stroke-engine README and must not convert terminal-owned product into a generic canonical packet.',
    'Dirty owner-stage incremental product assembly is allowed for constrained dashed products as a canonical product assembly strategy, not as render-only cache, preview shortcut, or drag-only approximation. Each current-state frame must still emit a legal canonical product graph; reusable descriptors are valid only when their declared source-vertex, source-segment, terminal-body, dash-interval, ownership-region, shared seam endpoint identity, style-token, and local-topology dependencies do not intersect the current dirty dependency set.',
    'Dirty assembly recomputes affected source-vertex joins, terminal bodies, and dash intervals, then merges them with validated reusable descriptors. Any dependency change affecting visible ownership, local topology, shared seam-boundary artifact endpoint identity, dash interval identity, stroke alignment, stroke width, join style, cap style, dash/gap lengths, dash allocation state, or resolved join legality invalidates dependent descriptors before visible output. Stale visible descriptors, render-only reuse, geometry-specific repair, and preview-only output are invalid.',
    'Self-intersection split terminals can be join-owned product terminals. They carry the terminal point, previous/next contour directions, resolved legal side, owning intervals, joinType, and miterAngle; resolved miter, bevel, bevel-by-miter-angle, and round all materialize on the legal side. Round join means a join arc, not an endpoint cap disk.',
    'Local source vertices and split terminals must pass the contributor oracle: visible output may contain only the allowed adjacent bodies plus one authored join for that local case, except for spec-defined legal outside compressed overlap. Extra generic packets, duplicate terminal bodies, endpoint caps at join-owned terminals, diagnostic fragments, or unapproved same-paint overlaps fail even when opaque pixels look similar.',
    'Curve dash smoothness is a top-level product rule. A visible dash on a Bezier or high-curvature span must be one continuous smooth footprint whose outer boundary follows the authored source-curve offset at the configured stroke width; sampling seams, radial slices, disconnected strips, comb-like gaps, straight-chord outer edges, and selected-side envelope residue inside one dash are product failures. High curvature is not a join trigger by itself: tangent-continuous curved spans remain smooth-continuity dash products and must not emit source-vertex join ownership.',
    'Open center dashed allocation is continuous-network based: the two true open network endpoints own half-length terminal dashes, middle dashes keep authored length, segment boundaries do not reset dash allocation state, and cap footprints do not reallocate dash/gap intervals.',
    'Open authored dashed inside/outside strokes use the formal unbounded open center product only when no bounded filled-region domain exists. Open self-intersecting networks with bounded filled regions formed by real authored source segments use constrained dashed products with position-specific ownership: inside paints only filled-contour source spans and excludes dangling open branches, while outside paints exterior contour spans and renders dangling open-branch spans on both sides of the source path with visible normal span equal to stroke.width * 2 within spec width tolerance. Each inspector-declared independent constrained source span owns a source-distance allocation origin, and legal-domain clipping must not create new half-dash terminals, endpoint caps, or redistributed gaps. No invisible closing edge may be added for domain, dash, hit-test, export, or product output.',
    'Stroke domain plan is the single product routing entry point for open/closed semantics. Vector render code and packet builders must not independently map open constrained strokes to center; they consume domain modes such as center-product, closed-constrained-domain, open-contour-constrained-domain, open-dangling-outside-both-sides, and inside-excluded-open-span.',
    'Center dashed visible render is the authored center dashed stroke. Descriptor output is an exact encoding of the same product builder and must not introduce a drag-specific geometry rule.',
    'Constrained dashed render has one product pipeline for static render, drag, descriptor output, render entries, hit/export, cap switches, reload, and pan. It consumes StrokeDomainPlan, emits DashProductInterval records, and materializes body, endpoint cap policy, join ownership, and smooth continuity groups once.',
    'Constrained inside descriptors clip the materialized stroke.width * 2 body/cap/join product by the inside filled-region domain. Constrained outside descriptors clip the same materialized product by the outside legal domain defined in the stroke-engine README and must not add a later per-segment selected-side trim. Open dangling outside spans are explicit both-side source-span domains.',
    'Constrained outside dashed stroke-path descriptors must encode the visible outside band itself: the path may be the source-adjacent outside-band centerline with stroke.width, or another descriptor proven equivalent to the canonical product polygons. Exterior clip edges, outer ribbon edges, boundary-domain edges, and carrier edges are evidence only and must not become visible stroke path centerlines.',
    'Constrained solid stroke-path descriptors are legal only for declared same-owner smooth spans. An authored sharp source vertex must be materialized by canonical source-vertex join product geometry before render; a descriptor or renderer stroke join must not visibly complete that vertex.',
    'When constrained dashed descriptors carry both strokePathGroups and descriptorProductPolygons, render entries materialize strokePathGroups for visible output and treat descriptor product polygons, clip polygons, carrier polygons, and boundary-domain polygons as clip/evidence only. Direct projection of overlapping descriptor polygons is invalid when it creates same-paint overdraw or opacity changes; non-intersection dash body samples remain single-layer.',
    'Descriptor output is only a renderer-ready encoding of DashProductInterval materialization. It must carry product-builder, source revision, domain, interval, terminal, cap policy, join ownership, legal side, smooth-continuity, and output-channel metadata; downstream render code must not infer or re-add endpoint caps.',
    'Resolved split/domain metadata is a shared product-builder input. Drag may reuse it only after validation against the current source revision, topology signature, contour visit identity, domain mode, and split range ids. Visible product output must not retrace the whole source path, recompute source intersections inside render, or switch to a drag-specific geometry path.',
    'Product output emits render, hit, and export descriptors; optional diagnostics and visual overlays consume terminal evidence outside the inspector step graph when explicitly enabled. Visible render must not use diagnostic/helper geometry as product output.',
    'The 2026-06-21 stroke architecture closure evidence is historical and scoped to its named probes, tests, and screenshots. Future pixel bugs must attach current reproducible test names, artifact ids or paths, overlay metadata, and inspected screenshot evidence before closure.',
    'Agent-run E2E, visual, drag, and performance gates use the app-specific ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL declared in apps/asyra-design/.env and pass the same value to PLAYWRIGHT_TEST_BASE_URL. Do not hardcode a localhost port in the visual review contract; if the configured URL points at a user-run server, use that same runtime or stop and report the environment mismatch. Extra ports are opt-in and must be shut down after use.',
    'App visual evidence must come from a runtime that loaded workspace package entrypoints after the current source produced fresh package dist output. A dev runtime that starts Vite against stale package dist output cannot close visual review.',
    'Captured Asyra rule mismatches reopen the earliest owning inspector step. Implementation must not add new local rules before the stroke-engine README owns the semantic rule and the active plan plus inspector flow are synced.',
    'Document-only stroke deep audits must use the fixed Document Deep Audit Protocol matrix from the stroke-engine README: define the full matrix before the pass starts, run every matrix item in one pass, summarize findings together, apply one focused documentation edit batch, rerun the same matrix after edits, and record newly discovered audit concerns as deferred matrix extensions instead of adding surprise focus areas mid-pass.',
    'Stroke computation ownership is stage-locked by the README #computation-ownership-and-timing-contract: every semantic value declares where it is computed, who consumes it, when downstream recomputation is forbidden, and which cache keys prove semantic equivalence.'
  ]

  const stableRuleIds = [
    'stroke-authority-readme',
    'stroke-authority-active-plan',
    'inspector-greenfield-protocol',
    'canonical-visual-review-authority',
    'viewer-shell-only',
    'correctness-before-performance',
    'stroke-vector-system-flow',
    'source-to-render-owner-diagnosis',
    'visible-artifact-not-owner',
    'algorithm-equivalence-evidence',
    'feature-intent-only',
    'common-api-domain-adapter',
    'transaction-undo-boundary',
    'computed-patch-publication',
    'render-mirror-downstream-consumer',
    'current-state-render-contract',
    'stroke-geometry-normalized-input',
    'stage-based-invalidation',
    'canonical-stroke-fill',
    'paint-only-retint',
    'static-parameter-dirtying',
    'stage-dirty-counters',
    'drag-120fps-gate',
    'stage-product-cache-keys',
    'parameter-switch-cache-counters',
    'center-solid-authored-stroke',
    'translucent-center-solid-diagnostics',
    'constrained-solid-doubled-center-mask',
    'inside-solid-doubled-center-pixels',
    'grouped-descriptor-mask-limits',
    'shared-edge-half-width',
    'pentagon-corners-join-sensitive',
    'derivation-evidence-nonvisible',
    'constrained-dashed-interval-domain',
    'constrained-dashed-materialized-products',
    'stroke-domain-plan-legal-side',
    'cap-aware-dash-allocation',
    'inside-dashed-tiny-domain-collapse',
    'outside-dashed-legal-overlap',
    'outside-dashed-canonical-alias',
    'tiny-sliver-layering',
    'terminal-cap-ownership',
    'terminal-cap-vs-join-ownership',
    'high-angle-contributor-whitelist',
    'butt-terminal-strict-endpoint',
    'dash-join-seam-contract',
    'outside-high-acute-continuity-evidence',
    'outside-butt-miter-shared-endpoint-identity',
    'construction-seam-evidence-nonvisible',
    'miter-angle-resolution',
    'miter-source-domain-angle',
    'bevel-by-miter-angle-provenance',
    'dashed-authored-vertex-ownership',
    'miter-recovery-refactor-protocol',
    'stepwise-refactor-runtime-steps',
    'full-regression-three-attempts',
    'outside-dashed-terminal-packets',
    'dirty-incremental-assembly',
    'dirty-assembly-merge',
    'self-intersection-join-owned-terminals',
    'local-vertex-contributor-oracle',
    'curve-dash-smoothness',
    'open-center-dashed-continuous-network',
    'open-constrained-product-rule',
    'stroke-domain-plan-routing-entry',
    'center-dashed-authored-descriptor',
    'constrained-dashed-single-pipeline',
    'inside-outside-descriptor-clipping',
    'outside-dashed-visible-band-descriptor',
    'constrained-solid-smooth-span-descriptor',
    'descriptor-polygons-evidence-only',
    'descriptor-output-product-builder',
    'resolved-split-metadata-validation',
    'output-channel-separation',
    'historical-closure-evidence',
    'app-env-visual-review-gates',
    'fresh-runtime-visual-evidence',
    'rule-mismatch-reopens-owner-step',
    'document-deep-audit-protocol',
    'computation-ownership-timing'
  ]
  const ruleId = (index) => stableRuleIds[index]
  const ruleRegistry = latestRules.map((text, index) => ({
    id: ruleId(index),
    text
  }))
  const ruleTextById = new Map(ruleRegistry.map((rule) => [rule.id, rule.text]))
  const resolveRuleRefs = (refs) =>
    refs.map((ref) => ruleTextById.get(ref)).filter(Boolean)

  const currentExecutionState = {
    totalSteps: 41,
    planStatus: 'post-runtime-correctness-active',
    refactorProtocolName:
      'Inspector-Flow-First Greenfield Stroke Engine Refactor',
    activeRefactorStepId: null,
    activeRefactorStepNumber: null,
    nextExecutableStepId: 'integration-suite',
    nextExecutableStepNumber: null,
    nextExecutableStepStatus: 'active',
    stopRule:
      'Stroke changes must run whole-flow review for the active step group, then advance one inspector implementation step at a time. Stroke tests may enter correctness gates only when they map to the current spec and inspector contracts. After the runtime unit gate passes, focused test-architecture, integration, and formal geometry-oracle work begins automatically; later gates remain ordered by their declared prerequisites.',
    requiredImplementationSequence: [
      'Read the stroke-engine README, active plan, and this inspector data before each refactor segment.',
      'Run the Whole-Flow Review And Step Grouping Contract for the active step group before step-local implementation or advancement.',
      'Keep exactly one inspector step active; all later steps remain locked until the active step is verified.',
      'Write or update only the active step unit test before implementation for that step.',
      'The active step unit test asserts only that step contract: inputs, outputs, conditions, bypass conditions, limitations, owner stage, contributors, evidence, and failure reopening.',
      'Implement only files listed by the active step lock metadata.',
      'Run the refactor protocol validator and the active step unit test before marking the step verified.',
      'Continue this sequence one runtime inspector step at a time until all runtime inspector steps are verified, performing an automatic task replan when the active step reaches its retry limit.',
      'Limit each active inspector step to three focused repair attempts; every attempt must name the failing focused gate or contract mismatch and rerun the focused step gate before the next attempt.',
      'If the third focused repair attempt still fails, keep the same owner step, summarize the blocker, failed gate, owner-stage evidence, and attempted repair paths, then automatically perform a task replan before the next implementation iteration.',
      'Do not run unmapped or stale stroke tests as refactor gates and do not repair production code to satisfy a test that cannot identify its current spec and inspector owner.',
      'After all runtime inspector-step unit tests are verified for the current step graph, record the runtime unit gate and proceed directly to focused test-architecture, integration, and formal geometry-oracle work. Post-runtime validation methods remain separate from runtime implementation steps.',
      'Run full preset regression only after the focused correctness phases, at most three times per task iteration; each failure requires a failing-suite, assertion, owner-stage, and focused-repair summary before retrying, and the third failure automatically enters task replan before another regression attempt.',
      'Run E2E automatically after integration and formal geometry-oracle gates are meaningful and pass; E2E validates user behavior rather than engine architecture. Run visual review only after an explicit user request.',
      'Run performance and cleanup after geometry/product semantics and required runtime behavior gates pass; optional visual review is not a prerequisite.',
      'During runtime implementation, verifiedStepIds must remain a contiguous prefix from step 1 and activeStepId must be the first unverified runtime step derived from that prefix.'
    ],
    blockedDownstreamStepIds: []
  }

  const runtimeVerifiedStepIdPrefix = [
    'feature-session-intent',
    'path-editing-intent',
    'point-handle-drag-operation',
    'structural-vector-operation',
    'common-api-domain-adapter',
    'canonical-workspace-data',
    'validate-topology',
    'computed-patch-builder',
    'transaction-undo-boundary',
    'scene-tree-commit',
    'computed-patch-event',
    'downstream-subscriber-routing',
    'render-mirror-patch-apply',
    'render-data-derivation',
    'dirty-revision-graph',
    'stage-product-cache',
    'render-strategy-entry',
    'normalize-render-data',
    'normalize-stroke-spec',
    'shared-geometry-model',
    'resolve-source-families',
    'resolve-stroke-domains',
    'allocate-dash-intervals',
    'select-stroke-product-family',
    'build-center-stroke-products',
    'build-constrained-solid-products',
    'build-dash-interval-body-products',
    'derive-dash-body-seam-boundaries',
    'build-source-vertex-join-products',
    'build-terminal-body-products',
    'build-smooth-continuity-products',
    'select-stroke-descriptor-strategy',
    'apply-legality',
    'build-resolved-stroke-regions',
    'attach-paint-payload',
    'build-final-faces',
    'materialize-stroke-product-descriptors',
    'emit-render-hit-export-packets',
    'render-entries',
    'renderer-projection',
    'hit-export'
  ]

  const runtimeImplementationState = {
    phase: 'runtime-implementation-unit-complete',
    completedGate: 'runtime-unit-gate',
    schemaRepairStatus: 'complete',
    activeStepId: null,
    activeStepNumber: null,
    activeStepUnitStatus: 'complete',
    activeStepGate:
      'runtime inspector steps verified: yarn workspace @asyra/preset test:stroke-flow:unit',
    verifiedStepIds: [
      'feature-session-intent',
      'path-editing-intent',
      'point-handle-drag-operation',
      'structural-vector-operation',
      'common-api-domain-adapter',
      'canonical-workspace-data',
      'validate-topology',
      'computed-patch-builder',
      'transaction-undo-boundary',
      'scene-tree-commit',
      'computed-patch-event',
      'downstream-subscriber-routing',
      'render-mirror-patch-apply',
      'render-data-derivation',
      'dirty-revision-graph',
      'stage-product-cache',
      'render-strategy-entry',
      'normalize-render-data',
      'normalize-stroke-spec',
      'shared-geometry-model',
      'resolve-source-families',
      'resolve-stroke-domains',
      'allocate-dash-intervals',
      'select-stroke-product-family',
      'build-center-stroke-products',
      'build-constrained-solid-products',
      'build-dash-interval-body-products',
      'derive-dash-body-seam-boundaries',
      'build-source-vertex-join-products',
      'build-terminal-body-products',
      'build-smooth-continuity-products',
      'select-stroke-descriptor-strategy',
      'apply-legality',
      'build-resolved-stroke-regions',
      'attach-paint-payload',
      'build-final-faces',
      'materialize-stroke-product-descriptors',
      'emit-render-hit-export-packets',
      'render-entries',
      'renderer-projection',
      'hit-export'
    ],
    sequentialLockPolicy:
      'runtimeImplementationState.verifiedStepIds must be a contiguous prefix from step 1; activeStepId must equal the first unverified runtime step; no later step may become active until the current active step gate passes and the prefix ledger advances by exactly one step.',
    stepRetryLimit: 3,
    implementationPolicy:
      'Runtime implementation audit/refactor starts only after the current runtime inspector-step unit suite is verified for the revised step graph. The previous 41-step unit result is historical baseline evidence after this inspector-flow replan.',
    advancementRule:
      'For each runtime step, re-read this inspector step contract and referenced spec refs, compare the implementation entry boundary and allowed files to the contract, repair only the current step allowlist when a mismatch is proven, run the active step gate, append only that step id to verifiedStepIds, and then advance runtimeImplementationState.activeStepId to the next first-unverified step.',
    pendingTechnicalPhases: [
      'full package regression',
      'E2E',
      'performance',
      'cleanup'
    ],
    unlockedNextPhases: [
      'post-runtime test architecture',
      'inspector-flow integration',
      'formal geometry oracle'
    ],
    evidenceRequired: [
      'active inspector step contract',
      'referenced stroke engine spec rules',
      'implementation entry boundary mapping',
      'dedicated active step unit test result',
      'protocol validator result',
      'runtime verified step prefix ledger',
      'focused repair attempt count'
    ]
  }

  const finalValidationMethods = [
    {
      id: 'visible-final-result',
      configuredBy: 'explicit-user-request-only',
      stepMembership: 'excluded-from-runtime-inspector-steps',
      kind: 'visible-product-closure',
      requiredAfter: 'explicit-user-request',
      requiredForGoalCompletion: false,
      consumes: [
        'stage:renderer-projection',
        'artifact:renderEntries',
        'artifact:hit-export-packets'
      ],
      requiredEvidence: [
        'current final visible render result',
        'render-entry and hit/export evidence from the completed development graph',
        'failure reopening mapped back to the earliest owning inspector step'
      ],
      limitations: [
        'This validation method is not an inspector owner step.',
        'It must not appear in steps, verifiedStepIds, route targets, or step-unit test files.',
        'It runs only after an explicit user request and does not block automatic phase progression or goal completion.',
        'It may fail and reopen a development owner step, but it may not define stroke product semantics.'
      ]
    },
    {
      id: 'app-visual-review',
      configuredBy: 'explicit-user-request-only',
      stepMembership: 'excluded-from-runtime-inspector-steps',
      kind: 'app-visible-review',
      requiredAfter: 'explicit-user-request',
      requiredForGoalCompletion: false,
      consumes: [
        'stage:renderer-projection',
        'canonical visual review contract'
      ],
      requiredEvidence: [
        'current app visual review artifact',
        'canonical visual group or reported-case mapping',
        'failure reopening mapped back to the earliest owning inspector step'
      ],
      limitations: [
        'This validation method is not an inspector owner step.',
        'It runs only after an explicit user request and does not block automatic phase progression or goal completion.',
        'It may not replace formal source-space or inspector-flow gates.'
      ]
    }
  ]

  const optionalDiagnosticChannels = [
    {
      id: 'runtime-diagnostics',
      configuredBy: 'diagnostics mode only',
      stepMembership: 'excluded-from-runtime-inspector-steps',
      kind: 'non-product-evidence-channel',
      consumes: [
        'upstream final faces',
        'render-entry metadata',
        'renderer projection metadata',
        'hit/export evidence'
      ],
      produces: [
        'bounded diagnostic metadata when diagnostics mode is enabled',
        'cleared diagnostic metadata when diagnostics mode is disabled'
      ],
      limitations: [
        'Runtime diagnostics are not a development step and are not a required final validation method.',
        'Diagnostics may not draw pixels, repair geometry, define hit/export output, or become product source of truth.',
        'Diagnostics-only source files are governed outside the inspector step graph.'
      ]
    }
  ]

  const strokeCompletionMatrix = [
    {
      row: 'framework-aligned-vector-operations',
      requiredEvidence:
        'Feature code sends explicit point/handle or structural operation intent; common APIs produce canonical workspace/world computed patches; one action creates one undo commit; render consumes the current downstream state only. Current render semantics are path-independent across drag, undo, redo, reload, collaboration patches, parameter switches, point edits, and handle edits.',
      status:
        'baseline: point/handle drag and structural vector operation tests pass, including undo/redo and model/render/overlay invariants'
    },
    {
      row: 'data-channel-render-mirror',
      requiredEvidence:
        'Scene-tree publishes computed patch deltas, render mirror applies each patch once, and renderer-ready data is derived from committed mirror state.',
      status:
        'baseline: render mirror patch tests pass; keep this lane in scope for future stroke regressions'
    },
    {
      row: 'self-intersecting-solid-inside',
      requiredEvidence:
        'Doubled authored center stroke clipped by a face, winding, and adjacency-aware inside filled-region mask; internal shared edges reveal half width from each adjacent filled face; all five internal pentagon corners vary with strokeJoin and miterAngle; visible render contains no derivation fragments.',
      status:
        'slice passed: reported 2026-05-31 inside solid case passed probes, e2e pixel gates, and manual screenshot review'
    },
    {
      row: 'self-intersecting-solid-center',
      requiredEvidence:
        'Authored center stroke path is the visible product; descriptor/renderer path projection preserves cap, join, and miter semantics, translucent crossings do not accumulate alpha, and polygon packets stay available for hit/export/diagnostics when needed.',
      status:
        'center solid drag performance slice: opaque alpha-safe frames may use renderer path projection; translucent self-intersecting frames use single-composite descriptor output'
    },
    {
      row: 'self-intersecting-solid-outside',
      requiredEvidence:
        'Doubled authored center stroke clipped by exterior mask with no visible helper products or cut seams.',
      status:
        'architecture closed: outside solid remains on the doubled authored center-stroke product contract and is covered by the product matrix'
    },
    {
      row: 'dashed-constrained-strokes',
      requiredEvidence:
        'Interval-domain dash allocation, terminal half-dashes at true open dashed-line endpoints, cap behavior, and provenance remain separate from solid visible geometry; closed constrained inside/outside dashed visible product geometry is doubled authored center-dashed stroke clipped by the selected legal-domain mask, encoded as exact final faces or a grouped descriptor only when terminal endpoint cap policy does not require one-sided cap ownership. Open self-intersecting networks with bounded filled regions from real authored source segments are constrained dashed products: inside keeps only filled-contour source spans, outside keeps exterior contour spans plus dangling open-branch spans materialized on both sides of the source path, each inspector-declared independent constrained span owns a source-distance allocation origin, and no synthesized closing edge may become domain evidence or product stroke output. Dash cap footprints extend visible endpoints but do not reallocate dash/gap intervals or create legal-cut half terminals; constrained inside tiny domains use the Asyra cap-aware collapse rule declared in the stroke-engine README. Outside compressed legal overlaps may merge visually when provenance, legal side, output channel, and single-composite alpha behavior are correct.',
      status:
        'architecture closed: center/inside/outside dashed static, drag, cap switch, reload, render entry, hit/export, and visual review consume the same product interval and descriptor contract'
    },
    {
      row: 'cross-cutting-render-hit-export',
      requiredEvidence:
        'Render consumes visible descriptors, hit/export may consume non-visible coverage evidence, diagnostics remain opt-in and non-visible.',
      status:
        'architecture closed: render, hit, export, performance gates, configured diagnostics, and reviewed screenshots are separate evidence paths over the same semantic product descriptors'
    }
  ]

  const alignmentLabels = {
    aligned: 'Aligned',
    'stage-cache-validation-active': 'Stage cache validation active',
    'architecture-closed': 'Architecture closed',
    'focused-inside-solid-rule-review-passed': 'Superseded focused-pass claim',
    'not-current-owner': 'Not current owner'
  }

  const strokeDocumentationRefs = [
    'docs/ai/apps/asyra-design/PLANS.md',
    'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md',
    'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js'
  ]

  const canonicalVisualReviewContract = {
    canonicalGroups: [
      'solid inside miter',
      'solid inside bevel',
      'solid inside round',
      'solid center miter',
      'solid center bevel',
      'solid center round',
      'solid outside miter',
      'solid outside bevel',
      'solid outside round',
      'dashed inside butt',
      'dashed inside square',
      'dashed inside round',
      'dashed center butt',
      'dashed center square',
      'dashed center round',
      'dashed outside butt',
      'dashed outside square',
      'dashed outside round'
    ],
    requiredOverlayItems: [
      'actual app-rendered stroke pixels',
      'runtime-derived canonical model source path',
      'fill/even-odd legal domain for closed or self-intersecting paths',
      'centerline and stroke width reference',
      'expected visible stroke region',
      'forbidden stroke region',
      'dash/gap intervals for dashed cases',
      'dashed-collapse provenance labels for constrained inside tiny domains',
      'legal compressed overlap labels for constrained outside dashed overlap',
      'below-visibility-threshold or hard-to-sample labels for legal stable sliver domains when needed',
      'terminal/cap probes',
      'join/corner probes',
      'dash width and source-vertex miter direction probes',
      'overlap/overdraw probes',
      'local visible contributor-count probes',
      'output-channel markers',
      'failure markers for every rule violation'
    ],
    failureMarkers: [
      'missing_dash',
      'source_segment_dropout',
      'inside_gap_leak',
      'outside_leak',
      'wrong_side_dash',
      'terminal_missing',
      'split_terminal_missing',
      'cap_footprint_mismatch',
      'join_footprint_mismatch',
      'dash_illegal_protrusion',
      'dash_width_mismatch',
      'miter_join_wrong_direction',
      'unexpected_visible_contributor',
      'output_channel_leak',
      'source_derived_probe_missing',
      'legal_domain_leak',
      'model_render_drift',
      'double_alpha_overdraw',
      'unexpected_union_or_collapse',
      'lost_interval_provenance'
    ],
    tolerance:
      'Width and span checks use max(0.5 source units, stroke.width * 0.05) source-space tolerance plus at most one CSS pixel raster antialias tolerance.',
    broadCommand:
      'export ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL="$(grep \'^ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL=\' apps/asyra-design/.env | cut -d= -f2-)"; PLAYWRIGHT_TEST_BASE_URL="$ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL" yarn workspace @asyra/asyra-design test:e2e e2e/stroke-new-flow --reporter=line',
    completionEvidence: [
      'overlay path',
      'metadata path',
      'failed marker count',
      'inspected screenshot path',
      'remaining differences',
      'focused product evidence',
      'inspector evidence'
    ]
  }

  const dragPerformanceContract = {
    targetFps: 120,
    frameBudgetMs: 8.33,
    enforceEnv: 'ASYRA_STROKE_DRAG_E2E_ENFORCE_120FPS=1',
    command:
      'export ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL="$(grep \'^ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL=\' apps/asyra-design/.env | cut -d= -f2-)"; ASYRA_STROKE_DRAG_E2E_ENFORCE_120FPS=1 PLAYWRIGHT_TEST_BASE_URL="$ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL" yarn workspace @asyra/asyra-design test:e2e e2e/stroke-drag-render-performance-solid.spec.ts e2e/stroke-drag-render-performance-open-solid.spec.ts e2e/stroke-drag-render-performance-center-dashed.spec.ts e2e/stroke-drag-render-performance-open-center-dashed.spec.ts e2e/stroke-drag-render-performance-inside-dashed.spec.ts e2e/stroke-drag-render-performance-open-inside-dashed.spec.ts e2e/stroke-drag-render-performance-outside-dashed.spec.ts e2e/stroke-drag-render-performance-open-outside-dashed.spec.ts e2e/stroke-drag-render-performance-burst.spec.ts --reporter=line',
    requiredSpecs: [
      'apps/asyra-design/e2e/stroke-drag-render-performance-solid.spec.ts',
      'apps/asyra-design/e2e/stroke-drag-render-performance-open-solid.spec.ts',
      'apps/asyra-design/e2e/stroke-drag-render-performance-center-dashed.spec.ts',
      'apps/asyra-design/e2e/stroke-drag-render-performance-open-center-dashed.spec.ts',
      'apps/asyra-design/e2e/stroke-drag-render-performance-inside-dashed.spec.ts',
      'apps/asyra-design/e2e/stroke-drag-render-performance-open-inside-dashed.spec.ts',
      'apps/asyra-design/e2e/stroke-drag-render-performance-outside-dashed.spec.ts',
      'apps/asyra-design/e2e/stroke-drag-render-performance-open-outside-dashed.spec.ts',
      'apps/asyra-design/e2e/stroke-drag-render-performance-burst.spec.ts'
    ],
    requiredEvidence: [
      'vector point/control drag resolved geometry p95 below 8.33ms unless the stroke-engine README documents a correctness-required exact-geometry exception',
      'vector product render phase p95 below 8.33ms',
      'sustained render flush average below 8.33ms',
      'dirty-stage counters showing source-path drag updates without static stroke parameter or paint revision churn',
      'stage product cache hit, miss, store, and hidden-output counters',
      'Product Output evidence showing no source-intersection retrace and no drag-only geometry route',
      'transaction evidence showing non-undoable intermediate drag updates and one canonical undoable final computed patch'
    ]
  }

  const continuousParameterPerformanceContract = {
    status: 'contract-defined-runtime-gate-pending-prerequisites',
    targetFps: 120,
    frameBudgetMs: 8.33,
    updatePath:
      'production stroke property/common API path with canonical render invalidation',
    addsUiScrubber: false,
    parameterIds: [
      'stroke.width',
      'stroke.dash',
      'stroke.gap',
      'stroke.miterAngle'
    ],
    requiredMetrics: [
      'resolved geometry p95 below 8.33ms',
      'vector product render p95 below 8.33ms',
      'sustained render flush average below 8.33ms',
      'visible non-empty current-state product output',
      'stage dirty and cache hit/miss/store evidence'
    ],
    sampleContract: {
      minimumGeometryRebuildSampleRatio: 0.9,
      requiresCacheRevisit: true,
      p95Population: 'geometry-rebuilding continuous update frames'
    },
    dirtyingEvidence: {
      'stroke.width': [
        'reuse source path/topology',
        'reuse dash interval allocation',
        'rebuild domain, terminal cap, join/miter, and downstream output'
      ],
      'stroke.dash-gap': [
        'rebuild dash interval allocation and downstream output',
        'preserve source topology and join shape revision'
      ],
      'stroke.miterAngle': [
        'rebuild join/miter and downstream output',
        'preserve source path, stroke domain, dash allocation, and paint revisions'
      ]
    },
    discreteUiBudget: {
      endToVisibleP95Ms: 50,
      singleActionMaxMs: 100
    },
    goalCompletionPolicy:
      'The active stroke goal completes only after all 8.33ms continuous-operation gates pass without exception.',
    prerequisites: [
      'runtime inspector steps verified',
      'formal stroke correctness gates pass'
    ]
  }

  const focusedTestExecutionContract = {
    focusedStepTargetMs: 5000,
    focusedGeometryOracleTargetMs: 15000,
    mandatorySplitReviewMs: 30000,
    timingIsCorrectnessAssertion: false,
    innerLoopGateKinds: [
      'protocol validator',
      'active inspector step unit test',
      'one required cross-step handoff test when the active contract crosses a family boundary'
    ],
    checkpointOnlyGates: [
      'test:stroke-flow:unit',
      'test:stroke:new',
      'full stroke E2E matrix',
      'test:local'
    ],
    integrationReviewSegments: [
      'source-mutation-ingress',
      'render-mirror-current-state-cache',
      'source-domain-planning',
      'product-family-coexecution',
      'legality-final-records-descriptors',
      'output-channels'
    ],
    geometryOracleGroups: [
      'normalization-domain',
      'center-product',
      'constrained-product',
      'dash-cap-join',
      'legality-final-face',
      'output-channel'
    ],
    continuousParameterPerformanceGroups: [
      'width',
      'dash-gap',
      'miter-angle'
    ],
    forbiddenPatterns: [
      'unrelated whole-suite gate in the step implementation inner loop',
      'one integration test spanning unrelated whole-flow review families',
      'one heavyweight oracle file spanning unrelated owner families',
      'test duration used as a correctness assertion'
    ]
  }

  const edgeCaseDomainContract = {
    currentStateProductRule:
      'Committed state decides history; current state decides render. Every current source/stroke state must independently satisfy the same stroke product contract regardless of mutation path.',
    insideDashedTinyDomainCollapse: {
      condition:
        'inside legal-domain clipping and cap footprint leave less than the Asyra minimum separate visual gap for a constrained split range',
      product:
        'one dashed-collapse start-end product with DashProductInterval provenance, or non-visible provenance when clipping removes all coverage',
      requiredEvidence: [
        'configured gap and post-cap visible gap compared against configuredGap * 0.6',
        'DashProductInterval, split range, terminal role, domain mode, legal side, endpoint cap policy, join ownership, source/stroke/domain signatures, and runtime revision metadata preserved',
        'legal cut boundaries do not create synthetic half-dashes, endpoint caps, redistributed gaps, or solid-like substitute output',
        'visual overlay marks dashed-collapse provenance and does not treat continuous-looking coverage as solid output'
      ]
    },
    outsideDashedLegalCompressedOverlap: {
      rule: 'Legal outside overlap is determined by provenance, legal side, output channel, and alpha behavior, not by an area or dash/gap-size threshold.',
      requiredEvidence: [
        'each overlapping contributor is a valid outside DashProductInterval before clipping',
        'post-clip coverage remains in the exterior/outside legal domain',
        'contour visit, split range, legal side, terminal role, endpoint cap policy, join ownership, and interval provenance preserved',
        'terminal-interval owned body contributors are allowed only while they remain dash body products, stop at their declared seam boundary, and preserve the same provenance',
        'helper closure, construction-only seam evidence, and source-path replay are not legal visible compressed-overlap contributors',
        'transparent strokes use single-composite or equivalent alpha handling with no double-alpha darkening',
        'visual review does not fail legal overlap as unexpected_visible_contributor, double_alpha_overdraw, or unexpected_union_or_collapse unless the rule above is violated'
      ]
    },
    tinySliverDomainLayering: {
      semanticTopologyLayer:
        'numericalStabilityEpsilon may drop only zero-area, ambiguous, or numerically unstable domains with diagnostics',
      productAllocationLayer:
        'legal stable sliver domains use the normal product contract, inside dashed tiny-domain collapse, or outside legal compressed overlap as applicable',
      visualRasterLayer:
        'visualVisibilityEpsilon may affect sampling and notes only; it must not suppress product packets, hit/export product provenance, or enabled non-product diagnostic evidence'
    }
  }

  const genericAcceptance = [
    'The stroke-engine README states the semantic rule.',
    'Active plan and inspector flow do not add independent stroke semantics.',
    'Miter-angle join migration does not enter implementation until formal oracles assert authoredJoin/resolvedJoin provenance, source-domain vertexAngle evidence, bevel-equivalent footprint, and dashed authored-vertex ownership.',
    'Product descriptors must not collapse authoredJoin:miter plus resolvedJoin:bevel-by-miter-angle into authored bevel.',
    'Runtime changes must prove render, hit, export, and configured final validation correctness separately; optional diagnostics are non-product evidence only when enabled.',
    'Runtime changes must include contributor-count or equivalent ownership evidence for affected acute vertices, source vertices, and self-intersection split terminals.',
    'Drag-sensitive runtime changes must include the enforced 120fps app drag gate and the drag performance evidence listed in dragPerformanceContract.',
    'Edge-case domain changes must include the current-state product, inside dashed tiny-domain collapse, outside dashed legal compressed overlap, and sliver-domain layering evidence listed in edgeCaseDomainContract when affected.',
    'Closure evidence must name reproducible tests, generated artifact ids or paths, overlay metadata, failed marker counts, and inspected screenshots.',
    'Translucent center solid self-intersection review must compare crossing paint strength against adjacent body stroke samples, not only global red-pixel coverage.'
  ]

  const stepSpecs = [
    [
      'feature-session-intent',
      'Interaction',
      0,
      'Feature/session intent',
      'Convert tool input into explicit path-editing, vector operation, or stroke-style intent.'
    ],
    [
      'path-editing-intent',
      'Interaction',
      0,
      'Path editing intent',
      'Keep editing state as behavior intent before any model commit.'
    ],
    [
      'point-handle-drag-operation',
      'Interaction',
      0,
      'Point/handle drag operation',
      'Represent drag update and final drag as explicit point or handle operations.'
    ],
    [
      'structural-vector-operation',
      'Interaction',
      0,
      'Structural vector operation',
      'Represent append, remove, split, connect, close, anchor type, handle mode, and handle updates as explicit operations.'
    ],
    [
      'common-api-domain-adapter',
      'Model Commit',
      1,
      'Common API/domain adapter',
      'Translate explicit operations into canonical vector mutation requests.'
    ],
    [
      'canonical-workspace-data',
      'Model Commit',
      1,
      'Canonical workspace data',
      'Keep vector points in workspace/world coordinates as model truth.'
    ],
    [
      'validate-topology',
      'Model Commit',
      1,
      'Validate topology',
      'Reject malformed vector topology before computed patch construction.'
    ],
    [
      'computed-patch-builder',
      'Model Commit',
      1,
      'Computed patch builder',
      'Emit changed scalar values and record ids only.'
    ],
    [
      'transaction-undo-boundary',
      'Model Commit',
      1,
      'Transaction/undo boundary',
      'Commit one intended user action as one intended undo unit.'
    ],
    [
      'scene-tree-commit',
      'Data Channel',
      2,
      'Scene-tree commit',
      'Apply validated computed patch data to model state.'
    ],
    [
      'computed-patch-event',
      'Data Channel',
      2,
      'Computed patch event',
      'Publish computed patch updates through reactive events after commit.'
    ],
    [
      'downstream-subscriber-routing',
      'Data Channel',
      2,
      'Downstream subscriber routing',
      'Route patch events to render and UI consumers without direct app-to-render sync.'
    ],
    [
      'render-mirror-patch-apply',
      'Render Mirror',
      3,
      'Render mirror patch apply',
      'Apply each committed patch once to render mirror/cache.'
    ],
    [
      'render-data-derivation',
      'Render Mirror',
      3,
      'Render data derivation',
      'Derive renderer-ready vector and stroke data from committed mirror state.'
    ],
    [
      'dirty-revision-graph',
      'Render Mirror',
      3,
      'Dirty revision graph',
      'Classify stroke parameter, stroke.fill, and drag changes into stage-specific dirty revisions.'
    ],
    [
      'stage-product-cache',
      'Render Mirror',
      3,
      'Stage product cache',
      'Reuse exact semantic stroke product descriptors across static parameter switches when geometry-affecting signatures match.'
    ],
    [
      'render-strategy-entry',
      'Render Mirror',
      3,
      'Render strategy entry',
      'Orchestrate render data without deciding stroke semantics.'
    ],
    [
      'normalize-render-data',
      'Stroke Geometry',
      4,
      'Normalize render data',
      'Stabilize authored topology and style inputs.'
    ],
    [
      'normalize-stroke-spec',
      'Stroke Geometry',
      4,
      'Normalize stroke spec',
      'Normalize width, position, cap, join, miter, dash, and canonical stroke.fill paint.'
    ],
    [
      'shared-geometry-model',
      'Stroke Geometry',
      4,
      'Shared geometry model',
      'Build source topology, contours, lengths, faces, regions, boundaries, and self-intersection evidence.'
    ],
    [
      'resolve-source-families',
      'Stroke Geometry',
      4,
      'Resolve source families',
      'Classify formal stroke families without claiming final visual correctness.'
    ],
    [
      'resolve-stroke-domains',
      'Stroke Geometry',
      4,
      'Resolve stroke domains',
      'Resolve mask/domain evidence for model-specific consumption.'
    ],
    [
      'allocate-dash-intervals',
      'Stroke Geometry',
      4,
      'Allocate dash intervals',
      'Allocate dashed intervals only where the dash model owns placement; continuous open routes keep network-level phase, inspector-declared independent dash spans use half-length terminal dashes at both span endpoints and evenly distribute interior dash/gap intervals with the spec-defined minimum gap floor, and legal clipping never creates synthetic dash endpoints, caps, redistributed gaps, or unowned substitute collapse output.'
    ],
    [
      'select-stroke-product-family',
      'Stroke Geometry',
      4,
      'Select stroke product family',
      'Choose the Asyra product family from normalized stroke position, dash state, source family, and domain plan without materializing visible geometry.'
    ],
    [
      'build-center-stroke-products',
      'Stroke Geometry',
      4,
      'Build center stroke products',
      'Build authored center solid or center dashed products and exact center descriptors while preserving cap, join, miter, dash, and closed-state semantics.'
    ],
    [
      'build-constrained-solid-products',
      'Stroke Geometry',
      4,
      'Build constrained solid products',
      'Build constrained solid doubled-center products before legality clipping; masks may clip these products but must not create join shape.'
    ],
    [
      'build-dash-interval-body-products',
      'Stroke Geometry',
      4,
      'Build dash interval body products',
      'Build dash interval body products from DashProductInterval ownership, terminal roles, cap policy, split ranges, and legal-side metadata; preserve enough body boundary evidence for the next seam-boundary step without owning source-vertex joins.'
    ],
    [
      'derive-dash-body-seam-boundaries',
      'Stroke Geometry',
      4,
      'Derive dash body seam boundaries',
      'Derive the non-visible seam boundary artifact from emitted dash body product boundaries, including endpoint identities, outer boundary endpoints, body-side outline segments, tangent evidence, cap suppression state, and provenance required by join and terminal body assembly.'
    ],
    [
      'build-source-vertex-join-products',
      'Stroke Geometry',
      4,
      'Build source-vertex join products',
      'Build canonical source-vertex join products from source-domain tangents, join style, miter angle, verified incident seam boundaries, and owner metadata.'
    ],
    [
      'build-terminal-body-products',
      'Stroke Geometry',
      4,
      'Build terminal body products',
      'Build terminal dash body products that stop at declared seam boundaries and never own authored sharp-vertex completion.'
    ],
    [
      'build-smooth-continuity-products',
      'Stroke Geometry',
      4,
      'Build smooth-continuity products',
      'Build tangent-continuous dash and smooth-span products without creating source-vertex join ownership for high-curvature spans.'
    ],
    [
      'select-stroke-descriptor-strategy',
      'Stroke Geometry',
      4,
      'Select stroke descriptor strategy',
      'Select descriptor eligibility, required legality basis, owner boundaries, and output-channel intent without materializing renderer-ready descriptors.'
    ],
    [
      'apply-legality',
      'Stroke Geometry',
      4,
      'Apply legality',
      'Apply inside filled-region or outside exterior legality to formal product units; keep derivation evidence non-visible.'
    ],
    [
      'build-resolved-stroke-regions',
      'Stroke Geometry',
      4,
      'Build resolved stroke regions',
      'Build semantic stroke records after legality.'
    ],
    [
      'attach-paint-payload',
      'Stroke Geometry',
      4,
      'Attach paint payload',
      'Attach paint without changing geometry.'
    ],
    [
      'build-final-faces',
      'Stroke Geometry',
      4,
      'Build final faces',
      'Preserve model-separated provenance and visible/non-visible separation; center dashed and constrained inside/outside dashed may carry exact render descriptors instead of requiring drag-time visible polygon faces.'
    ],
    [
      'materialize-stroke-product-descriptors',
      'Product Output',
      5,
      'Materialize stroke product descriptors',
      'Encode final-face or post-legality product records into renderer-ready descriptors without changing visible ownership.'
    ],
    [
      'emit-render-hit-export-packets',
      'Product Output',
      5,
      'Emit render/hit/export packets',
      'Project render, hit, and export packets without changing stroke semantics.'
    ],
    [
      'render-entries',
      'Product Output',
      5,
      'Render entries',
      'Prepare renderer-ready visible descriptors; exact center solid alpha-safe renderer path strokes, translucent center solid single-composite descriptors, center dashed strokePath descriptors, and constrained dashed mask descriptors may bypass visible polygon projection because each descriptor already represents product-visible geometry.'
    ],
    [
      'renderer-projection',
      'Product Output',
      5,
      'Renderer projection',
      'Draw upstream descriptors without repairing stroke semantics.'
    ],
    [
      'hit-export',
      'Product Output',
      5,
      'Hit/export',
      'Project hit and export from upstream semantic data.'
    ]
  ]

  const refactorProtocol = {
    name: 'Inspector-Flow-First Greenfield Stroke Engine Refactor',
    activeStepId: currentExecutionState.activeRefactorStepId,
    currentMode:
      currentExecutionState.planStatus === 'inspector-flow-schema-repair-active'
        ? 'schema-repair'
        : 'product-step-refactor',
    schemaRepairGate:
      'packages/preset/src/__tests__/stroke-flow-refactor-protocol.test.ts',
    unitTestRoot: 'packages/preset/src/__tests__/stroke-flow/',
    protocolValidatorTest:
      'packages/preset/src/__tests__/stroke-flow-refactor-protocol.test.ts',
    testConformancePolicy:
      'Stroke tests may enter correctness gates only when they map to the current stroke engine spec, inspector step or route, owner stage, artifact channel, and expected output shape. Tests that assert retired behavior, depend on stale helpers, or lack a current owner mapping must be removed or rewritten before they can remain in the stroke gate set.',
    strokeCorrectnessGate: 'yarn workspace @asyra/preset test:stroke:new',
    stepExecutionPolicy:
      'Run the stroke whole-flow review group first, then implement one runtime inspector owner step at a time until every runtime inspector step in the current graph is verified; do not advance the lock until the active step dedicated unit test, active whole-flow review group check, and protocol validator pass. Post-runtime validation gates are tracked outside runtime steps.',
    stepRetryLimit: 3,
    stepRetryFailurePolicy:
      'Each focused repair attempt must start from a named failing focused gate or contract mismatch and rerun the focused step gate. If the third attempt still fails, keep the same owner step, summarize blocker evidence and attempted repair paths, and automatically perform a task replan before the next implementation iteration.',
    runtimeImplementationPolicy:
      'Runtime implementation begins only after the inspector-step unit baseline passes. runtimeImplementationState keeps every unit refactorStatus verified, runs whole-flow review before the active step, and advances one runtime active step at a time from the first inspector step. Runtime active step selection is derived from the verifiedStepIds contiguous prefix; activeStepId must always equal the first unverified runtime step.',
    integrationPolicy:
      'After the runtime unit gate passes, focused test-architecture, inspector-flow integration, and formal geometry oracle gates begin automatically as stroke correctness gates. E2E starts automatically after those gates are meaningful and pass; performance and full regression follow their technical prerequisites.',
    fullRegressionRetryLimit: 3,
    fullRegressionFailurePolicy:
      'Full preset regression may be attempted at most three times per task iteration in the later regression phase. After each failed attempt, summarize the failing suite, assertion, owner stage, and focused repair path. If the third attempt fails, automatically perform a task replan before another regression attempt.',
    e2ePolicy:
      'E2E starts automatically after focused integration and formal geometry-oracle gates are meaningful and pass; E2E validates user behavior only. Visual review runs only after an explicit user request and never blocks E2E, performance, regression, or goal completion.',
    documentDeepAuditPolicy:
      'Document-only schema/spec audits must use the README Document Deep Audit Protocol fixed matrix before editing, rerun the same matrix after editing, and defer new audit concerns to the next validated matrix pass.'
  }

  const documentDeepAuditProtocol = {
    source:
      'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#document-deep-audit-protocol',
    requiredPassOrder: [
      'define complete matrix before the deep audit starts',
      'run every matrix item in one pass',
      'summarize all findings together',
      'apply one focused documentation edit batch',
      'rerun the same matrix after edits',
      'record newly discovered audit concerns as deferred matrix extensions'
    ],
    minimumMatrix: [
      'source-of-truth boundaries',
      'inspector/spec separation',
      'reference-calibrated stroke parameter rules',
      'join and miter resolution',
      'dash body, dash cap, and join seam continuity',
      'smooth-continuity and high-curvature routing',
      'center/inside/outside construction',
      'artifact lifecycle',
      'spec-to-enforcement lifecycle contracts',
      'channel separation',
      'cache, dirty, bypass, and current-state rendering',
      'owner-stage metadata',
      'forbidden contributors',
      'route predicates and reachability',
      'artifact registry integrity',
      'retired wording scan',
      'numeric tolerance and evidence uniqueness',
      'test/refactor/visual policy'
    ],
    forbiddenAuditBehavior: [
      'adding a new focus area during the same deep-audit pass',
      'editing documentation before the complete matrix has been declared',
      'claiming closure from one matrix subsection',
      'rerunning a different matrix after edits without updating the protocol first'
    ],
    validationGate:
      'packages/preset/src/__tests__/stroke-flow-refactor-protocol.test.ts'
  }

  const confirmedSegmentSkipReviewConditions = [
    'inputs unchanged',
    'outputs unchanged',
    'routes unchanged',
    'artifacts unchanged',
    'consumers unchanged',
    'formal gates unchanged',
    'source anchors unchanged',
    'active-plan execution constraints unchanged'
  ]

  const closureStateMachine = {
    sourceRule:
      'docs/ai/framework/rules/inspector-closure-readiness.md',
    states: [
      'pending-review',
      'contract-closed',
      'family-dataflow-closed',
      'implementation-ready',
      'runtime-closed'
    ],
    runtimeOnlyStates: ['pending-runtime-gates', 'runtime-blocked'],
    implementationReadyRequires: [
      'contract status is contract-closed',
      'family dataflow status is family-dataflow-closed or not-applicable',
      'cross-family handoffs are declared and tested',
      'formal gates are named and current',
      'runtime blockers, if any, name owner step and oracle',
      'reopen conditions are explicit'
    ],
    runtimeClosureRequires: [
      'focused owner-step gates',
      'whole-flow contract gate',
      'integration gates for cross-family handoffs',
      'formal geometry or runtime oracle gates when product semantics are affected',
      'required post-runtime visual/app validation gates when requested by the user'
    ],
    forbiddenTransitions: [
      'pending-review -> implementation-ready',
      'contract-closed -> runtime-closed without runtime gates',
      'runtime-blocked -> contract-open unless the runtime failure proves a contract contradiction',
      'confirmed-complete without a closure packet'
    ]
  }

  const wholeFlowClosurePackets = [
    {
      id: 'closure:source-mutation-ingress',
      segmentId: 'source-mutation-ingress',
      coveredStepIds: [
        'feature-session-intent',
        'path-editing-intent',
        'point-handle-drag-operation',
        'structural-vector-operation',
        'common-api-domain-adapter',
        'canonical-workspace-data',
        'validate-topology',
        'computed-patch-builder',
        'transaction-undo-boundary',
        'scene-tree-commit',
        'computed-patch-event',
        'downstream-subscriber-routing'
      ],
      closureState: 'implementation-ready',
      contractStatus: 'contract-closed',
      familyDataflowStatus: 'not-applicable',
      runtimeStatus: 'not-started',
      specAnchors: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#whole-flow-review-and-step-grouping-contract'
      ],
      routeIds: [
        'linear-feature-session-intent-to-path-editing-intent',
        'linear-path-editing-intent-to-point-handle-drag-operation',
        'linear-point-handle-drag-operation-to-structural-vector-operation',
        'linear-structural-vector-operation-to-common-api-domain-adapter',
        'linear-common-api-domain-adapter-to-canonical-workspace-data',
        'linear-canonical-workspace-data-to-validate-topology',
        'linear-validate-topology-to-computed-patch-builder',
        'linear-computed-patch-builder-to-transaction-undo-boundary',
        'linear-transaction-undo-boundary-to-scene-tree-commit',
        'linear-scene-tree-commit-to-computed-patch-event',
        'linear-computed-patch-event-to-downstream-subscriber-routing',
        'linear-downstream-subscriber-routing-to-render-mirror-patch-apply'
      ],
      computedArtifactIds: ['artifact:canonical-workspace-data'],
      preservedArtifactIds: ['artifact:computed-patch'],
      consumedArtifactIds: ['artifact:user-intent'],
      projectedArtifactIds: [],
      validatedArtifactIds: ['artifact:topology-validation-evidence'],
      downstreamConsumers: [
        'render-mirror-current-state-cache',
        'source-domain-planning'
      ],
      crossFamilyHandoffs: [
        'canonical workspace mutation and computed patch identity feed render mirror current-state derivation'
      ],
      semanticValueOwners: [
        'source mutation intent -> point/structural operation owner',
        'canonical workspace state -> canonical-workspace-data',
        'computed patch -> computed-patch-builder'
      ],
      mustNotRecomputeAfter: ['render-mirror-patch-apply'],
      formalGates: [
        'packages/preset/src/__tests__/stroke-flow-refactor-protocol.test.ts',
        'yarn workspace @asyra/preset test:stroke-flow:unit'
      ],
      runtimeEvidence: [],
      reopenConditions: confirmedSegmentSkipReviewConditions,
      remainingScope: []
    },
    {
      id: 'closure:render-mirror-current-state-cache',
      segmentId: 'render-mirror-current-state-cache',
      coveredStepIds: [
        'render-mirror-patch-apply',
        'render-data-derivation',
        'dirty-revision-graph',
        'stage-product-cache',
        'render-strategy-entry'
      ],
      closureState: 'implementation-ready',
      contractStatus: 'contract-closed',
      familyDataflowStatus: 'not-applicable',
      runtimeStatus: 'not-started',
      specAnchors: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#cache-and-current-state-contract'
      ],
      routeIds: [
        'linear-downstream-subscriber-routing-to-render-mirror-patch-apply',
        'linear-render-mirror-patch-apply-to-render-data-derivation',
        'linear-render-data-derivation-to-dirty-revision-graph',
        'linear-dirty-revision-graph-to-stage-product-cache',
        'linear-stage-product-cache-to-render-strategy-entry',
        'linear-render-strategy-entry-to-normalize-render-data',
        'source-drag-dirty-classification',
        'paint-only-cache-retint',
        'hidden-output-cache-bypass',
        'verified-product-descriptor-cache-hit'
      ],
      computedArtifactIds: ['artifact:current-render-data'],
      preservedArtifactIds: ['artifact:dirty-revision-graph'],
      consumedArtifactIds: ['artifact:computed-patch'],
      projectedArtifactIds: [],
      validatedArtifactIds: ['artifact:stage-cache-reuse-evidence'],
      downstreamConsumers: ['source-domain-planning'],
      crossFamilyHandoffs: [
        'current render data and cache decision feed normalized render/stroke input'
      ],
      semanticValueOwners: [
        'dirty revision identity -> dirty-revision-graph',
        'stage product cache key -> stage-product-cache',
        'render strategy entry -> render-strategy-entry'
      ],
      mustNotRecomputeAfter: ['normalize-render-data'],
      formalGates: [
        'packages/preset/src/__tests__/stroke-flow-refactor-protocol.test.ts',
        'yarn workspace @asyra/preset test:stroke-flow:unit'
      ],
      runtimeEvidence: [],
      reopenConditions: confirmedSegmentSkipReviewConditions,
      remainingScope: []
    },
    {
      id: 'closure:source-domain-planning',
      segmentId: 'source-domain-planning',
      coveredStepIds: [
        'normalize-render-data',
        'normalize-stroke-spec',
        'shared-geometry-model',
        'resolve-source-families',
        'resolve-stroke-domains',
        'allocate-dash-intervals',
        'select-stroke-product-family'
      ],
      closureState: 'implementation-ready',
      contractStatus: 'contract-closed',
      familyDataflowStatus: 'family-dataflow-closed',
      runtimeStatus: 'pending-runtime-gates',
      specAnchors: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#computation-ownership-and-timing-contract',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#preserve-only-artifact-contract'
      ],
      routeIds: [
        'linear-render-strategy-entry-to-normalize-render-data',
        'linear-normalize-render-data-to-normalize-stroke-spec',
        'linear-normalize-stroke-spec-to-shared-geometry-model',
        'linear-shared-geometry-model-to-resolve-source-families',
        'linear-resolve-source-families-to-resolve-stroke-domains',
        'linear-resolve-stroke-domains-to-allocate-dash-intervals',
        'linear-allocate-dash-intervals-to-select-stroke-product-family',
        'select-center-product-family',
        'select-constrained-solid-product-family',
        'select-constrained-dashed-product-family',
        'select-product-family-unsupported',
        'open-dangling-outside-both-side-span'
      ],
      computedArtifactIds: [
        'artifact:normalized-stroke-spec',
        'artifact:stroke-domain-plan',
        'artifact:dash-product-interval'
      ],
      preservedArtifactIds: [
        'artifact:stroke-domain-plan',
        'artifact:dash-product-interval'
      ],
      consumedArtifactIds: ['artifact:current-render-data'],
      projectedArtifactIds: [],
      validatedArtifactIds: ['artifact:product-family-selection-evidence'],
      downstreamConsumers: ['product-family-coexecution'],
      crossFamilyHandoffs: [
        'StrokeDomainPlan and DashProductInterval records feed product-family builders as downstream authority'
      ],
      semanticValueOwners: [
        'StrokeDomainPlan -> resolve-stroke-domains',
        'DashProductInterval -> allocate-dash-intervals',
        'product-family route -> select-stroke-product-family'
      ],
      mustNotRecomputeAfter: [
        'build-dash-interval-body-products',
        'build-source-vertex-join-products',
        'build-terminal-body-products'
      ],
      formalGates: [
        'packages/preset/src/__tests__/stroke-flow-refactor-protocol.test.ts',
        'yarn workspace @asyra/preset test:stroke-flow:unit'
      ],
      runtimeEvidence: [
        {
          stepId: 'shared-geometry-model',
          oracle: 'step-20-incremental-diagnostics-and-phase-attribution-gate',
          status: 'passed',
          description:
            'Step 20 aggregates pair-cache diagnostics once per resolved build while preserving exact hit, miss, signature-remap, and consecutive-skip totals, and now attributes every source-split materialization subphase while preserving cache-bypass output. Protocol plus Step 20 passed 34 tests, the resolved geometry regression passed 9 tests, the preset TypeScript build passed, and focused lint passed. On port 3001, intersections improved from approximately 0.40ms average and 0.80ms p95 to 0.3625ms average and 0.50ms p95 while hit 902, miss 405, and consecutive-skip 5,544 totals remained unchanged. The latest source-split pass measures 0.2042ms legal-face materialization, 0.0917ms contour merge, 0.0208ms cache store, and 0.3583ms total materialization average.'
        }
      ],
      reopenConditions: confirmedSegmentSkipReviewConditions,
      remainingScope: [
        'Retain Step 20 source-domain correctness in the broader formal oracle and integration checkpoints; reopen performance only if later attribution makes shared geometry dominant.'
      ]
    },
    {
      id: 'closure:product-family-coexecution',
      segmentId: 'product-family-coexecution',
      coveredStepIds: [
        'build-center-stroke-products',
        'build-constrained-solid-products',
        'build-dash-interval-body-products',
        'derive-dash-body-seam-boundaries',
        'build-source-vertex-join-products',
        'build-terminal-body-products',
        'build-smooth-continuity-products',
        'select-stroke-descriptor-strategy'
      ],
      closureState: 'pending-review',
      contractStatus: 'pending-review',
      familyDataflowStatus: 'pending-review',
      runtimeStatus: 'pending-runtime-gates',
      specAnchors: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#whole-flow-review-and-step-grouping-contract',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#computation-ownership-and-timing-contract',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#preserve-only-artifact-contract',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#constrained-dashed-product-evidence-envelope'
      ],
      routeIds: [
        'select-center-product-family',
        'select-constrained-solid-product-family',
        'select-constrained-dashed-product-family',
        'center-products-coexecute-source-vertex-join-products',
        'constrained-solid-products-coexecute-source-vertex-join-products',
        'constrained-solid-products-coexecute-smooth-continuity-products',
        'constrained-dashed-products-derive-seam-boundaries',
        'constrained-dashed-products-coexecute-source-vertex-join-products',
        'constrained-dashed-products-coexecute-terminal-body-products',
        'constrained-dashed-products-coexecute-smooth-continuity-products',
        'constrained-dashed-products-coexecute-descriptor-strategy',
        'center-solid-authored-stroke-descriptor',
        'center-dashed-authored-stroke-descriptor',
        'center-products-canonical-output-else',
        'center-solid-canonical-source-vertex-join-footprint',
        'constrained-solid-doubled-center-mask',
        'constrained-solid-canonical-source-vertex-join-footprint',
        'constrained-solid-same-owner-smooth-span-descriptor',
        'smooth-continuity-products-canonical-output-else',
        'constrained-dashed-interval-body-product',
        'constrained-dashed-source-vertex-join-product',
        'constrained-dashed-join-owned-terminal-body-product',
        'constrained-dashed-smooth-continuity-product',
        'descriptor-strategy-canonical-output-else'
      ],
      computedArtifactIds: [
        'artifact:preLegalityProductUnits',
        'artifact:constrained-dashed-interval-body-product',
        'artifact:dash-body-seam-boundary',
        'artifact:source-vertex-join-miter-evidence',
        'artifact:constrained-dashed-source-vertex-join-product',
        'artifact:constrained-dashed-join-owned-terminal-body-product',
        'artifact:constrained-dashed-smooth-continuity-product',
        'artifact:descriptorStrategyRecords'
      ],
      preservedArtifactIds: [
        'artifact:stroke-domain-plan',
        'artifact:dash-product-interval',
        'artifact:dash-body-seam-boundary'
      ],
      consumedArtifactIds: [
        'artifact:stroke-domain-plan',
        'artifact:dash-product-interval',
        'artifact:normalized-stroke-spec'
      ],
      projectedArtifactIds: [],
      validatedArtifactIds: [
        'artifact:source-vertex-join-miter-evidence',
        'artifact:descriptorStrategyRecords'
      ],
      downstreamConsumers: [
        'apply-legality',
        'build-final-faces',
        'render-entries',
        'hit-export'
      ],
      crossFamilyHandoffs: [
        'owner-preserving pre-legality product union feeds apply-legality without geometry or semantic recomputation',
        'dash body and join product identity plus non-visible terminal/smooth ownership overlays must preserve through final faces and render entries',
        'DashProductInterval and seam-boundary artifacts remain downstream authority for legality, final faces, render entries, and hit/export',
        'eligible descriptor-backed composites consume canonical Step 29 join polygon references as completed mask contributors without join reconstruction'
      ],
      semanticValueOwners: [
        'center body and exact center descriptor -> build-center-stroke-products',
        'constrained solid doubled-center body -> build-constrained-solid-products',
        'dash body visible footprint or exact body geometry program, including terminal and smooth portions -> build-dash-interval-body-products',
        'dash seam-boundary evidence -> derive-dash-body-seam-boundaries',
        'source vertex join and miter evidence -> build-source-vertex-join-products',
        'terminal role, cap side, seam, and join ownership overlay -> build-terminal-body-products',
        'smooth continuity group and tangent/curve-offset proof overlay -> build-smooth-continuity-products',
        'descriptor eligibility -> select-stroke-descriptor-strategy'
      ],
      mustNotRecomputeAfter: ['apply-legality'],
      formalGates: [
        'packages/preset/src/__tests__/stroke-flow-refactor-protocol.test.ts',
        'packages/preset/src/__tests__/stroke-flow/step-29-build-source-vertex-join-products.test.ts',
        'packages/preset/src/__tests__/stroke-flow/step-32-select-stroke-descriptor-strategy.test.ts',
        'yarn workspace @asyra/preset test:stroke-flow:unit'
      ],
      runtimeEvidence: [
        {
          stepId: 'build-terminal-body-products',
          oracle: 'constrained-dashed-inside-strict-performance-gate-on-port-3001',
          status: 'passed',
          description:
            'The focused inside-dashed strict gate against the agent-owned port 3001 passed with resolved geometry p95 2.10ms, vector render p95 8.30ms, and sustained flush average 7.24ms. Continuous width, dash/gap, and miter gates must be rerun on port 3001 after the evidence-envelope replacement.'
        },
        {
          stepId: 'build-source-vertex-join-products',
          oracle: 'constrained-dashed-step-29-canonical-artifact-reuse-gate',
          status: 'passed',
          description:
            'Step 29 now preserves canonical join polygon references through legality and descriptor exclusion indexes, reuses per-plan and per-polygon-set bounds, and carries one owner join-angle resolution into packet metadata. Protocol plus Step 29 passed 54 tests, seven focused source-space geometry oracles passed, and the preset TypeScript build passed. On port 3001, join-record p95 improved from 1.20ms to 0.70ms, join-packet p95 from 0.70ms to 0.30ms, raw source-product p95 from 1.80ms to 0.90ms, and product-assembly p95 from 3.10ms to 1.80ms. The global strict vector gate remains open at 10.00ms p95.'
        }
      ],
      runtimeBlockers: [
        {
          stepId: 'build-source-vertex-join-products',
          oracle: 'descriptor-composite-canonical-join-reference-gate',
          status: 'pending-contract-gate',
          description:
            'The composite handoff must preserve canonical Step 29 join polygon references and all angle/seam evidence without normalization, reconstruction, or restyling.'
        },
        {
          stepId: 'select-stroke-descriptor-strategy',
          oracle: 'descriptor-composite-eligibility-gate',
          status: 'pending-contract-gate',
          description:
            'Eligibility must fail closed for incompatible paint, legal-domain, owner-boundary, channel, or missing differential-proof inputs.'
        }
      ],
      reopenConditions: confirmedSegmentSkipReviewConditions,
      remainingScope: [
        'Close the descriptor-composite eligibility and canonical-join-reference handoff gates.',
        'Run the full product-family unit and integration regression after the algorithm replacement.'
      ]
    },
    {
      id: 'closure:legality-final-records-descriptors',
      segmentId: 'legality-final-records-descriptors',
      coveredStepIds: [
        'apply-legality',
        'build-resolved-stroke-regions',
        'attach-paint-payload',
        'build-final-faces',
        'materialize-stroke-product-descriptors'
      ],
      closureState: 'pending-review',
      contractStatus: 'pending-review',
      familyDataflowStatus: 'pending-review',
      runtimeStatus: 'pending-runtime-gates',
      specAnchors: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#product-legality-and-descriptor-encoding',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#preserve-only-artifact-contract',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#constrained-dashed-product-evidence-envelope',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#cache-key-owner-contract'
      ],
      routeIds: [
        'linear-apply-legality-to-build-resolved-stroke-regions',
        'linear-build-resolved-stroke-regions-to-attach-paint-payload',
        'linear-attach-paint-payload-to-build-final-faces',
        'constrained-dashed-descriptor-materialization',
        'legality-product-unit-clipping',
        'canonical-final-face-render-entry',
        'descriptor-output-versus-canonical-packet-output'
      ],
      computedArtifactIds: [
        'artifact:postLegalityProductUnits',
        'artifact:finalFaces',
        'artifact:constrained-dashed-render-descriptor'
      ],
      preservedArtifactIds: [
        'artifact:preLegalityProductUnits',
        'artifact:dash-product-interval',
        'artifact:dash-body-seam-boundary',
        'artifact:descriptorStrategyRecords'
      ],
      consumedArtifactIds: [
        'artifact:preLegalityProductUnits',
        'artifact:descriptorStrategyRecords'
      ],
      projectedArtifactIds: ['artifact:constrained-dashed-render-descriptor'],
      validatedArtifactIds: ['artifact:legalityEquivalentProductUnits'],
      downstreamConsumers: ['output-channels'],
      crossFamilyHandoffs: [
        'post-legality product units and final faces feed render/hit/export channels as required product artifacts',
        'eligible final faces preserve one exact deferred projection recipe and conservative bounds without invoking body polygon materialization'
      ],
      semanticValueOwners: [
        'legal clip/delete evidence -> apply-legality',
        'resolved stroke regions -> build-resolved-stroke-regions',
        'resolved-packet cache-key common basis and aliases -> build-resolved-stroke-regions',
        'paint payload -> attach-paint-payload',
        'final-face identity set -> build-final-faces',
        'renderer-ready descriptor -> materialize-stroke-product-descriptors'
      ],
      mustNotRecomputeAfter: ['render-entries', 'hit-export'],
      formalGates: [
        'packages/preset/src/__tests__/stroke-flow-refactor-protocol.test.ts',
        'packages/preset/src/__tests__/stroke-flow/step-34-build-resolved-stroke-regions.test.ts',
        'packages/preset/src/__tests__/stroke-flow/step-36-build-final-faces.test.ts',
        'packages/preset/src/__tests__/stroke-flow/step-37-materialize-stroke-product-descriptors.test.ts',
        'yarn workspace @asyra/preset test:stroke-flow:unit',
        'yarn workspace @asyra/preset test:stroke-flow:integration',
        'yarn workspace @asyra/preset vitest run src/__tests__/stroke-geometry-oracles/legality-clipping-runtime-oracle.test.ts -t "clips pre-legality inside performance-star source-vertex products with the exact backend" --reporter=dot',
        'yarn workspace @asyra/preset vitest run src/__tests__/stroke-geometry-oracles/legality-clipping-runtime-oracle.test.ts --reporter=dot'
      ],
      runtimeEvidence: [
        {
          stepId: 'build-resolved-stroke-regions',
          oracle: 'constrained-dashed-resolved-packet-cache-key-basis-gate',
          status: 'passed',
          description:
            'Step 34 composes one immutable common key basis and derives early, full, and join-independent aliases without per-alias semantic serialization. The focused phase improved from approximately 0.9ms p95 / 0.221ms average to 0.10ms p95 / 0.0375ms average; Step 34, Step 37 handoff, constrained-product oracle, and preset build gates pass.'
        },
        {
          stepId: 'materialize-stroke-product-descriptors',
          oracle: 'constrained-dashed-step-37-owner-local-dedup-gate',
          status: 'passed',
          description:
            'Step 37 now performs one aggregate cache lookup per compatibility group, delegates tangent normalization once to the ribbon owner, and consumes validated simple-outline polygons directly. Cache misses dropped from 44 to 22 across 22 rebuild frames, ribbon used/fallback counts remained 1052/30, and focused product/final-face oracles pass.'
        },
        {
          stepId: 'build-center-stroke-products',
          oracle: 'shared-ribbon-single-normalization-gate',
          status: 'passed',
          description:
            'The Step 25 manual ribbon owner now performs one dedupe/area normalization for unsuppressed outlines and uses squared distance/collinearity checks. Four cap/join/suppression fingerprints are byte-equivalent at six decimals, Step 25/37 plus protocol passed 54 tests, focused center/constrained/cap/smooth oracles and the preset build pass, and ribbon used/fallback counts remain 523/27. On port 3001, product-evidence average improved from 0.99ms to 0.90ms and p95 from 1.70ms to 1.60ms; strict sustained flush average now passes at 8.08ms while vector p95 remains open at 9.60ms.'
        },
        {
          stepId: 'apply-legality',
          oracle: 'inside-performance-star-exact-backend-intersection',
          status: 'passed',
          description:
            'The exact geometry backend clips the same pre-legality source-vertex products to the declared even-odd legal domain with zero wrong-side samples.'
        },
        {
          stepId: 'apply-legality',
          oracle: 'inside-performance-star-post-legality-product-boundary',
          status: 'passed',
          description:
            'The full focused legality oracle passes with zero wrong-side source-vertex join and join-owned terminal-body packet samples and preserves the result through final-face and render-entry boundaries.'
        },
        {
          stepId: 'build-source-vertex-join-products',
          oracle: 'post-legality-source-vertex-preserve-through',
          status: 'passed',
          description:
            'Source-vertex seam-evidence canonicalization no longer rebuilds or replaces visible join geometry after apply-legality.'
        },
        {
          stepId: 'build-terminal-body-products',
          oracle: 'post-legality-terminal-body-preserve-through',
          status: 'passed',
          description:
            'Canonical terminal-body seam metadata updates preserve the Step 33 visible product polygons without post-legality seam insertion.'
        }
      ],
      runtimeBlockers: [
        {
          stepId: 'materialize-stroke-product-descriptors',
          oracle: 'descriptor-composite-eager-lazy-geometry-equivalence-gate',
          status: 'pending-contract-gate',
          description:
            'Step 37 must prove zero symmetric-difference area, cap/join/seam parity, conservative bounds containment, and complete identity before eager body polygons may be deferred.'
        },
        {
          stepId: 'build-final-faces',
          oracle: 'descriptor-backed-final-face-no-materialization-gate',
          status: 'pending-contract-gate',
          description:
            'Step 36 must preserve the exact projection recipe, conservative bounds, canonical join masks, and complete envelope without invoking deferred materialization.'
        }
      ],
      reopenConditions: confirmedSegmentSkipReviewConditions,
      remainingScope: [
        'Run the full stroke-flow integration and package regression gates after the remaining output performance work.'
      ]
    },
    {
      id: 'closure:output-channels',
      segmentId: 'output-channels',
      coveredStepIds: [
        'emit-render-hit-export-packets',
        'render-entries',
        'renderer-projection',
        'hit-export'
      ],
      closureState: 'pending-review',
      contractStatus: 'pending-review',
      familyDataflowStatus: 'pending-review',
      runtimeStatus: 'pending-runtime-gates',
      specAnchors: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#product-legality-and-descriptor-encoding',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#whole-flow-review-and-step-grouping-contract',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#constrained-dashed-product-evidence-envelope'
      ],
      routeIds: [
        'canonical-final-face-render-entry',
        'constrained-dashed-inside-mask-descriptor',
        'constrained-dashed-outside-source-domain-descriptor',
        'constrained-dashed-outside-aggregate-descriptor',
        'linear-emit-render-hit-export-packets-to-render-entries',
        'linear-render-entries-to-renderer-projection',
        'descriptor-output-versus-canonical-packet-output',
        'hit-export-channel-packet-projection',
        'render-projection-merge'
      ],
      computedArtifactIds: ['artifact:renderEntries', 'artifact:hit-export-packets'],
      preservedArtifactIds: [
        'artifact:finalFaces',
        'artifact:constrained-dashed-render-descriptor',
        'artifact:dash-product-interval',
        'artifact:dash-body-seam-boundary'
      ],
      consumedArtifactIds: [
        'artifact:finalFaces',
        'artifact:constrained-dashed-render-descriptor',
        'artifact:postLegalityProductUnits'
      ],
      projectedArtifactIds: ['artifact:renderEntries', 'artifact:hit-export-packets'],
      validatedArtifactIds: ['artifact:same-paint-composite-state'],
      downstreamConsumers: [
        'renderer-projection',
        'hit-export',
        'post-runtime-visible-final-result',
        'post-runtime-app-visual-review'
      ],
      crossFamilyHandoffs: [
        'final faces and descriptors project into render entries without recomputation',
        'render entries project into renderer draw calls without repair',
        'hit/export consumes final-face or packet evidence without visible-pixel authority',
        'render preserves but never invokes deferred projection while hit/export share one cached exact materialization per final-face identity'
      ],
      semanticValueOwners: [
        'render/hit/export packet projection -> emit-render-hit-export-packets',
        'render-entry identity set -> render-entries',
        'renderer draw calls -> renderer-projection',
        'hit/export product channel -> hit-export'
      ],
      mustNotRecomputeAfter: ['renderer-projection', 'hit-export'],
      formalGates: [
        'packages/preset/src/__tests__/stroke-flow-refactor-protocol.test.ts',
        'packages/preset/src/__tests__/stroke-flow/step-38-emit-render-hit-export-packets.test.ts',
        'packages/preset/src/__tests__/stroke-flow/step-39-render-entries.test.ts',
        'packages/preset/src/__tests__/stroke-flow/step-41-hit-export.test.ts',
        'packages/preset/src/__tests__/stroke-geometry-oracles/legality-output-boundary-runtime-oracle.test.ts',
        'packages/preset/src/__tests__/stroke-geometry-oracles/reported-vector-34-output-oracle.test.ts',
        'packages/preset/src/__tests__/stroke-geometry-oracles/reported-vector-34-output-outside-legality-oracle.test.ts',
        'packages/preset/src/__tests__/stroke-geometry-oracles/reported-vector-34-output-shared-boundary-oracle.test.ts',
        'packages/preset/src/__tests__/stroke-geometry-oracles/reported-vector-34-output-sequential-update-oracle.test.ts',
        'packages/preset/src/__tests__/stroke-geometry-oracles/reported-vector-34-output-full-diagnostics-oracle.test.ts',
        'packages/preset/src/__tests__/stroke-geometry-oracles/reported-vector-34-output-metadata-ownership-oracle.test.ts',
        'yarn workspace @asyra/preset test:stroke-flow:unit',
        'yarn workspace @asyra/preset test:stroke-flow:integration',
        'yarn workspace @asyra/preset test:stroke-flow:validation'
      ],
      runtimeEvidence: [],
      runtimeBlockers: [
        {
          stepId: 'emit-render-hit-export-packets',
          oracle: 'descriptor-composite-channel-identity-gate',
          status: 'pending-contract-gate',
          description:
            'Step 38 must emit one eligible composite packet preserving canonical join references and the complete Step 27/30/31 identity envelope across all channels.'
        },
        {
          stepId: 'render-entries',
          oracle: 'descriptor-composite-zero-render-materialization-gate',
          status: 'pending-contract-gate',
          description:
            'Step 39/40 must consume paths, masks, and legal constraints without invoking deferred polygon projection.'
        },
        {
          stepId: 'hit-export',
          oracle: 'descriptor-composite-shared-lazy-projection-gate',
          status: 'pending-contract-gate',
          description:
            'Step 41 must materialize at most once per final-face identity and reuse exact polygons for hit and export while preserving channel separation.'
        }
      ],
      reopenConditions: confirmedSegmentSkipReviewConditions,
      remainingScope: [
        'Run the focused drag performance gates and broader package/E2E output-channel regression.'
      ]
    }
  ]

  const wholeFlowReviewContract = {
    id: 'stroke-whole-flow-review-and-step-grouping',
    specAnchor:
      'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#whole-flow-review-and-step-grouping-contract',
    formalGate:
      'packages/preset/src/__tests__/stroke-flow-refactor-protocol.test.ts',
    governingPrinciples: [
      'The runtime inspector steps are implementation ownership slices, not isolated correctness proofs.',
      'Before a step starts or advances, review the final required artifacts and the route family that contains the active step.',
      'A local step checklist cannot override downstream visible render, hit/export, diagnostics, legal-side, same-paint, or source-continuity requirements.',
      'If a downstream step needs raw upstream data, recomputation, renderer repair, fallback output, helper-visible geometry, or patch geometry, reopen the first owning upstream step or route-family contract.',
      'Closure status is a verifiable state machine. Implementation-ready requires contract closure, family dataflow closure or not-applicable status, cross-family handoff gates, explicit runtime scope, and explicit reopen conditions.'
    ],
    closureStateMachine,
    reviewSegments: [
      {
        id: 'source-mutation-ingress',
        stepIds: [
          'feature-session-intent',
          'path-editing-intent',
          'point-handle-drag-operation',
          'structural-vector-operation',
          'common-api-domain-adapter',
          'canonical-workspace-data',
          'validate-topology',
          'computed-patch-builder',
          'transaction-undo-boundary',
          'scene-tree-commit',
          'computed-patch-event',
          'downstream-subscriber-routing'
        ],
        reviewDecision:
          'Review together for user-intent, canonical workspace data, transaction, undo, and downstream event continuity; implement by the single owning step.'
      },
      {
        id: 'render-mirror-current-state-cache',
        stepIds: [
          'render-mirror-patch-apply',
          'render-data-derivation',
          'dirty-revision-graph',
          'stage-product-cache',
          'render-strategy-entry'
        ],
        reviewDecision:
          'Review together because patch application, render-data derivation, dirty classification, stage cache, and strategy entry decide whether geometry stages receive current data or stale/bypassed products.'
      },
      {
        id: 'source-domain-planning',
        stepIds: [
          'normalize-render-data',
          'normalize-stroke-spec',
          'shared-geometry-model',
          'resolve-source-families',
          'resolve-stroke-domains',
          'allocate-dash-intervals',
          'select-stroke-product-family'
        ],
        reviewDecision:
          'Review together because normalized inputs, shared geometry, source families, stroke domains, dash allocation, and product-family selection define legal inputs for product builders.'
      },
      {
        id: 'product-family-coexecution',
        stepIds: [
          'build-center-stroke-products',
          'build-constrained-solid-products',
          'build-dash-interval-body-products',
          'derive-dash-body-seam-boundaries',
          'build-source-vertex-join-products',
          'build-terminal-body-products',
          'build-smooth-continuity-products',
          'select-stroke-descriptor-strategy'
        ],
        reviewDecision:
          'Review as one non-linear product family before step-local implementation; applicable center, constrained solid, constrained dashed, join, terminal, smooth-continuity, and descriptor-strategy routes co-execute rather than form a linear fallback chain.'
      },
      {
        id: 'legality-final-records-descriptors',
        stepIds: [
          'apply-legality',
          'build-resolved-stroke-regions',
          'attach-paint-payload',
          'build-final-faces',
          'materialize-stroke-product-descriptors'
        ],
        reviewDecision:
          'Review together because legality clipping, resolved product records, paint attachment, final faces, and descriptor materialization must preserve product and evidence identity without changing geometry.'
      },
      {
        id: 'output-channels',
        stepIds: [
          'emit-render-hit-export-packets',
          'render-entries',
          'renderer-projection',
          'hit-export'
        ],
        reviewDecision:
          'Review together because visible render, render entries, renderer projection, and hit/export are sibling consumers and must not become each other product authority. Diagnostics and visual review are post-flow evidence channels, not owner steps.'
      }
    ],
    handleTogether: [
      {
        id: 'constrained-dashed-product-family',
        stepIds: [
          'build-dash-interval-body-products',
          'derive-dash-body-seam-boundaries',
          'build-source-vertex-join-products',
          'build-terminal-body-products',
          'build-smooth-continuity-products',
          'select-stroke-descriptor-strategy'
        ],
        reason:
          'Dash body, join, terminal body, smooth-continuity, and descriptor strategy share DashProductInterval identity, seam boundaries, legal side, endpoint cap policy, and downstream final-face/render-entry closure.'
      },
      {
        id: 'constrained-solid-product-family',
        stepIds: [
          'build-constrained-solid-products',
          'build-source-vertex-join-products',
          'build-smooth-continuity-products'
        ],
        reason:
          'Doubled-center body, canonical source-vertex joins, and same-owner smooth-span descriptor eligibility must agree before legality clipping.'
      },
      {
        id: 'render-cache-current-state',
        stepIds: [
          'dirty-revision-graph',
          'stage-product-cache',
          'render-strategy-entry'
        ],
        reason:
          'Dirty keys, cache reuse, bypasses, and render strategy entry decide whether current source/domain/product state reaches the stroke product pipeline.'
      },
      {
        id: 'final-artifact-channel-closure',
        stepIds: [
          'apply-legality',
          'build-final-faces',
          'materialize-stroke-product-descriptors',
          'emit-render-hit-export-packets',
          'render-entries',
          'hit-export'
        ],
        reason:
          'Final visible render, hit/export, same-paint evidence, and channel separation must close over the same post-legality product identity before any post-runtime validation method runs.'
      }
    ],
    segmentCompletionPolicy: {
      confirmedCompleteMeaning:
        'A segment may be skipped in later task iterations only after the spec text, inspector review segment, route/artifact lifecycle, validator checks, closure packet, and current focused audit all agree and no concrete conflict remains.',
      invalidationRule:
        'Any edit to a confirmed segment input, output, route, artifact, downstream consumer, forbidden contributor, formal gate, source anchor, or active-plan execution constraint invalidates that segment and requires re-review before implementation advances.',
      currentGoalRule:
        'During inspector-flow global replan, only segments listed as implementation-ready or runtime-closed by a closure packet may be skipped; pending segments remain part of the whole-flow review before implementation resumes.'
    },
    closurePackets: wholeFlowClosurePackets,
    completionLedger: [
      {
        segmentId: 'source-mutation-ingress',
        status: 'implementation-ready',
        closureState: 'implementation-ready',
        contractStatus: 'contract-closed',
        familyDataflowStatus: 'not-applicable',
        runtimeStatus: 'not-started',
        reason:
          'Current audit found no data loss, recomputation, or step grouping conflict in source mutation, transaction, undo, and downstream event ingress.',
        skipUntilInvalidatedBy:
          'source mutation, transaction, undo, computed patch, or downstream subscriber route changes',
        skipReviewOnlyWhen: confirmedSegmentSkipReviewConditions
      },
      {
        segmentId: 'render-mirror-current-state-cache',
        status: 'implementation-ready',
        closureState: 'implementation-ready',
        contractStatus: 'contract-closed',
        familyDataflowStatus: 'not-applicable',
        runtimeStatus: 'not-started',
        reason:
          'Current audit found no conflict in render mirror, render-data derivation, dirty revision, cache, or strategy entry contracts.',
        skipUntilInvalidatedBy:
          'render mirror, dirty key, stage cache, bypass, or current-state strategy changes',
        skipReviewOnlyWhen: confirmedSegmentSkipReviewConditions
      },
      {
        segmentId: 'source-domain-planning',
        status: 'implementation-ready',
        closureState: 'implementation-ready',
        contractStatus: 'contract-closed',
        familyDataflowStatus: 'family-dataflow-closed',
        runtimeStatus: 'pending-runtime-gates',
        reason:
          'Current audit confirmed normalized inputs, domain planning, dash allocation, and product-family selection preserve the data needed by downstream product families. Step 20 diagnostics aggregation is verified; source-split materialization review and the strict drag gate remain pending runtime work.',
        skipUntilInvalidatedBy:
          'source family, stroke domain, dash allocation, product-family selection, or DashProductInterval contract changes',
        skipReviewOnlyWhen: confirmedSegmentSkipReviewConditions
      },
      {
        segmentId: 'product-family-coexecution',
        status: 'implementation-ready',
        closureState: 'implementation-ready',
        contractStatus: 'contract-closed',
        familyDataflowStatus: 'family-dataflow-closed',
        runtimeStatus: 'pending-runtime-gates',
        reason:
          'The family contract is closed with Step 27 as the sole constrained-dashed body owner, Step 29 as the sharp-join owner, and Step 30/31 as non-visible ownership overlays. Runtime identity/envelope replacement and all continuous parameter reruns on port 3001 remain pending.',
        skipUntilInvalidatedBy:
          'product-family owner, route, product-unit, seam-boundary, legality-input union, or downstream consumer changes',
        skipReviewOnlyWhen: confirmedSegmentSkipReviewConditions,
        runtimeEvidence: [
          {
            stepId: 'build-terminal-body-products',
            oracle: 'constrained-dashed-inside-strict-performance-gate-on-port-3001',
            status: 'passed',
            description:
              'The focused inside-dashed strict gate against port 3001 passed at resolved geometry p95 2.10ms, vector render p95 8.30ms, and sustained flush average 7.24ms.'
          },
          {
            stepId: 'build-source-vertex-join-products',
            oracle: 'constrained-dashed-step-29-canonical-artifact-reuse-gate',
            status: 'passed',
            description:
              'Canonical join polygons now remain reference-stable through legality and descriptor exclusion indexing; owner bounds and join-angle evidence are reused. Focused contract, source-space geometry, and TypeScript build gates pass. Port 3001 detail measurement reduced join-record p95 to 0.70ms, join-packet p95 to 0.30ms, raw source-product p95 to 0.90ms, and product-assembly p95 to 1.80ms; the global strict vector p95 remains 10.00ms.'
          }
        ],
        runtimeBlockers: [
          {
            stepId: 'build-dash-interval-body-products',
            oracle: 'constrained-dashed-body-program-identity-gate',
            status: 'pending-runtime-repair',
            description:
              'Make the Step 27 body program self-contained and preserve bodyProductId through single and batched materialization.'
          },
          {
            stepId: 'build-smooth-continuity-products',
            oracle: 'constrained-dashed-family-single-visible-body-owner-gate',
            status: 'pending-runtime-repair',
            description:
              'Keep the constrained-solid Step 31 product route, but replace the constrained-dashed route with non-visible ownership overlays.'
          },
          {
            stepId: 'apply-legality',
            oracle: 'constrained-dashed-product-evidence-envelope-preservation-gate',
            status: 'pending-runtime-repair',
            description:
              'Preserve the complete body/overlay envelope through legality, regions, final faces, descriptors, render entries, and hit/export.'
          }
        ]
      },
      {
        segmentId: 'legality-final-records-descriptors',
        status: 'implementation-ready',
        closureState: 'implementation-ready',
        contractStatus: 'contract-closed',
        familyDataflowStatus: 'family-dataflow-closed',
        runtimeStatus: 'pending-runtime-gates',
        reason:
          'The legality/final-face/descriptor contract is closed over Step 27/29 visible products and Step 30/31 evidence overlays. Existing polygon legality evidence remains recorded, while body-program legality equivalence and batched descriptor runtime gates are pending.',
        skipUntilInvalidatedBy:
          'post-legality record, paint payload, final face, descriptor strategy, or descriptor materialization changes',
        skipReviewOnlyWhen: confirmedSegmentSkipReviewConditions,
        runtimeEvidence: [
          {
            stepId: 'build-resolved-stroke-regions',
            oracle: 'constrained-dashed-resolved-packet-cache-key-basis-gate',
            status: 'passed',
            description:
              'The one-time common basis and Step 37 full-alias handoff pass focused contract, oracle, build, and port 3001 measurement. The cache-key phase is 0.10ms p95 / 0.0375ms average.'
          },
          {
            stepId: 'materialize-stroke-product-descriptors',
            oracle: 'constrained-dashed-step-37-owner-local-dedup-gate',
            status: 'passed',
            description:
              'One aggregate lookup and direct validated-ribbon consumption pass focused contract, product/final-face oracles, build, and port 3001 measurement; strict vector p95 remains 10.60ms and flush average remains 9.05ms.'
          },
          {
            stepId: 'build-center-stroke-products',
            oracle: 'shared-ribbon-single-normalization-gate',
            status: 'passed',
            description:
              'The shared manual ribbon owner preserves all cap/join/suppression fingerprints and ribbon used/fallback counts while reducing product-evidence average to 0.90ms and p95 to 1.60ms. The focused strict gate now measures resolved geometry p95 2.70ms, vector p95 9.60ms, and sustained flush average 8.08ms.'
          }
        ],
        runtimeBlockers: [
          {
            stepId: 'apply-legality',
            oracle: 'constrained-dashed-body-program-legality-equivalence-gate',
            status: 'pending-runtime-repair',
            description:
              'Attach one legal basis per compatible Step 27 body program without per-overlay clipping or visible reconstruction.'
          },
          {
            stepId: 'materialize-stroke-product-descriptors',
            oracle: 'constrained-dashed-batched-body-descriptor-gate',
            status: 'pending-runtime-repair',
            description:
              'Batch compatible Step 27 body programs with one aggregate cache lookup and no duplicate validated-ribbon normalization/cleanup while preserving all product and overlay identities.'
          }
        ]
      },
      {
        segmentId: 'output-channels',
        status: 'implementation-ready',
        closureState: 'implementation-ready',
        contractStatus: 'contract-closed',
        familyDataflowStatus: 'family-dataflow-closed',
        runtimeStatus: 'pending-runtime-gates',
        reason:
          'The output-channel contract is closed: render, hit, and export are sibling consumers of the same Step 27/29 products and Step 30/31 overlays, and no channel may repair upstream geometry. The runtime evidence-envelope identity, batched-body descriptor handoff, and all strict gates on port 3001 remain pending.',
        skipUntilInvalidatedBy:
          'render entry, renderer projection, hit/export, diagnostics, visual review, or output channel contract changes',
        skipReviewOnlyWhen: confirmedSegmentSkipReviewConditions,
        runtimeEvidence: [],
        runtimeBlockers: [
          {
            stepId: 'render-entries',
            oracle: 'constrained-dashed-batched-body-output-channel-gate',
            status: 'pending-runtime-repair',
            description:
              'Consume the Step 37 batched descriptor as one alpha-safe composite while preserving the complete evidence envelope across render/hit/export.'
          }
        ]
      }
    ],
    splitBoundaries: [
      {
        before: 'select-stroke-descriptor-strategy',
        after: 'materialize-stroke-product-descriptors',
        reason:
          'Descriptor strategy records eligibility and legality basis before legality; materialization emits renderer-ready descriptors only after final-face or equivalent legality records exist.'
      },
      {
        before: 'render-entries',
        after: 'renderer-projection',
        reason:
          'Render entries own channel-safe projection records; renderer projection only draws declared entries and cannot repair geometry.'
      },
      {
        before: 'renderer-projection',
        after: 'hit-export',
        reason:
          'Hit/export consumes final-face or hit/export packet evidence, not visible pixels.'
      }
    ],
    mergeOrReframeCandidates: [
      {
        id: 'product-family-readiness',
        action:
          'Keep steps split for implementation ownership, but merge readiness and closure review into the product-family coexecution segment.'
      },
      {
        id: 'resolved-product-record-naming',
        action:
          'Keep resolved packet wording generalized as ResolvedStrokeProductRecord when the step covers center, constrained solid, and constrained dashed records.'
      }
    ],
    forbiddenReviewBehavior: [
      'approving the next implementation iteration from a step-local check only',
      'treating product family implementation steps as a linear fallback chain',
      'starting downstream implementation while required upstream artifacts have no registered producer',
      'letting downstream output repair a missing upstream product or evidence artifact'
    ]
  }

  const requiredArtifactClosureContract = {
    id: 'stroke-required-artifact-closure-lifecycle',
    specRuleId: 'required-artifact-closure-contract',
    specAnchor:
      'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#spec-to-enforcement-contract',
    formalGate:
      'packages/preset/src/__tests__/stroke-flow-refactor-protocol.test.ts',
    targetSurfaces: [
      'visible render coverage',
      'hit/export coverage'
    ],
    governingPrinciples: [
      'Define final required artifacts before step-local input/output checks.',
      'A step output is valid only when it produces, preserves, consumes, or proves the absence of a required artifact.',
      'Step-local limitations do not override final required coverage, legal-side, continuity, or same-paint compositing requirements.',
      'If final required coverage is missing or malformed while local step evidence passes, repair this contract before implementation continues.'
    ],
    closureRequirements: [
      {
        id: 'position-legal-visible-coverage',
        targetSurface: 'visible render coverage',
        requiredArtifacts: [
          'artifact:preLegalityProductUnits',
          'artifact:postLegalityProductUnits',
          'artifact:finalFaces',
          'artifact:renderEntries'
        ],
        ownerSteps: [
          'build-dash-interval-body-products',
          'derive-dash-body-seam-boundaries',
          'build-source-vertex-join-products',
          'build-terminal-body-products',
          'apply-legality',
          'build-final-faces',
          'render-entries'
        ],
        genericFormalAssertions: [
          'stroke position samples occupy the configured inside/center/outside source-space band',
          'outside dash outer-boundary samples at stroke.width follow the authored source segment or curve without notches, protrusions, or straight-chord substitution',
          'legal-side exclusion rejects wrong-side fill-domain samples',
          'legal-side sample probes are actual product vertices, product edge midpoints, or points already proven to lie on or inside the visible product; exact legal-domain area proof is authoritative when available',
          'visible coverage has no unowned protrusions or required-coverage holes'
        ],
        failureReopensStep: 'build-dash-interval-body-products'
      },
      {
        id: 'dash-terminal-and-join-continuity',
        targetSurface: 'visible render coverage',
        requiredArtifacts: [
          'artifact:dash-body-seam-boundary',
          'artifact:constrained-dashed-interval-body-product',
          'artifact:constrained-dashed-join-owned-terminal-body-product',
          'artifact:constrained-dashed-source-vertex-join-product',
          'artifact:renderEntries'
        ],
        ownerSteps: [
          'build-dash-interval-body-products',
          'derive-dash-body-seam-boundaries',
          'build-terminal-body-products',
          'build-source-vertex-join-products',
          'apply-legality',
          'render-entries'
        ],
        genericFormalAssertions: [
          'dash interval body terminal portions retain required source-space width up to declared seam boundaries',
          'terminal/smooth ownership overlays reference body products and contribute zero additional visible geometry',
          'source-vertex joins consume required dash body seam boundaries without visible source-space gaps',
          'miter, bevel, and round joins share the same destination continuity contract'
        ],
        failureReopensStep: 'build-dash-interval-body-products'
      },
      {
        id: 'same-paint-single-composite-projection',
        targetSurface: 'visible render coverage',
        requiredArtifacts: [
          'artifact:finalFaces',
          'artifact:renderEntries'
        ],
        ownerSteps: ['build-final-faces', 'render-entries'],
        genericFormalAssertions: [
          'touching or overlapping same-paint products are projected as a single-composite render entry or carry alpha-safe equivalence evidence',
          'render-entry polygons do not retain internal shared-boundary or positive-overlap regions without alpha-safe equivalence evidence',
          'renderer projection does not decide same-paint alpha or repair geometry'
        ],
        failureReopensStep: 'render-entries'
      },
      {
        id: 'hit-export-parity',
        targetSurface: 'hit/export coverage',
        requiredArtifacts: [
          'artifact:postLegalityProductUnits',
          'artifact:finalFaces',
          'artifact:hit-export-packets'
        ],
        ownerSteps: [
          'apply-legality',
          'build-final-faces',
          'emit-render-hit-export-packets',
          'hit-export'
        ],
        genericFormalAssertions: [
          'hit/export coverage consumes the same legal product units as render output',
          'hit/export does not receive renderer-local repaired geometry'
        ],
        failureReopensStep: 'emit-render-hit-export-packets'
      }
    ],
    forbiddenBehaviors: [
      'checking only step-local input/output while final required artifacts are undefined',
      'using a local step limitation to justify a visible source-space hole',
      'adding fixture-specific geometry to satisfy one visual screenshot',
      'letting renderer projection create missing stroke geometry',
      'claiming closure from seam identity without final required coverage'
    ]
  }

  const strokePipelineArtifactDataContract = {
    id: 'stroke-pipeline-artifact-data-contract',
    specRuleId: 'pipeline-artifact-data-classification',
    specAnchor:
      'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#spec-to-enforcement-contract',
    formalGate:
      'packages/preset/src/__tests__/stroke-flow-refactor-protocol.test.ts',
    governingPrinciples: [
      'Classify every cross-step value before implementation.',
      'Required product artifacts must exist when their route conditions apply.',
      'Required evidence artifacts must survive with the product they prove.',
      'A constrained dashed body has one visible product owner; terminal and smooth ownership overlays are required evidence and may not paint.',
      'Preserve-only artifacts may be copied or attached downstream but must not be reinterpreted as new geometry decisions.',
      'Downstream recomputation is allowed only for pure summaries that cannot change geometry, legality, stroke position, join identity, dash interval identity, output channel, or same-paint semantics.',
      'Optional diagnostics and visual probes must not be promoted to visible render, hit, export, or product descriptor input.'
    ],
    artifactClasses: [
      {
        id: 'required-product-artifact',
        required: true,
        mayPaint: true,
        mayBeRecomputedDownstream: false,
        examples: [
          'artifact:preLegalityProductUnits',
          'artifact:postLegalityProductUnits',
          'artifact:finalFaces',
          'artifact:renderEntries',
          'artifact:hit-export-packets',
          'artifact:constrained-dashed-interval-body-product',
          'artifact:constrained-dashed-source-vertex-join-product',
          'artifact:constrained-dashed-render-descriptor'
        ],
        failureReopensStep: 'first-owning-product-step'
      },
      {
        id: 'required-evidence-artifact',
        required: true,
        mayPaint: false,
        mayBeRecomputedDownstream: false,
        examples: [
          'artifact:normalized-stroke-spec',
          'artifact:stroke-domain-plan',
          'artifact:dash-body-seam-boundary',
          'artifact:source-vertex-join-miter-evidence',
          'artifact:constrained-dashed-join-owned-terminal-body-product',
          'artifact:constrained-dashed-smooth-continuity-product',
          'dash interval id',
          'split range id',
          'terminal role',
          'endpoint cap policy',
          'source-distance range',
          'legal-domain id',
          'resolved join evidence',
          'same-paint equivalence evidence',
          'output-channel tag'
        ],
        failureReopensStep: 'first-step-that-lost-proof'
      },
      {
        id: 'preserve-only-artifact',
        required: true,
        mayPaint: false,
        mayBeRecomputedDownstream: false,
        examples: [
          'dash body seam-boundary artifact',
          'source-vertex join and miter evidence',
          'Step 32 legal-domain provenance',
          'same-paint alpha-safety proof'
        ],
        failureReopensStep: 'first-step-that-reinterpreted-artifact'
      },
      {
        id: 'recomputable-derived-summary',
        required: false,
        mayPaint: false,
        mayBeRecomputedDownstream: true,
        examples: [
          'bounds',
          'area',
          'counter',
          'diagnostic preview',
          'cache lookup key'
        ],
        failureReopensStep: 'step-that-used-summary-as-product-input'
      },
      {
        id: 'optional-diagnostic-artifact',
        required: false,
        mayPaint: false,
        mayBeRecomputedDownstream: true,
        examples: [
          'rejected candidate',
          'debug trace',
          'visual overlay probe',
          'runtime diagnostic snapshot'
        ],
        failureReopensStep: 'step-that-promoted-diagnostic-to-product'
      },
      {
        id: 'composite-stacking-state',
        required: true,
        mayPaint: true,
        mayBeRecomputedDownstream: false,
        examples: [
          'same-paint single-composite render entry',
          'alpha-safe equivalence evidence',
          'shared-boundary overlap proof'
        ],
        failureReopensStep: 'render-entries'
      }
    ],
    nonRecomputableDimensions: [
      'product geometry',
      'legal side',
      'stroke position',
      'join identity',
      'miter resolution',
      'dash interval identity',
      'source-distance endpoints',
      'seam endpoint identity',
      'output channel',
      'same-paint compositing semantics'
    ],
    requiredClassIds: [
      'required-product-artifact',
      'required-evidence-artifact',
      'preserve-only-artifact',
      'recomputable-derived-summary',
      'optional-diagnostic-artifact',
      'composite-stacking-state'
    ],
    forbiddenBehaviors: [
      'recomputing non-recomputable dimensions downstream',
      'using diagnostics or visual probes as visible product input',
      'treating bounds, area, counters, previews, or cache keys as geometry authority',
      'claiming optional evidence when route conditions require a product artifact',
      'letting renderer projection decide geometry repair, legality, dash/join seam closure, or same-paint alpha'
    ]
  }

  const dashJoinSeamLifecycleContract = {
    id: 'dash-join-seam-identity-lifecycle',
    specRuleId: 'dash-join-seam-contract',
    specAnchor:
      'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#dash-body-and-join-seam-contract',
    formalGate:
      'packages/preset/src/__tests__/stroke-flow-refactor-protocol.test.ts',
    artifactIds: [
      'artifact:constrained-dashed-interval-body-product',
      'artifact:dash-body-seam-boundary',
      'artifact:constrained-dashed-join-owned-terminal-body-product',
      'artifact:constrained-dashed-source-vertex-join-product',
      'artifact:postLegalityProductUnits',
      'artifact:finalFaces',
      'artifact:constrained-dashed-render-descriptor',
      'artifact:renderEntries'
    ],
    ownerSteps: [
      'build-dash-interval-body-products',
      'derive-dash-body-seam-boundaries',
      'build-terminal-body-products',
      'build-source-vertex-join-products',
      'apply-legality',
      'build-final-faces',
      'materialize-stroke-product-descriptors',
      'render-entries',
      'renderer-projection'
    ],
    lifecycle: [
      {
        phase: 'prepare-seam-boundary-evidence',
        stepId: 'build-dash-interval-body-products',
        routeIds: ['constrained-dashed-interval-body-product'],
        producesArtifacts: ['artifact:constrained-dashed-interval-body-product'],
        requiredEvidence: [
          'dash body boundary evidence id',
          'body geometry encoding mode',
          'candidate terminal point on emitted dash body product boundary identity',
          'candidate outer body boundary endpoint on emitted dash body product boundary identity',
          'candidate body-side outline segment on emitted dash body product boundary identity'
        ],
        failureReopensStep: 'build-dash-interval-body-products'
      },
      {
        phase: 'produce-seam-boundary',
        stepId: 'derive-dash-body-seam-boundaries',
        routeIds: ['constrained-dashed-products-derive-seam-boundaries'],
        consumesArtifacts: ['artifact:constrained-dashed-interval-body-product'],
        producesArtifacts: ['artifact:dash-body-seam-boundary'],
        requiredEvidence: [
          'verified seam boundary artifact derived from emitted canonical polygon or exact geometry-program boundary',
          'outer body boundary endpoint on dash body product boundary identity',
          'body-side outline segment on dash body product boundary identity',
          'endpoint cap suppression state',
          'proof that seam endpoint ids are derived from the same emitted dash body product'
        ],
        failureReopensStep: 'derive-dash-body-seam-boundaries'
      },
      {
        phase: 'dispatch-seam-boundary',
        stepId: 'derive-dash-body-seam-boundaries',
        routeIds: [
          'constrained-dashed-products-coexecute-source-vertex-join-products',
          'constrained-dashed-products-coexecute-terminal-body-products'
        ],
        consumesArtifacts: ['artifact:dash-body-seam-boundary'],
        requiredEvidence: ['dash body seam boundary artifact ids'],
        failureReopensStep: 'derive-dash-body-seam-boundaries'
      },
      {
        phase: 'bind-terminal-ownership',
        stepId: 'build-terminal-body-products',
        routeIds: ['constrained-dashed-join-owned-terminal-body-product'],
        consumesArtifacts: [
          'artifact:constrained-dashed-interval-body-product',
          'artifact:dash-body-seam-boundary'
        ],
        producesArtifacts: [
          'artifact:constrained-dashed-join-owned-terminal-body-product'
        ],
        requiredEvidence: [
          'referenced dash body product id',
          'terminal role and endpoint cap policy',
          'seam boundary id',
          'join ownership signature',
          'zero visible contribution proof'
        ],
        failureReopensStep: 'build-terminal-body-products'
      },
      {
        phase: 'consume-seam-boundary',
        stepId: 'build-source-vertex-join-products',
        routeIds: ['constrained-dashed-source-vertex-join-product'],
        consumesArtifacts: ['artifact:dash-body-seam-boundary'],
        producesArtifacts: [
          'artifact:constrained-dashed-source-vertex-join-product'
        ],
        requiredEvidence: [
          'proof that every consumed seam boundary endpoint id belongs to the owning dash body product boundary identity',
          'proof that dash and join visible triangles share the same seam endpoint identities',
          'dash/join zero-gap adjacency proof'
        ],
        failureReopensStep: 'build-source-vertex-join-products'
      },
      {
        phase: 'preserve-through-legality',
        stepId: 'apply-legality',
        routeIds: ['legality-product-unit-clipping'],
        consumesArtifacts: ['artifact:preLegalityProductUnits'],
        producesArtifacts: ['artifact:postLegalityProductUnits'],
        requiredEvidence: [
          'pre-legality product ids',
          'post-legality product ids',
          'legal-domain ids'
        ],
        preservedEvidence: [
          'same seam endpoint identity when visible dash/join products survive legality'
        ],
        failureReopensStep: 'apply-legality'
      },
      {
        phase: 'preserve-through-final-faces',
        stepId: 'build-final-faces',
        routeIds: [
          'canonical-final-face-render-entry',
          'constrained-dashed-descriptor-materialization'
        ],
        consumesArtifacts: [
          'artifact:postLegalityProductUnits',
          'artifact:finalFaces'
        ],
        producesArtifacts: [
          'artifact:finalFaces',
          'artifact:constrained-dashed-render-descriptor'
        ],
        preservedEvidence: [
          'visible contributor owner',
          'join ownership signatures',
          'same seam endpoint identity when visible dash/join products survive final-face or descriptor materialization'
        ],
        failureReopensStep: 'build-final-faces'
      },
      {
        phase: 'preserve-through-render-entries',
        stepId: 'render-entries',
        routeIds: [
          'canonical-final-face-render-entry',
          'constrained-dashed-outside-aggregate-descriptor'
        ],
        consumesArtifacts: [
          'artifact:finalFaces',
          'artifact:constrained-dashed-render-descriptor'
        ],
        producesArtifacts: ['artifact:renderEntries'],
        requiredEvidence: [
          'same-paint single-composite or alpha-safe equivalence evidence when visible entries overlap'
        ],
        preservedEvidence: [
          'same seam endpoint identity before renderer projection'
        ],
        failureReopensStep: 'render-entries'
      },
      {
        phase: 'forbid-renderer-recompute',
        stepId: 'renderer-projection',
        routeIds: ['render-projection-merge'],
        consumesArtifacts: ['artifact:renderEntries'],
        forbiddenLateComputation: [
          'dash/join seam endpoint reinterpretation',
          'join shape decision',
          'cap shape decision',
          'same-paint alpha decision'
        ],
        failureReopensStep: 'render-entries'
      }
    ]
  }

  const sharedStepTestHelpers = [
    'packages/preset/src/__tests__/stroke-flow/stroke-parameter-coverage-test-helper.ts'
  ]

  const sourceFileOwnershipRecords = [
    {
      filePath: 'packages/preset/src/components/oval.ts',
      classification: 'app-integration',
      ownerStepId: 'render-strategy-entry',
      ownerRouteIds: ['linear-render-strategy-entry-to-normalize-render-data'],
      currentConsumers: [],
      requiredInspectorField:
        'sourceFileOwnershipRecords.appIntegrationBoundary',
      productionCodeChangeNeeded: false
    },
    {
      filePath: 'packages/preset/src/components/rectangle.ts',
      classification: 'app-integration',
      ownerStepId: 'render-strategy-entry',
      ownerRouteIds: ['linear-render-strategy-entry-to-normalize-render-data'],
      currentConsumers: [],
      requiredInspectorField:
        'sourceFileOwnershipRecords.appIntegrationBoundary',
      productionCodeChangeNeeded: false
    },
    {
      filePath:
        'packages/preset/src/components/stroke-render/arrangement-face-classifier.ts',
      classification: 'shared-helper',
      ownerStepId: 'build-final-faces',
      ownerRouteIds: ['canonical-final-face-render-entry'],
      currentConsumers: [
        'packages/preset/src/components/vector.ts',
        'packages/preset/src/components/stroke-render/stroke-candidate-arrangement.ts'
      ],
      requiredInspectorField: 'sourceFileOwnershipRecords.sharedHelperOwner',
      productionCodeChangeNeeded: false
    },
    {
      filePath:
        'packages/preset/src/components/stroke-render/center-dashed-overlap-candidates.ts',
      classification: 'diagnostics-only',
      ownerStepId: null,
      ownerRouteIds: [],
      currentConsumers: [
        'packages/preset/src/components/stroke-render/center-dashed-overlap-diagnostics.ts'
      ],
      requiredInspectorField:
        'sourceFileOwnershipRecords.diagnosticsOnlyChannel',
      productionCodeChangeNeeded: false
    },
    {
      filePath:
        'packages/preset/src/components/stroke-render/center-dashed-overlap-graph.ts',
      classification: 'diagnostics-only',
      ownerStepId: null,
      ownerRouteIds: [],
      currentConsumers: [
        'packages/preset/src/components/stroke-render/center-dashed-overlap-candidates.ts',
        'packages/preset/src/components/stroke-render/center-dashed-overlap-diagnostics.ts'
      ],
      requiredInspectorField:
        'sourceFileOwnershipRecords.diagnosticsOnlyChannel',
      productionCodeChangeNeeded: false
    },
    {
      filePath:
        'packages/preset/src/components/stroke-render/center-dashed-ownership.ts',
      classification: 'diagnostics-only',
      ownerStepId: null,
      ownerRouteIds: [],
      currentConsumers: [
        'packages/preset/src/components/stroke-render/center-dashed-overlap-diagnostics.ts'
      ],
      requiredInspectorField:
        'sourceFileOwnershipRecords.diagnosticsOnlyChannel',
      productionCodeChangeNeeded: false
    },
    {
      filePath:
        'packages/preset/src/components/stroke-render/clipper2-geometry-backend.ts',
      classification: 'shared-helper',
      ownerStepId: 'shared-geometry-model',
      ownerRouteIds: ['linear-normalize-stroke-spec-to-shared-geometry-model'],
      currentConsumers: [
        'packages/preset/src/__tests__/stroke-geometry-oracles/ordinary-sharp-runtime-oracle.test.ts',
        'packages/preset/src/__tests__/stroke-geometry-oracles/reported-vector-34-runtime-oracle-fixture.ts',
        'packages/preset/src/__tests__/stroke-parameter-switch-performance.test.ts'
      ],
      requiredInspectorField: 'sourceFileOwnershipRecords.sharedHelperOwner',
      productionCodeChangeNeeded: false
    },
    {
      filePath: 'packages/preset/src/components/stroke-render/constants.ts',
      classification: 'shared-helper',
      ownerStepId: 'normalize-render-data',
      ownerRouteIds: ['linear-render-strategy-entry-to-normalize-render-data'],
      currentConsumers: [
        'packages/preset/src/components/group.ts',
        'packages/preset/src/components/oval.ts',
        'packages/preset/src/components/rectangle.ts'
      ],
      requiredInspectorField: 'sourceFileOwnershipRecords.sharedHelperOwner',
      productionCodeChangeNeeded: false
    },
    {
      filePath:
        'packages/preset/src/components/stroke-render/constrained-dashed-domain-geometry.ts',
      classification: 'dead-residue',
      ownerStepId: null,
      ownerRouteIds: [],
      currentConsumers: [],
      requiredInspectorField: 'sourceFileOwnershipRecords.deadResidueRegistry',
      productionCodeChangeNeeded: false
    },
    {
      filePath:
        'packages/preset/src/components/stroke-render/constrained-domain-stroke-geometry.ts',
      classification: 'diagnostics-only',
      ownerStepId: null,
      ownerRouteIds: [],
      currentConsumers: [
        'packages/preset/src/components/stroke-render/constrained-dashed-domain-geometry.ts',
        'packages/preset/src/components/stroke-render/constrained-solid-stroke-geometry.ts'
      ],
      requiredInspectorField:
        'sourceFileOwnershipRecords.diagnosticsOnlyChannel',
      productionCodeChangeNeeded: false
    },
    {
      filePath:
        'packages/preset/src/components/stroke-render/constrained-solid-legality-clipping.ts',
      classification: 'owner-entry',
      ownerStepId: 'apply-legality',
      ownerRouteIds: ['legality-product-unit-clipping'],
      currentConsumers: [
        'packages/preset/src/components/oval.ts',
        'packages/preset/src/components/rectangle.ts',
        'packages/preset/src/components/vector.ts'
      ],
      requiredInspectorField: 'sourceFileOwnershipRecords.ownerEntry',
      productionCodeChangeNeeded: false
    },
    {
      filePath:
        'packages/preset/src/components/stroke-render/constrained-solid-legality-domain.ts',
      classification: 'diagnostics-only',
      ownerStepId: null,
      ownerRouteIds: [],
      currentConsumers: [
        'packages/preset/src/components/stroke-render/constrained-solid-legality-diagnostics.ts'
      ],
      requiredInspectorField:
        'sourceFileOwnershipRecords.diagnosticsOnlyChannel',
      productionCodeChangeNeeded: false
    },
    {
      filePath:
        'packages/preset/src/components/stroke-render/constrained-solid-stroke-geometry.ts',
      classification: 'diagnostics-only',
      ownerStepId: null,
      ownerRouteIds: [],
      currentConsumers: [
        'packages/preset/src/components/stroke-render/constrained-solid-legality-diagnostics.ts'
      ],
      requiredInspectorField:
        'sourceFileOwnershipRecords.diagnosticsOnlyChannel',
      productionCodeChangeNeeded: false
    },
    {
      filePath:
        'packages/preset/src/components/stroke-render/dashed-center-ribbon-geometry.ts',
      classification: 'shared-helper',
      ownerStepId: 'build-center-stroke-products',
      ownerRouteIds: [
        'center-products-canonical-output-else',
        'constrained-dashed-descriptor-materialization'
      ],
      currentConsumers: [
        'packages/preset/src/components/stroke-render/dashed-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts'
      ],
      requiredInspectorField: 'sourceFileOwnershipRecords.sharedHelperOwner',
      productionCodeChangeNeeded: false
    },
    {
      filePath: 'packages/preset/src/components/stroke-render/ellipse-path.ts',
      classification: 'shared-helper',
      ownerStepId: 'shared-geometry-model',
      ownerRouteIds: ['linear-normalize-stroke-spec-to-shared-geometry-model'],
      currentConsumers: ['packages/preset/src/components/oval.ts'],
      requiredInspectorField: 'sourceFileOwnershipRecords.sharedHelperOwner',
      productionCodeChangeNeeded: false
    },
    {
      filePath:
        'packages/preset/src/components/stroke-render/geometry-backend.ts',
      classification: 'shared-helper',
      ownerStepId: 'shared-geometry-model',
      ownerRouteIds: ['linear-normalize-stroke-spec-to-shared-geometry-model'],
      currentConsumers: [
        'packages/preset/src/components/stroke-render/resolved-vector-geometry-model.ts',
        'packages/preset/src/components/stroke-render/stroke-candidate-arrangement.ts',
        'packages/preset/src/components/vector.ts',
        'packages/preset/src/subscriptions/data-channel.ts'
      ],
      requiredInspectorField: 'sourceFileOwnershipRecords.sharedHelperOwner',
      productionCodeChangeNeeded: false
    },
    {
      filePath:
        'packages/preset/src/components/stroke-render/legal-domain-normalization.ts',
      classification: 'shared-helper',
      ownerStepId: 'resolve-stroke-domains',
      ownerRouteIds: [
        'linear-resolve-source-families-to-resolve-stroke-domains'
      ],
      currentConsumers: [
        'packages/preset/src/components/stroke-render/stroke-domain-plan.ts',
        'packages/preset/src/components/vector.ts'
      ],
      requiredInspectorField: 'sourceFileOwnershipRecords.sharedHelperOwner',
      productionCodeChangeNeeded: false
    },
    {
      filePath:
        'packages/preset/src/components/stroke-render/self-intersecting-legal-domain.ts',
      classification: 'shared-helper',
      ownerStepId: 'shared-geometry-model',
      ownerRouteIds: ['linear-normalize-stroke-spec-to-shared-geometry-model'],
      currentConsumers: [
        'packages/preset/src/components/stroke-render/constrained-solid-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/resolved-vector-geometry-model.ts'
      ],
      requiredInspectorField: 'sourceFileOwnershipRecords.sharedHelperOwner',
      productionCodeChangeNeeded: false
    },
    {
      filePath:
        'packages/preset/src/components/stroke-render/solid-stroke-geometry-core.ts',
      classification: 'shared-helper',
      ownerStepId: 'shared-geometry-model',
      ownerRouteIds: ['linear-normalize-stroke-spec-to-shared-geometry-model'],
      currentConsumers: [
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/constrained-domain-stroke-geometry.ts',
        'packages/preset/src/components/stroke-render/constrained-solid-legality-domain.ts',
        'packages/preset/src/components/stroke-render/constrained-solid-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/dashed-center-ribbon-geometry.ts',
        'packages/preset/src/components/stroke-render/legal-domain-normalization.ts',
        'packages/preset/src/components/stroke-render/path-topology-model.ts',
        'packages/preset/src/components/stroke-render/resolved-vector-geometry-model.ts',
        'packages/preset/src/components/stroke-render/solid-center-stroke-geometry.ts',
        'packages/preset/src/components/stroke-render/source-span-graph.ts',
        'packages/preset/src/components/stroke-render/source-vertex-join-footprint.ts',
        'packages/preset/src/components/stroke-render/stroke-side-resolution.ts'
      ],
      requiredInspectorField: 'sourceFileOwnershipRecords.sharedHelperOwner',
      productionCodeChangeNeeded: false
    },
    {
      filePath:
        'packages/preset/src/components/stroke-render/source-span-graph.ts',
      classification: 'shared-helper',
      ownerStepId: 'resolve-stroke-domains',
      ownerRouteIds: [
        'linear-resolve-source-families-to-resolve-stroke-domains'
      ],
      currentConsumers: [
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/dashed-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/legal-domain-normalization.ts'
      ],
      requiredInspectorField: 'sourceFileOwnershipRecords.sharedHelperOwner',
      productionCodeChangeNeeded: false
    },
    {
      filePath:
        'packages/preset/src/components/stroke-render/source-vertex-join-footprint.ts',
      classification: 'owner-entry',
      ownerStepId: 'build-source-vertex-join-products',
      ownerRouteIds: [
        'center-solid-canonical-source-vertex-join-footprint',
        'constrained-solid-canonical-source-vertex-join-footprint',
        'constrained-dashed-source-vertex-join-product'
      ],
      currentConsumers: [
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/constrained-solid-stroke-packets.ts'
      ],
      requiredInspectorField: 'sourceFileOwnershipRecords.ownerEntry',
      productionCodeChangeNeeded: false
    },
    {
      filePath:
        'packages/preset/src/components/stroke-render/stroke-interval-frames.ts',
      classification: 'shared-helper',
      ownerStepId: 'allocate-dash-intervals',
      ownerRouteIds: [
        'linear-resolve-stroke-domains-to-allocate-dash-intervals'
      ],
      currentConsumers: [
        'packages/preset/src/components/stroke-render/dashed-center-stroke-packets.ts'
      ],
      requiredInspectorField: 'sourceFileOwnershipRecords.sharedHelperOwner',
      productionCodeChangeNeeded: false
    },
    {
      filePath:
        'packages/preset/src/components/stroke-render/stroke-ownership.ts',
      classification: 'shared-helper',
      ownerStepId: 'build-final-faces',
      ownerRouteIds: ['canonical-final-face-render-entry'],
      currentConsumers: [
        'packages/preset/src/components/stroke-render/stroke-candidate-arrangement.ts',
        'packages/preset/src/components/stroke-render/stroke-final-face.ts'
      ],
      requiredInspectorField: 'sourceFileOwnershipRecords.sharedHelperOwner',
      productionCodeChangeNeeded: false
    },
    {
      filePath:
        'packages/preset/src/components/stroke-render/stroke-paint-payload.ts',
      classification: 'owner-entry',
      ownerStepId: 'attach-paint-payload',
      ownerRouteIds: [
        'linear-build-resolved-stroke-regions-to-attach-paint-payload'
      ],
      currentConsumers: [
        'packages/preset/src/components/stroke-render/stroke-final-face.ts',
        'packages/preset/src/index.ts'
      ],
      requiredInspectorField: 'sourceFileOwnershipRecords.ownerEntry',
      productionCodeChangeNeeded: false
    },
    {
      filePath:
        'packages/preset/src/components/stroke-render/stroke-side-resolution.ts',
      classification: 'shared-helper',
      ownerStepId: 'resolve-stroke-domains',
      ownerRouteIds: [
        'linear-resolve-source-families-to-resolve-stroke-domains'
      ],
      currentConsumers: [
        'packages/preset/src/components/stroke-render/stroke-domain-plan.ts'
      ],
      requiredInspectorField: 'sourceFileOwnershipRecords.sharedHelperOwner',
      productionCodeChangeNeeded: false
    },
    {
      filePath: 'packages/render/src/index.ts',
      classification: 'app-integration',
      ownerStepId: 'renderer-projection',
      ownerRouteIds: ['render-projection-merge'],
      currentConsumers: [],
      requiredInspectorField:
        'sourceFileOwnershipRecords.appIntegrationBoundary',
      productionCodeChangeNeeded: false
    },
    {
      filePath: 'packages/render/src/layers/overlay-layer.ts',
      classification: 'app-integration',
      ownerStepId: 'renderer-projection',
      ownerRouteIds: ['render-projection-merge'],
      currentConsumers: ['packages/render/src/index.ts'],
      requiredInspectorField:
        'sourceFileOwnershipRecords.appIntegrationBoundary',
      productionCodeChangeNeeded: false
    },
    {
      filePath: 'packages/render/src/layers/selection/selection-layer.ts',
      classification: 'app-integration',
      ownerStepId: 'renderer-projection',
      ownerRouteIds: ['render-projection-merge'],
      currentConsumers: ['packages/render/src/layers/selection/index.ts'],
      requiredInspectorField:
        'sourceFileOwnershipRecords.appIntegrationBoundary',
      productionCodeChangeNeeded: false
    },
    {
      filePath: 'packages/render/src/render.ts',
      classification: 'app-integration',
      ownerStepId: 'renderer-projection',
      ownerRouteIds: ['render-projection-merge'],
      currentConsumers: [
        'packages/render/src/index.ts',
        'packages/render/src/pixi-renderer.ts',
        'packages/render/src/stores/scene-tree.ts'
      ],
      requiredInspectorField:
        'sourceFileOwnershipRecords.appIntegrationBoundary',
      productionCodeChangeNeeded: false
    }
  ]

  const strokeParameterIds = [
    'stroke.fill.visible',
    'stroke.fill.kind',
    'stroke.fill.color',
    'stroke.fill.opacity',
    'stroke.fill.gradient',
    'stroke.fill.colorFormat',
    'stroke.fill.defaultColorFormat',
    'stroke.style',
    'stroke.position',
    'stroke.width',
    'stroke.dash',
    'stroke.gap',
    'stroke.capType',
    'stroke.joinType',
    'stroke.miterAngle'
  ]

  const strokeParameterCoverageRoles = [
    'consume',
    'preserve',
    'forbid',
    'dirty-key',
    'cache-key',
    'output-metadata',
    'not-applicable'
  ]

  const paintParameterIds = [
    'stroke.fill.visible',
    'stroke.fill.kind',
    'stroke.fill.color',
    'stroke.fill.opacity',
    'stroke.fill.gradient'
  ]
  const paintDisplayParameterIds = [
    'stroke.fill.colorFormat',
    'stroke.fill.defaultColorFormat'
  ]
  const strokeGeometryParameterIds = [
    'stroke.style',
    'stroke.position',
    'stroke.width',
    'stroke.dash',
    'stroke.gap',
    'stroke.capType',
    'stroke.joinType',
    'stroke.miterAngle'
  ]
  const dashParameterIds = ['stroke.dash', 'stroke.gap']
  const joinParameterIds = ['stroke.joinType', 'stroke.miterAngle']
  const productFamilyParameterIds = [
    'stroke.style',
    'stroke.position',
    'stroke.dash',
    'stroke.gap'
  ]

  const normalizeCoverageRoles = (roles) =>
    (Array.isArray(roles) ? roles : [roles]).filter(Boolean)

  const coverageFor = (defaultRoles, overrides = {}) =>
    Object.fromEntries(
      strokeParameterIds.map((parameterId) => [
        parameterId,
        normalizeCoverageRoles(overrides[parameterId] ?? defaultRoles)
      ])
    )

  const withRoles = (base, parameterIds, roles) => {
    const next = { ...base }
    for (const parameterId of parameterIds) {
      next[parameterId] = normalizeCoverageRoles(roles)
    }
    return next
  }

  const baseForbiddenCoverage = coverageFor('forbid')
  const basePreserveCoverage = coverageFor('preserve')
  const baseOutputMetadataCoverage = coverageFor('output-metadata')
  const baseNotApplicableCoverage = coverageFor('not-applicable')

  const strokeParameterCoverageByStep = {
    'feature-session-intent': coverageFor('consume'),
    'path-editing-intent': baseForbiddenCoverage,
    'point-handle-drag-operation': baseForbiddenCoverage,
    'structural-vector-operation': baseForbiddenCoverage,
    'common-api-domain-adapter': coverageFor(['consume', 'preserve']),
    'canonical-workspace-data': basePreserveCoverage,
    'validate-topology': baseForbiddenCoverage,
    'computed-patch-builder': coverageFor(['consume', 'preserve']),
    'transaction-undo-boundary': basePreserveCoverage,
    'scene-tree-commit': basePreserveCoverage,
    'computed-patch-event': basePreserveCoverage,
    'downstream-subscriber-routing': basePreserveCoverage,
    'render-mirror-patch-apply': basePreserveCoverage,
    'render-data-derivation': coverageFor(['consume', 'preserve']),
    'dirty-revision-graph': coverageFor('dirty-key'),
    'stage-product-cache': withRoles(
      coverageFor('cache-key'),
      paintDisplayParameterIds,
      'forbid'
    ),
    'render-strategy-entry': baseForbiddenCoverage,
    'normalize-render-data': coverageFor(['consume', 'preserve']),
    'normalize-stroke-spec': coverageFor('consume'),
    'shared-geometry-model': baseForbiddenCoverage,
    'resolve-source-families': withRoles(
      baseForbiddenCoverage,
      ['stroke.style', 'stroke.position'],
      'consume'
    ),
    'resolve-stroke-domains': withRoles(
      baseForbiddenCoverage,
      ['stroke.position'],
      'consume'
    ),
    'allocate-dash-intervals': withRoles(
      baseForbiddenCoverage,
      [
        'stroke.style',
        'stroke.width',
        'stroke.dash',
        'stroke.gap',
        'stroke.capType'
      ],
      'consume'
    ),
    'select-stroke-product-family': withRoles(
      baseForbiddenCoverage,
      productFamilyParameterIds,
      'consume'
    ),
    'build-center-stroke-products': withRoles(
      baseForbiddenCoverage,
      [
        'stroke.style',
        'stroke.position',
        'stroke.width',
        'stroke.dash',
        'stroke.gap',
        'stroke.capType',
        'stroke.joinType',
        'stroke.miterAngle'
      ],
      'consume'
    ),
    'build-constrained-solid-products': withRoles(
      baseForbiddenCoverage,
      [
        'stroke.style',
        'stroke.position',
        'stroke.width',
        'stroke.capType',
        'stroke.joinType',
        'stroke.miterAngle'
      ],
      'consume'
    ),
    'build-dash-interval-body-products': withRoles(
      baseForbiddenCoverage,
      [
        'stroke.style',
        'stroke.position',
        'stroke.width',
        'stroke.dash',
        'stroke.gap',
        'stroke.capType'
      ],
      'consume'
    ),
    'derive-dash-body-seam-boundaries': coverageFor([
      'preserve',
      'output-metadata'
    ]),
    'build-source-vertex-join-products': withRoles(
      withRoles(baseForbiddenCoverage, dashParameterIds, [
        'preserve',
        'output-metadata'
      ]),
      [
        'stroke.position',
        'stroke.width',
        'stroke.capType',
        'stroke.joinType',
        'stroke.miterAngle'
      ],
      'consume'
    ),
    'build-terminal-body-products': coverageFor([
      'preserve',
      'output-metadata'
    ]),
    'build-smooth-continuity-products': withRoles(
      withRoles(baseForbiddenCoverage, joinParameterIds, 'forbid'),
      [
        'stroke.position',
        'stroke.width',
        'stroke.dash',
        'stroke.gap',
        'stroke.capType'
      ],
      'consume'
    ),
    'select-stroke-descriptor-strategy': withRoles(
      baseForbiddenCoverage,
      strokeGeometryParameterIds,
      'consume'
    ),
    'apply-legality': basePreserveCoverage,
    'build-resolved-stroke-regions': basePreserveCoverage,
    'attach-paint-payload': withRoles(
      withRoles(basePreserveCoverage, paintDisplayParameterIds, 'forbid'),
      paintParameterIds,
      'consume'
    ),
    'build-final-faces': basePreserveCoverage,
    'materialize-stroke-product-descriptors': withRoles(
      basePreserveCoverage,
      strokeGeometryParameterIds,
      ['consume', 'output-metadata']
    ),
    'emit-render-hit-export-packets': baseOutputMetadataCoverage,
    'render-entries': coverageFor(['preserve', 'output-metadata']),
    'renderer-projection': coverageFor(['preserve', 'forbid']),
    'hit-export': coverageFor(['preserve', 'output-metadata'])
  }

  const strokeParameterCoverageMatrix = Object.fromEntries(
    stepSpecs.map(([id]) => [
      id,
      strokeParameterCoverageByStep[id] ?? baseNotApplicableCoverage
    ])
  )

  const entryBoundaryRequiredStepIds = [
    'render-mirror-patch-apply',
    'render-data-derivation',
    'stage-product-cache',
    'render-strategy-entry'
  ]

  const activeRefactorStepIndex =
    refactorProtocol.activeStepId === null
      ? -1
      : stepSpecs.findIndex(([id]) => id === refactorProtocol.activeStepId)

  const implementationFilesByGroup = {
    Interaction: [
      'apps/asyra-design/src/features/',
      'apps/asyra-design/src/properties/',
      'packages/feature-system/src/'
    ],
    'Model Commit': [
      'apps/asyra-design/src/common-apis/',
      'packages/core/src/',
      'packages/props-manager/src/',
      'packages/scene-tree/src/'
    ],
    'Data Channel': [
      'packages/core/src/data-channel-observer.ts',
      'packages/factory/src/',
      'packages/scene-tree/src/',
      'packages/preset/src/subscriptions/'
    ],
    'Render Mirror': [
      'packages/render/src/',
      'packages/preset/src/components/vector.ts'
    ],
    'Stroke Geometry': [
      'packages/preset/src/components/stroke-render/',
      'packages/preset/src/components/vector.ts'
    ],
    'Product Output': [
      'packages/preset/src/components/stroke-render/',
      'packages/render/src/'
    ],
    Diagnostics: [
      'packages/preset/src/components/stroke-render/',
      'apps/asyra-design/e2e/'
    ]
  }

  const defaultRuleRefsByGroup = {
    Interaction: [ruleId(0), ruleId(10), ruleId(11), ruleId(12)],
    'Model Commit': [ruleId(0), ruleId(11), ruleId(12), ruleId(13)],
    'Data Channel': [ruleId(0), ruleId(13), ruleId(14), ruleId(15)],
    'Render Mirror': [
      ruleId(0),
      ruleId(14),
      ruleId(16),
      ruleId(17),
      ruleId(19),
      ruleId(22),
      ruleId(23)
    ],
    'Stroke Geometry': [
      ruleId(0),
      ruleId(16),
      ruleId(17),
      ruleId(34),
      ruleId(35),
      ruleId(49),
      ruleId(50),
      ruleId(67),
      'computation-ownership-timing'
    ],
    'Product Output': [
      ruleId(0),
      ruleId(70),
      ruleId(71),
      ruleId(72),
      ruleId(73),
      ruleId(74),
      'computation-ownership-timing'
    ],
    Diagnostics: [
      ruleId(0),
      ruleId(75),
      ruleId(76),
      ruleId(77),
      'computation-ownership-timing'
    ]
  }

  const getStepUnitTestFile = (stepNumber, id) =>
    `${refactorProtocol.unitTestRoot}step-${String(stepNumber).padStart(
      2,
      '0'
    )}-${id}.test.ts`

  const getRefactorStatus = (index) => {
    if (
      currentExecutionState.planStatus === 'inspector-flow-schema-repair-active'
    ) {
      return 'locked'
    }
    if (refactorProtocol.activeStepId === null) {
      return 'verified'
    }
    if (index < activeRefactorStepIndex) {
      return 'verified'
    }
    if (index === activeRefactorStepIndex) {
      return 'active'
    }
    return 'locked'
  }

  const stepOverrides = {
    'feature-session-intent': {
      verificationEvidence: {
        gateName: 'protocol plus step 01 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-01-feature-session-intent.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-01-feature-session-intent.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T03:41:25+08:00'
      },
      latestRule:
        'Feature/session code owns user intent only; it must not directly write render store state.',
      inputs: ['pointer/keyboard/tool event', 'current feature session state'],
      outputs: ['explicit path-editing, vector, or stroke intent'],
      currentImplementation:
        'Path editing and stroke-affecting interactions enter through feature/common API boundaries.',
      requiredAdjustment:
        'Keep render synchronization out of feature code; route model writes through app common APIs.',
      relatedTests: [
        'apps/asyra-design/e2e/undo-redo.spec.ts',
        'apps/asyra-design/e2e/vector-render-invariants.spec.ts'
      ],
      tags: ['framework-aligned', 'critical']
    },
    'path-editing-intent': {
      verificationEvidence: {
        gateName: 'protocol plus step 02 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-02-path-editing-intent.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-02-path-editing-intent.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T03:43:16+08:00'
      },
      latestRule:
        'Path-editing mode tracks behavior state; model mutations still go through common APIs.',
      inputs: ['path editing selection', 'hovered point/segment state'],
      outputs: ['bounded vector operation request'],
      currentImplementation:
        'Escape/release and selection cleanup are tested through path-editing E2E invariants.',
      requiredAdjustment:
        'Do not let path-editing overlays become model or render authorities.',
      tags: ['framework-aligned']
    },
    'point-handle-drag-operation': {
      verificationEvidence: {
        gateName: 'protocol plus step 03 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-03-point-handle-drag-operation.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-03-point-handle-drag-operation.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T03:44:09+08:00'
      },
      latestRule:
        'Point/handle drag updates are non-undoable; final drag commits a canonical computed patch. Drag-sensitive stroke changes must also prove the 120fps drag performance contract through the enforced app drag gate.',
      inputs: ['point id', 'target kind', 'workspace position'],
      outputs: ['point/handle computed patch intent'],
      currentImplementation:
        'Point/handle drag uses framework computed patch events and keeps model/render/overlay aligned.',
      requiredAdjustment:
        'Do not rebuild unrelated points, delay correctness until mouseup, dirty static stroke/paint revisions during drag, or bypass the stroke product pipeline to hit the frame budget.',
      relatedTests: [
        'apps/asyra-design/e2e/undo-redo.spec.ts',
        'packages/preset/src/__tests__/vector-path-editing-render-layer.test.ts',
        'apps/asyra-design/e2e/stroke-drag-render-performance-*.spec.ts'
      ],
      tags: ['framework-aligned', 'critical']
    },
    'structural-vector-operation': {
      verificationEvidence: {
        gateName: 'protocol plus step 04 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-04-structural-vector-operation.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-04-structural-vector-operation.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T03:45:05+08:00'
      },
      latestRule:
        'Structural vector edits are explicit operations and must patch only affected scalar values and record ids.',
      inputs: [
        'append/remove/split/connect/close operation',
        'anchor type or handle mode operation',
        'handle update operation'
      ],
      outputs: ['operation-scoped canonical topology patch'],
      currentImplementation:
        'Append, remove, split, connect, close, anchor type, handle mode, and handle updates use internal operation adapters.',
      requiredAdjustment:
        'Keep full topology repair as explicit migration/repair only; normal structural operations must not rewrite unrelated records.',
      relatedTests: [
        'apps/asyra-design/e2e/vector-render-invariants.spec.ts',
        'apps/asyra-design/e2e/undo-redo.spec.ts',
        'packages/preset/src/__tests__/vector-path-editing-render-layer.test.ts'
      ],
      tags: ['framework-aligned', 'critical']
    },
    'common-api-domain-adapter': {
      verificationEvidence: {
        gateName: 'protocol plus step 05 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-05-common-api-domain-adapter.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-05-common-api-domain-adapter.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T03:46:24+08:00'
      },
      latestRule:
        'App common APIs are the domain boundary that converts intent into canonical model writes.',
      inputs: ['explicit vector operation intent'],
      outputs: ['validated computed patch request'],
      implementationFiles: [
        'apps/asyra-design/src/common-apis/',
        'apps/asyra-design/src/features/ (intent threading only)',
        'apps/asyra-design/src/properties/ (intent threading only)',
        'packages/core/src/',
        'packages/props-manager/src/',
        'packages/scene-tree/src/'
      ],
      currentImplementation:
        'Vector common APIs own operation adapters; feature code does not directly mutate render state.',
      requiredAdjustment:
        'Do not introduce stroke/vector mutation branches outside the common API boundary. Step 4 call sites may only pass explicit structural intents into common APIs; common APIs must own validation and computed patch request materialization.',
      relatedTests: [
        'apps/asyra-design/e2e/vector-render-invariants.spec.ts',
        'packages/preset/src/__tests__/vector-path-editing-render-layer.test.ts'
      ],
      tags: ['framework-aligned', 'critical']
    },
    'canonical-workspace-data': {
      verificationEvidence: {
        gateName: 'protocol plus step 06 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-06-canonical-workspace-data.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-06-canonical-workspace-data.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T03:47:21+08:00'
      },
      latestRule:
        'Vector model points use workspace/world coordinates as canonical data.',
      inputs: ['previous vector computed data', 'operation target positions'],
      outputs: ['workspace canonical vector topology'],
      currentImplementation:
        'Imported local-coordinate data may normalize before runtime model consumption, but normal operations preserve workspace points.',
      requiredAdjustment:
        'Do not normalize points into bounds-local model data during normal operation commits.',
      tags: ['framework-aligned', 'truth']
    },
    'validate-topology': {
      verificationEvidence: {
        gateName: 'protocol plus step 07 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-07-validate-topology.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-07-validate-topology.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T03:48:43+08:00'
      },
      latestRule:
        'Topology validation accepts or rejects workspace-canonical point, segment, and network records without repairing, synthesizing, or normalizing them.',
      inputs: ['workspace canonical vector topology candidate'],
      outputs: [
        'validated workspace canonical vector topology',
        'topology validation evidence'
      ],
      conditions: [
        'Run when canonical workspace point, segment, and network records are present for validation.'
      ],
      bypassConditions: [
        'There is no valid-topology bypass; invalid topology fails before computed patch construction.'
      ],
      limitations: [
        'Topology validation must not repair, synthesize, or normalize topology records.',
        'This step emits validation evidence only and may not create render or stroke product data.'
      ],
      allowedContributors: [
        'canonical point records',
        'canonical segment records',
        'canonical network records'
      ],
      forbiddenContributors: [
        'render or stroke product data',
        'diagnostic geometry as canonical topology',
        'downstream topology repair'
      ],
      evidenceRequired: [
        'validated point ids',
        'validated segment ids',
        'validated network ids',
        'validation result'
      ],
      currentImplementation:
        'Vector consistency validation checks point, segment, control, and network references before computed patch construction.',
      requiredAdjustment:
        'Keep validation fail-closed and leave all topology mutation to the canonical operation owners.'
    },
    'computed-patch-builder': {
      verificationEvidence: {
        gateName: 'protocol plus step 08 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-08-computed-patch-builder.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-08-computed-patch-builder.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T03:50:28+08:00'
      },
      latestRule:
        'Computed patches identify changed values and record ids; they do not clean or shrink incorrect payloads after undo.',
      inputs: ['previous canonical topology', 'next canonical topology'],
      outputs: ['ComputedDataPatch values/records set/remove payload'],
      currentImplementation:
        'Point/handle and structural operation tests assert changed id scope and single patch commits.',
      requiredAdjustment:
        'Patch scope must be correct before commit; undo must not repair payload granularity.',
      relatedTests: [
        'apps/asyra-design/e2e/vector-render-invariants.spec.ts',
        'apps/asyra-design/e2e/undo-redo.spec.ts'
      ],
      tags: ['framework-aligned', 'critical']
    },
    'transaction-undo-boundary': {
      verificationEvidence: {
        gateName: 'protocol plus step 09 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-09-transaction-undo-boundary.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-09-transaction-undo-boundary.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T03:51:32+08:00'
      },
      latestRule: 'One intended user action maps to one intended undo unit.',
      inputs: [
        'computed patch request',
        'stroke property mutation intent',
        'selection/hover cleanup intent',
        'continuous interaction session lifecycle'
      ],
      outputs: ['one transaction', 'one undoable final commit when requested'],
      implementationFiles: [
        'apps/asyra-design/src/common-apis/',
        'apps/asyra-design/src/properties/ (transaction orchestration only)',
        'packages/core/src/',
        'packages/props-manager/src/',
        'packages/scene-tree/src/'
      ],
      limitations: [
        'Discrete stroke property handlers must not open their own transaction wrapper; the stroke common API owns the mutation transaction.',
        'A continuous interaction may open one outer session transaction, but nested common API writes must collapse into that one outer undo unit.',
        'Transaction ownership may not define stroke geometry, render output, or dirty-stage semantics.'
      ],
      currentImplementation:
        'Structural operations and discrete stroke property writes are wrapped at their common API mutation boundaries; continuous color interaction keeps one explicit outer session transaction.',
      requiredAdjustment:
        'Do not split one operation across multiple undoable transactions or reintroduce discrete transaction wrappers in property handlers.',
      relatedTests: [
        'apps/asyra-design/e2e/undo-redo.spec.ts',
        'docs/ai/framework/rules/generated-artifacts.md'
      ],
      tags: ['framework-aligned', 'critical']
    },
    'scene-tree-commit': {
      latestRule:
        'Scene-tree applies validated computed patches as model state, not as render shortcuts.',
      inputs: ['computed patch payload'],
      outputs: ['committed scene-tree model data'],
      currentImplementation:
        'Scene-tree patch transaction tests cover patch routing and missing-key safety.',
      relatedTests: [
        'packages/scene-tree/src/__tests__/transaction-options.test.ts'
      ],
      additionalAllowedTestImports: ['@asyra/reactive-events', '@asyra/utils'],
      verificationEvidence: {
        gateName: 'protocol plus step 10 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-10-scene-tree-commit.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-10-scene-tree-commit.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T03:54:08+08:00'
      },
      tags: ['framework-aligned']
    },
    'computed-patch-event': {
      latestRule:
        'Data channel publishes computed patch updates after commit for downstream consumers.',
      inputs: ['committed scene-tree update'],
      outputs: ['computed patch reactive event'],
      currentImplementation:
        'Patch events remain the downstream render/UI synchronization contract.',
      additionalAllowedTestImports: ['@asyra/reactive-events'],
      verificationEvidence: {
        gateName: 'protocol plus step 11 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-11-computed-patch-event.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-11-computed-patch-event.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T03:55:25+08:00'
      },
      tags: ['framework-aligned']
    },
    'downstream-subscriber-routing': {
      latestRule:
        'Downstream subscribers consume committed patch events; app common APIs must not directly sync render store state.',
      inputs: ['computed patch event'],
      outputs: ['render/UI subscriber updates'],
      currentImplementation:
        'Render mirror and UI consumers subscribe downstream from data-channel updates.',
      requiredAdjustment:
        'Any direct app-to-render synchronization reopens this step.',
      additionalAllowedTestImports: ['yjs', '@asyra/factory', '@asyra/utils'],
      verificationEvidence: {
        gateName: 'protocol plus step 12 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-12-downstream-subscriber-routing.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-12-downstream-subscriber-routing.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T03:56:27+08:00'
      },
      tags: ['framework-aligned', 'risk']
    },
    'render-mirror-patch-apply': {
      latestRule:
        'Render mirror applies each committed patch once. It may reseed a missing mirror snapshot from the current scene-tree element before applying the patch, but must never seed after-state and then apply the same patch again.',
      inputs: [
        'computed patch event',
        'existing render mirror snapshot or cache-miss source element'
      ],
      outputs: ['updated or reseeded render mirror snapshot'],
      implementationFiles: ['packages/render/src/stores/scene-tree.ts'],
      entryPointKind: 'orchestration-boundary',
      entryPoint: 'RenderSceneTree.updateElementPatch',
      implementationFunctions: [
        'ComputedDataMirror.applyComputedPatch',
        'RenderSceneTree.updateElementPatch',
        'RenderSceneTree.commitPendingComputedDataChanges'
      ],
      helperAllowlist: [
        'ComputedDataMirror.ensure',
        'ComputedDataMirror.composeRenderData',
        'RenderSceneTree.recordDirtyChange',
        'RenderSceneTree.scheduleFlush'
      ],
      orchestrationBoundary: {
        ownerSurface:
          'packages/render/src/stores/scene-tree.ts#RenderSceneTree.updateElementPatch',
        inputBoundary:
          'computed patch event plus current mirror snapshot or scene-tree reseed source',
        outputBoundary:
          'staged render mirror snapshot and scheduled render flush',
        forbiddenOwnership: [
          'stroke geometry',
          'stroke render entries',
          'renderer projection',
          'diagnostic/helper visible output'
        ]
      },
      currentImplementation:
        'Render scene-tree store tests cover computed patch mirror updates and cache-miss reseed before patch apply.',
      relatedTests: ['packages/render/src/__tests__/scene-tree-store.test.ts'],
      verificationEvidence: {
        gateName: 'protocol plus step 13 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-13-render-mirror-patch-apply.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-13-render-mirror-patch-apply.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T03:57:17+08:00'
      },
      tags: ['framework-aligned', 'critical']
    },
    'render-data-derivation': {
      latestRule:
        'Renderer-ready vector/stroke data is derived from render mirror state, not feature-local state.',
      inputs: ['render mirror snapshot'],
      outputs: ['normalized render data'],
      implementationFiles: [
        'packages/render/src/stores/scene-tree.ts',
        'packages/preset/src/components/vector.ts'
      ],
      entryPointKind: 'orchestration-boundary',
      entryPoint: 'RenderSceneTree._getRenderData',
      implementationFunctions: [
        'ComputedDataMirror.composeRenderData',
        'RenderSceneTree._getRenderData',
        'RenderSceneTree.commitPendingComputedDataChanges'
      ],
      helperAllowlist: ['render.updateElement', 'normalizeVectorRenderData'],
      orchestrationBoundary: {
        ownerSurface:
          'packages/render/src/stores/scene-tree.ts#RenderSceneTree._getRenderData',
        inputBoundary: 'render mirror snapshot',
        outputBoundary:
          'normalized render element data handed to registered render strategy',
        forbiddenOwnership: [
          'stroke spec normalization',
          'stroke product geometry',
          'render-entry projection',
          'hit/export packet materialization'
        ]
      },
      currentImplementation:
        'Vector render invariant tests compare model, render graphic, hover outline, and editing overlay.',
      relatedTests: ['apps/asyra-design/e2e/vector-render-invariants.spec.ts'],
      verificationEvidence: {
        gateName: 'protocol plus step 14 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-14-render-data-derivation.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-14-render-data-derivation.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T03:58:35+08:00'
      },
      tags: ['framework-aligned', 'truth']
    },
    'dirty-revision-graph': {
      latestRule:
        'Stroke stage dirty classification is parameter-specific: source path/topology, stroke family, stroke domain, dash interval allocation, terminal cap, join/miter shape, paint, and render output are separate internal revisions.',
      inputs: [
        'previous stroke runtime revision set',
        'next stroke runtime revision set',
        'changed vector source points or stroke parameter patch'
      ],
      outputs: [
        'changed revision keys',
        'ordered dirty stage keys',
        'stroke pipeline cache counters'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/stroke-dirty-keys.ts',
        'packages/preset/src/components/vector.ts'
      ],
      currentImplementation:
        'stroke-dirty-keys maps paint-only, visibility, cap, join, width, dash, position/style, and drag source-path changes to scoped dirty stages and emits cache observability counters when a sink is installed.',
      requiredAdjustment:
        'Do not collapse all stroke parameters back into one broad strokeSpec helper; each parameter must retain its own reuse boundary.',
      relatedTests: [
        'packages/preset/src/__tests__/stroke-dirty-keys.test.ts',
        'apps/asyra-design/e2e/stroke-drag-render-performance-*.spec.ts'
      ],
      verificationEvidence: {
        gateName: 'protocol plus step 15 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-15-dirty-revision-graph.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-15-dirty-revision-graph.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T03:59:41+08:00'
      },
      tags: ['performance', 'truth', 'critical']
    },
    'stage-product-cache': {
      latestRule:
        'Stage product cache stores exact semantic product descriptors by source and geometry-affecting stroke signature, retints cached product for paint-only changes, and emits hit/miss/store/hidden-output counters.',
      inputs: [
        'stage dirty keys',
        'normalized vector source revision',
        'geometry-affecting stroke signature',
        'paint payload'
      ],
      outputs: [
        'cached or rebuilt semantic product descriptors',
        'stage cache hit/miss/store counters',
        'hidden-output early return for invisible product'
      ],
      implementationFiles: ['packages/preset/src/components/vector.ts'],
      entryPointKind: 'orchestration-slice',
      entryPoint: 'renderVectorGraphic:stage-product-cache',
      implementationFunctions: [
        'buildStrokeProductGeometrySignature',
        'renderVectorGraphic',
        'retintStrokeFinalFaces',
        'retintStrokeRenderEntries',
        'renderSolidCenterStrokeEntries'
      ],
      helperAllowlist: [
        'emitStrokePipelineCounter',
        'getStrokePaintKey',
        'getStageProductCache'
      ],
      orchestrationBoundary: {
        ownerSurface:
          'packages/preset/src/components/vector.ts#renderVectorGraphic:stage-product-cache',
        inputBoundary:
          'stage dirty keys, source revision, geometry-affecting stroke signature, and paint payload',
        outputBoundary:
          'cached or rebuilt semantic product descriptors plus stage cache counters',
        forbiddenOwnership: [
          'stroke parameter normalization',
          'source-domain join resolution',
          'legality clipping',
          'renderer-local repair'
        ]
      },
      currentImplementation:
        'Vector render keeps a per-graphic StrokePipelineStageCache with product descriptors keyed by element, network, source revision, and authored geometry-affecting stroke signature, including miterAngle. Only exact-signature cache hits may retint cached final faces/render entries and replay their equivalent adapter styles; geometry parameter changes miss and rebuild. visible=false clears render/hit/export output without rebuilding geometry.',
      requiredAdjustment:
        'Do not use stale cached descriptors when source revision or geometry-affecting stroke signature changes. Descriptor replay must update strokePathStyle; polygon product geometry that embeds miter shape must not use style-only replay. Diagnostics/export polygon materialization must remain lazy and separate from normal visible render.',
      relatedTests: [
        'packages/preset/src/__tests__/stroke-parameter-switch-performance.test.ts',
        'apps/asyra-design/e2e/stroke-parameter-switch-performance.spec.ts'
      ],
      verificationEvidence: {
        gateName: 'protocol plus step 16 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-16-stage-product-cache.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-16-stage-product-cache.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T04:00:52+08:00'
      },
      tags: ['performance', 'cache', 'critical']
    },
    'render-strategy-entry': {
      latestRule:
        'Render strategy entry invokes the registered strategy for normalized render element data and must not decide stroke semantics or create substitute geometry.',
      inputs: ['normalized render element data', 'registered render strategy'],
      outputs: [
        'render strategy invocation result',
        'cleared output on strategy error'
      ],
      implementationFiles: [
        'packages/render/src/registries/render-strategy.ts',
        'packages/render/src/layers/scene/render-layer.ts',
        'packages/core/src/define-component.ts',
        'packages/preset/src/components/vector.ts'
      ],
      entryPointKind: 'orchestration-boundary',
      entryPoint: 'RenderLayer.updateElement',
      implementationFunctions: [
        'RenderStrategyRegistry.register',
        'RenderStrategyRegistry.get',
        'defineComponent',
        'RenderLayer.updateElement',
        'vectorRenderStrategy'
      ],
      helperAllowlist: ['renderVectorGraphic', 'defaultStrategy'],
      orchestrationBoundary: {
        ownerSurface:
          'packages/render/src/layers/scene/render-layer.ts#RenderLayer.updateElement',
        inputBoundary: 'normalized render element data and registered strategy',
        outputBoundary:
          'registered strategy invocation result or cleared output on strategy error',
        forbiddenOwnership: [
          'stroke semantic decisions',
          'substitute product geometry',
          'renderer-owned join or cap materialization',
          'diagnostic/helper visible output'
        ]
      },
      currentImplementation:
        'defineComponent registers the vector render strategy, render-layer invokes the strategy by element type, and vectorRenderStrategy delegates to renderVectorGraphic.',
      requiredAdjustment:
        'Keep this step as an orchestration boundary only: fallback defaultStrategy may handle unknown element types, but vector stroke geometry decisions must remain downstream of renderVectorGraphic and its inspector steps.',
      verificationEvidence: {
        gateName: 'protocol plus step 17 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-17-render-strategy-entry.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-17-render-strategy-entry.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T04:02:08+08:00'
      },
      tags: ['framework-aligned', 'critical']
    },
    'normalize-render-data': {
      latestRule:
        'Stroke geometry consumes normalized render data by converting workspace source points to local render coordinates and ordering authored networks without normalizing stroke spec or building product geometry.',
      inputs: ['normalized render data'],
      outputs: [
        'local source point map',
        'ordered authored networks',
        'raw stroke/fill payloads'
      ],
      implementationFiles: ['packages/preset/src/components/vector.ts'],
      currentImplementation:
        'renderVectorGraphic destructures normalized render data, converts workspace points to local coordinates, orders networks by stable id, clears output for empty topology, and only then passes strokes to later normalization.',
      requiredAdjustment:
        'Do not move stroke spec normalization, StrokeDomainPlan, packet assembly, or renderer projection decisions into this step.',
      verificationEvidence: {
        gateName: 'protocol plus step 18 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-18-normalize-render-data.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-18-normalize-render-data.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T04:03:02+08:00'
      },
      tags: ['truth', 'critical']
    },
    'normalize-stroke-spec': {
      latestRule:
        'Stroke spec normalization preserves authored join, cap, miterAngle, dash, gap, width, position, and canonical stroke.fill paint without resolving source-domain miter geometry. Finite width <= 0 produces an empty render product without rejection diagnostics; non-finite width emits invalid-width diagnostics.',
      inputs: ['raw stroke list from normalized render data'],
      outputs: [
        'renderable stroke list',
        'empty render product for finite width <= 0',
        'stroke spec rejection diagnostics'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/renderable-stroke.ts',
        'packages/preset/src/components/vector.ts'
      ],
      currentImplementation:
        'normalizeStrokeSpec converts StrokeAttrs to RenderableStroke records, preserves authored miterAngle, derives a backend-helper miterLimit without using it for authored join resolution, normalizes dash/gap lengths and paint, returns empty output for finite non-positive width, and returns diagnostics for rejected entries. Descriptor ownership remains downstream.',
      requiredAdjustment:
        'Do not collapse authored miter to authored bevel, compute vertexAngle, resolve miter vs bevel-by-miter-angle, or emit product geometry in this step.',
      additionalAllowedTestImports: ['@asyra/utils'],
      verificationEvidence: {
        gateName: 'protocol plus step 19 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-19-normalize-stroke-spec.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-19-normalize-stroke-spec.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T04:04:16+08:00'
      },
      tags: ['truth', 'critical']
    },
    'shared-geometry-model': {
      latestRule:
        'Shared geometry is reused by fill, stroke, hit/export, diagnostics, and future shadow; it does not become visible solid stroke geometry by itself.',
      inputs: [
        'local source point map',
        'ordered authored vector networks',
        'normalized fill rule',
        'geometry cache revision keys'
      ],
      outputs: [
        'VectorNetworkPathModel records with source revisions',
        'PathTopologyModel records with contour, length, legal-domain, and self-intersection evidence',
        'ResolvedVectorGeometryModel records with self-intersection regions and stroke boundary domains when requested'
      ],
      conditions: [
        'Run after render data and stroke spec normalization have stabilized authored source topology.',
        'Build one shared path/topology model per ordered authored vector network.',
        'Build resolved geometry only as reusable source-domain evidence for later fill, stroke, hit/export, diagnostics, and shadow consumers.'
      ],
      bypassConditions: [
        'Empty authored topology clears downstream render output through the earlier normalize-render-data route.',
        'Resolved self-intersection geometry may be skipped for routes that do not require fill or constrained stroke legal-domain evidence.'
      ],
      limitations: [
        'This step does not emit visible stroke product units, render entries, stroke masks, fill payloads, endpoint caps, joins, miter resolution, or renderer projection output.',
        'This step may not infer visible sharp-vertex completion from masked visible polygons, renderer stroke paths, caps, terminal bodies, construction evidence, or helper geometry.',
        'Shared geometry evidence must remain source-domain data for downstream owner stages.'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/path-geometry.ts',
        'packages/preset/src/components/stroke-render/path-topology-model.ts',
        'packages/preset/src/components/stroke-render/resolved-vector-geometry-model.ts',
        'packages/preset/src/components/stroke-render/self-intersecting-legal-domain.ts',
        'packages/preset/src/components/vector.ts'
      ],
      additionalAllowedTestImports: ['@asyra/core'],
      allowedContributors: [
        'authored vector point records',
        'authored vector segment records',
        'authored vector network order',
        'normalized fill rule',
        'path and resolved-geometry cache records'
      ],
      forbiddenContributors: [
        'visible stroke product output',
        'stroke render entries',
        'renderer projection output',
        'strokePathStyle.join',
        'endpoint cap geometry',
        'source-vertex join footprint geometry',
        'miter-resolution metadata',
        'diagnostic/helper geometry as visible product output'
      ],
      evidenceRequired: [
        'source revision key',
        'path topology revision',
        'contour and legal-domain evidence',
        'resolved self-intersection evidence when requested',
        'route owner stage',
        'aggregate pair-cache hit, miss, signature-hit, and consecutive-skip counters',
        'separate source-split cache-key and materialization phase evidence',
        'source-split cache lookup, setup, boundary-role index, legal-face materialization, contour merge, finalization, and cache-store phase evidence'
      ],
      failureReopensStep: 'shared-geometry-model',
      currentImplementation:
        'vector.ts builds cached path geometry, topology, and resolved source-domain geometry. Segment tracing and intersection pairs reuse previous-frame caches; pair-cache hit, miss, signature-remap, and consecutive-skip diagnostics are aggregated once per resolved build with exact totals. Source-split work reports cache-key, cache lookup, setup, boundary-role index, legal-face materialization, contour merge, finalization, cache store, and total materialization phases. Cache hits bypass range construction and remain deeply equal to uncached output.',
      requiredAdjustment:
        'The bounded Step 20 attribution is complete. Retain both legal-face and contour passes because legal-face construction uniquely owns filled-face ranges; no source-split algorithm or cache-policy replacement is selected while its measured cost is non-dominant. Reopen only with new dominant-cost evidence, prove exact output equivalence, and keep join, cap, miter resolution, stroke product assembly, render entries, and renderer projection out of this step.',
      relatedTests: [
        'packages/preset/src/__tests__/resolved-vector-geometry-model.test.ts'
      ],
      verificationEvidence: {
        gateName: 'protocol plus step 20 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-20-shared-geometry-model.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-20-shared-geometry-model.test.ts --reporter=verbose',
        verifiedAt: '2026-07-11T01:15:00+08:00'
      },
      tags: ['truth', 'critical']
    },
    'resolve-source-families': {
      latestRule:
        'Source-family resolution classifies shared source topology for downstream stroke-domain planning; it does not prove final visual correctness or emit visible product.',
      inputs: [
        'PathTopologyModel records from shared geometry',
        'normalized stroke style and position'
      ],
      outputs: [
        'ResolvedSourceFamily records',
        'familyScope product-rule evidence',
        'legal-domain hints for downstream StrokeDomainPlan'
      ],
      conditions: [
        'Run once shared geometry has produced a topology model for a stroke-consuming network.',
        'Classify open, degenerate, simple closed, compound closed, and self-intersecting closed source families from source topology only.',
        'Carry legal-domain hint ids and contour ids forward without generating legal stroke domains.'
      ],
      bypassConditions: [
        'No source family is resolved when no renderable stroke consumes the topology.',
        'Degenerate topology may return not-applicable evidence for downstream rejection.'
      ],
      limitations: [
        'This step must not allocate stroke domains, dash intervals, endpoint caps, joins, miter resolution, product polygons, final faces, render entries, or renderer projection output.',
        'Product-rule evidence records coverage status and gaps only; it is not a substitute visible product and cannot claim pixel correctness.',
        'Classification uses PathTopologyModel source-domain evidence, not masked visible polygons or renderer output.'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/resolved-source-family.ts'
      ],
      additionalAllowedTestImports: [
        'packages/preset/src/components/stroke-render/path-topology-model.ts'
      ],
      allowedContributors: [
        'PathTopologyModel.sourceFamily',
        'PathTopologyModel.topologyFamily',
        'PathTopologyModel.contours',
        'PathTopologyModel.legalDomainDescriptors',
        'PathTopologyModel.fillRule',
        'RenderableStroke.style',
        'RenderableStroke.position'
      ],
      forbiddenContributors: [
        'StrokeDomainPlan output',
        'DashProductInterval output',
        'visible stroke product output',
        'source-vertex join footprint geometry',
        'endpoint cap geometry',
        'miter-resolution metadata',
        'render entries',
        'renderer projection output',
        'diagnostic/helper geometry as visible product output'
      ],
      evidenceRequired: [
        'source id',
        'network id',
        'topology family',
        'family scope',
        'coverage status and gaps',
        'legal-domain hint ids',
        'route owner stage'
      ],
      failureReopensStep: 'resolve-source-families',
      currentImplementation:
        'resolved-source-family.ts derives ResolvedSourceFamily and product-rule evidence from PathTopologyModel plus normalized stroke style/position; constrained stroke consumers call it before StrokeDomainPlan resolution.',
      requiredAdjustment:
        'Keep domain planning, interval allocation, join/cap/miter ownership, visible product assembly, and render projection in later owner stages.',
      relatedTests: ['packages/preset/src/__tests__/source-span-graph.test.ts'],
      verificationEvidence: {
        gateName: 'protocol plus step 21 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-21-resolve-source-families.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-21-resolve-source-families.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T04:06:36+08:00'
      },
      tags: ['truth', 'critical']
    },
    'resolve-stroke-domains': {
      latestRule:
        'StrokeDomainPlan resolution selects the source-domain interval authority, side authority, and legal-domain references consumed by later interval and product stages; it does not allocate paint intervals or emit visible geometry.',
      inputs: [
        'PathTopologyModel source-domain evidence',
        'ResolvedSourceFamily classification',
        'normalized stroke style, position, and width',
        'optional resolved self-intersection split ranges',
        'optional normalized legal-domain boundary spans'
      ],
      outputs: [
        'StrokeDomainPlan record',
        'domainMode',
        'intervalDomainKind',
        'sideAuthority',
        'splitRangeDomains and legalBoundaryDomains as domain references',
        'domain diagnostics'
      ],
      conditions: [
        'Run after source-family classification for each renderable stroke/topology pair.',
        'Use topology/source-family evidence to choose center product, closed constrained domain, open constrained domain, dangling outside domain, inside-excluded open span, or no domain.',
        'Carry source split range and legal boundary domain references for later interval allocation without materializing stroke products.'
      ],
      bypassConditions: [
        'Degenerate topology returns a null domainMode with rejection diagnostics.',
        'Missing required self-intersection source evidence returns a null domainMode with diagnostics instead of inventing fallback geometry.'
      ],
      limitations: [
        'This step must not allocate visible dash intervals, build source-vertex joins, resolve miter angles, create endpoint caps, emit product polygons, build final faces, create render entries, or project renderer output.',
        'DomainPlanSplitRange records are interval-authority references, not painted DashProductInterval output.',
        'Masks and legality evidence may select domains but must not invent join shape or visible product geometry.'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/stroke-domain-plan.ts'
      ],
      additionalAllowedTestImports: [
        'packages/preset/src/components/stroke-render/path-topology-model.ts',
        'packages/preset/src/components/stroke-render/resolved-source-family.ts'
      ],
      allowedContributors: [
        'PathTopologyModel evidence',
        'ResolvedSourceFamily evidence',
        'normalized stroke style/position/width',
        'resolved vector source split ranges',
        'resolved vector stroke boundary domains',
        'normalized legal-domain boundary spans',
        'implicit fill regions as side-resolution context'
      ],
      forbiddenContributors: [
        'DashProductInterval output',
        'visible stroke product output',
        'source-vertex join footprint geometry',
        'endpoint cap geometry',
        'miter-resolution metadata',
        'final faces',
        'render entries',
        'renderer projection output',
        'diagnostic/helper geometry as visible product output'
      ],
      evidenceRequired: [
        'plan id',
        'source id and network id',
        'topology family',
        'domain mode',
        'interval domain kind',
        'side authority',
        'domain diagnostics',
        'route owner stage'
      ],
      failureReopensStep: 'resolve-stroke-domains',
      currentImplementation:
        'stroke-domain-plan.ts resolves StrokeDomainPlan records from topology, ResolvedSourceFamily, normalized stroke style/position/width, optional shared split ranges, optional legal boundary spans, and side-resolution context.',
      requiredAdjustment:
        'Keep dash interval allocation, join/cap/miter materialization, product polygons, final faces, render entries, and renderer projection in later owner stages.',
      relatedTests: [
        'packages/preset/src/__tests__/stroke-domain-plan.test.ts'
      ],
      verificationEvidence: {
        gateName: 'protocol plus step 22 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-22-resolve-stroke-domains.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-22-resolve-stroke-domains.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T04:08:01+08:00'
      },
      tags: ['truth', 'critical']
    },
    'allocate-dash-intervals': {
      latestRule:
        'Dash interval allocation computes source-domain visible/gap intervals and terminal roles only where the dash model owns placement; independent dash spans allocate half-length terminal dashes at both span endpoints and evenly distribute interior dash/gap intervals without violating the spec-defined minimum gap floor; this step does not materialize stroke body, cap, join, or mask geometry.',
      inputs: [
        'StrokeDomainPlan interval authority',
        'domain length and closed flag',
        'dash length and gap length',
        'independent dash span flag and allocation origin',
        'dash cap footprint inputs',
        'optional domain split-range references'
      ],
      outputs: [
        'DashedCenterStrokeIntervalRecord records',
        'StrokeIntervalAllocation records grouped by domain id',
        'visible/gap interval links',
        'terminal role metadata for open paths and domain-plan split ranges'
      ],
      conditions: [
        'Run for dashed strokes after StrokeDomainPlan selects the interval authority.',
        'Open center dashed routes use network-balanced terminal intervals when the topology route owns continuous open-path placement.',
        'Independent dash span routes allocate half-length terminal dashes at both span endpoints and distribute interior dash/gap intervals according to the stroke-engine spec.',
        'Domain-plan split-range routes preserve source split-range provenance and terminal role metadata for later product assembly.'
      ],
      bypassConditions: [
        'Invalid total length, dash length, or gap length returns no intervals.',
        'Domain plans with intervalDomainKind none return no interval allocations.',
        'Inside-excluded open spans carry no visible intervals.'
      ],
      limitations: [
        'This step may use cap size only to preserve dash spacing semantics; it must not create endpoint cap geometry.',
        'This step must not build source-vertex joins, resolve miter angles, emit product polygons, create final faces, create render entries, or project renderer output.',
        'Dashed intervals provide placement and provenance only; source-vertex ownership and endpoint-cap ownership are later product-stage decisions.'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/dashed-center-stroke-intervals.ts',
        'packages/preset/src/components/stroke-render/path-topology-model.ts'
      ],
      allowedContributors: [
        'StrokeDomainPlan intervalDomainKind',
        'domain total length and closed flag',
        'dash length and gap length',
        'source-distance allocation origin',
        'independent dash span endpoints',
        'configured gap floor from the stroke-engine spec',
        'stroke width and cap for minimum gap math',
        'domain split-range provenance',
        'legal-boundary span ids'
      ],
      forbiddenContributors: [
        'visible stroke product output',
        'source-vertex join footprint geometry',
        'endpoint cap geometry',
        'miter-resolution metadata',
        'final faces',
        'render entries',
        'renderer projection output',
        'diagnostic/helper geometry as visible product output'
      ],
      evidenceRequired: [
        'domain id',
        'interval id',
        'visible/gap kind',
        'start and end distance',
        'independent span allocation evidence when the route owns an independent dash span',
        'configured gap and distributed gap floor evidence for averaged interior intervals',
        'terminal role metadata when present',
        'split-range provenance when present',
        'route owner stage'
      ],
      computationContract: {
        computedAt: 'allocate-dash-intervals',
        consumesArtifacts: [
          'artifact:stroke-domain-plan',
          'artifact:normalized-stroke-spec'
        ],
        producesArtifacts: ['artifact:dash-product-interval'],
        consumedBy: [
          'select-stroke-product-family',
          'build-dash-interval-body-products',
          'build-source-vertex-join-products'
        ],
        mustNotRecomputeAfter: 'build-dash-interval-body-products',
        forbiddenLateComputation: [
          'independent source-span endpoint half-dash classification',
          'dash interval endpoint relocation',
          'terminal role reinterpretation',
          'interior dash/gap redistribution',
          'configured gap floor recalculation',
          'legal-clip boundary endpoint synthesis'
        ]
      },
      failureReopensStep: 'allocate-dash-intervals',
      currentImplementation:
        'dashed-center-stroke-intervals.ts allocates center, open-terminal-balanced, legal-boundary, and domain-plan split-range interval records; path-topology-model.ts forwards topology length and closed state into the allocator.',
      requiredAdjustment:
        'Keep stroke body materialization, endpoint-cap geometry, source-vertex join ownership, final faces, render entries, and renderer projection in later owner stages.',
      verificationEvidence: {
        gateName: 'protocol plus step 23 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-23-allocate-dash-intervals.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-23-allocate-dash-intervals.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T04:09:18+08:00'
      },
      tags: ['truth', 'critical']
    },
    'select-stroke-product-family': {
      alignmentStatus: 'architecture-closed',
      latestRule:
        'Product family selection chooses center, constrained solid, or constrained dashed product routing from normalized stroke/domain inputs only; it must not materialize visible geometry.',
      inputs: [
        'normalized stroke position and dash state',
        'resolved source family',
        'StrokeDomainPlan domain mode and selected legal side'
      ],
      outputs: [
        'selected center product route',
        'selected constrained solid product route',
        'selected constrained dashed co-execution route set'
      ],
      conditions: [
        'Run after dash allocation and stroke domain resolution.',
        'Choose exactly one product family decision and never compute product footprint geometry.'
      ],
      bypassConditions: [
        'Hidden output and verified descriptor cache-hit routes can skip this step only through explicit cache/bypass routes.'
      ],
      limitations: [
        'This step must not build dash bodies, joins, terminal bodies, descriptors, legality masks, final faces, render entries, or diagnostics.',
        'Family selection must not repair an upstream domain or dash allocation gap.'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/stroke-domain-plan.ts',
        'packages/preset/src/components/stroke-render/stroke-product-family.ts'
      ],
      ownerStage: 'Stroke Geometry product family selection',
      allowedContributors: [
        'normalized stroke position',
        'dash presence',
        'StrokeDomainPlan domain mode',
        'source family classification'
      ],
      forbiddenContributors: [
        'visible geometry',
        'source-vertex join footprint',
        'dash body polygon',
        'terminal body polygon',
        'descriptor geometry',
        'renderer projection output'
      ],
      evidenceRequired: [
        'selected product family id',
        'decision predicate inputs',
        'source/domain/dash signatures'
      ],
      failureReopensStep: 'select-stroke-product-family',
      currentImplementation:
        'stroke-product-family.ts explicitly selects center, constrained-solid, constrained-dashed co-execution, or none from normalized stroke state, source family, and StrokeDomainPlan metadata without materializing product geometry.',
      requiredAdjustment:
        'Create a single product family decision boundary before product materialization.',
      verificationEvidence: {
        gateName: 'protocol plus step 24 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-24-select-stroke-product-family.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-24-select-stroke-product-family.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T04:13:07+08:00'
      },
      tags: ['canonical', 'split-product-step']
    },
    'build-center-stroke-products': {
      latestRule:
        'Center stroke products are authored center stroke products or exact center descriptors; they preserve cap, join, miter, dash, paint channel, and closed-state semantics.',
      inputs: [
        'selected center product family',
        'normalized source path',
        'normalized stroke spec'
      ],
      outputs: ['center product units or exact center descriptors'],
      conditions: [
        'Run only for selected center product family.',
        'The shared ribbon helper may also serve a completed Step 37 descriptor path, but Step 25 retains rail, cap, join, miter, validity, and fallback ownership.'
      ],
      bypassConditions: [
        'Descriptor output may bypass polygon faces only when it exactly encodes the product.'
      ],
      limitations: [
        'Must not compute constrained inside/outside masks or infer source-vertex joins from renderer projection.',
        'Must not skip simple-outline validation, change backend fallback selection, or repeat dedupe/area normalization when no endpoint cap suppression is active.'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/solid-center-stroke-geometry.ts',
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/dashed-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/dashed-center-ribbon-geometry.ts'
      ],
      additionalAllowedTestImports: ['@asyra/utils'],
      ownerStage: 'Stroke Geometry center product assembly',
      allowedContributors: [
        'authored center stroke body',
        'center dash intervals',
        'exact center descriptor'
      ],
      forbiddenContributors: [
        'inside/outside legal mask',
        'renderer-local join repair',
        'diagnostic/helper visible geometry'
      ],
      evidenceRequired: [
        'center product family id',
        'strokePathStyle cap/join/rendererMiterLimit/closed',
        'descriptor equivalence proof',
        'manual ribbon cap/join/suppression geometry fingerprint parity',
        'one normalization pass for unsuppressed manual ribbons before simple-outline validation',
        'segmented fallback source-normalization, segment-body, source-vertex-join, and round-cap phase evidence',
        'separate metadata-free bevel, metadata-free round, and full-solver join phase evidence'
      ],
      failureReopensStep: 'build-center-stroke-products',
      verificationEvidence: {
        gateName: 'protocol plus step 25 shared ribbon owner gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-25-build-center-stroke-products.test.ts',
        status: 'passed',
        artifactPath:
          'yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-25-build-center-stroke-products.test.ts src/__tests__/stroke-flow/step-29-build-source-vertex-join-products.test.ts src/__tests__/stroke-flow/step-37-materialize-stroke-product-descriptors.test.ts --reporter=dot (133 passed); four related cap/join/center oracle files (20 passed); complete miter/bevel/round polygon fingerprints preserved; focused lint and yarn workspace @asyra/preset build:preset passed; port 3001 attribution records metadata-free bevel 0.1667ms average, metadata-free round 0.3000ms average, full solver 0.1417ms average, and source-vertex join total 0.8833ms average. The strict route passes resolved geometry p95 2.30ms, vector average 6.396ms, and sustained flush average 7.717ms, while global vector p95 remains open at 9.50ms.',
        verifiedAt: '2026-07-11T02:38:28+08:00'
      },
      currentImplementation:
        'The shared manual ribbon route performs one dedupe/area normalization for unsuppressed outlines, performs a second normalization only after actual endpoint half-plane clipping, and uses squared distance, rail collinearity, and miter-limit comparisons without changing coordinates or validity. Step 37 invalid-outline fallback delegates to the canonical segmented solid-center producer. Authored bevel and round calls with no incident seam boundaries and no metadata consumer use their separately proven Step 29 primitives, while authored miter remains on the full solver. Source normalization, segment body, round cap, metadata-free bevel, metadata-free round, and full-solver join costs are separately attributed; complete miter/bevel/round polygon fingerprints remain unchanged.',
      requiredAdjustment:
        'The bounded Step 25 round-consumer adjustment is complete. Preserve the separate authored bevel, authored round, and full-solver miter ownership, complete cap/join/suppression fingerprints, backend selection, simple-outline validity, fallback counts, Step 37 descriptor products, and every render/hit/export channel. Reopen Step 25 only if those artifacts regress or whole-family attribution again identifies center-product construction as the dominant end-to-end owner; the remaining global vector p95 blocker alone does not authorize another local Step 25 change.',
      tags: ['canonical', 'split-product-step']
    },
    'build-constrained-solid-products': {
      latestRule:
        'Constrained solid products are doubled authored center-stroke products before inside/outside legality; masks clip the product later and must not define join geometry.',
      inputs: [
        'selected constrained solid product family',
        'normalized stroke spec',
        'StrokeDomainPlan legal side'
      ],
      outputs: ['pre-legality constrained solid doubled-center product units'],
      conditions: ['Run only for inside/outside solid strokes.'],
      bypassConditions: [
        'Same-owner smooth-span descriptors may bypass polygon output only for declared smooth spans.'
      ],
      limitations: [
        'Must not compute vertexAngle from clipped masks or complete authored sharp vertices with descriptors.'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/constrained-solid-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/solid-center-stroke-geometry.ts'
      ],
      additionalAllowedTestImports: ['@asyra/utils'],
      ownerStage: 'Stroke Geometry constrained solid product assembly',
      allowedContributors: [
        'doubled authored center stroke product',
        'StrokeDomainPlan legal side'
      ],
      forbiddenContributors: [
        'face strip as visible product',
        'render cover polygon',
        'clipped legal-side angle as miter source'
      ],
      evidenceRequired: [
        'product family id',
        'pre-legality product id',
        'legal side id'
      ],
      failureReopensStep: 'build-constrained-solid-products',
      verificationEvidence: {
        gateName: 'protocol plus step 26 unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-26-build-constrained-solid-products.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-26-build-constrained-solid-products.test.ts --reporter=verbose',
        verifiedAt: '2026-07-01T04:21:16+08:00'
      },
      tags: ['canonical', 'split-product-step']
    },
    'build-dash-interval-body-products': {
      latestRule:
        'Dash interval bodies are DashProductInterval-owned body products; their source-side and outer offset boundaries must follow the authored source interval, while seam-boundary derivation is owned by derive-dash-body-seam-boundaries.',
      inputs: [
        'selected constrained dashed product family',
        'DashProductInterval records',
        'terminal role and cap policy'
      ],
      outputs: [
        'pre-legality dash interval body products encoded as canonical polygons or exact body geometry programs',
        'dash body boundary evidence required by seam-boundary derivation',
        'self-contained body materialization spec and initial ConstrainedDashedProductEvidenceEnvelope bodyProductIds'
      ],
      conditions: [
        'Run for constrained dashed ranges that own visible body coverage.'
      ],
      bypassConditions: ['No visible interval means no body product.'],
      limitations: [
        'Must not emit source-vertex join products, terminal overhang repair, duplicate interval paint, selected-side envelope residue, or straight-chord outer dash edges.',
        'Terminal and smooth portions are part of this body product; later terminal/smooth owner steps may attach non-visible overlays but may not emit another copy of body geometry.'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-product-evidence.ts'
      ],
      ownerStage: 'Stroke Geometry dashed interval body assembly',
      allowedContributors: [
        'complete DashProductInterval body including terminal and smooth portions',
        'allowed body-side cap'
      ],
      forbiddenContributors: [
        'source-vertex join completion',
        'endpoint-side cap at join-owned terminal',
        'duplicate interval paint'
      ],
      evidenceRequired: [
        'dash interval id',
        'split range id',
        'terminal role',
        'endpoint cap policy',
        'body geometry encoding mode',
        'emitted dash body product boundary id',
        'candidate terminal point on emitted dash body product boundary',
        'candidate outer body boundary endpoint on emitted dash body product boundary',
        'candidate body-side outline segment on emitted dash body product boundary',
        'source-space outer boundary samples at stroke.width for each materialized interval',
        'proof that curved interval outer boundary follows the authored source-curve offset instead of a straight chord',
        'stable bodyProductId preserved by single-body geometryId or by batched bodyProductIds',
        'authored width, doubled-center materialization width, cap/join/miter style, endpoint locks, legal basis, and raw curve evidence for exact body programs'
      ],
      failureReopensStep: 'build-dash-interval-body-products',
      verificationEvidence: {
        gateName: 'pending step 27 dash-body unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-27-build-dash-interval-body-products.test.ts',
        status: 'pending-schema-alignment',
        artifactPath:
          'pending:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-27-build-dash-interval-body-products.test.ts --reporter=verbose',
        verifiedAt: 'pending'
      },
      tags: ['canonical', 'split-product-step']
    },
    'derive-dash-body-seam-boundaries': {
      latestRule:
        'Dash body seam boundaries are non-visible evidence artifacts derived from the emitted canonical polygon boundary or exact body geometry-program boundary. The exact-program route may preserve immutable terminal/outer/outline/tangent identity ids plus an exact body-program boundary reference instead of eagerly polygonizing coordinates; Step 29 may project that reference when it needs coordinates, while Step 30 consumes identity only. Downstream steps must not reinterpret endpoint, outline, tangent, cap-suppression, split-range, interval provenance, or body geometry.',
      inputs: [
        'pre-legality dash interval body products',
        'dash body boundary evidence from build-dash-interval-body-products',
        'DashProductInterval provenance',
        'terminal role and endpoint cap policy'
      ],
      outputs: [
        'verified dash body seam boundary artifacts for join-owned and terminal-owned consumers'
      ],
      conditions: [
        'Run after a dash interval body product emits boundary evidence and before source-vertex join or terminal body assembly consumes seam identity.'
      ],
      bypassConditions: [
        'No seam boundary artifact is emitted when no visible dash body product exists or when no downstream join/terminal consumer applies.'
      ],
      limitations: [
        'Must not emit visible geometry, move dash body endpoints, infer source-vertex joins, create endpoint caps, repair cracks, or redistribute dash intervals.',
        'Must not read raw stroke parameters as semantic inputs; it consumes emitted body products and preserved provenance only.'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts'
      ],
      ownerStage: 'Stroke Geometry dash seam boundary derivation',
      allowedContributors: [
        'non-visible dash body seam boundary artifact',
        'emitted canonical polygon or exact body geometry-program boundary evidence',
        'immutable exact-program boundary reference with terminal, outer, outline, and tangent identity ids',
        'DashProductInterval provenance',
        'endpoint cap policy evidence'
      ],
      forbiddenContributors: [
        'visible seam repair geometry',
        'source-vertex join footprint',
        'terminal ownership overlay interpreted as visible geometry',
        'endpoint cap geometry',
        'dash interval recomputation',
        'fresh offset point substitution'
      ],
      evidenceRequired: [
        'dash body seam boundary artifact id',
        'interval id',
        'split range id',
        'terminal role',
        'legal side',
        'endpoint cap suppression state',
        'terminal point on the emitted body product boundary identity',
        'outer body boundary endpoint on the emitted body product boundary identity',
        'body-side outline segment on the emitted body product boundary identity',
        'body-side tangent evidence',
        'exact body-program boundary reference when coordinates are not eagerly materialized',
        'proof that every seam endpoint identity is derived from the same emitted dash body product boundary'
      ],
      failureReopensStep: 'derive-dash-body-seam-boundaries',
      verificationEvidence: {
        gateName: 'pending step 28 seam-boundary unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-28-derive-dash-body-seam-boundaries.test.ts',
        status: 'pending-schema-alignment',
        artifactPath:
          'pending:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-28-derive-dash-body-seam-boundaries.test.ts --reporter=verbose',
        verifiedAt: 'pending'
      },
      tags: ['canonical', 'split-product-step', 'evidence-lifecycle']
    },
    'build-source-vertex-join-products': {
      latestRule:
        'Source-vertex join products are canonical join footprints computed once from source-domain tangents and incident dash body seam boundaries before renderer projection; legality and descriptor exclusion indexes preserve the owner polygon set by reference and consume memoized owner summaries without geometry normalization.',
      inputs: [
        'authored source vertex or split terminal',
        'previous/next source-domain tangents',
        'authored join and miter angle',
        'verified incident dash body seam boundary artifacts when dashed'
      ],
      outputs: [
        'pre-legality source-vertex join products with join resolution metadata',
        'reference-stable canonical join polygon sets with one per-plan and per-polygon-set summary record'
      ],
      conditions: [
        'Run only for authored sharp vertices or split terminals that own join completion and fail smooth-continuity.',
        'Compute local legal bounds, canonical polygon bounds, and join angle resolution once per owner artifact and reuse them for packet metadata and downstream indexing.'
      ],
      bypassConditions: [
        'Tangent-continuous smooth and high-curvature spans route to smooth-continuity products, not join products.'
      ],
      limitations: [
        'Must not use masked visible polygon angles, endpoint caps, terminal bodies, post-boolean footprints, or renderer stroke joins as the join owner.',
        'Legality and descriptor exclusion handoffs must not normalize, union, merge, clean, or reconstruct the canonical join polygon set.',
        'The shared geometry core may expose the actual sampled midpoint for an already-specified arc sweep, but it must not choose join style, legal side, cap policy, sweep ownership, or visible product output.'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/source-vertex-join-footprint.ts',
        'packages/preset/src/components/stroke-render/solid-stroke-geometry-core.ts',
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/constrained-solid-stroke-packets.ts'
      ],
      ownerStage: 'Stroke Geometry source-vertex join assembly',
      allowedContributors: [
        'canonical source-vertex join footprint',
        'incident dash body seam evidence marked non-visible',
        'memoized local legal bounds, polygon-set bounds, and join angle resolution summaries',
        'actual shared-core round-arc sample midpoint for an already-specified sweep'
      ],
      forbiddenContributors: [
        'endpoint cap at authored vertex',
        'terminal body overhang',
        'aggregate source-path replay',
        'visible dash/join seam gap',
        'diagnostic/helper visible geometry',
        'downstream normalization or merging of canonical join owner polygons',
        'shared arc helper selecting authored join, legal side, cap policy, or product ownership'
      ],
      evidenceRequired: [
        'authoredJoin',
        'resolvedJoin',
        'vertexAngle',
        'miterAngle',
        'angleSource',
        'angle comparison evidence',
        'shared seam-boundary artifact endpoint identity evidence',
        'incident dash body seam boundary ids',
        'incident outer body boundary endpoint ids',
        'bevel and bevel-by-miter-angle cut-off edge endpoint ids from incident dash body outer boundaries',
        'proof that every consumed seam boundary endpoint id belongs to the owning dash body product boundary identity',
        'canonical join polygon reference parity through legality and descriptor exclusion indexes',
        'one local legal-bounds summary, one polygon-bounds summary per polygon identity, and one join angle resolution per owner product',
        'point-exact differential parity between the full authored-style solver and each metadata-free no-incident-boundary bevel or round primitive',
        'fixed existing round-arc output fingerprints for positive, negative, near-opposite, tiny-radius, and cap-sampling cases',
        'point-exact identity between the shared sampled midpoint and the same index of the materialized arc'
      ],
      failureReopensStep: 'build-source-vertex-join-products',
      verificationEvidence: {
        gateName: 'step 29 canonical source-vertex join owner gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-29-build-source-vertex-join-products.test.ts',
        status: 'passed',
        artifactPath:
          'yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-29-build-source-vertex-join-products.test.ts --reporter=dot (93 passed); six fixed core-arc fingerprints, six sampled-midpoint identities, and nineteen authored-round differential cases pass; cap/center/join oracle files (20 passed); production primitive diagnostic grid (92,738 point-exact cases, zero mismatch); focused eslint and yarn workspace @asyra/preset build:preset passed',
        verifiedAt: '2026-07-11T02:21:41+08:00'
      },
      currentImplementation:
        'Step 29 emits one canonical join record with owner join-angle resolution, preserves polygon references through legality and descriptor exclusion indexes, and reuses memoized plan and polygon-set bounds for stage evidence, product records, packet bounds, and metadata. It exposes narrowly named no-incident-boundary bevel and round polygon primitives. The shared core reports only the actual midpoint of an already-specified sampled sweep. The round primitive retains the existing sampled-midpoint score and stable tie selection, materializes only the selected normal-case arc, and preserves dual-sweep materialization for zero-radius, degenerate, or numerically ambiguous cases.',
      requiredAdjustment:
        'The authored-bevel and authored-round primitive segments are complete. Consumers may use them only for matching authored-style polygons with no incident seam boundaries and no metadata requirement, after preserving their complete product fingerprints. Never use either primitive for incident seam boundaries, miter, bevel-by-miter-angle, join metadata, constrained canonical products, or canonical Step 29 product records. Reopen on any point-parity, arc fingerprint, sampled-midpoint identity, seam, resolution, legality, final-face, render, hit, or export regression.',
      tags: ['canonical', 'split-product-step', 'join']
    },
    'build-terminal-body-products': {
      latestRule:
        'Terminal body product records are non-visible ownership overlays over an existing dash interval body product. They consume verified seam boundary artifacts, preserve terminal role and endpoint policy, reference the body product by identity, and never emit or rebuild body geometry.',
      inputs: [
        'terminal dash interval body product',
        'ConstrainedDashedProductEvidenceEnvelope bodyProductIds',
        'verified terminal dash body seam boundary artifact',
        'terminal role',
        'endpoint cap policy',
        'join ownership signature'
      ],
      outputs: [
        'non-visible terminal body ownership overlay records with body product and seam boundary provenance',
        'ConstrainedDashedProductEvidenceEnvelope with terminal ownership overlay appended by overlayId'
      ],
      conditions: [
        'Run when an existing dash interval body product has terminal ownership near a terminal seam.'
      ],
      bypassConditions: [
        'A middle-only body product emits no terminal ownership overlay.'
      ],
      limitations: [
        'Must not emit polygons, stroke paths, paint, caps, terminal overhang, source-vertex repair, selected-side envelopes, or any second copy of the referenced body product.'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-product-evidence.ts'
      ],
      ownerStage: 'Stroke Geometry terminal body ownership binding',
      allowedContributors: [
        'terminal role and endpoint cap policy metadata',
        'dash body product identity',
        'verified seam boundary identity',
        'join ownership signature'
      ],
      forbiddenContributors: [
        'visible body polygons',
        'visible stroke paths',
        'paint payload',
        'endpoint-side cap at join-owned terminal',
        'terminal overhang',
        'source-vertex apex coverage'
      ],
      evidenceRequired: [
        'dash body product id',
        'terminal role',
        'endpoint cap policy',
        'dash body seam boundary artifact id',
        'seam boundary id',
        'join ownership signature',
        'proof that the overlay contributes zero visible geometry'
      ],
      failureReopensStep: 'build-terminal-body-products',
      verificationEvidence: {
        gateName: 'pending step 30 terminal body unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-30-build-terminal-body-products.test.ts',
        status: 'pending-schema-alignment',
        artifactPath:
          'pending:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-30-build-terminal-body-products.test.ts --reporter=verbose',
        verifiedAt: 'pending'
      },
      tags: ['canonical', 'split-product-step']
    },
    'build-smooth-continuity-products': {
      latestRule:
        'For constrained dashed, smooth-continuity records are non-visible ownership overlays over existing dash interval body products. For constrained solid, this step may emit the declared same-owner smooth-span product or descriptor. Both routes preserve tangent-continuity and curve-offset proof; high curvature alone never creates join ownership or duplicate body coverage.',
      inputs: [
        'selected constrained dashed or constrained solid product family',
        'smooth-continuity group',
        'curve or smooth span evidence',
        'referenced dash interval body product ids',
        'ConstrainedDashedProductEvidenceEnvelope initialized by build-dash-interval-body-products'
      ],
      outputs: [
        'non-visible constrained dashed smooth-continuity ownership overlays referencing dash body products',
        'ConstrainedDashedProductEvidenceEnvelope with smooth ownership overlays appended by overlayId',
        'constrained solid same-owner smooth-span products or exact descriptors'
      ],
      conditions: [
        'Run for tangent-continuous spans and high-curvature spans without authored sharp-vertex ownership.'
      ],
      bypassConditions: [
        'Sharp authored vertices that fail smooth-continuity route to source-vertex join products.'
      ],
      limitations: [
        'The constrained dashed route must not emit polygons, stroke paths, paint, descriptors, strips, radial slices, helper visible products, or another copy of the referenced body geometry.',
        'The constrained solid route must not cross authored sharp source-vertex ownership boundaries or become join completion.'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-product-evidence.ts'
      ],
      ownerStage: 'Stroke Geometry smooth-continuity product and ownership binding',
      allowedContributors: [
        'smooth-continuity group metadata',
        'referenced dash body product identities',
        'tangent-continuity proof',
        'curve-offset outer boundary proof',
        'declared constrained solid same-owner smooth-span product or descriptor'
      ],
      forbiddenContributors: [
        'source-vertex join product',
        'duplicate constrained dashed body polygons or stroke paths',
        'constrained dashed paint payload',
        'visible seam-repair product',
        'visible construction/helper product',
        'disconnected strip product'
      ],
      evidenceRequired: [
        'smooth-continuity group id',
        'referenced dash body product ids',
        'tangent-continuity proof',
        'single continuous footprint proof',
        'curve-offset outer boundary proof at stroke.width',
        'proof that a constrained dashed overlay contributes zero visible geometry',
        'constrained solid same-owner boundary proof when that route applies'
      ],
      failureReopensStep: 'build-smooth-continuity-products',
      verificationEvidence: {
        gateName: 'pending step 31 smooth-continuity unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-31-build-smooth-continuity-products.test.ts',
        status: 'pending-schema-alignment',
        artifactPath:
          'pending:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-31-build-smooth-continuity-products.test.ts --reporter=verbose',
        verifiedAt: 'pending'
      },
      tags: ['canonical', 'split-product-step']
    },
    'select-stroke-descriptor-strategy': {
      latestRule:
        'Descriptor strategy selection records descriptor eligibility, legal-basis requirements, owner boundaries, and channel intent only; it does not materialize renderer-ready descriptors.',
      inputs: [
        'pre-legality polygon products or exact body geometry programs',
        'terminal and smooth ownership overlay records',
        'ConstrainedDashedProductEvidenceEnvelope identity signature',
        'descriptor route kind',
        'required legal basis',
        'output channel intent'
      ],
      outputs: [
        'descriptor strategy records with required legality basis and owner-boundary metadata'
      ],
      conditions: [
        'Run when a product route may later be encoded as a descriptor after legality or when legality-equivalence can be proven.'
      ],
      bypassConditions: [
        'If descriptor eligibility cannot be proven, later visible render uses canonical product packets after legality.'
      ],
      limitations: [
        'Must not consume post-legality artifacts before legality exists, must not emit renderer-ready descriptors, and must not promote evidence polygons as visible paint.'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-render-descriptor.ts',
        'packages/preset/src/components/stroke-render/stroke-product-evidence.ts'
      ],
      ownerStage: 'Stroke Geometry descriptor strategy selection',
      allowedContributors: [
        'descriptor eligibility metadata',
        'required legal-basis evidence',
        'owner-boundary metadata'
      ],
      forbiddenContributors: [
        'renderer-ready descriptor',
        'post-legality artifact consumption before apply-legality',
        'descriptor evidence as visible paint',
        'renderer-local join completion'
      ],
      evidenceRequired: [
        'descriptor route kind',
        'required legality basis',
        'visible/evidence channel intent',
        'product-builder id',
        'owner-boundary split proof',
        'body product to terminal/smooth overlay identity map'
      ],
      failureReopensStep: 'select-stroke-descriptor-strategy',
      verificationEvidence: {
        gateName: 'pending step 32 descriptor-strategy unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-32-select-stroke-descriptor-strategy.test.ts',
        status: 'pending-schema-alignment',
        artifactPath:
          'pending:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-32-select-stroke-descriptor-strategy.test.ts --reporter=verbose',
        verifiedAt: 'pending'
      },
      tags: ['canonical', 'split-product-step', 'descriptor']
    },
    'materialize-stroke-product-descriptors': {
      latestRule:
        'Descriptor materialization batches compatible descriptor-backed body products by paint, stroke spec, legal domain, and output channel while preserving body, terminal, smooth, seam, interval, join, legal-domain, and source-span identity without changing ownership.',
      inputs: [
        'finalFaces',
        'post-legality product units or legality-equivalent product units',
        'descriptor strategy records',
        'final-face ConstrainedDashedProductEvidenceEnvelope',
        'output channel separation',
        'resolved-packet full cache-key alias from build-resolved-stroke-regions'
      ],
      outputs: [
        'renderer-ready product descriptors with channel and owner metadata',
        'descriptor product identity preserving every body and ownership overlay id',
        'exact descriptor-backed composite recipe with deferred polygon projection when eligibility is proven'
      ],
      conditions: [
        'Run only after final-face legality records exist and descriptor equivalence to the canonical product can be proven.',
        'Group body paths only across compatible legal domains and never across a sharp source-vertex owner boundary.',
        'Descriptor-cache reuse may append its descriptor-stage tag to the Step 34 full cache-key alias but must not rebuild the common source/domain/stroke basis.',
        'Perform one inside aggregate descriptor cache lookup per compatibility group; on a miss, materialize and store the descriptor once.',
        'Consume ribbon polygons directly only when the ribbon producer returns simple-outline validity.',
        'An eligible descriptor-backed composite consumes completed body programs, endpoint-cap masks, canonical post-legality join polygons, legal clip/exclude constraints, and one complete product identity envelope without eagerly materializing body polygons.',
        'Deferred polygon projection is eligible only when focused differential gates prove zero symmetric-difference area and render, hit, export, bounds, seam, and identity parity.'
      ],
      bypassConditions: [
        'If equivalence cannot be proven, render entries consume canonical final-face packets instead of descriptors.'
      ],
      limitations: [
        'Must not consume raw pre-legality products without legality-equivalence evidence, aggregate source-path replay, evidence polygons as visible paint, or terminal/smooth overlays as additional visible geometry.',
        'Must not reserialize source, fill/domain, stroke, legality, or join-ownership dimensions already represented by the Step 34 full cache-key alias.',
        'Must not duplicate aggregate cache lookup, normalize the same ribbon tangent in both caller and ribbon owner, clean an already validated simple-outline polygon again, or skip ribbon validity checks.',
        'Must not omit eager polygons unless the exact deferred projection recipe and its eligibility proof are present; render-time code must not trigger deferred materialization.',
        'Must not normalize, merge, reconstruct, repair, or restyle canonical Step 29 join polygons while attaching them as completed composite mask contributors.'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-render-descriptor.ts',
        'packages/preset/src/components/stroke-render/stroke-product-evidence.ts'
      ],
      ownerStage: 'Product Output descriptor materialization',
      allowedContributors: [
        'final-face records',
        'post-legality product units',
        'legality-equivalent product units',
        'evidence-only descriptor metadata',
        'Step 34 resolved-packet full cache-key alias',
        'deduplicated nonzero-area simple-outline ribbon polygons'
      ],
      forbiddenContributors: [
        'pre-legality product without equivalence proof',
        'descriptor evidence as visible paint',
        'renderer-local join completion',
        'descriptor-local reconstruction of the resolved-packet cache-key common basis',
        'duplicate cache lookup or post-validation ribbon cleanup'
      ],
      evidenceRequired: [
        'descriptor route kind',
        'legality basis',
        'visible/evidence channel split',
        'product-builder id',
        'final-face id',
        'body product ids',
        'terminal and smooth overlay ids',
        'batch compatibility signature',
        'Step 34 full cache-key alias identity',
        'one aggregate cache lookup per compatibility group',
        'simple-outline validity before direct polygon consumption',
        'aggregate descriptor polygon cache-key/lookup, two-point, collinear, continuous-ribbon, fallback, round-cap, and cache-store phase evidence for eager routes',
        'deferred recipe fingerprint, conservative bounds containment, zero automatic render-time materialization, and eager/lazy geometry differential evidence for deferred routes'
      ],
      failureReopensStep: 'materialize-stroke-product-descriptors',
      verificationEvidence: {
        gateName: 'protocol plus step 37 descriptor-materialization unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-37-materialize-stroke-product-descriptors.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-34-build-resolved-stroke-regions.test.ts src/__tests__/stroke-flow/step-37-materialize-stroke-product-descriptors.test.ts --reporter=dot',
        verifiedAt: '2026-07-11T00:09:50+08:00'
      },
      currentImplementation:
        'The constrained-dashed inside aggregate descriptor cache prefixes packetStageCacheKeys.packetStageKey with its descriptor-stage tag, performs one lookup per compatibility group, delegates raw tangent normalization to the ribbon owner, and consumes validated simple-outline polygons without another cleanup pass. Aggregate detail evidence separates cache-key/lookup, two-point, collinear, continuous-ribbon, fallback, middle round-cap, and cache-store work. Analytic middle round-cap points skip a formally proven no-op generic cleanup without changing point output. Ribbon status counters prove all 27 focused fallback calls are fail-open-invalid-outline rather than empty output.',
      requiredAdjustment:
        'Replace the eligible constrained-dashed aggregate route with one descriptor-backed composite recipe only after eager/lazy differential, bounds, identity, and zero-automatic-materialization gates pass. Preserve Step 34 full-alias invalidation, canonical join polygon references, strict invalid-outline fallback for eager routes, and every final-face/render/hit/export identity. Non-eligible routes retain the current eager polygon algorithm.',
      tags: ['canonical', 'descriptor', 'product-output']
    },
    'apply-legality': {
      alignmentStatus: 'architecture-closed',
      latestRule:
        'Legality applies inside filled-region or outside exterior clipping to declared product units only; it may clip or exclude product/evidence channels but must not invent join shape, cap shape, terminal overhang, or renderer-owned visible geometry.',
      inputs: [
        'owner-preserving pre-legality product union with child ownerStepId',
        'exact dash body geometry programs with terminal and smooth ownership overlays',
        'complete ConstrainedDashedProductEvidenceEnvelope',
        'inside fill regions or outside exterior regions',
        'legal-domain ids and contour ids',
        'per-product legality result keyed by source product id',
        'render descriptor evidence channels'
      ],
      outputs: [
        'post-legality product units preserving source product and owner ids',
        'unchanged ConstrainedDashedProductEvidenceEnvelope for surviving bodies',
        'pre/post legality product id parity for every surviving product',
        'legal empty/delete records with body product id, affected overlay ids, legal-domain id, and delete reason when a declared product is removed',
        'clipPolygons, fillClipPolygons, fillExcludePolygons, or legal-domain arrangement evidence',
        'legal-domain diagnostics and owner metadata'
      ],
      conditions: [
        'Run after product units already own geometry and source-vertex joins.',
        'Clip constrained inside products to filled domains and constrained outside products to exterior domains when the route declares legal clipping.',
        'For an exact body geometry program, attach one legality-equivalent clip/exclude basis per compatible legal domain without polygonizing each terminal or smooth overlay.',
        'Keep descriptor evidence and visible route channels separated while applying legal masks.'
      ],
      bypassConditions: [
        'Center product routes without constrained legal domains bypass legality clipping.',
        'Routes with no available legal-domain regions preserve product packets and report diagnostics rather than inventing substitute output.'
      ],
      limitations: [
        'This step must not compute vertexAngle, resolve miter, build source-vertex joins, create endpoint caps, create construction/helper products, or replay renderer stroke joins.',
        'Legality masks may clip existing product geometry but may not become authored sharp-vertex completion.',
        'descriptorProductPolygons remain evidence/product descriptors and must not be promoted to strokeMaskPolygons as visible mask output.',
        'Terminal and smooth ownership overlays must not trigger independent offset, polygon cleanup, or boolean clipping and must remain non-visible.'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/constrained-solid-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-candidate-arrangement.ts',
        'packages/preset/src/components/stroke-render/stroke-product-evidence.ts'
      ],
      ownerStage: 'Stroke Geometry legality clipping',
      allowedContributors: [
        'canonical product polygons',
        'exact body geometry programs',
        'non-visible terminal and smooth ownership overlays',
        'inside legal clip regions',
        'outside legal clip regions',
        'legal-domain arrangement faces',
        'clip/exclude descriptor channels',
        'legal-domain diagnostics'
      ],
      forbiddenContributors: [
        'new source-vertex join footprint geometry',
        'endpoint cap geometry',
        'terminal body overhang as legality repair',
        'construction/helper product as legality repair',
        'renderer strokePathStyle.join',
        'descriptor evidence promoted to visible stroke mask',
        'diagnostic/helper geometry as visible product'
      ],
      evidenceRequired: [
        'input product packet id',
        'input product owner step id',
        'pre/post legality product id parity',
        'body product to terminal/smooth overlay identity parity',
        'complete evidence envelope identity signature before and after legality',
        'legal-domain ids',
        'clip or exclude channel name',
        'legal clip/delete reason',
        'proof that legality did not create join, cap, terminal, or seam geometry',
        'legal clipping route',
        'owner stage'
      ],
      failureReopensStep: 'apply-legality',
      verificationEvidence: {
        gateName: 'pending step 33 legality unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-33-apply-legality.test.ts',
        status: 'pending-schema-alignment',
        artifactPath:
          'pending:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-33-apply-legality.test.ts --reporter=verbose',
        verifiedAt: 'pending'
      },
      currentImplementation:
        'Constrained solid and constrained dashed packet builders apply legal clip/exclude channels. The constrained dashed runtime still polygonizes and clips duplicate terminal products; this owner conflict is reopened for replacement by exact body geometry programs plus non-visible terminal/smooth overlays.',
      requiredAdjustment:
        'Keep legality as clipping/exclusion of declared products, accept descriptor-backed post-legality body units, preserve every overlay id, and remove per-terminal/smooth duplicate clipping. Reopen the owning product step if legality discovers missing join/cap/product ownership.',
      tags: ['canonical']
    },
    'build-resolved-stroke-regions': {
      alignmentStatus: 'architecture-closed',
      latestRule:
        'Resolved stroke records preserve legality-applied product geometry and descriptor routing as ResolvedStrokeProductRecord records before final face assembly; this step may normalize polygon winding/bounds and assemble resolved-packet cache aliases from one immutable common input-signature basis, but must not change join, paint, descriptor visibility, cache invalidation, or render projection semantics.',
      inputs: [
        'legality-applied canonical product packets',
        'legality-applied descriptor-backed body product units',
        'terminal and smooth ownership overlays',
        'post-legality ConstrainedDashedProductEvidenceEnvelope',
        'stroke geometry debug metadata and revision sets',
        'paint packet references emitted by product builders',
        'declared source, topology/domain, dash-allocation, legal-domain, join-ownership, and normalized stroke cache signatures'
      ],
      outputs: [
        'ResolvedStrokeProductRecord records',
        'normalized packet polygons and bounds when canonical polygons exist',
        'unchanged body geometry programs and ownership overlays when descriptor-backed products exist',
        'unchanged ConstrainedDashedProductEvidenceEnvelope',
        'unchanged paint packet references',
        'unchanged renderDescriptor and debugMeta channels',
        'one immutable resolved-packet cache-key basis with early, full, and join-independent aliases'
      ],
      conditions: [
        'Run after legality has accepted, clipped, or excluded product units.',
        'Collect center solid, center dashed, constrained solid, and constrained dashed resolved packets through the same vector route.',
        'Normalize packet polygons only to stable geometry/bounds representation.',
        'When resolved-packet caching is enabled, compose the common key basis once and derive aliases only by adding or omitting the declared join-ownership selector.'
      ],
      bypassConditions: [
        'No stroke records are emitted when upstream product builders return no packets.',
        'Final face assembly bypasses this step only for already-promoted exact faces explicitly returned by the constrained-solid promotion path.'
      ],
      limitations: [
        'This step must not build final faces, render entries, hit packets, export packets, endpoint caps, source-vertex joins, construction/helper products, or renderer stroke path joins.',
        'This step must not collapse descriptor evidence into visible polygons or visible masks.',
        'This step must not mutate paint payload values, stroke join values, resolvedJoin metadata, angle evidence, descriptor route channels, body geometry programs, or terminal/smooth ownership overlays.',
        'Cache aliases must not reserialize common source, fill/domain, or stroke dimensions separately, omit an invalidation dimension, or recompute an upstream semantic value.'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/dashed-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/constrained-solid-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-region-packet.ts',
        'packages/preset/src/components/stroke-render/stroke-product-evidence.ts',
        'packages/preset/src/components/vector.ts'
      ],
      additionalAllowedTestImports: [
        'packages/preset/src/components/stroke-render/stroke-final-face.ts'
      ],
      ownerStage: 'Stroke Geometry resolved packet assembly',
      allowedContributors: [
        'ResolvedStrokeProductRecord geometry',
        'ResolvedStrokeProductRecord paint reference',
        'packet renderDescriptor channel',
        'packet debugMeta and revision evidence',
        'normalization of packet polygons and bounds',
        'one common cache-key basis composed from declared upstream signatures'
      ],
      forbiddenContributors: [
        'final face construction',
        'render entry construction',
        'hit/export packet construction',
        'new join/cap/construction-helper geometry',
        'renderer strokePathStyle.join as source-vertex owner',
        'descriptor evidence promoted to visible product',
        'per-alias source, fill/domain, stroke, or legality semantic serialization'
      ],
      evidenceRequired: [
        'resolved packet geometryId',
        'paint packet identity',
        'renderDescriptor channel identity',
        'debugMeta owner stage or route id',
        'revision set identity',
        'body product and ownership overlay envelope identity signature',
        'single common cache-key basis construction',
        'early/full/join-independent alias selector and non-selector byte parity'
      ],
      failureReopensStep: 'build-resolved-stroke-regions',
      verificationEvidence: {
        gateName: 'protocol plus step 34 resolved-record unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-34-build-resolved-stroke-regions.test.ts',
        status: 'verified',
        artifactPath:
          'terminal:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-34-build-resolved-stroke-regions.test.ts src/__tests__/stroke-flow/step-37-materialize-stroke-product-descriptors.test.ts --reporter=dot',
        verifiedAt: '2026-07-11T00:09:50+08:00'
      },
      currentImplementation:
        'Product builders return resolved stroke product records, vector.ts collects the route outputs as strokePackets, and normalizeResolvedStrokePacketGeometry normalizes packet polygons and bounds before final face assembly. The constrained-dashed packet cache composes source, fill/domain, and stroke dimensions once, derives early/full/join-independent aliases from that basis, and passes the full alias to Step 37 descriptor caching.',
      requiredAdjustment:
        'Preserve one-time common-basis composition, exact alias byte ordering, and all invalidation dimensions. Keep resolved packets as the only handoff from product/legality into final face assembly, and do not move render entry or hit/export projection work into this step.',
      tags: ['canonical']
    },
    'attach-paint-payload': {
      alignmentStatus: 'architecture-closed',
      latestRule:
        'Paint payload attachment carries stroke paint data onto resolved packets without changing geometry, descriptor routing, join metadata, ownership metadata, or downstream projection channels.',
      inputs: [
        'ResolvedStrokeProductRecord geometry records',
        'unchanged ConstrainedDashedProductEvidenceEnvelope',
        'renderable stroke paint fields',
        'stroke.fill-normalized paint identity',
        'geometryId for paint-to-geometry association'
      ],
      outputs: [
        'SolidCenterStrokePaintPacket payloads',
        'resolved packets with unchanged geometry records',
        'paint-attached records with unchanged ConstrainedDashedProductEvidenceEnvelope',
        'paint identity evidence through paintKey',
        'gradientStyle carried as paint data only'
      ],
      conditions: [
        'Run when a resolved packet is emitted by a stroke product builder.',
        'Copy paint fields from the renderable stroke payload into packet.paint.',
        'Keep geometryId aligned between packet.geometry and packet.paint.'
      ],
      bypassConditions: [
        'No paint payload is attached when no resolved packet is emitted.',
        'Final faces may reuse an existing packet paint payload without reconstructing geometry.'
      ],
      limitations: [
        'This step must not alter polygons, bounds, renderDescriptor, debugMeta, authoredJoin, resolvedJoin, vertexAngle, miterAngle, angleSource, or owner metadata.',
        'This step must not build final faces, render entries, hit packets, export packets, or diagnostic visible geometry.',
        'This step must not infer fallback paint outside the normalized stroke paint contract.'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/dashed-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/constrained-solid-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-paint-payload.ts',
        'packages/preset/src/components/stroke-render/stroke-product-evidence.ts'
      ],
      ownerStage: 'Stroke Geometry paint payload attachment',
      allowedContributors: [
        'stroke kind',
        'stroke color',
        'stroke alpha',
        'stroke gradientStyle',
        'stroke paintKey',
        'geometryId association'
      ],
      forbiddenContributors: [
        'geometry mutation',
        'descriptor channel mutation',
        'join metadata mutation',
        'final face construction',
        'render entry construction',
        'hit/export packet construction',
        'fallback paint invented outside normalized stroke data'
      ],
      evidenceRequired: [
        'packet geometryId',
        'paint geometryId',
        'paint kind',
        'paint color',
        'paint alpha',
        'paintKey or gradientStyle identity',
        'body product and ownership overlay envelope identity signature unchanged by paint attachment'
      ],
      failureReopensStep: 'attach-paint-payload',
      verificationEvidence: {
        gateName: 'pending step 35 paint-payload unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-35-attach-paint-payload.test.ts',
        status: 'pending-schema-alignment',
        artifactPath:
          'pending:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-35-attach-paint-payload.test.ts --reporter=verbose',
        verifiedAt: 'pending'
      },
      currentImplementation:
        'Resolved packet builders attach SolidCenterStrokePaintPacket payloads from renderable stroke fields while leaving packet geometry, renderDescriptor, and debugMeta in their product-builder output channels.',
      requiredAdjustment:
        'Keep paint payload attachment as a data-carrying step only; reopen product or final-face stages if geometry or projection logic appears here.',
      tags: ['canonical']
    },
    'build-final-faces': {
      alignmentStatus: 'architecture-closed',
      latestRule:
        'Final records preserve visible descriptors separately from non-visible coverage evidence; center dashed and constrained dashed descriptors are product-builder output encodings, not drag-specific routes.',
      inputs: [
        'paint-attached semantic stroke records',
        'canonical product packets',
        'descriptor-backed body product units with visible/evidence route separation',
        'terminal and smooth ownership overlays',
        'complete ConstrainedDashedProductEvidenceEnvelope'
      ],
      outputs: [
        'final faces for canonical visible product packets',
        'final faces carrying renderDescriptor for descriptor-visible routes',
        'descriptor-backed final faces carrying an exact deferred polygon projection recipe without eager body polygons when eligibility is proven',
        'final-face product identity set preserving body product, owner overlay, interval, terminal role, smooth group, seam boundary, legal domain, and source span ids for downstream render/hit/export consumption',
        'final faces carrying the unchanged ConstrainedDashedProductEvidenceEnvelope',
        'separated hit/export product evidence references and optional non-product diagnostic evidence references'
      ],
      conditions: [
        'Canonical packet routes expose visible product polygons with owner metadata.',
        'Descriptor routes expose renderer-ready strokePathGroups, strokePaths, fillClip, fillExclude, and optional evidence-only descriptorProductPolygons according to the product descriptor contract.',
        'An eligible descriptor-backed final face preserves the exact projection recipe, conservative bounds, canonical join mask polygons, and complete product identity without invoking deferred polygon materialization.',
        'Constrained solid descriptor routes expose only same-owner smooth-span projection; sharp source vertices remain canonical packet output owned by source-vertex join assembly.',
        'Inside mask descriptors keep inside clip masks separate from visible stroke path output.',
        'Outside source-domain and aggregate descriptors keep source-domain, carrier, boundary-domain, and clip polygons evidence-only unless a route explicitly declares visible product polygons.'
      ],
      bypassConditions: [
        'Visible polygon faces may be bypassed only when renderDescriptor is the exact product-visible encoding for the current output channel.'
      ],
      limitations: [
        'Final faces may not flatten descriptor evidence into visible product polygons.',
        'Final faces may not convert terminal or smooth ownership overlays into visible polygons or stroke paths.',
        'Final faces may not collapse authoredJoin:miter plus resolvedJoin:bevel-by-miter-angle into authored bevel.',
        'Final faces may not route authored sharp source-vertex completion through masked-source-stroke descriptor replay.'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/stroke-final-face.ts',
        'packages/preset/src/components/stroke-render/stroke-candidate-arrangement.ts',
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-product-evidence.ts',
        'packages/preset/src/components/vector.ts'
      ],
      ownerStage: 'Stroke Geometry final face assembly',
      allowedContributors: [
        'canonical visible product packets',
        'renderDescriptor visible stroke paths',
        'renderDescriptor clips and excludes as non-visible constraints',
        'descriptorProductPolygons as evidence or explanation only when strokePathGroups own visible output',
        'exact deferred product projection recipe when eager polygons are formally proven unnecessary for the visible route'
      ],
      forbiddenContributors: [
        'diagnostic/helper polygons as visible faces',
        'masked-source-stroke descriptor as sharp source-vertex join owner',
        'descriptorProductPolygons promoted to visible fill when strokePathGroups exist',
        'duplicate interval paint from alias or aggregate descriptors'
      ],
      evidenceRequired: [
        'descriptor route kind',
        'visible output owner',
        'non-visible evidence owner',
        'final-face product identity set with body product, owner overlay, interval, terminal role, smooth group, seam boundary, legal-domain, and source-span ids',
        'complete body product and ownership overlay envelope identity signature',
        'hit/export projection channel',
        'deferred recipe fingerprint and proof that final-face assembly did not invoke it'
      ],
      failureReopensStep: 'build-final-faces',
      verificationEvidence: {
        gateName: 'pending step 36 final-face unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-36-build-final-faces.test.ts',
        status: 'pending-schema-alignment',
        artifactPath:
          'pending:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-36-build-final-faces.test.ts --reporter=verbose',
        verifiedAt: 'pending'
      },
      currentImplementation:
        'Inside solid uses grouped authored stroke paths; center dashed and constrained dashed render entries consume descriptor output from the same product builder used by static, drag, cap switch, reload, and pan.',
      requiredAdjustment:
        'Keep diagnostics and coverage fragments out of visible product descriptors; do not require per-interval visible polygons when the exact mask descriptor is present.',
      tags: ['canonical']
    },
    'emit-render-hit-export-packets': {
      alignmentStatus: 'architecture-closed',
      latestRule:
        'Render packets consume visible descriptors; hit/export may consume non-visible coverage evidence only as projection data.',
      inputs: [
        'final faces',
        'renderDescriptor visible route',
        'hit/export evidence references',
        'final-face ConstrainedDashedProductEvidenceEnvelope'
      ],
      outputs: [
        'visible render packets',
        'hit-test packets',
        'export packets',
        'render, hit-test, and export product identity preserving every body and ownership overlay id',
        'one descriptor-backed composite packet per eligible same-paint compatibility group with a shared deferred projection recipe'
      ],
      conditions: [
        'Visible render packets consume only visible product owners.',
        'Hit/export packets may materialize equivalent geometry from descriptor evidence without changing visible render semantics.',
        'An eligible descriptor-backed composite packet carries completed body paths, endpoint-cap masks, canonical legal join polygons, legal clip/exclude constraints, and the complete identity envelope once.',
        'Render packet construction must preserve but never invoke the deferred polygon projection recipe.',
        'Optional diagnostics, when explicitly enabled outside the inspector step graph, may summarize descriptor evidence but must not become product packets.'
      ],
      bypassConditions: [
        'No bypass may merge render, hit, export, optional diagnostics, or validation evidence into one untagged product.'
      ],
      limitations: [
        'This stage may not define new stroke geometry, re-add endpoint caps, or infer join ownership.'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-region-packet.ts',
        'packages/preset/src/components/stroke-render/stroke-product-evidence.ts',
        'packages/preset/src/components/vector.ts'
      ],
      ownerStage: 'Product Output channel projection',
      allowedContributors: [
        'final face visible output',
        'renderDescriptor visible stroke paths',
        'hit/export evidence with explicit output channel'
      ],
      forbiddenContributors: [
        'coverage evidence as visible render',
        'diagnostic/helper geometry as product render',
        'renderer-side endpoint cap repair'
      ],
      evidenceRequired: [
        'output channel tag',
        'source product owner',
        'body product ids plus terminal and smooth overlay ids',
        'descriptor route mode',
        'hit/export equivalence reason when materialized differently from render',
        'composite compatibility signature, deferred recipe fingerprint, and canonical join polygon reference parity'
      ],
      failureReopensStep: 'emit-render-hit-export-packets',
      verificationEvidence: {
        gateName: 'pending step 38 render-hit-export packet unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-38-emit-render-hit-export-packets.test.ts',
        status: 'pending-schema-alignment',
        artifactPath:
          'pending:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-38-emit-render-hit-export-packets.test.ts --reporter=verbose',
        verifiedAt: 'pending'
      },
      currentImplementation:
        'For the reported inside-solid slice, render consumes grouped visible descriptors while hit/export keep separate projection data.',
      requiredAdjustment:
        'Do not let coverage evidence or diagnostics define visible solid pixels in future slices.',
      tags: ['canonical']
    },
    'render-entries': {
      alignmentStatus: 'architecture-closed',
      latestRule:
        'Render entries are projection-only and must not create constrained stroke semantics; center solid alpha-safe renderer path descriptors, translucent center solid single-composite descriptors, exact center dashed descriptors, and exact constrained dashed inside/outside mask descriptors may skip visible polygon projection/collapse.',
      inputs: [
        'visible render packets',
        'renderDescriptor strokePathGroups, strokePaths, strokeMaskPolygons, descriptorProductPolygons, fillClipPolygons, fillExcludePolygons, and product metadata',
        'descriptor-backed composite packets whose eager body polygons are deferred',
        'final-face product identity set with body product, owner overlay, interval, terminal role, smooth group, seam boundary, legal-domain, and source-span ids',
        'final-face ConstrainedDashedProductEvidenceEnvelope',
        'final-face preserved dash-body seam-boundary artifact for coverage-equivalence proof only'
      ],
      outputs: [
        'renderer-ready strokePathGroups or strokePaths for descriptor-visible routes',
        'renderer-ready strokeMaskPolygons only for visible polygon or cap-mask routes',
        'fillClip/fillExclude constraints and descriptor evidence carried separately',
        'render-entry product identity set preserving every consumed body product, owner overlay, interval, terminal role, smooth group, seam boundary, legal-domain, and source-span id',
        'unchanged ConstrainedDashedProductEvidenceEnvelope on render-entry evidence metadata'
      ],
      conditions: [
        'When strokePathGroups exist, they are the visible route and descriptorProductPolygons remain clip/evidence/explanation only.',
        'When only canonical visible polygons exist, strokeMaskPolygons may carry those visible product polygons.',
        'When an eligible descriptor-backed composite exists, consume its stroke paths, completed cap/join mask polygons, and clip/exclude constraints directly without requesting deferred product polygons.',
        'Constrained solid descriptor paths may remain visible only for same-owner smooth spans that do not cross authored sharp source-vertex ownership boundaries.',
        'Inside mask descriptors merge stroke path output with inside fillClip constraints without promoting descriptorProductPolygons to visible fill.',
        'Outside source-domain and aggregate descriptors may explain source-domain coverage, but visible render must consume the declared visible stroke path or canonical packet route.'
      ],
      bypassConditions: [
        'Descriptor-visible routes may bypass polygon collapse because the descriptor already encodes the exact visible product.',
        'Polygon collapse is allowed only for same-owner ordinary coverage while preserving required provenance.'
      ],
      limitations: [
        'Render entries may not join terminal/source-path descriptor paths across source-vertex ownership boundaries unless the route declares legal same-owner smooth continuity.',
        'Render entries may not make strokePathStyle.join the visible owner for an authored sharp constrained solid source vertex.',
        'Render entries may not promote descriptorProductPolygons to strokeMaskPolygons when strokePathGroups own visible output.',
        'Render entries must decide same-paint single-composite or equivalent alpha-safe evidence before renderer projection; renderer projection may not make this decision.',
        'Render entries must not re-run per-face legal clipping, source-coverage clipping, cleanup, or endpoint canonicalization on constrained dashed post-legality final faces in a way that can delete terminal, join, smooth-continuity, or dash-body products. Additional clipping is allowed only inside a declared same-paint composite/projection route with coverage-equivalence, zero wrong-side residue, and zero seam-loss evidence.',
        'Render entries must not drop, merge away, or recalculate terminal half-dash, seam-boundary, interval, legal-domain, or source-span identity already present on consumed final faces.',
        'Render entries must not materialize terminal or smooth ownership overlays as additional body polygons or stroke paths.',
        'Render entries and renderer projection must not invoke deferred hit/export polygon materialization.',
        'Render entries may sample preserved dash-body seam-boundary artifacts only to prove source coverage survives projection; they may not move, canonicalize, reinterpret, or materialize visible geometry from that evidence.',
        'Inside/outside constrained same-paint arrangements must include resolved legal-domain boundaries as non-visible splitter input; splitter input may cut arrangement cells but must not claim paint, become visible output, synthesize fallback geometry, or erase dash/join/terminal provenance.',
        'Legal-side sample probes used by render-entry equivalence checks must be actual product vertices, product edge midpoints, or points already proven to lie on or inside the candidate visible product. Synthetic proxy points such as vertex-average centroids are not legal-side authority for concave or clipped polygons when exact backend area proof is available.'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-product-evidence.ts',
        'packages/preset/src/components/vector.ts'
      ],
      additionalAllowedTestImports: [
        'packages/preset/src/components/stroke-render/geometry-backend.ts'
      ],
      ownerStage: 'Product Output render-entry materialization',
      allowedContributors: [
        'declared visible strokePathGroups',
        'declared visible strokePaths',
        'canonical visible product polygons',
        'terminal cap polygons only when endpoint cap policy allows visible endpoint ownership'
      ],
      forbiddenContributors: [
        'descriptorProductPolygons as visible fill when strokePathGroups exist',
        'source path replay at authored sharp vertices',
        'masked-source-stroke descriptor as authored sharp source-vertex completion',
        'strokePathStyle.join as visible sharp-vertex owner',
        'construction/helper products as render repair',
        'duplicate interval paint from aggregate descriptors'
      ],
      evidenceRequired: [
        'visible descriptor route',
        'strokePathStyle closed, cap, join, and rendererMiterLimit values',
        'fillClip and fillExclude separation',
        'descriptorProductPolygons evidence-only reason when strokePathGroups exist',
        'same-paint single-composite or alpha-safe equivalence evidence when visible entries overlap',
        'post-legality constrained dashed final-face products preserved without per-face render-entry reclip deletion',
        'terminal half-dash and seam-boundary identity parity between consumed final faces and emitted render entries',
        'terminal and smooth overlay identity parity with zero additional visible contribution',
        'zero deferred polygon materialization calls during render-entry and renderer projection',
        'legal-domain splitter participation evidence for inside/outside constrained same-paint arrangements',
        'legal-side probe source evidence showing samples are on/in product geometry or that exact backend area proof was used'
      ],
      failureReopensStep: 'render-entries',
      verificationEvidence: {
        gateName: 'pending step 39 render-entry unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-39-render-entries.test.ts',
        status: 'pending-schema-alignment',
        artifactPath:
          'pending:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-39-render-entries.test.ts --reporter=verbose',
        verifiedAt: 'pending'
      },
      currentImplementation:
        'Center solid drag render uses renderer path projection only for alpha-safe cases and single-composite descriptor output for translucent self-intersections. Center dashed drag render skips visible packet/geometry rebuilds through exact authored strokePath descriptors; constrained dashed drag render consumes exact inside/outside mask descriptors so visible frames avoid per-interval product intersection while preserving the inside/outside legal-domain product rule.',
      tags: ['risk']
    },
    'renderer-projection': {
      alignmentStatus: 'architecture-closed',
      latestRule:
        'Renderer draw code must not repair geometry or infer side legality.',
      inputs: [
        'renderer-ready render entries',
        'declared visible stroke paths, masks, clips, excludes, and paint payload'
      ],
      outputs: [
        'visible pixels from declared render-entry geometry',
        'no stroke semantic metadata mutation'
      ],
      conditions: [
        'Stroke path projection consumes descriptor style values exactly, including closed, cap, join, and rendererMiterLimit.',
        'Stroke path projection may consume constrained solid descriptors only after product output has split or excluded authored sharp source-vertex ownership boundaries.',
        'Clip and exclude polygons constrain the declared visible geometry without becoming visible paint.',
        'Projection may merge draw calls only when output-channel and owner metadata remain equivalent.'
      ],
      bypassConditions: [
        'Renderer-side shortcuts may skip redundant draws only when they preserve the render-entry product output exactly.'
      ],
      limitations: [
        'Renderer projection may not repair joins, add caps, infer side legality, stitch descriptors, or convert evidence polygons into visible masks.'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/solid-center-stroke-render.ts',
        'packages/preset/src/components/vector.ts'
      ],
      ownerStage: 'Product Output renderer projection',
      allowedContributors: [
        'render-entry visible stroke paths',
        'render-entry visible masks',
        'fillClip/fillExclude constraints',
        'paint payload'
      ],
      forbiddenContributors: [
        'diagnostic/helper geometry',
        'descriptorProductPolygons not declared visible by render entries',
        'renderer-generated sharp source-vertex join geometry',
        'renderer-local join or cap repair'
      ],
      evidenceRequired: [
        'render-entry id and product owner',
        'draw route type',
        'clip/exclude separation',
        'no visible diagnostic/helper geometry'
      ],
      failureReopensStep: 'renderer-projection',
      verificationEvidence: {
        gateName: 'pending step 40 renderer-projection unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-40-renderer-projection.test.ts',
        status: 'pending-schema-alignment',
        artifactPath:
          'pending:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-40-renderer-projection.test.ts --reporter=verbose',
        verifiedAt: 'pending'
      },
      tags: ['risk']
    },
    'hit-export': {
      alignmentStatus: 'architecture-closed',
      latestRule:
        'Hit and export output consume final faces or projected packets only; they may not repair visible geometry, infer stroke joins, or merge diagnostic/helper data into product output.',
      inputs: [
        'stroke final faces',
        'projected hit/export packets derived from final faces',
        'exact descriptor-backed composite projection recipes carried by final faces',
        'final-face ConstrainedDashedProductEvidenceEnvelope',
        'source owner, interval, span, contour, network, legal-domain, bounds, and debug metadata carried by final faces'
      ],
      outputs: [
        'hover hit area backed by projected final-face polygons or one cached exact descriptor projection',
        'lazy export packet channel attached from projected final-face packets or the same cached exact descriptor projection',
        'hit/export metadata preserving source owner and product channel evidence',
        'hit/export product identity preserving every body and ownership overlay id'
      ],
      conditions: [
        'Hit/export runs after final faces and render entries have been materialized for the current route.',
        'Hit/export packets project final-face product geometry and descriptor evidence without changing visible render semantics.',
        'Descriptor-backed hit/export projection materializes at most once per final-face identity and reuses the same polygons for both channels.',
        'Fill hit testing may combine with stroke hit testing only as a hit-test union; it must not mutate stroke product geometry or render output.'
      ],
      bypassConditions: [
        'Empty stroke final-face input may attach an empty export packet channel and null hit area.',
        'Cached final faces may be reused only when their final-face signature and source data match the current route.'
      ],
      limitations: [
        'Hit/export may not draw pixels, create render entries, repair joins, add endpoint caps, infer side legality, or promote diagnostic/helper polygons into visible product output.',
        'Hit/export may not collapse authoredJoin, resolvedJoin, vertexAngle, miterAngle, angleSource, or comparison evidence when that metadata is present upstream.',
        'Hit/export may not turn descriptorProductPolygons into a visible render mask.'
      ],
      implementationFiles: [
        'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
        'packages/preset/src/components/stroke-render/stroke-product-evidence.ts',
        'packages/preset/src/components/vector.ts'
      ],
      ownerStage: 'Product Output hit/export projection',
      allowedContributors: [
        'stroke final faces',
        'projected final-face polygons',
        'final-face source ownership metadata',
        'fill hit-test geometry only as a hit-test union'
      ],
      forbiddenContributors: [
        'diagnostic/helper geometry as product render',
        'renderer draw output as hit/export source of truth',
        'renderer-local join or cap repair',
        'endpoint cap repair',
        'construction/helper products as export repair',
        'descriptorProductPolygons promoted to visible render masks',
        'downstream repair for an upstream semantic mismatch'
      ],
      evidenceRequired: [
        'projected geometry id',
        'final-face owner set',
        'body product ids plus terminal and smooth overlay ids',
        'source span, network, contour, interval, and legal-domain ids',
        'debug metadata preserving product provenance',
        'empty-output reason when no final faces exist',
        'eager/lazy zero symmetric-difference proof, projection cache identity, and no render-time invocation evidence'
      ],
      failureReopensStep: 'hit-export',
      verificationEvidence: {
        gateName: 'pending step 41 hit-export unit gate',
        testFile:
          'packages/preset/src/__tests__/stroke-flow/step-41-hit-export.test.ts',
        status: 'pending-schema-alignment',
        artifactPath:
          'pending:yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-41-hit-export.test.ts --reporter=verbose',
        verifiedAt: 'pending'
      },
      currentImplementation:
        'Hit and export are built from final faces through projected packets in solid-center-stroke-packets.ts, then vector.ts attaches a hover hit area and lazy export packet channel from semanticStrokeFinalFaces.',
      requiredAdjustment:
        'Keep hit/export projection separate from renderer drawing, diagnostics, and join materialization; any hit/export mismatch must reopen this step or the earliest upstream owner stage that produced invalid final faces.',
      tags: ['canonical']
    }
  }

  const laneRows = new Map()

  const nextRowForLane = (lane) => {
    const row = laneRows.get(lane) ?? 0
    laneRows.set(lane, row + 1)
    return row
  }

  const getLaneIndex = (group, laneHint) => {
    const laneIndex = lanes.indexOf(group)
    if (laneIndex >= 0) {
      return laneIndex
    }
    return Number.isFinite(laneHint) ? laneHint : 0
  }

  const defaultStepData = (id, group, laneHint, title, summary, index) => {
    const override = stepOverrides[id] ?? {}
    const alignmentStatus = override.alignmentStatus ?? 'aligned'
    const lane = getLaneIndex(group, laneHint)
    const row = nextRowForLane(lane)
    const stepNumber = index + 1
    const unitTestFile =
      override.unitTestFile ?? getStepUnitTestFile(stepNumber, id)
    const implementationFiles = override.implementationFiles ??
      implementationFilesByGroup[group] ?? [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js'
      ]
    const allowedTestImports = override.allowedTestImports ?? [
      'vitest',
      'node:',
      'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js',
      ...implementationFiles,
      ...(override.additionalAllowedTestImports ?? [])
    ]
    const defaultLatestRule =
      id === 'shared-geometry-model'
        ? 'Shared geometry remains the canonical evidence source for fill, stroke, hit/export, diagnostics, and future shadow.'
        : 'Preserve upstream contracts and do not invent local stroke/vector rules in this step.'
    const ruleRefs = override.ruleRefs ??
      defaultRuleRefsByGroup[group] ?? [ruleId(0)]
    const verificationEvidence = override.verificationEvidence ?? {
      gateName: 'pending inspector-step unit gate',
      testFile: unitTestFile,
      status: 'pending-schema-repair',
      artifactPath: 'pending',
      verifiedAt: 'pending'
    }
    return {
      id,
      stepIndex: index,
      stepNumber,
      refactorStatus: override.refactorStatus ?? getRefactorStatus(index),
      verificationEvidence,
      unitTestFile,
      implementationFiles,
      allowedInputs: override.allowedInputs ??
        override.inputs ?? ['upstream stage output'],
      requiredOutputs: override.requiredOutputs ??
        override.outputs ?? ['downstream stage input'],
      allowedTestImports,
      ...(override.entryPointKind
        ? { entryPointKind: override.entryPointKind }
        : {}),
      ...(override.entryPoint ? { entryPoint: override.entryPoint } : {}),
      ...(override.implementationFunctions
        ? { implementationFunctions: override.implementationFunctions }
        : {}),
      ...(override.helperAllowlist
        ? { helperAllowlist: override.helperAllowlist }
        : {}),
      ...(override.orchestrationBoundary
        ? { orchestrationBoundary: override.orchestrationBoundary }
        : {}),
      ...(override.computationContract
        ? { computationContract: override.computationContract }
        : {}),
      advanceGate: override.advanceGate ?? [
        'yarn workspace @asyra/preset vitest run src/__tests__/stroke-flow-refactor-protocol.test.ts --reporter=verbose',
        `yarn workspace @asyra/preset vitest run ${unitTestFile.replace(
          'packages/preset/',
          ''
        )} --reporter=verbose`
      ],
      integrationUnlockCondition:
        override.integrationUnlockCondition ??
        'Integration remains locked until this step and every required prior inspector-step unit test are verified.',
      group,
      lane,
      row,
      title,
      summary,
      helpers: override.helpers ?? [title.replaceAll(' ', '')],
      inputs: override.inputs ?? ['upstream stage output'],
      outputs: override.outputs ?? ['downstream stage input'],
      conditions: override.conditions ?? [
        'Run when this stage receives valid upstream output for the current route.'
      ],
      bypassConditions: override.bypassConditions ?? [
        'No bypass is allowed unless an explicit route declares it.'
      ],
      limitations: override.limitations ?? [
        'This step may not define local stroke/vector semantics outside the stroke-engine README contract.'
      ],
      ownerStage: override.ownerStage ?? group,
      allowedContributors: override.allowedContributors ?? [
        'declared upstream route outputs'
      ],
      forbiddenContributors: override.forbiddenContributors ?? [
        'diagnostic/helper data as visible product output',
        'downstream repair for an upstream semantic mismatch'
      ],
      evidenceRequired: override.evidenceRequired ?? [
        'input id or revision',
        'output id or revision',
        'route owner stage'
      ],
      failureReopensStep: override.failureReopensStep ?? id,
      routeKind: override.routeKind ?? 'linear-stage',
      decisions: override.decisions ?? [
        'This step follows the stroke-engine README semantic rule.',
        'Any mismatch reopens the earliest owning upstream step.'
      ],
      next: [],
      risks: override.risks ?? [
        'Stale helper behavior can reintroduce a local stroke/vector rule outside the stroke-engine spec.'
      ],
      tags: override.tags ?? [],
      alignmentStatus,
      latestRule: override.latestRule ?? defaultLatestRule,
      currentImplementation:
        override.currentImplementation ??
        'No current mismatch is assigned to this step during this inspector-flow sync.',
      requiredAdjustment:
        override.requiredAdjustment ??
        'Keep this step aligned with the Stroke / Vector System flow and model/render separation.',
      planReferences: strokeDocumentationRefs,
      implementationTrace: override.implementationTrace ?? [
        'Trace implementation against this step before changing runtime code.'
      ],
      ruleRefs,
      asyraStrokeRules: override.asyraStrokeRules ?? resolveRuleRefs(ruleRefs),
      helperConditions: override.helperConditions ?? [
        'Do not add local stroke/vector semantics in helper branches.'
      ],
      definitionOfDone: override.definitionOfDone ?? genericAcceptance,
      acceptanceTests: override.acceptanceTests ?? [
        'Add or run focused implementation probes before closing this step.'
      ],
      knownLimits: override.knownLimits ?? [
        'Inspector-flow sync did not repair runtime rendering.'
      ],
      failureSignals: override.failureSignals ?? [
        'A visible mismatch must reopen the earliest owning upstream step.'
      ],
      e2eStatus: override.e2eStatus ?? [
        'Runtime E2E is pending for the reopened implementation work.'
      ],
      relatedFiles: strokeDocumentationRefs,
      relatedTests: override.relatedTests ?? ['pending runtime-specific probe'],
      debugCommands: override.debugCommands ?? [
        'node --check docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js'
      ],
      evidenceToInspect: override.evidenceToInspect ?? [
        'current Asyra rule review screenshots',
        'render/hit/export descriptor provenance'
      ]
    }
  }

  const steps = stepSpecs.map((spec, index) => defaultStepData(...spec, index))
  const stepById = new Map(steps.map((step) => [step.id, step]))
  const reviewSegmentIdByStepId = new Map(
    wholeFlowReviewContract.reviewSegments.flatMap((segment) =>
      segment.stepIds.map((stepId) => [stepId, segment.id])
    )
  )
  const baseForbiddenResponsibilityActions = [
    'recompute semantic values owned by upstream steps',
    'repair downstream geometry or output by patching a later channel',
    'promote diagnostics, helper geometry, or visual probes into product output'
  ]
  const responsibility = ({
    stepId,
    classification,
    ownerMode,
    primaryArtifacts = [],
    allowedActions = [],
    forbiddenActions = []
  }) => ({
    stepId,
    classification,
    ownerMode,
    reviewSegment: reviewSegmentIdByStepId.get(stepId),
    primaryArtifacts,
    allowedActions,
    forbiddenActions: [
      ...baseForbiddenResponsibilityActions,
      ...forbiddenActions
    ]
  })
  const stepResponsibilityDefinitions = [
    responsibility({
      stepId: 'feature-session-intent',
      classification: 'state-overlay',
      ownerMode: 'capture feature/session intent before model mutation',
      primaryArtifacts: ['intent:feature-session'],
      allowedActions: ['record user intent and feature-session scope']
    }),
    responsibility({
      stepId: 'path-editing-intent',
      classification: 'state-overlay',
      ownerMode: 'record path-editing intent and route selection',
      primaryArtifacts: ['intent:path-editing'],
      allowedActions: ['record edit command, source id, and route intent']
    }),
    responsibility({
      stepId: 'point-handle-drag-operation',
      classification: 'primary-computation',
      ownerMode: 'compute point/handle drag source edits',
      primaryArtifacts: ['stage:point-handle-drag-operation'],
      allowedActions: ['update source point or handle positions']
    }),
    responsibility({
      stepId: 'structural-vector-operation',
      classification: 'primary-computation',
      ownerMode: 'compute structural vector topology edits',
      primaryArtifacts: ['stage:structural-vector-operation'],
      allowedActions: ['update canonical vector structure']
    }),
    responsibility({
      stepId: 'common-api-domain-adapter',
      classification: 'state-overlay',
      ownerMode: 'adapt app operation into common API domain input',
      primaryArtifacts: ['stage:common-api-domain-adapter'],
      allowedActions: ['translate app command into common API payload']
    }),
    responsibility({
      stepId: 'canonical-workspace-data',
      classification: 'primary-computation',
      ownerMode: 'commit canonical workspace data',
      primaryArtifacts: ['stage:canonical-workspace-data'],
      allowedActions: ['write canonical workspace model state']
    }),
    responsibility({
      stepId: 'validate-topology',
      classification: 'validation/evidence-only',
      ownerMode: 'validate topology and produce non-product evidence',
      primaryArtifacts: ['stage:validate-topology'],
      allowedActions: ['validate topology invariants and record evidence']
    }),
    responsibility({
      stepId: 'computed-patch-builder',
      classification: 'primary-computation',
      ownerMode: 'compute model patch from canonical mutation',
      primaryArtifacts: ['stage:computed-patch-builder'],
      allowedActions: ['build computed patch records']
    }),
    responsibility({
      stepId: 'transaction-undo-boundary',
      classification: 'state-overlay',
      ownerMode: 'attach transaction and undo boundary state',
      primaryArtifacts: ['stage:transaction-undo-boundary'],
      allowedActions: ['group patch records into undoable transaction state']
    }),
    responsibility({
      stepId: 'scene-tree-commit',
      classification: 'state-overlay',
      ownerMode: 'commit scene-tree state from canonical patch',
      primaryArtifacts: ['stage:scene-tree-commit'],
      allowedActions: ['commit scene-tree references and revision state']
    }),
    responsibility({
      stepId: 'computed-patch-event',
      classification: 'state-overlay',
      ownerMode: 'publish computed patch event without new semantics',
      primaryArtifacts: ['stage:computed-patch-event'],
      allowedActions: ['emit event payload preserving patch identity']
    }),
    responsibility({
      stepId: 'downstream-subscriber-routing',
      classification: 'state-overlay',
      ownerMode: 'route downstream subscribers to current patch data',
      primaryArtifacts: ['stage:downstream-subscriber-routing'],
      allowedActions: ['dispatch current patch data to subscribers']
    }),
    responsibility({
      stepId: 'render-mirror-patch-apply',
      classification: 'state-overlay',
      ownerMode: 'apply current patch data to render mirror state',
      primaryArtifacts: ['stage:render-mirror-patch-apply'],
      allowedActions: ['preserve patch identity in render mirror state']
    }),
    responsibility({
      stepId: 'render-data-derivation',
      classification: 'primary-computation',
      ownerMode: 'derive render data from current mirror state',
      primaryArtifacts: ['stage:render-data-derivation'],
      allowedActions: ['derive current render data without product geometry']
    }),
    responsibility({
      stepId: 'dirty-revision-graph',
      classification: 'state-overlay',
      ownerMode: 'attach dirty revision graph state',
      primaryArtifacts: ['stage:dirty-revision-graph'],
      allowedActions: ['classify dirty revisions and dependencies']
    }),
    responsibility({
      stepId: 'stage-product-cache',
      classification: 'state-overlay',
      ownerMode: 'attach cache reuse or invalidation state',
      primaryArtifacts: ['cache:verified-product-descriptor'],
      allowedActions: ['reuse exact matching artifacts or force rebuild']
    }),
    responsibility({
      stepId: 'render-strategy-entry',
      classification: 'state-overlay',
      ownerMode: 'select render strategy entry for current state',
      primaryArtifacts: ['stage:render-strategy-entry'],
      allowedActions: ['route current state into the stroke product pipeline']
    }),
    responsibility({
      stepId: 'normalize-render-data',
      classification: 'primary-computation',
      ownerMode: 'normalize render data for stroke source processing',
      primaryArtifacts: ['stage:normalize-render-data'],
      allowedActions: ['normalize source render data and provenance']
    }),
    responsibility({
      stepId: 'normalize-stroke-spec',
      classification: 'primary-computation',
      ownerMode: 'normalize stroke style, width, position, dash, and join spec',
      primaryArtifacts: ['artifact:normalized-stroke-spec'],
      allowedActions: ['normalize stroke spec and default evidence']
    }),
    responsibility({
      stepId: 'shared-geometry-model',
      classification: 'primary-computation',
      ownerMode: 'compute shared source geometry model',
      primaryArtifacts: ['stage:shared-geometry-model'],
      allowedActions: ['build topology-ready shared geometry evidence']
    }),
    responsibility({
      stepId: 'resolve-source-families',
      classification: 'primary-computation',
      ownerMode: 'classify source families for stroke routing',
      primaryArtifacts: ['stage:resolve-source-families'],
      allowedActions: ['resolve source family and topology family']
    }),
    responsibility({
      stepId: 'resolve-stroke-domains',
      classification: 'primary-computation',
      ownerMode: 'compute StrokeDomainPlan records',
      primaryArtifacts: ['artifact:stroke-domain-plan'],
      allowedActions: ['compute domain plan and side authority']
    }),
    responsibility({
      stepId: 'allocate-dash-intervals',
      classification: 'primary-computation',
      ownerMode: 'compute DashProductInterval identity and allocation records',
      primaryArtifacts: ['artifact:dash-product-interval'],
      allowedActions: ['allocate dash intervals and terminal roles']
    }),
    responsibility({
      stepId: 'select-stroke-product-family',
      classification: 'state-overlay',
      ownerMode: 'select product family route from normalized domain inputs',
      primaryArtifacts: ['stage:select-stroke-product-family'],
      allowedActions: ['select center, constrained solid, or constrained dashed family']
    }),
    responsibility({
      stepId: 'build-center-stroke-products',
      classification: 'primary-computation',
      ownerMode: 'compute center stroke product units',
      primaryArtifacts: ['artifact:preLegalityProductUnits'],
      allowedActions: ['build center product geometry and provenance']
    }),
    responsibility({
      stepId: 'build-constrained-solid-products',
      classification: 'primary-computation',
      ownerMode: 'compute constrained solid product units',
      primaryArtifacts: ['artifact:preLegalityProductUnits'],
      allowedActions: ['build constrained solid body products']
    }),
    responsibility({
      stepId: 'build-dash-interval-body-products',
      classification: 'primary-computation',
      ownerMode:
        'compute the single visible constrained dashed interval body product as polygons or an exact body geometry program',
      primaryArtifacts: ['artifact:constrained-dashed-interval-body-product'],
      allowedActions: [
        'build complete visible dash body products including terminal and smooth portions'
      ]
    }),
    responsibility({
      stepId: 'derive-dash-body-seam-boundaries',
      classification: 'primary-computation',
      ownerMode: 'derive non-visible dash body seam-boundary artifacts',
      primaryArtifacts: ['artifact:dash-body-seam-boundary'],
      allowedActions: ['derive seam boundary ids from emitted dash body products']
    }),
    responsibility({
      stepId: 'build-source-vertex-join-products',
      classification: 'primary-computation',
      ownerMode: 'compute source-vertex join and miter evidence products',
      primaryArtifacts: [
        'artifact:source-vertex-join-miter-evidence',
        'artifact:constrained-dashed-source-vertex-join-product'
      ],
      allowedActions: ['build source-vertex join products from declared seams']
    }),
    responsibility({
      stepId: 'build-terminal-body-products',
      classification: 'state-overlay',
      ownerMode:
        'bind non-visible terminal ownership metadata to existing dash body products',
      primaryArtifacts: [
        'artifact:constrained-dashed-join-owned-terminal-body-product'
      ],
      allowedActions: [
        'attach terminal, cap-policy, seam, and join-ownership identity without geometry'
      ]
    }),
    responsibility({
      stepId: 'build-smooth-continuity-products',
      classification: 'primary-computation',
      ownerMode:
        'bind constrained dashed smooth ownership overlays or compute constrained solid same-owner smooth products',
      primaryArtifacts: ['artifact:constrained-dashed-smooth-continuity-product'],
      allowedActions: [
        'attach constrained dashed smooth identity without duplicate geometry',
        'build constrained solid same-owner smooth products'
      ]
    }),
    responsibility({
      stepId: 'select-stroke-descriptor-strategy',
      classification: 'state-overlay',
      ownerMode: 'attach descriptor eligibility and legality-basis state',
      primaryArtifacts: ['artifact:descriptorStrategyRecords'],
      allowedActions: ['record descriptor strategy without materializing output']
    }),
    responsibility({
      stepId: 'apply-legality',
      classification: 'primary-computation',
      ownerMode: 'clip or delete declared products against legal domains',
      primaryArtifacts: ['artifact:postLegalityProductUnits'],
      allowedActions: ['clip products and record legal empty/delete evidence'],
      forbiddenActions: ['create join, cap, terminal, or seam geometry']
    }),
    responsibility({
      stepId: 'build-resolved-stroke-regions',
      classification: 'state-overlay',
      ownerMode: 'assemble resolved stroke region records from legal products',
      primaryArtifacts: ['stage:build-resolved-stroke-regions'],
      allowedActions: ['preserve product identity in resolved region records']
    }),
    responsibility({
      stepId: 'attach-paint-payload',
      classification: 'state-overlay',
      ownerMode: 'attach paint payload while preserving geometry provenance',
      primaryArtifacts: ['stage:attach-paint-payload'],
      allowedActions: ['attach paint and preserve product identity']
    }),
    responsibility({
      stepId: 'build-final-faces',
      classification: 'primary-computation',
      ownerMode: 'materialize final-face product identity set',
      primaryArtifacts: ['artifact:finalFaces'],
      allowedActions: ['build final faces and preserve identity set']
    }),
    responsibility({
      stepId: 'materialize-stroke-product-descriptors',
      classification: 'channel-projection',
      ownerMode:
        'materialize renderer-ready descriptors from already declared final products',
      primaryArtifacts: ['artifact:constrained-dashed-render-descriptor'],
      allowedActions: ['project final product data into descriptor records'],
      forbiddenActions: ['create new geometry during descriptor materialization']
    }),
    responsibility({
      stepId: 'emit-render-hit-export-packets',
      classification: 'channel-projection',
      ownerMode:
        'project final faces into render, hit-test, and export packet channels',
      primaryArtifacts: ['artifact:hit-export-packets'],
      allowedActions: ['emit channel-tagged packets from final faces'],
      forbiddenActions: ['create new geometry while emitting packets']
    }),
    responsibility({
      stepId: 'render-entries',
      classification: 'channel-projection',
      ownerMode: 'project final faces and packets into render-entry records',
      primaryArtifacts: ['artifact:renderEntries'],
      allowedActions: ['materialize render entries and preserve identity parity'],
      forbiddenActions: ['drop final-face terminal identity records']
    }),
    responsibility({
      stepId: 'renderer-projection',
      classification: 'channel-projection',
      ownerMode: 'draw declared render entries without semantic mutation',
      primaryArtifacts: ['stage:renderer-projection'],
      allowedActions: ['draw declared render-entry geometry']
    }),
    responsibility({
      stepId: 'hit-export',
      classification: 'channel-projection',
      ownerMode:
        'project final-face backed hit/export packets without visible render authority',
      primaryArtifacts: ['artifact:hit-export-packets'],
      allowedActions: ['project hit and export packets from final faces']
    })
  ]
  const stepResponsibilityMatrix = Object.fromEntries(
    stepResponsibilityDefinitions.map((entry) => [entry.stepId, entry])
  )
  const routeTypes = ['normal', 'bypass', 'terminal', 'parallel']
  const uniqueTargets = (items) => [...new Set(items)]
  const routeArtifact = (stepId) => `stage:${stepId}`
  const predicate = (field, op, value) => ({ field, op, value })
  const allOf = (...predicates) => ({ all: predicates })
  const not = (predicateShape) => ({ not: predicateShape })
  const inputPredicate = (input) =>
    predicate(
      `source.${String(input).replace(/[^a-z0-9]+/gi, '-')}`,
      'provided',
      true
    )
  const route = ({
    id,
    from,
    to,
    routeType = 'normal',
    exclusiveGroup = `route:${from}`,
    decisionGroup = `decision:${from}`,
    parallelGroup,
    coExecutionGroup,
    routePriority = 100,
    conditionKind = 'when',
    conditionId,
    predicateInputs,
    when,
    elseOf,
    resumeAt,
    nextConsumer,
    condition,
    output,
    ownerStage,
    failureReopensStep,
    inputs = [],
    consumes = [routeArtifact(from)],
    produces = [routeArtifact(to)],
    skipSteps = [],
    dirtyDependencies = ['route-local semantic dependency set'],
    cacheKeyInputs = ['route id', 'source revision'],
    bypassConditions = [],
    limitations = [],
    allowedContributors = [],
    forbiddenContributors = [],
    evidenceRequired = [],
    visibleContributor,
    geometryBasis,
    specRuleRefs = [
      'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#inspector-flow-first-greenfield-refactor-protocol'
    ],
    metricAssertions = [],
    computationContract
  }) => {
    const resolvedConditionId =
      conditionId ?? `${conditionKind}:${id ?? `${from}-to-${to}`}`
    const resolvedPredicateInputs =
      predicateInputs && predicateInputs.length
        ? predicateInputs
        : uniqueTargets([...inputs, ...cacheKeyInputs])
    const resolvedElseOf =
      elseOf ?? (conditionKind === 'else' ? decisionGroup : 'none')
    const resolvedWhen =
      when ??
      (conditionKind === 'else'
        ? {
            elseOf: resolvedElseOf
          }
        : allOf(...resolvedPredicateInputs.map(inputPredicate)))
    const resolvedParallelGroup =
      parallelGroup ?? (routeType === 'parallel' ? exclusiveGroup : 'none')
    const resolvedCoExecutionGroup =
      coExecutionGroup ??
      (routeType === 'parallel' ? resolvedParallelGroup : 'none')
    return {
      id,
      from,
      to,
      routeType,
      exclusiveGroup,
      decisionGroup,
      parallelGroup: resolvedParallelGroup,
      coExecutionGroup: resolvedCoExecutionGroup,
      routePriority,
      conditionKind,
      conditionId: resolvedConditionId,
      predicateInputs: resolvedPredicateInputs,
      when: resolvedWhen,
      elseOf: resolvedElseOf,
      resumeAt: resumeAt ?? to,
      nextConsumer: nextConsumer ?? to,
      condition,
      output,
      ownerStage,
      failureReopensStep,
      inputs,
      consumes,
      produces,
      skipSteps,
      dirtyDependencies,
      cacheKeyInputs,
      bypassConditions,
      limitations,
      allowedContributors,
      forbiddenContributors,
      evidenceRequired,
      visibleContributor:
        visibleContributor ??
        allowedContributors[0] ??
        'declared route contributor',
      geometryBasis: geometryBasis ?? 'declared route product contract',
      specRuleRefs,
      metricAssertions,
      computationContract
    }
  }
  const suppressedRendererProjectionToHitExportRouteId = [
    'linear',
    'renderer-projection',
    'to',
    'hit-export'
  ].join('-')
  const suppressedLinearRouteIds = new Set([
    'linear-select-stroke-product-family-to-build-center-stroke-products',
    'linear-build-center-stroke-products-to-build-constrained-solid-products',
    'linear-build-constrained-solid-products-to-build-dash-interval-body-products',
    'linear-build-dash-interval-body-products-to-derive-dash-body-seam-boundaries',
    'linear-derive-dash-body-seam-boundaries-to-build-source-vertex-join-products',
    'linear-build-dash-interval-body-products-to-build-source-vertex-join-products',
    'linear-build-source-vertex-join-products-to-build-terminal-body-products',
    'linear-build-terminal-body-products-to-build-smooth-continuity-products',
    'linear-build-smooth-continuity-products-to-select-stroke-descriptor-strategy',
    'linear-select-stroke-descriptor-strategy-to-apply-legality',
    'linear-build-final-faces-to-materialize-stroke-product-descriptors',
    'linear-materialize-stroke-product-descriptors-to-emit-render-hit-export-packets',
    suppressedRendererProjectionToHitExportRouteId
  ])
  const linearRoutes = steps.slice(0, -1).flatMap((step, index) => {
    const nextStep = steps[index + 1]
    const id = `linear-${step.id}-to-${nextStep.id}`
    if (suppressedLinearRouteIds.has(id)) {
      return []
    }
    return [
      route({
        id,
        from: step.id,
        to: nextStep.id,
        routeType: 'normal',
        exclusiveGroup: `linear-else:${step.id}`,
        routePriority: 900,
        conditionKind: 'else',
        condition:
          'Else route: take this ordered route only when no explicit branch, bypass, terminal, or parallel route for this step applies.',
        output: 'The upstream stage output becomes the downstream stage input.',
        ownerStage: step.ownerStage,
        failureReopensStep: step.failureReopensStep,
        inputs: step.outputs,
        consumes: [routeArtifact(step.id)],
        produces:
          step.id === 'allocate-dash-intervals'
            ? [
                routeArtifact(nextStep.id),
                'artifact:dash-product-interval'
              ]
            : nextStep.id === 'build-final-faces'
            ? [routeArtifact(nextStep.id), 'artifact:finalFaces']
            : [routeArtifact(nextStep.id)],
        dirtyDependencies: ['upstream stage semantic output'],
        cacheKeyInputs: ['source revision', 'stroke geometry signature'],
        limitations: step.limitations,
        allowedContributors: step.allowedContributors,
        forbiddenContributors: step.forbiddenContributors,
        evidenceRequired: step.evidenceRequired,
        specRuleRefs:
          step.id === 'normalize-stroke-spec'
            ? [
                'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#reference-calibrated-stroke-parameter-contract',
                'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#stroke-parameter-normalization-contract'
              ]
            : undefined
      })
    ]
  })
  const strokeProductRoutes = [
    route({
      id: 'source-drag-dirty-classification',
      from: 'dirty-revision-graph',
      to: 'stage-product-cache',
      routeType: 'normal',
      exclusiveGroup: 'dirty-classification',
      routePriority: 20,
      conditionKind: 'when',
      conditionId: 'dirty:source-drag',
      predicateInputs: [
        'source.revisionChanged',
        'stroke.staticParameterChanged',
        'stroke.paintChanged'
      ],
      when: allOf(
        predicate('source.revisionChanged', 'equals', true),
        predicate('stroke.staticParameterChanged', 'equals', false),
        predicate('stroke.paintChanged', 'equals', false)
      ),
      condition:
        'Current-state vector drag changes source path data without changing static stroke parameters or paint.',
      output:
        'dirty stage keys for source/topology-dependent rebuild with static stroke parameter stages left clean.',
      ownerStage: 'Render Mirror dirty revision graph',
      failureReopensStep: 'dirty-revision-graph',
      inputs: [
        'previous source revision',
        'current drag source revision',
        'unchanged static stroke parameter signature'
      ],
      consumes: [routeArtifact('dirty-revision-graph'), 'dirty:source-drag'],
      produces: [routeArtifact('stage-product-cache'), 'dirty:source-topology'],
      dirtyDependencies: [
        'source path revision',
        'topology revision',
        'domain revision'
      ],
      cacheKeyInputs: [
        'source revision',
        'topology signature',
        'domain signature',
        'static stroke parameter signature'
      ],
      limitations: [
        'The route must not dirty cap, join/miter, dash, width, position, or paint stages when their signatures are unchanged.'
      ],
      allowedContributors: [
        'changed source path data',
        'unchanged static stroke parameter signature'
      ],
      forbiddenContributors: [
        'static stroke parameter dirtying',
        'paint dirtying',
        'render-only drag approximation'
      ],
      evidenceRequired: [
        'source revision delta',
        'static stroke parameter signature equality',
        'ordered dirty stage key list'
      ]
    }),
    route({
      id: 'paint-only-cache-retint',
      from: 'stage-product-cache',
      to: 'attach-paint-payload',
      routeType: 'bypass',
      exclusiveGroup: 'stage-cache-reuse',
      routePriority: 10,
      conditionKind: 'when',
      conditionId: 'cache:paint-only-retint',
      predicateInputs: [
        'stroke.paintChanged',
        'cache.semanticProductMatch',
        'stroke.geometryChanged'
      ],
      when: allOf(
        predicate('stroke.paintChanged', 'equals', true),
        predicate('cache.semanticProductMatch', 'equals', true),
        predicate('stroke.geometryChanged', 'equals', false)
      ),
      condition:
        'Only stroke.fill paint data changed and the cached semantic product descriptor signature matches the current source and geometry-affecting stroke signature.',
      output:
        'cached semantic product descriptor reused with new paint payload attachment; geometry stages are skipped.',
      ownerStage: 'Render Mirror stage product cache',
      failureReopensStep: 'stage-product-cache',
      inputs: [
        'stage dirty keys',
        'cached semantic product descriptor',
        'current stroke.fill paint payload'
      ],
      consumes: [routeArtifact('stage-product-cache'), 'dirty:paint-only'],
      produces: [routeArtifact('attach-paint-payload'), 'cache:paint-retint'],
      skipSteps: [
        'render-strategy-entry',
        'normalize-render-data',
        'normalize-stroke-spec',
        'shared-geometry-model',
        'resolve-source-families',
        'resolve-stroke-domains',
        'allocate-dash-intervals',
        'select-stroke-product-family',
        'build-center-stroke-products',
        'build-constrained-solid-products',
        'build-dash-interval-body-products',
        'build-source-vertex-join-products',
        'build-terminal-body-products',
        'build-smooth-continuity-products',
        'select-stroke-descriptor-strategy',
        'apply-legality',
        'build-resolved-stroke-regions'
      ],
      dirtyDependencies: [
        'stroke.fill paint revision',
        'render output revision'
      ],
      cacheKeyInputs: [
        'source revision',
        'topology/domain signature',
        'dash interval allocation signature',
        'terminal cap signature',
        'join/miter signature',
        'legal-side signature',
        'descriptor-mode signature'
      ],
      limitations: [
        'Paint-only reuse may retint cached product descriptors but must not rebuild or mutate geometry, joins, caps, domains, or dash intervals.'
      ],
      allowedContributors: [
        'cached semantic product descriptor',
        'current normalized stroke.fill paint payload'
      ],
      forbiddenContributors: [
        'source topology rebuild',
        'domain rebuild',
        'dash interval allocation rebuild',
        'terminal cap rebuild',
        'join/miter rebuild'
      ],
      evidenceRequired: [
        'paint-only dirty key',
        'cache hit id',
        'geometry-affecting signature equality',
        'paint payload revision'
      ]
    }),
    route({
      id: 'hidden-output-cache-bypass',
      from: 'stage-product-cache',
      to: 'emit-render-hit-export-packets',
      routeType: 'bypass',
      exclusiveGroup: 'stage-cache-reuse',
      routePriority: 5,
      conditionKind: 'when',
      condition:
        'stroke.fill.visible is false after normalization and upstream semantic invalidation has already been classified.',
      output:
        'empty render, hit, export, and diagnostic-visible channels with hidden-output cache counters.',
      ownerStage: 'Render Mirror stage product cache',
      failureReopensStep: 'stage-product-cache',
      inputs: ['stage dirty keys', 'normalized stroke.fill.visible:false'],
      consumes: [
        routeArtifact('stage-product-cache'),
        'dirty:visibility-hidden'
      ],
      produces: [
        routeArtifact('emit-render-hit-export-packets'),
        'output:hidden-render-packets'
      ],
      skipSteps: [
        'render-strategy-entry',
        'normalize-render-data',
        'normalize-stroke-spec',
        'shared-geometry-model',
        'resolve-source-families',
        'resolve-stroke-domains',
        'allocate-dash-intervals',
        'select-stroke-product-family',
        'build-center-stroke-products',
        'build-constrained-solid-products',
        'build-dash-interval-body-products',
        'build-source-vertex-join-products',
        'build-terminal-body-products',
        'build-smooth-continuity-products',
        'select-stroke-descriptor-strategy',
        'apply-legality',
        'build-resolved-stroke-regions',
        'attach-paint-payload',
        'build-final-faces',
        'materialize-stroke-product-descriptors'
      ],
      dirtyDependencies: ['visibility revision', 'render output revision'],
      cacheKeyInputs: ['element id', 'stroke id', 'visibility revision'],
      limitations: [
        'Hidden output may clear visible channels only after dirty classification; it must not erase upstream dependency tracking or stale geometry invalidation.'
      ],
      allowedContributors: ['normalized hidden stroke.fill state'],
      forbiddenContributors: [
        'visible product geometry',
        'diagnostic/helper visible geometry',
        'stale render entries'
      ],
      evidenceRequired: [
        'hidden-output counter',
        'visibility dirty key',
        'cleared output channel list'
      ]
    }),
    route({
      id: 'verified-product-descriptor-cache-hit',
      from: 'stage-product-cache',
      to: 'build-final-faces',
      routeType: 'bypass',
      exclusiveGroup: 'stage-cache-reuse',
      routePriority: 20,
      conditionKind: 'when',
      conditionId: 'cache:verified-product-descriptor-hit',
      predicateInputs: [
        'cache.verifiedProductDescriptor',
        'cache.dependencySignatureMatch',
        'channel.output'
      ],
      when: allOf(
        predicate('cache.verifiedProductDescriptor', 'equals', true),
        predicate('cache.dependencySignatureMatch', 'equals', true),
        predicate('channel.output', 'provided', true)
      ),
      condition:
        'A cached verified product descriptor exists and every declared source, topology/domain, dash, terminal cap, join/miter, legal-side, descriptor-mode, paint, and output-channel dependency matches the current route.',
      output:
        'cached verified product descriptor reused as final-face input without rerunning semantic geometry stages.',
      ownerStage: 'Render Mirror stage product cache',
      failureReopensStep: 'stage-product-cache',
      inputs: [
        'stage dirty keys',
        'cached verified product descriptor',
        'current route dependency signatures'
      ],
      consumes: [
        routeArtifact('stage-product-cache'),
        'cache:verified-product-descriptor'
      ],
      produces: [routeArtifact('build-final-faces'), 'cache:final-face-input'],
      skipSteps: [
        'render-strategy-entry',
        'normalize-render-data',
        'normalize-stroke-spec',
        'shared-geometry-model',
        'resolve-source-families',
        'resolve-stroke-domains',
        'allocate-dash-intervals',
        'select-stroke-product-family',
        'build-center-stroke-products',
        'build-constrained-solid-products',
        'build-dash-interval-body-products',
        'build-source-vertex-join-products',
        'build-terminal-body-products',
        'build-smooth-continuity-products',
        'select-stroke-descriptor-strategy',
        'apply-legality',
        'build-resolved-stroke-regions',
        'attach-paint-payload'
      ],
      dirtyDependencies: ['route dependency signature set'],
      cacheKeyInputs: [
        'source revision',
        'topology/domain signature',
        'dash interval allocation signature',
        'terminal cap signature',
        'join/miter signature',
        'legal-side signature',
        'descriptor-mode signature',
        'paint signature',
        'output channel'
      ],
      limitations: [
        'Cache hit reuse is legal only for verified descriptors; stale descriptors or render-only reuse reopen this step.'
      ],
      allowedContributors: ['verified cached product descriptor'],
      forbiddenContributors: [
        'stale descriptor',
        'render-only cache reuse',
        'preview-only product output'
      ],
      evidenceRequired: [
        'cache hit id',
        'matched dependency signatures',
        'descriptor verification status'
      ]
    }),
    route({
      id: 'select-center-product-family',
      from: 'select-stroke-product-family',
      to: 'build-center-stroke-products',
      routeType: 'normal',
      exclusiveGroup: 'stroke-product-family-selection',
      decisionGroup: 'decision:select-stroke-product-family',
      routePriority: 10,
      conditionKind: 'when',
      conditionId: 'product-family:center',
      predicateInputs: ['stroke.position', 'dash.present', 'domain.mode'],
      when: allOf(
        predicate('stroke.position', 'equals', 'center'),
        predicate('domain.mode', 'in', [
          'center-product',
          'open-center-product'
        ])
      ),
      condition:
        'Normalized stroke position and domain mode select the center product family.',
      output:
        'Center product family selected; downstream center product routes may emit exact center descriptors or canonical center product packets.',
      ownerStage: 'Stroke Geometry product family selection',
      failureReopensStep: 'select-stroke-product-family',
      inputs: ['normalized stroke position', 'domain mode', 'dash presence'],
      consumes: [routeArtifact('select-stroke-product-family')],
      produces: [routeArtifact('build-center-stroke-products')],
      dirtyDependencies: [
        'stroke position signature',
        'domain mode signature',
        'dash presence'
      ],
      cacheKeyInputs: ['stroke position', 'domain mode', 'dash presence'],
      limitations: [
        'Selection does not build geometry or choose renderer descriptor shape.'
      ],
      allowedContributors: ['normalized center product family evidence'],
      forbiddenContributors: ['visible geometry', 'renderer projection output'],
      evidenceRequired: ['product family:center', 'predicate inputs'],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#asyra-stroke-construction-baseline'
      ]
    }),
    route({
      id: 'select-constrained-solid-product-family',
      from: 'select-stroke-product-family',
      to: 'build-constrained-solid-products',
      routeType: 'normal',
      exclusiveGroup: 'stroke-product-family-selection',
      decisionGroup: 'decision:select-stroke-product-family',
      routePriority: 20,
      conditionKind: 'when',
      conditionId: 'product-family:constrained-solid',
      predicateInputs: ['stroke.position', 'dash.present', 'domain.mode'],
      when: allOf(
        predicate('stroke.position', 'in', ['inside', 'outside']),
        predicate('dash.present', 'equals', false),
        predicate('domain.mode', 'in', [
          'closed-constrained-domain',
          'open-contour-constrained-domain',
          'open-dangling-outside-both-sides'
        ])
      ),
      condition:
        'Inside or outside solid strokes with a constrained domain select the constrained solid product family.',
      output:
        'Constrained solid product family selected; doubled-center products are built before legality clipping.',
      ownerStage: 'Stroke Geometry product family selection',
      failureReopensStep: 'select-stroke-product-family',
      inputs: [
        'normalized stroke position',
        'dash presence:false',
        'domain mode'
      ],
      consumes: [routeArtifact('select-stroke-product-family')],
      produces: [routeArtifact('build-constrained-solid-products')],
      dirtyDependencies: [
        'stroke position signature',
        'domain mode signature',
        'dash presence'
      ],
      cacheKeyInputs: ['stroke position', 'domain mode', 'dash presence'],
      limitations: [
        'Selection does not decide source-vertex join shape or legal clipping output.'
      ],
      allowedContributors: [
        'normalized constrained solid product family evidence'
      ],
      forbiddenContributors: ['visible geometry', 'renderer projection output'],
      evidenceRequired: [
        'product family:constrained-solid',
        'predicate inputs'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#asyra-stroke-construction-baseline'
      ]
    }),
    route({
      id: 'select-constrained-dashed-product-family',
      from: 'select-stroke-product-family',
      to: 'build-dash-interval-body-products',
      routeType: 'normal',
      exclusiveGroup: 'stroke-product-family-selection',
      decisionGroup: 'decision:select-stroke-product-family',
      routePriority: 30,
      conditionKind: 'when',
      conditionId: 'product-family:constrained-dashed',
      predicateInputs: ['stroke.position', 'dash.present', 'domain.mode'],
      when: allOf(
        predicate('stroke.position', 'in', ['inside', 'outside']),
        predicate('dash.present', 'equals', true),
        predicate('domain.mode', 'in', [
          'closed-constrained-domain',
          'open-contour-constrained-domain',
          'open-dangling-outside-both-sides'
        ])
      ),
      condition:
        'Inside or outside dashed strokes with a constrained domain select constrained dashed co-executed product routes.',
      output:
        'Constrained dashed interval-body route selected; source-vertex join, non-visible terminal/smooth ownership overlays, and descriptor strategy may co-execute from the same family.',
      ownerStage: 'Stroke Geometry product family selection',
      failureReopensStep: 'select-stroke-product-family',
      inputs: [
        'normalized stroke position',
        'dash presence:true',
        'domain mode'
      ],
      consumes: [routeArtifact('select-stroke-product-family')],
      produces: [routeArtifact('build-dash-interval-body-products')],
      dirtyDependencies: [
        'stroke position signature',
        'domain mode signature',
        'dash presence'
      ],
      cacheKeyInputs: ['stroke position', 'domain mode', 'dash presence'],
      limitations: [
        'Selection does not build dash body geometry, join geometry, ownership overlays, or descriptors.'
      ],
      allowedContributors: [
        'normalized constrained dashed product family evidence'
      ],
      forbiddenContributors: ['visible geometry', 'renderer projection output'],
      evidenceRequired: [
        'product family:constrained-dashed',
        'predicate inputs'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#asyra-stroke-construction-baseline',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#dash-body-and-join-seam-contract'
      ]
    }),
    route({
      id: 'select-product-family-unsupported',
      from: 'select-stroke-product-family',
      to: 'emit-render-hit-export-packets',
      routeType: 'terminal',
      exclusiveGroup: 'stroke-product-family-selection',
      decisionGroup: 'decision:select-stroke-product-family',
      routePriority: 950,
      conditionKind: 'else',
      condition:
        'Else route: no declared product family predicate matched the normalized stroke/domain inputs.',
      output:
        'Fail-closed empty render, hit, and export packets with unsupported product-family reason metadata; no visible product is emitted.',
      ownerStage: 'Stroke Geometry product family selection',
      failureReopensStep: 'select-stroke-product-family',
      inputs: ['normalized stroke position', 'dash presence', 'domain mode'],
      consumes: [routeArtifact('select-stroke-product-family')],
      produces: [
        routeArtifact('emit-render-hit-export-packets'),
        'output:unsupported-product-family-packets'
      ],
      skipSteps: [
        'build-center-stroke-products',
        'build-constrained-solid-products',
        'build-dash-interval-body-products',
        'derive-dash-body-seam-boundaries',
        'build-source-vertex-join-products',
        'build-terminal-body-products',
        'build-smooth-continuity-products',
        'select-stroke-descriptor-strategy',
        'apply-legality',
        'build-resolved-stroke-regions',
        'attach-paint-payload',
        'build-final-faces',
        'materialize-stroke-product-descriptors'
      ],
      dirtyDependencies: ['stroke family signature'],
      cacheKeyInputs: ['stroke position', 'domain mode', 'dash presence'],
      limitations: [
        'Unsupported-family reason metadata must not create fallback visible geometry or a diagnostics-owned product path.'
      ],
      allowedContributors: ['unsupported product-family empty-output record'],
      forbiddenContributors: [
        'visible fallback output',
        'renderer repair',
        'diagnostics-owned product output'
      ],
      evidenceRequired: ['unmatched product-family predicate inputs'],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#output-channel-separation'
      ]
    }),
    route({
      id: 'center-products-coexecute-source-vertex-join-products',
      from: 'build-center-stroke-products',
      to: 'build-source-vertex-join-products',
      routeType: 'parallel',
      exclusiveGroup: 'center-product-coexecution',
      decisionGroup: 'decision:build-center-stroke-products',
      parallelGroup: 'parallel:center-product-units',
      coExecutionGroup: 'coexec:center-product-units',
      routePriority: 30,
      conditionKind: 'when',
      conditionId: 'center-products:source-vertex-joins',
      predicateInputs: [
        'join.requiresSourceVertexProduct',
        'source.tangentContinuity'
      ],
      when: allOf(
        predicate('join.requiresSourceVertexProduct', 'equals', true),
        not(predicate('source.tangentContinuity', 'equals', true))
      ),
      condition:
        'Center product materialization requires canonical source-vertex join products for authored sharp vertices.',
      output:
        'Source-vertex join product step receives center authored vertex ownership evidence.',
      ownerStage: 'Stroke Geometry center product assembly',
      failureReopensStep: 'build-center-stroke-products',
      inputs: [
        'center product family route',
        'source vertex ownership evidence'
      ],
      consumes: [routeArtifact('build-center-stroke-products')],
      produces: [routeArtifact('build-source-vertex-join-products')],
      dirtyDependencies: ['join/miter signature', 'source tangent signature'],
      cacheKeyInputs: ['source vertex id', 'authored join', 'miterAngle'],
      limitations: [
        'This route only dispatches co-execution; join geometry is owned by build-source-vertex-join-products.'
      ],
      allowedContributors: ['center source-vertex ownership evidence'],
      forbiddenContributors: ['renderer stroke join', 'endpoint cap repair'],
      evidenceRequired: ['source vertex id', 'join dispatch reason'],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#asyra-join-resolution-baseline',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#source-domain-angle-evidence'
      ]
    }),
    route({
      id: 'constrained-solid-products-coexecute-source-vertex-join-products',
      from: 'build-constrained-solid-products',
      to: 'build-source-vertex-join-products',
      routeType: 'parallel',
      exclusiveGroup: 'constrained-solid-product-coexecution',
      decisionGroup: 'decision:build-constrained-solid-products',
      parallelGroup: 'parallel:constrained-solid-product-units',
      coExecutionGroup: 'coexec:constrained-solid-product-units',
      routePriority: 30,
      conditionKind: 'when',
      conditionId: 'constrained-solid-products:source-vertex-joins',
      predicateInputs: [
        'join.requiresSourceVertexProduct',
        'source.tangentContinuity'
      ],
      when: allOf(
        predicate('join.requiresSourceVertexProduct', 'equals', true),
        not(predicate('source.tangentContinuity', 'equals', true))
      ),
      condition:
        'Constrained solid doubled-center products require source-vertex join products before legality clipping.',
      output:
        'Source-vertex join product step receives constrained solid authored vertex ownership evidence.',
      ownerStage: 'Stroke Geometry constrained solid product assembly',
      failureReopensStep: 'build-constrained-solid-products',
      inputs: [
        'constrained solid product route',
        'source vertex ownership evidence'
      ],
      consumes: [routeArtifact('build-constrained-solid-products')],
      produces: [routeArtifact('build-source-vertex-join-products')],
      dirtyDependencies: [
        'join/miter signature',
        'source tangent signature',
        'legal-side signature'
      ],
      cacheKeyInputs: [
        'source vertex id',
        'legal side',
        'authored join',
        'miterAngle'
      ],
      limitations: [
        'Legal masks may clip later; they do not dispatch or define join shape here.'
      ],
      allowedContributors: [
        'constrained solid source-vertex ownership evidence'
      ],
      forbiddenContributors: [
        'clipped legal-side angle',
        'renderer stroke join'
      ],
      evidenceRequired: [
        'source vertex id',
        'legal side',
        'join dispatch reason'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#asyra-join-resolution-baseline',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#source-domain-angle-evidence'
      ]
    }),
    route({
      id: 'constrained-solid-products-coexecute-smooth-continuity-products',
      from: 'build-constrained-solid-products',
      to: 'build-smooth-continuity-products',
      routeType: 'parallel',
      exclusiveGroup: 'constrained-solid-product-coexecution',
      decisionGroup: 'decision:build-constrained-solid-products',
      parallelGroup: 'parallel:constrained-solid-product-units',
      coExecutionGroup: 'coexec:constrained-solid-product-units',
      routePriority: 35,
      conditionKind: 'when',
      conditionId: 'constrained-solid-products:smooth-continuity',
      predicateInputs: [
        'stroke.position',
        'dash.present',
        'source.tangentContinuity',
        'descriptor.ownerBoundarySplit'
      ],
      when: allOf(
        predicate('stroke.position', 'in', ['inside', 'outside']),
        predicate('dash.present', 'equals', false),
        predicate('source.tangentContinuity', 'equals', true),
        predicate('descriptor.ownerBoundarySplit', 'equals', true)
      ),
      condition:
        'Constrained solid doubled-center products dispatch same-owner smooth-continuity spans before legality when the descriptor or canonical packet path must prove the span does not cross an authored sharp source vertex.',
      output:
        'Smooth-continuity product step receives constrained solid same-owner span evidence for canonical packet or descriptor eligibility.',
      ownerStage: 'Stroke Geometry constrained solid product assembly',
      failureReopensStep: 'build-constrained-solid-products',
      inputs: [
        'constrained solid product route',
        'same-owner smooth-continuity span evidence',
        'sharp source-vertex boundary split or exclusion evidence'
      ],
      consumes: [routeArtifact('build-constrained-solid-products')],
      produces: [routeArtifact('build-smooth-continuity-products')],
      dirtyDependencies: [
        'smooth-continuity signature',
        'legal-side signature',
        'descriptor-mode signature'
      ],
      cacheKeyInputs: [
        'smooth-continuity group id',
        'legal side',
        'descriptor mode'
      ],
      limitations: [
        'This route only dispatches co-execution; smooth-continuity geometry is owned by build-smooth-continuity-products.',
        'Sharp source-vertex coverage remains owned by build-source-vertex-join-products and must not be completed by strokePathStyle.join.'
      ],
      allowedContributors: [
        'constrained solid same-owner smooth-continuity evidence'
      ],
      forbiddenContributors: [
        'source path replay across authored sharp vertices',
        'renderer stroke join',
        'endpoint cap repair'
      ],
      evidenceRequired: [
        'smooth-continuity group id',
        'same-owner span proof',
        'sharp source-vertex boundary split or exclusion evidence'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#smooth-curvature-non-join-contract',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#product-legality-and-descriptor-encoding'
      ]
    }),
    route({
      id: 'constrained-dashed-products-derive-seam-boundaries',
      from: 'build-dash-interval-body-products',
      to: 'derive-dash-body-seam-boundaries',
      routeType: 'normal',
      exclusiveGroup: 'constrained-dashed-product-coexecution',
      decisionGroup: 'decision:build-dash-interval-body-products',
      parallelGroup: 'parallel:constrained-dashed-product-units',
      coExecutionGroup: 'coexec:constrained-dashed-product-units',
      routePriority: 25,
      conditionKind: 'when',
      conditionId: 'constrained-dashed-products:derive-seam-boundaries',
      predicateInputs: [
        'dash.intervalVisible',
        'dash.requiresJoinOrTerminalConsumer',
        'dash.bodyBoundaryEvidence'
      ],
      when: allOf(
        predicate('dash.intervalVisible', 'equals', true),
        predicate('dash.requiresJoinOrTerminalConsumer', 'equals', true),
        predicate('dash.bodyBoundaryEvidence', 'provided', true)
      ),
      condition:
        'A constrained dashed body product has emitted canonical polygon or exact geometry-program boundary evidence and a downstream join or terminal ownership consumer requires stable seam identity.',
      output:
        'The seam-boundary derivation step receives emitted dash body boundary evidence and produces a non-visible dash body seam boundary artifact.',
      ownerStage: 'Stroke Geometry dash seam boundary derivation',
      failureReopensStep: 'build-dash-interval-body-products',
      inputs: [
        'pre-legality dash interval body products',
        'dash body boundary evidence',
        'DashProductInterval provenance',
        'endpoint cap policy'
      ],
      consumes: [
        routeArtifact('build-dash-interval-body-products'),
        'artifact:constrained-dashed-interval-body-product'
      ],
      produces: [
        routeArtifact('derive-dash-body-seam-boundaries'),
        'artifact:dash-body-seam-boundary'
      ],
      computationContract: {
        computedAt: 'derive-dash-body-seam-boundaries',
        consumesArtifacts: [
          'artifact:constrained-dashed-interval-body-product'
        ],
        producesArtifacts: ['artifact:dash-body-seam-boundary'],
        consumedBy: [
          'build-source-vertex-join-products',
          'build-terminal-body-products'
        ],
        mustNotRecomputeAfter: 'build-source-vertex-join-products',
        forbiddenLateComputation: [
          'dash body seam boundary relocation',
          'fresh offset point substitution',
          'endpoint cap suppression reinterpretation',
          'dash interval provenance reinterpretation'
        ]
      },
      dirtyDependencies: [
        'dash interval allocation signature',
        'terminal cap signature',
        'legal-side signature'
      ],
      cacheKeyInputs: [
        'dash interval id',
        'split range id',
        'terminal role',
        'endpoint cap policy',
        'dash body product boundary signature'
      ],
      limitations: [
        'This route may only forward emitted body boundary evidence; it must not move endpoints, recompute dash allocation, complete joins, create visible seam repair, or materialize a body geometry program into duplicate polygons.'
      ],
      allowedContributors: [
        'emitted canonical polygon or exact geometry-program boundary evidence',
        'DashProductInterval provenance',
        'endpoint cap policy evidence'
      ],
      forbiddenContributors: [
        'fresh offset point substitution',
        'source-vertex join geometry',
        'terminal body geometry',
        'visible seam repair geometry'
      ],
      evidenceRequired: [
        'dash body product id',
        'boundary evidence id',
        'dash body seam boundary artifact id',
        'proof that seam endpoints are derived from the emitted dash body product boundary identity'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#dash-body-and-join-seam-contract',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#computation-ownership-and-timing-contract'
      ]
    }),
    route({
      id: 'constrained-dashed-products-coexecute-source-vertex-join-products',
      from: 'derive-dash-body-seam-boundaries',
      to: 'build-source-vertex-join-products',
      routeType: 'parallel',
      exclusiveGroup: 'constrained-dashed-product-coexecution',
      decisionGroup: 'decision:derive-dash-body-seam-boundaries',
      parallelGroup: 'parallel:constrained-dashed-product-units',
      coExecutionGroup: 'coexec:constrained-dashed-product-units',
      routePriority: 30,
      conditionKind: 'when',
      conditionId: 'constrained-dashed-products:source-vertex-joins',
      predicateInputs: [
        'join.requiresSourceVertexProduct',
        'dash.incidentBodyCoverage'
      ],
      when: allOf(
        predicate('join.requiresSourceVertexProduct', 'equals', true),
        predicate('dash.incidentBodyCoverage', 'equals', true)
      ),
      condition:
        'Constrained dashed product assembly co-executes source-vertex join products when incident dash bodies reach authored sharp vertices.',
      output:
        'Source-vertex join product step receives incident dash seam boundary evidence.',
      ownerStage: 'Stroke Geometry dashed interval body assembly',
      failureReopensStep: 'derive-dash-body-seam-boundaries',
      inputs: [
        'DashProductInterval body products',
        'incident seam boundary ids',
        'dash body seam boundary artifacts'
      ],
      consumes: [
        routeArtifact('derive-dash-body-seam-boundaries'),
        'artifact:dash-body-seam-boundary'
      ],
      produces: [routeArtifact('build-source-vertex-join-products')],
      dirtyDependencies: [
        'dash interval allocation signature',
        'join/miter signature',
        'legal-side signature'
      ],
      cacheKeyInputs: [
        'dash interval ids',
        'source vertex id',
        'authored join',
        'miterAngle',
        'dash body seam boundary signature'
      ],
      limitations: [
        'This route only dispatches co-execution; source-vertex join geometry remains owned by build-source-vertex-join-products.',
        'This route may not recompute, relocate, or synthesize dash seam boundaries while dispatching source-vertex join assembly.'
      ],
      allowedContributors: ['incident dash seam evidence'],
      forbiddenContributors: [
        'endpoint cap repair',
        'terminal overhang repair',
        'duplicate interval paint'
      ],
      evidenceRequired: [
        'incident dash seam boundary ids',
        'dash body seam boundary artifact ids',
        'join dispatch reason'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#dash-body-and-join-seam-contract',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#asyra-join-resolution-baseline',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#source-domain-angle-evidence',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#computation-ownership-and-timing-contract'
      ]
    }),
    route({
      id: 'constrained-dashed-products-coexecute-terminal-body-products',
      from: 'derive-dash-body-seam-boundaries',
      to: 'build-terminal-body-products',
      routeType: 'parallel',
      exclusiveGroup: 'constrained-dashed-product-coexecution',
      decisionGroup: 'decision:derive-dash-body-seam-boundaries',
      parallelGroup: 'parallel:constrained-dashed-product-units',
      coExecutionGroup: 'coexec:constrained-dashed-product-units',
      routePriority: 40,
      conditionKind: 'when',
      conditionId: 'constrained-dashed-products:terminal-bodies',
      predicateInputs: ['dash.terminalRole', 'dash.intervalVisible'],
      when: allOf(
        predicate('dash.terminalRole', 'in', ['start', 'end', 'start-end']),
        predicate('dash.intervalVisible', 'equals', true)
      ),
      condition:
        'Constrained dashed product assembly co-executes non-visible terminal ownership binding for visible terminal portions already owned by dash interval body products.',
      output:
        'Terminal body product step receives the dash body product id, terminal role, endpoint cap policy, seam id, and join ownership evidence.',
      ownerStage: 'Stroke Geometry dashed interval body assembly',
      failureReopensStep: 'derive-dash-body-seam-boundaries',
      inputs: [
        'terminal dash interval body product id',
        'terminal role',
        'endpoint cap policy',
        'join ownership signature',
        'dash body seam boundary artifacts'
      ],
      consumes: [
        routeArtifact('derive-dash-body-seam-boundaries'),
        'artifact:dash-body-seam-boundary'
      ],
      produces: [routeArtifact('build-terminal-body-products')],
      dirtyDependencies: [
        'dash interval allocation signature',
        'terminal cap signature',
        'legal-side signature'
      ],
      cacheKeyInputs: [
        'terminal interval id',
        'terminal role',
        'endpoint cap policy',
        'dash body seam boundary signature'
      ],
      limitations: [
        'This route only dispatches ownership binding; visible terminal body geometry remains owned by build-dash-interval-body-products.',
        'This route may not emit polygons, stroke paths, or paint, and may not recompute, relocate, or synthesize dash seam boundaries.'
      ],
      allowedContributors: [
        'terminal interval ownership evidence',
        'dash body product identity'
      ],
      forbiddenContributors: [
        'visible terminal body geometry',
        'source-vertex apex coverage',
        'endpoint-side cap repair'
      ],
      evidenceRequired: [
        'terminal role',
        'endpoint cap policy',
        'dash body product id',
        'dash body seam boundary artifact ids',
        'terminal dispatch reason'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#dash-body-and-join-seam-contract',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#computation-ownership-and-timing-contract'
      ]
    }),
    route({
      id: 'constrained-dashed-products-coexecute-smooth-continuity-products',
      from: 'build-dash-interval-body-products',
      to: 'build-smooth-continuity-products',
      routeType: 'parallel',
      exclusiveGroup: 'constrained-dashed-product-coexecution',
      decisionGroup: 'decision:build-dash-interval-body-products',
      parallelGroup: 'parallel:constrained-dashed-product-units',
      coExecutionGroup: 'coexec:constrained-dashed-product-units',
      routePriority: 50,
      conditionKind: 'when',
      conditionId: 'constrained-dashed-products:smooth-continuity',
      predicateInputs: ['source.tangentContinuity', 'source.curvature'],
      when: allOf(
        predicate('source.tangentContinuity', 'equals', true),
        predicate('source.curvature', 'provided', true)
      ),
      condition:
        'Constrained dashed product assembly co-executes non-visible smooth-continuity ownership binding for tangent-continuous body products, including high-curvature spans.',
      output:
        'Smooth-continuity product step receives referenced dash body product ids and continuous footprint evidence.',
      ownerStage: 'Stroke Geometry dashed interval body assembly',
      failureReopensStep: 'build-dash-interval-body-products',
      inputs: [
        'smooth-continuity group',
        'referenced dash body product ids',
        'curve coverage evidence'
      ],
      consumes: [routeArtifact('build-dash-interval-body-products')],
      produces: [routeArtifact('build-smooth-continuity-products')],
      dirtyDependencies: [
        'dash interval allocation signature',
        'smooth-continuity signature',
        'legal-side signature'
      ],
      cacheKeyInputs: [
        'smooth-continuity group id',
        'dash interval id',
        'curve sample signature'
      ],
      limitations: [
        'High curvature is not a join trigger; this route must not dispatch source-vertex join ownership or emit another copy of visible body geometry.'
      ],
      allowedContributors: [
        'smooth-continuity evidence',
        'dash body product identity'
      ],
      forbiddenContributors: [
        'source-vertex join ownership',
        'visible body polygons or stroke paths',
        'radial slice repair'
      ],
      evidenceRequired: [
        'smooth-continuity group id',
        'tangent-continuity proof'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#smooth-curvature-non-join-contract'
      ]
    }),
    route({
      id: 'constrained-dashed-products-coexecute-descriptor-strategy',
      from: 'build-dash-interval-body-products',
      to: 'select-stroke-descriptor-strategy',
      routeType: 'parallel',
      exclusiveGroup: 'constrained-dashed-product-coexecution',
      decisionGroup: 'decision:build-dash-interval-body-products',
      parallelGroup: 'parallel:constrained-dashed-product-units',
      coExecutionGroup: 'coexec:constrained-dashed-product-units',
      routePriority: 60,
      conditionKind: 'when',
      conditionId: 'constrained-dashed-products:descriptor-strategy',
      predicateInputs: ['descriptor.mode', 'descriptor.requiredLegalityBasis'],
      when: allOf(
        predicate('descriptor.mode', 'in', ['strokePathGroups', 'strokePaths']),
        predicate('descriptor.requiredLegalityBasis', 'in', [
          'post-legality',
          'legality-equivalent'
        ])
      ),
      condition:
        'Constrained dashed product assembly may co-execute descriptor strategy selection only by recording the required post-legality or legality-equivalent basis.',
      output:
        'Descriptor strategy step receives descriptor eligibility, required legal basis, owner-boundary, and output-channel intent evidence.',
      ownerStage: 'Stroke Geometry dashed interval body assembly',
      failureReopensStep: 'build-dash-interval-body-products',
      inputs: [
        'product units',
        'descriptor route kind',
        'required legality basis'
      ],
      consumes: [routeArtifact('build-dash-interval-body-products')],
      produces: [
        routeArtifact('select-stroke-descriptor-strategy'),
        'artifact:descriptorStrategyRecords'
      ],
      dirtyDependencies: [
        'descriptor-mode signature',
        'legal-side signature',
        'dash interval allocation signature'
      ],
      cacheKeyInputs: [
        'descriptor mode',
        'required legality basis',
        'dash interval ids'
      ],
      limitations: [
        'Descriptor strategy selection must not materialize renderer-ready descriptors or consume post-legality artifacts before apply-legality has run.'
      ],
      allowedContributors: [
        'descriptor eligibility metadata',
        'required legal-basis evidence'
      ],
      forbiddenContributors: [
        'renderer-ready descriptor',
        'post-legality artifact consumption before legality',
        'evidence polygons as visible paint'
      ],
      evidenceRequired: [
        'descriptor route kind',
        'required legality basis',
        'product unit ids',
        'owner-boundary split proof'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#product-legality-and-descriptor-encoding'
      ]
    }),
    route({
      id: 'center-solid-authored-stroke-descriptor',
      from: 'build-center-stroke-products',
      to: 'build-final-faces',
      routeType: 'bypass',
      exclusiveGroup: 'center-product-output',
      decisionGroup: 'decision:build-center-stroke-products',
      routePriority: 10,
      conditionId: 'center-solid:exact-descriptor',
      predicateInputs: ['stroke.position', 'dash.present', 'descriptor.mode'],
      when: allOf(
        predicate('stroke.position', 'equals', 'center'),
        predicate('dash.present', 'equals', false),
        predicate('descriptor.mode', 'equals', 'exact-center-stroke')
      ),
      condition:
        'stroke.position is center, dash is absent, and authored center stroke descriptor is the exact visible product.',
      output:
        'renderDescriptor.strokePaths or strokePathGroups with authored cap, join, rendererMiterLimit, closed state, and paint provenance.',
      ownerStage: 'Stroke Geometry product descriptor assembly',
      failureReopensStep: 'build-center-stroke-products',
      inputs: ['normalized center stroke spec', 'authored source path'],
      bypassConditions: [
        'May bypass polygon product faces only when alpha handling is renderer-equivalent for the current paint.'
      ],
      skipSteps: [
        'apply-legality',
        'build-resolved-stroke-regions',
        'attach-paint-payload'
      ],
      consumes: [routeArtifact('build-center-stroke-products')],
      produces: [routeArtifact('build-final-faces'), 'artifact:finalFaces'],
      dirtyDependencies: ['center product descriptor signature'],
      cacheKeyInputs: ['stroke position', 'dash presence', 'descriptor mode'],
      limitations: [
        'Must not turn helper polygons, face strips, or diagnostics into visible center solid geometry.'
      ],
      allowedContributors: ['authored center stroke path descriptor'],
      forbiddenContributors: [
        'face strip product',
        'diagnostic/helper polygon'
      ],
      evidenceRequired: [
        'source path id',
        'strokePathStyle cap/join/rendererMiterLimit/closed'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#asyra-stroke-construction-baseline',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#product-legality-and-descriptor-encoding'
      ]
    }),
    route({
      id: 'center-dashed-authored-stroke-descriptor',
      from: 'build-center-stroke-products',
      to: 'build-final-faces',
      routeType: 'bypass',
      exclusiveGroup: 'center-product-output',
      decisionGroup: 'decision:build-center-stroke-products',
      routePriority: 20,
      conditionKind: 'when',
      conditionId: 'center-dashed:exact-descriptor',
      predicateInputs: ['stroke.position', 'dash.present', 'descriptor.mode'],
      when: allOf(
        predicate('stroke.position', 'equals', 'center'),
        predicate('dash.present', 'equals', true),
        predicate('descriptor.mode', 'equals', 'exact-center-dashed-stroke')
      ),
      condition:
        'stroke.position is center and dash allocation is owned by the authored center network.',
      output:
        'visible dash descriptor stroke paths with dash interval provenance and authored cap, join, rendererMiterLimit, and closed state.',
      ownerStage: 'Stroke Geometry product descriptor assembly',
      failureReopensStep: 'build-center-stroke-products',
      inputs: [
        'center dash intervals',
        'continuous-network endpoint terminal records'
      ],
      limitations: [
        'Segment boundaries must not reset center dash allocation state, and renderer projection must not create extra endpoint caps.'
      ],
      skipSteps: [
        'apply-legality',
        'build-resolved-stroke-regions',
        'attach-paint-payload'
      ],
      consumes: [routeArtifact('build-center-stroke-products')],
      produces: [routeArtifact('build-final-faces'), 'artifact:finalFaces'],
      dirtyDependencies: [
        'center dash interval signature',
        'descriptor-mode signature'
      ],
      cacheKeyInputs: [
        'stroke position',
        'dash interval allocation signature',
        'descriptor mode'
      ],
      allowedContributors: [
        'center DashProductInterval body',
        'true open endpoint cap when policy allows'
      ],
      forbiddenContributors: [
        'source-vertex endpoint cap repair',
        'duplicate interval paint'
      ],
      evidenceRequired: [
        'dash interval id',
        'terminal role',
        'endpoint cap policy'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#asyra-stroke-construction-baseline',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#product-legality-and-descriptor-encoding'
      ]
    }),
    route({
      id: 'center-products-canonical-output-else',
      from: 'build-center-stroke-products',
      to: 'build-final-faces',
      routeType: 'normal',
      exclusiveGroup: 'center-product-output',
      decisionGroup: 'decision:build-center-stroke-products',
      routePriority: 900,
      conditionKind: 'else',
      condition:
        'Else route: use canonical center product packets when exact center descriptor predicates do not apply.',
      output:
        'Center product packets proceed to final-face assembly without renderer-owned join or cap repair.',
      ownerStage: 'Stroke Geometry center product assembly',
      failureReopensStep: 'build-center-stroke-products',
      inputs: ['center product packets'],
      consumes: [routeArtifact('build-center-stroke-products')],
      produces: [routeArtifact('build-final-faces'), 'artifact:finalFaces'],
      dirtyDependencies: ['center product packet ids'],
      cacheKeyInputs: ['center product packet ids', 'descriptor mode'],
      limitations: [
        'Else output must not substitute renderer path joins for canonical product packets.'
      ],
      allowedContributors: ['canonical center product packets'],
      forbiddenContributors: [
        'renderer-local join repair',
        'diagnostic/helper visible geometry'
      ],
      evidenceRequired: [
        'center product packet ids',
        'descriptor non-match reason'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#asyra-stroke-construction-baseline'
      ]
    }),
    route({
      id: 'center-solid-canonical-source-vertex-join-footprint',
      from: 'build-source-vertex-join-products',
      to: 'build-final-faces',
      routeType: 'normal',
      exclusiveGroup: 'source-vertex-join-product-output',
      decisionGroup: 'decision:build-source-vertex-join-products',
      routePriority: 30,
      conditionKind: 'when',
      conditionId: 'center-solid:source-vertex-join-footprint',
      predicateInputs: [
        'stroke.position',
        'dash.present',
        'join.requiresSourceVertexProduct',
        'source.tangentContinuity'
      ],
      when: allOf(
        predicate('stroke.position', 'equals', 'center'),
        predicate('dash.present', 'equals', false),
        predicate('join.requiresSourceVertexProduct', 'equals', true),
        not(predicate('source.tangentContinuity', 'equals', true))
      ),
      condition:
        'stroke.position is center, dash is absent, and polygon product materialization is required for a source vertex.',
      output:
        'segment body products plus canonical source-vertex join footprint products carrying authoredJoin, resolvedJoin, vertexAngle, miterAngle, angleSource, comparison evidence, visibleContributor:source-vertex-join, and geometryBasis:canonical-join-footprint.',
      ownerStage: 'Stroke Geometry source-vertex join assembly',
      failureReopensStep: 'build-source-vertex-join-products',
      inputs: [
        'authored source vertex',
        'previous and next authored center-path tangents',
        'center stroke width and side',
        'authored join, miterAngle, cap policy, and owner id'
      ],
      consumes: [routeArtifact('build-source-vertex-join-products')],
      produces: [routeArtifact('build-final-faces'), 'artifact:finalFaces'],
      dirtyDependencies: [
        'source tangent signature',
        'join/miter signature',
        'center product signature'
      ],
      cacheKeyInputs: [
        'source vertex id',
        'stroke position',
        'authored join',
        'miterAngle'
      ],
      limitations: [
        'Endpoint caps may close only true open path endpoints.',
        'No terminal body, aggregate descriptor, render cover, helper polygon, or post-boolean footprint may complete a center authored sharp vertex.'
      ],
      allowedContributors: [
        'source segment body product',
        'canonical source-vertex join footprint',
        'true open endpoint cap'
      ],
      visibleContributor: 'source-vertex-join',
      geometryBasis: 'canonical-join-footprint',
      forbiddenContributors: [
        'endpoint cap at authored interior vertex',
        'render cover polygon',
        'diagnostic/helper polygon',
        'post-boolean footprint angle'
      ],
      evidenceRequired: [
        'authoredJoin',
        'resolvedJoin',
        'vertexAngle',
        'miterAngle',
        'angleSource',
        'angle comparison evidence',
        'owner id'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#asyra-join-resolution-baseline',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#source-domain-angle-evidence'
      ]
    }),
    route({
      id: 'constrained-solid-doubled-center-mask',
      from: 'build-constrained-solid-products',
      to: 'apply-legality',
      routeType: 'normal',
      exclusiveGroup: 'constrained-solid-product-output',
      decisionGroup: 'decision:build-constrained-solid-products',
      routePriority: 40,
      conditionKind: 'when',
      conditionId: 'constrained-solid:doubled-center-mask',
      predicateInputs: ['stroke.position', 'dash.present', 'domain.mode'],
      when: allOf(
        predicate('stroke.position', 'in', ['inside', 'outside']),
        predicate('dash.present', 'equals', false),
        predicate('domain.mode', 'in', [
          'closed-constrained-domain',
          'open-contour-constrained-domain',
          'open-dangling-outside-both-sides'
        ])
      ),
      condition: 'stroke.position is inside or outside and dash is absent.',
      output:
        'doubled authored center-stroke product with authored cap, authoredJoin, miterAngle, and source-domain join resolution before legal clipping.',
      ownerStage: 'Stroke Geometry product descriptor assembly',
      failureReopensStep: 'build-constrained-solid-products',
      inputs: [
        'normalized constrained solid stroke spec',
        'inside/outside filled-region mask'
      ],
      limitations: [
        'Legal clipping may not define the vertexAngle or replace source-domain join resolution.'
      ],
      allowedContributors: [
        'doubled authored center stroke',
        'legal filled-region mask'
      ],
      forbiddenContributors: [
        'visible face strip',
        'clipped legal-side angle as miter source'
      ],
      produces: [
        routeArtifact('apply-legality'),
        'artifact:preLegalityProductUnits'
      ],
      evidenceRequired: ['authoredJoin', 'miterAngle', 'legal domain id'],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#asyra-stroke-construction-baseline',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#product-legality-and-descriptor-encoding'
      ]
    }),
    route({
      id: 'constrained-solid-canonical-source-vertex-join-footprint',
      from: 'build-source-vertex-join-products',
      to: 'apply-legality',
      routeType: 'parallel',
      exclusiveGroup: 'source-vertex-join-product-output',
      decisionGroup: 'decision:build-source-vertex-join-products',
      parallelGroup: 'parallel:source-vertex-join-product-units',
      coExecutionGroup: 'coexec:source-vertex-join-product-units',
      routePriority: 45,
      conditionKind: 'when',
      conditionId: 'constrained-solid:source-vertex-join-footprint',
      predicateInputs: [
        'stroke.position',
        'dash.present',
        'join.requiresSourceVertexProduct',
        'source.tangentContinuity',
        'domain.legalSide'
      ],
      when: allOf(
        predicate('stroke.position', 'in', ['inside', 'outside']),
        predicate('dash.present', 'equals', false),
        predicate('join.requiresSourceVertexProduct', 'equals', true),
        not(predicate('source.tangentContinuity', 'equals', true)),
        predicate('domain.legalSide', 'provided', true)
      ),
      condition:
        'stroke.position is inside or outside, dash is absent, and the doubled authored center stroke reaches an authored source vertex before legal clipping.',
      output:
        'doubled-stroke source segment body products plus canonical source-vertex join footprint products; inside/outside masks may clip this product but may not invent or replace the join shape.',
      ownerStage: 'Stroke Geometry source-vertex join assembly',
      failureReopensStep: 'build-source-vertex-join-products',
      inputs: [
        'authored source vertex',
        'previous and next authored center-path or contour-visit tangents',
        'doubled constrained stroke width and legal side',
        'authored join, miterAngle, cap policy, and owner id'
      ],
      limitations: [
        'Legal masks may clip only; they may not define vertexAngle, rebuild the join from clipped legal-side angles, or promote helper cover polygons into visible product.',
        'Face strips, render-cover polygons, miter tip covers, bevel covers, corner disks, terminal overhangs, construction/helper products, and diagnostic/helper geometry must remain non-visible.'
      ],
      allowedContributors: [
        'doubled source segment body product',
        'canonical source-vertex join footprint',
        'inside/outside legal mask'
      ],
      visibleContributor: 'source-vertex-join',
      geometryBasis: 'canonical-join-footprint',
      forbiddenContributors: [
        'render-cover polygon',
        'miter tip cover polygon',
        'bevel cover polygon',
        'corner disk as join product',
        'endpoint cap at authored source vertex',
        'terminal body overhang',
        'construction/helper product as authored vertex completion'
      ],
      evidenceRequired: [
        'authoredJoin',
        'resolvedJoin',
        'vertexAngle',
        'miterAngle',
        'angleSource',
        'angle comparison evidence',
        'visibleContributor:source-vertex-join',
        'geometryBasis:canonical-join-footprint',
        'legal domain id'
      ],
      produces: [
        routeArtifact('apply-legality'),
        'artifact:preLegalityProductUnits'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#asyra-join-resolution-baseline',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#source-domain-angle-evidence',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#product-legality-and-descriptor-encoding'
      ]
    }),
    route({
      id: 'constrained-solid-same-owner-smooth-span-descriptor',
      from: 'build-smooth-continuity-products',
      to: 'build-final-faces',
      routeType: 'bypass',
      exclusiveGroup: 'smooth-continuity-product-output',
      decisionGroup: 'decision:build-smooth-continuity-products',
      routePriority: 50,
      conditionKind: 'when',
      conditionId: 'constrained-solid:same-owner-smooth-span-descriptor',
      predicateInputs: [
        'stroke.position',
        'dash.present',
        'source.tangentContinuity',
        'descriptor.mode',
        'descriptor.ownerBoundarySplit'
      ],
      when: allOf(
        predicate('stroke.position', 'in', ['inside', 'outside']),
        predicate('dash.present', 'equals', false),
        predicate('source.tangentContinuity', 'equals', true),
        predicate('descriptor.mode', 'in', ['strokePathGroups', 'strokePaths']),
        predicate('descriptor.ownerBoundarySplit', 'equals', true)
      ),
      condition:
        'stroke.position is inside or outside, dash is absent, and the descriptor covers only a declared same-owner smooth span that does not cross an authored sharp source vertex.',
      output:
        'renderer-ready constrained solid strokePaths or strokePathGroups for same-owner smooth-span projection; authored sharp source-vertex join completion remains canonical packet output.',
      ownerStage: 'Stroke Geometry product descriptor assembly',
      failureReopensStep: 'build-smooth-continuity-products',
      inputs: [
        'normalized constrained solid stroke spec',
        'declared same-owner smooth continuity span',
        'inside or outside legal mask descriptor'
      ],
      bypassConditions: [
        'May bypass visible polygon projection only for the smooth span covered by the descriptor.'
      ],
      skipSteps: [
        'apply-legality',
        'build-resolved-stroke-regions',
        'attach-paint-payload'
      ],
      consumes: [routeArtifact('build-smooth-continuity-products')],
      produces: [routeArtifact('build-final-faces'), 'artifact:finalFaces'],
      dirtyDependencies: [
        'smooth-continuity signature',
        'descriptor-mode signature',
        'legal-side signature'
      ],
      cacheKeyInputs: [
        'smooth-continuity group id',
        'descriptor mode',
        'legal side'
      ],
      limitations: [
        'The descriptor must split or exclude authored sharp source-vertex ownership boundaries.',
        'The descriptor must not make strokePathStyle.join the visible owner of a constrained solid authored sharp vertex.',
        'Sharp source-vertex coverage must be emitted as canonical source-vertex join product geometry before render.'
      ],
      allowedContributors: [
        'declared same-owner smooth span stroke path descriptor',
        'inside/outside legal mask as non-visible clipping constraint',
        'canonical source-vertex join footprint for any adjacent sharp vertex'
      ],
      forbiddenContributors: [
        'masked-source-stroke replay across authored sharp source vertices',
        'renderer strokePathStyle.join as sharp source-vertex owner',
        'source path replay at authored sharp vertices',
        'endpoint cap at authored source vertex',
        'render cover polygon',
        'diagnostic/helper polygon as visible product'
      ],
      evidenceRequired: [
        'descriptor route kind',
        'same-owner smooth continuity proof',
        'sharp source-vertex boundary split or exclusion evidence',
        'strokePathStyle closed, cap, join, and rendererMiterLimit values',
        'visible output owner'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#smooth-curvature-non-join-contract',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#product-legality-and-descriptor-encoding'
      ]
    }),
    route({
      id: 'smooth-continuity-products-canonical-output-else',
      from: 'build-smooth-continuity-products',
      to: 'apply-legality',
      routeType: 'normal',
      exclusiveGroup: 'smooth-continuity-product-output',
      decisionGroup: 'decision:build-smooth-continuity-products',
      routePriority: 900,
      conditionKind: 'else',
      condition:
        'Else route: for constrained solid only, use canonical smooth-continuity product packets when exact smooth-span descriptor predicates do not apply.',
      output:
        'Constrained solid smooth-continuity product packets proceed to legality clipping; constrained dashed uses its non-visible overlay route instead.',
      ownerStage: 'Stroke Geometry smooth-continuity product assembly',
      failureReopensStep: 'build-smooth-continuity-products',
      inputs: ['constrained solid smooth-continuity product packets'],
      consumes: [routeArtifact('build-smooth-continuity-products')],
      produces: [
        routeArtifact('apply-legality'),
        'artifact:preLegalityProductUnits'
      ],
      dirtyDependencies: [
        'smooth-continuity signature',
        'legal-side signature'
      ],
      cacheKeyInputs: ['smooth-continuity group id', 'legal side'],
      limitations: [
        'Else output must not accept constrained dashed ownership overlays, split one smooth product into helper strips, or route high curvature into join ownership.'
      ],
      allowedContributors: ['canonical smooth-continuity product packets'],
      forbiddenContributors: [
        'source-vertex join ownership',
        'visible construction/helper product'
      ],
      evidenceRequired: [
        'smooth-continuity product ids',
        'descriptor non-match reason'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#smooth-curvature-non-join-contract'
      ]
    }),
    route({
      id: 'constrained-dashed-interval-body-product',
      from: 'build-dash-interval-body-products',
      to: 'apply-legality',
      routeType: 'parallel',
      exclusiveGroup: 'constrained-dashed-product-output',
      decisionGroup: 'decision:build-dash-interval-body-products',
      parallelGroup: 'parallel:constrained-dashed-product-units',
      coExecutionGroup: 'coexec:constrained-dashed-product-units',
      routePriority: 55,
      condition:
        'A constrained dashed DashProductInterval owns visible body coverage for its split range after dash allocation.',
      output:
        'constrained dashed interval body product encoded as canonical polygons or an exact body geometry program, with interval id, split range, legal side, terminal role, endpoint cap policy, smooth-continuity group, and output-channel metadata.',
      ownerStage: 'Stroke Geometry dashed interval body assembly',
      failureReopensStep: 'build-dash-interval-body-products',
      inputs: [
        'DashProductInterval record',
        'StrokeDomainPlan split range and legal side',
        'endpoint cap policy',
        'smooth-continuity group metadata'
      ],
      consumes: [
        routeArtifact('build-dash-interval-body-products'),
        'artifact:dash-product-interval'
      ],
      produces: [
        routeArtifact('apply-legality'),
        'artifact:constrained-dashed-interval-body-product',
        'artifact:constrained-dashed-product-units',
        'artifact:preLegalityProductUnits'
      ],
      dirtyDependencies: [
        'source path revision',
        'domain signature',
        'dash interval allocation signature',
        'terminal cap signature',
        'legal-side signature'
      ],
      cacheKeyInputs: [
        'dash interval id',
        'split range id',
        'domain id',
        'legal side',
        'terminal role',
        'endpoint cap policy',
        'stroke width',
        'cap style',
        'dash length and gap length',
        'source-distance allocation origin'
      ],
      computationContract: {
        computedAt: 'build-dash-interval-body-products',
        consumesArtifacts: ['artifact:dash-product-interval'],
        producesArtifacts: [
          'artifact:constrained-dashed-interval-body-product'
        ],
        consumedBy: [
          'derive-dash-body-seam-boundaries',
          'build-source-vertex-join-products',
          'build-terminal-body-products',
          'apply-legality'
        ],
        mustNotRecomputeAfter: 'derive-dash-body-seam-boundaries',
        forbiddenLateComputation: [
          'dash interval endpoint relocation',
          'endpoint cap suppression reinterpretation',
          'bevel endpoint substitution'
        ]
      },
      limitations: [
        'Interval body output owns all terminal and smooth body pixels, must stop at declared terminal seam boundaries, and must not complete authored source-vertex joins.',
        'Downstream terminal and smooth routes may attach non-visible overlays only; they may not emit duplicate body geometry.'
      ],
      allowedContributors: [
        'complete DashProductInterval body including terminal and smooth portions',
        'allowed body-side endpoint cap when endpoint policy allows'
      ],
      visibleContributor: 'dash-interval-body',
      geometryBasis: 'dash-product-interval-body',
      forbiddenContributors: [
        'source-vertex join completion',
        'endpoint-side cap at join-owned terminal',
        'duplicate interval paint',
        'aggregate source-path replay'
      ],
      evidenceRequired: [
        'dash interval id',
        'split range id',
        'terminal role',
        'endpoint cap policy',
        'legal side',
        'smooth-continuity group',
        'effective visible source-distance range or physical span ranges for the emitted dash body product',
        'body geometry encoding mode',
        'emitted dash body product boundary id',
        'candidate outer body boundary endpoint on emitted dash body product boundary',
        'candidate body-side outline segment on emitted dash body product boundary'
      ],
      metricAssertions: [
        {
          id: 'dash-body-stops-at-declared-seam-endpoint',
          tolerance:
            'dash body endpoint identity must be preserved for seam-boundary derivation; coordinate epsilon only serializes an owned endpoint id',
          evidence:
            'dash body boundary evidence id plus endpoint-on-product-boundary proof'
        }
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#dash-body-and-join-seam-contract',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#computation-ownership-and-timing-contract'
      ]
    }),
    route({
      id: 'constrained-dashed-source-vertex-join-product',
      from: 'build-source-vertex-join-products',
      to: 'apply-legality',
      routeType: 'parallel',
      exclusiveGroup: 'source-vertex-join-product-output',
      decisionGroup: 'decision:build-source-vertex-join-products',
      parallelGroup: 'parallel:source-vertex-join-product-units',
      coExecutionGroup: 'coexec:source-vertex-join-product-units',
      routePriority: 60,
      condition:
        'A dashed split range reaches an authored sharp contour vertex or self-intersection split terminal that owns join completion and fails tangent-continuity.',
      output:
        'seam-free source-vertex join product using resolvedJoin and preserving authoredJoin, vertexAngle, miterAngle, angleSource, angle comparison evidence, verified incident dash body seam boundaries, incident outer body boundary endpoint identities, and local dash/join shared-endpoint evidence.',
      ownerStage: 'Stroke Geometry source-vertex join assembly',
      failureReopensStep: 'build-source-vertex-join-products',
      inputs: [
        'DashProductInterval incident coverage',
        'verified incident dash body seam boundary from each dash side that reaches the source vertex',
        'incident outer body boundary endpoints and outline segments from each dash side',
        'contour visit previous and next tangents',
        'source-domain miter-angle resolution'
      ],
      consumes: [
        routeArtifact('build-source-vertex-join-products'),
        'artifact:dash-product-interval',
        'artifact:dash-body-seam-boundary'
      ],
      produces: [
        routeArtifact('apply-legality'),
        'artifact:constrained-dashed-source-vertex-join-product',
        'artifact:constrained-dashed-product-units',
        'artifact:preLegalityProductUnits'
      ],
      dirtyDependencies: [
        'source path revision',
        'domain signature',
        'dash interval allocation signature',
        'join/miter signature',
        'legal-side signature'
      ],
      cacheKeyInputs: [
        'source vertex id',
        'incident dash interval ids',
        'contour visit id',
        'legal side',
        'stroke width',
        'authored join',
        'miterAngle',
        'dash body seam boundary signature'
      ],
      computationContract: {
        computedAt: 'build-source-vertex-join-products',
        consumesArtifacts: [
          'artifact:dash-product-interval',
          'artifact:dash-body-seam-boundary'
        ],
        producesArtifacts: [
          'artifact:constrained-dashed-source-vertex-join-product'
        ],
        consumedBy: ['apply-legality', 'build-final-faces', 'render-entries'],
        mustNotRecomputeAfter: 'apply-legality',
        forbiddenLateComputation: [
          'vertexAngle from visible product footprint',
          'bevel cut-off endpoint relocation',
          'incident dash seam boundary reinterpretation',
          'renderer join ownership'
        ]
      },
      limitations: [
        'No endpoint cap, terminal overhang, construction/helper product, duplicate interval paint, aggregate descriptor stroke path, or visible dash/join seam gap may complete this authored sharp vertex.',
        'Tangent-continuous smooth or high-curvature spans must bypass this route and remain smooth-continuity dash products.'
      ],
      allowedContributors: [
        'source-vertex join product',
        'non-emitted incident dash body seam evidence'
      ],
      visibleContributor: 'source-vertex-join',
      geometryBasis: 'canonical-join-footprint',
      forbiddenContributors: [
        'endpoint cap at authored vertex',
        'terminal body overhang',
        'visible construction/helper product',
        'aggregate source-path replay',
        'visible dash/join seam gap',
        'source-vertex join ownership on tangent-continuous high-curvature span'
      ],
      evidenceRequired: [
        'authoredJoin',
        'resolvedJoin',
        'vertexAngle',
        'miterAngle',
        'angleSource',
        'angle comparison evidence',
        'incident dash body seam boundary ids',
        'incident outer body boundary endpoint ids',
        'bevel and bevel-by-miter-angle cut-off edge endpoint ids from incident dash body outer boundaries',
        'proof that every consumed seam boundary endpoint id is emitted by the owning dash body product boundary identity',
        'proof that dash and join visible triangles share the same seam endpoint identities',
        'dash/join zero-gap adjacency proof',
        'tangent-continuity rejection proof for smooth/high-curvature spans'
      ],
      metricAssertions: [
        {
          id: 'dash-join-shared-seam-endpoint-identity',
          tolerance:
            'same seam endpoint identity; coordinate epsilon only serializes the same endpoint id',
          evidence:
            'dash body terminal polygon and source-vertex join polygon reference the same incident seam boundary endpoint ids'
        }
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#asyra-join-resolution-baseline',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#source-domain-angle-evidence',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#dash-body-and-join-seam-contract',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#computation-ownership-and-timing-contract'
      ]
    }),
    route({
      id: 'constrained-dashed-smooth-continuity-product',
      from: 'build-smooth-continuity-products',
      to: 'apply-legality',
      routeType: 'parallel',
      exclusiveGroup: 'smooth-continuity-product-output',
      decisionGroup: 'decision:build-smooth-continuity-products',
      parallelGroup: 'parallel:smooth-continuity-product-units',
      coExecutionGroup: 'coexec:smooth-continuity-product-units',
      routePriority: 70,
      condition:
        'A dashed interval follows a tangent-continuous curve, smooth anchor, or high-curvature span that does not own authored sharp source-vertex join completion.',
      output:
        'non-visible smooth-continuity ownership overlay referencing one or more dash body products and preserving tangent, curve-offset, and continuity provenance.',
      ownerStage: 'Stroke Geometry smooth-continuity ownership binding',
      failureReopensStep: 'build-smooth-continuity-products',
      inputs: [
        'referenced dash interval body product ids',
        'tangent-continuity evidence',
        'curve-offset outer boundary proof'
      ],
      consumes: [
        routeArtifact('build-smooth-continuity-products'),
        'artifact:constrained-dashed-interval-body-product'
      ],
      produces: [
        routeArtifact('apply-legality'),
        'artifact:constrained-dashed-smooth-continuity-product'
      ],
      dirtyDependencies: [
        'dash body product identities',
        'smooth-continuity signature'
      ],
      cacheKeyInputs: [
        'dash body product ids',
        'smooth-continuity group id',
        'tangent-continuity proof id',
        'curve-offset proof id'
      ],
      limitations: [
        'High curvature alone must not create source-vertex join ownership.',
        'The output must not emit polygons, stroke paths, paint, descriptors, disconnected strip products, radial slices, visible seam-repair products, or helper products.'
      ],
      allowedContributors: [
        'dash body product identities',
        'tangent-continuity proof',
        'curve-offset outer boundary proof'
      ],
      visibleContributor: 'none-non-visible-ownership-overlay',
      geometryBasis: 'smooth-continuity-ownership-overlay',
      forbiddenContributors: [
        'source-vertex join product',
        'visible body polygons',
        'visible stroke paths',
        'paint payload',
        'visible seam-repair product',
        'visible construction/helper product',
        'disconnected strip product',
        'radial slice product',
        'diagnostic/helper polygon as visible product'
      ],
      evidenceRequired: [
        'referenced dash body product ids',
        'smooth-continuity group id',
        'tangent-continuity proof',
        'single continuous footprint proof',
        'no source-vertex join ownership proof',
        'zero visible contribution proof'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#smooth-curvature-non-join-contract',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#dash-body-and-join-seam-contract'
      ]
    }),
    route({
      id: 'constrained-dashed-join-owned-terminal-body-product',
      from: 'build-terminal-body-products',
      to: 'apply-legality',
      routeType: 'parallel',
      exclusiveGroup: 'terminal-body-product-output',
      decisionGroup: 'decision:build-terminal-body-products',
      parallelGroup: 'parallel:terminal-body-product-units',
      coExecutionGroup: 'coexec:terminal-body-product-units',
      routePriority: 80,
      condition:
        'A dash interval body product has a terminal portion incident to source-vertex or split-terminal join ownership and requires terminal identity preservation.',
      output:
        'non-visible terminal body ownership overlay referencing the dash body product id and preserving seam, endpoint cap policy, terminal role, legal side, and join ownership metadata.',
      ownerStage: 'Stroke Geometry terminal body ownership binding',
      failureReopensStep: 'build-terminal-body-products',
      inputs: [
        'terminal dash interval body product id',
        'verified dash body seam boundary artifact',
        'endpoint cap policy',
        'terminal role',
        'join ownership signature'
      ],
      consumes: [
        routeArtifact('build-terminal-body-products'),
        'artifact:constrained-dashed-interval-body-product',
        'artifact:dash-body-seam-boundary'
      ],
      produces: [
        routeArtifact('apply-legality'),
        'artifact:constrained-dashed-join-owned-terminal-body-product'
      ],
      dirtyDependencies: [
        'dash body product identity',
        'terminal cap signature',
        'seam boundary signature',
        'join ownership signature'
      ],
      cacheKeyInputs: [
        'dash body product id',
        'terminal role',
        'endpoint cap policy',
        'join ownership signature',
        'dash body seam boundary signature'
      ],
      computationContract: {
        computedAt: 'build-terminal-body-products',
        consumesArtifacts: [
          'artifact:constrained-dashed-interval-body-product',
          'artifact:dash-body-seam-boundary'
        ],
        producesArtifacts: [
          'artifact:constrained-dashed-join-owned-terminal-body-product'
        ],
        consumedBy: ['apply-legality', 'build-final-faces', 'render-entries'],
        mustNotRecomputeAfter: 'apply-legality',
        forbiddenLateComputation: [
          'body geometry materialization',
          'source-vertex corner coverage',
          'dash/join seam closure',
          'endpoint-side cap restoration',
          'terminal seam boundary relocation'
        ]
      },
      limitations: [
        'Terminal ownership output may not contain polygons, stroke paths, paint, apex coverage, endpoint-side overhang, source-vertex repair, or dash/join seam repair.'
      ],
      allowedContributors: [
        'dash body product identity',
        'terminal role and cap-policy metadata',
        'verified seam identity',
        'join ownership signature'
      ],
      visibleContributor: 'none-non-visible-ownership-overlay',
      geometryBasis: 'terminal-body-ownership-overlay',
      forbiddenContributors: [
        'visible body polygons',
        'visible stroke paths',
        'paint payload',
        'endpoint-side cap at join-owned terminal',
        'terminal overhang',
        'source-vertex apex coverage'
      ],
      evidenceRequired: [
        'dash body product id',
        'terminal role',
        'endpoint cap policy',
        'join ownership signature',
        'zero visible contribution proof'
      ],
      metricAssertions: [
        {
          id: 'terminal-body-stops-at-seam',
          tolerance:
            'zero visible seam gap; coordinate epsilon only proves the same seam-boundary artifact endpoint id',
          evidence:
            'terminal seam boundary id plus shared seam-boundary artifact endpoint identity'
        }
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#dash-body-and-join-seam-contract',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#computation-ownership-and-timing-contract'
      ]
    }),
    route({
      id: 'constrained-dashed-descriptor-materialization',
      from: 'build-final-faces',
      to: 'materialize-stroke-product-descriptors',
      routeType: 'normal',
      exclusiveGroup: 'final-face-descriptor-materialization',
      decisionGroup: 'decision:materialize-stroke-product-descriptors',
      routePriority: 30,
      conditionKind: 'when',
      conditionId: 'descriptor-materialization:constrained-dashed',
      predicateInputs: [
        'channel.finalFaces',
        'descriptor.strategyRecord',
        'descriptor.requiredLegalityBasis',
        'descriptor.ownerBoundarySplit'
      ],
      when: allOf(
        predicate('channel.finalFaces', 'provided', true),
        predicate('descriptor.strategyRecord', 'provided', true),
        predicate('descriptor.requiredLegalityBasis', 'in', [
          'post-legality',
          'legality-equivalent'
        ]),
        predicate('descriptor.ownerBoundarySplit', 'equals', true)
      ),
      condition:
        'Final-face records can be encoded as a constrained dashed renderer descriptor only after the required post-legality or legality-equivalent basis and owner-boundary split are present.',
      output:
        'Batched renderer descriptor carrying body product ids, terminal/smooth overlay ids, product-builder, source revision, domain, interval, cap policy, join ownership, legal side, output-channel, and evidence-only polygon metadata.',
      ownerStage: 'Product Output descriptor materialization',
      failureReopensStep: 'materialize-stroke-product-descriptors',
      inputs: [
        'finalFaces',
        'post-legality or legality-equivalent constrained dashed product units',
        'terminal and smooth ownership overlays',
        'descriptor strategy record',
        'visible/evidence output-channel separation'
      ],
      consumes: [
        routeArtifact('build-final-faces'),
        'artifact:finalFaces',
        'artifact:descriptorStrategyRecords',
        'artifact:postLegalityProductUnits',
        'artifact:legalityEquivalentProductUnits'
      ],
      produces: [
        routeArtifact('materialize-stroke-product-descriptors'),
        'artifact:constrained-dashed-render-descriptor'
      ],
      dirtyDependencies: [
        'source revision',
        'domain signature',
        'dash interval identity',
        'terminal cap signature',
        'join/miter signature',
        'legal-side signature',
        'descriptor-mode signature'
      ],
      cacheKeyInputs: [
        'source revision',
        'domain id',
        'dash interval ids',
        'body product ids',
        'terminal and smooth overlay ids',
        'terminal roles',
        'endpoint cap policy',
        'join ownership signatures',
        'legal side',
        'descriptor mode'
      ],
      limitations: [
        'Descriptor materialization may encode declared visible products only; evidence polygons and construction evidence must remain non-visible.',
        'Terminal and smooth ownership overlays must remain metadata and must not create additional polygons or stroke paths.',
        'Body paths may be batched only when paint, stroke spec, legal domain, output channel, and sharp owner boundaries are compatible.',
        'Descriptor materialization must not consume preLegalityProductUnits unless the descriptor route also provides legality-equivalence evidence.',
        'Descriptor materialization must not route back into build-final-faces or become the source of hit/export semantics.'
      ],
      allowedContributors: [
        'materialized DashProductInterval products',
        'source-vertex join product metadata',
        'terminal and smooth ownership overlay metadata',
        'evidence-only descriptor polygons'
      ],
      forbiddenContributors: [
        'aggregate source-path replay across source-vertex ownership boundaries',
        'descriptor evidence as visible paint',
        'duplicate interval paint',
        'renderer-local join completion'
      ],
      evidenceRequired: [
        'descriptor route kind',
        'visible/evidence channel split',
        'product-builder id',
        'source revision',
        'interval ids',
        'body product ids',
        'terminal and smooth overlay ids',
        'join ownership signatures',
        'batch compatibility signature'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#product-legality-and-descriptor-encoding',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#output-channel-separation'
      ]
    }),
    route({
      id: 'descriptor-strategy-canonical-output-else',
      from: 'select-stroke-descriptor-strategy',
      to: 'apply-legality',
      routeType: 'normal',
      exclusiveGroup: 'descriptor-strategy-output',
      decisionGroup: 'decision:select-stroke-descriptor-strategy',
      routePriority: 900,
      conditionKind: 'else',
      condition:
        'Else route: continue with canonical product packets when descriptor strategy predicates do not apply or when descriptor materialization must wait for post-legality records.',
      output:
        'Canonical product packets proceed to legality clipping and final face assembly.',
      ownerStage: 'Stroke Geometry descriptor strategy selection',
      failureReopensStep: 'select-stroke-descriptor-strategy',
      inputs: ['canonical product packets', 'descriptor non-match reason'],
      consumes: [routeArtifact('select-stroke-descriptor-strategy')],
      produces: [
        routeArtifact('apply-legality'),
        'artifact:preLegalityProductUnits'
      ],
      dirtyDependencies: ['descriptor-mode signature', 'product unit ids'],
      cacheKeyInputs: ['descriptor mode', 'product unit ids'],
      limitations: [
        'Else output must not promote descriptor evidence polygons to visible output or materialize renderer descriptors before legality.'
      ],
      allowedContributors: ['canonical product packets'],
      forbiddenContributors: [
        'descriptor evidence as visible paint',
        'renderer-local join completion'
      ],
      evidenceRequired: [
        'descriptor non-match reason',
        'canonical product packet ids'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#product-legality-and-descriptor-encoding'
      ]
    }),
    route({
      id: 'constrained-dashed-inside-mask-descriptor',
      from: 'materialize-stroke-product-descriptors',
      to: 'render-entries',
      routeType: 'normal',
      exclusiveGroup: 'descriptor-render-entry-materialization',
      decisionGroup: 'decision:render-entries',
      routePriority: 20,
      conditionKind: 'when',
      conditionId: 'render-entry:inside-mask-descriptor',
      predicateInputs: [
        'stroke.position',
        'dash.present',
        'descriptor.mode',
        'domain.mode'
      ],
      when: allOf(
        predicate('stroke.position', 'equals', 'inside'),
        predicate('dash.present', 'equals', true),
        predicate('descriptor.mode', 'in', ['strokePathGroups', 'strokePaths']),
        predicate('domain.mode', 'in', [
          'closed-constrained-domain',
          'open-contour-constrained-domain'
        ])
      ),
      condition:
        'Constrained inside dashed descriptor carries strokePathGroups or strokePaths plus inside-domain fillClip/fillExclude evidence.',
      output:
        'render entry whose visible output is the declared strokePathGroups or strokePaths clipped by inside masks; descriptorProductPolygons remain evidence only when strokePathGroups exist.',
      ownerStage: 'Product Output render-entry materialization',
      failureReopensStep: 'render-entries',
      inputs: [
        'inside renderDescriptor',
        'strokePathGroups',
        'terminal and smooth ownership overlays',
        'fillClipPolygons',
        'fillExcludePolygons'
      ],
      consumes: [
        routeArtifact('materialize-stroke-product-descriptors'),
        'artifact:constrained-dashed-render-descriptor',
        'artifact:finalFaces'
      ],
      produces: [routeArtifact('render-entries'), 'artifact:renderEntries'],
      limitations: [
        'descriptorProductPolygons may clip or explain but must not be promoted to visible strokeMaskPolygons when strokePathGroups exist.',
        'Terminal and smooth overlays may preserve identity only and must not add another visible body path or mask.'
      ],
      allowedContributors: [
        'visible strokePathGroups',
        'inside fillClip/fillExclude constraints',
        'allowed terminal cap masks'
      ],
      forbiddenContributors: [
        'descriptorProductPolygons as visible fill',
        'inside carrier polygons as visible paint'
      ],
      evidenceRequired: [
        'descriptor visible route',
        'evidence-only polygon list',
        'inside domain id',
        'body product and terminal/smooth overlay identity parity'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#product-legality-and-descriptor-encoding',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#output-channel-separation'
      ]
    }),
    route({
      id: 'constrained-dashed-outside-source-domain-descriptor',
      from: 'materialize-stroke-product-descriptors',
      to: 'render-entries',
      routeType: 'normal',
      exclusiveGroup: 'descriptor-render-entry-materialization',
      decisionGroup: 'decision:render-entries',
      routePriority: 30,
      conditionKind: 'when',
      conditionId: 'render-entry:outside-source-domain-descriptor',
      predicateInputs: [
        'stroke.position',
        'dash.present',
        'descriptor.mode',
        'descriptor.geometryBasis'
      ],
      when: allOf(
        predicate('stroke.position', 'equals', 'outside'),
        predicate('dash.present', 'equals', true),
        predicate('descriptor.mode', 'in', ['strokePathGroups', 'strokePaths']),
        predicate(
          'descriptor.geometryBasis',
          'equals',
          'source-adjacent-outside-band'
        )
      ),
      condition:
        'Constrained outside dashed descriptor represents a source-adjacent outside band, not an outer ribbon-edge replay.',
      output:
        'render entry with visible outside band stroke path and exterior domain clip evidence.',
      ownerStage: 'Product Output render-entry materialization',
      failureReopensStep: 'render-entries',
      inputs: [
        'outside renderDescriptor',
        'source-domain descriptor path',
        'exterior clip'
      ],
      consumes: [
        routeArtifact('materialize-stroke-product-descriptors'),
        'artifact:constrained-dashed-render-descriptor',
        'artifact:finalFaces'
      ],
      produces: [routeArtifact('render-entries'), 'artifact:renderEntries'],
      limitations: [
        'Outer ribbon edges, carrier edges, and boundary-domain edges are evidence only and must not become visible stroke path centerlines.'
      ],
      allowedContributors: [
        'outside band visible stroke path',
        'exterior clip'
      ],
      forbiddenContributors: [
        'outer ribbon edge as centerline',
        'boundary-domain evidence as paint'
      ],
      evidenceRequired: [
        'outside band route id',
        'legal side',
        'source-domain equivalence evidence'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#product-legality-and-descriptor-encoding',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#output-channel-separation'
      ]
    }),
    route({
      id: 'constrained-dashed-outside-aggregate-descriptor',
      from: 'materialize-stroke-product-descriptors',
      to: 'render-entries',
      routeType: 'normal',
      exclusiveGroup: 'descriptor-render-entry-materialization',
      decisionGroup: 'decision:render-entries',
      routePriority: 40,
      conditionKind: 'when',
      conditionId: 'render-entry:outside-aggregate-descriptor',
      predicateInputs: [
        'stroke.position',
        'dash.present',
        'descriptor.mode',
        'descriptor.ownerClass'
      ],
      when: allOf(
        predicate('stroke.position', 'equals', 'outside'),
        predicate('dash.present', 'equals', true),
        predicate('descriptor.mode', 'in', ['strokePathGroups', 'strokePaths']),
        predicate('descriptor.ownerClass', 'equals', 'ordinary-coverage')
      ),
      condition:
        'Outside dashed aggregate descriptor groups ordinary same-owner outside coverage after ownership-preserving canonicalization.',
      output:
        'render entry preserving visible owner, interval, legal side, terminal role, endpoint cap policy, join ownership, smooth-continuity, and output-channel metadata.',
      ownerStage: 'Product Output render-entry materialization',
      failureReopensStep: 'render-entries',
      inputs: [
        'outside aggregate renderDescriptor',
        'ordinary coverage product records'
      ],
      consumes: [
        routeArtifact('materialize-stroke-product-descriptors'),
        'artifact:constrained-dashed-render-descriptor',
        'artifact:finalFaces'
      ],
      produces: [routeArtifact('render-entries'), 'artifact:renderEntries'],
      limitations: [
        'Aggregate descriptors may not own source-vertex join completion, duplicate alias intervals, or merge terminal-owned coverage into generic source-path coverage.'
      ],
      allowedContributors: ['ordinary same-owner outside coverage'],
      forbiddenContributors: [
        'source-vertex join product',
        'join-owned terminal body product',
        'removed split-range alias product'
      ],
      evidenceRequired: [
        'ordinary coverage proof',
        'owner metadata preservation'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#product-legality-and-descriptor-encoding',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#output-channel-separation'
      ]
    }),
    route({
      id: 'open-dangling-outside-both-side-span',
      from: 'resolve-stroke-domains',
      to: 'select-stroke-product-family',
      routeType: 'normal',
      exclusiveGroup: 'domain-mode-routing',
      decisionGroup: 'decision:resolve-stroke-domains',
      routePriority: 35,
      conditionKind: 'when',
      conditionId: 'domain:open-dangling-outside-both-sides',
      predicateInputs: [
        'stroke.position',
        'domain.mode',
        'source.hasDanglingOpenBranch'
      ],
      when: allOf(
        predicate('stroke.position', 'equals', 'outside'),
        predicate('domain.mode', 'equals', 'open-dangling-outside-both-sides'),
        predicate('source.hasDanglingOpenBranch', 'equals', true)
      ),
      condition:
        'Open constrained outside span is a true dangling open branch outside a bounded filled-region contour.',
      output:
        'explicit both-side source-span domain whose visible normal span may equal stroke.width * 2 within tolerance.',
      ownerStage: 'StrokeDomainPlan',
      failureReopensStep: 'resolve-stroke-domains',
      inputs: ['open contour domain plan', 'dangling branch source span'],
      limitations: [
        'No invisible closing edge may create domain, dash, hit/export, or product output.'
      ],
      allowedContributors: ['real authored source segment'],
      forbiddenContributors: [
        'inferred closing edge',
        'preview chord',
        'helper line'
      ],
      evidenceRequired: [
        'domain mode open-dangling-outside-both-sides',
        'source segment id'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#asyra-stroke-construction-baseline'
      ]
    }),
    route({
      id: 'legality-product-unit-clipping',
      from: 'apply-legality',
      to: 'build-resolved-stroke-regions',
      routeType: 'normal',
      exclusiveGroup: 'legality-product-output',
      decisionGroup: 'decision:apply-legality',
      routePriority: 20,
      conditionKind: 'when',
      conditionId: 'legality:declared-product-units',
      predicateInputs: ['channel.productUnits', 'domain.legalSide'],
      when: allOf(
        predicate('channel.productUnits', 'equals', 'preLegalityProductUnits'),
        predicate('domain.legalSide', 'provided', true)
      ),
      condition:
        'Declared pre-legality product units are clipped or excluded by their inside/outside legal domains.',
      output:
        'Post-legality product units and legality evidence for final semantic stroke records.',
      ownerStage: 'Stroke Geometry legality clipping',
      failureReopensStep: 'apply-legality',
      inputs: [
        'preLegalityProductUnits',
        'legal domain ids',
        'clip/exclude channel'
      ],
      consumes: [
        routeArtifact('apply-legality'),
        'artifact:preLegalityProductUnits'
      ],
      produces: [
        routeArtifact('build-resolved-stroke-regions'),
        'artifact:postLegalityProductUnits'
      ],
      dirtyDependencies: ['legal-domain signature', 'product unit ids'],
      cacheKeyInputs: [
        'product unit ids',
        'legal domain ids',
        'clip/exclude route'
      ],
      limitations: [
        'Legality clipping may not create missing joins, caps, terminal bodies, descriptors, or helper-visible geometry.'
      ],
      allowedContributors: [
        'declared product units',
        'legal clip/exclude domains'
      ],
      forbiddenContributors: [
        'new join geometry',
        'new endpoint cap geometry',
        'diagnostic/helper visible geometry'
      ],
      evidenceRequired: [
        'pre-legality product ids',
        'post-legality product ids',
        'legal-domain ids'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#product-legality-and-descriptor-encoding'
      ]
    }),
    route({
      id: 'canonical-final-face-render-entry',
      from: 'build-final-faces',
      to: 'render-entries',
      routeType: 'normal',
      exclusiveGroup: 'final-face-render-entry-materialization',
      decisionGroup: 'decision:build-final-faces-render-output',
      routePriority: 40,
      conditionKind: 'when',
      conditionId: 'render-entry:canonical-final-face',
      predicateInputs: [
        'channel.finalFaces',
        'channel.render',
        'descriptor.materialized'
      ],
      when: allOf(
        predicate('channel.finalFaces', 'provided', true),
        predicate('channel.render', 'equals', true),
        not(predicate('descriptor.materialized', 'equals', true))
      ),
      condition:
        'Canonical final-face packets become render entries when no renderer-ready descriptor has been materialized for that render channel.',
      output:
        'Render entries over declared canonical final-face products without renderer-local join, cap, descriptor, or helper repair.',
      ownerStage: 'Product Output render-entry materialization',
      failureReopensStep: 'render-entries',
      inputs: ['finalFaces', 'render output channel'],
      consumes: [routeArtifact('build-final-faces'), 'artifact:finalFaces'],
      produces: [routeArtifact('render-entries'), 'artifact:renderEntries'],
      dirtyDependencies: ['final-face signature', 'render channel signature'],
      cacheKeyInputs: [
        'final-face id',
        'output channel',
        'paint signature',
        'same-paint overlap signature'
      ],
      computationContract: {
        computedAt: 'render-entries',
        consumesArtifacts: ['artifact:finalFaces'],
        producesArtifacts: ['artifact:renderEntries'],
        consumedBy: ['renderer-projection'],
        mustNotRecomputeAfter: 'renderer-projection',
        forbiddenLateComputation: [
          'join shape decision',
          'cap shape decision',
          'same-paint alpha decision without render-entry evidence',
          'descriptor evidence promotion'
        ]
      },
      limitations: [
        'Canonical render entries must not infer descriptor paths, replay source paths, or repair joins/caps in the renderer.',
        'Same-paint overlap must be resolved as a single-composite render entry or carry equivalent alpha-safe evidence before renderer projection.',
        'Outside legal-domain clipped render-entry polygons must preserve backend legal-region product polygons directly; final-face flattening, polygon cleanup, fallback source polygons, or notch removal must not reinterpret clipped holes, refill excluded fill-domain regions, create wrong-side residue, or reopen dash/join seams.',
        'Inside/outside constrained same-paint arrangements must include resolved legal-domain boundaries as non-visible splitter input; splitter input may cut arrangement cells but must not claim paint, become visible output, synthesize fallback geometry, or erase dash/join/terminal provenance.',
        'Legal-side sample probes must be actual product vertices, product edge midpoints, or points already proven to lie on or inside the candidate visible product; exact backend legal-domain area proof is authoritative when available.',
        'A render entry must not contain same-paint polygons with internal shared-boundary length or positive overlap unless it carries explicit alpha-safe equivalence evidence proving no dark seam, repeated alpha, missing dash/join coverage, wrong-side residue, or protrusion.'
      ],
      allowedContributors: ['canonical final-face product records'],
      forbiddenContributors: [
        'renderer-local join repair',
        'renderer-local cap repair',
        'diagnostic/helper visible geometry'
      ],
      evidenceRequired: [
        'final-face id',
        'render channel id',
        'descriptor non-materialization reason',
        'same-paint single-composite or alpha-safe equivalence evidence when visible entries overlap',
        'internal same-paint polygon shared-boundary/overlap absence or alpha-safe equivalence evidence',
        'preserved dash product effective visible source-distance range or physical span ranges',
        'legal-domain splitter participation evidence for inside/outside constrained same-paint arrangements',
        'outside legal-domain residue before and after same-paint merge/collapse is zero except coordinate epsilon',
        'legal-side probe source evidence showing samples are on/in product geometry or that exact backend area proof was used'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#output-channel-separation',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#product-legality-and-descriptor-encoding',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#computation-ownership-and-timing-contract'
      ]
    }),
    route({
      id: 'descriptor-output-versus-canonical-packet-output',
      from: 'build-final-faces',
      to: 'emit-render-hit-export-packets',
      routeType: 'normal',
      exclusiveGroup: 'final-face-channel-projection',
      routePriority: 20,
      conditionKind: 'when',
      conditionId: 'channel:final-face-output-packets',
      predicateInputs: [
        'channel.finalFaces',
        'channel.output',
        'descriptor.materialized'
      ],
      when: allOf(
        predicate('channel.finalFaces', 'provided', true),
        predicate('channel.output', 'in', [
          'render',
          'hit',
          'export'
        ]),
        predicate('descriptor.materialized', 'provided', true)
      ),
      condition:
        'Final face chooses descriptor output or canonical packet output for each output channel.',
      output:
        'channel-separated render, hit, and export packets without changing product semantics; optional diagnostics consume terminal evidence outside this route when enabled.',
      ownerStage: 'Product Output channel projection',
      failureReopensStep: 'emit-render-hit-export-packets',
      inputs: ['final face visible product owner', 'descriptor route kind'],
      consumes: [routeArtifact('build-final-faces'), 'artifact:finalFaces'],
      produces: [routeArtifact('emit-render-hit-export-packets')],
      limitations: [
        'Hit/export materialization may differ from render only with explicit equivalence evidence and channel separation.'
      ],
      allowedContributors: [
        'declared visible product owner',
        'channel-tagged hit/export evidence'
      ],
      forbiddenContributors: [
        'diagnostic/helper visible product',
        'untagged mixed channel packet'
      ],
      evidenceRequired: [
        'output channel',
        'route kind',
        'projection equivalence reason'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#output-channel-separation',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#product-legality-and-descriptor-encoding'
      ]
    }),
    route({
      id: 'hit-export-channel-packet-projection',
      from: 'emit-render-hit-export-packets',
      to: 'hit-export',
      routeType: 'parallel',
      exclusiveGroup: 'product-output-channel-consumer',
      routePriority: 20,
      condition:
        'Final faces emitted hit/export packets or descriptor evidence for hit/export channel projection.',
      output:
        'hit/export channel consumes final-face packets and descriptor evidence without depending on renderer projection.',
      ownerStage: 'Product Output hit/export projection',
      failureReopensStep: 'hit-export',
      inputs: [
        'final-face hit/export packets',
        'descriptor evidence tagged for hit/export',
        'source owner and product channel metadata'
      ],
      consumes: [
        routeArtifact('emit-render-hit-export-packets'),
        'channel:hit-export'
      ],
      produces: [
        routeArtifact('hit-export'),
        'artifact:hitExportPackets',
        'artifact:hit-export-packets'
      ],
      dirtyDependencies: [
        'final-face signature',
        'hit/export channel signature',
        'source owner metadata'
      ],
      cacheKeyInputs: [
        'final-face id',
        'output channel',
        'source owner id',
        'geometry id'
      ],
      limitations: [
        'Hit/export projection must not consume renderer-projection pixels, draw calls, or renderer-local repaired geometry.'
      ],
      allowedContributors: [
        'final-face hit/export packets',
        'descriptor evidence tagged for hit/export'
      ],
      forbiddenContributors: [
        'renderer-projection output',
        'visible pixel readback',
        'renderer-local join or cap repair'
      ],
      evidenceRequired: [
        'hit/export packet id',
        'final-face id',
        'output channel',
        'source owner metadata'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#output-channel-separation'
      ]
    }),
    route({
      id: 'render-projection-merge',
      from: 'render-entries',
      to: 'renderer-projection',
      routeType: 'normal',
      exclusiveGroup: 'renderer-projection-dispatch',
      routePriority: 20,
      conditionKind: 'when',
      conditionId: 'renderer:merge-equivalent-render-entries',
      predicateInputs: [
        'channel.renderEntries',
        'render.ownerEquivalent',
        'render.clipEquivalent',
        'render.paintEquivalent'
      ],
      when: allOf(
        predicate('channel.renderEntries', 'provided', true),
        predicate('render.ownerEquivalent', 'equals', true),
        predicate('render.clipEquivalent', 'equals', true),
        predicate('render.paintEquivalent', 'equals', true)
      ),
      condition:
        'Multiple render entries can be projected together only when owner, output channel, paint, clip, exclude, and descriptor route remain equivalent.',
      output:
        'visible draw calls that match the render-entry product without repairing or substituting geometry.',
      ownerStage: 'Product Output renderer projection',
      failureReopensStep: 'renderer-projection',
      inputs: ['renderer-ready render entries'],
      consumes: [routeArtifact('render-entries'), 'artifact:renderEntries'],
      produces: [routeArtifact('renderer-projection')],
      dirtyDependencies: [
        'render-entry signature',
        'projection backend signature'
      ],
      cacheKeyInputs: [
        'render-entry ids',
        'projection backend id',
        'single-composite evidence id'
      ],
      computationContract: {
        computedAt: 'renderer-projection',
        consumesArtifacts: ['artifact:renderEntries'],
        producesArtifacts: ['stage:renderer-projection'],
        consumedBy: ['finalValidationMethods', 'optionalDiagnosticChannels'],
        mustNotRecomputeAfter: 'renderer-projection',
        forbiddenLateComputation: [
          'join shape decision',
          'cap shape decision',
          'same-paint alpha decision',
          'descriptor evidence promotion'
        ]
      },
      limitations: [
        'Projection merge may not stitch paths across source-vertex ownership boundaries or promote evidence polygons to masks.',
        'Renderer projection may only consume same-paint alpha decisions already carried by render entries.'
      ],
      allowedContributors: [
        'same-owner render entries with equivalent output channel and paint'
      ],
      forbiddenContributors: [
        'different owner merge',
        'descriptor evidence as visible mask',
        'renderer-side join repair'
      ],
      evidenceRequired: [
        'merge equivalence proof',
        'owner and output channel preservation'
      ],
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#output-channel-separation',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#computation-ownership-and-timing-contract'
      ]
    })
  ]
  const conditionalRoutes = [...linearRoutes, ...strokeProductRoutes]
  const artifact = ({
    id,
    kind,
    channel = 'internal',
    ownerStage = 'Inspector flow',
    terminal = false
  }) => ({
    id,
    kind,
    channel,
    ownerStage,
    terminal
  })
  const artifactRegistry = [
    ...steps.map((step) =>
      artifact({
        id: routeArtifact(step.id),
        kind: 'stage-output',
        channel: 'stage',
        ownerStage: step.ownerStage,
        terminal: ['renderer-projection', 'hit-export'].includes(step.id)
      })
    ),
    artifact({
      id: 'dirty:source-drag',
      kind: 'dirty-input',
      ownerStage: 'Render Mirror dirty revision graph'
    }),
    artifact({
      id: 'dirty:source-topology',
      kind: 'dirty-output',
      ownerStage: 'Render Mirror dirty revision graph',
      terminal: true
    }),
    artifact({
      id: 'dirty:paint-only',
      kind: 'dirty-input',
      ownerStage: 'Render Mirror stage product cache'
    }),
    artifact({
      id: 'dirty:visibility-hidden',
      kind: 'dirty-input',
      ownerStage: 'Render Mirror stage product cache'
    }),
    artifact({
      id: 'cache:paint-retint',
      kind: 'cache-output',
      ownerStage: 'Render Mirror stage product cache',
      terminal: true
    }),
    artifact({
      id: 'cache:verified-product-descriptor',
      kind: 'cache-input',
      ownerStage: 'Render Mirror stage product cache'
    }),
    artifact({
      id: 'cache:final-face-input',
      kind: 'cache-output',
      ownerStage: 'Render Mirror stage product cache',
      terminal: true
    }),
    artifact({
      id: 'output:hidden-render-packets',
      kind: 'output-packet',
      channel: 'render-hit-export',
      ownerStage: 'Product Output channel projection',
      terminal: true
    }),
    artifact({
      id: 'output:unsupported-product-family-packets',
      kind: 'output-packet',
      channel: 'render-hit-export',
      ownerStage: 'Stroke Geometry product family selection',
      terminal: true
    }),
    artifact({
      id: 'artifact:user-intent',
      kind: 'source-intent',
      ownerStage: 'Feature session intent'
    }),
    artifact({
      id: 'artifact:canonical-workspace-data',
      kind: 'canonical-state',
      ownerStage: 'Common API canonical workspace data'
    }),
    artifact({
      id: 'artifact:topology-validation-evidence',
      kind: 'validation-evidence',
      ownerStage: 'Stroke Geometry topology validation'
    }),
    artifact({
      id: 'artifact:computed-patch',
      kind: 'computed-patch',
      ownerStage: 'Computed patch builder'
    }),
    artifact({
      id: 'artifact:current-render-data',
      kind: 'current-render-data',
      ownerStage: 'Render Mirror render data derivation'
    }),
    artifact({
      id: 'artifact:dirty-revision-graph',
      kind: 'dirty-revision-graph',
      ownerStage: 'Render Mirror dirty revision graph'
    }),
    artifact({
      id: 'artifact:stage-cache-reuse-evidence',
      kind: 'cache-evidence',
      ownerStage: 'Render Mirror stage product cache'
    }),
    artifact({
      id: 'artifact:product-family-selection-evidence',
      kind: 'route-selection-evidence',
      ownerStage: 'Stroke Geometry product family selection'
    }),
    artifact({
      id: 'artifact:normalized-stroke-spec',
      kind: 'normalized-spec',
      ownerStage: 'Stroke Geometry stroke spec normalization'
    }),
    artifact({
      id: 'artifact:stroke-domain-plan',
      kind: 'domain-plan',
      ownerStage: 'Stroke Geometry stroke domain resolution'
    }),
    artifact({
      id: 'artifact:dash-product-interval',
      kind: 'product-input',
      ownerStage: 'Stroke Geometry dash interval allocation'
    }),
    artifact({
      id: 'artifact:dash-body-seam-boundary',
      kind: 'product-boundary-artifact',
      ownerStage: 'Stroke Geometry dash seam boundary derivation'
    }),
    artifact({
      id: 'artifact:preLegalityProductUnits',
      kind: 'product-unit-set',
      ownerStage: 'Stroke Geometry legality-input union assembly'
    }),
    artifact({
      id: 'artifact:postLegalityProductUnits',
      kind: 'product-unit-set',
      ownerStage: 'Stroke Geometry legality clipping'
    }),
    artifact({
      id: 'artifact:legalityEquivalentProductUnits',
      kind: 'product-unit-set',
      ownerStage: 'Stroke Geometry product descriptor assembly'
    }),
    artifact({
      id: 'artifact:descriptorStrategyRecords',
      kind: 'descriptor-strategy-record-set',
      channel: 'render-hit-export',
      ownerStage: 'Stroke Geometry descriptor strategy selection'
    }),
    artifact({
      id: 'artifact:finalFaces',
      kind: 'final-face-set',
      channel: 'render-hit-export',
      ownerStage: 'Stroke Geometry final face assembly'
    }),
    artifact({
      id: 'artifact:renderEntries',
      kind: 'render-entry-set',
      channel: 'render',
      ownerStage: 'Product Output render-entry materialization'
    }),
    artifact({
      id: 'artifact:same-paint-composite-state',
      kind: 'render-entry-evidence',
      channel: 'render',
      ownerStage: 'Product Output render-entry materialization'
    }),
    artifact({
      id: 'artifact:constrained-dashed-interval-body-product',
      kind: 'product-unit',
      ownerStage: 'Stroke Geometry dashed interval body assembly',
      terminal: true
    }),
    artifact({
      id: 'artifact:constrained-dashed-source-vertex-join-product',
      kind: 'product-unit',
      ownerStage: 'Stroke Geometry source-vertex join assembly',
      terminal: true
    }),
    artifact({
      id: 'artifact:source-vertex-join-miter-evidence',
      kind: 'product-evidence',
      ownerStage: 'Stroke Geometry source-vertex join assembly'
    }),
    artifact({
      id: 'artifact:constrained-dashed-smooth-continuity-product',
      kind: 'ownership-overlay-record-set',
      channel: 'evidence',
      ownerStage: 'Stroke Geometry smooth-continuity ownership binding',
      terminal: true
    }),
    artifact({
      id: 'artifact:constrained-dashed-join-owned-terminal-body-product',
      kind: 'ownership-overlay-record-set',
      channel: 'evidence',
      ownerStage: 'Stroke Geometry terminal body ownership binding',
      terminal: true
    }),
    artifact({
      id: 'artifact:constrained-dashed-product-units',
      kind: 'product-unit-set',
      ownerStage: 'Stroke Geometry legality-input union assembly',
      terminal: true
    }),
    artifact({
      id: 'artifact:constrained-dashed-render-descriptor',
      kind: 'render-descriptor',
      channel: 'render',
      ownerStage: 'Stroke Geometry product descriptor assembly',
      terminal: true
    }),
    artifact({
      id: 'channel:hit-export',
      kind: 'channel-input',
      channel: 'hit-export',
      ownerStage: 'Product Output channel projection'
    }),
    artifact({
      id: 'artifact:hit-export-packets',
      kind: 'output-packet',
      channel: 'hit-export',
      ownerStage: 'Product Output hit/export projection',
      terminal: true
    }),
    artifact({
      id: 'artifact:hitExportPackets',
      kind: 'output-packet',
      channel: 'hit-export',
      ownerStage: 'Product Output hit/export projection',
      terminal: true
    })
  ]
  const artifactById = new Map(
    artifactRegistry.map((registeredArtifact) => [
      registeredArtifact.id,
      registeredArtifact
    ])
  )
  const lifecycle = ({
    id,
    artifactClassId,
    computedAt,
    assemblyMode,
    contributorStepIds,
    overlayContributorStepIds,
    semanticChildOwnerField,
    preserveThrough,
    consumedBy,
    mustNotRecomputeAfter,
    mayDropOnlyWhen,
    dropEvidenceRequired,
    downstreamAuthority = true
  }) => ({
    id,
    artifactClassId,
    computedAt,
    ...(assemblyMode === undefined ? {} : { assemblyMode }),
    ...(contributorStepIds === undefined ? {} : { contributorStepIds }),
    ...(overlayContributorStepIds === undefined
      ? {}
      : { overlayContributorStepIds }),
    ...(semanticChildOwnerField === undefined
      ? {}
      : { semanticChildOwnerField }),
    preserveThrough,
    consumedBy,
    mustNotRecomputeAfter,
    mayDropOnlyWhen,
    dropEvidenceRequired,
    downstreamAuthority
  })
  const crossStepArtifactLifecycleDefinitions = [
    lifecycle({
      id: 'artifact:normalized-stroke-spec',
      artifactClassId: 'required-evidence-artifact',
      computedAt: 'normalize-stroke-spec',
      preserveThrough: [
        'resolve-stroke-domains',
        'allocate-dash-intervals',
        'select-stroke-product-family',
        'build-dash-interval-body-products',
        'apply-legality',
        'build-final-faces'
      ],
      consumedBy: [
        'resolve-stroke-domains',
        'allocate-dash-intervals',
        'select-stroke-product-family'
      ],
      mustNotRecomputeAfter: 'resolve-stroke-domains',
      mayDropOnlyWhen: [
        'hidden-output route is selected',
        'stroke style is absent or invalid and empty-output evidence is recorded'
      ],
      dropEvidenceRequired: [
        'stroke spec id',
        'empty-output route id',
        'normalization failure reason'
      ]
    }),
    lifecycle({
      id: 'artifact:stroke-domain-plan',
      artifactClassId: 'required-evidence-artifact',
      computedAt: 'resolve-stroke-domains',
      preserveThrough: [
        'allocate-dash-intervals',
        'select-stroke-product-family',
        'build-dash-interval-body-products',
        'apply-legality',
        'build-final-faces'
      ],
      consumedBy: [
        'allocate-dash-intervals',
        'select-stroke-product-family',
        'build-center-stroke-products',
        'build-constrained-solid-products',
        'build-dash-interval-body-products'
      ],
      mustNotRecomputeAfter: 'allocate-dash-intervals',
      mayDropOnlyWhen: [
        'no stroke product family is selected',
        'hidden-output route is selected',
        'invalid topology route proves no product can exist'
      ],
      dropEvidenceRequired: [
        'empty-output route id',
        'domain plan id',
        'reason why no product family consumes this domain'
      ]
    }),
    lifecycle({
      id: 'artifact:dash-product-interval',
      artifactClassId: 'required-evidence-artifact',
      computedAt: 'allocate-dash-intervals',
      preserveThrough: [
        'select-stroke-product-family',
        'build-dash-interval-body-products',
        'derive-dash-body-seam-boundaries',
        'build-source-vertex-join-products',
        'apply-legality',
        'build-final-faces',
        'render-entries'
      ],
      consumedBy: [
        'select-stroke-product-family',
        'build-dash-interval-body-products',
        'build-source-vertex-join-products'
      ],
      mustNotRecomputeAfter: 'build-dash-interval-body-products',
      mayDropOnlyWhen: [
        'solid or center product family is selected',
        'the visible interval is legally deleted and delete evidence is recorded',
        'hidden-output route is selected'
      ],
      dropEvidenceRequired: [
        'interval id',
        'terminal role or explicit none',
        'legal empty/delete reason when a visible interval has no product'
      ]
    }),
    lifecycle({
      id: 'artifact:constrained-dashed-interval-body-product',
      artifactClassId: 'required-product-artifact',
      computedAt: 'build-dash-interval-body-products',
      preserveThrough: [
        'derive-dash-body-seam-boundaries',
        'build-source-vertex-join-products',
        'build-terminal-body-products',
        'build-smooth-continuity-products',
        'apply-legality',
        'build-final-faces',
        'materialize-stroke-product-descriptors',
        'render-entries',
        'hit-export'
      ],
      consumedBy: [
        'derive-dash-body-seam-boundaries',
        'build-source-vertex-join-products',
        'build-terminal-body-products',
        'build-smooth-continuity-products',
        'apply-legality'
      ],
      mustNotRecomputeAfter: 'derive-dash-body-seam-boundaries',
      mayDropOnlyWhen: [
        'dash interval is gap-only',
        'legal deletion removes the body and delete evidence is recorded',
        'hidden-output route is selected'
      ],
      dropEvidenceRequired: [
        'dash product id',
        'dash interval id',
        'legal empty/delete reason'
      ]
    }),
    lifecycle({
      id: 'artifact:dash-body-seam-boundary',
      artifactClassId: 'required-evidence-artifact',
      computedAt: 'derive-dash-body-seam-boundaries',
      preserveThrough: [
        'build-source-vertex-join-products',
        'build-terminal-body-products',
        'apply-legality',
        'build-final-faces',
        'render-entries'
      ],
      consumedBy: [
        'build-source-vertex-join-products',
        'build-terminal-body-products'
      ],
      mustNotRecomputeAfter: 'build-source-vertex-join-products',
      mayDropOnlyWhen: [
        'owning dash body product is legally deleted',
        'interval has no terminal or source-vertex consumer',
        'hidden-output route is selected'
      ],
      dropEvidenceRequired: [
        'seam boundary id',
        'owning dash body product id',
        'delete or no-consumer reason'
      ]
    }),
    lifecycle({
      id: 'artifact:source-vertex-join-miter-evidence',
      artifactClassId: 'required-evidence-artifact',
      computedAt: 'build-source-vertex-join-products',
      preserveThrough: [
        'apply-legality',
        'build-final-faces',
        'materialize-stroke-product-descriptors',
        'render-entries',
        'hit-export'
      ],
      consumedBy: [
        'apply-legality',
        'build-final-faces',
        'materialize-stroke-product-descriptors',
        'render-entries',
        'hit-export'
      ],
      mustNotRecomputeAfter: 'apply-legality',
      mayDropOnlyWhen: [
        'source vertex has no join route',
        'join product is legally deleted and delete evidence is recorded',
        'hidden-output route is selected'
      ],
      dropEvidenceRequired: [
        'join evidence id',
        'source vertex id',
        'resolved join and miter comparison delete reason'
      ]
    }),
    lifecycle({
      id: 'artifact:constrained-dashed-source-vertex-join-product',
      artifactClassId: 'required-product-artifact',
      computedAt: 'build-source-vertex-join-products',
      preserveThrough: [
        'apply-legality',
        'build-final-faces',
        'materialize-stroke-product-descriptors',
        'render-entries',
        'hit-export'
      ],
      consumedBy: [
        'apply-legality',
        'build-final-faces',
        'materialize-stroke-product-descriptors',
        'render-entries',
        'hit-export'
      ],
      mustNotRecomputeAfter: 'apply-legality',
      mayDropOnlyWhen: [
        'source vertex is not sharp or has no constrained dashed incident body',
        'legal deletion removes the join and delete evidence is recorded',
        'hidden-output route is selected'
      ],
      dropEvidenceRequired: [
        'join product id',
        'incident seam boundary ids',
        'legal empty/delete reason'
      ]
    }),
    lifecycle({
      id: 'artifact:constrained-dashed-join-owned-terminal-body-product',
      artifactClassId: 'required-evidence-artifact',
      computedAt: 'build-terminal-body-products',
      preserveThrough: [
        'apply-legality',
        'build-final-faces',
        'materialize-stroke-product-descriptors',
        'render-entries',
        'hit-export'
      ],
      consumedBy: [
        'apply-legality',
        'build-final-faces',
        'materialize-stroke-product-descriptors',
        'render-entries',
        'hit-export'
      ],
      mustNotRecomputeAfter: 'apply-legality',
      mayDropOnlyWhen: [
        'interval has no join-owned terminal role',
        'legal deletion removes the referenced dash body and delete evidence is recorded',
        'hidden-output route is selected'
      ],
      dropEvidenceRequired: [
        'terminal ownership overlay id',
        'referenced dash body product id',
        'terminal role',
        'legal empty/delete reason'
      ]
    }),
    lifecycle({
      id: 'artifact:constrained-dashed-smooth-continuity-product',
      artifactClassId: 'required-evidence-artifact',
      computedAt: 'build-smooth-continuity-products',
      preserveThrough: [
        'apply-legality',
        'build-final-faces',
        'materialize-stroke-product-descriptors',
        'render-entries',
        'hit-export'
      ],
      consumedBy: [
        'apply-legality',
        'build-final-faces',
        'materialize-stroke-product-descriptors',
        'render-entries',
        'hit-export'
      ],
      mustNotRecomputeAfter: 'apply-legality',
      mayDropOnlyWhen: [
        'span is not tangent-continuous',
        'legal deletion removes every referenced dash body and delete evidence is recorded',
        'hidden-output route is selected'
      ],
      dropEvidenceRequired: [
        'smooth-continuity ownership overlay id',
        'referenced dash body product ids',
        'smooth-continuity group id',
        'legal empty/delete reason'
      ]
    }),
    lifecycle({
      id: 'artifact:constrained-dashed-product-units',
      artifactClassId: 'required-product-artifact',
      computedAt: 'apply-legality',
      assemblyMode: 'owner-preserving-family-union',
      contributorStepIds: [
        'build-dash-interval-body-products',
        'build-source-vertex-join-products'
      ],
      overlayContributorStepIds: [
        'build-terminal-body-products',
        'build-smooth-continuity-products'
      ],
      semanticChildOwnerField: 'ownerStepId',
      preserveThrough: ['apply-legality'],
      consumedBy: ['apply-legality'],
      mustNotRecomputeAfter: 'apply-legality',
      mayDropOnlyWhen: [
        'constrained dashed product family is not selected',
        'every child product unit is legally deleted with evidence',
        'hidden-output route is selected'
      ],
      dropEvidenceRequired: [
        'constrained dashed product unit set id',
        'child product ids with owner step ids',
        'legal empty/delete reason for every dropped child product'
      ]
    }),
    lifecycle({
      id: 'artifact:preLegalityProductUnits',
      artifactClassId: 'required-product-artifact',
      computedAt: 'apply-legality',
      assemblyMode: 'owner-preserving-family-union',
      contributorStepIds: [
        'build-constrained-solid-products',
        'build-dash-interval-body-products',
        'build-source-vertex-join-products',
        'build-smooth-continuity-products',
        'select-stroke-descriptor-strategy'
      ],
      overlayContributorStepIds: [
        'build-terminal-body-products',
        'build-smooth-continuity-products'
      ],
      semanticChildOwnerField: 'ownerStepId',
      preserveThrough: ['apply-legality'],
      consumedBy: ['apply-legality'],
      mustNotRecomputeAfter: 'apply-legality',
      mayDropOnlyWhen: [
        'no product family route is selected',
        'all route-owned product units are explicitly absent with evidence',
        'hidden-output route is selected'
      ],
      dropEvidenceRequired: [
        'pre-legality product unit set id',
        'child product ids with original owner step ids',
        'absence or empty-output reason for every missing product unit'
      ]
    }),
    lifecycle({
      id: 'artifact:postLegalityProductUnits',
      artifactClassId: 'required-product-artifact',
      computedAt: 'apply-legality',
      preserveThrough: [
        'build-resolved-stroke-regions',
        'attach-paint-payload',
        'build-final-faces',
        'materialize-stroke-product-descriptors',
        'emit-render-hit-export-packets',
        'render-entries',
        'hit-export'
      ],
      consumedBy: [
        'build-resolved-stroke-regions',
        'attach-paint-payload',
        'build-final-faces',
        'materialize-stroke-product-descriptors',
        'emit-render-hit-export-packets'
      ],
      mustNotRecomputeAfter: 'build-final-faces',
      mayDropOnlyWhen: [
        'legal deletion removes the product and delete evidence is recorded',
        'hidden-output route is selected',
        'no legal product remains for this source domain'
      ],
      dropEvidenceRequired: [
        'source product id',
        'legal-domain id',
        'legal clip/delete reason'
      ]
    }),
    lifecycle({
      id: 'artifact:legalityEquivalentProductUnits',
      artifactClassId: 'required-evidence-artifact',
      computedAt: 'apply-legality',
      preserveThrough: [
        'build-final-faces',
        'materialize-stroke-product-descriptors',
        'render-entries'
      ],
      consumedBy: ['materialize-stroke-product-descriptors', 'render-entries'],
      mustNotRecomputeAfter: 'materialize-stroke-product-descriptors',
      mayDropOnlyWhen: [
        'descriptor route is not selected',
        'canonical product route is selected',
        'hidden-output route is selected'
      ],
      dropEvidenceRequired: [
        'legality-equivalent product unit ids',
        'source post-legality product ids',
        'canonical-product or descriptor-ineligible reason'
      ]
    }),
    lifecycle({
      id: 'artifact:descriptorStrategyRecords',
      artifactClassId: 'required-evidence-artifact',
      computedAt: 'select-stroke-descriptor-strategy',
      preserveThrough: [
        'apply-legality',
        'build-final-faces',
        'materialize-stroke-product-descriptors',
        'render-entries'
      ],
      consumedBy: ['materialize-stroke-product-descriptors', 'render-entries'],
      mustNotRecomputeAfter: 'apply-legality',
      mayDropOnlyWhen: [
        'canonical product route is required',
        'descriptor route is not eligible',
        'hidden-output route is selected'
      ],
      dropEvidenceRequired: [
        'descriptor strategy id',
        'eligibility status',
        'legality basis or canonical fallback reason'
      ]
    }),
    lifecycle({
      id: 'artifact:finalFaces',
      artifactClassId: 'required-product-artifact',
      computedAt: 'build-final-faces',
      preserveThrough: [
        'materialize-stroke-product-descriptors',
        'emit-render-hit-export-packets',
        'render-entries',
        'hit-export'
      ],
      consumedBy: [
        'materialize-stroke-product-descriptors',
        'emit-render-hit-export-packets',
        'render-entries',
        'hit-export'
      ],
      mustNotRecomputeAfter: 'materialize-stroke-product-descriptors',
      mayDropOnlyWhen: [
        'post-legality product is legally empty',
        'hidden-output route is selected',
        'product is evidence-only and has no visible/hit/export channel'
      ],
      dropEvidenceRequired: [
        'final-face id',
        'owner / interval / terminal / seam / legal-domain / source-span identity set',
        'empty-output reason when no legal final face exists'
      ]
    }),
    lifecycle({
      id: 'artifact:constrained-dashed-render-descriptor',
      artifactClassId: 'required-product-artifact',
      computedAt: 'materialize-stroke-product-descriptors',
      preserveThrough: ['render-entries', 'hit-export'],
      consumedBy: ['render-entries', 'hit-export'],
      mustNotRecomputeAfter: 'render-entries',
      mayDropOnlyWhen: [
        'canonical visible product route is selected',
        'descriptor strategy is not eligible',
        'hidden-output route is selected'
      ],
      dropEvidenceRequired: [
        'descriptor id',
        'final-face id',
        'canonical-product or descriptor-ineligible reason'
      ]
    }),
    lifecycle({
      id: 'artifact:renderEntries',
      artifactClassId: 'required-product-artifact',
      computedAt: 'render-entries',
      preserveThrough: ['renderer-projection'],
      consumedBy: ['renderer-projection'],
      mustNotRecomputeAfter: 'renderer-projection',
      mayDropOnlyWhen: [
        'no final faces exist and empty-output evidence is recorded',
        'hidden-output route is selected',
        'the entry is replaced by declared same-paint composite with parity evidence'
      ],
      dropEvidenceRequired: [
        'render-entry id',
        'consumed final-face id',
        'owner / interval / terminal / seam / legal-domain / source-span parity evidence'
      ]
    }),
    lifecycle({
      id: 'artifact:same-paint-composite-state',
      artifactClassId: 'composite-stacking-state',
      computedAt: 'render-entries',
      preserveThrough: ['renderer-projection'],
      consumedBy: ['renderer-projection'],
      mustNotRecomputeAfter: 'renderer-projection',
      mayDropOnlyWhen: [
        'no same-paint overlap exists',
        'alpha-safe equivalence evidence proves separate projection is equivalent'
      ],
      dropEvidenceRequired: [
        'same-paint composite group id',
        'overlap/shared-boundary proof',
        'alpha-safe equivalence reason'
      ]
    }),
    lifecycle({
      id: 'artifact:hit-export-packets',
      artifactClassId: 'required-product-artifact',
      computedAt: 'emit-render-hit-export-packets',
      preserveThrough: ['hit-export'],
      consumedBy: ['hit-export'],
      mustNotRecomputeAfter: 'hit-export',
      mayDropOnlyWhen: [
        'no final faces exist and empty-output evidence is recorded',
        'hidden-output route is selected',
        'hit/export channel is explicitly disabled by product route'
      ],
      dropEvidenceRequired: [
        'hit/export packet id',
        'final-face owner set',
        'empty-output or disabled-channel reason'
      ]
    }),
    lifecycle({
      id: 'artifact:hitExportPackets',
      artifactClassId: 'required-product-artifact',
      computedAt: 'emit-render-hit-export-packets',
      preserveThrough: ['hit-export'],
      consumedBy: ['hit-export'],
      mustNotRecomputeAfter: 'hit-export',
      mayDropOnlyWhen: [
        'no final faces exist and empty-output evidence is recorded',
        'hidden-output route is selected',
        'hit/export channel is explicitly disabled by product route'
      ],
      dropEvidenceRequired: [
        'hit/export packet id',
        'final-face owner set',
        'empty-output or disabled-channel reason'
      ]
    })
  ]
  const crossStepArtifactLifecycleMatrix = Object.fromEntries(
    crossStepArtifactLifecycleDefinitions.map((entry) => [entry.id, entry])
  )
  const coExecutionCompletionRules = [
    {
      coExecutionGroup: 'coexec:center-product-units',
      owningDecisionGroup: 'decision:build-center-stroke-products',
      requiredRouteIds: [
        'center-products-coexecute-source-vertex-join-products'
      ],
      completionArtifactIds: ['artifact:finalFaces'],
      downstreamBarrier: 'build-final-faces',
      semantics:
        'Center product co-execution is optional per source vertex, but every dispatched source-vertex join route must complete before the center final-face path may claim join coverage.',
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#asyra-stroke-construction-baseline',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#asyra-join-resolution-baseline'
      ]
    },
    {
      coExecutionGroup: 'coexec:constrained-solid-product-units',
      owningDecisionGroup: 'decision:build-constrained-solid-products',
      requiredRouteIds: [
        'constrained-solid-products-coexecute-source-vertex-join-products',
        'constrained-solid-products-coexecute-smooth-continuity-products'
      ],
      completionArtifactIds: ['artifact:preLegalityProductUnits'],
      downstreamBarrier: 'apply-legality',
      semantics:
        'Constrained solid doubled-center bodies, every dispatched canonical source-vertex join, and every dispatched same-owner smooth-continuity span must exist or be explicitly absent with evidence before legality clipping or descriptor eligibility may claim constrained solid coverage.',
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#asyra-stroke-construction-baseline',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#smooth-curvature-non-join-contract',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#product-legality-and-descriptor-encoding'
      ]
    },
    {
      coExecutionGroup: 'coexec:constrained-dashed-product-units',
      owningDecisionGroup: 'decision:build-dash-interval-body-products',
      requiredRouteIds: [
        'constrained-dashed-products-derive-seam-boundaries',
        'constrained-dashed-products-coexecute-source-vertex-join-products',
        'constrained-dashed-products-coexecute-terminal-body-products',
        'constrained-dashed-products-coexecute-smooth-continuity-products',
        'constrained-dashed-products-coexecute-descriptor-strategy'
      ],
      completionArtifactIds: [
        'artifact:constrained-dashed-product-units',
        'artifact:constrained-dashed-join-owned-terminal-body-product',
        'artifact:constrained-dashed-smooth-continuity-product',
        'artifact:descriptorStrategyRecords'
      ],
      downstreamBarrier: 'apply-legality',
      semantics:
        'Constrained dashed Step 27 body and Step 29 join products co-execute with Step 30/31 ownership overlays and descriptor strategy. Legality cannot run until every applicable visible product and non-visible overlay is emitted or explicitly absent with evidence.',
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#dash-body-and-join-seam-contract',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#smooth-curvature-non-join-contract',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#product-legality-and-descriptor-encoding'
      ]
    },
    {
      coExecutionGroup: 'coexec:source-vertex-join-product-units',
      owningDecisionGroup: 'decision:build-source-vertex-join-products',
      requiredRouteIds: [
        'constrained-solid-canonical-source-vertex-join-footprint',
        'constrained-dashed-source-vertex-join-product'
      ],
      completionArtifactIds: [
        'artifact:constrained-dashed-join-owned-terminal-body-product'
      ],
      downstreamBarrier: 'apply-legality',
      semantics:
        'Every applicable source-vertex join route must emit a canonical join footprint or explicit no-join evidence before downstream legality or render channels may claim corner coverage.',
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#asyra-join-resolution-baseline',
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#source-domain-angle-evidence'
      ]
    },
    {
      coExecutionGroup: 'coexec:terminal-body-product-units',
      owningDecisionGroup: 'decision:build-terminal-body-products',
      requiredRouteIds: ['constrained-dashed-join-owned-terminal-body-product'],
      completionArtifactIds: [
        'artifact:constrained-dashed-join-owned-terminal-body-product'
      ],
      downstreamBarrier: 'apply-legality',
      semantics:
        'Every applicable terminal ownership route must reference an existing Step 27 body product and declared seam boundary, contribute zero visible geometry, and complete before legality or final faces consume terminal identity.',
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#dash-body-and-join-seam-contract'
      ]
    },
    {
      coExecutionGroup: 'coexec:smooth-continuity-product-units',
      owningDecisionGroup: 'decision:build-smooth-continuity-products',
      requiredRouteIds: ['constrained-dashed-smooth-continuity-product'],
      completionArtifactIds: [
        'artifact:constrained-dashed-smooth-continuity-product'
      ],
      downstreamBarrier: 'apply-legality',
      semantics:
        'The constrained-dashed smooth route must reference Step 27 continuous body coverage as a zero-visible-geometry ownership overlay; the constrained-solid route retains its same-owner visible product contract.',
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#smooth-curvature-non-join-contract'
      ]
    },
    {
      coExecutionGroup: 'product-output-channel-consumer',
      owningDecisionGroup: 'decision:emit-render-hit-export-packets',
      requiredRouteIds: ['hit-export-channel-packet-projection'],
      completionArtifactIds: ['artifact:hitExportPackets'],
      downstreamBarrier: 'hit-export',
      semantics:
        'Hit/export channel consumers run from emitted final-face channel packets and never depend on renderer projection output.',
      specRuleRefs: [
        'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#output-channel-separation'
      ]
    }
  ]
  const coExecutionCompletionRuleByGroup = new Map(
    coExecutionCompletionRules.map((rule) => [rule.coExecutionGroup, rule])
  )
  const splitProductStepIds = [
    'select-stroke-product-family',
    'build-center-stroke-products',
    'build-constrained-solid-products',
    'build-dash-interval-body-products',
    'derive-dash-body-seam-boundaries',
    'build-source-vertex-join-products',
    'build-terminal-body-products',
    'build-smooth-continuity-products',
    'select-stroke-descriptor-strategy'
  ]
  const retiredSingleProductStepId = [
    'build',
    'stroke',
    'product',
    'units'
  ].join('-')
  const retiredSingleProductGroupId = ['step', '24'].join('')
  const toNestedRoute = (candidate) => ({
    id: candidate.id,
    routeType: candidate.routeType,
    decisionGroup: candidate.decisionGroup,
    parallelGroup: candidate.parallelGroup,
    coExecutionGroup: candidate.coExecutionGroup,
    ownerStage: candidate.ownerStage,
    visibleContributor: candidate.visibleContributor,
    geometryBasis: candidate.geometryBasis,
    consumes: candidate.consumes,
    produces: candidate.produces,
    allowedContributors: candidate.allowedContributors,
    forbiddenContributors: candidate.forbiddenContributors,
    evidenceRequired: candidate.evidenceRequired,
    specRuleRefs: candidate.specRuleRefs,
    metricAssertions: candidate.metricAssertions
  })
  const nestedRoutesByStep = Object.fromEntries(
    splitProductStepIds.map((stepId) => [
      stepId,
      strokeProductRoutes
        .filter((candidate) => candidate.from === stepId)
        .map(toNestedRoute)
    ])
  )
  const evidenceRequiredByRoute = Object.fromEntries(
    conditionalRoutes.map((routeRecord) => [
      routeRecord.id,
      routeRecord.evidenceRequired
    ])
  )
  const edges = [
    ...new Set(conditionalRoutes.map((route) => `${route.from}->${route.to}`))
  ].map((edge) => edge.split('->'))
  const routeTargetsByStep = conditionalRoutes.reduce((targets, route) => {
    targets.set(route.from, [...(targets.get(route.from) ?? []), route.to])
    return targets
  }, new Map())
  steps.forEach((step) => {
    step.next = uniqueTargets(routeTargetsByStep.get(step.id) ?? [])
  })
  const requiredStepContractFields = [
    'inputs',
    'outputs',
    'conditions',
    'bypassConditions',
    'limitations',
    'ownerStage',
    'allowedContributors',
    'forbiddenContributors',
    'evidenceRequired',
    'failureReopensStep'
  ]
  const stepContractErrors = steps.flatMap((step) =>
    requiredStepContractFields
      .filter((field) => {
        const value = step[field]
        return Array.isArray(value) ? value.length === 0 : !value
      })
      .map((field) => `${step.id} missing ${field}`)
  )
  const requiredRouteContractFields = [
    'id',
    'from',
    'to',
    'routeType',
    'exclusiveGroup',
    'decisionGroup',
    'parallelGroup',
    'coExecutionGroup',
    'routePriority',
    'conditionKind',
    'conditionId',
    'predicateInputs',
    'when',
    'elseOf',
    'resumeAt',
    'nextConsumer',
    'condition',
    'output',
    'ownerStage',
    'failureReopensStep',
    'inputs',
    'consumes',
    'produces',
    'dirtyDependencies',
    'cacheKeyInputs',
    'limitations',
    'allowedContributors',
    'forbiddenContributors',
    'evidenceRequired',
    'visibleContributor',
    'geometryBasis',
    'specRuleRefs'
  ]
  const routeContractErrors = conditionalRoutes.flatMap((route) =>
    requiredRouteContractFields
      .filter((field) => {
        const value = route[field]
        return Array.isArray(value) ? value.length === 0 : !value
      })
      .map((field) => `${route.id ?? 'unnamed-route'} missing ${field}`)
  )
  const requiredRefactorLockFields = [
    'stepIndex',
    'refactorStatus',
    'unitTestFile',
    'implementationFiles',
    'allowedInputs',
    'requiredOutputs',
    'allowedTestImports',
    'advanceGate',
    'integrationUnlockCondition',
    'verificationEvidence'
  ]
  const refactorLockErrors = steps.flatMap((step) =>
    requiredRefactorLockFields
      .filter((field) => {
        const value = step[field]
        if (field === 'stepIndex') {
          return !Number.isInteger(value)
        }
        return Array.isArray(value) ? value.length === 0 : !value
      })
      .map((field) => `${step.id} missing refactor lock ${field}`)
  )
  const entryBoundaryErrors = entryBoundaryRequiredStepIds.flatMap((stepId) => {
    const step = steps.find((candidate) => candidate.id === stepId)
    if (!step) {
      return [`${stepId} missing required entry boundary step`]
    }

    const boundary = step.orchestrationBoundary
    return [
      step.entryPointKind ? null : `${stepId} missing entryPointKind`,
      step.entryPoint ? null : `${stepId} missing entryPoint`,
      Array.isArray(step.implementationFunctions) &&
      step.implementationFunctions.length > 0
        ? null
        : `${stepId} missing implementationFunctions`,
      Array.isArray(step.helperAllowlist) && step.helperAllowlist.length > 0
        ? null
        : `${stepId} missing helperAllowlist`,
      boundary ? null : `${stepId} missing orchestrationBoundary`,
      boundary?.ownerSurface?.includes('#')
        ? null
        : `${stepId} orchestrationBoundary.ownerSurface must identify a concrete owner surface`,
      boundary?.inputBoundary
        ? null
        : `${stepId} orchestrationBoundary missing inputBoundary`,
      boundary?.outputBoundary
        ? null
        : `${stepId} orchestrationBoundary missing outputBoundary`,
      Array.isArray(boundary?.forbiddenOwnership) &&
      boundary.forbiddenOwnership.length > 0
        ? null
        : `${stepId} orchestrationBoundary missing forbiddenOwnership`
    ].filter(Boolean)
  })
  const activeRefactorSteps = steps.filter(
    (step) => step.refactorStatus === 'active'
  )
  const allRefactorStepsVerified = steps.every(
    (step) => step.refactorStatus === 'verified'
  )
  const hasActiveRefactorStep = refactorProtocol.activeStepId !== null
  const schemaRepairActive =
    currentExecutionState.planStatus === 'inspector-flow-schema-repair-active'
  const refactorProtocolErrors = [
    schemaRepairActive &&
    currentExecutionState.nextExecutableStepId !==
      'inspector-schema-repair-gate'
      ? 'schema repair mode must point nextExecutableStepId at inspector-schema-repair-gate'
      : null,
    schemaRepairActive && activeRefactorSteps.length !== 0
      ? 'schema repair mode must not mark a product refactor step active'
      : null,
    schemaRepairActive &&
    steps.some((step) => step.refactorStatus === 'verified')
      ? 'schema repair mode must not mark inspector steps verified without per-step evidence'
      : null,
    hasActiveRefactorStep && activeRefactorStepIndex < 0
      ? `${refactorProtocol.activeStepId} is not a known inspector step`
      : null,
    hasActiveRefactorStep && activeRefactorSteps.length !== 1
      ? `expected exactly one active refactor step, found ${activeRefactorSteps.length}`
      : null,
    !schemaRepairActive && !hasActiveRefactorStep
      ? activeRefactorSteps.length === 0
        ? null
        : `expected no active refactor step after unit verification, found ${activeRefactorSteps.length}`
      : null,
    !schemaRepairActive && !hasActiveRefactorStep && allRefactorStepsVerified
      ? null
      : schemaRepairActive || hasActiveRefactorStep
        ? null
        : 'all refactor steps must be verified when activeRefactorStepId is null',
    hasActiveRefactorStep &&
    activeRefactorSteps[0]?.id !== refactorProtocol.activeStepId
      ? `active refactor step must be ${refactorProtocol.activeStepId}`
      : null,
    !schemaRepairActive &&
    !hasActiveRefactorStep &&
    currentExecutionState.planStatus === 'post-runtime-correctness-active'
      ? null
      : schemaRepairActive || hasActiveRefactorStep
        ? null
        : 'planStatus must indicate post-runtime correctness work is active when no runtime step remains',
    currentExecutionState.refactorProtocolName === refactorProtocol.name
      ? null
      : 'currentExecutionState refactor protocol name does not match refactorProtocol.name',
    hasActiveRefactorStep &&
    currentExecutionState.nextExecutableStepId !== refactorProtocol.activeStepId
      ? 'nextExecutableStepId must match the active refactor step'
      : null,
    !schemaRepairActive &&
    !hasActiveRefactorStep &&
    currentExecutionState.nextExecutableStepId === 'integration-suite'
      ? null
      : schemaRepairActive || hasActiveRefactorStep
        ? null
        : 'nextExecutableStepId must advance to the focused integration suite after all runtime step units verify',
    refactorProtocol.testConformancePolicy.includes(
      'current stroke engine spec'
    ) &&
    refactorProtocol.testConformancePolicy.includes('inspector step or route')
      ? null
      : 'test conformance policy must require current spec and inspector ownership mapping',
    refactorProtocol.stepExecutionPolicy.includes(
      'every runtime inspector step in the current graph'
    )
      ? null
      : 'step execution policy must require advancing through every runtime inspector step in the current graph',
    refactorProtocol.stepRetryLimit === 3
      ? null
      : 'step retry limit must be 3 focused repair attempts',
    refactorProtocol.stepRetryFailurePolicy.includes('third') &&
    refactorProtocol.stepRetryFailurePolicy.includes('task replan')
      ? null
      : 'step retry failure policy must automatically enter task replan after the third failed focused attempt',
    refactorProtocol.integrationPolicy.includes('runtime unit gate') &&
    refactorProtocol.integrationPolicy.includes('begin automatically') &&
    refactorProtocol.integrationPolicy.includes('formal geometry oracle')
      ? null
      : 'integration policy must automatically open focused integration and formal geometry-oracle work after the runtime unit gate',
    refactorProtocol.fullRegressionRetryLimit === 3
      ? null
      : 'full preset regression retry limit must be 3 attempts',
    refactorProtocol.fullRegressionFailurePolicy.includes('third') &&
    refactorProtocol.fullRegressionFailurePolicy.includes('task replan')
      ? null
      : 'full preset regression failure policy must automatically enter task replan after the third failed attempt',
    refactorProtocol.e2ePolicy.includes('starts automatically') &&
    refactorProtocol.e2ePolicy.includes('integration') &&
    refactorProtocol.e2ePolicy.includes('formal geometry-oracle') &&
    refactorProtocol.e2ePolicy.includes('explicit user request')
      ? null
      : 'E2E policy must start E2E after correctness prerequisites and keep visual review explicit-request-only'
  ].filter(Boolean)
  const wholeFlowReviewSegmentStepIds =
    wholeFlowReviewContract.reviewSegments.flatMap((segment) => segment.stepIds)
  const duplicateWholeFlowReviewStepIds = wholeFlowReviewSegmentStepIds.filter(
    (stepId, index) => wholeFlowReviewSegmentStepIds.indexOf(stepId) !== index
  )
  const wholeFlowReviewRequiredSegmentIds = [
    'source-mutation-ingress',
    'render-mirror-current-state-cache',
    'source-domain-planning',
    'product-family-coexecution',
    'legality-final-records-descriptors',
    'output-channels'
  ]
  const wholeFlowLedgerBySegmentId = new Map(
    wholeFlowReviewContract.completionLedger.map((entry) => [
      entry.segmentId,
      entry
    ])
  )
  const wholeFlowReviewSegmentById = new Map(
    wholeFlowReviewContract.reviewSegments.map((segment) => [segment.id, segment])
  )
  const wholeFlowClosurePacketBySegmentId = new Map(
    wholeFlowReviewContract.closurePackets.map((packet) => [
      packet.segmentId,
      packet
    ])
  )
  const productFamilyLedger = wholeFlowLedgerBySegmentId.get(
    'product-family-coexecution'
  )
  const productFamilyClosurePacket = wholeFlowClosurePacketBySegmentId.get(
    'product-family-coexecution'
  )
  const outputChannelLedger = wholeFlowLedgerBySegmentId.get('output-channels')
  const outputChannelClosurePacket =
    wholeFlowClosurePacketBySegmentId.get('output-channels')
  const registeredArtifactIds = new Set([
    ...artifactRegistry.map((entry) => entry.id),
    ...Object.keys(crossStepArtifactLifecycleMatrix)
  ])
  const confirmedWholeFlowLedgerEntries =
    wholeFlowReviewContract.completionLedger.filter(
      (entry) =>
        entry.closureState === 'implementation-ready' ||
        entry.closureState === 'runtime-closed'
    )
  const wholeFlowClosurePacketErrors =
    wholeFlowReviewContract.completionLedger.flatMap((entry) => {
      const packet = wholeFlowClosurePacketBySegmentId.get(entry.segmentId)
      const segment = wholeFlowReviewSegmentById.get(entry.segmentId)
      if (!packet) {
        return [`whole-flow review missing closure packet ${entry.segmentId}`]
      }

      return [
        packet.closureState === entry.closureState
          ? null
          : `${entry.segmentId} closure packet state must match ledger state`,
        packet.contractStatus === entry.contractStatus
          ? null
          : `${entry.segmentId} closure packet contract status must match ledger status`,
        packet.familyDataflowStatus === entry.familyDataflowStatus
          ? null
          : `${entry.segmentId} closure packet family dataflow status must match ledger status`,
        packet.runtimeStatus === entry.runtimeStatus
          ? null
          : `${entry.segmentId} closure packet runtime status must match ledger status`,
        segment &&
        segment.stepIds.every((stepId) => packet.coveredStepIds.includes(stepId))
          ? null
          : `${entry.segmentId} closure packet must cover every review segment step`,
        packet.specAnchors?.length > 0
          ? null
          : `${entry.segmentId} closure packet must name spec anchors`,
        packet.formalGates?.length > 0
          ? null
          : `${entry.segmentId} closure packet must name formal gates`,
        packet.reopenConditions?.length > 0
          ? null
          : `${entry.segmentId} closure packet must name reopen conditions`,
        packet.downstreamConsumers !== undefined
          ? null
          : `${entry.segmentId} closure packet must declare downstream consumers`,
        packet.mustNotRecomputeAfter !== undefined
          ? null
          : `${entry.segmentId} closure packet must declare mustNotRecomputeAfter boundaries`,
        packet.remainingScope !== undefined
          ? null
          : `${entry.segmentId} closure packet must declare remaining scope`
      ].filter(Boolean)
    })
  const wholeFlowClosurePacketArtifactErrors =
    wholeFlowReviewContract.closurePackets.flatMap((packet) =>
      [
        'computedArtifactIds',
        'preservedArtifactIds',
        'consumedArtifactIds',
        'projectedArtifactIds',
        'validatedArtifactIds'
      ].flatMap((field) =>
        (packet[field] ?? [])
          .filter(
            (artifactId) =>
              typeof artifactId === 'string' &&
              artifactId.startsWith('artifact:') &&
              !registeredArtifactIds.has(artifactId)
          )
          .map(
            (artifactId) =>
              `${packet.segmentId} closure packet references unknown artifact ${artifactId}`
          )
      )
    )
  const wholeFlowReviewErrors = [
    wholeFlowReviewContract.specAnchor.endsWith(
      '#whole-flow-review-and-step-grouping-contract'
    )
      ? null
      : 'whole-flow review contract must reference the README whole-flow review section',
    wholeFlowReviewContract.governingPrinciples.some((principle) =>
      principle.includes('implementation ownership slices')
    )
      ? null
      : 'whole-flow review contract must define steps as implementation ownership slices',
    refactorProtocol.stepExecutionPolicy.includes('whole-flow review')
      ? null
      : 'step execution policy must require whole-flow review before step implementation',
    currentExecutionState.requiredImplementationSequence.some((item) =>
      item.includes('Whole-Flow Review')
    )
      ? null
      : 'current execution state must require Whole-Flow Review before step implementation',
    wholeFlowReviewContract.closureStateMachine?.sourceRule?.endsWith(
      'inspector-closure-readiness.md'
    )
      ? null
      : 'whole-flow review must reference the inspector closure readiness rule',
    wholeFlowReviewContract.closureStateMachine?.states?.includes(
      'implementation-ready'
    ) &&
    wholeFlowReviewContract.closureStateMachine?.states?.includes(
      'runtime-closed'
    )
      ? null
      : 'whole-flow review must define closure state machine states',
    wholeFlowReviewContract.closureStateMachine?.implementationReadyRequires?.some(
      (rule) => rule.includes('family dataflow status')
    )
      ? null
      : 'whole-flow review must define implementation-ready requirements',
    ...wholeFlowReviewRequiredSegmentIds
      .filter(
        (segmentId) =>
          !wholeFlowReviewContract.reviewSegments.some(
            (segment) => segment.id === segmentId
          )
      )
      .map((segmentId) => `whole-flow review missing segment ${segmentId}`),
    ...steps
      .map((step) => step.id)
      .filter((stepId) => !wholeFlowReviewSegmentStepIds.includes(stepId))
      .map((stepId) => `whole-flow review does not classify step ${stepId}`),
    ...duplicateWholeFlowReviewStepIds.map(
      (stepId) => `whole-flow review classifies ${stepId} more than once`
    ),
    ...wholeFlowReviewSegmentStepIds
      .filter((stepId) => !stepById.has(stepId))
      .map((stepId) => `whole-flow review references unknown step ${stepId}`),
    wholeFlowReviewContract.handleTogether.some(
      (group) => group.id === 'constrained-dashed-product-family'
    )
      ? null
      : 'whole-flow review must group constrained dashed product family handling',
    wholeFlowReviewContract.handleTogether.some(
      (group) => group.id === 'constrained-solid-product-family'
    )
      ? null
      : 'whole-flow review must group constrained solid product family handling',
    wholeFlowReviewContract.segmentCompletionPolicy?.invalidationRule?.includes(
      'invalidates that segment'
    )
      ? null
      : 'whole-flow review must define closure-packet segment invalidation',
    ...wholeFlowClosurePacketErrors,
    ...wholeFlowClosurePacketArtifactErrors,
    productFamilyLedger?.status === 'implementation-ready' &&
    productFamilyLedger?.closureState === 'implementation-ready' &&
    productFamilyLedger?.contractStatus === 'contract-closed' &&
    productFamilyLedger?.familyDataflowStatus === 'family-dataflow-closed' &&
    productFamilyLedger?.runtimeStatus === 'pending-runtime-gates'
      ? null
      : 'whole-flow review must keep product-family contract implementation-ready while runtime gates remain pending',
    [productFamilyClosurePacket, productFamilyLedger].every((scope) =>
      [
        'constrained-dashed-body-program-identity-gate',
        'constrained-dashed-family-single-visible-body-owner-gate',
        'constrained-dashed-product-evidence-envelope-preservation-gate'
      ].every((oracle) =>
        scope?.runtimeBlockers?.some(
          (blocker) =>
            blocker.oracle === oracle &&
            blocker.status === 'pending-runtime-repair'
        )
      )
    )
      ? null
      : 'product-family runtime scope must record body identity, single-visible-body ownership, and evidence-envelope preservation blockers',
    [productFamilyClosurePacket, productFamilyLedger].every((scope) =>
      scope?.runtimeEvidence?.some(
        (evidence) =>
          evidence.oracle ===
            'constrained-dashed-inside-strict-performance-gate-on-port-3001' &&
          evidence.status === 'passed'
      )
    )
      ? null
      : 'product-family runtime evidence must retain only the verified inside strict baseline from port 3001 before continuous parameter reruns',
    productFamilyLedger?.status === 'pending-step-unit-regeneration'
      ? 'whole-flow review must not use stale pending-step-unit-regeneration status'
      : null,
    outputChannelLedger?.status === 'implementation-ready' &&
    outputChannelLedger?.closureState === 'implementation-ready' &&
    outputChannelLedger?.contractStatus === 'contract-closed' &&
    outputChannelLedger?.familyDataflowStatus === 'family-dataflow-closed' &&
    outputChannelLedger?.runtimeStatus === 'pending-runtime-gates'
      ? null
      : 'whole-flow review must separate implementation-ready output-channel contract closure from pending runtime gate closure',
    [outputChannelClosurePacket, outputChannelLedger].every(
      (scope) => Array.isArray(scope?.runtimeEvidence) && scope.runtimeEvidence.length === 0
    )
      ? null
      : 'output-channel runtime scope must clear stale terminal-identity and performance evidence before the envelope-aware gates rerun',
    [outputChannelClosurePacket, outputChannelLedger].every((scope) =>
      scope?.runtimeBlockers?.some(
        (blocker) =>
          blocker.oracle ===
            'constrained-dashed-batched-body-output-channel-gate' &&
          blocker.status === 'pending-runtime-repair'
      )
    )
      ? null
      : 'output-channel runtime scope must name the pending batched-body evidence-envelope handoff gate',
    ...confirmedWholeFlowLedgerEntries
      .filter(
        (entry) =>
          !confirmedSegmentSkipReviewConditions.every((condition) =>
            entry.skipReviewOnlyWhen?.includes(condition)
          )
      )
      .map(
        (entry) =>
          `${entry.segmentId} confirmed ledger entry is missing strict skip-review invalidation conditions`
      ),
    wholeFlowReviewContract.forbiddenReviewBehavior.includes(
      'approving the next implementation iteration from a step-local check only'
    )
      ? null
      : 'whole-flow review must forbid step-local-only implementation advancement'
  ].filter(Boolean)
  const runtimeImplementationActive =
    runtimeImplementationState.phase === 'runtime-implementation-audit-active'
  const runtimeImplementationComplete =
    runtimeImplementationState.phase === 'runtime-implementation-unit-complete'
  const runtimeImplementationEnabled =
    runtimeImplementationActive || runtimeImplementationComplete
  const runtimeImplementationActiveStep = steps.find(
    (step) => step.id === runtimeImplementationState.activeStepId
  )
  const runtimeImplementationActiveStepUnitTestFile =
    runtimeImplementationActiveStep?.unitTestFile ?? ''
  const runtimeImplementationActiveStepWorkspaceUnitTestFile =
    runtimeImplementationActiveStepUnitTestFile.replace(
      /^packages\/preset\//,
      ''
    )
  const runtimeVerifiedStepIds = Array.isArray(
    runtimeImplementationState.verifiedStepIds
  )
    ? runtimeImplementationState.verifiedStepIds
    : []
  const runtimeVerifiedStepIdSet = new Set(runtimeVerifiedStepIds)
  const runtimeExpectedActiveStep = steps[runtimeVerifiedStepIds.length]
  const runtimeVerifiedStepIdsArePrefix =
    Array.isArray(runtimeImplementationState.verifiedStepIds) &&
    runtimeVerifiedStepIds.length === runtimeVerifiedStepIdSet.size &&
    runtimeVerifiedStepIds.every((stepId, index) => steps[index]?.id === stepId)
  const runtimeVerifiedAllSteps = runtimeVerifiedStepIds.length === steps.length
  const runtimeImplementationErrors = [
    runtimeImplementationEnabled && !allRefactorStepsVerified
      ? 'runtime implementation may start only after all inspector step units are verified'
      : null,
    runtimeImplementationEnabled &&
    runtimeImplementationState.completedGate !== 'runtime-unit-gate'
      ? 'runtime implementation must record the completed runtime unit gate'
      : null,
    runtimeImplementationActive && !runtimeImplementationActiveStep
      ? `${runtimeImplementationState.activeStepId} is not a known runtime implementation step`
      : null,
    runtimeImplementationEnabled &&
    !Array.isArray(runtimeImplementationState.verifiedStepIds)
      ? 'runtime implementation must declare verifiedStepIds'
      : null,
    runtimeImplementationEnabled && !runtimeVerifiedStepIdsArePrefix
      ? 'runtime implementation verifiedStepIds must be a contiguous prefix from step 1 with no gaps or duplicates'
      : null,
    runtimeImplementationActive && !runtimeExpectedActiveStep
      ? 'runtime implementation must stop instead of keeping an active step after every runtime step is verified'
      : null,
    runtimeImplementationActive &&
    runtimeExpectedActiveStep &&
    runtimeImplementationState.activeStepId !== runtimeExpectedActiveStep.id
      ? `runtime implementation activeStepId must be the first unverified runtime step: ${runtimeExpectedActiveStep.id}`
      : null,
    runtimeImplementationActive &&
    runtimeVerifiedStepIdSet.has(runtimeImplementationState.activeStepId)
      ? `${runtimeImplementationState.activeStepId} is already in runtime verifiedStepIds`
      : null,
    runtimeImplementationActive &&
    runtimeImplementationActiveStep?.refactorStatus !== 'verified'
      ? `${runtimeImplementationState.activeStepId} must keep verified unit status during runtime implementation`
      : null,
    runtimeImplementationActive &&
    runtimeImplementationState.activeStepNumber !==
      runtimeImplementationActiveStep?.stepNumber
      ? 'runtime implementation activeStepNumber must match the inspector step'
      : null,
    runtimeImplementationActive &&
    ![
      runtimeImplementationActiveStepUnitTestFile,
      runtimeImplementationActiveStepWorkspaceUnitTestFile
    ].some((unitTestPath) =>
      unitTestPath
        ? runtimeImplementationState.activeStepGate.includes(unitTestPath)
        : false
    )
      ? 'runtime implementation activeStepGate must include the active step unit test'
      : null,
    runtimeImplementationComplete && !runtimeVerifiedAllSteps
      ? 'runtime implementation unit-complete phase requires every runtime step in verifiedStepIds'
      : null,
    runtimeImplementationComplete &&
    runtimeImplementationState.activeStepId !== null
      ? 'runtime implementation unit-complete phase must not keep an active runtime step'
      : null,
    runtimeImplementationComplete &&
    runtimeImplementationState.activeStepNumber !== null
      ? 'runtime implementation unit-complete phase must not keep an active runtime step number'
      : null,
    runtimeImplementationComplete &&
    runtimeImplementationState.activeStepUnitStatus !== 'complete'
      ? 'runtime implementation unit-complete phase must mark activeStepUnitStatus complete'
      : null,
    runtimeImplementationComplete &&
    !runtimeImplementationState.activeStepGate.includes(
      'runtime inspector steps verified'
    )
      ? 'runtime implementation unit-complete phase must record all runtime inspector steps verified'
      : null,
    runtimeImplementationState.stepRetryLimit ===
    refactorProtocol.stepRetryLimit
      ? null
      : 'runtime implementation stepRetryLimit must match refactorProtocol.stepRetryLimit',
    runtimeImplementationState.sequentialLockPolicy?.includes(
      'first unverified runtime step'
    )
      ? null
      : 'runtime implementation must document the first-unverified-step sequential lock policy',
    runtimeImplementationState.pendingTechnicalPhases.includes(
      'full package regression'
    ) &&
    runtimeImplementationState.pendingTechnicalPhases.includes('E2E') &&
    runtimeImplementationState.pendingTechnicalPhases.includes('performance') &&
    !runtimeImplementationState.pendingTechnicalPhases.includes('visual review')
      ? null
      : 'runtime implementation must record pending technical phases without making optional visual review a prerequisite',
    runtimeImplementationState.evidenceRequired.includes(
      'implementation entry boundary mapping'
    ) &&
    runtimeImplementationState.evidenceRequired.includes(
      'protocol validator result'
    ) &&
    runtimeImplementationState.evidenceRequired.includes(
      'runtime verified step prefix ledger'
    )
      ? null
      : 'runtime implementation must require implementation mapping and protocol evidence'
  ].filter(Boolean)
  const sharpVertexDescriptorRouteErrors = conditionalRoutes
    .filter(
      (route) =>
        route.id.includes('constrained-solid') &&
        route.id.includes('descriptor')
    )
    .flatMap((route) => {
      const routeText = [
        route.condition,
        route.output,
        ...(route.limitations ?? []),
        ...(route.forbiddenContributors ?? []),
        ...(route.evidenceRequired ?? [])
      ].join(' ')
      return [
        routeText.includes('sharp source-vertex')
          ? null
          : `${route.id} missing sharp source-vertex boundary rule`,
        routeText.includes('strokePathStyle.join')
          ? null
          : `${route.id} missing strokePathStyle.join ownership rule`,
        routeText.includes('same-owner smooth')
          ? null
          : `${route.id} missing same-owner smooth descriptor condition`
      ].filter(Boolean)
    })
  const dashedSourceVertexJoinRoute = conditionalRoutes.find(
    (route) => route.id === 'constrained-dashed-source-vertex-join-product'
  )
  const dashedSourceVertexJoinRouteText = dashedSourceVertexJoinRoute
    ? [
        dashedSourceVertexJoinRoute.condition,
        dashedSourceVertexJoinRoute.output,
        ...(dashedSourceVertexJoinRoute.inputs ?? []),
        ...(dashedSourceVertexJoinRoute.limitations ?? []),
        ...(dashedSourceVertexJoinRoute.allowedContributors ?? []),
        ...(dashedSourceVertexJoinRoute.forbiddenContributors ?? []),
        ...(dashedSourceVertexJoinRoute.evidenceRequired ?? [])
      ].join(' ')
    : ''
  const dashedSourceVertexJoinRouteErrors = [
    dashedSourceVertexJoinRouteText.includes('seam-free')
      ? null
      : 'constrained-dashed-source-vertex-join-product missing seam-free join contract',
    dashedSourceVertexJoinRouteText.includes('incident dash body seam boundary')
      ? null
      : 'constrained-dashed-source-vertex-join-product missing incident dash seam boundary input',
    dashedSourceVertexJoinRouteText.includes('visible dash/join seam gap')
      ? null
      : 'constrained-dashed-source-vertex-join-product missing forbidden visible dash/join seam gap',
    dashedSourceVertexJoinRouteText.includes('tangent-continuity')
      ? null
      : 'constrained-dashed-source-vertex-join-product missing tangent-continuity bypass evidence'
  ].filter(Boolean)
  const dashedSmoothContinuityRoute = conditionalRoutes.find(
    (route) => route.id === 'constrained-dashed-smooth-continuity-product'
  )
  const dashedSmoothContinuityRouteText = dashedSmoothContinuityRoute
    ? [
        dashedSmoothContinuityRoute.condition,
        dashedSmoothContinuityRoute.output,
        ...(dashedSmoothContinuityRoute.limitations ?? []),
        ...(dashedSmoothContinuityRoute.allowedContributors ?? []),
        ...(dashedSmoothContinuityRoute.forbiddenContributors ?? []),
        ...(dashedSmoothContinuityRoute.evidenceRequired ?? [])
      ].join(' ')
    : ''
  const dashedSmoothContinuityRouteErrors = [
    dashedSmoothContinuityRoute
      ? null
      : 'constrained-dashed-smooth-continuity-product route missing',
    dashedSmoothContinuityRouteText.includes(
      'High curvature alone must not create source-vertex join ownership'
    )
      ? null
      : 'constrained-dashed-smooth-continuity-product missing high-curvature non-join rule',
    dashedSmoothContinuityRouteText.includes('single continuous footprint')
      ? null
      : 'constrained-dashed-smooth-continuity-product missing continuous footprint proof',
    dashedSmoothContinuityRouteText.includes('source-vertex join product')
      ? null
      : 'constrained-dashed-smooth-continuity-product missing forbidden source-vertex join contributor'
  ].filter(Boolean)
  const visibleConstructionHelperAllowanceErrors = conditionalRoutes
    .filter((route) =>
      (route.allowedContributors ?? []).some((contributor) =>
        contributor.toLowerCase().includes('construction/helper')
      )
    )
    .map(
      (route) => `${route.id} allows a visible construction/helper contributor`
    )
  const missingRouteTargets = conditionalRoutes
    .filter((route) => !stepById.has(route.from) || !stepById.has(route.to))
    .map((route) => route.id)
  const routeTypeErrors = conditionalRoutes
    .filter((route) => !routeTypes.includes(route.routeType))
    .map((route) => `${route.id} has invalid routeType ${route.routeType}`)
  const routeElsePriorityErrors = conditionalRoutes
    .filter((route) => route.conditionKind === 'else')
    .filter(
      (route) =>
        route.routePriority < 900 || !route.condition.includes('Else route')
    )
    .map(
      (route) =>
        `${route.id} else route must use low priority and explicit else condition`
    )
  const routeTypedFieldErrors = conditionalRoutes.flatMap((route) => {
    const requiredArrays = [
      'consumes',
      'produces',
      'predicateInputs',
      'dirtyDependencies',
      'cacheKeyInputs'
    ]
    return requiredArrays
      .filter(
        (field) => !Array.isArray(route[field]) || route[field].length === 0
      )
      .map((field) => `${route.id} missing typed route field ${field}`)
  })
  const routeConditionSchemaErrors = conditionalRoutes.flatMap((route) => {
    const errors = []
    const isPredicateShape = (shape) => {
      if (!shape || typeof shape !== 'object') {
        return false
      }
      if (Array.isArray(shape.all)) {
        return shape.all.length > 0 && shape.all.every(isPredicateShape)
      }
      if (Array.isArray(shape.any)) {
        return shape.any.length > 0 && shape.any.every(isPredicateShape)
      }
      if (shape.not) {
        return isPredicateShape(shape.not)
      }
      if (shape.elseOf) {
        return typeof shape.elseOf === 'string' && shape.elseOf.length > 0
      }
      return (
        typeof shape.field === 'string' &&
        typeof shape.op === 'string' &&
        Object.prototype.hasOwnProperty.call(shape, 'value')
      )
    }
    if (!route.conditionId) {
      errors.push(`${route.id} missing conditionId`)
    }
    if (!route.when || typeof route.when !== 'object') {
      errors.push(`${route.id} missing structured when predicate`)
    } else if (!isPredicateShape(route.when)) {
      errors.push(`${route.id} has non-executable when predicate`)
    }
    if (route.when?.kind || route.when?.inputs) {
      errors.push(`${route.id} uses generic input-list when predicate`)
    }
    if (route.conditionKind === 'else') {
      if (route.when?.elseOf !== route.decisionGroup) {
        errors.push(`${route.id} else route must use when.elseOf decisionGroup`)
      }
      if (!route.elseOf || route.elseOf === 'none') {
        errors.push(`${route.id} else route must name elseOf decisionGroup`)
      }
    } else {
      if (route.when?.elseOf) {
        errors.push(`${route.id} non-else route must not use an else predicate`)
      }
      if (route.elseOf !== 'none') {
        errors.push(`${route.id} non-else route must use elseOf "none"`)
      }
    }
    return errors
  })
  const collectPredicateFields = (shape) => {
    if (!shape || typeof shape !== 'object') {
      return []
    }
    return [
      typeof shape.field === 'string' ? shape.field : null,
      ...(Array.isArray(shape.all)
        ? shape.all.flatMap(collectPredicateFields)
        : []),
      ...(Array.isArray(shape.any)
        ? shape.any.flatMap(collectPredicateFields)
        : []),
      ...(shape.not ? collectPredicateFields(shape.not) : [])
    ].filter(Boolean)
  }
  const productPredicateRouteIds = new Set([
    'center-dashed-authored-stroke-descriptor',
    'center-solid-canonical-source-vertex-join-footprint',
    'constrained-solid-doubled-center-mask',
    'constrained-solid-canonical-source-vertex-join-footprint',
    'constrained-solid-same-owner-smooth-span-descriptor',
    'constrained-dashed-descriptor-materialization',
    'constrained-dashed-inside-mask-descriptor',
    'constrained-dashed-outside-source-domain-descriptor',
    'constrained-dashed-outside-aggregate-descriptor',
    'canonical-final-face-render-entry'
  ])
  const productPredicateErrors = conditionalRoutes
    .filter((route) => productPredicateRouteIds.has(route.id))
    .flatMap((route) => {
      const fields = collectPredicateFields(route.when)
      return [
        fields.some(
          (field) =>
            field === 'source.route-id' || field === 'source.source-revision'
        )
          ? `${route.id} uses default source route predicate instead of semantic predicate fields`
          : null,
        fields.some((field) =>
          /^(stroke|dash|join|domain|descriptor|channel|source)\./.test(field)
        )
          ? null
          : `${route.id} missing semantic predicate field root`
      ].filter(Boolean)
    })
  const decisionGroups = conditionalRoutes.reduce((groupsByDecision, route) => {
    const routes = groupsByDecision.get(route.decisionGroup) ?? []
    routes.push(route)
    groupsByDecision.set(route.decisionGroup, routes)
    return groupsByDecision
  }, new Map())
  const decisionGroupErrors = [...decisionGroups.entries()].flatMap(
    ([decisionGroup, routes]) => {
      const elseRoutes = routes.filter(
        (route) => route.conditionKind === 'else'
      )
      const conditionIds = routes.map((route) => route.conditionId)
      const duplicateConditionIds = conditionIds.filter(
        (conditionId, index) => conditionIds.indexOf(conditionId) !== index
      )
      return [
        elseRoutes.length > 1
          ? `${decisionGroup} has ${elseRoutes.length} else routes`
          : null,
        ...duplicateConditionIds.map(
          (conditionId) =>
            `${decisionGroup} duplicates conditionId ${conditionId}`
        ),
        ...elseRoutes
          .filter((route) => route.elseOf !== decisionGroup)
          .map((route) => `${route.id} elseOf must equal its decisionGroup`)
      ].filter(Boolean)
    }
  )
  const parallelRouteErrors = conditionalRoutes
    .filter((route) => route.routeType === 'parallel')
    .flatMap((route) =>
      [
        route.parallelGroup && route.parallelGroup !== 'none'
          ? null
          : `${route.id} parallel route missing parallelGroup`,
        route.coExecutionGroup && route.coExecutionGroup !== 'none'
          ? null
          : `${route.id} parallel route missing coExecutionGroup`
      ].filter(Boolean)
    )
  const coExecutionGroupsInRoutes = [
    ...new Set(
      conditionalRoutes
        .map((route) => route.coExecutionGroup)
        .filter((group) => group && group !== 'none')
    )
  ]
  const routeIds = new Set(conditionalRoutes.map((route) => route.id))
  const coExecutionCompletionRuleErrors = [
    ...coExecutionGroupsInRoutes
      .filter((group) => !coExecutionCompletionRuleByGroup.has(group))
      .map((group) => `${group} missing coExecutionCompletionRules entry`),
    ...coExecutionCompletionRules.flatMap((rule) => {
      const errors = []
      if (!rule.owningDecisionGroup) {
        errors.push(`${rule.coExecutionGroup} missing owningDecisionGroup`)
      }
      if (
        !Array.isArray(rule.requiredRouteIds) ||
        rule.requiredRouteIds.length === 0
      ) {
        errors.push(`${rule.coExecutionGroup} missing requiredRouteIds`)
      }
      for (const routeId of rule.requiredRouteIds ?? []) {
        if (!routeIds.has(routeId)) {
          errors.push(
            `${rule.coExecutionGroup} references unknown route ${routeId}`
          )
        }
      }
      if (
        !Array.isArray(rule.completionArtifactIds) ||
        rule.completionArtifactIds.length === 0
      ) {
        errors.push(`${rule.coExecutionGroup} missing completionArtifactIds`)
      }
      for (const artifactId of rule.completionArtifactIds ?? []) {
        if (!artifactById.has(artifactId)) {
          errors.push(
            `${rule.coExecutionGroup} references unknown completion artifact ${artifactId}`
          )
        }
      }
      if (!rule.downstreamBarrier || !stepById.has(rule.downstreamBarrier)) {
        errors.push(`${rule.coExecutionGroup} missing known downstreamBarrier`)
      }
      if (!rule.semantics) {
        errors.push(`${rule.coExecutionGroup} missing completion semantics`)
      }
      if (!Array.isArray(rule.specRuleRefs) || rule.specRuleRefs.length === 0) {
        errors.push(`${rule.coExecutionGroup} missing specRuleRefs`)
      }
      return errors
    })
  ]
  const bypassReachabilityErrors = conditionalRoutes
    .filter((route) => route.routeType === 'bypass')
    .flatMap((route) => {
      const elseRoutes = conditionalRoutes.filter(
        (candidate) =>
          candidate.decisionGroup === route.decisionGroup &&
          candidate.conditionKind === 'else'
      )
      return [
        route.skipSteps.length > 0
          ? null
          : `${route.id} bypass route missing skipSteps`,
        route.resumeAt && route.nextConsumer
          ? null
          : `${route.id} bypass route missing resumeAt or nextConsumer`,
        elseRoutes.length === 1
          ? null
          : `${route.id} bypass decision group must have exactly one else route`,
        elseRoutes[0] && route.routePriority < elseRoutes[0].routePriority
          ? null
          : `${route.id} bypass route priority must win before its else route`,
        route.skipSteps.includes(route.from) ||
        route.skipSteps.includes(route.to)
          ? `${route.id} skipSteps must not include its source or resume target`
          : null
      ].filter(Boolean)
    })
  const artifactRegistryIds = artifactRegistry.map(
    (registeredArtifact) => registeredArtifact.id
  )
  const duplicateArtifactIds = artifactRegistryIds.filter(
    (id, index) => artifactRegistryIds.indexOf(id) !== index
  )
  const consumedArtifactIds = new Set(
    conditionalRoutes.flatMap((route) => route.consumes)
  )
  const producedArtifactIds = new Set(
    conditionalRoutes.flatMap((route) => route.produces)
  )
  const artifactRegistryErrors = [
    ...duplicateArtifactIds.map((id) => `artifactRegistry duplicates ${id}`),
    ...[...consumedArtifactIds, ...producedArtifactIds]
      .filter((id) => !artifactById.has(id))
      .map((id) => `route references unregistered artifact ${id}`),
    ...[...producedArtifactIds]
      .filter((id) => {
        const registeredArtifact = artifactById.get(id)
        return (
          registeredArtifact &&
          !registeredArtifact.terminal &&
          !consumedArtifactIds.has(id)
        )
      })
      .map((id) => `produced artifact ${id} has no downstream consumer`)
  ]
  const requiredSplitProductStepIds = new Set(splitProductStepIds)
  const splitProductRouteIds = new Set(
    splitProductStepIds.flatMap((stepId) =>
      (nestedRoutesByStep[stepId] ?? []).map((route) => route.id)
    )
  )
  const splitProductStepErrors = [
    steps.some((step) => step.id === retiredSingleProductStepId)
      ? `retired ${retiredSingleProductStepId} step must be split into product steps`
      : null,
    ...splitProductStepIds
      .filter((stepId) => !stepById.has(stepId))
      .map((stepId) => `${stepId} missing split product step`),
    ...strokeProductRoutes
      .filter((route) => requiredSplitProductStepIds.has(route.from))
      .filter((route) => !splitProductRouteIds.has(route.id))
      .map(
        (route) => `${route.id} missing from split product nested route table`
      ),
    ...splitProductStepIds.flatMap((stepId) =>
      (nestedRoutesByStep[stepId] ?? []).flatMap((route) =>
        [
          route.ownerStage ? null : `${route.id} missing nested ownerStage`,
          route.visibleContributor
            ? null
            : `${route.id} missing nested visibleContributor`,
          route.geometryBasis
            ? null
            : `${route.id} missing nested geometryBasis`,
          route.allowedContributors.length
            ? null
            : `${route.id} missing nested allowedContributors`,
          route.forbiddenContributors.length
            ? null
            : `${route.id} missing nested forbiddenContributors`,
          route.specRuleRefs?.length
            ? null
            : `${route.id} missing nested specRuleRefs`
        ].filter(Boolean)
      )
    )
  ].filter(Boolean)
  const edgeSet = new Set(edges.map(([from, to]) => `${from}->${to}`))
  const conditionalRouteEdgeSet = new Set(
    conditionalRoutes.map((route) => `${route.from}->${route.to}`)
  )
  const edgeDriftErrors = [
    ...[...edgeSet]
      .filter((edge) => !conditionalRouteEdgeSet.has(edge))
      .map(
        (edge) =>
          `edges contains route not present in conditionalRoutes: ${edge}`
      ),
    ...[...conditionalRouteEdgeSet]
      .filter((edge) => !edgeSet.has(edge))
      .map(
        (edge) => `conditionalRoutes route missing from derived edges: ${edge}`
      )
  ]
  const stepRuleRefErrors = steps.flatMap((step) => {
    const errors = []
    if (!Array.isArray(step.ruleRefs) || step.ruleRefs.length === 0) {
      errors.push(`${step.id} missing targeted ruleRefs`)
    }
    if ((step.ruleRefs ?? []).length === latestRules.length) {
      errors.push(`${step.id} must not reference every global rule`)
    }
    for (const ref of step.ruleRefs ?? []) {
      if (!ruleTextById.has(ref)) {
        errors.push(`${step.id} references unknown rule ${ref}`)
      }
    }
    return errors
  })
  const ruleRegistryErrors = [
    stableRuleIds.length === latestRules.length
      ? null
      : `stableRuleIds has ${stableRuleIds.length} ids for ${latestRules.length} rules`,
    ...ruleRegistry
      .filter((rule) => /^stroke-rule-\d+$/.test(rule.id))
      .map((rule) => `${rule.id} is index-based instead of semantic`)
  ].filter(Boolean)
  const verificationEvidenceErrors = steps.flatMap((step) => {
    const evidence = step.verificationEvidence ?? {}
    return ['gateName', 'testFile', 'status', 'artifactPath', 'verifiedAt']
      .filter((field) => !evidence[field])
      .map((field) => `${step.id} missing verificationEvidence.${field}`)
  })
  const hitExportDependencyErrors = conditionalRoutes
    .filter(
      (route) =>
        route.from === 'renderer-projection' && route.to === 'hit-export'
    )
    .map(
      (route) =>
        `${route.id} incorrectly routes renderer projection into hit/export`
    )
  const retiredRendererMiterField = ['miter', 'Limit'].join('')
  const miterFieldErrors = conditionalRoutes
    .filter((route) =>
      JSON.stringify(route).includes(retiredRendererMiterField)
    )
    .map(
      (route) =>
        `${route.id} uses ${retiredRendererMiterField} instead of rendererMiterLimit`
    )
  const specRuleRefErrors = conditionalRoutes.flatMap((route) => {
    const refs = route.specRuleRefs ?? []
    const errors = []
    if (refs.length === 0) {
      errors.push(`${route.id} missing specRuleRefs`)
    }
    if (
      route.id.includes('source-vertex-join') &&
      !refs.some((ref) => ref.endsWith('#asyra-join-resolution-baseline'))
    ) {
      errors.push(`${route.id} missing join resolution spec ref`)
    }
    if (
      route.id.includes('source-vertex-join') &&
      !refs.some((ref) => ref.endsWith('#source-domain-angle-evidence'))
    ) {
      errors.push(`${route.id} missing source-domain angle spec ref`)
    }
    if (
      route.id.includes('dashed') &&
      route.id.includes('join') &&
      !refs.some((ref) => ref.endsWith('#dash-body-and-join-seam-contract'))
    ) {
      errors.push(`${route.id} missing dash/join seam spec ref`)
    }
    return errors
  })
  const metricAssertionErrors = conditionalRoutes.flatMap((route) => {
    const metrics = route.metricAssertions ?? []
    if (
      [
        'constrained-dashed-source-vertex-join-product',
        'constrained-dashed-interval-body-product',
        'constrained-dashed-join-owned-terminal-body-product'
      ].includes(route.id)
    ) {
      return metrics.length
        ? []
        : [`${route.id} missing seam endpoint identity metricAssertions`]
    }
    return []
  })
  const descriptorLegalityErrors = conditionalRoutes
    .filter((route) => route.id.includes('descriptor-materialization'))
    .flatMap((route) => {
      const consumesPreLegality = (route.consumes ?? []).includes(
        'artifact:preLegalityProductUnits'
      )
      const hasEquivalenceEvidence = [
        ...(route.evidenceRequired ?? []),
        ...(route.limitations ?? []),
        ...(route.consumes ?? [])
      ]
        .join(' ')
        .includes('legality')
      return [
        consumesPreLegality && !hasEquivalenceEvidence
          ? `${route.id} consumes preLegalityProductUnits without legality-equivalence evidence`
          : null,
        (route.consumes ?? []).includes('artifact:postLegalityProductUnits') ||
        (route.consumes ?? []).includes(
          'artifact:legalityEquivalentProductUnits'
        )
          ? null
          : `${route.id} must consume postLegalityProductUnits or legalityEquivalentProductUnits`
      ].filter(Boolean)
    })
  const routeById = new Map(conditionalRoutes.map((route) => [route.id, route]))
  const validateLifecycleContract = (contract) => {
    const errors = []
    const label = contract?.id ?? 'unnamed lifecycle contract'
    if (!contract?.specRuleId) {
      errors.push(`${label} missing specRuleId`)
    }
    if (!contract?.specAnchor) {
      errors.push(`${label} missing specAnchor`)
    }
    if (!contract?.formalGate) {
      errors.push(`${label} missing formalGate`)
    }
    if (
      !Array.isArray(contract?.artifactIds) ||
      contract.artifactIds.length === 0
    ) {
      errors.push(`${label} missing artifactIds`)
    }
    for (const artifactId of contract?.artifactIds ?? []) {
      if (!artifactById.has(artifactId)) {
        errors.push(`${label} references unknown artifact ${artifactId}`)
      }
    }
    if (
      !Array.isArray(contract?.ownerSteps) ||
      contract.ownerSteps.length === 0
    ) {
      errors.push(`${label} missing ownerSteps`)
    }
    for (const stepId of contract?.ownerSteps ?? []) {
      if (!stepById.has(stepId)) {
        errors.push(`${label} references unknown owner step ${stepId}`)
      }
    }
    if (
      !Array.isArray(contract?.lifecycle) ||
      contract.lifecycle.length === 0
    ) {
      errors.push(`${label} missing lifecycle phases`)
    }
    for (const phase of contract?.lifecycle ?? []) {
      const phaseLabel = `${label}:${phase.phase ?? 'unnamed phase'}`
      if (!phase.phase) {
        errors.push(`${phaseLabel} missing phase`)
      }
      if (!stepById.has(phase.stepId)) {
        errors.push(`${phaseLabel} references unknown step ${phase.stepId}`)
      }
      if (!Array.isArray(phase.routeIds) || phase.routeIds.length === 0) {
        errors.push(`${phaseLabel} missing routeIds`)
      }
      for (const routeId of phase.routeIds ?? []) {
        if (!routeById.has(routeId)) {
          errors.push(`${phaseLabel} references unknown route ${routeId}`)
        }
      }
      for (const artifactId of phase.consumesArtifacts ?? []) {
        if (!artifactById.has(artifactId)) {
          errors.push(`${phaseLabel} consumes unknown artifact ${artifactId}`)
        }
      }
      for (const artifactId of phase.producesArtifacts ?? []) {
        if (!artifactById.has(artifactId)) {
          errors.push(`${phaseLabel} produces unknown artifact ${artifactId}`)
        }
      }
      if (!stepById.has(phase.failureReopensStep)) {
        errors.push(
          `${phaseLabel} references unknown failureReopensStep ${phase.failureReopensStep}`
        )
      }
    }
    return errors
  }
  const dashJoinSeamLifecyclePhaseIds = new Set(
    dashJoinSeamLifecycleContract.lifecycle.map((phase) => phase.phase)
  )
  const requiredArtifactClosureKnownArtifacts =
    requiredArtifactClosureContract.closureRequirements.flatMap(
      (requirement) => requirement.requiredArtifacts
    )
  const requiredArtifactClosureKnownSteps =
    requiredArtifactClosureContract.closureRequirements.flatMap((requirement) => [
      ...requirement.ownerSteps,
      requirement.failureReopensStep
    ])
  const requiredArtifactClosureErrors = [
    requiredArtifactClosureContract.specAnchor.endsWith(
      '#spec-to-enforcement-contract'
    )
      ? null
      : 'required artifact closure contract must reference Spec-To-Enforcement Contract',
    requiredArtifactClosureContract.targetSurfaces.includes(
      'visible render coverage'
    )
      ? null
      : 'required artifact closure contract must include visible render coverage',
    requiredArtifactClosureContract.targetSurfaces.includes('hit/export coverage')
      ? null
      : 'required artifact closure contract must include hit/export coverage',
    requiredArtifactClosureContract.governingPrinciples.some((principle) =>
      principle.includes('Define final required artifacts before step-local')
    )
      ? null
      : 'required artifact closure contract must be destination-driven before step-local checks',
    requiredArtifactClosureContract.forbiddenBehaviors.includes(
      'claiming closure from seam identity without final required coverage'
    )
      ? null
      : 'required artifact closure contract must forbid seam-identity-only closure',
    ...requiredArtifactClosureKnownArtifacts
      .filter((artifactId) => !artifactById.has(artifactId))
      .map(
        (artifactId) =>
          `required artifact closure references unknown artifact ${artifactId}`
      ),
    ...requiredArtifactClosureKnownSteps
      .filter((stepId) => !stepById.has(stepId))
      .map((stepId) => `required artifact closure references unknown step ${stepId}`),
    ...[
      'position-legal-visible-coverage',
      'dash-terminal-and-join-continuity',
      'same-paint-single-composite-projection',
      'hit-export-parity'
    ]
      .filter(
        (requirementId) =>
          !requiredArtifactClosureContract.closureRequirements.some(
            (requirement) => requirement.id === requirementId
          )
      )
      .map(
        (requirementId) =>
          `required artifact closure missing requirement ${requirementId}`
      )
  ].filter(Boolean)
  const pipelineArtifactDataClassIds =
    strokePipelineArtifactDataContract.artifactClasses.map(
      (artifactClass) => artifactClass.id
    )
  const pipelineArtifactDataContractErrors = [
    strokePipelineArtifactDataContract.specAnchor.endsWith(
      '#spec-to-enforcement-contract'
    )
      ? null
      : 'pipeline artifact data contract must reference Spec-To-Enforcement Contract',
    strokePipelineArtifactDataContract.governingPrinciples.some((principle) =>
      principle.includes('Classify every cross-step value')
    )
      ? null
      : 'pipeline artifact data contract must require cross-step value classification before implementation',
    strokePipelineArtifactDataContract.governingPrinciples.some((principle) =>
      principle.includes('Downstream recomputation is allowed only for pure summaries')
    )
      ? null
      : 'pipeline artifact data contract must limit downstream recomputation to pure summaries',
    strokePipelineArtifactDataContract.nonRecomputableDimensions.includes(
      'product geometry'
    )
      ? null
      : 'pipeline artifact data contract must mark product geometry non-recomputable downstream',
    strokePipelineArtifactDataContract.nonRecomputableDimensions.includes(
      'same-paint compositing semantics'
    )
      ? null
      : 'pipeline artifact data contract must mark same-paint compositing semantics non-recomputable downstream',
    strokePipelineArtifactDataContract.forbiddenBehaviors.includes(
      'using diagnostics or visual probes as visible product input'
    )
      ? null
      : 'pipeline artifact data contract must forbid diagnostic promotion to visible product input',
    ...strokePipelineArtifactDataContract.requiredClassIds
      .filter((classId) => !pipelineArtifactDataClassIds.includes(classId))
      .map((classId) => `pipeline artifact data contract missing ${classId}`),
    ...strokePipelineArtifactDataContract.artifactClasses
      .filter(
        (artifactClass) =>
          artifactClass.id !== 'recomputable-derived-summary' &&
          artifactClass.id !== 'optional-diagnostic-artifact' &&
          artifactClass.mayBeRecomputedDownstream
      )
      .map(
        (artifactClass) =>
          `pipeline artifact data contract allows downstream recomputation for ${artifactClass.id}`
      ),
    ...strokePipelineArtifactDataContract.artifactClasses
      .filter(
        (artifactClass) =>
          artifactClass.id === 'optional-diagnostic-artifact' &&
          artifactClass.mayPaint
      )
      .map(
        (artifactClass) =>
          `pipeline artifact data contract allows optional diagnostic paint for ${artifactClass.id}`
      )
  ].filter(Boolean)
  const allowedStepResponsibilityClassifications = [
    'primary-computation',
    'state-overlay',
    'channel-projection',
    'validation/evidence-only'
  ]
  const stepResponsibilityEntries = Object.values(stepResponsibilityMatrix)
  const stepResponsibilityMatrixErrors = [
    ...steps
      .map((step) => step.id)
      .filter((stepId) => !stepResponsibilityMatrix[stepId])
      .map((stepId) => `step responsibility matrix missing ${stepId}`),
    ...stepResponsibilityEntries
      .filter((entry) => !stepById.has(entry.stepId))
      .map((entry) => `step responsibility matrix references unknown step ${entry.stepId}`),
    ...stepResponsibilityEntries
      .filter(
        (entry) =>
          !allowedStepResponsibilityClassifications.includes(
            entry.classification
          )
      )
      .map(
        (entry) =>
          `${entry.stepId} has invalid responsibility classification ${entry.classification}`
      ),
    ...stepResponsibilityEntries
      .filter((entry) => stepResponsibilityMatrix[entry.stepId] !== entry)
      .map((entry) => `${entry.stepId} responsibility matrix key mismatch`),
    ...stepResponsibilityEntries
      .filter(
        (entry) => !wholeFlowReviewRequiredSegmentIds.includes(entry.reviewSegment)
      )
      .map(
        (entry) =>
          `${entry.stepId} responsibility matrix references unknown review segment ${entry.reviewSegment}`
      ),
    ...stepResponsibilityEntries
      .filter(
        (entry) =>
          !Array.isArray(entry.allowedActions) ||
          entry.allowedActions.length === 0
      )
      .map((entry) => `${entry.stepId} responsibility matrix lacks allowedActions`),
    ...stepResponsibilityEntries
      .filter(
        (entry) =>
          !Array.isArray(entry.forbiddenActions) ||
          !entry.forbiddenActions.some((action) => action.includes('recompute'))
      )
      .map(
        (entry) =>
          `${entry.stepId} responsibility matrix must forbid late recompute`
      ),
    stepResponsibilityMatrix['runtime-diagnostics']
      ? 'runtime-diagnostics must not be classified as an inspector step'
      : null,
    allowedStepResponsibilityClassifications.every((classification) =>
      stepResponsibilityEntries.some(
        (entry) => entry.classification === classification
      )
    )
      ? null
      : 'step responsibility matrix must use every supported classification'
  ].filter(Boolean)
  const requiredCrossStepArtifactLifecycleIds = [
    'artifact:stroke-domain-plan',
    'artifact:dash-product-interval',
    'artifact:dash-body-seam-boundary',
    'artifact:source-vertex-join-miter-evidence',
    'artifact:constrained-dashed-source-vertex-join-product',
    'artifact:constrained-dashed-join-owned-terminal-body-product',
    'artifact:postLegalityProductUnits',
    'artifact:finalFaces',
    'artifact:renderEntries',
    'artifact:hit-export-packets'
  ]
  const crossStepArtifactLifecycleEntries = Object.values(
    crossStepArtifactLifecycleMatrix
  )
  const crossStepArtifactLifecycleErrors = [
    ...requiredCrossStepArtifactLifecycleIds
      .filter((artifactId) => !crossStepArtifactLifecycleMatrix[artifactId])
      .map((artifactId) => `cross-step artifact lifecycle missing ${artifactId}`),
    ...crossStepArtifactLifecycleEntries
      .filter((entry) => !artifactById.has(entry.id))
      .map((entry) => `cross-step artifact lifecycle references unknown artifact ${entry.id}`),
    ...crossStepArtifactLifecycleEntries
      .filter((entry) => !pipelineArtifactDataClassIds.includes(entry.artifactClassId))
      .map(
        (entry) =>
          `${entry.id} references unknown artifact class ${entry.artifactClassId}`
      ),
    ...crossStepArtifactLifecycleEntries
      .filter((entry) => !stepById.has(entry.computedAt))
      .map((entry) => `${entry.id} computedAt unknown step ${entry.computedAt}`),
    ...crossStepArtifactLifecycleEntries
      .filter((entry) => !stepById.has(entry.mustNotRecomputeAfter))
      .map(
        (entry) =>
          `${entry.id} mustNotRecomputeAfter unknown step ${entry.mustNotRecomputeAfter}`
      ),
    ...crossStepArtifactLifecycleEntries.flatMap((entry) =>
      [...entry.preserveThrough, ...entry.consumedBy]
        .filter((stepId) => !stepById.has(stepId))
        .map((stepId) => `${entry.id} lifecycle references unknown step ${stepId}`)
    ),
    ...crossStepArtifactLifecycleEntries
      .filter(
        (entry) =>
          entry.downstreamAuthority &&
          entry.artifactClassId === 'recomputable-derived-summary'
      )
      .map((entry) => `${entry.id} cannot be downstream authority and recomputable`),
    ...crossStepArtifactLifecycleEntries
      .filter(
        (entry) =>
          !Array.isArray(entry.mayDropOnlyWhen) ||
          entry.mayDropOnlyWhen.length === 0 ||
          !Array.isArray(entry.dropEvidenceRequired) ||
          entry.dropEvidenceRequired.length === 0
      )
      .map((entry) => `${entry.id} lifecycle must declare drop rules and evidence`),
    crossStepArtifactLifecycleMatrix['artifact:runtime-diagnostics']
      ? 'runtime diagnostics must not appear in cross-step product lifecycle matrix'
      : null
  ].filter(Boolean)
  const dashJoinSeamLifecycleErrors = [
    ...validateLifecycleContract(dashJoinSeamLifecycleContract),
    dashJoinSeamLifecycleContract.specAnchor.endsWith(
      '#dash-body-and-join-seam-contract'
    )
      ? null
      : 'dash/join seam lifecycle must reference dash-body-and-join-seam-contract',
    dashJoinSeamLifecycleContract.lifecycle.some(
      (phase) =>
        phase.phase === 'consume-seam-boundary' &&
        (phase.requiredEvidence ?? []).includes(
          'dash/join zero-gap adjacency proof'
        )
    )
      ? null
      : 'dash/join seam lifecycle must require zero-gap adjacency proof at the seam-boundary consumer gate',
    dashJoinSeamLifecycleContract.lifecycle.some(
      (phase) =>
        phase.phase === 'forbid-renderer-recompute' &&
        (phase.forbiddenLateComputation ?? []).includes(
          'dash/join seam endpoint reinterpretation'
        )
    )
      ? null
      : 'dash/join seam lifecycle must forbid renderer seam endpoint reinterpretation',
    ...[
      'prepare-seam-boundary-evidence',
      'produce-seam-boundary',
      'dispatch-seam-boundary',
      'consume-seam-boundary',
      'preserve-through-legality',
      'preserve-through-final-faces',
      'preserve-through-render-entries',
      'forbid-renderer-recompute'
    ]
      .filter((phaseId) => !dashJoinSeamLifecyclePhaseIds.has(phaseId))
      .map((phaseId) => `dash/join seam lifecycle missing ${phaseId}`)
  ].filter(Boolean)
  const descriptorMaterializationRoute = routeById.get(
    'constrained-dashed-descriptor-materialization'
  )
  const descriptorRenderRoutes = [
    'constrained-dashed-inside-mask-descriptor',
    'constrained-dashed-outside-source-domain-descriptor',
    'constrained-dashed-outside-aggregate-descriptor'
  ].map((id) => routeById.get(id))
  const descriptorPathOrderingErrors = [
    descriptorMaterializationRoute?.from === 'build-final-faces'
      ? null
      : 'constrained-dashed-descriptor-materialization must consume build-final-faces',
    descriptorMaterializationRoute?.to ===
    'materialize-stroke-product-descriptors'
      ? null
      : 'constrained-dashed-descriptor-materialization must target materialize-stroke-product-descriptors',
    descriptorMaterializationRoute?.produces?.includes(
      'artifact:constrained-dashed-render-descriptor'
    )
      ? null
      : 'descriptor materialization must produce constrained-dashed-render-descriptor',
    descriptorMaterializationRoute?.produces?.includes('artifact:finalFaces')
      ? 'descriptor materialization must not produce finalFaces'
      : null,
    ...descriptorRenderRoutes.flatMap((route) =>
      [
        route ? null : 'descriptor render route missing',
        route?.from === 'materialize-stroke-product-descriptors'
          ? null
          : `${route?.id ?? 'unknown descriptor route'} must start from materialize-stroke-product-descriptors`,
        route?.consumes?.includes(
          'artifact:constrained-dashed-render-descriptor'
        )
          ? null
          : `${route?.id ?? 'unknown descriptor route'} must consume constrained-dashed-render-descriptor`,
        route?.produces?.includes('artifact:renderEntries')
          ? null
          : `${route?.id ?? 'unknown descriptor route'} must produce renderEntries`
      ].filter(Boolean)
    ),
    routeById.get('canonical-final-face-render-entry')?.from ===
    'build-final-faces'
      ? null
      : 'canonical-final-face-render-entry must start from build-final-faces',
    routeById
      .get('canonical-final-face-render-entry')
      ?.produces?.includes('artifact:renderEntries')
      ? null
      : 'canonical-final-face-render-entry must produce renderEntries',
    routeById.get('descriptor-strategy-canonical-output-else')?.from ===
    'select-stroke-descriptor-strategy'
      ? null
      : 'descriptor-strategy-canonical-output-else must start from select-stroke-descriptor-strategy',
    routeById.get('descriptor-strategy-canonical-output-else')?.to ===
    'apply-legality'
      ? null
      : 'descriptor strategy else route must proceed to apply-legality'
  ].filter(Boolean)
  const retiredProductRouteErrors = conditionalRoutes.flatMap((route) =>
    [
      route.from === retiredSingleProductStepId ||
      route.to === retiredSingleProductStepId
        ? `${route.id} still references retired ${retiredSingleProductStepId}`
        : null,
      String(route.exclusiveGroup).includes(retiredSingleProductGroupId) ||
      String(route.decisionGroup).includes(retiredSingleProductStepId)
        ? `${route.id} still uses retired single-product route grouping`
        : null
    ].filter(Boolean)
  )
  const paintOnlyRoute = conditionalRoutes.find(
    (route) => route.id === 'paint-only-cache-retint'
  )
  const paintOnlyRouteErrors = [
    paintOnlyRoute ? null : 'paint-only-cache-retint route missing',
    paintOnlyRoute?.routeType === 'bypass'
      ? null
      : 'paint-only-cache-retint must be a bypass route',
    paintOnlyRoute?.skipSteps?.includes('select-stroke-product-family') &&
    paintOnlyRoute?.skipSteps?.includes('build-source-vertex-join-products') &&
    paintOnlyRoute?.skipSteps?.includes('resolve-stroke-domains') &&
    paintOnlyRoute?.skipSteps?.includes('allocate-dash-intervals')
      ? null
      : 'paint-only-cache-retint must skip geometry, domain, and dash stages'
  ].filter(Boolean)
  const cacheHitRoute = conditionalRoutes.find(
    (route) => route.id === 'verified-product-descriptor-cache-hit'
  )
  const cacheHitRouteErrors = [
    cacheHitRoute
      ? null
      : 'verified-product-descriptor-cache-hit route missing',
    cacheHitRoute?.cacheKeyInputs?.includes('join/miter signature') &&
    cacheHitRoute?.cacheKeyInputs?.includes('legal-side signature') &&
    cacheHitRoute?.cacheKeyInputs?.includes('output channel')
      ? null
      : 'verified-product-descriptor-cache-hit missing full semantic cache key inputs'
  ].filter(Boolean)
  const sourceDragRoute = conditionalRoutes.find(
    (route) => route.id === 'source-drag-dirty-classification'
  )
  const sourceDragRouteErrors = [
    sourceDragRoute ? null : 'source-drag-dirty-classification route missing',
    sourceDragRoute?.forbiddenContributors?.includes(
      'static stroke parameter dirtying'
    )
      ? null
      : 'source-drag-dirty-classification must forbid static stroke parameter dirtying'
  ].filter(Boolean)
  const sourceFileOwnershipClassifications = new Set([
    'owner-entry',
    'shared-helper',
    'diagnostics-only',
    'app-integration',
    'dead-residue'
  ])
  const sourceFileOwnershipRecordByPath = new Map()
  const sourceFileOwnershipErrors = [
    ...sourceFileOwnershipRecords.flatMap((record) => {
      const errors = []
      const recordLabel =
        record.filePath ?? 'unnamed source file ownership record'
      if (!record.filePath) {
        errors.push(`${recordLabel} missing filePath`)
      }
      if (sourceFileOwnershipRecordByPath.has(record.filePath)) {
        errors.push(`${record.filePath} has duplicate source ownership records`)
      }
      sourceFileOwnershipRecordByPath.set(record.filePath, record)
      if (!sourceFileOwnershipClassifications.has(record.classification)) {
        errors.push(
          `${recordLabel} has unknown classification ${record.classification}`
        )
      }
      if (record.classification === 'dead-residue') {
        if (record.ownerStepId !== null) {
          errors.push(
            `${recordLabel} dead residue must not declare ownerStepId`
          )
        }
        if ((record.ownerRouteIds ?? []).length !== 0) {
          errors.push(
            `${recordLabel} dead residue must not declare ownerRouteIds`
          )
        }
        if ((record.currentConsumers ?? []).length !== 0) {
          errors.push(
            `${recordLabel} dead residue must have no current consumers`
          )
        }
      } else if (record.classification === 'diagnostics-only') {
        if (record.ownerStepId !== null) {
          errors.push(
            `${recordLabel} diagnostics-only file must not declare ownerStepId`
          )
        }
        if ((record.ownerRouteIds ?? []).length !== 0) {
          errors.push(
            `${recordLabel} diagnostics-only file must not declare ownerRouteIds`
          )
        }
      } else {
        if (!stepById.has(record.ownerStepId)) {
          errors.push(
            `${recordLabel} references unknown owner step ${record.ownerStepId}`
          )
        }
        if (
          !Array.isArray(record.ownerRouteIds) ||
          record.ownerRouteIds.length === 0
        ) {
          errors.push(`${recordLabel} missing ownerRouteIds`)
        }
      }
      for (const routeId of record.ownerRouteIds ?? []) {
        if (!routeById.has(routeId)) {
          errors.push(
            `${recordLabel} references unknown owner route ${routeId}`
          )
        }
      }
      if (!record.requiredInspectorField) {
        errors.push(`${recordLabel} missing requiredInspectorField`)
      }
      if (record.productionCodeChangeNeeded !== false) {
        errors.push(
          `${recordLabel} must not require production code changes in this metadata repair`
        )
      }
      return errors
    }),
    sharedStepTestHelpers.length === 0
      ? 'sharedStepTestHelpers must explicitly declare reusable step-test helpers'
      : null
  ].filter(Boolean)
  const strokeParameterIdSet = new Set(strokeParameterIds)
  const strokeParameterCoverageRoleSet = new Set(strokeParameterCoverageRoles)
  const strokeParameterCoverageStepIdSet = new Set(
    Object.keys(strokeParameterCoverageMatrix)
  )
  const productStageIdsBeforePaint = [
    'select-stroke-product-family',
    'build-center-stroke-products',
    'build-constrained-solid-products',
    'build-dash-interval-body-products',
    'derive-dash-body-seam-boundaries',
    'build-source-vertex-join-products',
    'build-terminal-body-products',
    'build-smooth-continuity-products',
    'select-stroke-descriptor-strategy',
    'apply-legality',
    'build-resolved-stroke-regions'
  ]
  const includesCoverageRole = (stepId, parameterId, role) =>
    (strokeParameterCoverageMatrix[stepId]?.[parameterId] ?? []).includes(role)
  const strokeParameterCoverageErrors = [
    ...strokeParameterIds
      .filter(
        (parameterId, index) =>
          strokeParameterIds.indexOf(parameterId) !== index
      )
      .map((parameterId) => `strokeParameterIds duplicates ${parameterId}`),
    ...strokeParameterCoverageRoles
      .filter(
        (role, index) => strokeParameterCoverageRoles.indexOf(role) !== index
      )
      .map((role) => `strokeParameterCoverageRoles duplicates ${role}`),
    ...Object.keys(strokeParameterCoverageMatrix)
      .filter((stepId) => !stepById.has(stepId))
      .map(
        (stepId) =>
          `strokeParameterCoverageMatrix references unknown step ${stepId}`
      ),
    ...steps.flatMap((step) => {
      const coverage = strokeParameterCoverageMatrix[step.id]
      if (!coverage) {
        return [`${step.id} missing stroke parameter coverage matrix entry`]
      }
      const parameterIds = Object.keys(coverage)
      return [
        ...strokeParameterIds
          .filter((parameterId) => !Array.isArray(coverage[parameterId]))
          .map(
            (parameterId) => `${step.id} missing coverage for ${parameterId}`
          ),
        ...parameterIds
          .filter((parameterId) => !strokeParameterIdSet.has(parameterId))
          .map(
            (parameterId) =>
              `${step.id} covers unknown stroke parameter ${parameterId}`
          ),
        ...parameterIds.flatMap((parameterId) => {
          const roles = coverage[parameterId]
          if (!Array.isArray(roles) || roles.length === 0) {
            return [`${step.id} ${parameterId} has no coverage role`]
          }
          return [
            ...roles
              .filter((role) => !strokeParameterCoverageRoleSet.has(role))
              .map(
                (role) =>
                  `${step.id} ${parameterId} has unknown coverage role ${role}`
              ),
            roles.includes('not-applicable') && roles.length > 1
              ? `${step.id} ${parameterId} mixes not-applicable with active roles`
              : null
          ].filter(Boolean)
        })
      ]
    }),
    ...steps
      .filter((step) => !strokeParameterCoverageStepIdSet.has(step.id))
      .map((step) => `${step.id} missing stroke parameter coverage entry`),
    strokeParameterIds.every((parameterId) =>
      includesCoverageRole('normalize-stroke-spec', parameterId, 'consume')
    )
      ? null
      : 'normalize-stroke-spec must consume every supported stroke parameter',
    strokeParameterIds.every((parameterId) =>
      includesCoverageRole('shared-geometry-model', parameterId, 'forbid')
    )
      ? null
      : 'shared-geometry-model must forbid every stroke parameter',
    strokeParameterIds.every((parameterId) =>
      includesCoverageRole('dirty-revision-graph', parameterId, 'dirty-key')
    )
      ? null
      : 'dirty-revision-graph must classify every stroke parameter through the dirty-key role',
    strokeGeometryParameterIds.every((parameterId) =>
      includesCoverageRole('stage-product-cache', parameterId, 'cache-key')
    )
      ? null
      : 'stage-product-cache must include every geometry-affecting stroke parameter in cache-key coverage',
    paintParameterIds.every((parameterId) =>
      includesCoverageRole('attach-paint-payload', parameterId, 'consume')
    )
      ? null
      : 'attach-paint-payload must consume every product paint parameter',
    strokeGeometryParameterIds.every((parameterId) =>
      includesCoverageRole('attach-paint-payload', parameterId, 'preserve')
    )
      ? null
      : 'attach-paint-payload must preserve geometry parameter provenance',
    strokeParameterIds.every((parameterId) =>
      includesCoverageRole('renderer-projection', parameterId, 'forbid')
    )
      ? null
      : 'renderer-projection must forbid every raw stroke parameter as a semantic input',
    strokeParameterIds.some(
      (parameterId) =>
        includesCoverageRole('renderer-projection', parameterId, 'consume') ||
        includesCoverageRole('renderer-projection', parameterId, 'dirty-key') ||
        includesCoverageRole('renderer-projection', parameterId, 'cache-key')
    )
      ? 'renderer-projection must not consume, dirty, or cache raw stroke parameters'
      : null,
    joinParameterIds.every((parameterId) =>
      includesCoverageRole(
        'build-source-vertex-join-products',
        parameterId,
        'consume'
      )
    )
      ? null
      : 'build-source-vertex-join-products must consume authored join and miter parameters',
    joinParameterIds.every((parameterId) =>
      includesCoverageRole(
        'build-smooth-continuity-products',
        parameterId,
        'forbid'
      )
    )
      ? null
      : 'build-smooth-continuity-products must forbid join/miter product ownership',
    ...productStageIdsBeforePaint.flatMap((stepId) =>
      paintParameterIds
        .filter((parameterId) =>
          includesCoverageRole(stepId, parameterId, 'consume')
        )
        .map(
          (parameterId) =>
            `${stepId} must not consume paint parameter ${parameterId} before attach-paint-payload`
        )
    )
  ].filter(Boolean)
  const inspectorContractErrors = [
    ...stepContractErrors,
    ...routeContractErrors,
    ...refactorLockErrors,
    ...entryBoundaryErrors,
    ...refactorProtocolErrors,
    ...wholeFlowReviewErrors,
    ...runtimeImplementationErrors,
    ...strokeParameterCoverageErrors,
    ...routeTypeErrors,
    ...routeElsePriorityErrors,
    ...routeTypedFieldErrors,
    ...routeConditionSchemaErrors,
    ...productPredicateErrors,
    ...decisionGroupErrors,
    ...parallelRouteErrors,
    ...coExecutionCompletionRuleErrors,
    ...bypassReachabilityErrors,
    ...artifactRegistryErrors,
    ...splitProductStepErrors,
    ...edgeDriftErrors,
    ...ruleRegistryErrors,
    ...stepRuleRefErrors,
    ...verificationEvidenceErrors,
    ...hitExportDependencyErrors,
    ...miterFieldErrors,
    ...specRuleRefErrors,
    ...metricAssertionErrors,
    ...descriptorLegalityErrors,
    ...requiredArtifactClosureErrors,
    ...pipelineArtifactDataContractErrors,
    ...stepResponsibilityMatrixErrors,
    ...crossStepArtifactLifecycleErrors,
    ...dashJoinSeamLifecycleErrors,
    ...descriptorPathOrderingErrors,
    ...retiredProductRouteErrors,
    ...paintOnlyRouteErrors,
    ...cacheHitRouteErrors,
    ...sourceDragRouteErrors,
    ...sourceFileOwnershipErrors,
    ...sharpVertexDescriptorRouteErrors,
    ...dashedSourceVertexJoinRouteErrors,
    ...dashedSmoothContinuityRouteErrors,
    ...visibleConstructionHelperAllowanceErrors,
    ...missingRouteTargets.map((id) => `${id} references unknown step`)
  ]

  const asyraRulesByStep = Object.fromEntries(
    steps.map((step) => [step.id, step.asyraStrokeRules])
  )
  const defaultEvidenceByGroup = Object.fromEntries(
    groups.map((group) => [
      group,
      {
        relatedTests: ['pending runtime-specific probe'],
        evidenceToInspect: [
          'stroke documentation roles and current screenshots'
        ]
      }
    ])
  )
  const stepEvidenceOverrides = Object.fromEntries(
    steps.map((step) => [
      step.id,
      {
        relatedTests: step.relatedTests,
        evidenceToInspect: step.evidenceToInspect
      }
    ])
  )
  const defaultAlignmentByGroup = Object.fromEntries(
    lanes.map((lane) => [
      lane,
      {
        status: 'aligned',
        latestRule: 'Preserve the Stroke / Vector System flow for this lane.',
        currentImplementation:
          'No current mismatch is assigned to this lane during this inspector-flow sync.',
        requiredAdjustment:
          'Keep this lane aligned with canonical model commit and downstream render consumption.'
      }
    ])
  )
  const stepAlignmentOverrides = Object.fromEntries(
    steps.map((step) => [
      step.id,
      {
        status: step.alignmentStatus,
        currentImplementation: step.currentImplementation,
        requiredAdjustment: step.requiredAdjustment
      }
    ])
  )
  const stepGoalAudit = steps.map((step) => ({
    step: step.stepNumber,
    id: step.id,
    inputContract: step.inputs,
    outputContract: step.outputs,
    conditionContract: step.conditions,
    bypassContract: step.bypassConditions,
    limitationContract: step.limitations,
    ownerStage: step.ownerStage,
    allowedContributors: step.allowedContributors,
    forbiddenContributors: step.forbiddenContributors,
    evidenceRequired: step.evidenceRequired,
    failureReopensStep: step.failureReopensStep,
    asyraRuleReference: step.asyraStrokeRules,
    currentImplementationOwner: step.helpers,
    requiredInvariant:
      'Preserve the Stroke / Vector System flow: canonical model commit, downstream render consumption, and no visible diagnostic fragments or renderer-side repair.',
    currentTestCoverage: step.relatedTests,
    dodGap:
      step.alignmentStatus === 'needs-runtime-probes'
        ? 'Needs runtime probes and reviewed screenshots before closure.'
        : 'No document-authority gap identified in this cleanup.',
    status: step.alignmentStatus
  }))

  const strokeFlowInspectorData = {
    groups,
    lanes,
    latestRules,
    ruleRegistry,
    currentExecutionState,
    runtimeImplementationState,
    finalValidationMethods,
    optionalDiagnosticChannels,
    refactorProtocol,
    documentDeepAuditProtocol,
    wholeFlowReviewContract,
    requiredArtifactClosureContract,
    strokePipelineArtifactDataContract,
    dashJoinSeamLifecycleContract,
    stepResponsibilityMatrix,
    crossStepArtifactLifecycleMatrix,
    sharedStepTestHelpers,
    sourceFileOwnershipRecords,
    entryBoundaryRequiredStepIds,
    strokeParameterIds,
    strokeParameterCoverageRoles,
    strokeParameterCoverageMatrix,
    canonicalVisualReviewContract,
    dragPerformanceContract,
    continuousParameterPerformanceContract,
    focusedTestExecutionContract,
    edgeCaseDomainContract,
    strokeCompletionMatrix,
    stepGoalAudit,
    asyraRulesByStep,
    alignmentLabels,
    steps,
    edges,
    routeTypes,
    conditionalRoutes,
    artifactRegistry,
    coExecutionCompletionRules,
    nestedRoutesByStep,
    evidenceRequiredByRoute,
    stepContractErrors,
    routeContractErrors,
    refactorLockErrors,
    entryBoundaryErrors,
    refactorProtocolErrors,
    wholeFlowReviewErrors,
    runtimeImplementationErrors,
    strokeParameterCoverageErrors,
    requiredArtifactClosureErrors,
    pipelineArtifactDataContractErrors,
    stepResponsibilityMatrixErrors,
    crossStepArtifactLifecycleErrors,
    dashJoinSeamLifecycleErrors,
    sourceFileOwnershipErrors,
    inspectorContractErrors,
    defaultEvidenceByGroup,
    stepEvidenceOverrides,
    defaultAlignmentByGroup,
    stepAlignmentOverrides
  }

  const inspectorGlobalTarget =
    typeof globalThis === 'undefined' ? undefined : globalThis

  if (inspectorGlobalTarget) {
    inspectorGlobalTarget.STROKE_FLOW_INSPECTOR_DATA = strokeFlowInspectorData

    const legacyWindowTarget = inspectorGlobalTarget.window
    if (
      legacyWindowTarget &&
      typeof legacyWindowTarget === 'object' &&
      legacyWindowTarget !== inspectorGlobalTarget
    ) {
      legacyWindowTarget.STROKE_FLOW_INSPECTOR_DATA = strokeFlowInspectorData
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = strokeFlowInspectorData
  }
})()
