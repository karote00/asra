import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  requiredBypassOrClassificationRouteIds,
  strokeIntegrationCoverageMap
} from './stroke-integration-coverage-map'

interface InspectorRoute {
  id: string
  from: string
  to: string
  routeType: string
  consumes: string[]
  produces: string[]
}

interface InspectorArtifact {
  id: string
  kind: string
  channel: string
  terminal: boolean
}

interface InspectorCoExecutionRule {
  coExecutionGroup: string
  requiredRouteIds: string[]
  completionArtifactIds: string[]
}

interface InspectorData {
  steps: Array<{ id: string; stepNumber: number }>
  conditionalRoutes: InspectorRoute[]
  artifactRegistry: InspectorArtifact[]
  coExecutionCompletionRules: InspectorCoExecutionRule[]
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

const unique = (values: readonly string[]) => [...new Set(values)].sort()

const coveredRouteIds = () =>
  unique(strokeIntegrationCoverageMap.flatMap((entry) => [...entry.routeIds]))

const coveredArtifactIds = () =>
  unique(strokeIntegrationCoverageMap.flatMap((entry) => [...entry.artifactIds]))

const coveredCoExecutionGroups = () =>
  unique(
    strokeIntegrationCoverageMap.flatMap((entry) => [
      ...entry.coExecutionGroups
    ])
  )

describe('new stroke integration coverage map', () => {
  it('covers every typed inspector route exactly through declared integration cases', () => {
    const data = loadInspectorData()
    const expectedRouteIds = data.conditionalRoutes.map((route) => route.id).sort()
    const routeIds = coveredRouteIds()

    expect(data.routeContractErrors).toEqual([])
    expect(data.inspectorContractErrors).toEqual([])
    expect(data.steps).toHaveLength(41)
    expect(data.conditionalRoutes).toHaveLength(67)
    expect(routeIds).toEqual(expectedRouteIds)
    expect(routeIds).not.toContain('visible-final-result')
  })

  it('covers all non-stage artifacts from the artifact registry', () => {
    const data = loadInspectorData()
    const expectedArtifactIds = data.artifactRegistry
      .filter((artifact) => artifact.kind !== 'stage-output')
      .map((artifact) => artifact.id)
      .sort()

    expect(
      data.artifactRegistry.some(
        (artifact) => artifact.id === 'artifact:dash-body-seam-boundary'
      )
    ).toBe(true)
    expect(coveredArtifactIds()).toEqual(expectedArtifactIds)
  })

  it('covers every co-execution completion rule and its required routes', () => {
    const data = loadInspectorData()
    const coveredRoutes = new Set(coveredRouteIds())
    const expectedCoExecutionGroups = data.coExecutionCompletionRules
      .map((rule) => rule.coExecutionGroup)
      .sort()

    expect(data.coExecutionCompletionRules).toHaveLength(9)
    expect(coveredCoExecutionGroups()).toEqual(expectedCoExecutionGroups)

    for (const rule of data.coExecutionCompletionRules) {
      for (const routeId of rule.requiredRouteIds) {
        expect(coveredRoutes.has(routeId), routeId).toBe(true)
      }
      for (const artifactId of rule.completionArtifactIds) {
        expect(coveredArtifactIds(), artifactId).toContain(artifactId)
      }
    }
  })

  it('covers bypass and source-drag classification routes as explicit integration cases', () => {
    const data = loadInspectorData()
    const coveredRoutes = new Set(coveredRouteIds())
    const bypassRouteIds = data.conditionalRoutes
      .filter((route) => route.routeType === 'bypass')
      .map((route) => route.id)
      .sort()

    expect(bypassRouteIds).toEqual([
      'center-dashed-authored-stroke-descriptor',
      'center-solid-authored-stroke-descriptor',
      'constrained-solid-same-owner-smooth-span-descriptor',
      'hidden-output-cache-bypass',
      'paint-only-cache-retint',
      'verified-product-descriptor-cache-hit'
    ])
    for (const routeId of requiredBypassOrClassificationRouteIds) {
      expect(coveredRoutes.has(routeId), routeId).toBe(true)
    }
  })

  it('keeps every integration case tied to positive handoff and forbidden contributor assertions', () => {
    const data = loadInspectorData()
    const routeIds = new Set(data.conditionalRoutes.map((route) => route.id))
    const artifactIds = new Set(data.artifactRegistry.map((artifact) => artifact.id))
    const coExecutionGroups = new Set(
      data.coExecutionCompletionRules.map((rule) => rule.coExecutionGroup)
    )
    const stepIds = new Set(data.steps.map((step) => step.id))

    for (const entry of strokeIntegrationCoverageMap) {
      expect(entry.id).toMatch(/^[a-z0-9-]+$/)
      expect(entry.stepRange[0]).toBeGreaterThanOrEqual(1)
      expect(entry.stepRange[1]).toBeLessThanOrEqual(41)
      expect(entry.stepRange[0]).toBeLessThanOrEqual(entry.stepRange[1])
      expect(entry.stepIds.length, entry.id).toBeGreaterThan(0)
      expect(entry.routeIds.length, entry.id).toBeGreaterThan(0)
      expect(entry.positiveAssertions.length, entry.id).toBeGreaterThan(0)
      expect(entry.forbiddenAssertions.length, entry.id).toBeGreaterThan(0)
      expect(entry.specRuleRefs.length, entry.id).toBeGreaterThan(0)

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
      for (const groupId of entry.coExecutionGroups) {
        expect(coExecutionGroups.has(groupId), `${entry.id}:${groupId}`).toBe(
          true
        )
      }
      for (const specRuleRef of entry.specRuleRefs) {
        expect(specRuleRef).toContain(
          'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md#'
        )
      }
    }
  })
})
