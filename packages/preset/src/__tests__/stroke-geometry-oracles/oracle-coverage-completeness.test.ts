import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  requiredStrokeGeometryOracleCaseKinds,
  requiredStrokeGeometryOracleDimensions,
  requiredStrokeGeometryOracleGeometryScenarios,
  requiredStrokeGeometryOracleProductFamilies,
  requiredStrokeGeometryOracleStrokeParameters,
  strokeGeometryOracleCoverageMap
} from './stroke-geometry-oracle-coverage-map'

interface InspectorRoute {
  id: string
}

interface InspectorArtifact {
  id: string
  channel: string
}

interface InspectorStep {
  id: string
}

interface InspectorData {
  steps: InspectorStep[]
  conditionalRoutes: InspectorRoute[]
  artifactRegistry: InspectorArtifact[]
  routeContractErrors: string[]
  inspectorContractErrors: string[]
}

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../'
)
const require = createRequire(import.meta.url)
const inspectorPath = resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js'
)
const specPath = resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md'
)

let cachedInspectorData: InspectorData | null = null

const loadInspectorData = (): InspectorData => {
  if (cachedInspectorData) {
    return cachedInspectorData
  }
  const windowRecord: { STROKE_FLOW_INSPECTOR_DATA?: InspectorData } = {}
  ;(globalThis as typeof globalThis & { window?: unknown }).window =
    windowRecord
  Reflect.deleteProperty(require.cache, require.resolve(inspectorPath))
  require(inspectorPath)
  const data = windowRecord.STROKE_FLOW_INSPECTOR_DATA
  expect(data).toBeDefined()
  cachedInspectorData = data as InspectorData
  return cachedInspectorData
}

const headingToAnchor = (heading: string) =>
  heading
    .replace(/^#+\s+/, '')
    .replace(/`/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')

const readSpecAnchors = () => {
  const spec = readFileSync(specPath, 'utf8')
  return new Set(
    spec
      .split('\n')
      .filter((line) => /^#{2,4}\s+/.test(line))
      .map(headingToAnchor)
  )
}

const unique = <T>(values: readonly T[]) => [...new Set(values)].sort()

const uniqueSorted = (values: readonly string[]) => [...new Set(values)].sort()

const blockedSourceTokens = [
  ['apps/asyra-design', 'e2e'].join('/'),
  ['stroke-canonical-matrix', 'utils'].join('-'),
  ['stroke-self-check-star', 'fixture'].join('-'),
  ['Play', 'wright'].join(''),
  ['page', 'screenshot'].join('.'),
  ['.', 'png'].join('')
]
const blockedCanvasToken = ['can', 'vas'].join('')

describe('formal stroke geometry oracle coverage map', () => {
  it('references existing inspector steps, routes, artifacts, and spec anchors', () => {
    const data = loadInspectorData()
    const stepIds = new Set(data.steps.map((step) => step.id))
    const routeIds = new Set(data.conditionalRoutes.map((route) => route.id))
    const artifactIds = new Set(
      data.artifactRegistry.map((artifact) => artifact.id)
    )
    const specAnchors = readSpecAnchors()

    expect(data.steps).toHaveLength(41)
    expect(data.steps[27]?.id).toBe('derive-dash-body-seam-boundaries')
    expect(data.steps.at(-1)?.id).toBe('hit-export')
    expect(data.conditionalRoutes).toHaveLength(67)
    expect(data.routeContractErrors).toEqual([])
    expect(data.inspectorContractErrors).toEqual([])
    expect(artifactIds.has('artifact:dash-body-seam-boundary')).toBe(true)

    for (const entry of strokeGeometryOracleCoverageMap) {
      expect(entry.id).toMatch(/^[a-z0-9-]+$/)
      expect(entry.caseKind, entry.id).toBeTruthy()
      expect(entry.coverageStrategy, entry.id).toMatch(
        /^(pairwise-baseline|spec-critical-higher-order)$/
      )
      expect(entry.strokeParameters.length, entry.id).toBeGreaterThan(0)
      expect(entry.geometryScenario.length, entry.id).toBeGreaterThan(0)
      expect(entry.productFamily.length, entry.id).toBeGreaterThan(0)
      expect(entry.ownerStages.length, entry.id).toBeGreaterThan(0)
      expect(entry.stepIds.length, entry.id).toBeGreaterThan(0)
      expect(uniqueSorted([...entry.inspectorStepRefs]), entry.id).toEqual(
        uniqueSorted([...entry.stepIds])
      )
      expect(entry.routeIds.length, entry.id).toBeGreaterThan(0)
      expect(entry.artifactIds.length, entry.id).toBeGreaterThan(0)
      expect(entry.requiredArtifacts.length, entry.id).toBeGreaterThan(0)
      expect(entry.specRuleRefs.length, entry.id).toBeGreaterThan(0)
      expect(entry.requiredGeometryAssertions.length, entry.id).toBeGreaterThan(
        0
      )
      expect(entry.testFiles.length, entry.id).toBeGreaterThan(0)
      expect(entry.testNames.length, entry.id).toBeGreaterThan(0)
      expect(entry.positiveAssertions.length, entry.id).toBeGreaterThan(0)
      expect(entry.forbiddenContributors.length, entry.id).toBeGreaterThan(0)

      for (const stepId of entry.stepIds) {
        expect(stepIds.has(stepId), `${entry.id}:${stepId}`).toBe(true)
      }
      for (const routeId of entry.routeIds) {
        expect(routeIds.has(routeId), `${entry.id}:${routeId}`).toBe(true)
      }
      for (const artifactId of entry.artifactIds) {
        expect(artifactIds.has(artifactId), `${entry.id}:${artifactId}`).toBe(
          true
        )
      }
      for (const requiredArtifactId of entry.requiredArtifacts) {
        expect(
          entry.artifactIds.includes(requiredArtifactId),
          `${entry.id}:${requiredArtifactId}:declared`
        ).toBe(true)
        expect(
          artifactIds.has(requiredArtifactId),
          `${entry.id}:${requiredArtifactId}:registry`
        ).toBe(true)
      }
      for (const specRuleRef of entry.specRuleRefs) {
        expect(specRuleRef).toContain(
          'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#'
        )
        const anchor = specRuleRef.split('#').at(-1) ?? ''
        expect(specAnchors.has(anchor), `${entry.id}:${anchor}`).toBe(true)
      }
    }
  })

  it('covers every required formal geometry oracle dimension', () => {
    const coveredDimensions = unique(
      strokeGeometryOracleCoverageMap.flatMap((entry) => [...entry.dimensions])
    )

    expect(coveredDimensions).toEqual(
      [...requiredStrokeGeometryOracleDimensions].sort()
    )
  })

  it('covers every required matrix case kind, stroke parameter, geometry scenario, and product family', () => {
    expect(
      unique(strokeGeometryOracleCoverageMap.map((entry) => entry.caseKind))
    ).toEqual([...requiredStrokeGeometryOracleCaseKinds].sort())
    expect(
      unique(
        strokeGeometryOracleCoverageMap.flatMap((entry) => [
          ...entry.strokeParameters
        ])
      )
    ).toEqual([...requiredStrokeGeometryOracleStrokeParameters].sort())
    expect(
      unique(
        strokeGeometryOracleCoverageMap.flatMap((entry) => [
          ...entry.geometryScenario
        ])
      )
    ).toEqual([...requiredStrokeGeometryOracleGeometryScenarios].sort())
    expect(
      unique(
        strokeGeometryOracleCoverageMap.flatMap((entry) => [
          ...entry.productFamily
        ])
      )
    ).toEqual([...requiredStrokeGeometryOracleProductFamilies].sort())
  })

  it('requires owner-stage and forbidden-contributor assertions for every product-visible matrix case', () => {
    for (const entry of strokeGeometryOracleCoverageMap) {
      const productVisible = entry.productFamily.some(
        (family) =>
          family !== 'stroke-normalization' &&
          family !== 'non-geometry-bypass' &&
          family !== 'diagnostic-evidence'
      )

      if (!productVisible) {
        continue
      }

      expect(
        entry.requiredGeometryAssertions.includes('owner-stage-metadata'),
        `${entry.id}:owner-stage-metadata`
      ).toBe(true)
      expect(
        entry.requiredGeometryAssertions.includes(
          'forbidden-contributor-absence'
        ),
        `${entry.id}:forbidden-contributor-absence`
      ).toBe(true)
      expect(entry.forbiddenContributors.length, entry.id).toBeGreaterThan(0)
    }
  })

  it('ties every coverage case to executable new-suite tests by exact test title', () => {
    for (const entry of strokeGeometryOracleCoverageMap) {
      for (const testFile of entry.testFiles) {
        expect(testFile).toMatch(
          /^packages\/preset\/src\/__tests__\/stroke-(geometry-oracles|flow-integration)\//
        )
      }

      const sourceFiles = entry.testSourceFiles ?? entry.testFiles
      const sources = sourceFiles.map((testFile) =>
        readFileSync(resolve(repoRoot, testFile), 'utf8')
      )
      const combinedSource = sources.join('\n')

      for (const title of entry.testNames) {
        expect(combinedSource, `${entry.id}:${title}`).toContain(title)
      }
      for (const blockedToken of blockedSourceTokens) {
        expect(combinedSource, `${entry.id}:${blockedToken}`).not.toContain(
          blockedToken
        )
      }
    }
  })

  it('keeps formal oracles product-artifact based instead of screenshot or renderer-pixel based', () => {
    const mapSource = readFileSync(
      resolve(
        repoRoot,
        'packages/preset/src/__tests__/stroke-geometry-oracles/stroke-geometry-oracle-coverage-map.ts'
      ),
      'utf8'
    )

    expect(mapSource).not.toContain('screenshot')
    expect(mapSource).not.toContain('pixel')
    expect(mapSource).not.toContain('visual review')
    expect(mapSource).not.toContain('test:local')

    const artifactDimensions = new Set(
      strokeGeometryOracleCoverageMap.flatMap((entry) => [...entry.dimensions])
    )
    expect(artifactDimensions.has('visible-render-channel')).toBe(true)
    expect(artifactDimensions.has('hit-export-channel')).toBe(true)
    expect(artifactDimensions.has('diagnostics-channel')).toBe(true)
  })

  it('keeps all oracle sources free of stale helpers and image-only correctness proofs', () => {
    const oracleDirectory = resolve(
      repoRoot,
      'packages/preset/src/__tests__/stroke-geometry-oracles'
    )
    const sourceFiles = readdirSync(oracleDirectory)
      .filter((fileName) => fileName.endsWith('.ts'))
      .map((fileName) => resolve(oracleDirectory, fileName))

    for (const sourceFile of sourceFiles) {
      const source = readFileSync(sourceFile, 'utf8')
      for (const blockedToken of blockedSourceTokens) {
        expect(source, `${sourceFile}:${blockedToken}`).not.toContain(
          blockedToken
        )
      }
      expect(source, `${sourceFile}:${blockedCanvasToken}`).not.toContain(
        blockedCanvasToken
      )
    }
  })

  it('maps every oracle case to one focused group, artifact channel set, and single-file gates', () => {
    const data = loadInspectorData()
    const entries = strokeGeometryOracleCoverageMap as readonly (typeof strokeGeometryOracleCoverageMap[number] & {
      oracleGroup?: string
      artifactChannels?: readonly string[]
      focusedGates?: readonly string[]
    })[]
    const expectedGroups = [
      'center-product',
      'constrained-product',
      'dash-cap-join',
      'legality-final-face',
      'normalization-domain',
      'output-channel'
    ]
    const artifactChannelById = new Map(
      data.artifactRegistry.map((artifact) => [artifact.id, artifact.channel])
    )

    expect(unique(entries.map((entry) => entry.oracleGroup))).toEqual(
      expectedGroups
    )
    for (const entry of entries) {
      expect(entry.oracleGroup, entry.id).toBeTruthy()
      expect(entry.artifactChannels, entry.id).toEqual(
        unique(
          entry.artifactIds.map((artifactId) =>
            artifactChannelById.get(artifactId)
          )
        )
      )
      expect(entry.focusedGates, entry.id).toEqual(
        entry.testNames.map(
          (testName) =>
            `yarn workspace @asyra/preset vitest run ${entry.testFiles
              .map((testFile) => testFile.replace('packages/preset/', ''))
              .join(' ')} -t ${JSON.stringify(testName)} --reporter=dot`
        )
      )
    }
  })

  it('keeps each focused title unique and splits oversized runtime aggregates', () => {
    const mappedTestFiles = new Set<string>()
    for (const entry of strokeGeometryOracleCoverageMap) {
      for (const testFile of entry.testFiles) {
        mappedTestFiles.add(testFile)
      }
      for (const testName of entry.testNames) {
        const sourceFiles = entry.testSourceFiles ?? entry.testFiles
        const matchingFiles = sourceFiles.filter((testFile) =>
          readFileSync(resolve(repoRoot, testFile), 'utf8').includes(testName)
        )
        expect(matchingFiles, `${entry.id}:${testName}`).toHaveLength(1)
      }
    }

    const oversizedAggregates = [...mappedTestFiles]
      .filter((testFile) => testFile.endsWith('.test.ts'))
      .map((testFile) => ({
        testFile,
        source: readFileSync(resolve(repoRoot, testFile), 'utf8')
      }))
      .filter(
        ({ source }) =>
          source.split('\n').length > 1000 &&
          [...source.matchAll(/^  it\(/gm)].length > 8
      )
      .map(({ testFile }) => testFile)
    expect(oversizedAggregates).toEqual([])
  })
})
