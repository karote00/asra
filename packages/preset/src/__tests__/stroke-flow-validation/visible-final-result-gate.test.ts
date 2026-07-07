import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

interface InspectorData {
  steps: { id: string; unitTestFile: string }[]
  currentExecutionState: {
    totalSteps: number
  }
  runtimeImplementationState: {
    verifiedStepIds: string[]
    activeStepId: string | null
  }
  refactorProtocol: {
    integrationPolicy: string
    e2ePolicy: string
    fullRegressionFailurePolicy: string
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
const readmePath = resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md'
)
const activePlanPath = resolve(repoRoot, 'docs/ai/apps/asyra-design/PLANS.md')
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
  expect(windowRecord.STROKE_FLOW_INSPECTOR_DATA).toBeDefined()
  cachedInspectorData = windowRecord.STROKE_FLOW_INSPECTOR_DATA as InspectorData
  return cachedInspectorData
}

describe('stroke flow validation gate: visible-final-result', () => {
  it('keeps visible-final-result out of runtime steps and runtime lock state', () => {
    const data = loadInspectorData()

    expect(data.inspectorContractErrors).toEqual([])
    expect(data.currentExecutionState.totalSteps).toBe(41)
    expect(data.steps).toHaveLength(41)
    expect('validationGates' in data).toBe(false)
    expect(data.steps.map((step) => step.id)).not.toContain(
      'visible-final-result'
    )
    expect(
      data.steps.some((step) => step.unitTestFile.includes('step-42'))
    ).toBe(false)
    expect(data.runtimeImplementationState.verifiedStepIds).not.toContain(
      'visible-final-result'
    )
    expect(data.runtimeImplementationState.activeStepId).not.toBe(
      'visible-final-result'
    )
  })

  it('keeps visible-final-result as documentation-only post-runtime validation', () => {
    const data = loadInspectorData()
    const readme = readFileSync(readmePath, 'utf8')
    const activePlan = readFileSync(activePlanPath, 'utf8')

    expect('validationGates' in data).toBe(false)
    expect(data.steps.map((step) => step.id)).not.toContain(
      'visible-final-result'
    )
    for (const source of [readme, activePlan]) {
      expect(source).toContain('visible-final-result')
      expect(source).toContain('post-runtime validation gate')
      expect(source).toContain('not a runtime')
    }
  })

  it('keeps visual validation locked outside the 41-step runtime unit suite', () => {
    const data = loadInspectorData()
    const readme = readFileSync(readmePath, 'utf8')
    const activePlan = readFileSync(activePlanPath, 'utf8')

    expect(data.refactorProtocol.integrationPolicy).toContain(
      'unit-complete checkpoint'
    )
    expect(data.refactorProtocol.integrationPolicy).toContain('locked')
    expect(data.refactorProtocol.integrationPolicy).toContain('user approves')
    expect(data.refactorProtocol.e2ePolicy).toContain('later user-approved')
    expect(data.refactorProtocol.fullRegressionFailurePolicy).toContain(
      'later regression phase'
    )

    for (const source of [readme, activePlan]) {
      expect(source).toContain('41 runtime inspector-step unit tests')
      expect(source).toContain('post-runtime validation gate')
      expect(source).toContain('unit-complete checkpoint')
      expect(source).toMatch(/Integration|integration/)
      expect(source).toMatch(/E2E/)
      expect(source).toMatch(/visual/)
      expect(source).toMatch(/regression/)
    }
  })
})
