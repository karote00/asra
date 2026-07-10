import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

interface InspectorData {
  steps: { id: string; unitTestFile: string }[]
  finalValidationMethods: {
    id: string
    stepMembership: string
    configuredBy: string
    requiredForGoalCompletion: boolean
    limitations: string[]
  }[]
  optionalDiagnosticChannels: {
    id: string
    stepMembership: string
    limitations: string[]
  }[]
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
    const stepIds = data.steps.map((step) => step.id)
    expect(stepIds).not.toContain('visible-final-result')
    expect(stepIds).not.toContain('app-visual-review')
    expect(stepIds).not.toContain('runtime-diagnostics')
    expect(data.steps.at(-1)).toMatchObject({
      id: 'hit-export',
      unitTestFile:
        'packages/preset/src/__tests__/stroke-flow/step-41-hit-export.test.ts'
    })
    expect(data.runtimeImplementationState.verifiedStepIds).not.toContain(
      'visible-final-result'
    )
    expect(data.runtimeImplementationState.verifiedStepIds).not.toContain(
      'app-visual-review'
    )
    expect(data.runtimeImplementationState.verifiedStepIds).not.toContain(
      'runtime-diagnostics'
    )
    expect(data.runtimeImplementationState.activeStepId).not.toBe(
      'visible-final-result'
    )
    expect(data.runtimeImplementationState.activeStepId).not.toBe(
      'app-visual-review'
    )
    expect(data.runtimeImplementationState.activeStepId).not.toBe(
      'runtime-diagnostics'
    )
  })

  it('keeps explicit-request visual methods optional and outside the inspector flow', () => {
    const data = loadInspectorData()
    const readme = readFileSync(readmePath, 'utf8')
    const activePlan = readFileSync(activePlanPath, 'utf8')

    expect('validationGates' in data).toBe(false)
    expect(data.finalValidationMethods.map((method) => method.id)).toEqual([
      'visible-final-result',
      'app-visual-review'
    ])
    for (const method of data.finalValidationMethods) {
      expect(method.stepMembership).toBe(
        'excluded-from-runtime-inspector-steps'
      )
      expect(method.configuredBy).toBe('explicit-user-request-only')
      expect(method.requiredForGoalCompletion).toBe(false)
      expect(method.limitations.join(' ')).toContain('not an inspector')
      expect(method.limitations.join(' ')).toContain('explicit user request')
    }
    expect(data.optionalDiagnosticChannels).toEqual([
      expect.objectContaining({
        id: 'runtime-diagnostics',
        stepMembership: 'excluded-from-runtime-inspector-steps'
      })
    ])
    expect(data.steps.map((step) => step.id)).not.toEqual(
      expect.arrayContaining([
        'visible-final-result',
        'app-visual-review',
        'runtime-diagnostics'
      ])
    )
    for (const source of [readme, activePlan]) {
      expect(source).toContain('visible-final-result')
      expect(source).toContain('app-visual-review')
      expect(source).toContain('explicit-request-only')
      expect(source).toMatch(/not (a )?runtime/)
    }
  })

  it('uses technical phase prerequisites and optional visual methods', () => {
    const data = loadInspectorData()
    const readme = readFileSync(readmePath, 'utf8')
    const activePlan = readFileSync(activePlanPath, 'utf8')

    expect(data.refactorProtocol.integrationPolicy).toContain(
      'runtime unit gate'
    )
    expect(data.refactorProtocol.integrationPolicy).toContain(
      'begin automatically'
    )
    expect(data.refactorProtocol.e2ePolicy).toContain('starts automatically')
    expect(data.refactorProtocol.e2ePolicy).toContain('explicit user request')
    expect(data.refactorProtocol.fullRegressionFailurePolicy).toContain(
      'later regression phase'
    )
    expect(data.refactorProtocol.stepRetryFailurePolicy).toContain(
      'task replan'
    )
    expect(data.refactorProtocol.fullRegressionFailurePolicy).toContain(
      'task replan'
    )
    expect(data.refactorProtocol.stepRetryFailurePolicy).not.toMatch(
      /notify|user discussion/i
    )
    expect(data.refactorProtocol.fullRegressionFailurePolicy).not.toMatch(
      /notify|user discussion/i
    )

    for (const source of [readme, activePlan]) {
      expect(source).toContain('explicit-request-only')
      expect(source).toContain('runtime unit gate')
      expect(source).toMatch(/Integration|integration/)
      expect(source).toMatch(/E2E/)
      expect(source).toMatch(/visual/)
      expect(source).toMatch(/regression/)
      expect(source).not.toMatch(/user (?:explicitly )?approv/i)
      expect(source).not.toMatch(
        /user visual inspection (?:is complete|passes)/i
      )
      expect(source).not.toMatch(/notify the user|user discussion/i)
    }
  })
})
