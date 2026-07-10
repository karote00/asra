export type StrokeRegressionLayer =
  | 'step-unit'
  | 'flow-integration'
  | 'formal-geometry-oracle'
  | 'app-runtime-evidence'
  | 'visual-validation'
  | 'full-package-regression'
  | 'drag-performance'

export type StrokeRegressionRiskClass =
  | 'spec-contract-drift'
  | 'inspector-route-drift'
  | 'parameter-matrix-gap'
  | 'artifact-handoff-regression'
  | 'product-geometry-regression'
  | 'app-runtime-route-mismatch'
  | 'visual-behavior-regression'
  | 'full-package-side-effect'
  | 'performance-regression'
  | 'reported-case-regression'

export type StrokeRegressionPhase =
  | 'active-new-correctness'
  | 'runtime-repair'
  | 'post-runtime-validation'
  | 'future-full-regression'
  | 'future-performance'

export type StrokeRegressionGateScript =
  | 'test:stroke-flow:unit'
  | 'test:stroke-flow:validation'
  | 'test:stroke-flow:integration'
  | 'test:stroke-geometry:oracle'
  | 'test:stroke:regression'
  | 'test:stroke:new'
  | 'test:local'
  | 'app:e2e:stroke-new-flow'
  | 'app:e2e:stroke-drag-performance'

export interface StrokeRegressionCoverageCase {
  id: string
  title: string
  phase: StrokeRegressionPhase
  layers: readonly StrokeRegressionLayer[]
  riskClasses: readonly StrokeRegressionRiskClass[]
  sourceOfTruthRefs: readonly string[]
  gateScripts: readonly StrokeRegressionGateScript[]
  requiredPriorGateScripts: readonly StrokeRegressionGateScript[]
  integrationCaseIds: readonly string[]
  oracleCaseIds: readonly string[]
  visualCaseIds: readonly string[]
  fullRegressionPolicy: string
  positiveAssertions: readonly string[]
  forbiddenAssertions: readonly string[]
}

const spec = (anchor: string) =>
  `docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#${anchor}`

const plan = (anchor: string) => `docs/ai/apps/asyra-design/PLANS.md#${anchor}`

const inspector = (field: string) =>
  `docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js#${field}`

export const requiredStrokeRegressionLayers: readonly StrokeRegressionLayer[] =
  [
    'step-unit',
    'flow-integration',
    'formal-geometry-oracle',
    'app-runtime-evidence',
    'visual-validation',
    'full-package-regression',
    'drag-performance'
  ]

export const requiredStrokeRegressionRiskClasses: readonly StrokeRegressionRiskClass[] =
  [
    'spec-contract-drift',
    'inspector-route-drift',
    'parameter-matrix-gap',
    'artifact-handoff-regression',
    'product-geometry-regression',
    'app-runtime-route-mismatch',
    'visual-behavior-regression',
    'full-package-side-effect',
    'performance-regression',
    'reported-case-regression'
  ]

export const strokeRegressionCoverageMap: readonly StrokeRegressionCoverageCase[] =
  [
    {
      id: 'step-unit-contract-regression',
      title:
        'Inspector step unit gates prevent spec, route, and parameter contract drift',
      phase: 'active-new-correctness',
      layers: ['step-unit'],
      riskClasses: [
        'spec-contract-drift',
        'inspector-route-drift',
        'parameter-matrix-gap'
      ],
      sourceOfTruthRefs: [
        spec('inspector-flow-first-greenfield-refactor-protocol'),
        spec('stroke-parameter-stage-cache-rule'),
        inspector('strokeParameterCoverageMatrix'),
        plan('execution-rules')
      ],
      gateScripts: ['test:stroke-flow:unit'],
      requiredPriorGateScripts: [],
      integrationCaseIds: [],
      oracleCaseIds: [],
      visualCaseIds: [],
      fullRegressionPolicy:
        'Step unit regression is a correctness gate and must not depend on full-package tests.',
      positiveAssertions: [
        'Every runtime inspector step has an isolated unit contract gate.',
        'Every stroke parameter role is classified as consume, preserve, forbid, dirty-key, cache-key, output-metadata, or not-applicable for the step.'
      ],
      forbiddenAssertions: [
        'A reported screenshot or historical fixture cannot verify a step contract.',
        'Unmapped stale tests cannot drive active step semantics.'
      ]
    },
    {
      id: 'flow-integration-handoff-regression',
      title:
        'Inspector-flow integration gates prevent artifact handoff and bypass route drift',
      phase: 'active-new-correctness',
      layers: ['flow-integration'],
      riskClasses: [
        'inspector-route-drift',
        'artifact-handoff-regression',
        'parameter-matrix-gap'
      ],
      sourceOfTruthRefs: [
        spec('inspector-flow-first-greenfield-refactor-protocol'),
        spec('product-legality-and-descriptor-encoding'),
        spec('output-channel-separation'),
        inspector('conditionalRoutes')
      ],
      gateScripts: ['test:stroke-flow:integration'],
      requiredPriorGateScripts: ['test:stroke-flow:unit'],
      integrationCaseIds: [
        'source-mutation-ingress-linear-handoff',
        'render-mirror-current-state-linear-handoff',
        'normalized-source-domain-dash-family-chain',
        'dirty-cache-bypass-and-source-drag-routes',
        'product-family-selection-and-unsupported-terminal',
        'center-product-and-source-vertex-route-chain',
        'constrained-solid-product-legality-chain',
        'constrained-dashed-product-coexecution-chain',
        'legality-resolved-paint-final-descriptor-chain',
        'render-entry-descriptor-and-canonical-output-chain',
        'render-hit-export-output-channel-chain'
      ],
      oracleCaseIds: [],
      visualCaseIds: [],
      fullRegressionPolicy:
        'Integration regression is the adjacent-step artifact gate; full-package regression stays later-phase evidence.',
      positiveAssertions: [
        'Every integration case verifies produced artifacts are consumed by the declared downstream owner.',
        'Bypass routes prove the skipped geometry stages are not re-entered.'
      ],
      forbiddenAssertions: [
        'Downstream stages cannot infer or repair missing upstream artifacts.',
        'Cache or bypass routes cannot substitute product output.'
      ]
    },
    {
      id: 'formal-geometry-matrix-regression',
      title:
        'Formal geometry oracle matrix guards product geometry across parameters, scenarios, and owner stages',
      phase: 'active-new-correctness',
      layers: ['formal-geometry-oracle'],
      riskClasses: [
        'product-geometry-regression',
        'parameter-matrix-gap',
        'artifact-handoff-regression'
      ],
      sourceOfTruthRefs: [
        spec('supported-stroke-feature-surface'),
        spec('asyra-stroke-construction-baseline'),
        spec('asyra-join-resolution-baseline'),
        spec('dash-body-and-join-seam-contract')
      ],
      gateScripts: ['test:stroke-geometry:oracle'],
      requiredPriorGateScripts: [
        'test:stroke-flow:unit',
        'test:stroke-flow:integration'
      ],
      integrationCaseIds: [
        'constrained-dashed-product-coexecution-chain',
        'legality-resolved-paint-final-descriptor-chain',
        'render-entry-descriptor-and-canonical-output-chain'
      ],
      oracleCaseIds: [
        'stroke-parameter-normalization-matrix',
        'center-product-family-baseline',
        'constrained-solid-doubled-center-product',
        'constrained-dashed-product-owner-classes',
        'source-vertex-join-resolution-matrix',
        'dash-body-source-vertex-seam',
        'cap-terminal-dash-policy',
        'smooth-continuity-non-join',
        'descriptor-final-face-channel-separation',
        'degenerate-local-join',
        'bypass-cache-geometry-applicability'
      ],
      visualCaseIds: [],
      fullRegressionPolicy:
        'Formal geometry regression is product-artifact based and must pass before app screenshots, full-package regression, or performance gates can prove anything.',
      positiveAssertions: [
        'The oracle matrix covers stroke parameters, geometry scenarios, product families, owner stages, artifacts, and forbidden contributors.',
        'Geometry correctness is proven from product artifacts and metadata, not renderer pixels.'
      ],
      forbiddenAssertions: [
        'Screenshot-only checks cannot be formal geometry regression evidence.',
        'A single historical case cannot replace the product matrix.'
      ]
    },
    {
      id: 'reported-case-regression-bucket',
      title:
        'Reported cases remain matrix members and never become standalone implementation drivers',
      phase: 'runtime-repair',
      layers: ['formal-geometry-oracle', 'app-runtime-evidence'],
      riskClasses: [
        'reported-case-regression',
        'product-geometry-regression',
        'app-runtime-route-mismatch'
      ],
      sourceOfTruthRefs: [
        spec('canonical-owner-stage-diagnosis'),
        spec('dash-body-and-join-seam-contract'),
        spec('canonical-visual-review-and-completion-dod')
      ],
      gateScripts: ['test:stroke-geometry:oracle', 'app:e2e:stroke-new-flow'],
      requiredPriorGateScripts: [
        'test:stroke-flow:unit',
        'test:stroke-flow:integration'
      ],
      integrationCaseIds: ['constrained-dashed-product-coexecution-chain'],
      oracleCaseIds: [
        'reported-vector-34-runtime-product-boundary',
        'source-vertex-join-resolution-matrix',
        'dash-body-source-vertex-seam'
      ],
      visualCaseIds: [
        'reported-vector-34-high-acute-joins',
        'ordinary-sharp-join-switching'
      ],
      fullRegressionPolicy:
        'Reported cases may open or verify matrix coverage, but they must not create fixture-specific branches or override the spec matrix.',
      positiveAssertions: [
        'A reported case must reference existing spec rules, inspector routes, integration coverage, and formal oracle matrix cases.',
        'Reported cases are regression samples inside the broader matrix.'
      ],
      forbiddenAssertions: [
        'Do not prioritize a reported case over uncovered matrix dimensions.',
        'Do not add vector-specific, fixture-specific, or screenshot-specific product behavior.'
      ]
    },
    {
      id: 'app-runtime-evidence-regression',
      title:
        'App runtime validation guards route parity before visual screenshots are accepted',
      phase: 'post-runtime-validation',
      layers: ['app-runtime-evidence', 'visual-validation'],
      riskClasses: [
        'app-runtime-route-mismatch',
        'visual-behavior-regression',
        'product-geometry-regression'
      ],
      sourceOfTruthRefs: [
        spec('canonical-visual-review-and-completion-dod'),
        spec('output-channel-separation'),
        inspector('validationGates.visible-final-result')
      ],
      gateScripts: ['app:e2e:stroke-new-flow'],
      requiredPriorGateScripts: [
        'test:stroke-flow:unit',
        'test:stroke-flow:integration',
        'test:stroke-geometry:oracle',
        'test:stroke:regression'
      ],
      integrationCaseIds: [
        'render-entry-descriptor-and-canonical-output-chain',
        'render-hit-export-output-channel-chain'
      ],
      oracleCaseIds: [
        'source-vertex-join-resolution-matrix',
        'dash-body-source-vertex-seam',
        'smooth-continuity-non-join',
        'descriptor-final-face-channel-separation'
      ],
      visualCaseIds: [
        'reported-vector-34-high-acute-joins',
        'ordinary-sharp-join-switching',
        'smooth-curvature-non-join',
        'descriptor-channel-separation'
      ],
      fullRegressionPolicy:
        'App runtime evidence is a post-runtime validation gate and is not a replacement for formal geometry oracle coverage.',
      positiveAssertions: [
        'Runtime metadata assertions pass before screenshots or crops are produced.',
        'Visual artifacts are evidence of app-visible behavior after product metadata is correct.'
      ],
      forbiddenAssertions: [
        'Do not treat renderer pixels as product semantics.',
        'Do not repair product geometry in an E2E harness or test-only evidence bridge.'
      ]
    },
    {
      id: 'full-package-regression-phase',
      title:
        'Full package regression is a later side-effect gate after new stroke correctness gates pass',
      phase: 'future-full-regression',
      layers: ['full-package-regression'],
      riskClasses: ['full-package-side-effect'],
      sourceOfTruthRefs: [
        spec('inspector-flow-first-greenfield-refactor-protocol'),
        plan('required-gates')
      ],
      gateScripts: ['test:local'],
      requiredPriorGateScripts: [
        'test:stroke-flow:unit',
        'test:stroke-flow:validation',
        'test:stroke-flow:integration',
        'test:stroke-geometry:oracle',
        'test:stroke:regression',
        'test:stroke:new'
      ],
      integrationCaseIds: [],
      oracleCaseIds: [],
      visualCaseIds: [],
      fullRegressionPolicy:
        'Full preset regression has three attempts, runs after stroke correctness gates pass, and reports failures by suite, assertion, owner stage, and focused repair path.',
      positiveAssertions: [
        'Full regression is used to find package side effects after new stroke correctness has been established.',
        'Failures are triaged against the new spec and inspector flow before any production repair.'
      ],
      forbiddenAssertions: [
        'Do not redefine stroke correctness from full regression failures.',
        'Do not run unlimited full regression retries.'
      ]
    },
    {
      id: 'drag-performance-regression-phase',
      title:
        'Drag and performance regression starts after product semantics and required runtime gates pass',
      phase: 'future-performance',
      layers: ['drag-performance'],
      riskClasses: ['performance-regression', 'app-runtime-route-mismatch'],
      sourceOfTruthRefs: [
        spec('canonical-visual-review-and-completion-dod'),
        plan('required-gates')
      ],
      gateScripts: ['app:e2e:stroke-drag-performance'],
      requiredPriorGateScripts: [
        'test:stroke:new',
        'app:e2e:stroke-new-flow',
        'test:local'
      ],
      integrationCaseIds: ['dirty-cache-bypass-and-source-drag-routes'],
      oracleCaseIds: ['bypass-cache-geometry-applicability'],
      visualCaseIds: [],
      fullRegressionPolicy:
        'Performance regression cannot justify geometry shortcuts; it runs only after geometry/product semantics and required runtime behavior gates are complete. Optional visual review is not a prerequisite.',
      positiveAssertions: [
        'Drag performance gates measure an already-correct runtime path.',
        'Dirty/cache routes preserve canonical product semantics while optimizing recomputation.'
      ],
      forbiddenAssertions: [
        'Do not optimize before geometry/product correctness is established.',
        'Do not introduce drag-only product routes or preview-only output.'
      ]
    }
  ]
