import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  assertStrokeParameterCoverageForStep,
  expectNoStrokeParameterOutputKeys
} from './stroke-parameter-coverage-test-helper'
import { createStructuralVectorOperationPatchIntent } from '../../../../../apps/asyra-design/src/features/path-editing-intents'

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
const intentSourcePath = resolve(
  repoRoot,
  'apps/asyra-design/src/features/path-editing-intents.ts'
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

describe('stroke flow step 04: structural-vector-operation', () => {
  it('keeps structural-vector-operation as the current or verified fourth step', () => {
    const data = loadInspectorData()
    const step = data.steps.find(
      (entry) => entry.id === 'structural-vector-operation'
    )
    const activeSteps = data.steps.filter(
      (entry) => entry.refactorStatus === 'active'
    )

    expect(data.inspectorContractErrors).toEqual([])
    expect(step?.refactorStatus).toMatch(/^(locked|active|verified)$/)
    if (step?.refactorStatus === 'active') {
      expect(activeSteps.map((entry) => entry.id)).toEqual([
        'structural-vector-operation'
      ])
    }
  })

  it.each([
    ['append-anchor', ['point:create', 'segment:create']],
    ['remove-anchor', ['point:remove', 'segment:remove']],
    ['split-segment', ['segment:replace', 'point:create']],
    ['connect-anchors', ['segment:create']],
    ['close-subpath', ['segment:create', 'network:close']],
    ['set-anchor-type', ['point:type']],
    ['set-handle-mode', ['point:handleMode']],
    ['update-handle-position', ['point:inHandle']]
  ] as const)(
    'emits an operation-scoped topology patch intent for %s',
    (operation, changedRecords) => {
      const intent = createStructuralVectorOperationPatchIntent({
        elementId: 'vector:step-04',
        operation,
        inputIds: ['point:a', 'point:b'],
        changedRecords,
        undoable: true
      })

      expect(intent).toEqual({
        kind: 'operation-scoped-topology-patch-intent',
        routeId: 'structural-vector-operation',
        ownerStage: 'Interaction',
        operation,
        elementId: 'vector:step-04',
        patch: {
          changedRecords: [...changedRecords],
          undoable: true
        },
        inputEvidence: {
          operation,
          inputIds: ['point:a', 'point:b']
        },
        outputRevision: `structural-vector-operation:${operation}:vector:step-04:${changedRecords.join('|')}:undoable`
      })
    }
  )

  it('does not emit a structural intent without a scoped element, input ids, or changed records', () => {
    expect(
      createStructuralVectorOperationPatchIntent({
        elementId: '',
        operation: 'append-anchor',
        inputIds: ['point:a'],
        changedRecords: ['point:create'],
        undoable: true
      })
    ).toBeNull()
    expect(
      createStructuralVectorOperationPatchIntent({
        elementId: 'vector:step-04',
        operation: 'append-anchor',
        inputIds: [],
        changedRecords: ['point:create'],
        undoable: true
      })
    ).toBeNull()
    expect(
      createStructuralVectorOperationPatchIntent({
        elementId: 'vector:step-04',
        operation: 'append-anchor',
        inputIds: ['point:a'],
        changedRecords: [],
        undoable: true
      })
    ).toBeNull()
  })

  it('keeps the emitted structural intent free of downstream render and stroke product fields', () => {
    const intent = createStructuralVectorOperationPatchIntent({
      elementId: 'vector:step-04',
      operation: 'connect-anchors',
      inputIds: ['point:a', 'point:b'],
      changedRecords: ['segment:create'],
      undoable: true
    })
    const emittedKeys = collectKeys(intent)

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
    expectNoStrokeParameterOutputKeys(intent)
  })

  it('ignores stroke-like extra inputs instead of treating them as structural vector intent', () => {
    const baseInput = {
      elementId: 'vector:step-04',
      operation: 'connect-anchors',
      inputIds: ['point:a', 'point:b'],
      changedRecords: ['segment:create'],
      undoable: true
    }
    const strokeLikeInput = {
      ...baseInput,
      stroke: {
        fill: {
          visible: true,
          kind: 'solid',
          color: '#0000ff',
          opacity: 0.8,
          gradient: null,
          colorFormat: 'hex',
          defaultColorFormat: 'hex'
        },
        style: 'solid',
        position: 'center',
        width: 10,
        dash: 0,
        gap: 0,
        capType: 'butt',
        joinType: 'bevel',
        miterAngle: 30
      }
    } as unknown as Parameters<
      typeof createStructuralVectorOperationPatchIntent
    >[0]

    expect(createStructuralVectorOperationPatchIntent(strokeLikeInput)).toEqual(
      createStructuralVectorOperationPatchIntent(baseInput)
    )
    expectNoStrokeParameterOutputKeys(
      createStructuralVectorOperationPatchIntent(strokeLikeInput)
    )
  })

  it('routes structural vector operations through the step boundary without render APIs', () => {
    const intentSource = readFileSync(intentSourcePath, 'utf8')
    const penToolSource = readFileSync(penToolSourcePath, 'utf8')
    const deleteVectorPointSource = readFileSync(
      deleteVectorPointSourcePath,
      'utf8'
    )
    const vectorPointPropertiesSource = readFileSync(
      vectorPointPropertiesSourcePath,
      'utf8'
    )

    expect(penToolSource).toContain(
      'createStructuralVectorOperationPatchIntent'
    )
    expect(penToolSource).toContain("operation: 'append-anchor'")
    expect(penToolSource).toContain("operation: 'split-segment'")
    expect(penToolSource).toContain("operation: 'connect-anchors'")
    expect(deleteVectorPointSource).toContain(
      'createStructuralVectorOperationPatchIntent'
    )
    expect(deleteVectorPointSource).toContain("operation: 'remove-anchor'")
    expect(vectorPointPropertiesSource).toContain(
      'createStructuralVectorOperationPatchIntent'
    )
    expect(vectorPointPropertiesSource).toContain(
      "operation: 'set-anchor-type'"
    )
    expect(vectorPointPropertiesSource).toContain(
      "operation: 'set-handle-mode'"
    )
    expect(vectorPointPropertiesSource).toContain(
      "operation: 'update-handle-position'"
    )

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
      expect(deleteVectorPointSource).not.toContain(forbiddenToken)
      expect(vectorPointPropertiesSource).not.toContain(forbiddenToken)
    }
  })

  it('matches the stroke parameter coverage matrix for this step', () => {
    assertStrokeParameterCoverageForStep('structural-vector-operation')
  })
})
