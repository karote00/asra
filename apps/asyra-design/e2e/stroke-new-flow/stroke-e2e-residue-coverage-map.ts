export type StrokeE2EResidueClassification =
  | 'reference-material'
  | 'app-user-behavior-evidence'
  | 'later-phase-performance-evidence'
  | 'legacy-broad-visual-evidence'

export interface StrokeE2EResidueRecord {
  filePath: string
  classification: StrokeE2EResidueClassification
  retainedAs: string
  currentStrokeCorrectnessGate: false
  definesStrokeSemantics: false
  allowedUse: string
  specRuleRefs: readonly string[]
  inspectorStepRefs: readonly string[]
  inspectorRouteRefs: readonly string[]
  requiredActionBeforePromotion: string
}

const spec = (anchor: string) =>
  `docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#${anchor}`

const referenceMaterial = (
  filePath: string,
  retainedAs = 'non-authoritative E2E reference material'
): StrokeE2EResidueRecord => ({
  filePath,
  classification: 'reference-material',
  retainedAs,
  currentStrokeCorrectnessGate: false,
  definesStrokeSemantics: false,
  allowedUse:
    'reference notes only; current stroke semantics must come from the stroke spec and inspector flow',
  specRuleRefs: [spec('invalid-current-rule-sources')],
  inspectorStepRefs: [],
  inspectorRouteRefs: [],
  requiredActionBeforePromotion:
    'rewrite into stroke-new-flow coverage with specRuleRefs, inspectorStepRefs, inspectorRouteRefs, and formal oracle links'
})

const appBehaviorEvidence = (
  filePath: string,
  retainedAs = 'app user-behavior E2E evidence'
): StrokeE2EResidueRecord => ({
  filePath,
  classification: 'app-user-behavior-evidence',
  retainedAs,
  currentStrokeCorrectnessGate: false,
  definesStrokeSemantics: false,
  allowedUse:
    'user-behavior evidence only; it may not define stroke engine architecture or geometry semantics',
  specRuleRefs: [spec('inspector-flow-first-greenfield-refactor-protocol')],
  inspectorStepRefs: [],
  inspectorRouteRefs: [],
  requiredActionBeforePromotion:
    'extract any stroke-specific assertion into stroke-new-flow coverage before using it as stroke correctness evidence'
})

const performanceEvidence = (
  filePath: string,
  retainedAs = 'later-phase drag/performance E2E evidence'
): StrokeE2EResidueRecord => ({
  filePath,
  classification: 'later-phase-performance-evidence',
  retainedAs,
  currentStrokeCorrectnessGate: false,
  definesStrokeSemantics: false,
  allowedUse:
    'later-phase performance evidence only after current semantic gates pass and the performance phase is approved',
  specRuleRefs: [
    spec('stroke-parameter-stage-cache-rule'),
    spec('drag-performance-contract')
  ],
  inspectorStepRefs: [
    'point-handle-drag-operation',
    'dirty-revision-graph',
    'stage-product-cache',
    'renderer-projection'
  ],
  inspectorRouteRefs: [
    'source-drag-dirty-classification',
    'paint-only-cache-retint',
    'render-projection-merge'
  ],
  requiredActionBeforePromotion:
    'keep outside current stroke correctness gates until a later performance phase explicitly unlocks it'
})

export const strokeE2EResidueCoverageMap: readonly StrokeE2EResidueRecord[] = [
  referenceMaterial('apps/asyra-design/e2e/definitions/README.md'),
  referenceMaterial(
    'apps/asyra-design/e2e/definitions/center-dashed-overlap-visual.definition.md',
    'diagnostics visual reference material'
  ),
  referenceMaterial(
    'apps/asyra-design/e2e/definitions/constrained-dashed-stroke-visual.definition.md'
  ),
  referenceMaterial(
    'apps/asyra-design/e2e/definitions/constrained-solid-legality-visual.definition.md',
    'diagnostics visual reference material'
  ),
  referenceMaterial(
    'apps/asyra-design/e2e/definitions/dashed-center-stroke-visual.definition.md'
  ),
  referenceMaterial(
    'apps/asyra-design/e2e/definitions/reference-dashed-stroke-completeness.definition.md'
  ),
  referenceMaterial(
    'apps/asyra-design/e2e/definitions/reference-dashed-stroke-rendering.definition.md'
  ),
  referenceMaterial(
    'apps/asyra-design/e2e/definitions/reference-dashed-stroke-single-dash-high-curvature-turn.definition.md'
  ),
  referenceMaterial(
    'apps/asyra-design/e2e/definitions/solid-center-stroke-visual.definition.md'
  ),
  referenceMaterial(
    'apps/asyra-design/e2e/definitions/solid-constrained-stroke-visual.definition.md'
  ),
  appBehaviorEvidence('apps/asyra-design/e2e/delete-element.spec.ts'),
  appBehaviorEvidence('apps/asyra-design/e2e/pen-tool.spec.ts'),
  appBehaviorEvidence('apps/asyra-design/e2e/properties.spec.ts'),
  appBehaviorEvidence('apps/asyra-design/e2e/selection.spec.ts'),
  appBehaviorEvidence('apps/asyra-design/e2e/undo-redo.spec.ts'),
  performanceEvidence(
    'apps/asyra-design/e2e/stroke-drag-render-performance-burst.spec.ts'
  ),
  performanceEvidence(
    'apps/asyra-design/e2e/stroke-drag-render-performance-center-dashed.spec.ts'
  ),
  performanceEvidence(
    'apps/asyra-design/e2e/stroke-drag-render-performance.helpers.ts'
  ),
  performanceEvidence(
    'apps/asyra-design/e2e/stroke-drag-render-performance-inside-dashed.spec.ts'
  ),
  performanceEvidence(
    'apps/asyra-design/e2e/stroke-drag-render-performance-open-center-dashed.spec.ts'
  ),
  performanceEvidence(
    'apps/asyra-design/e2e/stroke-drag-render-performance-open-inside-dashed.spec.ts'
  ),
  performanceEvidence(
    'apps/asyra-design/e2e/stroke-drag-render-performance-open-outside-dashed.spec.ts'
  ),
  performanceEvidence(
    'apps/asyra-design/e2e/stroke-drag-render-performance-open-solid.spec.ts'
  ),
  performanceEvidence(
    'apps/asyra-design/e2e/stroke-drag-render-performance-outside-dashed.spec.ts'
  ),
  performanceEvidence(
    'apps/asyra-design/e2e/stroke-drag-render-performance-solid.spec.ts'
  ),
  performanceEvidence(
    'apps/asyra-design/e2e/stroke-parameter-switch-performance.spec.ts'
  ),
  {
    filePath: 'apps/asyra-design/e2e/vector-render-invariants.spec.ts',
    classification: 'legacy-broad-visual-evidence',
    retainedAs: 'broad app visual/user-behavior regression evidence',
    currentStrokeCorrectnessGate: false,
    definesStrokeSemantics: false,
    allowedUse:
      'later-phase evidence only; individual stroke cases must be extracted into stroke-new-flow before correctness use',
    specRuleRefs: [
      spec('canonical-visual-review-and-completion-dod'),
      spec('invalid-current-rule-sources')
    ],
    inspectorStepRefs: ['renderer-projection'],
    inspectorRouteRefs: ['render-projection-merge'],
    requiredActionBeforePromotion:
      'extract each promoted stroke assertion into stroke-new-flow coverage with formal oracle and integration links'
  }
]
