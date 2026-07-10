import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { strokeIntegrationCoverageMap } from './stroke-integration-coverage-map'

export interface StrokeInspectorRoute {
  id: string
  from: string
  to: string
  routeType: string
  consumes: string[]
  produces: string[]
  skipSteps: string[]
  resumeAt: string
  nextConsumer: string
  forbiddenContributors: string[]
}

export interface StrokeInspectorData {
  steps: { id: string; stepNumber: number }[]
  conditionalRoutes: StrokeInspectorRoute[]
  artifactRegistry: { id: string; kind: string; channel: string }[]
  wholeFlowReviewContract: {
    reviewSegments: { id: string; stepIds: string[] }[]
  }
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

let cachedInspectorData: StrokeInspectorData | null = null

export const loadStrokeInspectorData = (): StrokeInspectorData => {
  if (cachedInspectorData) {
    return cachedInspectorData
  }
  const windowRecord: { STROKE_FLOW_INSPECTOR_DATA?: StrokeInspectorData } = {}
  ;(globalThis as typeof globalThis & { window?: unknown }).window = windowRecord
  Reflect.deleteProperty(require.cache, require.resolve(inspectorPath))
  require(inspectorPath)
  expect(windowRecord.STROKE_FLOW_INSPECTOR_DATA).toBeDefined()
  cachedInspectorData = windowRecord.STROKE_FLOW_INSPECTOR_DATA as StrokeInspectorData
  return cachedInspectorData
}

export const getStrokeInspectorRoute = (
  data: StrokeInspectorData,
  routeId: string
) => {
  const route = data.conditionalRoutes.find((entry) => entry.id === routeId)
  expect(route, routeId).toBeDefined()
  return route as StrokeInspectorRoute
}

export const integrationCase = (
  coverageCaseId: string,
  title: string,
  run: () => void | Promise<void>
) => {
  const coverage = strokeIntegrationCoverageMap.find(
    (entry) => entry.id === coverageCaseId
  )
  if (!coverage) {
    throw new Error(`Unknown stroke integration coverage case: ${coverageCaseId}`)
  }
  return it(title, run)
}
