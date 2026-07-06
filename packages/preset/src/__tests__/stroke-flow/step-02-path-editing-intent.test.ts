import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  assertStrokeParameterCoverageForStep,
  expectNoStrokeParameterOutputKeys
} from './stroke-parameter-coverage-test-helper'
import { createPathEditingVectorOperationRequest } from '../../../../../apps/asyra-design/src/features/path-editing-intents'

interface InspectorStep {
  id: string
  refactorStatus: 'locked' | 'active' | 'verified'
}

interface InspectorData {
  steps: InspectorStep[]
  inspectorContractErrors: string[]
}

type PointTarget = Parameters<
  typeof createPathEditingVectorOperationRequest
>[0]['hoveredPoint'] extends infer HoveredPoint
  ? NonNullable<HoveredPoint>['target']
  : never

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../'
)
const require = createRequire(import.meta.url)
const inspectorPath = resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js'
)
const intentSourcePath = resolve(
  repoRoot,
  'apps/asyra-design/src/features/path-editing-intents.ts'
)
const penToolSourcePath = resolve(
  repoRoot,
  'apps/asyra-design/src/features/pen-tool/index.ts'
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

const pointHover = (target: PointTarget) => ({
  elementId: 'vector:step-02',
  pointId: 'point:step-02',
  index: 2,
  target,
  x: 12,
  y: 34
})

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

describe('stroke flow step 02: path-editing-intent', () => {
  it('keeps path-editing-intent as the current or verified second step', () => {
    const data = loadInspectorData()
    const step = data.steps.find((entry) => entry.id === 'path-editing-intent')
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'path-editing-intent'
      ])
    }
  })

  it.each(['anchor', 'inHandle', 'outHandle'] as const)(
    'emits a bounded vector point operation request for %s hover state',
    (target) => {
      const request = createPathEditingVectorOperationRequest({
        selectedElementIds: ['vector:step-02'],
        pathEditingVectorId: 'vector:step-02',
        hoveredPoint: pointHover(target),
        hoveredSegment: null
      })

      expect(request).toEqual({
        kind: 'bounded-vector-operation-request',
        routeId: 'path-editing-intent',
        ownerStage: 'Interaction',
        operation: 'select-vector-point',
        elementId: 'vector:step-02',
        target: {
          pointId: 'point:step-02',
          index: 2,
          target,
          position: {
            x: 12,
            y: 34
          }
        },
        inputEvidence: {
          selectedElementIds: ['vector:step-02'],
          pathEditingVectorId: 'vector:step-02',
          source: 'path-editing-hover-state'
        },
        outputRevision: `select-vector-point:vector:step-02:point:step-02:${target}`
      })
    }
  )

  it('emits a bounded vector segment operation request for segment hover state', () => {
    const request = createPathEditingVectorOperationRequest({
      selectedElementIds: ['vector:step-02'],
      pathEditingVectorId: 'vector:step-02',
      hoveredPoint: null,
      hoveredSegment: {
        elementId: 'vector:step-02',
        segmentId: 'segment:step-02'
      }
    })

    expect(request).toEqual({
      kind: 'bounded-vector-operation-request',
      routeId: 'path-editing-intent',
      ownerStage: 'Interaction',
      operation: 'select-vector-segment',
      elementId: 'vector:step-02',
      target: {
        segmentId: 'segment:step-02'
      },
      inputEvidence: {
        selectedElementIds: ['vector:step-02'],
        pathEditingVectorId: 'vector:step-02',
        source: 'path-editing-hover-state'
      },
      outputRevision: 'select-vector-segment:vector:step-02:segment:step-02'
    })
  })

  it('does not emit a request without an active path-editing selection boundary', () => {
    expect(
      createPathEditingVectorOperationRequest({
        selectedElementIds: [],
        pathEditingVectorId: 'vector:step-02',
        hoveredPoint: pointHover('anchor'),
        hoveredSegment: null
      })
    ).toBeNull()
    expect(
      createPathEditingVectorOperationRequest({
        selectedElementIds: ['other-vector'],
        pathEditingVectorId: 'vector:step-02',
        hoveredPoint: pointHover('anchor'),
        hoveredSegment: null
      })
    ).toBeNull()
    expect(
      createPathEditingVectorOperationRequest({
        selectedElementIds: ['vector:step-02'],
        pathEditingVectorId: null,
        hoveredPoint: pointHover('anchor'),
        hoveredSegment: null
      })
    ).toBeNull()
    expect(
      createPathEditingVectorOperationRequest({
        selectedElementIds: ['vector:step-02'],
        pathEditingVectorId: 'vector:step-02',
        hoveredPoint: { ...pointHover('anchor'), elementId: 'other-vector' },
        hoveredSegment: {
          elementId: 'other-vector',
          segmentId: 'segment:step-02'
        }
      })
    ).toBeNull()
  })

  it('keeps the emitted request free of downstream product fields', () => {
    const request = createPathEditingVectorOperationRequest({
      selectedElementIds: ['vector:step-02'],
      pathEditingVectorId: 'vector:step-02',
      hoveredPoint: pointHover('anchor'),
      hoveredSegment: null
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
      'computedPatch',
      'points',
      'segments',
      'networks',
      'product'
    ]) {
      expect(emittedKeys.has(forbiddenKey)).toBe(false)
    }
    expectNoStrokeParameterOutputKeys(request)
  })

  it('ignores stroke-like extra inputs instead of treating them as path-editing intent', () => {
    const baseInput = {
      selectedElementIds: ['vector:step-02'],
      pathEditingVectorId: 'vector:step-02',
      hoveredPoint: pointHover('anchor'),
      hoveredSegment: null
    }
    const strokeLikeInput = {
      ...baseInput,
      stroke: {
        fill: {
          visible: true,
          kind: 'solid',
          color: '#ff0000',
          opacity: 0.5,
          gradient: null,
          colorFormat: 'hex',
          defaultColorFormat: 'hex'
        },
        style: 'dashed',
        position: 'outside',
        width: 12,
        dash: 8,
          gap: 4,
        capType: 'round',
        joinType: 'miter',
        miterAngle: 30
      }
    } as unknown as Parameters<typeof createPathEditingVectorOperationRequest>[0]

    expect(createPathEditingVectorOperationRequest(strokeLikeInput)).toEqual(
      createPathEditingVectorOperationRequest(baseInput)
    )
    expectNoStrokeParameterOutputKeys(
      createPathEditingVectorOperationRequest(strokeLikeInput)
    )
  })

  it('routes path-editing handler decisions through intent without render APIs', () => {
    const intentSource = readFileSync(intentSourcePath, 'utf8')
    const penToolSource = readFileSync(penToolSourcePath, 'utf8')

    expect(penToolSource).toContain('createPathEditingVectorOperationRequest')

    for (const forbiddenToken of [
      'deps.render',
      '__asyraStroke',
      'render.update',
      'stroke-render',
      'buildSourceVertexJoinFootprint',
      'buildConstrained',
      'strokePathStyle',
      'renderDescriptor',
      'strokeMaskPolygons',
      'descriptorProductPolygons',
      'fillPolygons'
    ]) {
      expect(intentSource).not.toContain(forbiddenToken)
      expect(penToolSource).not.toContain(forbiddenToken)
    }
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('path-editing-intent')
  })

})
