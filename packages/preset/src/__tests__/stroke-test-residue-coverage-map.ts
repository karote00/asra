export type FormalStrokeTestResidueClassification =
  | 'mapped-non-authoritative-regression'
  | 'package-local-regression'
  | 'later-phase-performance-regression'
  | 'non-stroke-package-local-test'

export interface FormalStrokeTestResidueRecord {
  filePath: string
  classification: FormalStrokeTestResidueClassification
  retainedAs: string
  shouldEnterStrokeCorrectnessGate: false
  definesStrokeSemantics: false
  requiresSpecInspectorMapping: boolean
  specRuleRefs: readonly string[]
  inspectorStepRefs: readonly string[]
  inspectorRouteRefs: readonly string[]
  requiredActionBeforePromotion: string
}

const spec = (anchor: string) =>
  `docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#${anchor}`

export const formalStrokeTestResidueRecords: readonly FormalStrokeTestResidueRecord[] =
  [
    {
      filePath: 'packages/preset/src/__tests__/ellipse-path.test.ts',
      classification: 'package-local-regression',
      retainedAs: 'package-local shared geometry helper regression',
      shouldEnterStrokeCorrectnessGate: false,
      definesStrokeSemantics: false,
      requiresSpecInspectorMapping: true,
      specRuleRefs: [spec('supported-stroke-feature-surface')],
      inspectorStepRefs: ['shared-geometry-model'],
      inspectorRouteRefs: [
        'linear-normalize-stroke-spec-to-shared-geometry-model'
      ],
      requiredActionBeforePromotion:
        'rewrite as current stroke-flow or oracle coverage before it may join a stroke correctness gate'
    },
    {
      filePath: 'packages/preset/src/__tests__/fills-gradient.test.ts',
      classification: 'non-stroke-package-local-test',
      retainedAs: 'package-local fill rendering regression',
      shouldEnterStrokeCorrectnessGate: false,
      definesStrokeSemantics: false,
      requiresSpecInspectorMapping: false,
      specRuleRefs: [],
      inspectorStepRefs: [],
      inspectorRouteRefs: [],
      requiredActionBeforePromotion:
        'do not promote to stroke correctness authority; keep under package-local fill coverage'
    },
    {
      filePath:
        'packages/preset/src/__tests__/resolved-vector-geometry-model.test.ts',
      classification: 'mapped-non-authoritative-regression',
      retainedAs: 'package-local shared/resolved geometry regression',
      shouldEnterStrokeCorrectnessGate: false,
      definesStrokeSemantics: false,
      requiresSpecInspectorMapping: true,
      specRuleRefs: [
        spec('current-status'),
        spec('domain-mode-and-legal-side-resolution'),
        spec('output-channel-separation')
      ],
      inspectorStepRefs: [
        'shared-geometry-model',
        'resolve-source-families',
        'resolve-stroke-domains'
      ],
      inspectorRouteRefs: [
        'linear-normalize-stroke-spec-to-shared-geometry-model',
        'linear-shared-geometry-model-to-resolve-source-families',
        'linear-resolve-source-families-to-resolve-stroke-domains'
      ],
      requiredActionBeforePromotion:
        'extract current mapped assertions into stroke-flow integration or formal oracle coverage'
    },
    {
      filePath: 'packages/preset/src/__tests__/selection-subscriptions.test.ts',
      classification: 'non-stroke-package-local-test',
      retainedAs: 'package-local selection subscription regression',
      shouldEnterStrokeCorrectnessGate: false,
      definesStrokeSemantics: false,
      requiresSpecInspectorMapping: false,
      specRuleRefs: [],
      inspectorStepRefs: [],
      inspectorRouteRefs: [],
      requiredActionBeforePromotion:
        'do not promote to stroke correctness authority; keep under package-local selection coverage'
    },
    {
      filePath: 'packages/preset/src/__tests__/source-span-graph.test.ts',
      classification: 'mapped-non-authoritative-regression',
      retainedAs: 'package-local source-span provenance regression',
      shouldEnterStrokeCorrectnessGate: false,
      definesStrokeSemantics: false,
      requiresSpecInspectorMapping: true,
      specRuleRefs: [
        spec('domain-mode-and-legal-side-resolution'),
        spec('dash-body-and-join-seam-contract')
      ],
      inspectorStepRefs: ['resolve-stroke-domains', 'allocate-dash-intervals'],
      inspectorRouteRefs: [
        'linear-resolve-source-families-to-resolve-stroke-domains',
        'linear-resolve-stroke-domains-to-allocate-dash-intervals'
      ],
      requiredActionBeforePromotion:
        'move promoted assertions into inspector-flow integration/oracle coverage with artifact ownership'
    },
    {
      filePath: 'packages/preset/src/__tests__/stroke-dirty-keys.test.ts',
      classification: 'mapped-non-authoritative-regression',
      retainedAs: 'package-local dirty/cache key regression',
      shouldEnterStrokeCorrectnessGate: false,
      definesStrokeSemantics: false,
      requiresSpecInspectorMapping: true,
      specRuleRefs: [
        spec('current-state-product-contract'),
        spec('descriptor-channel-cache-and-drag-contracts'),
        spec('stroke-parameter-stage-cache-rule')
      ],
      inspectorStepRefs: ['dirty-revision-graph', 'stage-product-cache'],
      inspectorRouteRefs: [
        'linear-dirty-revision-graph-to-stage-product-cache',
        'source-drag-dirty-classification',
        'paint-only-cache-retint',
        'verified-product-descriptor-cache-hit'
      ],
      requiredActionBeforePromotion:
        'promote only through current inspector route coverage, not by treating this package-local test as source of truth'
    },
    {
      filePath: 'packages/preset/src/__tests__/stroke-domain-plan.test.ts',
      classification: 'mapped-non-authoritative-regression',
      retainedAs: 'package-local domain-planning regression',
      shouldEnterStrokeCorrectnessGate: false,
      definesStrokeSemantics: false,
      requiresSpecInspectorMapping: true,
      specRuleRefs: [
        spec('domain-mode-and-legal-side-resolution'),
        spec('self-intersecting-inside-solid'),
        spec('output-channel-separation')
      ],
      inspectorStepRefs: [
        'resolve-source-families',
        'resolve-stroke-domains',
        'allocate-dash-intervals'
      ],
      inspectorRouteRefs: [
        'linear-shared-geometry-model-to-resolve-source-families',
        'linear-resolve-source-families-to-resolve-stroke-domains',
        'linear-resolve-stroke-domains-to-allocate-dash-intervals'
      ],
      requiredActionBeforePromotion:
        'extract promoted cases into current stroke-flow integration or formal geometry oracle map'
    },
    {
      filePath:
        'packages/preset/src/__tests__/stroke-parameter-switch-performance.test.ts',
      classification: 'later-phase-performance-regression',
      retainedAs: 'later-phase performance/cache evidence',
      shouldEnterStrokeCorrectnessGate: false,
      definesStrokeSemantics: false,
      requiresSpecInspectorMapping: true,
      specRuleRefs: [
        spec('stroke-parameter-stage-cache-rule'),
        spec('drag-performance-contract')
      ],
      inspectorStepRefs: ['stage-product-cache', 'renderer-projection'],
      inspectorRouteRefs: [
        'paint-only-cache-retint',
        'source-drag-dirty-classification',
        'render-projection-merge'
      ],
      requiredActionBeforePromotion:
        'keep outside stroke correctness gates until the later performance phase is explicitly approved'
    },
    {
      filePath:
        'packages/preset/src/__tests__/vector-path-editing-render-layer.test.ts',
      classification: 'package-local-regression',
      retainedAs:
        'package-local vector editing overlay and operation regression',
      shouldEnterStrokeCorrectnessGate: false,
      definesStrokeSemantics: false,
      requiresSpecInspectorMapping: true,
      specRuleRefs: [
        spec('current-status'),
        spec('inspector-flow-first-greenfield-refactor-protocol')
      ],
      inspectorStepRefs: [
        'path-editing-intent',
        'structural-vector-operation',
        'common-api-domain-adapter'
      ],
      inspectorRouteRefs: [
        'linear-feature-session-intent-to-path-editing-intent',
        'linear-structural-vector-operation-to-common-api-domain-adapter'
      ],
      requiredActionBeforePromotion:
        'promote only by rewriting into current inspector step tests for intent/common-API contracts'
    }
  ]
