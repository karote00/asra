import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertStrokeParameterCoverageForStep } from './stroke-parameter-coverage-test-helper'
import { createValidatedVectorComputedPatchRequest } from '../../../../../apps/asyra-design/src/common-apis/element/vector-apis'

interface InspectorStep {
  id: string
  refactorStatus: 'locked' | 'active' | 'verified'
}

interface InspectorData {
  steps: InspectorStep[]
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
const vectorApisSourcePath = resolve(
  repoRoot,
  'apps/asyra-design/src/common-apis/element/vector-apis.ts'
)
const penToolSourcePath = resolve(
  repoRoot,
  'apps/asyra-design/src/features/pen-tool/index.ts'
)
const deleteVectorPointSourcePath = resolve(
  repoRoot,
  'apps/asyra-design/src/features/delete-vector-point/index.ts'
)
const vectorPointPropertiesSourcePath = resolve(
  repoRoot,
  'apps/asyra-design/src/properties/vector-point.tsx'
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

const structuralIntent = {
  kind: 'operation-scoped-topology-patch-intent',
  routeId: 'structural-vector-operation',
  ownerStage: 'Interaction',
  operation: 'append-anchor',
  elementId: 'vector:step-05',
  patch: {
    changedRecords: ['point:create'],
    undoable: true
  },
  inputEvidence: {
    operation: 'append-anchor',
    inputIds: ['point:a']
  },
  outputRevision:
    'structural-vector-operation:append-anchor:vector:step-05:point:create:undoable'
} as const

const computedPatch = {
  records: {
    points: {
      set: {
        'point:a': {
          id: 'point:a',
          kind: 'anchor',
          x: 10,
          y: 20
        }
      }
    }
  }
}

const collectKeys = (value: unknown, keys = new Set<string>()) => {
  if (!value || typeof value !== 'object') {
    return keys
  }
  for (const key of Object.keys(value)) {
    keys.add(key)
    collectKeys((value as Record<string, unknown>)[key], keys)
  }
  return keys
}

describe('stroke flow step 05: common-api-domain-adapter', () => {
  it('keeps common-api-domain-adapter as the current or verified fifth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'common-api-domain-adapter'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'common-api-domain-adapter'
      ])
    }
  })

  it('materializes an explicit structural intent into a validated computed patch request', () => {
    const request = createValidatedVectorComputedPatchRequest({
      intent: structuralIntent,
      elementId: 'vector:step-05',
      operation: 'append-anchor',
      patch: computedPatch
    })

    expect(request).toEqual({
      kind: 'validated-computed-patch-request',
      routeId: 'common-api-domain-adapter',
      ownerStage: 'Model Commit',
      sourceRouteId: 'structural-vector-operation',
      elementId: 'vector:step-05',
      operation: 'append-anchor',
      patch: computedPatch,
      eventOptions: {
        undoable: true
      },
      inputEvidence: {
        intentRevision:
          'structural-vector-operation:append-anchor:vector:step-05:point:create:undoable',
        inputIds: ['point:a'],
        changedRecords: ['point:create']
      },
      validation: {
        elementMatched: true,
        operationMatched: true,
        hasPatchOperations: true,
        renderFieldsAbsent: true
      }
    })
  })

  it('rejects invalid intent, element mismatch, operation mismatch, or empty patch requests', () => {
    expect(
      createValidatedVectorComputedPatchRequest({
        intent: null,
        elementId: 'vector:step-05',
        operation: 'append-anchor',
        patch: computedPatch
      })
    ).toBeNull()
    expect(
      createValidatedVectorComputedPatchRequest({
        intent: {
          ...structuralIntent,
          routeId: 'other-route'
        },
        elementId: 'vector:step-05',
        operation: 'append-anchor',
        patch: computedPatch
      })
    ).toBeNull()
    expect(
      createValidatedVectorComputedPatchRequest({
        intent: structuralIntent,
        elementId: 'other-vector',
        operation: 'append-anchor',
        patch: computedPatch
      })
    ).toBeNull()
    expect(
      createValidatedVectorComputedPatchRequest({
        intent: structuralIntent,
        elementId: 'vector:step-05',
        operation: 'remove-anchor',
        patch: computedPatch
      })
    ).toBeNull()
    expect(
      createValidatedVectorComputedPatchRequest({
        intent: structuralIntent,
        elementId: 'vector:step-05',
        operation: 'append-anchor',
        patch: {}
      })
    ).toBeNull()
  })

  it('keeps validated patch requests free of render, stroke product, and geometry ownership fields', () => {
    const request = createValidatedVectorComputedPatchRequest({
      intent: structuralIntent,
      elementId: 'vector:step-05',
      operation: 'append-anchor',
      patch: computedPatch
    })
    const emittedKeys = collectKeys(request)

    for (const forbiddenKey of [
      'render',
      'geometry',
      'packet',
      'descriptor',
      'mask',
      'stroke',
      'join',
      'miterAngle',
      'resolvedJoin',
      'vertexAngle',
      'product'
    ]) {
      expect(emittedKeys.has(forbiddenKey)).toBe(false)
    }
  })

  it('threads Step 4 structural intents into common API adapter calls', () => {
    const vectorApisSource = readFileSync(vectorApisSourcePath, 'utf8')
    const penToolSource = readFileSync(penToolSourcePath, 'utf8')
    const deleteVectorPointSource = readFileSync(
      deleteVectorPointSourcePath,
      'utf8'
    )
    const vectorPointPropertiesSource = readFileSync(
      vectorPointPropertiesSourcePath,
      'utf8'
    )

    expect(vectorApisSource).toContain(
      'createValidatedVectorComputedPatchRequest'
    )
    expect(vectorApisSource).toContain('structuralOperationIntent?:')
    expect(penToolSource).toContain('structuralOperationIntent')
    expect(deleteVectorPointSource).toContain('structuralOperationIntent')
    expect(vectorPointPropertiesSource).toContain('structuralOperationIntent')

    for (const forbiddenToken of [
      'stroke-render',
      'buildSourceVertexJoinFootprint',
      'buildConstrained',
      'strokePathStyle',
      'renderDescriptor',
      'strokeMaskPolygons',
      'descriptorProductPolygons',
      'fillPolygons'
    ]) {
      expect(vectorApisSource).not.toContain(forbiddenToken)
      expect(penToolSource).not.toContain(forbiddenToken)
      expect(deleteVectorPointSource).not.toContain(forbiddenToken)
      expect(vectorPointPropertiesSource).not.toContain(forbiddenToken)
    }
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('common-api-domain-adapter')
  })

})
