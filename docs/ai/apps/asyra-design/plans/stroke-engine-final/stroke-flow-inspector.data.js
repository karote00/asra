/* global window */
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
    'Only PLANS.md, this data file, and the stroke-engine README define current stroke/vector system rules. Viewer HTML is a shell only.',
    'This board is the Stroke / Vector System Inspector Flow: it covers feature intent, model commit, data channel, render mirror, stroke geometry, product output, and diagnostics.',
    'Features express explicit user intent only. They must not directly write render store state or depend on renderer-local repair.',
    'Vector common APIs and domain adapters own point/handle drag and structural vector operations. They emit canonical workspace/world computed patches.',
    'One intended user action maps to one intended undo commit. Drag updates remain non-undoable; final drag and structural operations are undoable.',
    'Scene-tree and data-channel publish computed patch updates with changed scalar values and record ids. They must not force unrelated full-topology rewrites.',
    'Render is a downstream consumer. Render mirror/cache applies committed patches exactly once and derives render data from committed state.',
    'Stroke geometry stages consume normalized render data only; they must not depend on feature-local state, undo payload cleanup, or direct app-to-render synchronization.',
    'Stroke invalidation is stage-based. Source path/topology, stroke family, stroke domain, dash schedule, terminal cap, join/miter shape, paint, and render output use separate internal revisions.',
    'Stroke paint model data is canonicalized as stroke.fill using the same FillAttrs format as element fills. Stroke root paint fields such as color, opacity, visible, kind, colorFormat, defaultColorFormat, and gradient are load-boundary normalization input only and must not be written back.',
    'A stroke.fill-only change dirties paint and render output only. It must not trigger vector bounds repair, source topology rebuild, domain rebuild, dash schedule rebuild, terminal cap rebuild, or join rebuild.',
    'Static stroke parameter changes dirty only the stages they affect; vector drag dirties source path data without mutating static stroke parameter or paint revisions.',
    'Stroke performance diagnostics must expose stage dirty counters such as paint-only update and drag source-path-with-static-stroke.',
    'Dirty classification must feed a real stroke stage product cache. Reusable semantic product descriptors may be stored by element, network, stroke, source revision, and geometry-affecting stroke signature, then retinted for paint-only changes.',
    'Static stroke parameter switches must report stage cache hit, miss, store, and hidden-output counters so inspector review can distinguish geometry rebuilds from product descriptor reuse.',
    'Center solid visible render is the authored center stroke. Self-intersecting center solid vectors may use authored stroke path descriptors while preserving strokeJoin, strokeCap, and strokeMiterLimit; renderer path projection is allowed only when alpha-safe, while translucent self-intersections require single-composite descriptor output.',
    'Diagnostics for translucent self-intersecting center solid strokes must include same-paint alpha-overlap probes at self-crossings; global red coverage alone is insufficient.',
    'Constrained solid visible render uses the Asyra doubled authored center-stroke mask model: build the authored center stroke at twice the requested stroke width, apply strokeJoin and strokeMiterLimit there, then clip by the inside filled-region mask or outside exterior mask.',
    'Self-intersecting inside solid visible pixels must come from the doubled authored center stroke clipped by a face, winding, and adjacency-aware filled-region mask.',
    'Grouped render descriptors may encode the adjacency-aware mask only as authored centerline stroke paths with explicit clip groups; they must not expose face strips, helper polygons, or derivation fragments as visible product geometry.',
    'Internal shared edges reveal half of the requested stroke width from each adjacent filled face; the combined visible width along the shared edge must not become two independent full-width strips.',
    'All five internal pentagon corners are join-sensitive and must vary with strokeJoin and strokeMiterLimit.',
    'Derivation fragments, face strips, helper polygons, coverage probes, and diagnostics can prove legality, hit/export, or failure modes, but they must not become product-visible solid stroke geometry.',
    'Dashed constrained strokes remain interval-domain based. Dash intervals, terminal half-dashes, and caps must stay separate from solid visible geometry.',
    'Split-range dash allocation is cap-aware: round and square caps extend the painted footprint, so the allocator must avoid producing many dash groups whose visual gaps after caps are much smaller than the configured gap. The current floor is configuredGap * 0.6 after cap footprint; short cap-aware ranges may collapse into one start-end dash.',
    'Terminal dash cap ownership is first-class: middle intervals own authored caps on both ends, start intervals suppress the start endpoint cap and only cap the body-side end, end intervals only cap the body-side start, and start-end intervals suppress both endpoint caps. Static render, drag render, product output entries, and hit/export materialization must all consume this same endpoint policy.',
    'Terminal cap ownership does not replace join ownership. True dangling/open endpoints forbid endpoint-side caps; contour corners, authored vertices, and self-intersection split terminals must suppress endpoint-side dash caps while still materializing the authored join footprint.',
    'Curve dash smoothness is a top-level product rule. A visible dash on a Bezier or high-curvature span must be one continuous smooth footprint; sampling seams, radial slices, disconnected strips, and comb-like gaps inside one dash are product failures.',
    'Open center dashed allocation is continuous-network based: the two true open network endpoints own half-dash terminals, middle dashes keep authored length, segment boundaries do not reset phase, and cap-aware visual gaps use the same configuredGap * 0.6 readability floor.',
    'Open authored dashed inside/outside strokes use the formal unbounded open center product only when no bounded filled-region domain exists. Open self-intersecting networks with bounded filled regions formed by real authored source segments use constrained dashed products with position-specific ownership: inside paints only filled-contour source spans and excludes dangling open branches, while outside paints exterior contour spans and renders dangling open-branch spans on both sides of the source path with a visible normal span near stroke.width * 2. Each independent constrained source span owns its own half-terminal dash allocation; continuous open-network dash phase must not carry across those spans. No invisible closing edge may be added for domain, dash, hit-test, export, or product output.',
    'Stroke domain plan is the single product routing entry point for open/closed semantics. Vector render code and packet builders must not independently map open constrained strokes to center; they consume domain modes such as center-product, closed-constrained-domain, open-contour-constrained-domain, open-dangling-outside-both-sides, and inside-excluded-open-span.',
    'Center dashed visible render is the authored center dashed stroke. Descriptor output is an exact encoding of the same product builder and must not introduce a drag-specific geometry rule.',
    'Constrained dashed render has one product pipeline for static render, drag, descriptor output, render entries, hit/export, cap switches, reload, and pan. It consumes StrokeDomainPlan, emits DashProductInterval records, and materializes body, endpoint cap policy, join ownership, and smooth continuity groups once.',
    'Constrained inside descriptors clip the materialized body/cap/join product by the inside filled-region domain. Constrained outside descriptors clip the materialized body/cap/join product by the exterior domain, while open dangling outside spans are explicit both-side source-span domains.',
    'Descriptor output is only a renderer-ready encoding of DashProductInterval materialization. It must express one-sided terminal cap suppression with explicit cap/join footprints and endpoint policy metadata; downstream render code must not infer or re-add endpoint caps.',
    'Resolved split/domain metadata is a shared product-builder input. Visible product output must not retrace the whole source path, recompute source intersections inside render, or switch to a drag-specific geometry path.',
    'Product output may emit render, hit, export, and diagnostic descriptors, but visible render must not use diagnostic/helper geometry as product output.',
    'The 2026-06-21 stroke architecture closure passed static guards, product contract suites, app e2e, performance gates, and reviewed screenshots. Future pixel bugs must stay on the closed product pipeline.',
    'Captured Asyra rule mismatches reopen the earliest owning inspector step. Implementation must not add new local rules before all three authority files are updated.'
  ]

  const currentExecutionState = {
    totalSteps: 34,
    planStatus: 'completed',
    nextExecutableStepId: 'complete',
    nextExecutableStepNumber: 34,
    nextExecutableStepStatus: 'architecture-closure-complete',
    stopRule:
      'Future stroke changes must keep active docs, product implementation, tests, performance gates, and app visual review on the single stroke product pipeline.',
    requiredImplementationSequence: [
      'Keep the three authority files synchronized before runtime implementation changes are claimed.',
      'Interaction must express intent only and never synchronize render state directly.',
      'Model Commit must build canonical workspace/world computed patches inside one transaction boundary.',
      'Data Channel must publish changed values and record ids without unrelated full-topology rewrites.',
      'Render Mirror must apply each committed patch once and derive render data downstream.',
      'Stroke Geometry must consume normalized render data, route through StrokeDomainPlan, and materialize body/cap/join/smooth product output from the formal product contract only.',
      'Stage product cache must preserve exact semantic descriptors and must not make diagnostic/export polygon evidence a normal visible-render prerequisite.',
      'Stroke paint updates must flow as computed.strokes[n].fill changes and be consumed as render-side paint-only updates.',
      'Product Output and Diagnostics must pass rule-driven probes and reviewed screenshots before completion claims.'
    ],
    currentCompletionEvidence: [
      '2026-05-31: document authority cleanup removed stale stroke rule files.',
      '2026-05-31: focused numeric probes alone were proven insufficient and the e2e fragment gate was tightened.',
      '2026-05-31: reported inside-solid slice passed focused probes, full e2e file, build, lint, and manual screenshot review.',
      '2026-06-06: point/handle drag and structural vector operations were refactored to framework-aligned computed patch flow with model/render/undo invariants passing.',
      '2026-06-07: stroke dirty matrix gained parameter-specific revision counters; stage cache validation is active for static parameter switches and drag.',
      '2026-06-08: center, inside, and outside dashed drag frames use exact visible descriptors with canonical/e2e/visual review passing and the full drag 120fps gate passing.',
      '2026-06-09: open center dashed allocation moved to continuous-network half-terminal rules with cap-aware gap floor; focused unit and visual gates cover open line, polyline, curve, and multi-network cases.',
      '2026-06-21: constrained dashed and solid product output closed on the single StrokeDomainPlan product pipeline.',
      '2026-06-21: static route guards, product contract suites, preset build, React build, app e2e, performance gates, and manual screenshot review passed for architecture closure.'
    ],
    currentSolidMaskModelSliceEvidence: [
      {
        id: 'self-intersecting-inside-solid-slice-passed',
        command:
          'yarn workspace @asyra/preset vitest run src/__tests__/constrained-solid-stroke-packets-self-intersecting-mask.test.ts --reporter=verbose',
        currentResult:
          'focused probes pass; full app e2e and manual visual review pass for the reported inside-solid slice',
        evidence: [
          'render-visible shared-edge probe rejects full filled-region clipping and passes with the grouped adjacency-aware inside render descriptor',
          'join matrix keeps inside miter, bevel, and round on authored doubled source stroke',
          'manual app screenshots no longer show fragmented internal pentagon output',
          'visual gate requires global, adjacency, central face, and all five internal corner screenshots before any slice can pass'
        ]
      }
    ],
    blockedDownstreamStepIds: []
  }

  const strokeCompletionMatrix = [
    {
      row: 'framework-aligned-vector-operations',
      requiredEvidence:
        'Feature code sends explicit point/handle or structural operation intent; common APIs produce canonical workspace/world computed patches; one action creates one undo commit; render consumes downstream state only.',
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
        'Doubled authored center stroke clipped by a face, winding, and adjacency-aware inside filled-region mask; internal shared edges reveal half width from each adjacent filled face; all five internal pentagon corners vary with strokeJoin and strokeMiterLimit; visible render contains no derivation fragments.',
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
        'Doubled authored center stroke clipped by exterior mask with no visible bridge or cut seams.',
      status:
        'architecture closed: outside solid remains on the doubled authored center-stroke product contract and is covered by the product matrix'
    },
    {
      row: 'dashed-constrained-strokes',
      requiredEvidence:
        'Interval-domain dash allocation, terminal half-dashes, cap behavior, and provenance remain separate from solid visible geometry; closed constrained inside/outside dashed visible product geometry is doubled authored center-dashed stroke clipped by the selected legal-domain mask, encoded as exact final faces or a grouped descriptor only when terminal endpoint cap policy does not require one-sided cap ownership. Open self-intersecting networks with bounded filled regions from real authored source segments are constrained dashed products: inside keeps only filled-contour source spans, outside keeps exterior contour spans plus dangling open-branch spans materialized on both sides of the source path, each independent constrained span owns its own half-terminal dash allocation, and no synthesized closing edge may become domain evidence or product stroke output. Cap-aware allocation must keep visual gaps legible after round/square cap footprint or collapse short ranges into one start-end dash.',
      status:
        'architecture closed: center/inside/outside dashed static, drag, cap switch, reload, render entry, hit/export, and visual review consume the same product interval and descriptor contract'
    },
    {
      row: 'cross-cutting-render-hit-export-diagnostics',
      requiredEvidence:
        'Render consumes visible descriptors, hit/export may consume non-visible coverage evidence, diagnostics remain opt-in and non-visible.',
      status:
        'architecture closed: render, hit, export, diagnostics, performance gates, and reviewed screenshots are separate evidence paths over the same semantic product descriptors'
    }
  ]

  const alignmentLabels = {
    aligned: 'Aligned',
    'stage-cache-validation-active': 'Stage cache validation active',
    'architecture-closed': 'Architecture closed',
    'focused-inside-solid-rule-review-passed': 'Superseded focused-pass claim',
    'not-current-owner': 'Not current owner'
  }

  const authorityRefs = [
    'docs/ai/apps/asyra-design/PLANS.md',
    'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md',
    'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js'
  ]

  const genericAcceptance = [
    'Authority files state the same rule.',
    'No visible stroke rule is added outside the three authority files.',
    'Runtime changes must prove render, hit, export, diagnostics, and visual correctness separately.',
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
      'Allocate dashed intervals only where the dash model owns placement; open center dashed allocates at continuous-network level with endpoint half terminals, while constrained split ranges preserve terminal semantics and avoid cap-compressed visual gaps.'
    ],
    [
      'build-stroke-product-units',
      'Stroke Geometry',
      4,
      'Build stroke product units',
      'Build model-specific product units: authored center stroke descriptors for center strokes, interval product units for dashed allocation, and domain-plan product units for constrained inside/outside dashed visible geometry.'
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
    ],
    [
      'runtime-diagnostics',
      'Diagnostics',
      8,
      'Runtime diagnostics',
      'Expose bounded diagnostics only through explicit diagnostics mode.'
    ],
    [
      'visible-final-result',
      'Diagnostics',
      8,
      'Visible final result',
      'Gate final visible correctness through probes and screenshot review.'
    ]
  ]

  const stepOverrides = {
    'feature-session-intent': {
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
      latestRule:
        'Point/handle drag updates are non-undoable; final drag commits a canonical computed patch.',
      inputs: ['point id', 'target kind', 'workspace position'],
      outputs: ['point/handle computed patch intent'],
      currentImplementation:
        'Point/handle drag uses framework computed patch events and keeps model/render/overlay aligned.',
      requiredAdjustment:
        'Do not rebuild unrelated points or delay correctness until mouseup.',
      relatedTests: [
        'apps/asyra-design/e2e/undo-redo.spec.ts',
        'packages/preset/src/__tests__/vector-path-editing-render-layer.test.ts'
      ],
      tags: ['framework-aligned', 'critical']
    },
    'structural-vector-operation': {
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
      latestRule:
        'App common APIs are the domain boundary that converts intent into canonical model writes.',
      inputs: ['explicit vector operation intent'],
      outputs: ['validated computed patch request'],
      currentImplementation:
        'Vector common APIs own operation adapters; feature code does not directly mutate render state.',
      requiredAdjustment:
        'Do not introduce stroke/vector mutation branches outside the common API boundary.',
      relatedTests: [
        'apps/asyra-design/e2e/vector-render-invariants.spec.ts',
        'packages/preset/src/__tests__/vector-path-editing-render-layer.test.ts'
      ],
      tags: ['framework-aligned', 'critical']
    },
    'canonical-workspace-data': {
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
    'computed-patch-builder': {
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
      latestRule: 'One intended user action maps to one intended undo unit.',
      inputs: ['computed patch request', 'selection/hover cleanup intent'],
      outputs: ['one transaction', 'one undoable final commit when requested'],
      currentImplementation:
        'Structural operation cleanup and computed patch writes are wrapped in the same common API transaction.',
      requiredAdjustment:
        'Do not split one operation across multiple undoable transactions.',
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
      tags: ['framework-aligned']
    },
    'computed-patch-event': {
      latestRule:
        'Data channel publishes computed patch updates after commit for downstream consumers.',
      inputs: ['committed scene-tree update'],
      outputs: ['computed patch reactive event'],
      currentImplementation:
        'Patch events remain the downstream render/UI synchronization contract.',
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
      tags: ['framework-aligned', 'risk']
    },
    'render-mirror-patch-apply': {
      latestRule:
        'Render mirror applies each committed patch once and never seeds after-state then applies the same patch again.',
      inputs: ['computed patch event', 'existing render mirror snapshot'],
      outputs: ['updated render mirror snapshot'],
      currentImplementation:
        'Render scene-tree store tests cover computed patch mirror updates.',
      relatedTests: ['packages/render/src/__tests__/scene-tree-store.test.ts'],
      tags: ['framework-aligned', 'critical']
    },
    'render-data-derivation': {
      latestRule:
        'Renderer-ready vector/stroke data is derived from render mirror state, not feature-local state.',
      inputs: ['render mirror snapshot'],
      outputs: ['normalized render data'],
      currentImplementation:
        'Vector render invariant tests compare model, render graphic, hover outline, and editing overlay.',
      relatedTests: ['apps/asyra-design/e2e/vector-render-invariants.spec.ts'],
      tags: ['framework-aligned', 'truth']
    },
    'dirty-revision-graph': {
      latestRule:
        'Stroke stage dirty classification is parameter-specific: source path/topology, stroke family, stroke domain, dash schedule, terminal cap, join/miter shape, paint, and render output are separate internal revisions.',
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
      currentImplementation:
        'stroke-dirty-keys maps paint-only, visibility, cap, join, width, dash, position/style, and drag source-path changes to scoped dirty stages and emits cache observability counters when a sink is installed.',
      requiredAdjustment:
        'Do not collapse all stroke parameters back into one broad strokeSpec helper; each parameter must retain its own reuse boundary.',
      relatedTests: [
        'packages/preset/src/__tests__/stroke-dirty-keys.test.ts',
        'apps/asyra-design/e2e/stroke-drag-render-performance-*.spec.ts'
      ],
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
      currentImplementation:
        'Vector render keeps a per-graphic StrokePipelineStageCache with product descriptors keyed by element, network, source revision, and stroke geometry signature. Paint-only changes retint cached final faces/render entries; style-replayable stroke-path descriptors restyle current cap/join/miter values without rebuilding descriptor geometry; visible=false clears render/hit/export output without rebuilding geometry.',
      requiredAdjustment:
        'Do not use stale cached descriptors when source revision or geometry-affecting stroke signature changes. Descriptor replay must update strokePathStyle; polygon product geometry that embeds miter shape must not use style-only replay. Diagnostics/export polygon materialization must remain lazy and separate from normal visible render.',
      relatedTests: [
        'packages/preset/src/__tests__/stroke-parameter-switch-performance.test.ts',
        'apps/asyra-design/e2e/stroke-parameter-switch-performance.spec.ts'
      ],
      tags: ['performance', 'cache', 'critical']
    },
    'shared-geometry-model': {
      latestRule:
        'Shared geometry is reused by fill, stroke, hit/export, diagnostics, and future shadow; it does not become visible solid stroke geometry by itself.',
      relatedTests: [
        'packages/preset/src/__tests__/resolved-vector-geometry-model.test.ts',
        'packages/preset/src/__tests__/vector-constrained-solid-stroke.test.ts',
        'packages/preset/src/__tests__/vector-constrained-dashed-stroke.test.ts'
      ],
      tags: ['truth', 'critical']
    },
    'build-stroke-product-units': {
      alignmentStatus: 'architecture-closed',
      latestRule:
        'Center solid and center dashed visible product units may be authored stroke path descriptors; constrained solid product units remain doubled authored center-stroke units with join and miter semantics before masking; constrained dashed product units are DashProductInterval materializations with domain evidence, terminal endpoint-cap policy, join ownership, smooth continuity groups, and descriptor output as one encoding.',
      currentImplementation:
        'Static render, drag render, render entries, hit/export, cap switches, reload, and pan must consume the same constrained dashed product builder. Open self-intersecting constrained dashed uses contour-ownership routing: inside excludes dangling branches, outside renders dangling branches as true both-side spans rather than unbounded open center output.',
      requiredAdjustment:
        'Keep center, constrained solid, and dashed product models separate; do not turn face strips or helper polygons into visible solid geometry, and do not recompute source intersections in visible product output when resolved metadata already owns them.',
      tags: ['canonical']
    },
    'apply-legality': {
      alignmentStatus: 'architecture-closed',
      latestRule:
        'Inside solid legality clips the doubled authored center stroke with a face, winding, and adjacency-aware filled-region mask.',
      currentImplementation:
        'For the reported inside-solid slice, Stroke Geometry legality supplies adjacency-aware mask evidence while visible render remains grouped authored stroke paths.',
      requiredAdjustment:
        'Internal shared edges must reveal half width from each adjacent filled face, all five internal pentagon corners must respond to strokeJoin and strokeMiterLimit, and the internal pentagon must not fragment.',
      tags: ['canonical']
    },
    'build-final-faces': {
      alignmentStatus: 'architecture-closed',
      latestRule:
        'Final records preserve visible descriptors separately from non-visible coverage evidence; center dashed and constrained dashed descriptors are product-builder output encodings, not drag-specific routes.',
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
      currentImplementation:
        'Center solid drag render uses renderer path projection only for alpha-safe cases and single-composite descriptor output for translucent self-intersections. Center dashed drag render skips visible packet/geometry rebuilds through exact authored strokePath descriptors; constrained dashed drag render consumes exact inside/outside mask descriptors so visible frames avoid per-interval product intersection while preserving the inside/outside legal-domain product rule.',
      tags: ['risk']
    },
    'renderer-projection': {
      alignmentStatus: 'architecture-closed',
      latestRule:
        'Renderer draw code must not repair geometry or infer side legality.',
      tags: ['risk']
    },
    'visible-final-result': {
      alignmentStatus: 'architecture-closed',
      latestRule:
        'Final visual review passes only when rule-driven probes and reviewed screenshots cover the current architecture closure.',
      currentImplementation:
        'Manual app screenshot review passed for canonical dashed inside, dashed source-vertex join closeups, vector6 join review, reported high-curvature crop, and drag product review artifacts.',
      requiredAdjustment:
        'Future screenshot mismatches must reopen the earliest owning inspector step and remain on the single product pipeline.',
      tags: ['visual-review']
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
    const defaultLatestRule =
      id === 'shared-geometry-model'
        ? 'Shared geometry remains the canonical evidence source for fill, stroke, hit/export, diagnostics, and future shadow.'
        : 'Preserve upstream contracts and do not invent local stroke/vector rules in this step.'
    return {
      id,
      stepNumber: index + 1,
      group,
      lane,
      row,
      title,
      summary,
      helpers: override.helpers ?? [title.replaceAll(' ', '')],
      inputs: override.inputs ?? ['upstream stage output'],
      outputs: override.outputs ?? ['downstream stage input'],
      decisions: override.decisions ?? [
        'This step follows the three authority files.',
        'Any mismatch reopens the earliest owning upstream step.'
      ],
      next: [],
      risks: override.risks ?? [
        'Stale helper behavior can reintroduce a local stroke/vector rule outside the authority files.'
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
      planReferences: authorityRefs,
      implementationTrace: override.implementationTrace ?? [
        'Trace implementation against this step before changing runtime code.'
      ],
      asyraStrokeRules: override.asyraStrokeRules ?? latestRules,
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
      relatedFiles: authorityRefs,
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
  steps.forEach((step, index) => {
    step.next = steps[index + 1] ? [steps[index + 1].id] : []
  })

  const edges = steps
    .slice(0, -1)
    .map((step, index) => [step.id, steps[index + 1].id])

  const asyraRulesByStep = Object.fromEntries(
    steps.map((step) => [step.id, step.asyraStrokeRules])
  )
  const defaultEvidenceByGroup = Object.fromEntries(
    groups.map((group) => [
      group,
      {
        relatedTests: ['pending runtime-specific probe'],
        evidenceToInspect: ['authority files and current screenshots']
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

  window.STROKE_FLOW_INSPECTOR_DATA = {
    groups,
    lanes,
    latestRules,
    currentExecutionState,
    strokeCompletionMatrix,
    stepGoalAudit,
    asyraRulesByStep,
    alignmentLabels,
    steps,
    edges,
    defaultEvidenceByGroup,
    stepEvidenceOverrides,
    defaultAlignmentByGroup,
    stepAlignmentOverrides
  }
})()
