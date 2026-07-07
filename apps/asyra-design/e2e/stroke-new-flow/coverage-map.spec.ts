import { expect, test } from '@playwright/test'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  requiredStrokeVisualArtifacts,
  requiredStrokeVisualDimensions,
  requiredVisualReviewBaseUrl,
  strokeVisualE2ECoverageMap
} from './stroke-visual-e2e-coverage-map'
import { strokeE2EResidueCoverageMap } from './stroke-e2e-residue-coverage-map'

interface InspectorData {
  steps: { id: string }[]
  conditionalRoutes: { id: string }[]
  routeContractErrors: string[]
  inspectorContractErrors: string[]
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = resolve(__dirname, '../../../../')
const appRoot = resolve(repoRoot, 'apps/asyra-design')
const specPath = resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md'
)
const bddFeaturePath = resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/bdd-features/stroke-visual-validation.feature'
)
const testHarnessPath = resolve(
  repoRoot,
  'apps/asyra-design/e2e/stroke-new-flow/test-harness.ts'
)
const inspectorPath = resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js'
)
const oracleCoverageMapPath = resolve(
  repoRoot,
  'packages/preset/src/__tests__/stroke-geometry-oracles/stroke-geometry-oracle-coverage-map.ts'
)
const require = createRequire(import.meta.url)

const walkFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    const stat = statSync(path)
    return stat.isDirectory() ? walkFiles(path) : [path]
  })

const toRepoPath = (path: string) => path.replace(`${repoRoot}/`, '')

const headingToAnchor = (heading: string) =>
  heading
    .replace(/^#+\s+/, '')
    .replace(/`/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')

const readSpecAnchors = () =>
  new Set(
    readFileSync(specPath, 'utf8')
      .split('\n')
      .filter((line) => /^#{2,4}\s+/.test(line))
      .map(headingToAnchor)
  )

const loadInspectorData = (): InspectorData => {
  const windowRecord: { STROKE_FLOW_INSPECTOR_DATA?: InspectorData } = {}
  ;(globalThis as typeof globalThis & { window?: unknown }).window =
    windowRecord
  Reflect.deleteProperty(require.cache, require.resolve(inspectorPath))
  require(inspectorPath)
  const data = windowRecord.STROKE_FLOW_INSPECTOR_DATA
  expect(data).toBeDefined()
  return data as InspectorData
}

const splitRef = (ref: string) => {
  const [filePath, fragment = ''] = ref.split('#')
  return {
    filePath,
    fragment
  }
}

const expectFileRefContainsFragment = (ref: string) => {
  const { filePath, fragment } = splitRef(ref)
  const absolutePath = resolve(repoRoot, filePath)
  expect(existsSync(absolutePath), ref).toBe(true)
  if (fragment) {
    expect(readFileSync(absolutePath, 'utf8'), ref).toContain(fragment)
  }
}

const readFormalOracleMatrixCaseIds = () =>
  new Set(
    [...readFileSync(oracleCoverageMapPath, 'utf8').matchAll(/id: '([^']+)'/g)]
      .map((match) => match[1])
      .filter(Boolean)
  )

const getOutsideNewFlowStrokeLikeE2EResidueFiles = () =>
  walkFiles(resolve(repoRoot, 'apps/asyra-design/e2e'))
    .map(toRepoPath)
    .filter(
      (file) => !file.startsWith('apps/asyra-design/e2e/stroke-new-flow/')
    )
    .filter((file) => {
      if (
        file ===
        'apps/asyra-design/e2e/stroke-drag-render-performance.helpers.ts'
      ) {
        return true
      }
      if (file.startsWith('apps/asyra-design/e2e/definitions/')) {
        return /\.md$/.test(file)
      }
      if (!/\.spec\.ts$/.test(file)) {
        return false
      }
      return /stroke|Stroke|vector|Vector|dash|Dash/.test(
        readFileSync(resolve(repoRoot, file), 'utf8')
      )
    })
    .sort()

test.describe('new stroke visual/E2E coverage map', () => {
  test('requires the agent-run visual review URL override to use localhost:3001', () => {
    expect(process.env.ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL).toBe(
      requiredVisualReviewBaseUrl
    )
    expect(process.env.PLAYWRIGHT_TEST_BASE_URL).toBe(
      requiredVisualReviewBaseUrl
    )

    const envFile = readFileSync(resolve(appRoot, '.env'), 'utf8')
    expect(envFile).toContain('ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL=')
    expect(envFile).toContain('PLAYWRIGHT_TEST_BASE_URL=')
  })

  test('references existing spec anchors, inspector runtime routes, and post-runtime validation gates', () => {
    const inspector = loadInspectorData()
    const specAnchors = readSpecAnchors()
    const stepIds = new Set(inspector.steps.map((step) => step.id))
    const routeIds = new Set(
      inspector.conditionalRoutes.map((route) => route.id)
    )
    const activePlan = readFileSync(
      resolve(repoRoot, 'docs/ai/apps/asyra-design/PLANS.md'),
      'utf8'
    )
    const readme = readFileSync(specPath, 'utf8')
    const validationGateIds = new Set(['visible-final-result'])

    expect(inspector.steps).toHaveLength(41)
    expect('validationGates' in inspector).toBe(false)
    expect(readme).toContain('visible-final-result')
    expect(activePlan).toContain('visible-final-result')
    expect(readme).toContain('post-runtime validation gate')
    expect(activePlan).toContain('post-runtime validation gate')
    expect(validationGateIds.has('visible-final-result')).toBe(true)
    expect(inspector.routeContractErrors).toEqual([])
    expect(inspector.inspectorContractErrors).toEqual([])

    for (const entry of strokeVisualE2ECoverageMap) {
      expect(entry.id).toMatch(/^[a-z0-9-]+$/)
      expect(
        existsSync(resolve(repoRoot, entry.testFile)),
        entry.testFile
      ).toBe(true)
      expect(entry.specRuleRefs.length, entry.id).toBeGreaterThan(0)
      expect(entry.inspectorStepRefs.length, entry.id).toBeGreaterThan(0)
      expect(entry.inspectorRouteRefs.length, entry.id).toBeGreaterThan(0)
      expect(entry.validationGateRefs, entry.id).toContain(
        'visible-final-result'
      )

      for (const specRef of entry.specRuleRefs) {
        const { filePath, fragment } = splitRef(specRef)
        expect(filePath).toBe(
          'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md'
        )
        expect(specAnchors.has(fragment), `${entry.id}:${fragment}`).toBe(true)
      }
      for (const stepId of entry.inspectorStepRefs) {
        expect(stepIds.has(stepId), `${entry.id}:${stepId}`).toBe(true)
      }
      for (const routeId of entry.inspectorRouteRefs) {
        expect(routeIds.has(routeId), `${entry.id}:${routeId}`).toBe(true)
      }
      for (const gateId of entry.validationGateRefs) {
        expect(validationGateIds.has(gateId), `${entry.id}:${gateId}`).toBe(
          true
        )
      }
    }
  })

  test('ties every visual case to current oracle and integration evidence', () => {
    const matrixCaseIds = readFormalOracleMatrixCaseIds()

    for (const entry of strokeVisualE2ECoverageMap) {
      expect(entry.formalOracleMatrixCaseIds.length, entry.id).toBeGreaterThan(
        0
      )
      expect(entry.formalOracleRefs.length, entry.id).toBeGreaterThan(0)
      expect(entry.integrationRefs.length, entry.id).toBeGreaterThan(0)
      for (const caseId of entry.formalOracleMatrixCaseIds) {
        expect(matrixCaseIds.has(caseId), `${entry.id}:${caseId}`).toBe(true)
      }
      for (const ref of [...entry.formalOracleRefs, ...entry.integrationRefs]) {
        expect(ref).toMatch(
          /^packages\/preset\/src\/__tests__\/stroke-(geometry-oracles|flow-integration)\//
        )
        expectFileRefContainsFragment(ref)
      }
    }
  })

  test('keeps outside-new-flow E2E residue non-authoritative', () => {
    const inspector = loadInspectorData()
    const specAnchors = readSpecAnchors()
    const stepIds = new Set(inspector.steps.map((step) => step.id))
    const routeIds = new Set(
      inspector.conditionalRoutes.map((route) => route.id)
    )
    const residueFiles = strokeE2EResidueCoverageMap
      .map((entry) => entry.filePath)
      .sort()

    expect(residueFiles).toEqual(getOutsideNewFlowStrokeLikeE2EResidueFiles())

    for (const entry of strokeE2EResidueCoverageMap) {
      expect(
        existsSync(resolve(repoRoot, entry.filePath)),
        entry.filePath
      ).toBe(true)
      expect(entry.filePath, entry.filePath).not.toContain(
        'apps/asyra-design/e2e/stroke-new-flow/'
      )
      expect(entry.currentStrokeCorrectnessGate, entry.filePath).toBe(false)
      expect(entry.definesStrokeSemantics, entry.filePath).toBe(false)
      expect(entry.allowedUse, entry.filePath).toMatch(
        /evidence|reference|user-behavior/
      )
      expect(entry.requiredActionBeforePromotion, entry.filePath).toBeTruthy()

      for (const specRef of entry.specRuleRefs) {
        const { filePath, fragment } = splitRef(specRef)
        expect(filePath, specRef).toBe(
          'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md'
        )
        expect(specAnchors.has(fragment), specRef).toBe(true)
      }
      for (const stepId of entry.inspectorStepRefs) {
        expect(stepIds.has(stepId), `${entry.filePath}:${stepId}`).toBe(true)
      }
      for (const routeId of entry.inspectorRouteRefs) {
        expect(routeIds.has(routeId), `${entry.filePath}:${routeId}`).toBe(true)
      }
    }
  })

  test('keeps E2E definition files as reference material instead of semantics authority', () => {
    const definitionFiles = strokeE2EResidueCoverageMap
      .filter((entry) =>
        entry.filePath.startsWith('apps/asyra-design/e2e/definitions/')
      )
      .map((entry) => entry.filePath)
      .sort()

    expect(definitionFiles).toContain(
      'apps/asyra-design/e2e/definitions/README.md'
    )

    for (const file of definitionFiles) {
      const source = readFileSync(resolve(repoRoot, file), 'utf8')

      expect(source, file).toContain('non-authoritative')
      expect(source, file).not.toMatch(/canvas as the source of truth/i)
      expect(source, file).not.toMatch(/human-readable contract/i)
      expect(source, file).not.toMatch(/defines (?:a|the).*visual oracle/i)
      expect(source, file).not.toContain('defines the screenshot-level oracle')
      expect(source, file).not.toContain('## Input Contract')
      expect(source, file).not.toContain('## Visual Contract')
      expect(source, file).not.toContain('## Required formal product behavior')
    }
  })

  test('keeps every visual case metadata-first and artifact-complete', () => {
    const coveredDimensions = new Set(
      strokeVisualE2ECoverageMap.flatMap((entry) => [...entry.dimensions])
    )

    for (const dimension of requiredStrokeVisualDimensions) {
      expect(coveredDimensions.has(dimension), dimension).toBe(true)
    }

    for (const entry of strokeVisualE2ECoverageMap) {
      expect(entry.runtimeMetadataAssertions.length, entry.id).toBeGreaterThan(
        0
      )
      expect(
        entry.requiredRuntimeEvidenceFields.length,
        entry.id
      ).toBeGreaterThan(0)
      expect(entry.runtimeMetadataAssertions, entry.id).toContain(
        'computed-stroke-state'
      )
      expect(entry.requiredRuntimeEvidenceFields, entry.id).toContain(
        'computedStrokeState'
      )
      expect(entry.requiredRuntimeEvidenceFields, entry.id).toContain(
        'renderEntries'
      )
      expect(entry.screenshotAssertions.length, entry.id).toBeGreaterThan(0)
      expect(entry.forbiddenContributors.length, entry.id).toBeGreaterThan(0)
      expect(entry.dimensions, entry.id).toContain('runtime-metadata-first')
      expect(entry.dimensions, entry.id).toContain('screenshot-crop')
      expect([...entry.artifactRequirements].sort(), entry.id).toEqual(
        [...requiredStrokeVisualArtifacts].sort()
      )
      expect(entry.viewport.width, entry.id).toBeGreaterThan(0)
      expect(entry.viewport.height, entry.id).toBeGreaterThan(0)
      expect(entry.zoomPercents.length, entry.id).toBeGreaterThan(0)
    }
  })

  test('requires app runtime route metadata before product-visible screenshot capture', () => {
    const productVisibleRuntimeAssertions = [
      'render-entry-presence',
      'owner-stage-metadata',
      'visible-contributor-metadata',
      'geometry-basis-metadata',
      'route-product-signature-metadata'
    ] as const
    const productVisibleRuntimeFields = [
      'ownerStage',
      'visibleContributor',
      'geometryBasis',
      'routeId',
      'productSignature',
      'productMode'
    ] as const

    for (const entry of strokeVisualE2ECoverageMap) {
      for (const assertion of productVisibleRuntimeAssertions) {
        expect(
          entry.runtimeMetadataAssertions,
          `${entry.id}:${assertion}`
        ).toContain(assertion)
      }
      for (const field of productVisibleRuntimeFields) {
        expect(
          entry.requiredRuntimeEvidenceFields,
          `${entry.id}:${field}`
        ).toContain(field)
      }

      if (entry.dimensions.includes('dash-join-seam')) {
        expect(entry.runtimeMetadataAssertions, entry.id).toContain(
          'dash-join-seam-evidence'
        )
        expect(entry.requiredRuntimeEvidenceFields, entry.id).toContain(
          'joinOwnershipRecords'
        )
      }
      if (entry.dimensions.includes('descriptor-channel')) {
        expect(entry.runtimeMetadataAssertions, entry.id).toContain(
          'descriptor-channel-separation'
        )
        expect(entry.requiredRuntimeEvidenceFields, entry.id).toContain(
          'descriptorProductPolygonsVisible'
        )
      }
      if (entry.dimensions.includes('cache-hit')) {
        expect(entry.runtimeMetadataAssertions, entry.id).toContain(
          'cache-hit-non-geometry'
        )
        expect(entry.requiredRuntimeEvidenceFields, entry.id).toContain(
          'pipelineCounters'
        )
      }
    }
  })

  test('requires runtime metadata assertions to use explicit app evidence instead of harness-derived route inference', () => {
    const harnessSource = readFileSync(testHarnessPath, 'utf8')

    expect(harnessSource).not.toContain('deriveRuntimeRouteEvidence')
    expect(harnessSource).not.toContain('derivedRouteEvidence')
  })

  test('documents user behavior in BDD without defining independent stroke geometry semantics', () => {
    const feature = readFileSync(bddFeaturePath, 'utf8')

    expect(feature).toContain('Feature: Stroke visual validation')
    expect(feature).toContain('stroke engine spec is the source')
    expect(feature).toContain('http://localhost:3001')
    expect(feature).not.toContain('vertexAngle >')
    expect(feature).not.toContain('miterAngle')
    expect(feature).not.toContain('bevel-by-miter-angle')
  })

  test('keeps new-flow visual specs on the visual review URL contract', () => {
    const newFlowSources = walkFiles(__dirname)
      .filter((filePath) => /\.(ts|tsx)$/.test(filePath))
      .filter(
        (filePath) =>
          !filePath.endsWith('coverage-map.spec.ts') &&
          !filePath.endsWith('stroke-visual-e2e-coverage-map.ts')
      )

    for (const filePath of newFlowSources) {
      const source = readFileSync(filePath, 'utf8')
      expect(source, `${filePath} must not use localhost:3000`).not.toContain(
        'localhost:3000'
      )
    }
  })
})
