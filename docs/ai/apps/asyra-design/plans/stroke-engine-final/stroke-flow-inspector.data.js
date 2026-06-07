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
    'One intended user action maps to one intended undo commit. Drag preview remains non-undoable; final drag and structural operations are undoable.',
    'Scene-tree and data-channel publish computed patch updates with changed scalar values and record ids. They must not force unrelated full-topology rewrites.',
    'Render is a downstream consumer. Render mirror/cache applies committed patches exactly once and derives render data from committed state.',
    'Stroke geometry stages consume normalized render data only; they must not depend on feature-local state, undo payload cleanup, or direct app-to-render synchronization.',
    'Constrained solid visible render uses the Asyra doubled authored center-stroke mask model: build the authored center stroke at twice the requested stroke width, apply strokeJoin and strokeMiterLimit there, then clip by the inside filled-region mask or outside exterior mask.',
    'Self-intersecting inside solid visible pixels must come from the doubled authored center stroke clipped by a face, winding, and adjacency-aware filled-region mask.',
    'Grouped render descriptors may encode the adjacency-aware mask only as authored centerline stroke paths with explicit clip groups; they must not expose face strips, helper polygons, or derivation fragments as visible product geometry.',
    'Internal shared edges reveal half of the requested stroke width from each adjacent filled face; the combined visible width along the shared edge must not become two independent full-width strips.',
    'All five internal pentagon corners are join-sensitive and must vary with strokeJoin and strokeMiterLimit.',
    'Derivation fragments, face strips, helper polygons, coverage probes, and diagnostics can prove legality, hit/export, or failure modes, but they must not become product-visible solid stroke geometry.',
    'Dashed constrained strokes remain interval-domain based. Dash intervals, terminal half-dashes, and caps must stay separate from solid visible geometry.',
    'Constrained inside dashed product-visible render may use one exact grouped mask descriptor: fillClipPolygons plus authored dashed strokePaths and strokePathStyle. That descriptor is the product path, not preview or helper geometry.',
    'A single exact constrained inside dashed mask descriptor for one fill domain and one stroke style may bypass same-visual overlap collapse; per-interval polygons may remain diagnostics/export evidence but must not be required for visible drag frames.',
    'Product output may emit render, hit, export, and diagnostic descriptors, but visible render must not use diagnostic/helper geometry as product output.',
    'The outside dashed square visual gate remains open at Product Output / Diagnostics until rule-driven probes and reviewed screenshots pass.',
    'Captured Asyra rule mismatches reopen the earliest owning inspector step. Implementation must not add new local rules before all three authority files are updated.'
  ]

  const currentExecutionState = {
    totalSteps: 33,
    planStatus: 'active-system-flow-visual-review-blocked',
    nextExecutableStepId: 'visible-final-result',
    nextExecutableStepNumber: 33,
    nextExecutableStepStatus: 'outside-dashed-square-visual-review-blocked',
    stopRule:
      'The framework-native vector operation flow is the baseline, but outside dashed square visual review remains open. Do not claim whole-system or whole-matrix completion until Product Output / Diagnostics pass.',
    requiredImplementationSequence: [
      'Keep the three authority files synchronized before runtime implementation changes are claimed.',
      'Interaction must express intent only and never synchronize render state directly.',
      'Model Commit must build canonical workspace/world computed patches inside one transaction boundary.',
      'Data Channel must publish changed values and record ids without unrelated full-topology rewrites.',
      'Render Mirror must apply each committed patch once and derive render data downstream.',
      'Stroke Geometry must consume normalized render data and preserve model-separated stroke semantics.',
      'Product Output and Diagnostics must pass rule-driven probes and reviewed screenshots before completion claims.'
    ],
    currentCompletionEvidence: [
      '2026-05-31: document authority cleanup removed stale stroke rule files.',
      '2026-05-31: focused numeric probes alone were proven insufficient and the e2e fragment gate was tightened.',
      '2026-05-31: reported inside-solid slice passed focused probes, full e2e file, build, lint, and manual screenshot review.',
      '2026-06-06: point/handle drag and structural vector operations were refactored to framework-native computed patch flow with model/render/undo invariants passing.',
      '2026-06-06: outside dashed square visual review still reports opposite-side probe failures and remains blocked.'
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
      row: 'framework-native-vector-operations',
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
      row: 'self-intersecting-solid-outside',
      requiredEvidence:
        'Doubled authored center stroke clipped by exterior mask with no visible bridge or cut seams.',
      status:
        'guarded: keep revalidation requirement before whole-matrix closure'
    },
    {
      row: 'dashed-constrained-strokes',
      requiredEvidence:
        'Interval-domain dash allocation, terminal half-dashes, cap behavior, and provenance remain separate from solid visible geometry; constrained inside dashed visible product geometry is doubled authored center-dashed stroke clipped by the inside filled-region mask, encoded either as exact final faces or one exact grouped mask descriptor, not one-sided ribbon fallback.',
      status:
        'inside dashed drag performance slice: exact mask descriptor path is the visible product encoding; outside dashed square remains governed by Product Output / Diagnostics before broader closure'
    },
    {
      row: 'cross-cutting-render-hit-export-diagnostics',
      requiredEvidence:
        'Render consumes visible descriptors, hit/export may consume non-visible coverage evidence, diagnostics remain opt-in and non-visible.',
      status:
        'slice passed: grouped visible descriptor is guarded by e2e pixel gates and manual screenshot review'
    }
  ]

  const alignmentLabels = {
    aligned: 'Aligned',
    guarded: 'Guarded',
    'active-system-flow-visual-review-blocked':
      'Active / system flow visual review blocked',
    'slice-visual-review-passed': 'Slice visual review passed',
    'outside-dashed-square-visual-review-blocked':
      'Outside dashed square visual review blocked',
    'reopened-rule-review-blocked': 'Reopened / rule review blocked',
    'reopened-visual-review-blocked': 'Reopened / visual review blocked',
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
    'Runtime changes must prove render, hit, export, diagnostics, and visual correctness separately.'
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
      'Represent drag preview and final drag as explicit point or handle operations.'
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
      'Classify which stroke stages must rerun.'
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
      'Normalize width, position, cap, join, miter, dash, opacity, and paint.'
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
      'Classify supported stroke families without claiming final visual correctness.'
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
      'Allocate dashed intervals only where the dash model owns placement.'
    ],
    [
      'build-stroke-candidates',
      'Stroke Geometry',
      4,
      'Build stroke candidates',
      'Build model-specific candidates: doubled authored center-stroke candidates for solid, interval candidates for dashed allocation, and doubled center-dashed product candidates for constrained inside dashed visible geometry.'
    ],
    [
      'apply-legality',
      'Stroke Geometry',
      4,
      'Apply legality',
      'Clip solid candidates with inside filled-region or outside exterior masks; keep derivation evidence non-visible.'
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
      'Preserve model-separated provenance and visible/non-visible separation; constrained inside dashed may carry one exact mask render descriptor instead of requiring per-interval visible faces.'
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
      'Prepare renderer-ready visible descriptors; exact single inside dashed mask descriptors may bypass same-visual overlap collapse because the descriptor already represents one product-visible masked stroke.'
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
      tags: ['framework-native', 'critical']
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
      tags: ['framework-native']
    },
    'point-handle-drag-operation': {
      latestRule:
        'Point/handle drag previews are non-undoable; final drag commits a canonical computed patch.',
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
      tags: ['framework-native', 'critical']
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
        'Keep full topology repair as fallback only; normal structural operations must not rewrite unrelated records.',
      relatedTests: [
        'apps/asyra-design/e2e/vector-render-invariants.spec.ts',
        'apps/asyra-design/e2e/undo-redo.spec.ts',
        'packages/preset/src/__tests__/vector-path-editing-render-layer.test.ts'
      ],
      tags: ['framework-native', 'critical']
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
      tags: ['framework-native', 'critical']
    },
    'canonical-workspace-data': {
      latestRule:
        'Vector model points use workspace/world coordinates as canonical data.',
      inputs: ['previous vector computed data', 'operation target positions'],
      outputs: ['workspace canonical vector topology'],
      currentImplementation:
        'Legacy local data may migrate through fallback, but normal operations preserve workspace points.',
      requiredAdjustment:
        'Do not normalize points into bounds-local model data during normal operation commits.',
      tags: ['framework-native', 'truth']
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
      tags: ['framework-native', 'critical']
    },
    'transaction-undo-boundary': {
      latestRule:
        'One intended user action maps to one intended undo unit.',
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
      tags: ['framework-native', 'critical']
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
      tags: ['framework-native']
    },
    'computed-patch-event': {
      latestRule:
        'Data channel publishes computed patch updates after commit for downstream consumers.',
      inputs: ['committed scene-tree update'],
      outputs: ['computed patch reactive event'],
      currentImplementation:
        'Patch events remain the downstream render/UI synchronization contract.',
      tags: ['framework-native']
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
      tags: ['framework-native', 'risk']
    },
    'render-mirror-patch-apply': {
      latestRule:
        'Render mirror applies each committed patch once and never seeds after-state then applies the same patch again.',
      inputs: ['computed patch event', 'existing render mirror snapshot'],
      outputs: ['updated render mirror snapshot'],
      currentImplementation:
        'Render scene-tree store tests cover computed patch mirror updates.',
      relatedTests: ['packages/render/src/__tests__/scene-tree-store.test.ts'],
      tags: ['framework-native', 'critical']
    },
    'render-data-derivation': {
      latestRule:
        'Renderer-ready vector/stroke data is derived from render mirror state, not feature-local state.',
      inputs: ['render mirror snapshot'],
      outputs: ['normalized render data candidate'],
      currentImplementation:
        'Vector render invariant tests compare model, render graphic, hover outline, and editing overlay.',
      relatedTests: ['apps/asyra-design/e2e/vector-render-invariants.spec.ts'],
      tags: ['framework-native', 'truth']
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
    'build-stroke-candidates': {
      alignmentStatus: 'guarded',
      latestRule:
        'Solid candidates are doubled authored center-stroke candidates with join and miter semantics before masking; dashed candidates keep interval ownership and constrained inside dashed product candidates.',
      currentImplementation:
        'For the reported inside-solid slice, Stroke Geometry candidate building provides authored centerline candidates that downstream grouped render descriptors preserve.',
      requiredAdjustment:
        'Keep solid and dashed candidate models separate; do not turn face strips or helper polygons into visible solid geometry.',
      tags: ['canonical', 'guarded']
    },
    'apply-legality': {
      alignmentStatus: 'guarded',
      latestRule:
        'Inside solid legality clips the doubled authored center stroke with a face, winding, and adjacency-aware filled-region mask.',
      currentImplementation:
        'For the reported inside-solid slice, Stroke Geometry legality supplies adjacency-aware mask evidence while visible render remains grouped authored stroke paths.',
      requiredAdjustment:
        'Internal shared edges must reveal half width from each adjacent filled face, all five internal pentagon corners must respond to strokeJoin and strokeMiterLimit, and the internal pentagon must not fragment.',
      tags: ['canonical', 'guarded']
    },
    'build-final-faces': {
      alignmentStatus: 'guarded',
      latestRule:
        'Final records preserve visible descriptors separately from non-visible coverage evidence; constrained inside dashed may carry one exact grouped mask descriptor for product-visible render.',
      currentImplementation:
        'Inside solid uses grouped authored stroke paths; inside dashed drag frames may use one exact mask descriptor with fillClipPolygons, authored dashed strokePaths, and strokePathStyle.',
      requiredAdjustment:
        'Keep diagnostics and coverage fragments out of visible product descriptors; do not require per-interval visible polygons when the exact mask descriptor is present.',
      tags: ['canonical', 'guarded']
    },
    'emit-render-hit-export-packets': {
      alignmentStatus: 'guarded',
      latestRule:
        'Render packets consume visible descriptors; hit/export may consume non-visible coverage evidence only as projection data.',
      currentImplementation:
        'For the reported inside-solid slice, render consumes grouped visible descriptors while hit/export keep separate projection data.',
      requiredAdjustment:
        'Do not let coverage evidence or diagnostics define visible solid pixels in future slices.',
      tags: ['canonical', 'guarded']
    },
    'render-entries': {
      alignmentStatus: 'guarded',
      latestRule:
        'Render entries are projection-only and must not create constrained stroke semantics; a single exact inside dashed mask descriptor may skip same-visual overlap collapse.',
      currentImplementation:
        'Inside dashed drag render consumes the exact descriptor directly so visible frames avoid per-interval product intersection while preserving the doubled center-dashed mask rule.',
      tags: ['risk']
    },
    'renderer-projection': {
      alignmentStatus: 'guarded',
      latestRule:
        'Renderer draw code must not repair geometry or infer side legality.',
      tags: ['risk']
    },
    'visible-final-result': {
      alignmentStatus: 'outside-dashed-square-visual-review-blocked',
      latestRule:
        'Final visual review passes only when rule-driven probes and reviewed screenshots cover the current slice; outside dashed square remains blocked.',
      currentImplementation:
        'Manual app screenshot review passed for the reported inside-solid slice, but outside dashed square still reports opposite-side probe failures.',
      requiredAdjustment:
        'Clear outside dashed square Product Output / Diagnostics failures before any broader completion claim.',
      tags: ['guarded']
    }
  }

  const laneRows = new Map()

  const nextRowForLane = (lane) => {
    const row = laneRows.get(lane) ?? 0
    laneRows.set(lane, row + 1)
    return row
  }

  const getLaneIndex = (group, legacyLane) => {
    const laneIndex = lanes.indexOf(group)
    if (laneIndex >= 0) {
      return laneIndex
    }
    return Number.isFinite(legacyLane) ? legacyLane : 0
  }

  const defaultStepData = (id, group, legacyLane, title, summary, index) => {
    const override = stepOverrides[id] ?? {}
    const alignmentStatus = override.alignmentStatus ?? 'aligned'
    const lane = getLaneIndex(group, legacyLane)
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
        latestRule:
          'Preserve the Stroke / Vector System flow for this lane.',
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
      step.alignmentStatus === 'reopened-rule-review-blocked'
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
