/* global window */
;(() => {
  const groups = [
    'All',
    'Interaction',
    'State Commit',
    'Render Cache',
    'Stroke Pipeline',
    'Shared Geometry',
    'Fill',
    'Final Faces',
    'Render',
    'Diagnostics'
  ]

  const lanes = groups.filter((group) => group !== 'All')

  const latestRules = [
    'Only PLANS.md, this data file, and the stroke-engine README define current stroke rules. Viewer HTML is a shell only.',
    'The 2026-05-31 grid/vector-network self-intersecting inside solid slice now has focused probes, e2e pixel gates, and manual app screenshot review passing; this is slice-level evidence, not a whole-engine completion claim.',
    'Constrained solid visible render uses the Asyra doubled authored center-stroke mask model: build the authored center stroke at twice the requested stroke width, apply strokeJoin and strokeMiterLimit there, then clip by the inside filled-region mask or outside exterior mask.',
    'Self-intersecting inside solid visible pixels must come from the doubled authored center stroke clipped by a face, winding, and adjacency-aware filled-region mask.',
    'Grouped render descriptors may encode the adjacency-aware mask only as authored centerline stroke paths with explicit clip groups; they must not expose face strips, helper polygons, or derivation fragments as visible product geometry.',
    'Internal shared edges reveal half of the requested stroke width from each adjacent filled face; the combined visible width along the shared edge must not become two independent full-width strips.',
    'All five internal pentagon corners are join-sensitive and must vary with strokeJoin and strokeMiterLimit.',
    'Derivation fragments, face strips, helper polygons, coverage probes, and diagnostics can prove legality, hit/export, or failure modes, but they must not become product-visible solid stroke geometry.',
    'Dashed constrained strokes remain interval-domain based. Dash intervals, terminal half-dashes, and caps must stay separate from solid visible geometry.',
    'Step 17 builds model-specific stroke candidates; Step 20 applies mask legality; Step 24/25 preserve model-separated render/hit/export descriptors; Step 30 passed for the reported inside-solid slice only after probes and manual app visual review passed without internal pentagon fragmentation.',
    'Captured Asyra rule mismatches reopen the earliest owning inspector step. Implementation must not add new local rules before all three authority files are updated.'
  ]

  const currentExecutionState = {
    totalSteps: 30,
    planStatus: 'active-slice-rule-review-passed',
    nextExecutableStepId: 'visible-final-result',
    nextExecutableStepNumber: 30,
    nextExecutableStepStatus: 'slice-visual-review-passed',
    stopRule:
      'The 2026-05-31 reported inside-solid slice passed focused probes, e2e pixel gates, and manual app screenshot review. Do not claim whole-engine or whole-matrix completion without applying the same evidence standard to the broader matrix.',
    requiredImplementationSequence: [
      'Keep the three authority files synchronized before runtime implementation changes are claimed.',
      'Step 17 must build model-specific stroke candidates.',
      'Step 20 must clip solid candidates with the filled-region or exterior mask and keep derivation fragments diagnostic-only.',
      'Step 24/25 must preserve model-separated visible render, hit, and export descriptors.',
      'Step 30 can pass only for slices whose focused probes and manual app screenshot review pass without fragmented internal pentagon output.'
    ],
    currentCompletionEvidence: [
      '2026-05-31: document authority cleanup removed stale stroke rule files.',
      '2026-05-31: focused numeric probes alone were proven insufficient and the e2e fragment gate was tightened.',
      '2026-05-31: reported inside-solid slice passed focused probes, full e2e file, build, lint, and manual screenshot review.'
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
        'Interval-domain dash allocation, terminal half-dashes, cap behavior, and provenance remain separate from solid visible geometry; constrained inside dashed visible product geometry is doubled authored center-dashed stroke clipped by the inside filled-region mask, not one-sided ribbon fallback.',
      status: 'guarded: keep regression evidence separate from solid rules'
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
    'active-slice-rule-review-passed': 'Active / slice rule review passed',
    'slice-visual-review-passed': 'Slice visual review passed',
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
      'input-event',
      'Interaction',
      0,
      'Input event',
      'Convert user action into explicit vector or stroke intent.'
    ],
    [
      'vector-api-mutation',
      'State Commit',
      1,
      'Vector API mutation',
      'Apply validated source topology or stroke style changes through common APIs.'
    ],
    [
      'validate-topology',
      'State Commit',
      1,
      'Validate topology',
      'Reject malformed vector topology before commit.'
    ],
    [
      'transaction-write',
      'State Commit',
      1,
      'Transaction write',
      'Commit one intended edit as one intended undo unit.'
    ],
    [
      'data-channel-delta',
      'State Commit',
      1,
      'Data-channel delta',
      'Publish computed-data key changes after commit.'
    ],
    [
      'render-cache-patch',
      'Render Cache',
      2,
      'Render cache patch',
      'Patch render cache from committed state.'
    ],
    [
      'dirty-revision-graph',
      'Render Cache',
      2,
      'Dirty revision graph',
      'Classify which stroke stages must rerun.'
    ],
    [
      'render-strategy-entry',
      'Render Cache',
      2,
      'Render strategy entry',
      'Orchestrate render data without deciding stroke semantics.'
    ],
    [
      'normalize-render-data',
      'Stroke Pipeline',
      3,
      'Normalize render data',
      'Stabilize authored topology and style inputs.'
    ],
    [
      'normalize-stroke-spec',
      'Stroke Pipeline',
      3,
      'Normalize stroke spec',
      'Normalize width, position, cap, join, miter, dash, opacity, and paint.'
    ],
    [
      'build-path-topology',
      'Shared Geometry',
      4,
      'Build path topology',
      'Build source topology, contours, lengths, winding basis, and self-intersection evidence.'
    ],
    [
      'shared-geometry-model',
      'Shared Geometry',
      4,
      'Shared geometry model',
      'Build shared face, region, boundary, and future shadow geometry evidence.'
    ],
    [
      'resolve-source-families',
      'Stroke Pipeline',
      3,
      'Resolve source families',
      'Classify supported stroke families without claiming final visual correctness.'
    ],
    [
      'resolve-stroke-domains',
      'Stroke Pipeline',
      3,
      'Resolve stroke domains',
      'Resolve mask/domain evidence for model-specific consumption.'
    ],
    [
      'allocate-intervals',
      'Stroke Pipeline',
      3,
      'Allocate intervals',
      'Allocate dashed intervals only where the dash model owns placement.'
    ],
    [
      'build-source-span-graph',
      'Stroke Pipeline',
      3,
      'Build source span graph',
      'Map intervals and candidates back to authored spans and vertices.'
    ],
    [
      'build-stroke-candidates',
      'Stroke Pipeline',
      3,
      'Build stroke candidates',
      'Build model-specific candidates: doubled authored center-stroke candidates for solid, interval candidates for dashed allocation, and doubled center-dashed product candidates for constrained inside dashed visible geometry.'
    ],
    [
      'partition-arrangement-faces',
      'Stroke Pipeline',
      3,
      'Partition arrangement faces',
      'Partition candidate overlap only after model-specific candidates exist.'
    ],
    [
      'resolve-ownership',
      'Stroke Pipeline',
      3,
      'Resolve ownership',
      'Attach typed owner and provenance metadata.'
    ],
    [
      'apply-legality',
      'Stroke Pipeline',
      3,
      'Apply legality',
      'Clip solid candidates with inside filled-region or outside exterior masks; keep derivation evidence non-visible.'
    ],
    [
      'build-resolved-stroke-regions',
      'Final Faces',
      6,
      'Build resolved stroke regions',
      'Build semantic stroke records after legality.'
    ],
    [
      'attach-paint-payload',
      'Final Faces',
      6,
      'Attach paint payload',
      'Attach paint without changing geometry.'
    ],
    [
      'fill-region-consumer',
      'Fill',
      5,
      'Fill region consumer',
      'Consume shared fill regions without creating competing stroke rules.'
    ],
    [
      'build-final-faces',
      'Final Faces',
      6,
      'Build final faces',
      'Preserve model-separated provenance and visible/non-visible separation.'
    ],
    [
      'emit-render-hit-export-packets',
      'Render',
      7,
      'Emit render/hit/export packets',
      'Project render, hit, and export packets without changing stroke semantics.'
    ],
    [
      'render-entries',
      'Render',
      7,
      'Render entries',
      'Prepare renderer-ready visible descriptors.'
    ],
    [
      'mesh-render',
      'Render',
      7,
      'Mesh render',
      'Draw upstream descriptors without repairing stroke semantics.'
    ],
    [
      'hit-export',
      'Render',
      7,
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
    'shared-geometry-model': {
      latestRule:
        'Shared geometry is reused by fill, stroke, hit/export, diagnostics, and future shadow; it does not become visible solid stroke geometry by itself.',
      tags: ['truth', 'critical']
    },
    'build-stroke-candidates': {
      alignmentStatus: 'guarded',
      latestRule:
        'Solid candidates are doubled authored center-stroke candidates with join and miter semantics before masking; dashed candidates remain interval-domain candidates.',
      currentImplementation:
        'For the reported inside-solid slice, Step 17 provides authored centerline candidates that downstream grouped render descriptors preserve.',
      requiredAdjustment:
        'Keep solid and dashed candidate models separate; do not turn face strips or helper polygons into visible solid geometry.',
      tags: ['canonical', 'guarded']
    },
    'apply-legality': {
      alignmentStatus: 'guarded',
      latestRule:
        'Inside solid legality clips the doubled authored center stroke with a face, winding, and adjacency-aware filled-region mask.',
      currentImplementation:
        'For the reported inside-solid slice, Step 20 supplies adjacency-aware mask evidence while visible render remains grouped authored stroke paths.',
      requiredAdjustment:
        'Internal shared edges must reveal half width from each adjacent filled face, all five internal pentagon corners must respond to strokeJoin and strokeMiterLimit, and the internal pentagon must not fragment.',
      tags: ['canonical', 'guarded']
    },
    'build-final-faces': {
      alignmentStatus: 'guarded',
      latestRule:
        'Final records preserve visible solid descriptors separately from non-visible coverage evidence.',
      currentImplementation:
        'For the reported inside-solid slice, visible descriptors now use grouped authored stroke paths and keep coverage evidence non-visible.',
      requiredAdjustment:
        'Keep diagnostics and coverage fragments out of visible product descriptors for every future slice.',
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
        'Render entries are projection-only and must not create constrained stroke semantics.',
      tags: ['risk']
    },
    'mesh-render': {
      alignmentStatus: 'guarded',
      latestRule:
        'Renderer draw code must not repair geometry or infer side legality.',
      tags: ['risk']
    },
    'visible-final-result': {
      alignmentStatus: 'guarded',
      latestRule:
        'Step 30 passed for the reported inside-solid slice only after validation covered shared-edge half width, all five internal corner join variants, miter limits, fill preservation, absence of visible derivation fragments, and no fragmented internal pentagon.',
      currentImplementation:
        'Manual app screenshot review passed for the reported inside-solid slice after the grouped visible descriptor repair.',
      requiredAdjustment:
        'Do not claim broader completion until the same screenshot-review gate passes for the broader matrix.',
      tags: ['guarded']
    }
  }

  const defaultStepData = (id, group, lane, row, title, summary, index) => {
    const override = stepOverrides[id] ?? {}
    const alignmentStatus = override.alignmentStatus ?? 'aligned'
    const defaultLatestRule =
      id === 'shared-geometry-model'
        ? 'Shared geometry remains the canonical evidence source for fill, stroke, hit/export, diagnostics, and future shadow.'
        : 'Preserve upstream authored geometry and do not invent stroke rules in this step.'
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
        'Stale helper behavior can reintroduce a visible stroke rule outside the authority files.'
      ],
      tags: override.tags ?? [],
      alignmentStatus,
      latestRule: override.latestRule ?? defaultLatestRule,
      currentImplementation:
        override.currentImplementation ??
        'No current mismatch is assigned to this step during the document cleanup.',
      requiredAdjustment:
        override.requiredAdjustment ??
        'Keep this step aligned with the doubled authored center-stroke mask rule and model separation.',
      planReferences: authorityRefs,
      implementationTrace: override.implementationTrace ?? [
        'Trace implementation against this step before changing runtime code.'
      ],
      asyraStrokeRules: override.asyraStrokeRules ?? latestRules,
      helperConditions: override.helperConditions ?? [
        'Do not add local stroke semantics in helper branches.'
      ],
      definitionOfDone: override.definitionOfDone ?? genericAcceptance,
      acceptanceTests: override.acceptanceTests ?? [
        'Add or run focused implementation probes before closing this step.'
      ],
      knownLimits: override.knownLimits ?? [
        'Document cleanup did not repair runtime rendering.'
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
    lanes.map((lane) => [lane, 'aligned'])
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
      'Preserve the Asyra doubled authored center-stroke mask rule without visible diagnostic fragments or renderer-side repair.',
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
