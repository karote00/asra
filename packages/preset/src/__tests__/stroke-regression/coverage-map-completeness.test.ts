import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { strokeIntegrationCoverageMap } from '../stroke-flow-integration/stroke-integration-coverage-map'
import { strokeGeometryOracleCoverageMap } from '../stroke-geometry-oracles/stroke-geometry-oracle-coverage-map'
import {
  requiredStrokeRegressionLayers,
  requiredStrokeRegressionRiskClasses,
  strokeRegressionCoverageMap
} from './stroke-regression-coverage-map'

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../'
)

const readRepoFile = (path: string) =>
  readFileSync(resolve(repoRoot, path), 'utf8')

const uniqueSorted = (values: readonly string[]) => [...new Set(values)].sort()

const extractVisualCaseIds = () => {
  const source = readRepoFile(
    'apps/asyra-design/e2e/stroke-new-flow/stroke-visual-e2e-coverage-map.ts'
  )
  return new Set(
    [...source.matchAll(/id: '([^']+)'/g)].map((match) => match[1])
  )
}

const packageJson = JSON.parse(
  readRepoFile('packages/preset/package.json')
) as {
  scripts: Record<string, string>
}

describe('new stroke regression coverage map', () => {
  it('declares a complete regression responsibility layer instead of relying on reported cases', () => {
    const coveredLayers = uniqueSorted(
      strokeRegressionCoverageMap.flatMap((entry) => [...entry.layers])
    )
    const coveredRiskClasses = uniqueSorted(
      strokeRegressionCoverageMap.flatMap((entry) => [...entry.riskClasses])
    )

    expect(coveredLayers).toEqual([...requiredStrokeRegressionLayers].sort())
    expect(coveredRiskClasses).toEqual(
      [...requiredStrokeRegressionRiskClasses].sort()
    )

    for (const entry of strokeRegressionCoverageMap) {
      expect(entry.id).toMatch(/^[a-z0-9-]+$/)
      expect(entry.title.length, entry.id).toBeGreaterThan(0)
      expect(entry.sourceOfTruthRefs.length, entry.id).toBeGreaterThan(0)
      expect(entry.gateScripts.length, entry.id).toBeGreaterThan(0)
      expect(entry.fullRegressionPolicy.length, entry.id).toBeGreaterThan(0)
      expect(entry.positiveAssertions.length, entry.id).toBeGreaterThan(0)
      expect(entry.forbiddenAssertions.length, entry.id).toBeGreaterThan(0)
    }
  })

  it('keeps regression scripts explicit and separate from full-package regression', () => {
    expect(packageJson.scripts['test:stroke:regression']).toBe(
      'vitest run src/__tests__/stroke-test-architecture.test.ts src/__tests__/stroke-regression/*.test.ts --reporter=dot'
    )
    expect(packageJson.scripts['test:stroke:new']).toBe(
      'yarn test:stroke-flow:unit && yarn test:stroke-flow:validation && yarn test:stroke-flow:integration && yarn test:stroke-geometry:oracle && yarn test:stroke:regression'
    )
    expect(packageJson.scripts['test:stroke:regression']).not.toContain(
      'test:local'
    )
    expect(packageJson.scripts['test:stroke:new']).not.toContain('test:local')
  })

  it('references existing integration, oracle, and visual evidence', () => {
    const integrationIds = new Set(
      strokeIntegrationCoverageMap.map((entry) => entry.id)
    )
    const oracleIds = new Set(
      strokeGeometryOracleCoverageMap.map((entry) => entry.id)
    )
    const visualIds = extractVisualCaseIds()

    for (const entry of strokeRegressionCoverageMap) {
      for (const id of entry.integrationCaseIds) {
        expect(integrationIds.has(id), `${entry.id}:integration:${id}`).toBe(
          true
        )
      }
      for (const id of entry.oracleCaseIds) {
        expect(oracleIds.has(id), `${entry.id}:oracle:${id}`).toBe(true)
      }
      for (const id of entry.visualCaseIds) {
        expect(visualIds.has(id), `${entry.id}:visual:${id}`).toBe(true)
      }
    }
  })

  it('treats vector-34 as one reported regression sample, not as the overall stroke engine driver', () => {
    const vectorReportedRiskOwners = strokeRegressionCoverageMap
      .filter(
        (entry) =>
          JSON.stringify(entry).includes('vector-34') &&
          entry.riskClasses.includes('reported-case-regression')
      )
      .map((entry) => entry.id)

    expect(vectorReportedRiskOwners).toEqual(['reported-case-regression-bucket'])

    const reportedCase = strokeRegressionCoverageMap.find(
      (entry) => entry.id === 'reported-case-regression-bucket'
    )
    expect(reportedCase).toBeDefined()
    expect(reportedCase?.riskClasses).toContain('reported-case-regression')
    expect(reportedCase?.oracleCaseIds).toEqual(
      expect.arrayContaining([
        'reported-vector-34-runtime-product-boundary',
        'source-vertex-join-resolution-matrix',
        'dash-body-source-vertex-seam'
      ])
    )
    expect(reportedCase?.forbiddenAssertions.join(' ')).toContain(
      'vector-specific'
    )
    expect(
      strokeRegressionCoverageMap.filter((entry) =>
        entry.riskClasses.includes('reported-case-regression')
      )
    ).toHaveLength(1)
  })

  it('requires ordered unlocks from new correctness gates to app, full regression, and performance phases', () => {
    const byId = new Map(
      strokeRegressionCoverageMap.map((entry) => [entry.id, entry])
    )

    expect(
      byId.get('app-runtime-evidence-regression')?.requiredPriorGateScripts
    ).toEqual(
      expect.arrayContaining([
        'test:stroke-flow:unit',
        'test:stroke-flow:integration',
        'test:stroke-geometry:oracle',
        'test:stroke:regression'
      ])
    )
    expect(
      byId.get('full-package-regression-phase')?.requiredPriorGateScripts
    ).toEqual(
      expect.arrayContaining([
        'test:stroke-flow:unit',
        'test:stroke-flow:validation',
        'test:stroke-flow:integration',
        'test:stroke-geometry:oracle',
        'test:stroke:regression',
        'test:stroke:new'
      ])
    )
    expect(
      byId.get('drag-performance-regression-phase')?.requiredPriorGateScripts
    ).toEqual(
      expect.arrayContaining([
        'test:stroke:new',
        'app:e2e:stroke-new-flow',
        'test:local'
      ])
    )
  })

  it('keeps the active plan and spec aligned with the new regression gate', () => {
    const plan = readRepoFile('docs/ai/apps/asyra-design/PLANS.md')
    const spec = readRepoFile(
      'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md'
    )

    for (const source of [plan, spec]) {
      expect(source).toContain('test:stroke:regression')
      expect(source).toMatch(/[Rr]eported cases/)
      expect(source).toContain('test:local')
      expect(source).toContain('later phase')
    }
    expect(spec).toMatch(/41 runtime inspector-?step unit tests/)
    expect(spec).not.toContain('42 inspector step unit tests')
  })

  it('keeps app visual and reported-case checks below the new regression matrix authority', () => {
    const spec = readRepoFile(
      'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md'
    )
    const normalizedSpec = spec.replace(/\s+/g, ' ')

    expect(spec).toContain('#### App Visual Matrix')
    expect(normalizedSpec).toContain('not a primary regression authority')
    expect(normalizedSpec).toContain(
      'Reported cases and canonical visual groups are both regression samples inside'
    )
    expect(normalizedSpec).toContain(
      'yarn workspace @asyra/asyra-design test:e2e e2e/stroke-new-flow'
    )
    const oldCanonicalPrimaryClaim = [
      'The 18 canonical groups',
      'are the',
      'highest-priority',
      'stroke renderer',
      'regression gate'
    ].join(' ')
    const oldVisualPrimaryClaim = [
      'highest-priority',
      'stroke renderer',
      'regression gate'
    ].join(' ')
    const oldBroadVisualClaim = [
      'Broad stroke correctness claims',
      'must run the full',
      '18-group',
      'canonical suite'
    ].join(' ')
    expect(spec).not.toContain(
      oldCanonicalPrimaryClaim
    )
    expect(spec).not.toContain(oldVisualPrimaryClaim)
    expect(spec).not.toContain(oldBroadVisualClaim)
  })
})
