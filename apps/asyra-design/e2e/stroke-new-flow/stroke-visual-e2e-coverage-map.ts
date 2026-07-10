import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export type StrokeVisualArtifactRequirement =
  | 'metadata-json'
  | 'full-screenshot'
  | 'focused-crop'
  | 'case-summary'

export type StrokeVisualRuntimeAssertion =
  | 'computed-stroke-state'
  | 'render-entry-presence'
  | 'owner-stage-metadata'
  | 'visible-contributor-metadata'
  | 'geometry-basis-metadata'
  | 'route-product-signature-metadata'
  | 'source-vertex-join-metadata'
  | 'join-resolution-metadata'
  | 'dash-join-seam-evidence'
  | 'render-entry-internal-boundary-fusion'
  | 'smooth-continuity-ownership'
  | 'descriptor-channel-separation'
  | 'hidden-output-non-geometry'
  | 'paint-only-non-geometry'
  | 'cache-hit-non-geometry'

export type StrokeVisualRuntimeEvidenceField =
  | 'computedStrokeState'
  | 'renderEntries'
  | 'ownerStage'
  | 'visibleContributor'
  | 'geometryBasis'
  | 'routeId'
  | 'productSignature'
  | 'productMode'
  | 'authoredJoin'
  | 'resolvedJoin'
  | 'vertexAngle'
  | 'miterAngle'
  | 'angleSource'
  | 'angleComparison'
  | 'joinOwnershipRecords'
  | 'internalSharedBoundaryRenderPolygons'
  | 'descriptorProductPolygonsVisible'
  | 'pipelineTrace'
  | 'pipelineCounters'

export type StrokeVisualDimension =
  | 'high-acute-vector-34'
  | 'ordinary-sharp-join'
  | 'dash-join-seam'
  | 'smooth-high-curvature'
  | 'descriptor-channel'
  | 'hidden-output'
  | 'paint-only'
  | 'cache-hit'
  | 'screenshot-crop'
  | 'runtime-metadata-first'

export interface StrokeVisualE2ECoverageCase {
  id: string
  title: string
  testFile: string
  userAction: string
  fixtureId: string
  specRuleRefs: readonly string[]
  inspectorStepRefs: readonly string[]
  inspectorRouteRefs: readonly string[]
  validationGateRefs: readonly string[]
  formalOracleMatrixCaseIds: readonly string[]
  formalOracleRefs: readonly string[]
  integrationRefs: readonly string[]
  runtimeMetadataAssertions: readonly StrokeVisualRuntimeAssertion[]
  requiredRuntimeEvidenceFields: readonly StrokeVisualRuntimeEvidenceField[]
  screenshotAssertions: readonly string[]
  forbiddenContributors: readonly string[]
  artifactRequirements: readonly StrokeVisualArtifactRequirement[]
  dimensions: readonly StrokeVisualDimension[]
  viewport: {
    width: number
    height: number
  }
  zoomPercents: readonly number[]
}

const spec = (anchor: string) =>
  `docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#${anchor}`

const oracle = (fileName: string, testName: string) =>
  `packages/preset/src/__tests__/stroke-geometry-oracles/${fileName}#${testName}`

const integration = (fileName: string, caseId: string) =>
  `packages/preset/src/__tests__/stroke-flow-integration/${fileName}#${caseId}`

const newFlowSpec = (fileName: string) =>
  `apps/asyra-design/e2e/stroke-new-flow/${fileName}`

export const requiredStrokeVisualDimensions: readonly StrokeVisualDimension[] =
  [
    'high-acute-vector-34',
    'ordinary-sharp-join',
    'dash-join-seam',
    'smooth-high-curvature',
    'descriptor-channel',
    'hidden-output',
    'paint-only',
    'cache-hit',
    'screenshot-crop',
    'runtime-metadata-first'
  ]

export const requiredStrokeVisualArtifacts: readonly StrokeVisualArtifactRequirement[] =
  ['metadata-json', 'full-screenshot', 'focused-crop', 'case-summary']

export const visualReviewBaseUrlEnvName = 'ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL'
export const playwrightBaseUrlEnvName = 'PLAYWRIGHT_TEST_BASE_URL'

const getAppEnvFilePath = () => {
  const candidates = [
    resolve(process.cwd(), 'apps/asyra-design/.env'),
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../apps/asyra-design/.env')
  ]
  const envFilePath = candidates.find((candidate) => existsSync(candidate))
  if (!envFilePath) {
    throw new Error(
      'Missing apps/asyra-design/.env for stroke visual review base URL'
    )
  }
  return envFilePath
}

export const readVisualReviewBaseUrlFromEnvFile = (
  envFileText = readFileSync(getAppEnvFilePath(), 'utf8')
) => {
  const match = envFileText.match(/^ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL=(.+)$/m)
  if (!match?.[1]) {
    throw new Error(
      'Missing ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL in apps/asyra-design/.env'
    )
  }
  return match[1].trim()
}

export const requiredVisualReviewBaseUrl = readVisualReviewBaseUrlFromEnvFile()

export const strokeVisualE2ECoverageMap: readonly StrokeVisualE2ECoverageCase[] =
  [
    {
      id: 'reported-vector-34-high-acute-joins',
      title:
        'Reported vector-34 high-acute outside dashed joins preserve runtime product ownership before screenshots',
      testFile: newFlowSpec('reported-vector-34-high-acute-joins.spec.ts'),
      userAction:
        'Create the reported vector-34 fixture, select the vector stroke, and switch authored join through miter, bevel, and round.',
      fixtureId: 'reported-vector-34',
      specRuleRefs: [
        spec('asyra-join-resolution-baseline'),
        spec('source-domain-angle-evidence'),
        spec('dash-body-and-join-seam-contract'),
        spec('canonical-visual-review-and-completion-dod')
      ],
      inspectorStepRefs: [
        'build-dash-interval-body-products',
        'build-source-vertex-join-products',
        'render-entries',
        'renderer-projection'
      ],
      inspectorRouteRefs: [
        'constrained-dashed-interval-body-product',
        'constrained-dashed-source-vertex-join-product',
        'canonical-final-face-render-entry',
        'render-projection-merge'
      ],
      validationGateRefs: ['visible-final-result'],
      formalOracleMatrixCaseIds: [
        'reported-vector-34-runtime-product-boundary',
        'source-vertex-join-resolution-matrix',
        'dash-body-source-vertex-seam'
      ],
      formalOracleRefs: [
        oracle(
          'reported-vector-34-seam-footprint-classes-oracle.test.ts',
          'keeps constrained outside dashed miter, bevel, and round source-vertex footprints distinct in runtime product artifacts'
        ),
        oracle(
          'reported-vector-34-seam-join-connectivity-oracle.test.ts',
          'connects reported miter sharp source-vertex joins to incident dash bodies without seam gaps'
        ),
        oracle(
          'reported-vector-34-seam-join-connectivity-oracle.test.ts',
          'connects reported bevel sharp source-vertex joins to incident dash bodies without seam gaps'
        ),
        oracle(
          'reported-vector-34-seam-join-connectivity-oracle.test.ts',
          'connects reported round sharp source-vertex joins to incident dash bodies without seam gaps'
        )
      ],
      integrationRefs: [
        integration(
          'stroke-integration-coverage-map.ts',
          'constrained-dashed-product-coexecution-chain'
        )
      ],
      runtimeMetadataAssertions: [
        'computed-stroke-state',
        'render-entry-presence',
        'owner-stage-metadata',
        'visible-contributor-metadata',
        'geometry-basis-metadata',
        'route-product-signature-metadata',
        'source-vertex-join-metadata',
        'join-resolution-metadata',
        'dash-join-seam-evidence',
        'render-entry-internal-boundary-fusion'
      ],
      requiredRuntimeEvidenceFields: [
        'computedStrokeState',
        'renderEntries',
        'ownerStage',
        'visibleContributor',
        'geometryBasis',
        'routeId',
        'productSignature',
        'productMode',
        'authoredJoin',
        'resolvedJoin',
        'vertexAngle',
        'miterAngle',
        'angleSource',
        'angleComparison',
        'joinOwnershipRecords',
        'internalSharedBoundaryRenderPolygons'
      ],
      screenshotAssertions: [
        'Capture one full viewport screenshot per join.',
        'Capture one focused crop centered on the reported top high-acute source vertex at 2300 percent zoom.'
      ],
      forbiddenContributors: [
        'endpoint cap seam repair',
        'terminal bridge seam repair',
        'source path replay',
        'renderer descriptor replay across authored sharp joins',
        'descriptor evidence promoted to visible product'
      ],
      artifactRequirements: requiredStrokeVisualArtifacts,
      dimensions: [
        'high-acute-vector-34',
        'dash-join-seam',
        'screenshot-crop',
        'runtime-metadata-first'
      ],
      viewport: { width: 1600, height: 1200 },
      zoomPercents: [180, 2300]
    },
    {
      id: 'ordinary-sharp-join-switching',
      title:
        'Reference acute authored joins remain visually and semantically distinct when users switch join type',
      testFile: newFlowSpec('ordinary-sharp-join-switching.spec.ts'),
      userAction:
        'Create a red 50% outside dashed acute vector, select it, and switch authored join through miter, bevel, and round.',
      fixtureId: 'reference-acute-outside-dashed',
      specRuleRefs: [
        spec('asyra-join-resolution-baseline'),
        spec('dash-body-and-join-seam-contract'),
        spec('local-composition-caps-and-joins'),
        spec('canonical-visual-rules')
      ],
      inspectorStepRefs: [
        'build-dash-interval-body-products',
        'build-source-vertex-join-products',
        'render-entries',
        'renderer-projection'
      ],
      inspectorRouteRefs: [
        'constrained-dashed-interval-body-product',
        'constrained-dashed-source-vertex-join-product',
        'canonical-final-face-render-entry',
        'render-projection-merge'
      ],
      validationGateRefs: ['visible-final-result'],
      formalOracleMatrixCaseIds: [
        'source-vertex-join-resolution-matrix',
        'dash-body-source-vertex-seam'
      ],
      formalOracleRefs: [
        oracle(
          'join-dash-product-oracle.test.ts',
          'distinguishes miter, bevel, and round footprints on ordinary acute joins while keeping seam endpoints on the canonical footprint'
        )
      ],
      integrationRefs: [
        integration(
          'stroke-integration-coverage-map.ts',
          'constrained-dashed-product-coexecution-chain'
        )
      ],
      runtimeMetadataAssertions: [
        'computed-stroke-state',
        'render-entry-presence',
        'owner-stage-metadata',
        'visible-contributor-metadata',
        'geometry-basis-metadata',
        'route-product-signature-metadata',
        'source-vertex-join-metadata',
        'join-resolution-metadata',
        'dash-join-seam-evidence'
      ],
      requiredRuntimeEvidenceFields: [
        'computedStrokeState',
        'renderEntries',
        'ownerStage',
        'visibleContributor',
        'geometryBasis',
        'routeId',
        'productSignature',
        'productMode',
        'authoredJoin',
        'resolvedJoin',
        'vertexAngle',
        'miterAngle',
        'angleSource',
        'angleComparison',
        'joinOwnershipRecords'
      ],
      screenshotAssertions: [
        'Capture comparable red 50% outside dashed focused crops for miter, bevel, and round against a visible green fill reference.',
        'Pixel-probe terminal seam and dash-body regions for miter, bevel, and round so comb-like cracks, missing terminal dashes, and seam gaps fail.',
        'Pixel-probe expected gap and fill-domain wrong-side regions so gap leaks and inside-fill outside-stroke leaks fail.',
        'Reject runtime render entries that carry internally shared-boundary polygons into renderer projection.',
        'Record a runtime metadata hash per join so visual crops cannot be the only evidence.'
      ],
      forbiddenContributors: [
        'endpoint cap seam repair',
        'terminal bridge seam repair',
        'duplicate interval paint',
        'renderer stroke join ownership',
        'comb-like dash body fragments',
        'fill-domain wrong-side stroke pixels'
      ],
      artifactRequirements: requiredStrokeVisualArtifacts,
      dimensions: [
        'ordinary-sharp-join',
        'dash-join-seam',
        'screenshot-crop',
        'runtime-metadata-first'
      ],
      viewport: { width: 1500, height: 1100 },
      zoomPercents: [2300]
    },
    {
      id: 'independent-terminal-half-dash-pixel-oracle',
      title:
        'Independent constrained inside and outside dashed segments preserve start/end terminal pixels and unpainted gaps',
      testFile: newFlowSpec(
        'independent-terminal-half-dash-pixel-oracle.spec.ts'
      ),
      userAction:
        'Create red 50% constrained dashed acute vectors, inspect each independent source segment endpoint, and pixel-probe terminal and gap zones.',
      fixtureId: 'reference-acute-independent-constrained-dashed',
      specRuleRefs: [
        spec('dash-body-and-join-seam-contract'),
        spec('dashed-separation'),
        spec('canonical-visual-review-and-completion-dod')
      ],
      inspectorStepRefs: [
        'allocate-dash-intervals',
        'build-dash-interval-body-products',
        'build-terminal-body-products',
        'apply-legality',
        'build-final-faces',
        'materialize-stroke-product-descriptors',
        'render-entries',
        'renderer-projection'
      ],
      inspectorRouteRefs: [
        'constrained-dashed-interval-body-product',
        'constrained-dashed-products-coexecute-terminal-body-products',
        'canonical-final-face-render-entry',
        'constrained-dashed-descriptor-materialization',
        'render-projection-merge'
      ],
      validationGateRefs: ['visible-final-result'],
      formalOracleMatrixCaseIds: [
        'constrained-dashed-product-owner-classes',
        'reported-vector-34-runtime-product-boundary'
      ],
      formalOracleRefs: [
        oracle(
          'reported-vector-34-terminal-reference-oracle.test.ts',
          'keeps constrained inside terminal half-dash products painted near every independent segment endpoint'
        ),
        oracle(
          'reported-vector-34-terminal-reference-oracle.test.ts',
          'keeps constrained outside terminal half-dash products painted near every independent segment endpoint'
        )
      ],
      integrationRefs: [
        integration(
          'stroke-integration-coverage-map.ts',
          'constrained-dashed-product-coexecution-chain'
        )
      ],
      runtimeMetadataAssertions: [
        'computed-stroke-state',
        'render-entry-presence',
        'owner-stage-metadata',
        'visible-contributor-metadata',
        'geometry-basis-metadata',
        'route-product-signature-metadata',
        'dash-join-seam-evidence'
      ],
      requiredRuntimeEvidenceFields: [
        'computedStrokeState',
        'renderEntries',
        'ownerStage',
        'visibleContributor',
        'geometryBasis',
        'routeId',
        'productSignature',
        'productMode',
        'joinOwnershipRecords'
      ],
      screenshotAssertions: [
        'Start terminal dash zones must contain painted red pixels.',
        'End terminal dash zones must contain painted red pixels.',
        'Expected interior gap zones must not contain red stroke pixels.',
        'Missing endpoint half dash must fail before closure can be claimed.'
      ],
      forbiddenContributors: [
        'renderer-local endpoint repair',
        'fixture-specific endpoint paint',
        'visual fallback terminal repair',
        'descriptor evidence promoted to visible product'
      ],
      artifactRequirements: requiredStrokeVisualArtifacts,
      dimensions: [
        'ordinary-sharp-join',
        'dash-join-seam',
        'screenshot-crop',
        'runtime-metadata-first'
      ],
      viewport: { width: 1500, height: 1100 },
      zoomPercents: [260]
    },
    {
      id: 'smooth-curvature-non-join',
      title:
        'High-curvature smooth spans stay smooth-continuity products and do not become source-vertex joins',
      testFile: newFlowSpec('smooth-curvature-non-join.spec.ts'),
      userAction:
        'Create a dashed outside vector with tangent-continuous high-curvature smooth anchors and inspect focused smooth-span crops.',
      fixtureId: 'smooth-high-curvature-outside-dashed',
      specRuleRefs: [
        spec('smooth-curvature-non-join-contract'),
        spec('dash-body-and-join-seam-contract'),
        spec('canonical-visual-review-and-completion-dod')
      ],
      inspectorStepRefs: [
        'build-source-vertex-join-products',
        'build-smooth-continuity-products',
        'render-entries',
        'renderer-projection'
      ],
      inspectorRouteRefs: [
        'constrained-dashed-smooth-continuity-product',
        'smooth-continuity-products-canonical-output-else',
        'render-projection-merge'
      ],
      validationGateRefs: ['visible-final-result'],
      formalOracleMatrixCaseIds: [
        'smooth-continuity-non-join',
        'constrained-dashed-product-owner-classes'
      ],
      formalOracleRefs: [
        oracle(
          'reported-vector-34-smooth-oracle.test.ts',
          'keeps miter smooth anchors out of source-vertex join ownership and prevents fragmented smooth-continuity output'
        ),
        oracle(
          'reported-vector-34-smooth-oracle.test.ts',
          'keeps bevel smooth anchors out of source-vertex join ownership and prevents fragmented smooth-continuity output'
        ),
        oracle(
          'reported-vector-34-smooth-oracle.test.ts',
          'keeps round smooth anchors out of source-vertex join ownership and prevents fragmented smooth-continuity output'
        ),
        oracle(
          'join-dash-product-oracle.test.ts',
          'routes high-curvature smooth continuity away from source-vertex join products'
        )
      ],
      integrationRefs: [
        integration(
          'stroke-integration-coverage-map.ts',
          'constrained-dashed-product-coexecution-chain'
        )
      ],
      runtimeMetadataAssertions: [
        'computed-stroke-state',
        'render-entry-presence',
        'owner-stage-metadata',
        'visible-contributor-metadata',
        'geometry-basis-metadata',
        'route-product-signature-metadata',
        'smooth-continuity-ownership'
      ],
      requiredRuntimeEvidenceFields: [
        'computedStrokeState',
        'renderEntries',
        'ownerStage',
        'visibleContributor',
        'geometryBasis',
        'routeId',
        'productSignature',
        'productMode',
        'pipelineTrace'
      ],
      screenshotAssertions: [
        'Capture the high-curvature smooth span crop.',
        'Attach runtime metadata proving source-vertex join ownership did not claim the smooth anchor.'
      ],
      forbiddenContributors: [
        'source-vertex join ownership for smooth anchors',
        'fragmented smooth-continuity strips',
        'endpoint cap seam repair'
      ],
      artifactRequirements: requiredStrokeVisualArtifacts,
      dimensions: [
        'smooth-high-curvature',
        'screenshot-crop',
        'runtime-metadata-first'
      ],
      viewport: { width: 1500, height: 1100 },
      zoomPercents: [520]
    },
    {
      id: 'descriptor-channel-separation',
      title:
        'Descriptor, render, hit-export, diagnostics, hidden-output, paint-only, and cache-hit evidence stay channel separated',
      testFile: newFlowSpec('descriptor-channel-separation.spec.ts'),
      userAction:
        'Create stroke fixtures for descriptor-visible, hidden-output, and paint-only states, then verify runtime metadata before screenshots.',
      fixtureId: 'channel-separation-stroke-set',
      specRuleRefs: [
        spec('product-legality-and-descriptor-encoding'),
        spec('output-channel-separation'),
        spec('descriptor-channel-cache-and-drag-contracts'),
        spec('stroke-parameter-stage-cache-rule')
      ],
      inspectorStepRefs: [
        'stage-product-cache',
        'attach-paint-payload',
        'build-final-faces',
        'materialize-stroke-product-descriptors',
        'emit-render-hit-export-packets',
        'render-entries',
        'renderer-projection',
        'hit-export'
      ],
      inspectorRouteRefs: [
        'paint-only-cache-retint',
        'hidden-output-cache-bypass',
        'verified-product-descriptor-cache-hit',
        'constrained-dashed-descriptor-materialization',
        'descriptor-output-versus-canonical-packet-output',
        'hit-export-channel-packet-projection'
      ],
      validationGateRefs: ['visible-final-result'],
      formalOracleMatrixCaseIds: [
        'descriptor-final-face-channel-separation',
        'bypass-cache-geometry-applicability'
      ],
      formalOracleRefs: [
        oracle(
          'cap-terminal-channel-oracle.test.ts',
          'keeps descriptor evidence and final-face channels separated from visible product ownership'
        ),
        oracle(
          'reported-vector-34-output-metadata-ownership-oracle.test.ts',
          'preserves miter runtime metadata and prevents renderer descriptor replay from owning sharp join shape'
        ),
        oracle(
          'reported-vector-34-output-metadata-ownership-oracle.test.ts',
          'preserves bevel runtime metadata and prevents renderer descriptor replay from owning sharp join shape'
        ),
        oracle(
          'reported-vector-34-output-metadata-ownership-oracle.test.ts',
          'preserves round runtime metadata and prevents renderer descriptor replay from owning sharp join shape'
        )
      ],
      integrationRefs: [
        integration(
          'stroke-integration-coverage-map.ts',
          'legality-resolved-paint-final-descriptor-chain'
        ),
        integration(
          'stroke-integration-coverage-map.ts',
          'dirty-cache-bypass-and-source-drag-routes'
        )
      ],
      runtimeMetadataAssertions: [
        'computed-stroke-state',
        'render-entry-presence',
        'owner-stage-metadata',
        'visible-contributor-metadata',
        'geometry-basis-metadata',
        'route-product-signature-metadata',
        'descriptor-channel-separation',
        'hidden-output-non-geometry',
        'paint-only-non-geometry',
        'cache-hit-non-geometry'
      ],
      requiredRuntimeEvidenceFields: [
        'computedStrokeState',
        'renderEntries',
        'ownerStage',
        'visibleContributor',
        'geometryBasis',
        'routeId',
        'productSignature',
        'productMode',
        'descriptorProductPolygonsVisible',
        'pipelineTrace',
        'pipelineCounters'
      ],
      screenshotAssertions: [
        'Capture a descriptor-visible state after metadata validation.',
        'Capture hidden-output and paint-only states with summaries proving they are not geometry sources.'
      ],
      forbiddenContributors: [
        'descriptor evidence promoted to visible product',
        'diagnostic geometry as product source',
        'hit/export dependency on renderer raster output',
        'cache reuse as render-only product repair'
      ],
      artifactRequirements: requiredStrokeVisualArtifacts,
      dimensions: [
        'descriptor-channel',
        'hidden-output',
        'paint-only',
        'cache-hit',
        'screenshot-crop',
        'runtime-metadata-first'
      ],
      viewport: { width: 1500, height: 1100 },
      zoomPercents: [360]
    }
  ]
